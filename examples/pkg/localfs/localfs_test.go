package localfs

import (
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/nexgus/fsbrowser/fsb"
)

// setupTree 於 t.TempDir 下建立一棵真實的測試檔案樹, 回傳其內部形式的根路徑.
// POSIX 系統另建立一個有效連結與一個失效連結; Windows 因建立連結需額外權限而略過.
func setupTree(t *testing.T) string {
	t.Helper()

	root := t.TempDir()
	mustWrite(t, filepath.Join(root, "readme.txt"), "hello")
	mustWrite(t, filepath.Join(root, ".hidden.txt"), "x")
	if err := os.Mkdir(filepath.Join(root, "docs"), 0o755); err != nil {
		t.Fatalf("建立 docs 失敗: %v", err)
	}
	mustWrite(t, filepath.Join(root, "docs", "notes.txt"), "note")

	if runtime.GOOS != "windows" {
		if err := os.Symlink(filepath.Join(root, "docs"), filepath.Join(root, "link-to-docs")); err != nil {
			t.Fatalf("建立連結失敗: %v", err)
		}
		if err := os.Symlink(filepath.Join(root, "nowhere"), filepath.Join(root, "broken-link")); err != nil {
			t.Fatalf("建立失效連結失敗: %v", err)
		}
	}
	return toInternal(root)
}

// mustWrite 寫入一個測試用檔案.
func mustWrite(t *testing.T, p, content string) {
	t.Helper()
	if err := os.WriteFile(p, []byte(content), 0o644); err != nil {
		t.Fatalf("寫入 %s 失敗: %v", p, err)
	}
}

// codeOf 取出錯誤的結構化代碼; 錯誤非 *fsb.Error 時使測試失敗.
func codeOf(t *testing.T, err error) fsb.ErrorCode {
	t.Helper()
	if err == nil {
		t.Fatal("預期取得錯誤, 實際為 nil")
	}
	var fe *fsb.Error
	if !errors.As(err, &fe) {
		t.Fatalf("預期取得 *fsb.Error, 實際為 %T: %v", err, err)
	}
	return fe.Code
}

func TestListEntries(t *testing.T) {
	f := New()
	root := setupTree(t)

	entries, err := f.List(root)
	if err != nil {
		t.Fatalf("List 失敗: %v", err)
	}

	byName := map[string]fsb.Entry{}
	for _, e := range entries {
		byName[e.Name] = e
	}

	readme, ok := byName["readme.txt"]
	if !ok {
		t.Fatal("List 結果缺少 readme.txt")
	}
	if readme.Kind != fsb.KindFile {
		t.Errorf("readme.txt 的 Kind = %q, 預期 file", readme.Kind)
	}
	if readme.Size != 5 {
		t.Errorf("readme.txt 的 Size = %d, 預期 5", readme.Size)
	}
	if readme.Path != root+"/readme.txt" {
		t.Errorf("readme.txt 的 Path = %q, 預期 %q", readme.Path, root+"/readme.txt")
	}
	if readme.ModTime.Location() != nil && readme.ModTime.Location().String() != "UTC" {
		t.Errorf("readme.txt 的 ModTime 非 UTC: %v", readme.ModTime)
	}

	docs, ok := byName["docs"]
	if !ok {
		t.Fatal("List 結果缺少 docs")
	}
	if docs.Kind != fsb.KindDir {
		t.Errorf("docs 的 Kind = %q, 預期 dir", docs.Kind)
	}

	if runtime.GOOS != "windows" {
		hidden, ok := byName[".hidden.txt"]
		if !ok {
			t.Fatal("List 結果缺少 .hidden.txt")
		}
		if !hidden.Hidden {
			t.Error(".hidden.txt 的 Hidden = false, 預期 true")
		}

		link, ok := byName["link-to-docs"]
		if !ok {
			t.Fatal("List 結果缺少 link-to-docs")
		}
		if !link.IsLink || link.Target != fsb.KindDir {
			t.Errorf("link-to-docs 的 IsLink = %v, Target = %q, 預期 true / dir", link.IsLink, link.Target)
		}

		broken, ok := byName["broken-link"]
		if !ok {
			t.Fatal("List 結果缺少 broken-link")
		}
		if !broken.IsLink || broken.Target != fsb.KindMissing {
			t.Errorf("broken-link 的 IsLink = %v, Target = %q, 預期 true / missing", broken.IsLink, broken.Target)
		}
	}
}

