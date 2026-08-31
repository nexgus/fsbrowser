# 實作檔案操作介面

[English](interface-guide.md)

fsbrowser 對 SSH, S3 或本機磁碟一無所知, 只定義一個小型的 Go 介面, 由宿主 app 提供實作; 元件顯示的一切內容都經由這個介面回傳. 本文件是完整的規格書: 介面宣告在何處, 每個操作必須做到什麼, 每個欄位代表什麼意義, 操作失敗時該回報哪個錯誤代碼, 以及一份可以複製進專案並直接建置的可運作實作. 不須事先熟悉這個元件, 也不需要讀它的原始碼, 讀完本文件就能讓瀏覽器動起來.

## 1. 介面定義在哪裡

必須實作的一切都宣告在單一檔案中: [`fsb/fsb.go`](../fsb/fsb.go). 該檔案是介面, 項目型別, 選用能力介面, 能力旗標與錯誤代碼的唯一定義處, 不必到別處查找.

| Import 路徑 | 內容 |
|---|---|
| `github.com/nexgus/fsbrowser/fsb` | 介面, `Entry`, `Kind`, `Error`, `ErrorCode`, 選用能力介面, `Capabilities` |
| `github.com/nexgus/fsbrowser/service` | 把實作暴露給前端的橋接層 service |

`fsb` 套件只從標準函式庫匯入 `context`, `errors` 與 `time`, 整個模組本身完全沒有宣告任何外部相依套件. 它不匯入 Wails, 也不匯入任何通訊協定函式庫. 由此帶來兩個結果:

- 可以在沒有 GUI, 沒有執行中的應用程式, 也沒有 `wails3` CLI 的情況下撰寫並單元測試一份實作.
- 元件無法對傳輸方式做任何假設. 只要是從 Go 能觸及的東西 -- 已經開啟的 SSH session, 雲端儲存 SDK, 資料庫, 記憶體中的一個 map -- 都能作為檔案瀏覽器的後端, 前提是能回答第 4 節的八個問題.

只有 `service` 套件會意識到 Wails 的存在, 只在註冊時 (第 8 節) 接觸它一次.

## 2. 路徑約定

凡是跨越介面的路徑, 不論方向, 一律採用*內部形式*:

- 路徑各段一律以 `/` 分隔, 在任何平台上皆然.
- 路徑一律是絕對路徑.
- 在 Windows 風格的檔案系統上, 磁碟機會正規化為 `C:/` 前綴 -- 所以是 `C:/Users/gus/data`, 絕不是 `C:\Users\gus\data`.

反斜線純粹是顯示層的問題. `PathStyle` (第 4.5 節) 告訴前端要以哪種慣例呈現, 而前端只在顯示時轉換; 它回傳的值, 以及透過選取事件送給宿主 app 的路徑, 都維持內部形式.

如果實作要和某個期待原生路徑的對象溝通 -- Windows 上的 `os` 套件, 遠端 shell, 有自己定址方式的 API -- 雙向轉換都是實作自己的責任, 應該放在實作內部完成. 除此之外的任何地方都不該看到原生路徑. 具體來說:

- 進來時轉換: 收到的每個路徑參數都是內部形式, 使用前先轉換.
- 出去時轉換: 不論後端交回什麼, `Entry.Path` 與 `Home` 回傳的值都必須是內部形式.

也要做防禦性正規化. 範例實作會先讓每個傳入路徑經過一道清理步驟, 把反斜線替換掉, 強制加上開頭的 `/`, 並收合 `.` 與 `..`, 才進行其他任何動作, 這樣一來, 在別處組出來的路徑就不會以非預期的形狀抵達後端.

## 3. 描述一個項目

`Entry` 是為檔案, 目錄, 特殊檔案或連結回傳的記錄.

| 欄位 | 型別 | 意義 |
|---|---|---|
| `Name` | `string` | 項目名稱, 不含路徑. 若為根, 則是根本身 (`/` 或 `C:/`). |
| `Path` | `string` | 項目的完整路徑, 內部形式. |
| `Kind` | `Kind` | 項目自身的基本種類. 對連結而言, 這是連結本身的種類, 不是其目標的種類. |
| `IsLink` | `bool` | 該項目本身是否為連結. |
| `Target` | `Kind` | 只有在 `IsLink` 為 true 時才有意義: 連結所指向對象的種類. |
| `Size` | `int64` | 大小, 以位元組計. |
| `ModTime` | `time.Time` | 修改時間, 以 UTC 傳輸. |
| `Hidden` | `bool` | 在此檔案系統上該項目是否算隱藏. |

`Kind` 是一個字串列舉:

| 值 | 常數 | 意義 |
|---|---|---|
| `file` | `fsb.KindFile` | 一般檔案 |
| `dir` | `fsb.KindDir` | 目錄 |
| `socket` | `fsb.KindSocket` | Socket 特殊檔案 |
| `fifo` | `fsb.KindFIFO` | 具名管線 (FIFO) |
| `device` | `fsb.KindDevice` | 裝置檔案 |
| `unknown` | `fsb.KindUnknown` | 無法分類 |
| `missing` | `fsb.KindMissing` | 只會出現在 `Target` 中: 連結的目標不存在 |

### 連結

一個連結描述兩次, 這個區別對 UI 而言很重要:

- `Kind` 描述連結本身. 連結自身並沒有種類, 所以回報 `KindFile`. 填寫這個欄位時**不要**解析連結: 查詢項目時不要跟隨它 (使用 `os.Lstat` 而非 `os.Stat`, 或後端的對應做法).
- `IsLink` 為 true.
- `Target` 描述連結指向的對象, 透過解析一次連結取得. 指向目錄的連結得到 `KindDir`, 指向檔案的連結得到 `KindFile`.
- 失效連結 -- 目標無法被解析的連結 -- 的 `Target` 會被設為 `KindMissing`. 失效連結不是錯誤, 仍然必須出現在列表中.

