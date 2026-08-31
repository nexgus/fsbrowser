package sshfs

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/nexgus/fsbrowser/fsb"
)

// fakeResult 為 fakeRunner 對單一指令準備好的回應.
type fakeResult struct {
	stdout string
	stderr string
	exit   int
	err    error
}

// fakeRunner 是 Runner 的測試替身: 依序回傳事先準備的回應, 並記錄實際下發的指令, 使
// 輸出解析與錯誤對映可在沒有真實 SSH 連線的情況下驗證.
type fakeRunner struct {
	results []fakeResult
	cmds    []string
}

// Run 回傳下一筆事先準備的回應; 回應用盡時回傳結束碼 0 的空輸出.
func (r *fakeRunner) Run(cmd string) ([]byte, []byte, int, error) {
	r.cmds = append(r.cmds, cmd)
	if len(r.results) == 0 {
		return nil, nil, 0, nil
	}
	res := r.results[0]
	r.results = r.results[1:]
	return []byte(res.stdout), []byte(res.stderr), res.exit, res.err
}

// newFS 以事先準備的回應建立待測的遠端檔案系統.
func newFS(results ...fakeResult) (*FS, *fakeRunner) {
	r := &fakeRunner{results: results}
	return NewFS(r, "user@host", "/home/user"), r
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

// record 組出一筆 find -printf 輸出 (五欄以 tab 分隔, 以 NUL 結尾).
func record(fields ...string) string {
	return strings.Join(fields, "\t") + "\x00"
}

func TestQuote(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"plain", "'plain'"},
		{"with space", "'with space'"},
		{"it's", `'it'\''s'`},
		{"", "''"},
	}
	for _, c := range cases {
		if got := Quote(c.in); got != c.want {
			t.Errorf("Quote(%q) = %q, 預期 %q", c.in, got, c.want)
		}
	}
}

func TestListParsesRecords(t *testing.T) {
	out := record("f", "f", "1280", "1767322845.0000000000", "readme.txt") +
		record("d", "d", "4096", "1767322845", "docs") +
		record("f", "f", "4", "1767322845", ".hidden.txt") +
		record("l", "d", "12", "1767322845", "link-to-docs") +
		record("l", "N", "12", "1767322845", "broken-link") +
		record("s", "s", "0", "1767322845", "a.sock") +
		record("p", "p", "0", "1767322845", "a.pipe") +
		record("c", "c", "0", "1767322845", "a.device")

	f, runner := newFS(fakeResult{stdout: out})
	entries, err := f.List("/home/user")
	if err != nil {
		t.Fatalf("List 失敗: %v", err)
	}
	if len(entries) != 8 {
		t.Fatalf("List 回傳 %d 筆, 預期 8 筆", len(entries))
	}
	if !strings.Contains(runner.cmds[0], "cd -- '/home/user'") {
		t.Errorf("List 下發的指令未先 cd 進目標目錄: %s", runner.cmds[0])
	}

	byName := map[string]fsb.Entry{}
	for _, e := range entries {
		byName[e.Name] = e
	}

	readme := byName["readme.txt"]
	if readme.Kind != fsb.KindFile || readme.Size != 1280 {
		t.Errorf("readme.txt = %+v, 預期 file / 1280", readme)
	}
	if readme.Path != "/home/user/readme.txt" {
		t.Errorf("readme.txt 的 Path = %q, 預期 /home/user/readme.txt", readme.Path)
	}
	want := time.Unix(1767322845, 0).UTC()
	if !readme.ModTime.Equal(want) {
		t.Errorf("readme.txt 的 ModTime = %v, 預期 %v", readme.ModTime, want)
	}
	if readme.ModTime.Location() != time.UTC {
		t.Errorf("readme.txt 的 ModTime 非 UTC: %v", readme.ModTime.Location())
	}

	if byName["docs"].Kind != fsb.KindDir {
		t.Errorf("docs 的 Kind = %q, 預期 dir", byName["docs"].Kind)
	}
	if !byName[".hidden.txt"].Hidden {
		t.Error(".hidden.txt 的 Hidden = false, 預期 true")
	}
	if byName["readme.txt"].Hidden {
		t.Error("readme.txt 的 Hidden = true, 預期 false")
	}

	link := byName["link-to-docs"]
	if !link.IsLink || link.Kind != fsb.KindFile || link.Target != fsb.KindDir {
		t.Errorf("link-to-docs = %+v, 預期 IsLink / file / 目標 dir", link)
	}
	broken := byName["broken-link"]
	if !broken.IsLink || broken.Target != fsb.KindMissing {
		t.Errorf("broken-link = %+v, 預期 IsLink 且目標 missing", broken)
	}

	if byName["a.sock"].Kind != fsb.KindSocket {
		t.Errorf("a.sock 的 Kind = %q, 預期 socket", byName["a.sock"].Kind)
	}
	if byName["a.pipe"].Kind != fsb.KindFIFO {
		t.Errorf("a.pipe 的 Kind = %q, 預期 fifo", byName["a.pipe"].Kind)
	}
	if byName["a.device"].Kind != fsb.KindDevice {
		t.Errorf("a.device 的 Kind = %q, 預期 device", byName["a.device"].Kind)
	}
}

