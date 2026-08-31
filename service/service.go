// Package service 提供 fsbrowser 的橋接層: 一個 Wails v3 service, 把宿主 app 提供的
// fsb.FileSystem 實作暴露給前端元件呼叫 (計劃書第 4.4 節).
package service

import (
	"context"
	"errors"
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
//
// 本方法僅供 Go 端宿主呼叫, 介面參數無法經 JSON 跨越 bindings, 故以下列指示排除於
// bindings 產生之外 (亦免除產生器對介面參數的警告).
//
//wails:ignore
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

// wrapCancelable 供 Copy / Move 兩個支援 context 取消的方法使用: 先判斷 err 是否為
// context 取消所致 (context.Canceled 或 context.DeadlineExceeded), 是則歸類為
// fsb.ErrCanceled (計劃書第 3.3 節); 否則沿用既有的 wrap 正規化流程, 宿主若已自行回報
// *fsb.Error (含直接回報 ErrCanceled 的情形) 亦原樣保留. 既有八項必要操作不涉及
// context, 不套用本函式.
func wrapCancelable(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return fsb.NewError(fsb.ErrCanceled, err.Error())
	}
	return wrap(err)
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

// Capabilities 回傳目前註冊的實作滿足哪些選用能力 (計劃書第 3.1, 3.2 節): 以型別斷言
// 偵測 current() 取得的實作是否滿足 Copier / CopierContext / Mover / MoverContext
// 四個選用介面, 不快取結果, 故宿主於執行期以 SetFileSystem 抽換實作後, 下一次查詢即
// 反映新實作的能力.
func (s *Service) Capabilities() fsb.Capabilities {
	cur := s.current()
	_, copier := cur.(fsb.Copier)
	_, copierCtx := cur.(fsb.CopierContext)
	_, mover := cur.(fsb.Mover)
	_, moverCtx := cur.(fsb.MoverContext)
	return fsb.Capabilities{
		CanCopy:   copier || copierCtx,
		CanMove:   mover || moverCtx,
		CanCancel: copierCtx || moverCtx,
	}
}

// Copy 轉呼叫宿主的複製能力 (計劃書第 3.2 節). 實作同時滿足 CopierContext 與 Copier
// 兩者時優先採用前者, 把 ctx 轉交給宿主以便走訪過程中檢查取消; 只滿足 Copier 時 ctx
// 被忽略. 宿主未提供複製能力時回報 fsb.ErrUnknown 並附明確訊息 -- 正常情況下元件不會
// 呼叫到本方法, 因為前端已依 Capabilities 的查詢結果隱藏對應的選單項目.
func (s *Service) Copy(ctx context.Context, src, dst string, overwrite bool) error {
	cur := s.current()
	if c, ok := cur.(fsb.CopierContext); ok {
		return wrapCancelable(c.CopyContext(ctx, src, dst, overwrite))
	}
	if c, ok := cur.(fsb.Copier); ok {
		return wrap(c.Copy(src, dst, overwrite))
	}
	return fsb.NewError(fsb.ErrUnknown, "目前的檔案操作實作未提供複製能力 (未實作 fsb.Copier 或 fsb.CopierContext)")
}

// Move 轉呼叫宿主的搬移能力, 優先序與 ctx 處理方式同 Copy. 宿主未提供搬移能力時回報
// fsb.ErrUnknown 並附明確訊息; 元件端於此情形改走退回路徑 (以 Rename 完成), 故正常
// 情況下亦不會呼叫到本方法.
func (s *Service) Move(ctx context.Context, src, dst string, overwrite bool) error {
	cur := s.current()
	if m, ok := cur.(fsb.MoverContext); ok {
		return wrapCancelable(m.MoveContext(ctx, src, dst, overwrite))
	}
	if m, ok := cur.(fsb.Mover); ok {
		return wrap(m.Move(src, dst, overwrite))
	}
	return fsb.NewError(fsb.ErrUnknown, "目前的檔案操作實作未提供搬移能力 (未實作 fsb.Mover 或 fsb.MoverContext)")
}
