//go:build !windows

package localfs

import (
	"io/fs"
	"strings"

	"github.com/nexgus/fsbrowser/fsb"
)

// Roots 回傳 POSIX 系統唯一的根 ("/").
func (f *FS) Roots() ([]string, error) {
	return []string{"/"}, nil
}

// PathStyle 於 POSIX 系統固定回傳 "posix".
func (f *FS) PathStyle() string {
	return fsb.PathStylePOSIX
}

// toOS 把內部形式路徑轉為作業系統原生路徑; POSIX 兩者同形, 原樣回傳.
func toOS(internal string) string {
	return internal
}

// toInternal 把作業系統原生路徑轉為內部形式; POSIX 兩者同形, 僅作正規化.
func toInternal(osPath string) string {
	return cleanInternal(osPath)
}

// isHidden 依 POSIX 慣例判定隱藏項目: 名稱以 "." 開頭.
func isHidden(internal string, _ fs.FileInfo) bool {
	name := baseName(internal)
	return strings.HasPrefix(name, ".") && name != "." && name != ".."
}