func TestListSkipsMalformedRecords(t *testing.T) {
	out := record("f", "f", "10", "1767322845", "good.txt") +
		"f\tf\t10\x00" + // 欄位不足, 應略過
		"\x00" // 空白筆, 應略過

	f, _ := newFS(fakeResult{stdout: out})
	entries, err := f.List("/tmp")
	if err != nil {
		t.Fatalf("List 失敗: %v", err)
	}
	if len(entries) != 1 || entries[0].Name != "good.txt" {
		t.Errorf("List 回傳 %+v, 預期只留下 good.txt", entries)
	}
}

func TestListNameWithTab(t *testing.T) {
	// 名稱為最後一欄, 其中含 tab 亦不應影響前四欄的切分.
	out := record("f", "f", "10", "1767322845", "odd\tname.txt")

	f, _ := newFS(fakeResult{stdout: out})
	entries, err := f.List("/tmp")
	if err != nil {
		t.Fatalf("List 失敗: %v", err)
	}
	if len(entries) != 1 || entries[0].Name != "odd\tname.txt" {
		t.Errorf("List 回傳 %+v, 預期名稱保留 tab", entries)
	}
}

func TestStat(t *testing.T) {
	out := record("d", "d", "4096", "1767322845", "docs")

	f, runner := newFS(fakeResult{stdout: out})
	entry, err := f.Stat("/home/user/docs/")
	if err != nil {
		t.Fatalf("Stat 失敗: %v", err)
	}
	if entry.Name != "docs" || entry.Path != "/home/user/docs" || entry.Kind != fsb.KindDir {
		t.Errorf("Stat 結果 = %+v, 預期 docs / /home/user/docs / dir", entry)
	}
	if !strings.Contains(runner.cmds[0], "'/home/user/docs'") {
		t.Errorf("Stat 下發的指令未帶正規化後的路徑: %s", runner.cmds[0])
	}
}

func TestStatEmptyOutput(t *testing.T) {
	f, _ := newFS(fakeResult{})
	_, err := f.Stat("/home/user/docs")
	if code := codeOf(t, err); code != fsb.ErrIO {
		t.Errorf("遠端無輸出時的錯誤代碼 = %q, 預期 io_error", code)
	}
}

func TestErrorMapping(t *testing.T) {
	cases := []struct {
		name   string
		stderr string
		want   fsb.ErrorCode
	}{
		{"不存在", "find: '/nope': No such file or directory\n", fsb.ErrNotFound},
		{"權限不足", "find: '/root': Permission denied\n", fsb.ErrPermissionDenied},
		{"已存在", "mkdir: cannot create directory '/tmp/a': File exists\n", fsb.ErrAlreadyExists},
		{"目錄非空", "rmdir: failed to remove '/tmp/a': Directory not empty\n", fsb.ErrNotEmpty},
		{"其他失敗", "rm: cannot remove '/tmp/a': Read-only file system\n", fsb.ErrIO},
		{"無 stderr", "", fsb.ErrIO},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			f, _ := newFS(fakeResult{stderr: c.stderr, exit: 1})
			_, err := f.List("/tmp/a")
			if code := codeOf(t, err); code != c.want {
				t.Errorf("錯誤代碼 = %q, 預期 %q", code, c.want)
			}
		})
	}
}

