// Package localfs 以標準庫 os 實作 fsb.FileSystem, 讓範例 app 可直接瀏覽執行所在機器的
// 本機檔案系統. macOS (以及其他 POSIX 系統) 與 Windows 皆支援, 平台相依的部分 (根的列舉,
// 路徑風格, 隱藏項目判定) 另以 build tag 分檔實作, 且一律不依賴 cgo, 使 Windows 版本可以
// CGO_ENABLED=0 交叉編譯.
//
// 對外的路徑一律為內部形式 (以 "/" 分隔; Windows 磁碟機標準化為 "C:/" 字首形式), 與作業
// 系統原生路徑之間的轉換全數封裝於本套件內.
package localfs

import (
	"errors"
	"io/fs"
	"os"
	"path"
	"strings"
	"syscall"

	"github.com/nexgus/fsbrowser/fsb"
)

// FS 是本機檔案系統的實作. 本身無狀態, 可安全地被多個 goroutine 同時使用.
type FS struct{}

// New 建立一個本機檔案系統實作.
func New() *FS {
	return &FS{}
}

// List 列出 dir 目錄的內容. dir 若為指向目錄的連結, 會先解析再列出.
func (f *FS) List(dir string) ([]fsb.Entry, error) {
	internal := cleanInternal(dir)
	osPath := toOS(internal)

	dirEntries, err := os.ReadDir(osPath)
	if err != nil {
		return nil, translate(err, internal)
	}

	entries := make([]fsb.Entry, 0, len(dirEntries))
	for _, de := range dirEntries {
		childPath := joinInternal(internal, de.Name())
		entry, err := f.statInternal(childPath)
		if err != nil {
			// 列目錄期間單一項目查詢失敗 (例如列出過程中該項目被刪除, 或該項目本身
			// 無法讀取屬性) 不使整個列目錄失敗, 僅以已知資訊補一筆最小記錄.
			entries = append(entries, fsb.Entry{
				Name:   de.Name(),
				Path:   childPath,
				Kind:   fsb.KindUnknown,
				Hidden: hiddenFallback(de.Name()),
			})
			continue
		}
		entries = append(entries, entry)
	}
	return entries, nil
}

// Stat 查詢單一路徑的屬性; 路徑本身若為連結, 不解析連結本身的種類, 僅另行解析其目標種類.
func (f *FS) Stat(p string) (fsb.Entry, error) {
	return f.statInternal(cleanInternal(p))
}

// statInternal 以內部形式路徑查詢屬性, 供 Stat 與 List 共用.
func (f *FS) statInternal(internal string) (fsb.Entry, error) {
	osPath := toOS(internal)

	info, err := os.Lstat(osPath)
	if err != nil {
		return fsb.Entry{}, translate(err, internal)
	}

	entry := fsb.Entry{
		Name:    baseName(internal),
		Path:    internal,
		Kind:    kindOf(info.Mode()),
		IsLink:  info.Mode()&fs.ModeSymlink != 0,
		Size:    info.Size(),
		ModTime: info.ModTime().UTC(),
		Hidden:  isHidden(internal, info),
	}
	if entry.IsLink {
		// 連結本身的種類依介面約定記為一般檔案, 目標種類另以 Stat (追蹤連結) 解析;
		// 目標不存在時記為 KindMissing.
		entry.Kind = fsb.KindFile
		target, err := os.Stat(osPath)
		if err != nil {
			entry.Target = fsb.KindMissing
		} else {
			entry.Target = kindOf(target.Mode())
		}
	}
	return entry, nil
}

// Home 回傳目前使用者的家目錄 (內部形式).
func (f *FS) Home() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fsb.NewError(fsb.ErrIO, "cannot determine home directory: "+err.Error())
	}
	return toInternal(home), nil
}

// MakeDir 於 path 建立目錄; 不建立缺少的上層目錄.
func (f *FS) MakeDir(p string) error {
	internal := cleanInternal(p)
	if err := os.Mkdir(toOS(internal), 0o755); err != nil {
		return translate(err, internal)
	}
	return nil
}

// Rename 將 oldPath 重新命名 (或搬移) 為 newPath. 目標已存在時直接回報 already_exists,
// 不覆寫既有項目 (os.Rename 於 POSIX 會靜默覆寫, 故先行檢查).
func (f *FS) Rename(oldPath, newPath string) error {
	oldInternal := cleanInternal(oldPath)
	newInternal := cleanInternal(newPath)

	if _, err := os.Lstat(toOS(newInternal)); err == nil {
		return fsb.NewError(fsb.ErrAlreadyExists, "path already exists: "+newInternal)
	}
	if err := os.Rename(toOS(oldInternal), toOS(newInternal)); err != nil {
		return translate(err, oldInternal)
	}
	return nil
}

