# fsbrowser

[English](../README.md)

**fsbrowser** (FSB) 是一個與通訊協定無關的檔案瀏覽元件, 供 [Wails v3](https://wails.io) 桌面應用程式使用, 以一個 Go module 加上 **Vue 3** 與 **React** 兩種前端套件的形式發佈.

元件本身不認識 SSH, S3 或任何協定. 它只定義一組精簡的 Go 檔案操作介面 (列目錄, 查屬性, 家目錄, 列出根, 建立目錄, 重新命名, 刪除); 你的應用程式以既有的任何機制實作這組介面 -- SSH/SFTP 連線, 雲端 API, 本機磁碟, 或記憶體內的假檔案系統 -- 就能得到一個功能完整的檔案瀏覽 UI.

## 功能特色

- 目錄瀏覽, 以路徑為中心的導覽 (可直接輸入的路徑列, 上層 / 家目錄按鈕)
- 選取檔案或目錄, 單選或多選, 每次開啟時決定
- 存檔模式 (`selection-mode="save"`), 供 "另存新檔" 情境: 瀏覽行為與檔案模式相同, 另有檔名輸入列與非彈窗覆寫確認; 元件本身不寫檔
- 副檔名過濾 (`extensions` prop), 檔案模式與存檔模式適用: 不符過濾的檔案淡化顯示且不可選取, 存檔模式並會為未含副檔名的檔名自動補上
- 目錄整理: 建立目錄, 重新命名 (列內編輯), 刪除 (可批次, 非彈窗確認)
- 右鍵選單 (重新命名, 刪除, 複製路徑, 建立目錄, 重新整理, 隱藏檔切換)
- 多重根 -- Windows 磁碟機一般化為根切換器, 單一根的系統上完全不出現
- 內部路徑一律以 `/` 分隔 (磁碟機標準化為 `C:/...`); 反斜線僅是顯示層的事
- 可辨識連結的 icon 體系 (連結到檔案與連結到目錄一眼可辨), 並涵蓋 socket, FIFO, 裝置檔與失效連結
- 錯誤顯示在固定高度的狀態列 -- 版面永不跳動, 同一錯誤並以結構化形式送交宿主應用程式
- 永不開啟彈窗; 要不要開視窗是你的應用程式自己的決定
- Theme: 內建淺色與深色, 並可用扁平變數表自訂
- 多語: 內建英文, 其他語言 (含正體中文) 以語言包提供; 語言由宿主於每次開啟時指定, 不做自動偵測
- 支援 Windows 與 macOS 宿主

## 運作方式

```
你的 app (Go)                       fsbrowser                     你的 app (前端)
---------------                     ---------                     --------------------
實作檔案操作介面      ------->      橋接 service     ------->     Vue 3 / React 元件
                                    (Wails v3)                    繪製瀏覽器 UI
```

整合只要三步:

### 1. 實作介面並註冊 service (Go)

```go
import "github.com/nexgus/fsbrowser/service"

// myFS 實作 fsbrowser 的檔案操作介面,
// 例如包裝你既有的 SSH/SFTP 程式碼.
app := application.New(application.Options{
    Services: []application.Service{
        application.NewService(service.New(myFS)),
    },
})
```

照常產生前端 bindings:

```bash
wails3 generate bindings
```

### 2. 接上 client (前端, 每個 app 一次)

```ts
// 前端唯一接觸 Wails bindings 的檔案.
import * as bindings from "./bindings/github.com/nexgus/fsbrowser/service";
import { createClient } from "@nexgus/fsb-core";

export const fsbClient = createClient(bindings);
```

### 3. 掛上元件

**Vue 3**

```vue
<script setup lang="ts">
import { FsBrowser } from "@nexgus/fsb-vue";
import { zhHant } from "@nexgus/fsb-locales";
import { fsbClient } from "./fsbClient";
</script>

<template>
  <FsBrowser
    :client="fsbClient"
    selection-mode="dir"
    return-mode="single"
    size-unit="si"
    :locale="zhHant"
    theme="dark"
    @select="(path) => console.log(path)"
    @cancel="close()"
    @error="(err) => console.warn(err.code, err.message)"
  />
</template>
```

**React**

```tsx
import { FsbClientProvider, FsBrowser } from "@nexgus/fsb-react";
import { zhHant } from "@nexgus/fsb-locales";
import { fsbClient } from "./fsbClient";

function Picker() {
  return (
    <FsbClientProvider client={fsbClient}>
      <FsBrowser
        selectionMode="file"
        returnMode="multiple"
        sizeUnit="iec"
        locale={zhHant}
        theme="light"
        onSelect={(paths) => console.log(paths)}
        onCancel={() => setOpen(false)}
        onError={(err) => console.warn(err.code, err.message)}
      />
    </FsbClientProvider>
  );
}
```

選定結果一律是以 `/` 分隔的絕對路徑 (例如 Windows 風格檔案系統上的 `C:/Users/gus/data`); 下游若堅持要反斜線, 請自行轉換.

### 存檔模式與副檔名過濾

將 `selection-mode` 設為 `"save"` 即進入存檔模式: 面板瀏覽行為與檔案模式相同, 但固定顯示檔名輸入列, 開啟時以 `defaultName` (Vue 模板寫法為 `default-name`) 預填, 點選清單中既有檔案時也會把檔名帶入輸入列. 確定時發出與其他模式相同的 `select` 事件, 回傳單一絕對路徑 (目前目錄加檔名); 此模式下 `returnMode` 沒有意義, 一律單選. 另可加上 `extensions` (不含 "." 的副檔名陣列, 例如 `["yaml", "yml"]`) 限定檔案模式與存檔模式可選的檔案種類 -- 不符過濾的項目淡化顯示但不隱藏, 存檔模式下使用者輸入的檔名若未含副檔名, 確定時會自動補上清單第一個副檔名. 若宿主現行的過濾字串是 `*.yaml;*.yml` 這類以分號分隔的 glob 格式, 只需以分號 split 成陣列傳入即可, 元件會自行剝除開頭的 `*.`.

**Vue 3**

```vue
<FsBrowser
  :client="fsbClient"
  selection-mode="save"
  default-name="report.yaml"
  :extensions="['yaml', 'yml']"
  @select="(path) => saveTo(path)"
  @cancel="close()"
  @error="(err) => console.warn(err.code, err.message)"
/>
```

**React**

```tsx
<FsBrowser
  selectionMode="save"
  defaultName="report.yaml"
  extensions={["yaml", "yml"]}
  onSelect={(path) => saveTo(path as string)}
  onCancel={() => setOpen(false)}
  onError={(err) => console.warn(err.code, err.message)}
/>
```

## 範例

[examples/cmd/](../examples/cmd/) 內含兩個可直接執行的 Wails v3 範例 app -- `react` 與 `vue3` -- 啟動時瀏覽本機檔案系統, 並可於 app 內切換至 SSH 遠端, 示範宿主 app 如何在執行期抽換底層檔案系統.

### 前置需求

- Go
- Node.js 與 npm
- `wails3` CLI:

```bash
go install github.com/wailsapp/wails/v3/cmd/wails3@latest
```

建置腳本會先在 `PATH` 中尋找 `wails3`, 找不到時退回 `GOBIN` (未設定時為 `GOPATH/bin`), 因此以 `go install` 安裝後即使未調整 `PATH` 也能使用.

### 建置

```bash
examples/build.sh
```

腳本會重新產生 Wails bindings, 首次執行時安裝前端依賴 (僅在 `node_modules` 不存在時執行 `npm install`), 建置前端, 並在 `examples/bin/` 產出兩個 app 各自的單一執行檔:

- `<app>-windows-amd64.exe` -- Windows amd64, 靜態連結交叉編譯
- `<app>-darwin-<arch>` -- macOS 本機架構, 相容 macOS 11 以上

### 執行

macOS 上直接執行產出的執行檔:

```bash
examples/bin/react-darwin-arm64
```

Windows 版則將 `.exe` 複製到 Windows 機器上直接執行; 系統需求僅有 WebView2 runtime, 現行 Windows 版本皆已內建.

## 套件一覽

| 套件 | 內容 |
|---|---|
| `github.com/nexgus/fsbrowser` | Go module: 介面定義, 橋接 service, 供測試與範例用的記憶體內假檔案系統 |
| `@nexgus/fsb-core` | 框架無關的邏輯層: client 介面, 瀏覽狀態, 語言與 theme 機制, 格式化 |
| `@nexgus/fsb-vue` | Vue 3 元件 |
| `@nexgus/fsb-react` | React 元件 |

四個套件以同一個 git tag 一起發版.

### 安裝前端套件

`@nexgus/fsb-*` 套件並未發佈到 npm registry; 每個 release 都會在 [releases 頁面](https://github.com/nexgus/fsbrowser/releases)附上一個 `fsbrowser.npm.<版本>+<hash>.tar.gz` asset, 內含全部前端套件.

1. 從 releases 頁面下載 tarball, 解壓到任意位置:

   ```bash
   tar -xzf fsbrowser.npm.0.2.0+abc1234.tar.gz
   ```

2. 在應用程式的 `package.json` 以 `file:` 依賴指向解壓出來的目錄 (依需求選 `react` 或 `vue3`):

   ```json
   "dependencies": {
     "@nexgus/fsb-core": "file:../fsbrowser-npm-0.2.0/core",
     "@nexgus/fsb-locales": "file:../fsbrowser-npm-0.2.0/locales",
     "@nexgus/fsb-react": "file:../fsbrowser-npm-0.2.0/react"
   }
   ```

tarball 內的套件之間以相對 `file:` 路徑互相依賴, 解壓後請保持目錄結構完整.

## 授權

[MIT](../LICENSE.md)