func TestConnErrorMapsToDisconnected(t *testing.T) {
	f, _ := newFS(fakeResult{err: ErrNoClient})
	_, err := f.List("/tmp")
	if code := codeOf(t, err); code != fsb.ErrDisconnected {
		t.Errorf("連線中斷時的錯誤代碼 = %q, 預期 disconnected", code)
	}

	f, _ = newFS(fakeResult{err: ErrTimeout})
	_, err = f.List("/tmp")
	if code := codeOf(t, err); code != fsb.ErrDisconnected {
		t.Errorf("逾時的錯誤代碼 = %q, 預期 disconnected", code)
	}
}

func TestMakeDir(t *testing.T) {
	f, runner := newFS(fakeResult{})
	if err := f.MakeDir("/tmp/newdir"); err != nil {
		t.Fatalf("MakeDir 失敗: %v", err)
	}
	if runner.cmds[0] != "mkdir -- '/tmp/newdir'" {
		t.Errorf("MakeDir 下發的指令 = %q", runner.cmds[0])
	}
	if strings.Contains(runner.cmds[0], "-p") {
		t.Error("MakeDir 不應以 -p 建立缺少的上層目錄")
	}
}

func TestRename(t *testing.T) {
	// 第一筆為目標存在性檢查 (test 的結束碼 1 表示不存在), 第二筆為 mv 本身.
	f, runner := newFS(fakeResult{exit: 1}, fakeResult{})
	if err := f.Rename("/tmp/a", "/tmp/b"); err != nil {
		t.Fatalf("Rename 失敗: %v", err)
	}
	if !strings.HasPrefix(runner.cmds[1], "mv -n -- '/tmp/a' '/tmp/b'") {
		t.Errorf("Rename 下發的指令 = %q", runner.cmds[1])
	}
}

func TestRenameTargetExists(t *testing.T) {
	// 目標存在性檢查以結束碼 0 回應, 表示目標已存在.
	f, runner := newFS(fakeResult{exit: 0})
	err := f.Rename("/tmp/a", "/tmp/b")
	if code := codeOf(t, err); code != fsb.ErrAlreadyExists {
		t.Errorf("目標已存在時的錯誤代碼 = %q, 預期 already_exists", code)
	}
	if len(runner.cmds) != 1 {
		t.Errorf("目標已存在時仍下發了 %d 道指令, 預期只有存在性檢查", len(runner.cmds))
	}
}

func TestDelete(t *testing.T) {
	f, runner := newFS(fakeResult{})
	if err := f.Delete("/tmp/a"); err != nil {
		t.Fatalf("Delete 失敗: %v", err)
	}
	cmd := runner.cmds[0]
	if cmd != "rm -r -- '/tmp/a'" {
		t.Errorf("Delete 下發的指令 = %q, 預期 rm -r -- '/tmp/a'", cmd)
	}
}

func TestDeleteNoForceFlag(t *testing.T) {
	f, runner := newFS(fakeResult{})
	if err := f.Delete("/tmp/a"); err != nil {
		t.Fatalf("Delete 失敗: %v", err)
	}
	if strings.Contains(runner.cmds[0], "-f") {
		t.Errorf("Delete 不應帶強制旗標, 下發的指令 = %q", runner.cmds[0])
	}
}

func TestDeleteNotFound(t *testing.T) {
	f, _ := newFS(fakeResult{stderr: "rm: cannot remove '/tmp/a': No such file or directory\n", exit: 1})
	if code := codeOf(t, f.Delete("/tmp/a")); code != fsb.ErrNotFound {
		t.Error("刪除不存在的路徑未回報 not_found")
	}
}

func TestHomeRootsPathStyle(t *testing.T) {
	f, _ := newFS()

	home, err := f.Home()
	if err != nil || home != "/home/user" {
		t.Errorf("Home = %q, err = %v, 預期 /home/user", home, err)
	}
	roots, err := f.Roots()
	if err != nil || len(roots) != 1 || roots[0] != "/" {
		t.Errorf("Roots = %v, err = %v, 預期 [/]", roots, err)
	}
	if f.PathStyle() != fsb.PathStylePOSIX {
		t.Errorf("PathStyle = %q, 預期 posix", f.PathStyle())
	}
}

