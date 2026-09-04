package sshfs

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/ssh"
)

const (
	// dialTimeout 為建立 SSH 連線的逾時上限.
	dialTimeout = 10 * time.Second
	// opTimeout 為單一遠端操作的逾時上限; 超過即視為遠端無回應.
	opTimeout = 15 * time.Second
	// defaultPort 為 port 參數為 0 時使用的預設 SSH 連接埠.
	defaultPort = 22
)

// ErrTimeout 為遠端操作逾時的哨兵錯誤, 供錯誤對映層以 errors.Is 判定.
var ErrTimeout = errors.New("remote operation timed out")

// ErrNoClient 表示目前沒有可用的連線 (尚未連線或已關閉).
var ErrNoClient = errors.New("SSH connection does not exist")

// defaultKeyNames 為 keyFile 留空時依序嘗試的私鑰檔名稱, 順序與行為比照 OpenSSH 用戶端
// 的預設鍵慣例.
var defaultKeyNames = []string{"id_ed25519", "id_ecdsa", "id_rsa"}

// selfCheckMarker 為連線自檢用的固定字串; 遠端印出的內容須與之完全相同, 否則表示登入
// shell 在啟動時另外輸出了文字, 會干擾後續指令輸出的解析.
const selfCheckMarker = "FSBROWSER_SELFCHECK_9c41ad07"

// requiredTools 為遠端主機須具備的外部工具, 缺一即無法操作遠端檔案系統.
var requiredTools = []string{"find", "mkdir", "mv", "rm", "rmdir"}

// Conn 是一條已建立的 SSH 連線, 同時持有依該連線實作的檔案系統.
type Conn struct {
	client *ssh.Client
	fs     *FS
	label  string
}

// Dial 以私鑰檔建立 SSH 連線, 執行連線自檢後回傳可用的遠端檔案系統.
//
// 認證只支援無 passphrase 的私鑰檔; 且為範例性質的簡化, 本函式不驗證遠端的 host key
// (使用 ssh.InsecureIgnoreHostKey), 因此無法防範中間人攻擊; 正式產品應改以 known_hosts
// 驗證.
//
// port 為 0 時使用預設埠 22; keyFile 為空字串時改用預設私鑰檔 (見 loadKey).
func Dial(host string, port int, user string, keyFile string) (*Conn, error) {
	signer, err := loadKey(keyFile)
	if err != nil {
		return nil, err
	}

	cfg := &ssh.ClientConfig{
		User: user,
		Auth: []ssh.AuthMethod{ssh.PublicKeys(signer)},
		// 範例性質的簡化: 不驗證 host key.
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         dialTimeout,
	}
	client, err := ssh.Dial("tcp", hostAddr(host, port), cfg)
	if err != nil {
		return nil, fmt.Errorf("SSH connection failed: %w", err)
	}

	label := user + "@" + host
	runner := &clientRunner{client: client}
	if err := selfCheck(runner); err != nil {
		client.Close()
		return nil, err
	}
	home, err := remoteHome(runner)
	if err != nil {
		client.Close()
		return nil, err
	}
	return &Conn{client: client, fs: NewFS(runner, label, home), label: label}, nil
}

// FS 取得本連線的遠端檔案系統實作.
func (c *Conn) FS() *FS {
	return c.fs
}

// Label 取得本連線的顯示名稱 (形如 "user@host").
func (c *Conn) Label() string {
	return c.label
}

// Close 關閉 SSH 連線. 重複呼叫為安全操作.
func (c *Conn) Close() error {
	if c == nil || c.client == nil {
		return nil
	}
	err := c.client.Close()
	c.client = nil
	if err != nil && errors.Is(err, net.ErrClosed) {
		return nil
	}
	return err
}

