package memfs

import (
	"errors"
	"testing"
	"time"

	"github.com/nexgus/fsbrowser/fsb"
)

// newTestFS 建構一棵涵蓋各種測試素材的目錄樹:
// /home/user/readme.txt        一般檔案
// /home/user/.hidden.txt       隱藏檔案
// /home/user/docs/             子目錄
// /home/user/docs/notes.txt    子目錄下的檔案
// /home/user/.secret/          隱藏目錄
// /home/user/link-to-docs      指向目錄的連結
// /home/user/link-to-readme    指向檔案的連結
// /home/user/broken-link       失效連結
// /home/user/link-loop         自我循環的連結
// /home/user/a.sock            socket 特殊檔案
// /home/user/a.fifo            named pipe 特殊檔案
// /home/user/a.dev             裝置檔特殊檔案
// /empty/                      空目錄
func newTestFS() *FS {
	mt := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	return New(Dir{
		"home": Dir{
			"user": Dir{
				"readme.txt":     File{Size: 128, ModTime: mt},
				".hidden.txt":    File{Size: 4, ModTime: mt},
				"docs":           Dir{"notes.txt": File{Size: 16, ModTime: mt}},
				".secret":        Dir{},
				"link-to-docs":   Symlink{Target: "/home/user/docs"},
				"link-to-readme": Symlink{Target: "/home/user/readme.txt"},
				"broken-link":    Symlink{Target: "/home/user/nowhere"},
				"link-loop":      Symlink{Target: "/home/user/link-loop"},
				"a.sock":         Special{Kind: fsb.KindSocket},
				"a.fifo":         Special{Kind: fsb.KindFIFO},
				"a.dev":          Special{Kind: fsb.KindDevice},
			},
		},
		"empty": Dir{},
	}, WithHome("/home/user"), WithRoots([]string{"/"}))
}

func entryByName(entries []fsb.Entry, name string) (fsb.Entry, bool) {
	for _, e := range entries {
		if e.Name == name {
			return e, true
		}
	}
	return fsb.Entry{}, false
}

func codeOf(err error) fsb.ErrorCode {
	var fe *fsb.Error
	if errors.As(err, &fe) {
		return fe.Code
	}
	return ""
}

func TestList_Success(t *testing.T) {
	f := newTestFS()
	entries, err := f.List("/home/user")
	if err != nil {
		t.Fatalf("List 失敗: %v", err)
	}
	if len(entries) != 11 {
		t.Fatalf("預期 11 個項目, 實得 %d", len(entries))
	}

	readme, ok := entryByName(entries, "readme.txt")
	if !ok {
		t.Fatal("找不到 readme.txt")
	}
	if readme.Kind != fsb.KindFile || readme.IsLink || readme.Hidden || readme.Size != 128 {
		t.Errorf("readme.txt 屬性不符: %+v", readme)
	}
	if readme.Path != "/home/user/readme.txt" {
		t.Errorf("readme.txt 路徑不符: %s", readme.Path)
	}

	hidden, ok := entryByName(entries, ".hidden.txt")
	if !ok || !hidden.Hidden {
		t.Errorf(".hidden.txt 應標示為隱藏: %+v", hidden)
	}

	docs, ok := entryByName(entries, "docs")
	if !ok || docs.Kind != fsb.KindDir {
		t.Errorf("docs 應為目錄: %+v", docs)
	}

	linkDir, ok := entryByName(entries, "link-to-docs")
	if !ok || !linkDir.IsLink || linkDir.Target != fsb.KindDir {
		t.Errorf("link-to-docs 應為連結且目標為目錄: %+v", linkDir)
	}

	linkFile, ok := entryByName(entries, "link-to-readme")
	if !ok || !linkFile.IsLink || linkFile.Target != fsb.KindFile {
		t.Errorf("link-to-readme 應為連結且目標為檔案: %+v", linkFile)
	}

	broken, ok := entryByName(entries, "broken-link")
	if !ok || !broken.IsLink || broken.Target != fsb.KindMissing {
		t.Errorf("broken-link 應為失效連結: %+v", broken)
	}

	loop, ok := entryByName(entries, "link-loop")
	if !ok || !loop.IsLink || loop.Target != fsb.KindMissing {
		t.Errorf("link-loop 應被偵測為失效 (循環): %+v", loop)
	}

	sock, ok := entryByName(entries, "a.sock")
	if !ok || sock.Kind != fsb.KindSocket {
		t.Errorf("a.sock 種類不符: %+v", sock)
	}
	fifo, ok := entryByName(entries, "a.fifo")
	if !ok || fifo.Kind != fsb.KindFIFO {
		t.Errorf("a.fifo 種類不符: %+v", fifo)
	}
	dev, ok := entryByName(entries, "a.dev")
	if !ok || dev.Kind != fsb.KindDevice {
		t.Errorf("a.dev 種類不符: %+v", dev)
	}
}

