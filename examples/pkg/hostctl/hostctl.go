// Package hostctl 提供範例 app 的宿主控制 service: 一個註冊給 Wails v3 的物件, 與
// fsbrowser 的橋接層 service 並列註冊, 供前端在本機檔案系統與 SSH 遠端檔案系統之間切換.
//
// 本套件不參與檔案操作本身, 只負責建立 / 關閉遠端連線, 並把切換後的實作交給橋接層的
// SetFileSystem; 錯誤回傳前一律經 fsb.AsError 正規化為 *fsb.Error, 與橋接層的做法一致,
// 使前端拿得到結構化的 code / message.
package hostctl

import (
	"sync"

	"github.com/nexgus/fsbrowser/examples/pkg/localfs"
	"github.com/nexgus/fsbrowser/examples/pkg/sshfs"
	"github.com/nexgus/fsbrowser/fsb"
	"github.com/nexgus/fsbrowser/service"
)

// 模式常數: Mode 的回傳值.
const (
	ModeLocal  = "local"  // 目前使用本機檔案系統
	ModeRemote = "remote" // 目前使用 SSH 遠端檔案系統
)

// Service 是註冊給 Wails v3 application.NewService 的宿主控制物件. 內部以 mutex 保護
// 目前模式與遠端連線, 使前端的連線 / 斷線 / 切換呼叫可安全地交錯發生.
type Service struct {
	mu     sync.Mutex
	bridge *service.Service
	local  *localfs.FS
	conn   *sshfs.Conn // 目前的遠端連線; 本機模式時為 nil
	mode   string
}

// New 建立宿主控制 service, bridge 為同時註冊給 Wails 的 fsbrowser 橋接層.
//
// 建構後的初始模式為本機; 呼叫端應以本機實作建構 bridge, 使兩者初始狀態一致.
func New(bridge *service.Service) *Service {
	return &Service{
		bridge: bridge,
		local:  localfs.New(),
		mode:   ModeLocal,
	}
}

// UseLocal 切換為本機檔案系統. 目前為遠端模式時先關閉該連線, 再把橋接層的底層實作換為
// 本機實作.
func (s *Service) UseLocal() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return wrap(s.useLocalLocked())
}

// ConnectRemote 以私鑰檔建立 SSH 連線 (含連線自檢), 成功後把橋接層的底層實作換為該遠端
// 實作; 失敗時回傳錯誤且不改變目前狀態 (原有連線與模式維持不變).
//
// port 為 0 時使用預設埠 22.
func (s *Service) ConnectRemote(host string, port int, user string, keyFile string) error {
	// 連線可能耗時數秒, 但仍於鎖內進行: 範例 app 的操作頻率低, 以最簡單的方式確保
	// 不會有兩個連線同時建立而導致狀態錯亂.
	s.mu.Lock()
	defer s.mu.Unlock()

	conn, err := sshfs.Dial(host, port, user, keyFile)
	if err != nil {
		return wrap(err)
	}

	// 新連線建立成功後才關閉舊連線, 使連線失敗時目前狀態完全不受影響.
	if s.conn != nil {
		_ = s.conn.Close()
	}
	s.conn = conn
	s.mode = ModeRemote
	s.bridge.SetFileSystem(conn.FS())
	return nil
}

// DisconnectRemote 關閉遠端連線並切回本機檔案系統. 目前已是本機模式時為無操作.
func (s *Service) DisconnectRemote() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return wrap(s.useLocalLocked())
}

// Mode 回傳目前的模式: "local" 或 "remote".
func (s *Service) Mode() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.mode
}

// useLocalLocked 於已持有鎖的前提下切回本機模式: 關閉遠端連線 (若有), 換上本機實作.
// 關閉連線失敗仍完成切換, 僅把錯誤回報給呼叫端 (連線已無法再用, 停在遠端模式反而更糟).
func (s *Service) useLocalLocked() error {
	var err error
	if s.conn != nil {
		err = s.conn.Close()
		s.conn = nil
	}
	s.mode = ModeLocal
	s.bridge.SetFileSystem(s.local)
	return err
}

// wrap 把錯誤正規化為結構化錯誤 (*fsb.Error); 一般 error 歸類為 fsb.ErrUnknown.
func wrap(err error) error {
	fe := fsb.AsError(err)
	if fe == nil {
		return nil
	}
	return fe
}
