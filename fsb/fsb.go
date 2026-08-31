// Package fsb 定義檔案操作介面 (檔案系統瀏覽元件與宿主 app 之間的抽象規格), 相關
// 項目型別與結構化錯誤型別. 本套件只定義介面, 不提供任何通訊協定或本機檔案系統的實作;
// 宿主 app 依此介面提供自己的實作 (詳見計劃書第 4 章).
package fsb

import (
	"context"
	"errors"
	"time"
)

// Kind 表示項目的基本種類. 失效連結的解析目標另以 KindMissing 表示 (見 Entry.Target).
type Kind string

const (
	KindFile    Kind = "file"    // 一般檔案
	KindDir     Kind = "dir"     // 目錄
	KindSocket  Kind = "socket"  // socket 特殊檔案
	KindFIFO    Kind = "fifo"    // named pipe (FIFO) 特殊檔案
	KindDevice  Kind = "device"  // 裝置檔
	KindUnknown Kind = "unknown" // 無法歸類的種類
	KindMissing Kind = "missing" // 僅用於 Entry.Target: 連結解析目標不存在 (失效連結)
)

// Entry 表示單一路徑項目 (檔案, 目錄, 特殊檔案或連結) 的屬性.
//
// 路徑一律為內部形式 (以 "/" 分隔, Windows 磁碟機標準化為 "C:/" 字首形式, 詳見計劃書第 4.2 節).
type Entry struct {
	Name    string    // 項目名稱 (不含路徑)
	Path    string    // 項目的完整路徑, 內部形式
	Kind    Kind      // 基本種類; IsLink 為 true 時, Kind 為連結本身的種類 (通常為 KindFile)
	IsLink  bool      // 項目本身是否為連結
	Target  Kind      // IsLink 為 true 時, 實作解析後的目標種類; 目標不存在時為 KindMissing
	Size    int64     // 位元組數
	ModTime time.Time // 修改時間, 以 UTC 傳輸
	Hidden  bool      // 是否為隱藏項目
}

// FileSystem 是檔案操作介面: 宿主 app 依此介面提供自己的檔案系統實作 (本機, 記憶體,
// 或包裝既有的遠端連線程式碼皆可), 交給橋接層 service 註冊後, 前端元件即可透過 Wails
// bindings 呼叫到宿主的實作. 介面本身與任何通訊協定無關.
//
// 所有路徑參數與回傳路徑皆為內部形式 (第 4.2 節). 操作失敗時應回傳 *fsb.Error 以攜帶
// 結構化錯誤代碼; 若回傳一般 error, 橋接層會將其歸類為 ErrUnknown.
type FileSystem interface {
	// List 列出 dir 目錄的內容.
	List(dir string) ([]Entry, error)
	// Stat 查詢單一路徑的屬性.
	Stat(path string) (Entry, error)
	// Home 回傳起始 / 家目錄.
	Home() (string, error)
	// Roots 回傳所有根. POSIX 實作回傳單一根 (["/"]); Windows 實作回傳各磁碟機
	// (["C:/", "D:/", ...]).
	Roots() ([]string, error)
	// PathStyle 回傳 "posix" 或 "windows". 本項不涉及檔案操作, 也不改變跨越介面的路徑
	// 形式 (進出一律為內部形式); 它決定前端的三項行為: 路徑的顯示寫法 (Windows 風格以
	// 反斜線呈現, 根標籤去除結尾分隔符), 路徑比對是否忽略大小寫 (Windows 風格轉小寫後
	// 比對), 以及存檔模式的檔名是否額外檢查 Windows 保留字元. 其中路徑比對並非外觀問題:
	// 巢狀貼上的防護即以此判定, 宣告錯誤會使該防護在使用者僅改動大小寫時失效.
	PathStyle() string
	// MakeDir 於 path 建立目錄.
	MakeDir(path string) error
	// Rename 將 oldPath 重新命名 (或搬移) 為 newPath.
	Rename(oldPath, newPath string) error
	// Delete 刪除 path 所指的檔案或目錄. 是否允許刪除非空目錄由實作決定; 元件不遞迴,
	// 對選取集中每個項目各呼叫一次.
	Delete(path string) error
}

// PathStyle 常數: FileSystem.PathStyle 的合法回傳值.
const (
	PathStylePOSIX   = "posix"
	PathStyleWindows = "windows"
)

// 以下四個介面為選用能力 (計劃書第 3.1 節): FileSystem 既有八項必要操作維持不動,
// 宿主可額外實作下列介面以取得遞迴複製與搬移功能; 橋接層以型別斷言偵測宿主實際滿足
// 哪些介面, 未實作者由前端元件自動收斂對應的選單項目, 既有宿主不需改動任何程式碼即可
// 繼續編譯與運作.