// loadKey 讀取並解析私鑰檔. keyFile 為空字串時不視為錯誤, 改依 defaultKeyNames 的順序於
// $HOME/.ssh 下尋找第一個存在的檔案使用 (比照 OpenSSH 用戶端的預設鍵慣例); 一個都不存在時
// 回傳錯誤並列出嘗試過的路徑, 提示可於 UI 另行指定私鑰檔.
func loadKey(keyFile string) (ssh.Signer, error) {
	if keyFile == "" {
		resolved, err := resolveDefaultKeyFile()
		if err != nil {
			return nil, err
		}
		keyFile = resolved
	}
	data, err := os.ReadFile(keyFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read private key (%s): %w", keyFile, err)
	}
	signer, err := ssh.ParsePrivateKey(data)
	if err != nil {
		return nil, fmt.Errorf("failed to parse private key (%s): %w (note: passphrase-protected keys are not supported)", keyFile, err)
	}
	return signer, nil
}

// resolveDefaultKeyFile 依序尋找 $HOME/.ssh 下的預設私鑰檔, 回傳第一個存在者.
func resolveDefaultKeyFile() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("cannot determine home directory: %w", err)
	}

	tried := make([]string, 0, len(defaultKeyNames))
	for _, name := range defaultKeyNames {
		candidate := filepath.Join(home, ".ssh", name)
		tried = append(tried, candidate)
		if _, err := os.Stat(candidate); err == nil {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("no private key specified and none of the default keys were found (%s); "+
		"specify a private key file in the UI", strings.Join(tried, ", "))
}

// hostAddr 組出 "host:port" 位址; port 為 0 時使用預設埠.
func hostAddr(host string, port int) string {
	if port == 0 {
		port = defaultPort
	}
	return net.JoinHostPort(host, strconv.Itoa(port))
}

// selfCheck 對遠端執行連線自檢: 先確認登入 shell 未在啟動時額外輸出文字, 再確認操作
// 遠端檔案系統所需的工具齊備.
func selfCheck(r Runner) error {
	cmd := "printf '%s' " + Quote(selfCheckMarker)
	stdout, _, _, err := r.Run(cmd)
	if err != nil {
		return fmt.Errorf("connection self-check failed: %w", err)
	}
	if string(stdout) != selfCheckMarker {
		return errors.New("remote account's shell printed extra output at startup, cannot reliably read " +
			"command results; please remove the unconditional print statements from that account's shell " +
			"profile (e.g. .bashrc)")
	}

	missing, err := missingTools(r)
	if err != nil {
		return err
	}
	if len(missing) > 0 {
		return errors.New("remote host is missing required tools: " + strings.Join(missing, ", ") +
			" (remote must be a POSIX system with GNU coreutils and findutils)")
	}
	return nil
}

// missingTools 回傳遠端缺少的必要工具; 逐一以 command -v 確認, 避免部分 shell 的
// command -v 只認第一個參數而誤判.
func missingTools(r Runner) ([]string, error) {
	var missing []string
	for _, tool := range requiredTools {
		stdout, _, _, err := r.Run("command -v " + Quote(tool))
		if err != nil {
			return nil, fmt.Errorf("connection self-check failed: %w", err)
		}
		if strings.TrimSpace(string(stdout)) == "" {
			missing = append(missing, tool)
		}
	}
	return missing, nil
}

// remoteHome 取得遠端家目錄.
func remoteHome(r Runner) (string, error) {
	stdout, _, exit, err := r.Run(`printf '%s' "$HOME"`)
	if err != nil {
		return "", fmt.Errorf("failed to get remote home directory: %w", err)
	}
	home := strings.TrimSpace(string(stdout))
	if exit != 0 || home == "" {
		return "", errors.New("failed to get remote home directory: remote did not report $HOME")
	}
	return cleanPath(home), nil
}

// clientRunner 是 Runner 的 SSH 實作: 每個操作各開一個 session, 指令一律以
// export LC_ALL=C 開頭執行 (固定 stderr 訊息語言為英文, 供錯誤分類), 並以 opTimeout 包裝.
type clientRunner struct {
	mu     sync.Mutex
	client *ssh.Client
}

// Run 在遠端執行指令, 回傳 stdout, stderr 與結束碼.
func (r *clientRunner) Run(cmd string) ([]byte, []byte, int, error) {
	type result struct {
		stdout []byte
		stderr []byte
		exit   int
		err    error
	}
	ch := make(chan result, 1)
	go func() {
		stdout, stderr, exit, err := r.exec(cmd)
		ch <- result{stdout, stderr, exit, err}
	}()
	select {
	case res := <-ch:
		return res.stdout, res.stderr, res.exit, res.err
	case <-time.After(opTimeout):
		// 逾時後背景 goroutine 任其自然結束, 結果送不出去由 GC 回收 (channel 有緩衝,
		// 故該 goroutine 不會永久阻塞).
		return nil, nil, 0, ErrTimeout
	}
}

// exec 開一個 session 執行指令並收集輸出; 指令非 0 結束碼不視為錯誤, 改以結束碼回報.
func (r *clientRunner) exec(cmd string) ([]byte, []byte, int, error) {
	return r.execWithSession(cmd, nil)
}

// execWithSession 同 exec, 但在 session 建立後立即透過 sessionCh 送出該 session, 供
// 呼叫端 (見 RunContext) 於取消時據以呼叫 Close() 中止指令; sessionCh 需有緩衝空間,
// 傳入 nil 或呼叫端不讀取時本函式皆不因送出而阻塞.
func (r *clientRunner) execWithSession(cmd string, sessionCh chan<- *ssh.Session) ([]byte, []byte, int, error) {
	r.mu.Lock()
	client := r.client
	r.mu.Unlock()
	if client == nil {
		return nil, nil, 0, ErrNoClient
	}

	session, err := client.NewSession()
	if err != nil {
		return nil, nil, 0, err
	}
	defer session.Close()

	select {
	case sessionCh <- session:
	default:
	}

	var outBuf, errBuf bytes.Buffer
	session.Stdout = &outBuf
	session.Stderr = &errBuf

	// 以 export 而非指令前綴設定 LC_ALL: 前綴形式對以變數指派或複合指令開頭的指令會失效.
	err = session.Run("export LC_ALL=C; " + cmd)
	if err == nil {
		return outBuf.Bytes(), errBuf.Bytes(), 0, nil
	}
	var exitErr *ssh.ExitError
	if errors.As(err, &exitErr) {
		return outBuf.Bytes(), errBuf.Bytes(), exitErr.ExitStatus(), nil
	}
	return outBuf.Bytes(), errBuf.Bytes(), 0, err
}

// RunContext 同 Run, 但以 ctx 取代 opTimeout 控制執行時間上限, 供複製, 搬移等可能
// 耗時的操作使用, 使其不受該固定上限限制. ctx 被取消時關閉指令所在的 session 以中止
// 遠端行程 (關閉 SSH channel 使遠端 shell 收到 EOF / SIGHUP 而終止其執行中的子行程,
// 是否確實終止仍取決於該行程是否攔截該訊號, 為儘力而為的中止手段), 並回傳 ctx.Err().
func (r *clientRunner) RunContext(ctx context.Context, cmd string) ([]byte, []byte, int, error) {
	type result struct {
		stdout, stderr []byte
		exit           int
		err            error
	}
	ch := make(chan result, 1)
	sessCh := make(chan *ssh.Session, 1)
	go func() {
		stdout, stderr, exit, err := r.execWithSession(cmd, sessCh)
		ch <- result{stdout, stderr, exit, err}
	}()

	select {
	case res := <-ch:
		return res.stdout, res.stderr, res.exit, res.err
	case <-ctx.Done():
		// 等待 session 建立完成 (或執行已提前結束, 例如 NewSession 失敗) 再決定是否
		// 需要關閉, 避免競態下漏關已建立的 session; 背景 goroutine 之後仍會把結果送進
		// 有緩衝的 ch, 此處不等待, 任其自然結束並由 GC 回收.
		select {
		case s := <-sessCh:
			_ = s.Close()
		case res := <-ch:
			return res.stdout, res.stderr, res.exit, res.err
		}
		return nil, nil, 0, ctx.Err()
	}
}