func TestList_FollowSymlinkToDir(t *testing.T) {
	f := newTestFS()
	entries, err := f.List("/home/user/link-to-docs")
	if err != nil {
		t.Fatalf("List 經連結失敗: %v", err)
	}
	if _, ok := entryByName(entries, "notes.txt"); !ok {
		t.Errorf("經由連結列出的內容應含 notes.txt, 實得 %+v", entries)
	}
}

func TestList_NotFound(t *testing.T) {
	f := newTestFS()
	_, err := f.List("/nope")
	if codeOf(err) != fsb.ErrNotFound {
		t.Fatalf("預期 not_found, 實得 %v", err)
	}
}

func TestList_NotADirectory(t *testing.T) {
	f := newTestFS()
	_, err := f.List("/home/user/readme.txt")
	if codeOf(err) != fsb.ErrIO {
		t.Fatalf("預期 io_error, 實得 %v", err)
	}
}

func TestList_BrokenLink(t *testing.T) {
	f := newTestFS()
	_, err := f.List("/home/user/broken-link")
	if codeOf(err) != fsb.ErrNotFound {
		t.Fatalf("列出失效連結預期 not_found, 實得 %v", err)
	}
}

func TestStat_Success(t *testing.T) {
	f := newTestFS()
	e, err := f.Stat("/home/user/readme.txt")
	if err != nil {
		t.Fatalf("Stat 失敗: %v", err)
	}
	if e.Name != "readme.txt" || e.Size != 128 {
		t.Errorf("Stat 結果不符: %+v", e)
	}
	if e.ModTime.Location() != time.UTC {
		t.Errorf("ModTime 應為 UTC: %v", e.ModTime)
	}
}

func TestStat_NotFound(t *testing.T) {
	f := newTestFS()
	_, err := f.Stat("/nope")
	if codeOf(err) != fsb.ErrNotFound {
		t.Fatalf("預期 not_found, 實得 %v", err)
	}
}

func TestStat_Root(t *testing.T) {
	f := newTestFS()
	e, err := f.Stat("/")
	if err != nil {
		t.Fatalf("Stat 根目錄失敗: %v", err)
	}
	if e.Kind != fsb.KindDir {
		t.Errorf("根目錄應為目錄: %+v", e)
	}
}

func TestHomeRootsPathStyle(t *testing.T) {
	f := newTestFS()
	home, err := f.Home()
	if err != nil || home != "/home/user" {
		t.Errorf("Home 不符: %v, %v", home, err)
	}
	roots, err := f.Roots()
	if err != nil || len(roots) != 1 || roots[0] != "/" {
		t.Errorf("Roots 不符: %v, %v", roots, err)
	}
	if f.PathStyle() != fsb.PathStylePOSIX {
		t.Errorf("PathStyle 不符: %v", f.PathStyle())
	}
}

