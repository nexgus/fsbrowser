# fsbrowser

[English](../README.md)

**fsbrowser** (FSB) 是一個與通訊協定無關的檔案瀏覽元件, 供 [Wails v3](https://wails.io) 桌面應用程式使用, 以一個 Go module 加上 **Vue 3** 與 **React** 兩種前端套件的形式發佈.

元件本身不認識 SSH, S3 或任何協定. 它只定義一組精簡的 Go 檔案操作介面 (列目錄, 查屬性, 家目錄, 列出根, 建立目錄, 重新命名, 刪除); 你的應用程式以既有的任何機制實作這組介面 -- SSH/SFTP 連線, 雲端 API, 本機磁碟, 或記憶體內的假檔案系統 -- 就能得到一個功能完整的檔案瀏覽 UI.

## 功能特色

- 目錄瀏覽, 以路徑為中心的導覽 (可直接輸入的路徑列, 上層 / 家目錄按鈕)
- 選取檔案或目錄, 單選或多選, 每次開啟時決定
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
import { FileBrowser } from "@nexgus/fsb-vue";
import zhHant from "@nexgus/fsb-core/locales/zh-Hant";
import { fsbClient } from "./fsbClient";
</script>

<template>
  <FileBrowser
    :client="fsbClient"
    mode="dir"
    :multiple="false"
    size-units="si"
    :locale="zhHant"
    theme="dark"
    @pick="(path) => console.log(path)"
    @cancel="close()"
    @error="(err) => console.warn(err.code, err.message)"
  />
</template>
```

**React**

```tsx
import { FsbProvider, FileBrowser } from "@nexgus/fsb-react";
import zhHant from "@nexgus/fsb-core/locales/zh-Hant";
import { fsbClient } from "./fsbClient";

function Picker() {
  return (
    <FsbProvider client={fsbClient}>
      <FileBrowser
        mode="file"
        multiple
        sizeUnits="iec"
        locale={zhHant}
        theme="light"
        onPick={(paths) => console.log(paths)}
        onCancel={() => setOpen(false)}
        onError={(err) => console.warn(err.code, err.message)}
      />
    </FsbProvider>
  );
}
```

選定結果一律是以 `/` 分隔的絕對路徑 (例如 Windows 風格檔案系統上的 `C:/Users/gus/data`); 下游若堅持要反斜線, 請自行轉換.

## 套件一覽

| 套件 | 內容 |
|---|---|
| `github.com/nexgus/fsbrowser` | Go module: 介面定義, 橋接 service, 供測試與範例用的記憶體內假檔案系統 |
| `@nexgus/fsb-core` | 框架無關的邏輯層: client 介面, 瀏覽狀態, 語言與 theme 機制, 格式化 |
| `@nexgus/fsb-vue` | Vue 3 元件 |
| `@nexgus/fsb-react` | React 元件 |

四個套件以同一個 git tag 一起發版.

## 授權

[MIT](../LICENSE.md)