func TestListNotFound(t *testing.T) {
	f := New()
	root := setupTree(t)

	_, err := f.List(root + "/nowhere")
	if code := codeOf(t, err); code != fsb.ErrNotFound {
		t.Errorf("List 不存在目錄的錯誤代碼 = %q, 預期 not_found", code)
	}
}

func TestStat(t *testing.T) {
	f := New()
	root := setupTree(t)

	entry, err := f.Stat(root + "/docs")
	if err != nil {
		t.Fatalf("Stat 失敗: %v", err)
	}
	if entry.Name != "docs" || entry.Kind != fsb.KindDir {
		t.Errorf("Stat 結果 = %+v, 預期名稱 docs 且種類 dir", entry)
	}
	if entry.Path != root+"/docs" {
		t.Errorf("Stat 的 Path = %q, 預期 %q", entry.Path, root+"/docs")
	}

	_, err = f.Stat(root + "/nowhere")
	if code := codeOf(t, err); code != fsb.ErrNotFound {
		t.Errorf("Stat 不存在路徑的錯誤代碼 = %q, 預期 not_found", code)
	}
}

func TestStatBrokenLink(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Windows 建立符號連結需額外權限, 略過")
	}
	f := New()
	root := setupTree(t)

	entry, err := f.Stat(root + "/broken-link")
	if err != nil {
		t.Fatalf("Stat 失效連結失敗: %v", err)
	}
	if !entry.IsLink {
		t.Error("失效連結的 IsLink = false, 預期 true")
	}
	if entry.Kind != fsb.KindFile {
		t.Errorf("失效連結的 Kind = %q, 預期 file", entry.Kind)
	}
	if entry.Target != fsb.KindMissing {
		t.Errorf("失效連結的 Target = %q, 預期 missing", entry.Target)
	}
}

func TestMakeDir(t *testing.T) {
	f := New()
	root := setupTree(t)

	if err := f.MakeDir(root + "/newdir"); err != nil {
		t.Fatalf("MakeDir 失敗: %v", err)
	}
	entry, err := f.Stat(root + "/newdir")
	if err != nil || entry.Kind != fsb.KindDir {
		t.Fatalf("MakeDir 後 Stat 結果 = %+v, err = %v", entry, err)
	}

	if code := codeOf(t, f.MakeDir(root+"/newdir")); code != fsb.ErrAlreadyExists {
		t.Errorf("重複 MakeDir 的錯誤代碼 = %q, 預期 already_exists", code)
	}
	if code := codeOf(t, f.MakeDir(root+"/nowhere/deep")); code != fsb.ErrNotFound {
		t.Errorf("上層目錄不存在時 MakeDir 的錯誤代碼 = %q, 預期 not_found", code)
	}
}

func TestRename(t *testing.T) {
	f := New()
	root := setupTree(t)

	if err := f.Rename(root+"/readme.txt", root+"/renamed.txt"); err != nil {
		t.Fatalf("Rename 失敗: %v", err)
	}
	if _, err := f.Stat(root + "/renamed.txt"); err != nil {
		t.Fatalf("Rename 後 Stat 新名稱失敗: %v", err)
	}
	if code := codeOf(t, mustErr(f.Stat(root+"/readme.txt"))); code != fsb.ErrNotFound {
		t.Errorf("Rename 後舊名稱的錯誤代碼 = %q, 預期 not_found", code)
	}

	if code := codeOf(t, f.Rename(root+"/renamed.txt", root+"/docs")); code != fsb.ErrAlreadyExists {
		t.Errorf("目標已存在時 Rename 的錯誤代碼 = %q, 預期 already_exists", code)
	}
	if code := codeOf(t, f.Rename(root+"/nowhere", root+"/whatever")); code != fsb.ErrNotFound {
		t.Errorf("來源不存在時 Rename 的錯誤代碼 = %q, 預期 not_found", code)
	}
}