func TestHomeUnavailable(t *testing.T) {
	f := NewFS(&fakeRunner{}, "user@host", "")
	if _, err := f.Home(); codeOf(t, err) != fsb.ErrIO {
		t.Error("未取得遠端家目錄時未回報 io_error")
	}
}

// fakeRunnerContext 在 fakeRunner 之上加上 RunnerContext 能力: RunContext 模擬指令
// 正在執行中, 阻塞至 ctx 被取消才回傳 ctx.Err(), 供測試 FS.CopyContext / MoveContext
// 對可取消執行器的處理路徑 (呼叫當下 ctx 尚未取消, 需依賴 RunnerContext 才能中止),
// 不需要真正的 SSH 連線 (真正中止執行中指令的 session 關閉機制屬 dial.go 之
// clientRunner, 需要實機環境, 不在此處測試範圍).
type fakeRunnerContext struct {
	fakeRunner
}

func (r *fakeRunnerContext) RunContext(ctx context.Context, cmd string) ([]byte, []byte, int, error) {
	<-ctx.Done()
	return nil, nil, 0, ctx.Err()
}

// newFSWithContext 同 newFS, 但底層執行器另滿足 RunnerContext.
func newFSWithContext(results ...fakeResult) (*FS, *fakeRunnerContext) {
	r := &fakeRunnerContext{fakeRunner{results: results}}
	return NewFS(r, "user@host", "/home/user"), r
}

func TestCopySingleFile(t *testing.T) {
	f, runner := newFS(fakeResult{})
	if err := f.CopyContext(context.Background(), "/tmp/a.txt", "/tmp/b.txt", false); err != nil {
		t.Fatalf("CopyContext 失敗: %v", err)
	}
	cmd := runner.cmds[0]
	if !strings.Contains(cmd, "cp -a -- '/tmp/a.txt' '/tmp/b.txt'") {
		t.Errorf("CopyContext 下發的指令 = %q", cmd)
	}
	if !strings.Contains(cmd, "File exists") {
		t.Errorf("overwrite 為偽時的指令未含既有目標的檢查: %q", cmd)
	}
}

func TestCopyDirRecursive(t *testing.T) {
	f, runner := newFS(fakeResult{})
	if err := f.CopyContext(context.Background(), "/tmp/src", "/tmp/dst", false); err != nil {
		t.Fatalf("CopyContext 失敗: %v", err)
	}
	cmd := runner.cmds[0]
	// 目錄的走訪與遞迴全交由遠端的 cp -a 進行, 本機端只下發單一指令.
	if len(runner.cmds) != 1 {
		t.Errorf("CopyContext 下發了 %d 道指令, 預期只有一道 (走訪交由遠端)", len(runner.cmds))
	}
	if !strings.Contains(cmd, "cp -a -- '/tmp/src' '/tmp/dst'") {
		t.Errorf("CopyContext 下發的指令 = %q", cmd)
	}
}

func TestCopyAlreadyExists(t *testing.T) {
	// 模擬遠端於 overwrite 為偽時偵測到目標已存在, 依既有的 classify 對映為 already_exists.
	f, _ := newFS(fakeResult{stderr: "cp: target File exists\n", exit: 1})
	err := f.CopyContext(context.Background(), "/tmp/a.txt", "/tmp/b.txt", false)
	if code := codeOf(t, err); code != fsb.ErrAlreadyExists {
		t.Errorf("錯誤代碼 = %q, 預期 already_exists", code)
	}
}

func TestCopyOverwriteMerge(t *testing.T) {
	f, runner := newFS(fakeResult{})
	if err := f.CopyContext(context.Background(), "/tmp/src", "/tmp/dst", true); err != nil {
		t.Fatalf("CopyContext 失敗: %v", err)
	}
	cmd := runner.cmds[0]
	// 合併語意 (計劃書第 5.4 節): 來源以 "/." 結尾複製其內容而非其本身, 併入既有目錄.
	if !strings.Contains(cmd, "cp -a -- '/tmp/src'/. '/tmp/dst'/") {
		t.Errorf("overwrite 為真時的合併指令 = %q", cmd)
	}
	if strings.Contains(cmd, "File exists") {
		t.Errorf("overwrite 為真時不應含既有目標的存在性檢查: %q", cmd)
	}
}

