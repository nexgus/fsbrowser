//go:build windows

package localfs

import (
	"io/fs"
	"os"
	"strings"
	"syscall"

	"github.com/nexgus/fsbrowser/fsb"
)

// Roots 逐字母探測 A: 至 Z:, 回傳實際存在的磁碟機 (內部形式, 如 "C:/").
// 以探測而非呼叫 GetLogicalDrives 實作, 使本套件只依賴標準庫, 亦不需 cgo.
func (f *FS) Roots() ([]string, error) {
	roots := make([]string, 0, 26)
	for c := byte('A'); c <= 'Z'; c++ {
		if _, err := os.Stat(string(c) + `:\`); err != nil {
			continue
		}
		roots = append(roots, string(c)+":/")
	}
	if len(roots) == 0 {
		return nil, fsb.NewError(fsb.ErrIO, "no usable drive found")
	}
	return roots, nil
}

// PathStyle 於 Windows 固定回傳 "windows".
func (f *FS) PathStyle() string {
	return fsb.PathStyleWindows
}

// toOS 把內部形式路徑轉為 Windows 原生路徑: 分隔符換為反斜線. 內部形式的 "C:/foo"
// 因此成為 `C:\foo`; 不具磁碟機字首的路徑 (如 "/foo") 則成為 `\foo`, 由系統解讀為
// 目前磁碟機上的路徑.
func toOS(internal string) string {
	if drive, rest, ok := splitDrive(internal); ok {
		if rest == "" || rest == "/" {
			// 磁碟機根必須寫成 `C:\`; 寫成 `C:` 會被解讀為該磁碟機的目前目錄.
			return drive + `\`
		}
		return drive + strings.ReplaceAll(rest, "/", `\`)
	}
	return strings.ReplaceAll(internal, "/", `\`)
}

// toInternal 把 Windows 原生路徑轉為內部形式 (分隔符換為 "/", 磁碟機字母轉大寫).
func toInternal(osPath string) string {
	return cleanInternal(osPath)
}

// isHidden 依 Windows 慣例判定隱藏項目: 檔案屬性含 FILE_ATTRIBUTE_HIDDEN.
// 取不到原生屬性時退回以名稱 "." 開頭判定.
func isHidden(internal string, info fs.FileInfo) bool {
	if data, ok := info.Sys().(*syscall.Win32FileAttributeData); ok {
		return data.FileAttributes&syscall.FILE_ATTRIBUTE_HIDDEN != 0
	}
	return hiddenFallback(baseName(internal))
}