元件用 `Target` 判斷一個項目的行為是否像目錄: 目標是目錄的連結可以導覽進入, 在目錄選取模式下也可以選取. 若連結的 `Target` 維持零值, 元件就無從分辨, 所以只要 `IsLink` 為 true 就務必填寫這個欄位.

### 特殊檔案與未知種類

Socket, FIFO 與裝置檔案各自有自己的種類, 讓元件可以給它們不同的圖示. 如果後端無法分類某個東西 -- 屬性讀不到的項目, 或通訊協定沒有對應模型的型別 -- 回傳 `KindUnknown`, 不要用猜的. `KindUnknown` 是正當的答案; 猜錯的種類則不是.

### 關於序列化的說明

`Entry` 沒有帶 JSON tag, 所以它的欄位是以 Go 的名稱 (`Name`, `Path`, `Kind` 等等) 跨越到前端. 不需要自己撰寫這個對應關係; 之所以在此提及, 只是為了讓瀏覽器開發者工具中看到的欄位名稱不會令人意外.

## 4. 八項必要操作

必要介面是 `fsb.FileSystem`. 八個方法全部都必須存在; 少了一個或拼錯一個, 會在註冊時變成編譯錯誤, 而不是執行期才出現的意外.

| 方法 | 一句話摘要 |
|---|---|
| `List(dir string) ([]Entry, error)` | 回傳一個目錄的內容. |
| `Stat(path string) (Entry, error)` | 回傳單一路徑的屬性. |
| `Home() (string, error)` | 回傳瀏覽器開啟時所在的目錄. |
| `Roots() ([]string, error)` | 回傳這個檔案系統的每一個根. |
| `PathStyle() string` | 回傳 `"posix"` 或 `"windows"`, 供顯示之用. |
| `MakeDir(path string) error` | 建立一個目錄. |
| `Rename(oldPath, newPath string) error` | 重新命名或搬移單一項目. |
| `Delete(path string) error` | 刪除一個檔案或目錄. |

有兩項慣例貫穿全篇, 而且都很容易出錯:

- **元件從不遞迴. ** 它不會代替實作走訪整棵樹, 也不會讀取檔案內容. 當使用者刪除五個選取的項目時, 它會呼叫 `Delete` 五次, 每個項目一次.
- **所有路徑都是內部形式**, 不論是收到的參數還是回傳的路徑 (第 2 節).

### 4.1 List

```go
List(dir string) ([]Entry, error)
```

`dir` 是要列舉的目錄. 每個成員回傳一個 `Entry`, 只描述子項目 -- 不含 `.` 或 `..` 這類虛擬項目.

不需要排序結果, 也不可以過濾它. 元件會自己排序列表 (目錄優先, 再依名稱排序, 不分大小寫), 也會依使用者目前的切換狀態自行隱藏隱藏項目. 工作只是正確回報 `Hidden`, 並回傳所有項目.

目錄不存在時回報 `ErrNotFound`, 無法讀取時回報 `ErrPermissionDenied`, 而當 `dir` 其實是個檔案時也回報 `ErrNotFound` (而不是成功回傳一個空列表). 有些後端在列舉時會悄悄不出聲 -- 例如指向一個檔案時, shell 的 `find` 不會抱怨, 只會什麼都不回傳 -- 這種情況需要明確檢查, 否則使用者看到的會是一個空目錄, 而不是錯誤.

**陷阱: 單一子項目出錯不該讓整個列表失敗. ** 屬性是逐項查詢的, 單一項目可能因為與目錄本身無關的原因而失敗: 它在列舉與查詢之間被刪除了, 或是它的屬性讀不到. 若因此讓整個呼叫失敗, 使用者面對的會是一個明明完全正常的目錄卻跳出錯誤. 應該改為附加一筆最小記錄 -- 名稱, 路徑, `KindUnknown`, 以及只憑名稱就能判斷的隱藏狀態 -- 然後繼續下去. 第 6 節的最小實作示範了這個模式.

### 4.2 Stat

```go
Stat(path string) (Entry, error)
```

回傳單一路徑的屬性, 填寫 `Entry` 的方式與 `List` 完全相同, 包括第 3 節所述的連結處理方式. 描述項目本身時不要跟隨連結.

`Stat` 不只是提供資訊而已. 在貼上每個項目之前, 元件會對目的路徑呼叫 `Stat`, 藉此判斷是否有衝突, 並依回傳的錯誤代碼決定接下來怎麼做:

- `ErrNotFound` 代表"沒有東西擋路", 貼上會直接進行, 不會跳出提示.
- `ErrDisconnected` 會中止整批操作, 因為假設連線已經斷了.
- 其他任何錯誤都只會讓那一個項目失敗, 然後繼續處理下一個.

所以路徑不存在時務必明確產生 `ErrNotFound`. 若對不存在的路徑回傳 `ErrIO` 或 `ErrUnknown`, 會讓每一次原本正常的貼上都以失敗收場.

### 4.3 Home

```go
Home() (string, error)
```

回傳瀏覽器開啟時所在的目錄 -- 通常是使用者的家目錄, 但任何合理的起點都可以. 回傳的路徑必須存在, 必須是目錄, 而且必須是內部形式.

如果真的無法判斷該回傳什麼, 可以回傳錯誤, 但瀏覽器屆時就無處可去; 對使用者而言, 回傳一個根通常比在第一個畫面就跳出錯誤來得好. SSH 範例會在連線建立時解析一次遠端家目錄並快取起來, 因為每次呼叫都詢問遠端既浪費, 又會在連線本來就有問題時偏偏失敗.

### 4.4 Roots

```go
Roots() ([]string, error)
```

回傳這個檔案系統的每一個根, 以內部形式表示, 依應該呈現的順序排列. 至少要回傳一個.

