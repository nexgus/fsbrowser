// Package service 提供 fsbrowser 的橋接層: 一個 Wails v3 service, 把宿主 app 提供的
// fsb.FileSystem 實作暴露給前端元件呼叫 (計劃書第 4.4 節).
package service

import (
	"sync"

	"github.com/nexgus/fsbrowser/fsb"
)

// Service 是註冊給 Wails v3 application.NewService 的橋接層物件. 建構後以
// application.NewService(service.New(myFS)) 註冊給宿主 app, 執行
// wails3 generate bindings 後前端即可呼叫本結構體的方法.
//
// 錯誤傳遞方式 (依 Wails v3.0.0-beta.8 實測行為決定, 見下方說明): 本結構體所有方法
// 直接回傳 error (不另外包一層), 且回傳值一律先經 fsb.AsError 正規化為 *fsb.Error.
// *fsb.Error 的 Code / Message 兩個欄位皆帶 json tag (見 fsb/fsb.go), 因此
// Wails 內建的預設錯誤序列化機制 (encoding/json 直接序列化該錯誤值) 已足以把結構化
// 錯誤帶到前端, 不需要自訂 ServiceOptions.MarshalError:
//
//   - Wails 對 service 方法呼叫的錯誤處理機制是: 若方法回傳非 nil 的 error, 橋接層會呼叫
//     (預設或自訂的) error marshaler 把該 error 序列化為 JSON, 包進一個 CallError
//     結構的 Cause 欄位一併送到前端; 預設 marshaler 即為 json.Marshal(&err) (見
//     wails v3 pkg/application/bindings.go 之 defaultMarshalError).
//   - 前端 (@wailsio/runtime) 收到失敗回應時, 對呼叫方拋出一個 RuntimeError, 並把上述
//     Cause 反序列化後掛在該 RuntimeError 的 cause 屬性上 (見
//     internal/runtime/desktop/@wailsio/runtime/src/runtime.ts). 呼叫端因此可用
//     `err.cause.code` / `err.cause.message` 取得結構化錯誤, 不需自行解析字串.
//   - 由於 *fsb.Error 的兩個欄位皆為 exported 並帶 json tag, 預設 marshaler 產生的
//     JSON 恰為 {"code": "...", "message": "..."}, 與計劃書第 4.3 節的欄位語意一致,
//     故未覆寫 MarshalError.
type Service struct {
	mu sync.RWMutex
	fs fsb.FileSystem
}

// New 建立一個橋接層 Service, fs 為宿主提供的檔案操作介面實作.
func New(fs fsb.FileSystem) *Service {
	return &Service{fs: fs}
}

// SetFileSystem 於執行期抽換底層的檔案操作介面實作 (例如宿主重新連線後換一個新的實作
// 物件). 呼叫後, Service 的下一次操作即使用新實作; 呼叫本身不影響正在進行中的操作.
func (s *Service) SetFileSystem(fs fsb.FileSystem) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.fs = fs
}

// current 取得目前的檔案操作介面實作 (執行期可能被 SetFileSystem 抽換, 故每次操作皆
// 重新取值, 不快取).
func (s *Service) current() fsb.FileSystem {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.fs
}

// wrap 把宿主實作回傳的 error 正規化為結構化錯誤 (*fsb.Error); 宿主若回傳一般 error,
// 歸類為 fsb.ErrUnknown (第 4.3 節).
func wrap(err error) error {
	fe := fsb.AsError(err)
	if fe == nil {
		return nil
	}
	return fe
}

// List 列出 dir 目錄的內容.
func (s *Service) List(dir string) ([]fsb.Entry, error) {
	entries, err := s.current().List(dir)
	return entries, wrap(err)
}

// Stat 查詢單一路徑的屬性.
func (s *Service) Stat(path string) (fsb.Entry, error) {
	entry, err := s.current().Stat(path)
	return entry, wrap(err)
}

// Home 回傳起始 / 家目錄.
func (s *Service) Home() (string, error) {
	home, err := s.current().Home()
	return home, wrap(err)
}

// Roots 回傳所有根.
func (s *Service) Roots() ([]string, error) {
	roots, err := s.current().Roots()
	return roots, wrap(err)
}

// PathStyle 回傳 "posix" 或 "windows"; 與 fsb.FileSystem.PathStyle 一致, 此操作不會
// 失敗, 故不回傳 error.
func (s *Service) PathStyle() string {
	return s.current().PathStyle()
}

// MakeDir 建立目錄.
func (s *Service) MakeDir(path string) error {
	return wrap(s.current().MakeDir(path))
}

// Rename 重新命名.
func (s *Service) Rename(oldPath, newPath string) error {
	return wrap(s.current().Rename(oldPath, newPath))
}

// Delete 刪除檔案或目錄.
func (s *Service) Delete(path string) error {
	return wrap(s.current().Delete(path))
}
