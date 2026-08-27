// Package sshfs 以 SSH 連線實作 fsb.FileSystem: 每個檔案操作皆轉為一道遠端 shell 指令,
// 解析其輸出後組出介面所需的項目屬性. 僅支援 POSIX 遠端, 且假定遠端具備 GNU coreutils 與
// findutils (find 的 -printf 為 GNU 擴充), 例如 Debian 系 Linux.
//
// 本套件僅供範例使用: 認證只支援無 passphrase 的私鑰檔, 且不驗證 host key (見 Dial).
package sshfs

import (
	"errors"
	"fmt"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/nexgus/fsbrowser/fsb"
)

// Runner 是在遠端執行單一指令的能力介面. FS 只依賴本介面, 使單元測試可注入假實作驗證
// 輸出解析與錯誤對映, 不需真的建立 SSH 連線.
type Runner interface {
	// Run 在遠端執行指令, 回傳 stdout, stderr 與結束碼. 指令本身順利執行 (即使結束碼
	// 非 0) 時 err 為 nil; err 非 nil 表示連線層失敗或逾時.
	Run(cmd string) (stdout, stderr []byte, exit int, err error)
}

// FS 是遠端檔案系統的實作, 以 Runner 下發指令.
type FS struct {
	run   Runner
	label string // 顯示名稱 (形如 "user@host"), 僅用於錯誤訊息
	home  string // 遠端家目錄, 連線時取得一次後快取
}

// NewFS 以既有的指令執行器建立遠端檔案系統實作.
//
// label 為錯誤訊息中標示遠端主機用的顯示名稱 (形如 "user@host"); home 為連線時取得的
// 遠端家目錄, 空字串表示未取得, 此時 Home 會回報錯誤.
func NewFS(runner Runner, label, home string) *FS {
	return &FS{run: runner, label: label, home: home}
}

// Quote 以單引號跳脫 shell 參數, 使任意路徑 (含空白與特殊字元) 均可安全下發至遠端.
func Quote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'"
}

// printfFormat 為 find 的輸出格式: 項目自身種類, 解參考後種類, 位元組數, 修改時間
// (Unix 秒, 可能帶小數), 名稱; 各欄以 tab 分隔, 每筆以 NUL 結尾, 使名稱含換行或 tab
// 亦不影響切分 (名稱為最後一欄).
const printfFormat = `%y\t%Y\t%s\t%T@\t%f\0`

// List 列出 dir 目錄的內容. 先 cd 進目標目錄再列出: dir 實為檔案, 不存在或無權限時由
// cd 觸發 stderr 供錯誤分類 (find 本身遇檔案不報錯, 只回空清單); -H 使 dir 本身若為指向
// 目錄的連結亦可正常列出.
func (f *FS) List(dir string) ([]fsb.Entry, error) {
	p := cleanPath(dir)
	cmd := "cd -- " + Quote(p) + ` && find -H . -mindepth 1 -maxdepth 1 -printf ` + Quote(printfFormat)
	stdout, stderr, exit, err := f.run.Run(cmd)
	if opErr := f.classify(p, stderr, exit, err); opErr != nil {
		return nil, opErr
	}
	return parseRecords(string(stdout), p), nil
}

// Stat 查詢單一路徑的屬性 (不解析路徑本身的連結).
func (f *FS) Stat(p string) (fsb.Entry, error) {
	cp := cleanPath(p)
	cmd := "find " + Quote(cp) + ` -maxdepth 0 -printf ` + Quote(printfFormat)
	stdout, stderr, exit, err := f.run.Run(cmd)
	if opErr := f.classify(cp, stderr, exit, err); opErr != nil {
		return fsb.Entry{}, opErr
	}
	// Stat 的 find 以完整路徑查詢, %f 因此為路徑最後一段; 父目錄取自 cp 本身.
	entries := parseRecords(string(stdout), parentOf(cp))
	if len(entries) == 0 {
		return fsb.Entry{}, fsb.NewError(fsb.ErrIO, "remote did not report entry info for "+cp)
	}
	entry := entries[0]
	entry.Path = cp
	entry.Name = baseName(cp)
	entry.Hidden = hiddenName(entry.Name)
	return entry, nil
}