- POSIX 風格的檔案系統回傳單一根: `[]string{"/"}`.
- Windows 風格的檔案系統則每個磁碟機回傳一筆: `[]string{"C:/", "D:/"}`.

元件會把這個結果轉成根切換器, 只要只有一個根, 它就完全不會出現 -- 所以單一根的實作對 UI 而言毫無成本. 要注意磁碟機代號只是最常見的一種根; 擁有多棵獨立樹的遠端後端, 也可以用同樣的方式呈現.

### 4.5 PathStyle

```go
PathStyle() string
```

回傳兩個常數之一: `fsb.PathStylePOSIX` (`"posix"`) 或 `fsb.PathStyleWindows` (`"windows"`). 這是唯一不會失敗的操作, 所以它不回傳錯誤.

這個值不會改變任何跨越介面之物的內部形式 (第 2 節): 不論回傳什麼, Windows 風格的實作收到與回傳的仍然是 `C:/Users/gus`, 分隔符號仍然是 `/`. 它改變的是前端拿到路徑之後的處理方式, 共三處:

- **顯示.** Windows 風格在路徑列上把 `/` 寫成 `\`, 根標籤則去掉結尾的分隔符, 因此 `C:/` 顯示為 `C:`.
- **路徑比對.** Windows 風格會先把路徑轉為小寫再比對, 因為那類檔案系統不區分大小寫. 這一項不是外觀問題: 不准把目錄貼進自己底下的那道防護就是靠比對路徑判定的, 風格宣告錯誤, 使用者只要改動路徑的大小寫就能繞過它.
- **存檔模式的檔名檢查.** Windows 風格會額外擋掉該平台的保留字元.

宣告的依據是後端實際的行為, 不是執行宿主 app 的那台機器. 從 Windows 桌面連到 Linux 伺服器的 SSH 實作, 回報的仍是 `"posix"`.

### 4.6 MakeDir

```go
MakeDir(path string) error
```

在 `path` 建立一個目錄. 元件傳入的是要建立目錄的完整路徑 -- 目前目錄與使用者輸入的名稱組合而成 -- 所以不會有另外的父目錄參數.

不要建立缺少的父目錄. 正常使用情境下父目錄一定存在, 因為使用者本來就站在裡面, 而悄悄建立一整串目錄會把打字錯誤掩蓋過去. 兩份範例實作都刻意使用非遞迴的原生操作 (`os.Mkdir`, 以及不帶 `-p` 的 `mkdir`).

若該名稱已被佔用, 回報 `ErrAlreadyExists`; 若父目錄不可寫入, 回報 `ErrPermissionDenied`.

### 4.7 Rename

```go
Rename(oldPath, newPath string) error
```

把 `oldPath` 重新命名為 `newPath`. 兩者都是完整路徑, 而且兩者的目錄部分可能不同: 當選用的搬移能力不存在時 (第 7.1 節), `Rename` 同時也扮演元件的搬移機制, 所以只處理同目錄重新命名的實作, 會在依賴這個備援機制的宿主上讓剪下貼上失效.

**陷阱: 不要悄悄覆寫. ** 當 `newPath` 已經存在時回報 `ErrAlreadyExists`. 底層的原生操作經常反其道而行 -- POSIX 的 `rename(2)` 會不聲不響地取代既有目標 -- 所以要先檢查目標是否存在, 存在就拒絕. 元件仰賴這一點: 當它透過重新命名這個備援機制完成剪下, 發現目的地已被佔用時, 它會把這個衝突回報為失敗, 而不是跳出提示詢問是否覆寫, 正是因為它無法得知特定實作究竟會覆寫還是拒絕. 悄悄覆寫的實作, 會毀掉使用者從未被詢問過的資料.

### 4.8 Delete

```go
Delete(path string) error
```

刪除位於 `path` 的檔案或目錄. 元件對每個選取的項目呼叫一次, 從不代替實作遞迴.

**非空目錄能不能刪除, 由實作決定**, 兩種答案都正當:

- 拒絕, 並回報 `ErrNotEmpty`. 使用者接下來就得先清空目錄. 第 6 節的最小實作就是這麼做的, 這也是比較安全的預設值.
- 刪除整棵子樹. 內附的本機檔案系統實作就是這麼做的, 符合桌面使用者對檔案管理員的期待.

不論選哪一種, 當路徑不存在時都要回報 `ErrNotFound`. 以遞迴方式刪除的後端應該先檢查存在與否, 因為對不存在的路徑做遞迴刪除, 往往會悄悄成功, 讓一個根本不存在的項目被回報為刪除成功.

## 5. 回報錯誤

失敗的操作要回傳 `*fsb.Error`. 它帶有一個代碼, 供宿主的 UI 轉譯, 以及一段人類可讀的訊息, 會原封不動地顯示為補充細節:

```go
return fsb.NewError(fsb.ErrNotFound, "path does not exist: "+p)
```

這組代碼是凍結的. 從以下八個之中選用, 不要自創新代碼.

| 代碼 | 常數 | 何時回報 |
|---|---|---|
| `not_found` | `fsb.ErrNotFound` | 路徑不存在 |
| `permission_denied` | `fsb.ErrPermissionDenied` | 呼叫端不被允許做這件事 |
| `already_exists` | `fsb.ErrAlreadyExists` | 目的路徑已被佔用 |
| `not_empty` | `fsb.ErrNotEmpty` | 目錄非空 |
| `disconnected` | `fsb.ErrDisconnected` | 底層連線已經消失 |
| `io_error` | `fsb.ErrIO` | 其他任何輸入輸出失敗 |
| `unknown` | `fsb.ErrUnknown` | 無法分類 |
| `canceled` | `fsb.ErrCanceled` | 操作被取消請求中斷 |

選用時有幾點要注意:

- `disconnected` 用於傳輸層失敗, 不是檔案層失敗: session 斷線, 請求逾時, client 被關閉. 元件會把它當成放棄整批操作的理由, 而不只是讓單一項目失敗, 所以只在繼續下去毫無意義時才使用它. SSH 範例只把連線層失敗與操作逾時對應到這個代碼, 其他情況一律不用它.
- `canceled` 通常不需要手動產生. 被取消的操作直接回傳 context 自身的錯誤就夠了; 參見第 7.2 節.
- 轉譯後端錯誤時, 分類的先後順序要仔細安排. 在範例實作中, 非空檢查刻意排在已存在檢查之前, 因為 POSIX 允許用一個同時滿足標準函式庫"已存在"判斷式的錯誤代號, 來回報非空目錄失敗.

**回傳一般的 `error` 是允許的. ** 橋接層 service 會透過 `fsb.AsError` 正規化每一個回傳值, 這個函式會解開錯誤鏈中任何位置的 `*fsb.Error`, 否則就把錯誤文字包成 `ErrUnknown`. 所以就算是一份尚未分類任何錯誤的實作也還是能運作 -- 使用者只是每個失敗都會看到 `unknown`. 先把常見情況 (`not_found`, `permission_denied`, `already_exists`) 分類好, 瀏覽器的行為馬上就會變好.

### 錯誤如何送達前端

不需要設定任何東西就能讓這一切運作; 了解這條鏈路的價值, 只在於它解釋了為什麼回傳 `*fsb.Error` 才是正確做法.

1. 實作把錯誤回傳給橋接層 service, service 會把它正規化為 `*fsb.Error`.
2. Wails 會用它預設的錯誤序列化器 -- 對錯誤值直接套用 `encoding/json` -- 序列化 service 方法回傳的非 nil 錯誤, 並放進失敗回應中送出.
3. 因為 `fsb.Error` 的兩個欄位都有匯出且帶有 JSON tag, 這樣產生出來的結果剛好就是 `{"code": "...", "message": "..."}`. 不需要自訂序列化器, 橋接層 service 也沒有安裝任何自訂序列化器.
4. Wails 前端執行環境會對呼叫端拋出一個 runtime error, 並把解碼後的內容附加為其 cause, 所以元件讀到的是結構化的代碼, 而不必解析字串.
5. 元件會再把它包成自己的錯誤物件 -- 代碼, 訊息, 哪個操作失敗, 哪個路徑 -- 然後透過 `error` 事件或 `onError` callback 交給前端程式碼.

抵達前端時無法辨識的代碼會強制轉為 `unknown`, 這也是務必留在這組凍結代碼之內的另一個理由.

## 6. 最小實作

以下是一份完整, 可編譯的八項操作實作, 只使用標準函式庫, 用來瀏覽 app 所在的那台機器. 它刻意只支援 POSIX: 單一根, 原生路徑本來就長得像內部路徑, 隱藏項目則以開頭的點來辨識.

### 檔案該放在哪裡

Wails v3 的專案佈局把 Go main 程式與 service 檔案放在專案根目錄, 整個前端放在 `frontend/` 之下 (`frontend/src`, `package.json`, `vite.config.ts`), 產生出來的 bindings 放在 `frontend/bindings`, 建置完成的前端則放在 `frontend/dist`, 內嵌進執行檔中. 檔案系統實作是普通的 Go 程式碼, 沒有特別的放置要求: 篇幅不大就放在專案根目錄, 與其他 service 檔案並列; 若會逐漸長大, 就放進自己的子套件 -- 例如 `internal/myfs/`. 以下程式碼採用後者, 套件名稱為 `myfs`.

### `internal/myfs/myfs.go`

```go
// myfs 套件在標準函式庫之上實作 fsbrowser 的檔案操作介面,
// 瀏覽應用程式所在的那台機器.
//
// 它以 POSIX 系統 (Linux, macOS) 為目標, 這類系統只有單一根 ("/"),
// 而且內部路徑與原生路徑剛好相同.
package myfs