func TestMakeDir_Success(t *testing.T) {
	f := newTestFS()
	if err := f.MakeDir("/home/user/newdir"); err != nil {
		t.Fatalf("MakeDir 失敗: %v", err)
	}
	e, err := f.Stat("/home/user/newdir")
	if err != nil || e.Kind != fsb.KindDir {
		t.Errorf("新目錄應存在且為目錄: %+v, %v", e, err)
	}
}

func TestMakeDir_AlreadyExists(t *testing.T) {
	f := newTestFS()
	err := f.MakeDir("/home/user/docs")
	if codeOf(err) != fsb.ErrAlreadyExists {
		t.Fatalf("預期 already_exists, 實得 %v", err)
	}
}

func TestMakeDir_ParentNotFound(t *testing.T) {
	f := newTestFS()
	err := f.MakeDir("/nope/newdir")
	if codeOf(err) != fsb.ErrNotFound {
		t.Fatalf("預期 not_found, 實得 %v", err)
	}
}

func TestRename_Success(t *testing.T) {
	f := newTestFS()
	if err := f.Rename("/home/user/readme.txt", "/home/user/readme2.txt"); err != nil {
		t.Fatalf("Rename 失敗: %v", err)
	}
	if _, err := f.Stat("/home/user/readme.txt"); codeOf(err) != fsb.ErrNotFound {
		t.Errorf("舊路徑應已不存在")
	}
	e, err := f.Stat("/home/user/readme2.txt")
	if err != nil || e.Size != 128 {
		t.Errorf("新路徑屬性不符: %+v, %v", e, err)
	}
}

func TestRename_SourceNotFound(t *testing.T) {
	f := newTestFS()
	err := f.Rename("/nope", "/home/user/x")
	if codeOf(err) != fsb.ErrNotFound {
		t.Fatalf("預期 not_found, 實得 %v", err)
	}
}

func TestRename_TargetAlreadyExists(t *testing.T) {
	f := newTestFS()
	err := f.Rename("/home/user/readme.txt", "/home/user/docs")
	if codeOf(err) != fsb.ErrAlreadyExists {
		t.Fatalf("預期 already_exists, 實得 %v", err)
	}
}

func TestDelete_File(t *testing.T) {
	f := newTestFS()
	if err := f.Delete("/home/user/readme.txt"); err != nil {
		t.Fatalf("Delete 失敗: %v", err)
	}
	if _, err := f.Stat("/home/user/readme.txt"); codeOf(err) != fsb.ErrNotFound {
		t.Errorf("刪除後應不存在")
	}
}

func TestDelete_EmptyDir(t *testing.T) {
	f := newTestFS()
	if err := f.Delete("/empty"); err != nil {
		t.Fatalf("刪除空目錄失敗: %v", err)
	}
}

func TestDelete_NotEmptyDir(t *testing.T) {
	f := newTestFS()
	err := f.Delete("/home/user")
	if codeOf(err) != fsb.ErrNotEmpty {
		t.Fatalf("預期 not_empty, 實得 %v", err)
	}
}

func TestDelete_NotFound(t *testing.T) {
	f := newTestFS()
	err := f.Delete("/nope")
	if codeOf(err) != fsb.ErrNotFound {
		t.Fatalf("預期 not_found, 實得 %v", err)
	}
}

func TestDelete_BrokenLink(t *testing.T) {
	f := newTestFS()
	if err := f.Delete("/home/user/broken-link"); err != nil {
		t.Fatalf("失效連結應可刪除: %v", err)
	}
}

func TestDelete_SpecialFile(t *testing.T) {
	f := newTestFS()
	if err := f.Delete("/home/user/a.sock"); err != nil {
		t.Fatalf("特殊檔案應可刪除: %v", err)
	}
}

func TestConcurrentAccess(t *testing.T) {
	f := newTestFS()
	done := make(chan struct{})
	for i := 0; i < 20; i++ {
		go func(i int) {
			defer func() { done <- struct{}{} }()
			_, _ = f.List("/home/user")
			_ = f.MakeDir("/home/user/concurrent")
		}(i)
	}
	for i := 0; i < 20; i++ {
		<-done
	}
}