// Home 回傳連線時取得的遠端家目錄.
func (f *FS) Home() (string, error) {
	if f.home == "" {
		return "", fsb.NewError(fsb.ErrIO, "cannot determine remote home directory for "+f.label)
	}
	return f.home, nil
}

// Roots 回傳 POSIX 遠端唯一的根 ("/").
func (f *FS) Roots() ([]string, error) {
	return []string{"/"}, nil
}

// PathStyle 固定回傳 "posix": 本套件只支援 POSIX 遠端.
func (f *FS) PathStyle() string {
	return fsb.PathStylePOSIX
}

// MakeDir 於 path 建立目錄; 不建立缺少的上層目錄 (mkdir 不加 -p).
func (f *FS) MakeDir(p string) error {
	cp := cleanPath(p)
	cmd := "mkdir -- " + Quote(cp)
	_, stderr, exit, err := f.run.Run(cmd)
	return f.classify(cp, stderr, exit, err)
}

// Rename 將 oldPath 重新命名 (或搬移) 為 newPath. 以 mv -n 避免覆寫既有項目, 並先行
// 檢查目標是否存在, 使目標已存在時回報 already_exists (mv -n 於目標存在時仍以 0 結束).
func (f *FS) Rename(oldPath, newPath string) error {
	oldP := cleanPath(oldPath)
	newP := cleanPath(newPath)

	if _, _, exit, err := f.run.Run("test -e " + Quote(newP) + " -o -L " + Quote(newP)); err != nil {
		return f.connError(err)
	} else if exit == 0 {
		return fsb.NewError(fsb.ErrAlreadyExists, "path already exists: "+newP)
	}

	cmd := "mv -n -- " + Quote(oldP) + " " + Quote(newP)
	_, stderr, exit, err := f.run.Run(cmd)
	return f.classify(oldP, stderr, exit, err)
}

// Delete 刪除 path 所指的檔案或目錄. 不遞迴: 目錄以 rmdir 刪除, 非空時回報 not_empty;
// 其餘項目以 rm 刪除.
func (f *FS) Delete(p string) error {
	cp := cleanPath(p)
	cmd := "if [ -d " + Quote(cp) + " ] && [ ! -L " + Quote(cp) + " ]; then rmdir -- " + Quote(cp) +
		"; else rm -- " + Quote(cp) + "; fi"
	_, stderr, exit, err := f.run.Run(cmd)
	return f.classify(cp, stderr, exit, err)
}

// parseRecords 解析 find -printf 的輸出: NUL 分隔每筆, 每筆以 tab 分為五欄; 欄位不足
// 或空白筆略過. dir 為各項目所在的目錄, 用於組出項目的完整路徑.
func parseRecords(out string, dir string) []fsb.Entry {
	entries := make([]fsb.Entry, 0)
	for _, rec := range strings.Split(out, "\x00") {
		if rec == "" {
			continue
		}
		fields := strings.SplitN(rec, "\t", 5)
		if len(fields) < 5 {
			continue
		}
		name := fields[4]
		size, _ := strconv.ParseInt(strings.TrimSpace(fields[2]), 10, 64)

		entry := fsb.Entry{
			Name:    name,
			Path:    joinPath(dir, name),
			Kind:    kindOfType(fields[0]),
			IsLink:  fields[0] == "l",
			Size:    size,
			ModTime: parseStamp(fields[3]),
			Hidden:  hiddenName(name),
		}
		if entry.IsLink {
			// 連結本身的種類依介面約定記為一般檔案, 目標種類取自 find 的解參考欄位.
			entry.Kind = fsb.KindFile
			entry.Target = kindOfType(fields[1])
		}
		entries = append(entries, entry)
	}
	return entries
}