import (
	"errors"
	"io/fs"
	"os"
	"path"
	"strings"
	"syscall"

	"github.com/nexgus/fsbrowser/fsb"
)

// FS 是檔案系統的實作. 它不持有任何狀態, 所以單一個值就能服務每一次呼叫.
type FS struct{}

// New 建立一個可以直接交給橋接層 service 使用的實作.
func New() *FS { return &FS{} }

// 編譯期證明 FS 滿足這個介面. 保留這一行: 它能讓少寫或拼錯的方法
// 變成建置錯誤, 而不是執行期的 panic.
var _ fsb.FileSystem = (*FS)(nil)

// List 回傳 dir 的內容.
func (f *FS) List(dir string) ([]fsb.Entry, error) {
	dir = clean(dir)

	names, err := os.ReadDir(dir)
	if err != nil {
		return nil, translate(err, dir)
	}

	entries := make([]fsb.Entry, 0, len(names))
	for _, de := range names {
		child := join(dir, de.Name())
		entry, err := f.stat(child)
		if err != nil {
			// 單一子項目讀不到, 不該讓整個列表失敗: 這個項目可能是在
			// 我們走訪目錄的過程中被刪除的. 回報已知的資訊, 然後繼續.
			entries = append(entries, fsb.Entry{
				Name:   de.Name(),
				Path:   child,
				Kind:   fsb.KindUnknown,
				Hidden: isHidden(de.Name()),
			})
			continue
		}
		entries = append(entries, entry)
	}
	return entries, nil
}

// Stat 回報單一路徑的屬性.
func (f *FS) Stat(p string) (fsb.Entry, error) {
	return f.stat(clean(p))
}