func TestDelete(t *testing.T) {
	f := New()
	root := setupTree(t)

	if err := f.Delete(root + "/readme.txt"); err != nil {
		t.Fatalf("Delete 檔案失敗: %v", err)
	}
	if code := codeOf(t, mustErr(f.Stat(root+"/readme.txt"))); code != fsb.ErrNotFound {
		t.Errorf("Delete 後的錯誤代碼 = %q, 預期 not_found", code)
	}

	// docs 內尚有 notes.txt, 不遞迴刪除應回報 not_empty.
	if code := codeOf(t, f.Delete(root+"/docs")); code != fsb.ErrNotEmpty {
		t.Errorf("刪除非空目錄的錯誤代碼 = %q, 預期 not_empty", code)
	}
	if err := f.Delete(root + "/docs/notes.txt"); err != nil {
		t.Fatalf("Delete 目錄內檔案失敗: %v", err)
	}
	if err := f.Delete(root + "/docs"); err != nil {
		t.Fatalf("Delete 已清空目錄失敗: %v", err)
	}

	if code := codeOf(t, f.Delete(root+"/nowhere")); code != fsb.ErrNotFound {
		t.Errorf("刪除不存在路徑的錯誤代碼 = %q, 預期 not_found", code)
	}
}

func TestPermissionDenied(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Windows 不以 POSIX 權限位元控制存取, 略過")
	}
	if os.Geteuid() == 0 {
		t.Skip("以 root 執行時權限檢查不生效, 略過")
	}

	f := New()
	root := setupTree(t)
	locked := root + "/locked"
	if err := f.MakeDir(locked); err != nil {
		t.Fatalf("MakeDir 失敗: %v", err)
	}
	if err := os.Chmod(toOS(locked), 0o000); err != nil {
		t.Fatalf("Chmod 失敗: %v", err)
	}
	t.Cleanup(func() { _ = os.Chmod(toOS(locked), 0o755) })

	if code := codeOf(t, mustErr2(f.List(locked))); code != fsb.ErrPermissionDenied {
		t.Errorf("無權限目錄 List 的錯誤代碼 = %q, 預期 permission_denied", code)
	}
}

func TestHomeAndRoots(t *testing.T) {
	f := New()

	home, err := f.Home()
	if err != nil {
		t.Fatalf("Home 失敗: %v", err)
	}
	if !strings.HasPrefix(home, "/") && !strings.Contains(home, ":/") {
		t.Errorf("Home 回傳 %q, 不是內部形式的絕對路徑", home)
	}

	roots, err := f.Roots()
	if err != nil {
		t.Fatalf("Roots 失敗: %v", err)
	}
	if len(roots) == 0 {
		t.Fatal("Roots 回傳空清單")
	}
	if runtime.GOOS == "windows" {
		if f.PathStyle() != fsb.PathStyleWindows {
			t.Errorf("PathStyle = %q, 預期 windows", f.PathStyle())
		}
		for _, r := range roots {
			if !strings.HasSuffix(r, ":/") {
				t.Errorf("Windows 的根 %q 不是 \"C:/\" 形式", r)
			}
		}
	} else {
		if f.PathStyle() != fsb.PathStylePOSIX {
			t.Errorf("PathStyle = %q, 預期 posix", f.PathStyle())
		}
		if len(roots) != 1 || roots[0] != "/" {
			t.Errorf("POSIX 的 Roots = %v, 預期 [/]", roots)
		}
	}
}

func TestCleanInternal(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"", "/"},
		{"/", "/"},
		{"/a/b/", "/a/b"},
		{"/a/./b//c", "/a/b/c"},
		{`c:\Users\me`, "C:/Users/me"},
		{"C:/", "C:/"},
		{"C:", "C:/"},
		{"D:/a/b/", "D:/a/b"},
		{"relative/path", "/relative/path"},
	}
	for _, c := range cases {
		if got := cleanInternal(c.in); got != c.want {
			t.Errorf("cleanInternal(%q) = %q, 預期 %q", c.in, got, c.want)
		}
	}
}

// mustErr 取出 (Entry, error) 回傳值中的錯誤, 供測試以單一運算式傳給 codeOf.
func mustErr(_ fsb.Entry, err error) error { return err }

// mustErr2 取出 ([]Entry, error) 回傳值中的錯誤, 供測試以單一運算式傳給 codeOf.
func mustErr2(_ []fsb.Entry, err error) error { return err }