// kindOfType 把 find 的類型字母對映為介面的基本種類. 解參考欄位 (%Y) 於失效連結為 "N",
// 於連結成環為 "L", 於其他解析失敗為 "?", 三者皆歸為 KindMissing.
func kindOfType(t string) fsb.Kind {
	switch t {
	case "f":
		return fsb.KindFile
	case "d":
		return fsb.KindDir
	case "l":
		return fsb.KindFile
	case "s":
		return fsb.KindSocket
	case "p":
		return fsb.KindFIFO
	case "b", "c":
		return fsb.KindDevice
	case "N", "L", "?":
		return fsb.KindMissing
	default:
		return fsb.KindUnknown
	}
}

// parseStamp 解析 find 的 %T@ 欄位 (Unix 秒, 可能帶小數), 回傳 UTC 時間.
func parseStamp(s string) time.Time {
	s = strings.TrimSpace(s)
	if i := strings.IndexByte(s, '.'); i >= 0 {
		s = s[:i]
	}
	sec, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return time.Time{}
	}
	return time.Unix(sec, 0).UTC()
}

// classify 依執行結果判定操作是否失敗, 失敗時對映為介面的結構化錯誤; 指令結束碼為 0
// 且無 Go 端錯誤時回傳 nil.
//
// stderr 為 GNU coreutils / findutils 的英文訊息 (指令一律以 LC_ALL=C 執行, 見
// clientRunner.Run), 故可依關鍵字分類.
func (f *FS) classify(p string, stderr []byte, exit int, err error) error {
	if err != nil {
		return f.connError(err)
	}
	if exit == 0 {
		return nil
	}

	text := string(stderr)
	switch {
	case strings.Contains(text, "No such file or directory"):
		return fsb.NewError(fsb.ErrNotFound, "remote path does not exist: "+p)
	case strings.Contains(text, "Permission denied"):
		return fsb.NewError(fsb.ErrPermissionDenied, "permission denied on remote: "+p)
	case strings.Contains(text, "File exists"):
		return fsb.NewError(fsb.ErrAlreadyExists, "remote path already exists: "+p)
	case strings.Contains(text, "Directory not empty"):
		return fsb.NewError(fsb.ErrNotEmpty, "remote directory not empty: "+p)
	}
	return fsb.NewError(fsb.ErrIO, remoteMessage(text, p, exit))
}

// connError 把連線層錯誤 (session 開不出來, 對端關閉, 逾時等) 對映為 disconnected.
func (f *FS) connError(err error) error {
	if errors.Is(err, ErrTimeout) {
		return fsb.NewError(fsb.ErrDisconnected, "remote operation timed out (no response within "+opTimeout.String()+"): "+f.label)
	}
	return fsb.NewError(fsb.ErrDisconnected, "connection to "+f.label+" lost: "+err.Error())
}

// remoteMessage 組出未歸類的遠端失敗訊息: 有 stderr 時取其首行, 否則附上結束碼.
func remoteMessage(text, p string, exit int) string {
	line := strings.TrimSpace(strings.SplitN(strings.TrimRight(text, "\r\n"), "\n", 2)[0])
	if line != "" {
		return line
	}
	return fmt.Sprintf("remote operation failed (exit %d): %s", exit, p)
}

// cleanPath 把路徑正規化為 POSIX 絕對路徑.
func cleanPath(p string) string {
	if p == "" {
		return "/"
	}
	if !strings.HasPrefix(p, "/") {
		p = "/" + p
	}
	return path.Clean(p)
}

// joinPath 把子項目名稱接在目錄路徑之後.
func joinPath(dir, name string) string {
	if strings.HasSuffix(dir, "/") {
		return dir + name
	}
	return dir + "/" + name
}

// parentOf 取路徑的父目錄.
func parentOf(p string) string {
	return path.Dir(p)
}

// baseName 取路徑的最後一段; 根路徑回傳 "/".
func baseName(p string) string {
	if p == "/" {
		return "/"
	}
	return path.Base(p)
}

// hiddenName 依 POSIX 慣例判定隱藏項目: 名稱以 "." 開頭.
func hiddenName(name string) bool {
	return strings.HasPrefix(name, ".") && name != "." && name != ".."
}

// 確保 FS 滿足檔案操作介面.
var _ fsb.FileSystem = (*FS)(nil)