// stat 是 Stat 與 List 背後共用的工作函式; p 已經是內部形式.
func (f *FS) stat(p string) (fsb.Entry, error) {
	// 用 Lstat, 不用 Stat: 符號連結必須被描述成連結本身, 而不是它指向的對象.
	info, err := os.Lstat(p)
	if err != nil {
		return fsb.Entry{}, translate(err, p)
	}

	entry := fsb.Entry{
		Name:    base(p),
		Path:    p,
		Kind:    kindOf(info.Mode()),
		IsLink:  info.Mode()&fs.ModeSymlink != 0,
		Size:    info.Size(),
		ModTime: info.ModTime().UTC(),
		Hidden:  isHidden(base(p)),
	}
	if entry.IsLink {
		// 再解析一次連結, 這次跟隨它, 讓元件能分辨指向目錄的連結與
		// 指向檔案的連結. 若目標已經消失, 回報為 KindMissing.
		if target, err := os.Stat(p); err == nil {
			entry.Target = kindOf(target.Mode())
		} else {
			entry.Target = fsb.KindMissing
		}
	}
	return entry, nil
}

// Home 回傳瀏覽器開啟時所在的目錄.
func (f *FS) Home() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fsb.NewError(fsb.ErrIO, "cannot determine home directory: "+err.Error())
	}
	return clean(home), nil
}

// Roots 回傳單一的 POSIX 根.
func (f *FS) Roots() ([]string, error) {
	return []string{"/"}, nil
}

// PathStyle 告訴前端以 POSIX 的方式呈現路徑.
func (f *FS) PathStyle() string {
	return fsb.PathStylePOSIX
}

// MakeDir 建立一個目錄. 缺少的父目錄不會被建立.
func (f *FS) MakeDir(p string) error {
	p = clean(p)
	if err := os.Mkdir(p, 0o755); err != nil {
		return translate(err, p)
	}
	return nil
}

// Rename 重新命名或搬移單一項目.
func (f *FS) Rename(oldPath, newPath string) error {
	oldPath, newPath = clean(oldPath), clean(newPath)

	// os.Rename 在 POSIX 上會悄悄取代既有目標, 這不符合規格:
	// 先檢查, 存在就拒絕.
	if _, err := os.Lstat(newPath); err == nil {
		return fsb.NewError(fsb.ErrAlreadyExists, "path already exists: "+newPath)
	}
	if err := os.Rename(oldPath, newPath); err != nil {
		return translate(err, oldPath)
	}
	return nil
}

// Delete 移除一個檔案或一個空目錄. 非空目錄會以 not_empty 代碼拒絕;
// 關於實作為何可以正當選擇改為遞迴刪除, 參見第 4.8 節.
func (f *FS) Delete(p string) error {
	p = clean(p)
	if err := os.Remove(p); err != nil {
		return translate(err, p)
	}
	return nil
}

