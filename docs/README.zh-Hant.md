# fsbrowser

[English](../README.md)

**fsbrowser** (FSB) 是一個與通訊協定無關的檔案瀏覽元件, 供 [Wails v3](https://wails.io) 桌面應用程式使用, 以一個 Go module 加上 **Vue 3** 與 **React** 兩種前端套件的形式發佈.

元件本身不認識 SSH, S3 或任何協定. 它只定義一組精簡的 Go 檔案操作介面, 涵蓋列目錄, 查屬性, 建立, 重新命名與刪除這類尋常操作; 宿主 app 以既有的任何機制實作這組介面 -- SSH/SFTP 連線, 雲端 API, 本機磁碟, 或記憶體內的假檔案系統 -- 就能得到一個功能完整的檔案瀏覽 UI.

## 文件

| 文件 | 內容 |
|---|---|
| 本 README | 元件的功能, 各部分如何組合, 以及把它接進 Wails v3 app 的整合步驟 |
| [interface-guide.zh-Hant.md](interface-guide.zh-Hant.md) | Go 端: 完整的操作合約, 路徑與錯誤慣例, 一份可編譯的最小實作, 以及選用的複製 / 搬移能力 |
| [component-reference.zh-Hant.md](component-reference.zh-Hant.md) | 前端: 每個設定項與事件, 存檔模式, 副檔名過濾, 剪下 / 複製 / 貼上, 主題與語言 |

## 1. 功能特色

- 目錄瀏覽, 採無麵包屑, 以路徑為主的導覽方式 (可編輯的路徑列, 上層 / 家目錄按鈕)
- 選取檔案或目錄, 單選或多選, 每次開啟時決定
- 存檔模式 (`selection-mode="save"`), 供 "另存新檔" 情境使用: 瀏覽行為與檔案模式相同, 並附有檔名輸入列與非彈窗式覆寫確認; 元件本身不寫入檔案 -- 見 [元件參考手冊第 5 節](component-reference.zh-Hant.md#5-存檔模式與副檔名過濾)
- 副檔名過濾 (`extensions` 設定項), 適用於檔案模式與存檔模式: 不符過濾的檔案會淡化顯示且無法選取, 存檔模式並會為未含副檔名的檔名自動補上副檔名 -- 見 [元件參考手冊第 5 節](component-reference.zh-Hant.md#5-存檔模式與副檔名過濾)
- 目錄管理: 建立新目錄, 重新命名 (列內編輯), 刪除 (可批次, 附非彈窗式確認)
- 對選取項目進行剪下 / 複製 / 貼上 -- 非彈窗式衝突詢問 (覆寫 / 全部覆寫 / 略過 / 全部略過 / 取消), 進行中的作業可取消, 並處理斷線情形; 只有宿主 app 實作選用的複製 / 搬移能力時才會開通 -- 見 [實作檔案操作介面第 7 節](interface-guide.zh-Hant.md#7-選用能力-複製與搬移) 與 [元件參考手冊第 6 節](component-reference.zh-Hant.md#6-剪下-複製與貼上)
- 兩種右鍵選單 -- 項目上的 (複製路徑, 剪下, 複製, 重新命名, 刪除) 與空白處的 (建立新目錄, 貼上, 重新整理, 隱藏檔切換) -- 並在工具列加上貼上按鈕, 讓貼上與重新整理在列表填滿面板時仍能操作 -- 見 [元件參考手冊第 7 節](component-reference.zh-Hant.md#7-鍵盤快速鍵與右鍵選單)
- 剪下/複製/貼上的鍵盤快速鍵 (macOS 為 ⌘X/⌘C/⌘V, 其他平台為 Ctrl+X/Ctrl+C/Ctrl+V, 自動偵測), 於列表取得焦點時生效 -- 見 [元件參考手冊第 7 節](component-reference.zh-Hant.md#7-鍵盤快速鍵與右鍵選單)
- 多重根 -- Windows 磁碟機代號一般化為根切換器, 在單一根的系統上則完全不出現
- 內部路徑一律使用 `/` (磁碟機標準化為 `C:/...`); 反斜線僅是顯示層面的考量
- 可辨識連結的 icon (連結到檔案與連結到目錄有所區分), 並涵蓋 socket, FIFO, 裝置檔與失效連結
- 錯誤顯示於固定高度的狀態列 -- 版面不會跳動, 同一筆結構化錯誤同時會送交宿主 app
- 元件本身永不開啟對話框; 是否開啟視窗以及如何開啟, 全由宿主 app 決定
- 主題: 內建淺色與深色主題, 另有隨系統深淺色偏好即時切換的 "auto" 模式, 亦可用扁平的 token 表自訂主題 -- 見 [元件參考手冊第 8 節](component-reference.zh-Hant.md#8-主題)
- 語言: 內建英文, 其他語言 (含正體中文) 以語言包提供; 語言由宿主 app 於每次開啟時指定 -- 不做自動偵測 -- 見 [元件參考手冊第 9 節](component-reference.zh-Hant.md#9-語言)
- 支援 Windows 與 macOS 宿主 app

## 2. 運作方式

```
宿主 app (Go)                       fsbrowser                     宿主 app (前端)
---------------                     ---------                     --------------------
實作檔案操作介面        ------->      橋接層 service     ------->     Vue 3 / React 元件
                                     (Wails v3)                    繪製瀏覽器 UI
```

牽涉三個角色, 其中只有兩個由宿主 app 自行撰寫:

- **宿主 app 的 Go 程式碼** 實作檔案操作介面 -- 由八項必要操作構成的合約 (列目錄, 查屬性, 家目錄, 列出根, 路徑風格, 建立目錄, 重新命名, 刪除, 再加上兩項選用能力) 完整定義在 [`fsb/fsb.go`](../fsb/fsb.go), 動手寫這部分的 Go 程式碼之前, 這是唯一必讀的檔案; [實作檔案操作介面](interface-guide.zh-Hant.md) 一文會逐項說明每個操作.
- **橋接層 service**, 位於 [`fsb/service/`](../fsb/service/), 是 fsbrowser 自身的程式碼 -- 只需註冊, 不需修改. 它透過產生的 bindings 把宿主 app 的實作交給前端呼叫, 並把它回傳的任何錯誤正規化成元件預期的結構化形式.
- **宿主 app 的前端** 掛載 `@nexgus/fsb-vue` 或 `@nexgus/fsb-react` 元件, 並把以產生的 bindings 建構出來的 client 交給它 -- 這是需自行撰寫的第二個, 也是最後一個檔案.

第 3 章會依序說明這兩者.

## 3. 整合步驟

### 3.1 專案佈局

典型的 Wails v3 專案把 Go 應用程式放在 repository 根目錄, 整個前端則放在 `frontend/` 之下. `wails3 generate bindings` 預設會把輸出寫到 `frontend/bindings`, 而建置完成的前端 (`frontend/dist`) 會以 `go:embed` 內嵌進執行檔. 為 fsbrowser 新增的兩個檔案在這個佈局中的位置如下:

```
your-app/
├── go.mod
├── main.go                 # 註冊橋接層 service (application.NewService)
├── myfs.go                 # <- 需自行撰寫: fsb.FileSystem 的實作
│                           #    (寫成子套件如 internal/myfs/ 也一樣可以)
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── index.html
    ├── bindings/            # 由 `wails3 generate bindings` 產生, 不手動編輯
    │   └── github.com/nexgus/fsbrowser/fsb/service/
    └── src/
        ├── fsbClient.ts     # <- 需自行撰寫: 唯一接觸 Wails bindings 的檔案
        └── ...               # app 其餘部分, 匯入 fsbClient 使用
```

[examples/cmd/vue3/](../examples/cmd/vue3/) 與 [examples/cmd/react/](../examples/cmd/react/) 完全依循這個佈局, 可作為以下內容的實際參考.

### 3.2 後端 (Go)

**步驟 1 -- 實作介面.** 撰寫一個滿足 `fsb.FileSystem` 的型別 (定義於 [`fsb/fsb.go`](../fsb/fsb.go)):

```go
package myfs

import "github.com/nexgus/fsbrowser/fsb"

type FileSystem struct{ /* 背後接的是什麼機制都可以 */ }

func (f *FileSystem) List(dir string) ([]fsb.Entry, error) { /* ... */ }
func (f *FileSystem) Stat(path string) (fsb.Entry, error)  { /* ... */ }
// Home, Roots, PathStyle, MakeDir, Rename, Delete -- 還有五個方法

var _ fsb.FileSystem = (*FileSystem)(nil)
```

完整合約 -- 全部八個方法, 路徑與錯誤慣例, 以及一份可編譯的最小實作 -- 見 [實作檔案操作介面第 2 至 6 節](interface-guide.zh-Hant.md#2-路徑約定).

**步驟 2 -- 註冊橋接層 service**, 作法與 [`examples/cmd/vue3/main.go`](../examples/cmd/vue3/main.go) 一致:

```go
import "github.com/nexgus/fsbrowser/fsb/service"

bridge := service.New(myfs.New())

app := application.New(application.Options{
    Services: []application.Service{
        application.NewService(bridge),
    },
    // Assets, Mac 等設定
})
```

**步驟 3 -- 產生 bindings:**

```bash
wails3 generate bindings
```

### 3.3 前端

**步驟 1 -- 安裝套件.** `@nexgus/fsb-*` 套件並未上架 npm registry; 取得與參照方式見 [5.1 節](#51-前端套件安裝).

**步驟 2 -- 撰寫接線檔**, 這是前端唯一接觸 Wails bindings 的檔案:

```ts
// frontend/src/fsbClient.ts
import * as bindings from "../bindings/github.com/nexgus/fsbrowser/fsb/service/service.js";
import { createClient } from "@nexgus/fsb-core";

export const fsbClient = createClient(bindings);
```

依此檔案實際放置的位置調整相對匯入路徑. 產生的 bindings 可匯入的模組不只一個; 另一種寫法與適用時機見 [元件參考手冊第 1 節](component-reference.zh-Hant.md#1-客戶端物件).

**步驟 3 -- 掛載元件**, 傳入 `fsbClient`:

**Vue 3**

```vue
<script setup lang="ts">
import { FsBrowser } from "@nexgus/fsb-vue";
import { fsbClient } from "./fsbClient";
</script>

<template>
  <FsBrowser
    :client="fsbClient"
    selection-mode="dir"
    return-mode="single"
    @select="(path) => console.log(path)"
    @cancel="close()"
    @error="(err) => console.warn(err.code, err.message)"
  />
</template>
```

**React**

```tsx
import { FsbClientProvider, FsBrowser } from "@nexgus/fsb-react";
import { fsbClient } from "./fsbClient";

function Picker() {
  return (
    <FsbClientProvider client={fsbClient}>
      <FsBrowser
        selectionMode="file"
        returnMode="multiple"
        onSelect={(paths) => console.log(paths)}
        onCancel={() => setOpen(false)}
        onError={(err) => console.warn(err.code, err.message)}
      />
    </FsbClientProvider>
  );
}
```

以上是最常用到的設定項與事件; 完整表格 (每個設定項, 每個事件, 預設值, 與選取行為) 見 [元件參考手冊第 2 至 4 節](component-reference.zh-Hant.md#2-設定項).

### 3.4 基礎之外

- **存檔模式與副檔名過濾** 能把同一個元件變成 "另存新檔" 對話框, 並限制只能選取符合條件的檔案; 見 [元件參考手冊第 5 節](component-reference.zh-Hant.md#5-存檔模式與副檔名過濾).
- **剪下, 複製與貼上** 只要宿主 app 的 Go 實作滿足 [實作檔案操作介面第 7 節](interface-guide.zh-Hant.md#7-選用能力-複製與搬移) 所述的選用複製 / 搬移介面之一, 便會自動開通; 隨之而來的前端行為 (衝突詢問, 取消, 鍵盤快速鍵) 見 [元件參考手冊第 6 節](component-reference.zh-Hant.md#6-剪下-複製與貼上).
- **主題**, 包含內建的淺色/深色主題, "auto" 模式, 以及自訂 token 表, 見 [元件參考手冊第 8 節](component-reference.zh-Hant.md#8-主題).
- **語言**, 包含內建的語言包, 以及宿主 app 如何選定語言, 見 [元件參考手冊第 9 節](component-reference.zh-Hant.md#9-語言).

## 4. 範例

[examples/cmd/](../examples/cmd/) 內含兩個可直接執行的 Wails v3 範例 app -- `react` 與 `vue3` -- 兩者啟動時都瀏覽本機檔案系統, 並可在 app 內切換至 SSH 遠端, 示範宿主 app 如何在執行期抽換底層檔案系統.

### 4.1 前置需求

- Go
- Node.js 與 npm
- `wails3` CLI:

```bash
go install github.com/wailsapp/wails/v3/cmd/wails3@latest
```

建置腳本會先在 `PATH` 中尋找 `wails3`, 找不到時退回 `GOBIN` (或 `GOPATH/bin`), 因此只要以 `go install` 安裝, 即使未調整 `PATH` 也足夠使用.

### 4.2 建置

```bash
./build.sh
```

腳本會重新產生 Wails bindings, 於首次執行時安裝前端依賴 (只有在 `node_modules` 不存在時才執行 `npm install`), 建置前端, 並在 `examples/bin/` 為兩個 app 各自產出單一檔案的執行檔:

- `<app>-windows-amd64.exe` -- Windows amd64, 靜態連結的交叉編譯產物
- `<app>-darwin-<arch>` -- macOS, 本機架構, 相容 macOS 11 以上

### 4.3 執行

在 macOS 上, 直接執行產出的執行檔:

```bash
examples/bin/react-darwin-arm64
```

Windows 版則將 `.exe` 複製到 Windows 機器上執行; 唯一的系統需求是 WebView2 runtime, 現行的 Windows 版本皆已內建.

## 5. 套件一覽

| 套件 | 內容 |
|---|---|
| `github.com/nexgus/fsbrowser/fsb` | Go module: 介面定義與橋接層 service |
| `@nexgus/fsb-core` | 框架無關的邏輯層: client 介面, 瀏覽狀態, 語言與主題機制, 格式化 |
| `@nexgus/fsb-vue` | Vue 3 元件 |
| `@nexgus/fsb-react` | React 元件 |
| `@nexgus/fsb-locales` | 內建的語言包 (目前為正體中文); 英文不需要語言包 |

五個套件以同一個 git tag 一起發版.

### 5.1 前端套件安裝

`@nexgus/fsb-*` 套件並未發佈到 npm registry, 而是隨 [releases 頁面](https://github.com/nexgus/fsbrowser/releases) 上每個 release 附上一個 `fsbrowser.npm.<version>+<hash>.tar.gz` asset, 裡面打包了全部套件.

1. 從 releases 頁面下載 tarball, 解壓到任意位置:

   ```bash
   tar -xzf fsbrowser.npm.0.2.0+abc1234.tar.gz
   ```

2. 在宿主 app 的 `package.json` 中, 以 `file:` 依賴指向解壓出來的目錄 (依需求選擇 `react` 或 `vue3`):

   ```json
   "dependencies": {
     "@nexgus/fsb-core": "file:../fsbrowser-npm-0.2.0/core",
     "@nexgus/fsb-locales": "file:../fsbrowser-npm-0.2.0/locales",
     "@nexgus/fsb-react": "file:../fsbrowser-npm-0.2.0/react"
   }
   ```

tarball 內的套件彼此以相對的 `file:` 路徑互相依賴, 因此解壓後請保持目錄結構完整.

## 6. 授權

[MIT](../LICENSE.md)