// Delete 刪除 path 所指的檔案或目錄; 目錄非空時連同其下所有內容一併遞迴刪除. 先以
// os.Lstat (不解參考符號連結) 確認路徑存在, 不存在時仍走既有的 translate 函式回報
// not_found, 確認存在後才呼叫 os.RemoveAll 整棵移除, 以維持既有的 not_found 語意.
func (f *FS) Delete(p string) error {
	internal := cleanInternal(p)
	osPath := toOS(internal)
	if _, err := os.Lstat(osPath); err != nil {
		return translate(err, internal)
	}
	if err := os.RemoveAll(osPath); err != nil {
		return translate(err, internal)
	}
	return nil
}

// kindOf 把 fs.FileMode 對映為介面的基本種類.
func kindOf(mode fs.FileMode) fsb.Kind {
	switch {
	case mode.IsDir():
		return fsb.KindDir
	case mode.IsRegular():
		return fsb.KindFile
	case mode&fs.ModeSocket != 0:
		return fsb.KindSocket
	case mode&fs.ModeNamedPipe != 0:
		return fsb.KindFIFO
	case mode&(fs.ModeDevice|fs.ModeCharDevice) != 0:
		return fsb.KindDevice
	case mode&fs.ModeSymlink != 0:
		return fsb.KindFile
	default:
		return fsb.KindUnknown
	}
}

// translate 把 os / syscall 的錯誤轉為介面的結構化錯誤代碼.
func translate(err error, p string) error {
	if err == nil {
		return nil
	}
	switch {
	case errors.Is(err, fs.ErrNotExist):
		return fsb.NewError(fsb.ErrNotFound, "path does not exist: "+p)
	case errors.Is(err, fs.ErrPermission):
		return fsb.NewError(fsb.ErrPermissionDenied, "permission denied: "+p)
	case errors.Is(err, syscall.ENOTEMPTY):
		// 先於 fs.ErrExist 判定: POSIX 允許 rmdir 以 ENOTEMPTY 或 EEXIST 表示目錄非空,
		// 而 EEXIST 會滿足 fs.ErrExist.
		return fsb.NewError(fsb.ErrNotEmpty, "directory not empty: "+p)
	case errors.Is(err, fs.ErrExist):
		return fsb.NewError(fsb.ErrAlreadyExists, "path already exists: "+p)
	}
	return fsb.NewError(fsb.ErrIO, err.Error())
}

// cleanInternal 把外部傳入的路徑正規化為內部形式: 統一以 "/" 分隔, 去除多餘的 "." 與
// 結尾斜線; Windows 的磁碟機字首標準化為大寫並保留其後的 "/" (如 "C:/").
func cleanInternal(p string) string {
	p = strings.ReplaceAll(p, `\`, "/")
	if p == "" {
		p = "/"
	}
	if drive, rest, ok := splitDrive(p); ok {
		if rest == "" {
			rest = "/"
		}
		cleaned := path.Clean(rest)
		if cleaned == "/" {
			return drive + "/"
		}
		return drive + cleaned
	}
	if !strings.HasPrefix(p, "/") {
		p = "/" + p
	}
	return path.Clean(p)
}

// splitDrive 把 "C:/foo" 形式的路徑拆為磁碟機字首 ("C:") 與其後的路徑 ("/foo");
// 不具磁碟機字首時第三個回傳值為 false.
func splitDrive(p string) (drive, rest string, ok bool) {
	if len(p) >= 2 && p[1] == ':' && isDriveLetter(p[0]) {
		return strings.ToUpper(p[:1]) + ":", p[2:], true
	}
	return "", p, false
}

// isDriveLetter 判定一個位元組是否為磁碟機字母.
func isDriveLetter(c byte) bool {
	return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
}

// joinInternal 把子項目名稱接在內部形式的目錄路徑之後.
func joinInternal(dir, name string) string {
	if strings.HasSuffix(dir, "/") {
		return dir + name
	}
	return dir + "/" + name
}

// baseName 取內部形式路徑的最後一段; 路徑為根 (POSIX 的 "/" 或 Windows 的 "C:/") 時
// 回傳該根本身.
func baseName(p string) string {
	if p == "/" {
		return "/"
	}
	if drive, rest, ok := splitDrive(p); ok && (rest == "" || rest == "/") {
		return drive + "/"
	}
	return path.Base(p)
}

// hiddenFallback 為無法取得完整屬性時的隱藏判定後援: 一律以名稱 "." 開頭認定.
func hiddenFallback(name string) bool {
	return strings.HasPrefix(name, ".") && name != "." && name != ".."
}

// 確保 FS 滿足檔案操作介面.
var _ fsb.FileSystem = (*FS)(nil)