func TestMoveSourceGone(t *testing.T) {
	f, runner := newFS(fakeResult{})
	if err := f.MoveContext(context.Background(), "/tmp/a.txt", "/tmp/b.txt", false); err != nil {
		t.Fatalf("MoveContext 失敗: %v", err)
	}
	cmd := runner.cmds[0]
	// mv 本身即會使來源於成功後不再存在.
	if !strings.Contains(cmd, "mv -- '/tmp/a.txt' '/tmp/b.txt'") {
		t.Errorf("MoveContext 下發的指令 = %q", cmd)
	}
}

func TestMoveOverwriteMerge(t *testing.T) {
	f, runner := newFS(fakeResult{})
	if err := f.MoveContext(context.Background(), "/tmp/src", "/tmp/dst", true); err != nil {
		t.Fatalf("MoveContext 失敗: %v", err)
	}
	cmd := runner.cmds[0]
	// 目錄對目錄的合併語意 mv 無法表達, 改以複製內容後刪除來源達成, 使來源仍於成功後消失.
	if !strings.Contains(cmd, "cp -a -- '/tmp/src'/. '/tmp/dst'/ && rm -rf -- '/tmp/src'") {
		t.Errorf("overwrite 為真時的合併搬移指令 = %q", cmd)
	}
}

func TestCopyMoveCanceledBeforeStart(t *testing.T) {
	f, runner := newFS()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	if err := f.CopyContext(ctx, "/tmp/a.txt", "/tmp/b.txt", false); !errors.Is(err, context.Canceled) {
		t.Errorf("CopyContext 於已取消的 ctx 下回傳 %v, 預期滿足 errors.Is(_, context.Canceled)", err)
	}
	if err := f.MoveContext(ctx, "/tmp/a.txt", "/tmp/b.txt", false); !errors.Is(err, context.Canceled) {
		t.Errorf("MoveContext 於已取消的 ctx 下回傳 %v, 預期滿足 errors.Is(_, context.Canceled)", err)
	}
	if len(runner.cmds) != 0 {
		t.Errorf("已取消的 ctx 仍下發了 %d 道指令, 預期一道都不下發", len(runner.cmds))
	}
}

func TestCopyMoveCanceledViaRunnerContext(t *testing.T) {
	// 模擬指令執行中收到取消 (呼叫當下 ctx 尚未取消, 於執行途中才取消): 執行器額外
	// 滿足 RunnerContext, RunContext 阻塞至取消才回傳 ctx.Err(); 此錯誤應原樣回傳,
	// 不經過 classify 誤歸類為 disconnected (計劃書第 3.3 節: 讓橋接層以 errors.Is
	// 歸類為 canceled).
	f, _ := newFSWithContext(fakeResult{})
	ctx, cancel := context.WithCancel(context.Background())
	time.AfterFunc(10*time.Millisecond, cancel)

	err := f.CopyContext(ctx, "/tmp/a.txt", "/tmp/b.txt", false)
	if !errors.Is(err, context.Canceled) {
		t.Errorf("CopyContext 回傳 %v, 預期滿足 errors.Is(_, context.Canceled)", err)
	}
	var fe *fsb.Error
	if errors.As(err, &fe) {
		t.Errorf("取消不應被包成結構化錯誤, 實際為 %+v", fe)
	}
}

func TestCleanPath(t *testing.T) {
	cases := []struct{ in, want string }{
		{"", "/"},
		{"/", "/"},
		{"/a/b/", "/a/b"},
		{"/a/./b//c", "/a/b/c"},
		{"a/b", "/a/b"},
	}
	for _, c := range cases {
		if got := cleanPath(c.in); got != c.want {
			t.Errorf("cleanPath(%q) = %q, 預期 %q", c.in, got, c.want)
		}
	}
}