// clean 把傳入的路徑正規化為內部形式: 分隔符號變成 "/",
// 結果是絕對路徑, 並移除多餘的元素.
func clean(p string) string {
	p = strings.ReplaceAll(p, `\`, "/")
	if !strings.HasPrefix(p, "/") {
		p = "/" + p
	}
	return path.Clean(p)
}

// join 把子項目名稱附加到內部形式的目錄路徑之後.
func join(dir, name string) string {
	if strings.HasSuffix(dir, "/") {
		return dir + name
	}
	return dir + "/" + name
}

// base 回傳內部路徑的最後一個元素; 根的名稱就是它自己.
func base(p string) string {
	if p == "/" {
		return "/"
	}
	return path.Base(p)
}

// isHidden 套用 POSIX 慣例: 開頭是點就隱藏該項目.
func isHidden(name string) bool {
	return strings.HasPrefix(name, ".") && name != "." && name != ".."
}

// kindOf 把檔案模式對應到介面的種類值.
func kindOf(mode fs.FileMode) fsb.Kind {
	switch {
	case mode.IsDir():
		return fsb.KindDir
	case mode.IsRegular():
		return fsb.KindFile
	case mode&fs.ModeSocket != 0:
		return fsb.KindSocket
	case mode&fs.ModeNamedPipe != 0:
		return fsb.KindFIFO
	case mode&(fs.ModeDevice|fs.ModeCharDevice) != 0:
		return fsb.KindDevice
	case mode&fs.ModeSymlink != 0:
		// 連結本身沒有自己的種類; 回報為檔案, 讓 Entry.Target
		// 描述它指向的對象.
		return fsb.KindFile
	default:
		return fsb.KindUnknown
	}
}

// translate 把作業系統的錯誤轉換成結構化錯誤.
func translate(err error, p string) error {
	if err == nil {
		return nil
	}
	switch {
	case errors.Is(err, fs.ErrNotExist):
		return fsb.NewError(fsb.ErrNotFound, "path does not exist: "+p)
	case errors.Is(err, fs.ErrPermission):
		return fsb.NewError(fsb.ErrPermissionDenied, "permission denied: "+p)
	case errors.Is(err, syscall.ENOTEMPTY):
		// 要在 fs.ErrExist 之前測試這個: POSIX 允許非空目錄的錯誤
		// 以同時也滿足 fs.ErrExist 的 EEXIST 來回報.
		return fsb.NewError(fsb.ErrNotEmpty, "directory not empty: "+p)
	case errors.Is(err, fs.ErrExist):
		return fsb.NewError(fsb.ErrAlreadyExists, "path already exists: "+p)
	}
	return fsb.NewError(fsb.ErrIO, err.Error())
}
```

### 支援 Windows 的版本要多做什麼

在 Windows 上恰好有三件事不一樣, 而且這三件事都妥善隔離在八項操作之外:

- **根的列舉. ** `Roots` 必須把每個存在的磁碟機回報為 `C:/`, `D:/` 等等, 而不是上面那個單一的 `/`.
- **路徑風格與原生路徑轉換. ** `PathStyle` 回傳 `"windows"`, 進來時有一道轉換步驟把內部形式的 `C:/foo` 轉成原生的 `C:\foo`, 出去時再轉回來. 磁碟機根在這裡是個陷阱: 原生形式必須是 `C:\`, 因為單獨的 `C:` 代表"該磁碟機上目前所在的目錄".
- **隱藏項目偵測. ** 開頭點的規則是 POSIX 的慣例; 在 Windows 上隱藏屬性是真正的檔案屬性, 必須當作屬性來讀取, 點的規則只保留作為備援.

內附的本機檔案系統實作正是把這三個關注點拆進以建置標籤區分的檔案中 -- 參見 `examples/pkg/localfs/localfs_posix.go` 與 `examples/pkg/localfs/localfs_windows.go`, 共用的八項操作則在 `examples/pkg/localfs/localfs.go`. 請複製這種拆分方式, 不要把平台分支放進操作本身裡面.

## 7. 選用能力: 複製與搬移

八項必要操作沒有一個會搬移資料, 元件也從不讀取檔案內容, 所以剪下, 複製與貼上無法建立在它們之上. 這些是選用能力: 在同一個型別上實作一或多個額外方法, 功能就會出現.

### 7.1 四個選用介面

```go
// 遞迴複製: 由實作自行走訪整棵樹.
type Copier interface {
	Copy(src, dst string, overwrite bool) error
}

// 可取消的遞迴複製: 語意相同, 多帶一個 context.
type CopierContext interface {
	CopyContext(ctx context.Context, src, dst string, overwrite bool) error
}

// 搬移: 語意與 Copy 相同, 但事後來源不再存在.
type Mover interface {
	Move(src, dst string, overwrite bool) error
}

// 可取消的搬移.
type MoverContext interface {
	MoveContext(ctx context.Context, src, dst string, overwrite bool) error
}
```

這四者的語意完全相同:

- **遞迴是實作的責任. ** 當 `src` 是目錄時, 由實作走訪整棵樹. 元件對使用者貼上的每個最上層項目, 恰好只發出一次呼叫.
- **`overwrite` 適用於每一層. ** 為 true 時, 目的地同名的既有項目會被取代 -- 不只是最上層, 走訪過程中觸及的每一層都是. 為 false 時, 已存在的目的地會回報為 `ErrAlreadyExists`, 元件接著會詢問使用者該怎麼做, 並可能以設為 true 的 `overwrite` 再呼叫一次.
- **搬移代表成功之後來源就消失了. ** 如何達成完全是實作自己的事. 在同一個檔案系統內, 重新命名通常一次就能完成整件事; 跨檔案系統時底層的重新命名會失敗, 常見的做法是複製整棵樹再刪除來源. 遠端後端也可能改為發出單一個伺服端指令. 規格本身不規定任何機制.
- **目錄對目錄是一次合併. ** 當目的地已經存在, 而且雙方都是目錄時, 把成員複製進去, 而不是整個取代目的地; 目的地有而來源沒有的項目維持不動. `overwrite` 接著會分別管控每一個成員. 單純的重新命名無法表達合併, 這正是為什麼下面的搬移實作會把每一次會覆寫的搬移都導向複製路徑.

有一個細微的遞迴風險值得防範: 在往目的地寫入任何東西之前, 先為目錄的成員清單拍一張快照. 如果寫入的同時才延遲列舉, 複製到來源自身父目錄的結果, 可能會被正在產生它的那次走訪當成成員撿走.

**即使沒有搬移能力, 剪下依然可以運作. ** 如果只實作複製而沒有實作搬移, 元件會透過跨目錄呼叫必要的 `Rename` 操作來完成剪下 -- 這正是為什麼 `Rename` 必須接受目錄不同的 `newPath` (第 4.7 節). 複製沒有這樣的備援機制, 因為八項必要操作沒有一個能夠複製資料. 這種不對稱正是為什麼單獨實作 `Mover` 沒有用: 沒有複製能力時, 元件會完全不提供剪下, 複製與貼上, 而不是提供半套剪貼簿.

### 7.2 讓操作可被取消

取消能力不必另外宣告. 橋接層 service 依是否實作了 `*Context` 版本來推斷, 這讓宣告與行為不會互相脫節: 一份實作不可能一邊宣稱支援取消, 一邊又忽略中斷請求, 因為接受 context 本身*就是*那個宣告.

對實作而言規則很簡單: 在走訪的每個節點檢查 context, 一旦它結束就原封不動回傳它的錯誤.

```go
if err := ctx.Err(); err != nil {
	return err
}
```

原封不動回傳 `ctx.Err()` 正是讓取消能被正確回報的關鍵. 橋接層 service 會在做一般分類之前, 先檢查複製與搬移的結果是否為 `context.Canceled` 與 `context.DeadlineExceeded`, 並把兩者都轉成 `canceled` 錯誤代碼. (若偏好, 自行回傳 `fsb.NewError(fsb.ErrCanceled, ...)` 也可以, 會被原樣傳遞下去 -- 但很少有理由這麼做. ) 被取消的操作一樣透過一般的錯誤路徑回報, 已完成的工作會保留下來, 不會回滾; 元件不會嘗試撤銷一次貼到一半的操作.

這個檢查幾乎不花成本, 所以可以放得大方一點: 每個節點動手前檢查一次, 走訪目錄成員的迴圈內再檢查一次, 這樣一個很大的目錄才不會在使用者按下取消之後還是跑到底.

以下檔案接續第 6 節的最小實作, 把兩個可取消能力都加到同一個型別上. 只實作 `*Context` 版本是建議的做法 -- 沒有理由同時提供一個不可取消的版本.

### `internal/myfs/myfs_copy.go`

```go
package myfs

import (
	"context"
	"errors"
	"io"
	"io/fs"
	"os"
	"syscall"

	"github.com/nexgus/fsbrowser/fsb"
)

// 編譯期證明 FS 同時滿足兩個可取消的選用介面.
var (
	_ fsb.CopierContext = (*FS)(nil)
	_ fsb.MoverContext  = (*FS)(nil)
)

// CopyContext 把 src 複製到 dst, 當 src 是目錄時走訪整棵樹.
// 走訪過程會在每個節點檢查 ctx, 所以一次很長的複製會在使用者
// 取消之後很快就停下來.
func (f *FS) CopyContext(ctx context.Context, src, dst string, overwrite bool) error {
	return f.copyPath(ctx, clean(src), clean(dst), overwrite)
}

// copyPath 複製一個節點: 目錄 (遞迴), 符號連結 (重建為連結),
// 或一般檔案.
func (f *FS) copyPath(ctx context.Context, src, dst string, overwrite bool) error {
	// 每個節點檢查一次取消. 原封不動回傳 ctx.Err() 才能讓橋接層
	// service 把這次失敗分類為 canceled 代碼.
	if err := ctx.Err(); err != nil {
		return err
	}

	info, err := os.Lstat(src)
	if err != nil {
		return translate(err, src)
	}

	switch {
	case info.Mode()&fs.ModeSymlink != 0:
		return copySymlink(src, dst, overwrite)
	case info.IsDir():
		return f.copyDir(ctx, src, dst, info, overwrite)
	case info.Mode().IsRegular():
		return copyFile(src, dst, info, overwrite)
	default:
		return fsb.NewError(fsb.ErrIO, "cannot copy special file: "+src)
	}
}

// copyDir 在 dst 重建一個目錄, 並把它的成員複製進去. 既有的目的地
// 目錄會被合併而不是取代; overwrite 接著會分別管控每一個成員.
func (f *FS) copyDir(ctx context.Context, src, dst string, srcInfo os.FileInfo, overwrite bool) error {
	dstInfo, err := os.Lstat(dst)
	switch {
	case err == nil && dstInfo.IsDir():
		// 合併進既有目錄.
	case err == nil:
		// 目的地名稱已經被別的東西佔用.
		if !overwrite {
			return fsb.NewError(fsb.ErrAlreadyExists, "path already exists: "+dst)
		}
		if err := os.RemoveAll(dst); err != nil {
			return translate(err, dst)
		}
		if err := os.Mkdir(dst, srcInfo.Mode().Perm()); err != nil {
			return translate(err, dst)
		}
	case errors.Is(err, fs.ErrNotExist):
		if err := os.Mkdir(dst, srcInfo.Mode().Perm()); err != nil {
			return translate(err, dst)
		}
	default:
		return translate(err, dst)
	}

	// 在寫入任何東西之前, 先把成員清單拍成快照. 若邊寫入邊延遲讀取
	// 目錄, 複製到來源自身父目錄的結果就可能被這次走訪撿成成員.
	children, err := os.ReadDir(src)
	if err != nil {
		return translate(err, src)
	}

	for _, child := range children {
		if err := ctx.Err(); err != nil {
			return err
		}
		name := child.Name()
		if err := f.copyPath(ctx, join(src, name), join(dst, name), overwrite); err != nil {
			return err
		}
	}
	return nil
}

// copyFile 複製一個一般檔案的內容.
func copyFile(src, dst string, srcInfo os.FileInfo, overwrite bool) error {
	dstInfo, err := os.Lstat(dst)
	switch {
	case err == nil:
		if !overwrite {
			return fsb.NewError(fsb.ErrAlreadyExists, "path already exists: "+dst)
		}
		if dstInfo.IsDir() {
			if err := os.RemoveAll(dst); err != nil {
				return translate(err, dst)
			}
		}
	case errors.Is(err, fs.ErrNotExist):
		// 沒有東西擋路.
	default:
		return translate(err, dst)
	}

	in, err := os.Open(src)
	if err != nil {
		return translate(err, src)
	}
	defer in.Close()

	out, err := os.OpenFile(dst, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, srcInfo.Mode().Perm())
	if err != nil {
		return translate(err, dst)
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return fsb.NewError(fsb.ErrIO, err.Error())
	}
	if err := out.Close(); err != nil {
		return fsb.NewError(fsb.ErrIO, err.Error())
	}
	return nil
}

// copySymlink 在 dst 重建一個指向相同目標的符號連結, 不跟隨它.
func copySymlink(src, dst string, overwrite bool) error {
	target, err := os.Readlink(src)
	if err != nil {
		return translate(err, src)
	}

	if _, err := os.Lstat(dst); err == nil {
		if !overwrite {
			return fsb.NewError(fsb.ErrAlreadyExists, "path already exists: "+dst)
		}
		if err := os.RemoveAll(dst); err != nil {
			return translate(err, dst)
		}
	} else if !errors.Is(err, fs.ErrNotExist) {
		return translate(err, dst)
	}

	if err := os.Symlink(target, dst); err != nil {
		return translate(err, dst)
	}
	return nil
}

// MoveContext 把 src 搬移到 dst. 在同一個檔案系統內, 重新命名
// 一次就能完成整件事; 跨檔案系統時 kernel 會以 EXDEV 拒絕,
// 這個實作會改用複製整棵樹再刪除來源的備援方式.
func (f *FS) MoveContext(ctx context.Context, src, dst string, overwrite bool) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	src, dst = clean(src), clean(dst)

	if _, err := os.Lstat(dst); err == nil {
		if !overwrite {
			return fsb.NewError(fsb.ErrAlreadyExists, "path already exists: "+dst)
		}
		// 重新命名無法表達"合併進既有目錄", 所以把每一次會覆寫的
		// 搬移都導向複製路徑.
		return f.moveByCopy(ctx, src, dst, overwrite)
	} else if !errors.Is(err, fs.ErrNotExist) {
		return translate(err, dst)
	}

	if err := os.Rename(src, dst); err != nil {
		if errors.Is(err, syscall.EXDEV) {
			return f.moveByCopy(ctx, src, dst, overwrite)
		}
		return translate(err, src)
	}
	return nil
}

// moveByCopy 完成一次重新命名做不到的搬移: 先複製整棵樹, 再移除
// 來源. 只有在複製成功之後才會移除來源, 所以被取消的搬移絕不會
// 毀掉它未能成功複製的資料.
func (f *FS) moveByCopy(ctx context.Context, src, dst string, overwrite bool) error {
	if err := f.copyPath(ctx, src, dst, overwrite); err != nil {
		return err
	}
	if err := os.RemoveAll(src); err != nil {
		return translate(err, src)
	}
	return nil
}
```

### 7.3 能力如何傳到 UI

不需要宣告任何東西. 橋接層 service 會對註冊的實作做型別斷言, 比對這四個選用介面, 並把結果簡化為三個旗標:

| 旗標 | 何時為 true |
|---|---|
| `canCopy` | 該實作滿足 `Copier` 或 `CopierContext` |
| `canMove` | 該實作滿足 `Mover` 或 `MoverContext` |
| `canCancel` | 該實作滿足 `CopierContext` 或 `MoverContext` |

這個斷言是每次查詢時執行, 而不是快取起來, 所以在執行期換入的實作 (第 8 節) 會在下一次查詢時就反映出來. 當一般版本與 `*Context` 版本同時存在時, 會優先採用 `*Context` 版本, 這樣 context 才會真正被傳遞下去.

前端在啟動時會查詢一次這些旗標, 並依此收斂行為:

- **沒有複製能力**: 剪下, 複製與貼上會完全消失 -- 兩個右鍵選單都會移除這三個指令, 工具列的貼上按鈕不會渲染, 三個鍵盤快速鍵也會原樣放行不攔截. 使用者永遠不會剪下一個無處可貼的東西.
- **有複製但沒有搬移**: 剪下依然可以運作, 透過第 7.1 節所述的 `Rename` 備援機制完成.
- **沒有取消能力**: 執行中的操作就是不會提供取消的操作介面.

如果能力查詢本身失敗, 三個旗標都會被當成 false. 少了一個選單項目, 總比有一個保證會失敗的選單項目要來得問題小.

由此帶來的重要結果是: 這一切都是累加式的. 一個只實作了八項必要操作的宿主, 依然能照原樣編譯與執行, 之後只要新增方法就能獲得剪貼簿功能 -- 永遠不需要更動它已經有的方法.

## 8. 註冊實作

把實作包進橋接層 service, 再把這個 service 註冊到 Wails 應用程式. 這是程式碼因為 fsbrowser 而接觸 Wails 的唯一地方.

```go
package main

import (
	"embed"
	"io/fs"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/nexgus/fsbrowser/service"

	"myapp/internal/myfs"
)

//go:embed all:frontend/dist
var distFS embed.FS

func main() {
	assets, err := fs.Sub(distFS, "frontend/dist")
	if err != nil {
		log.Fatal(err)
	}

	// 包住宿主實作的橋接層 service.
	bridge := service.New(myfs.New())

	app := application.New(application.Options{
		Name: "my-app",
		Services: []application.Service{
			application.NewService(bridge),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
	})

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:  "my-app",
		Width:  980,
		Height: 680,
		URL:    "/",
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
```

接著產生前端 bindings:

```bash
wails3 generate bindings
```

這會 (預設) 在 `frontend/bindings` 之下寫出一個對應橋接層 service 方法的模組. 前端只需匯入這個模組一次, 交給元件的 client factory; 那幾行程式碼請參見 [README](README.zh-Hant.md) 中的前端整合步驟.

之後新增選用能力並不會改變這裡的任何東西. 橋接層 service 早就已經暴露了複製與搬移, 要做的只是替型別加上方法再重新建置 -- 能力沒有另外的註冊步驟.

### 在執行期替換實作

橋接層 service 可以在應用程式執行期間換成另一個實作, 這正是宿主用來在 (比方說) 本機磁碟與剛連線上的遠端主機之間切換的方式:

```go
bridge.SetFileSystem(otherFS)
```

下一次操作就會使用新的實作; 已經在進行中的操作不受影響. 這個方法刻意不放進產生出來的 bindings -- Go 的介面無法跨越到 JavaScript -- 所以只提供給 Go 程式碼使用, 前端則只是看到自己正在瀏覽的檔案系統在底下悄悄換了.

## 9. 延伸閱讀

這個 repository 內附兩份完整實作, 兩者合起來涵蓋了真實實作常見的兩種樣貌.

- [`examples/pkg/localfs/`](../examples/pkg/localfs/) -- 完整的本機檔案系統實作, 上面的最小範例正是它的簡化版. 值得一讀的原因在於最小版本省略的兩件事: 以建置標籤拆分, 讓根的列舉, 路徑轉換與隱藏項目偵測維持平台專屬, 而八項操作維持平台中立; 以及 `localfs_copy.go` 中具生產規模的遞迴複製與搬移, 包括跨裝置備援與目錄對目錄貼上的合併語意.
- [`examples/pkg/sshfs/`](../examples/pkg/sshfs/) -- 一份包住既有連線的遠端實作. 它示範了當後端根本不是檔案系統 API 時該如何滿足這個介面: 每個操作都變成一道遠端指令, 其輸出被解析回 `Entry` 值. 它還示範了兩個值得借用的技巧 -- 依賴一個精簡的指令執行器介面, 讓整份實作不必連網就能單元測試; 以及把傳輸層失敗對應到 `disconnected` 錯誤代碼, 讓元件可以乾淨地放棄一整批操作.

關於元件的前端部分 -- 每一個設定項, 事件與 callback -- 請參見 [`docs/component-reference.zh-Hant.md`](component-reference.zh-Hant.md). 關於安裝, 整合概觀與前端套件, 請參見 [README](README.zh-Hant.md).