// Copier 是選用的遞迴複製能力: 來源為目錄時, 由實作自行走訪整棵樹 (元件不遞迴, 也不
// 取得檔案內容, 見計劃書第 2.2 節). overwrite 為 true 時, 目標已存在的同名項目一律
// 覆寫 (含遞迴過程中遇到的每一層); 為 false 且目標已存在時, 回報 ErrAlreadyExists.
type Copier interface {
	Copy(src, dst string, overwrite bool) error
}

// CopierContext 是可取消的遞迴複製能力, 語意同 Copier, 另接受 context. 實作應於走訪
// 過程中定期檢查 ctx.Err(), 中斷時回傳 ctx.Err(). 橋接層以 "是否實作本介面" 判斷宿主
// 是否支援取消, 取消能力因此不另立獨立介面 (見計劃書第 3.1 節): 這樣能力宣告與實際
// 遵守 context 的行為綁在一起, 不會出現宣告支援取消但走訪中不理會中斷的落差.
type CopierContext interface {
	CopyContext(ctx context.Context, src, dst string, overwrite bool) error
}

// Mover 是選用的搬移能力, 語意同 Copy, 但來源於成功後不再存在. 跨磁碟或跨檔案系統的
// 搬移如何達成由實作決定. 宿主未提供本能力時, 前端改走退回路徑 (以既有的 Rename
// 完成搬移), 因此剪下貼上對所有宿主皆可用; 複製沒有退回路徑, 因為既有八項操作裡沒有
// 任何能搬動檔案內容的能力.
type Mover interface {
	Move(src, dst string, overwrite bool) error
}

// MoverContext 是可取消的搬移能力, 語意同 CopierContext 之於 Copier.
type MoverContext interface {
	MoveContext(ctx context.Context, src, dst string, overwrite bool) error
}

// Capabilities 描述宿主目前註冊的實作滿足哪些選用能力, 由橋接層 (service 套件) 型別
// 斷言偵測後回傳給前端元件, 供其決定選單項目的顯示與否 (計劃書第 3.2 節). 三個欄位皆
// 帶 json tag, 序列化後的欄位名為 canCopy / canMove / canCancel, 對齊前端 TypeScript
// 端習慣的 camelCase 命名.
type Capabilities struct {
	CanCopy   bool `json:"canCopy"`   // 是否滿足 Copier 或 CopierContext 任一介面
	CanMove   bool `json:"canMove"`   // 是否滿足 Mover 或 MoverContext 任一介面
	CanCancel bool `json:"canCancel"` // 是否至少一項具備可取消版本 (CopierContext 或 MoverContext)
}

// ErrorCode 是結構化錯誤的代碼列舉 (第 4.3 節). 此集合為介面首版凍結範圍, 供前端
// 元件選用對應語言包詞條, 亦供宿主分流處理; 不得任意增減.
type ErrorCode string

const (
	ErrNotFound         ErrorCode = "not_found"         // 路徑不存在
	ErrPermissionDenied ErrorCode = "permission_denied" // 權限不足
	ErrAlreadyExists    ErrorCode = "already_exists"    // 目標路徑已存在
	ErrNotEmpty         ErrorCode = "not_empty"         // 目錄非空
	ErrDisconnected     ErrorCode = "disconnected"      // 底層連線已中斷
	ErrIO               ErrorCode = "io_error"          // 其他輸入輸出錯誤
	ErrUnknown          ErrorCode = "unknown"           // 無法歸類的錯誤
	ErrCanceled         ErrorCode = "canceled"          // 作業因取消而中斷 (計劃書第 3.3 節)
)

// Error 是檔案操作介面實作應回報的結構化錯誤: 錯誤代碼 (供程式判斷與選字) + 人類可讀
// 訊息 (作為補充細節原樣顯示, 不保證可跨語言).
type Error struct {
	Code    ErrorCode `json:"code"`
	Message string    `json:"message"`
}

// Error 實作 error 介面.
func (e *Error) Error() string {
	if e.Message == "" {
		return string(e.Code)
	}
	return string(e.Code) + ": " + e.Message
}

// NewError 建立一個結構化錯誤.
func NewError(code ErrorCode, message string) *Error {
	return &Error{Code: code, Message: message}
}

// AsError 將任意 error 歸類為結構化錯誤: err 本身 (或其鏈中) 已是 *Error 時原樣取出;
// 否則以其 Error() 文字包成 ErrUnknown. err 為 nil 時回傳 nil.
func AsError(err error) *Error {
	if err == nil {
		return nil
	}
	var fe *Error
	if errors.As(err, &fe) {
		return fe
	}
	return &Error{Code: ErrUnknown, Message: err.Error()}
}
