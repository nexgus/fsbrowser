# 元件參考手冊

[English](component-reference.md)

本文件是 fsbrowser (FSB) 前端套件的完整參考手冊: 涵蓋 Vue 3 與 React 元件的每一個設定項與每一個事件, 並逐一對照原始碼核實. 閱讀本文件不需要事先熟悉這個元件 -- 每個設定項都會說明選用它會如何運作, 而不只是列出型別. 若要了解元件簡介與整合步驟, 請參閱 [README](README.zh-Hant.md); 若要了解宿主 app 必須實作的 Go 端介面, 請參閱 [interface-guide.zh-Hant.md](interface-guide.zh-Hant.md).

## 1. 客戶端物件

兩個元件都只透過一個型別為 `FsbClient` (來自 `@nexgus/fsb-core`) 的 `client` 物件與宿主 app 溝通. 每個應用程式只需用 `createClient` 建立一次, 它會包裝 `wails3 generate bindings` 為 fsbrowser 橋接層 service 產生出來的模組:

```ts
import { createClient } from "@nexgus/fsb-core";
import * as bindings from "./bindings/github.com/nexgus/fsbrowser/service/service.js";

export const fsbClient = createClient(bindings);
```

`createClient` 在呼叫時會檢查 bindings 模組是否具備全部十一個必要方法 (`List`, `Stat`, `Home`, `Roots`, `PathStyle`, `MakeDir`, `Rename`, `Delete`, `Capabilities`, `Copy`, `Move`), 若有缺漏會立即拋出例外並指出缺少哪些方法 -- 讓接線錯誤在啟動時就會現形, 而不是等到使用者點擊某個東西時才爆出來.

Wails v3 的 bindings 產生器對同一個 service 可能產生兩種不同的形狀, 這個 repo 裡的範例 app 兩種都有在用:

- **直接匯入產生出來的實作檔. ** 產生器為某個 service 產生的 `index.js` 會以具名物件 (`{ Service }`) 重新匯出實作; 改匯入 `service.js` 則可直接取得 `createClient` 需要的扁平方法集合, 不必再另外拆解:

  ```ts
  import * as bindings from "./bindings/github.com/nexgus/fsbrowser/service/service.js";
  import { createClient } from "@nexgus/fsb-core";

  export const fsbClient = createClient(bindings);
  ```

- **匯入 index 檔並取出 service 物件. ** 若改匯入套件的 `index.js`, 扁平方法集合會多一層, 位於以該註冊 service 名稱命名的屬性底下:

  ```ts
  import { createClient } from "@nexgus/fsb-core";
  import * as bindings from "./bindings/github.com/nexgus/fsbrowser/service/index.js";

  export const fsbClient = createClient(bindings.Service);
  ```

兩種匯入路徑都可行; 挑一種與既有其他 bindings 的匯入方式一致即可. 不論選哪一種, 都只集中寫在應用程式裡的單一檔案 -- 前端其餘部分一律只從該檔案匯入 `fsbClient`, 不要直接匯入原始的 bindings 模組.

客戶端物件建好之後, 兩個框架各有自己的方式把它交給元件:

**Vue 3** 透過 `<FsBrowser>` 上的 `client` 設定項接收客戶端物件. 另外也有 `provide`/`inject` 的路徑 (匯出的 `fsbClientKey`), 可以一次供應給整棵子樹, 不必在每個實例上重複寫這個設定項; 兩者同時存在時以設定項優先.

```vue
<script setup lang="ts">
import { FsBrowser } from "@nexgus/fsb-vue";
import { fsbClient } from "./fsbClient.js";
</script>

<template>
  <FsBrowser :client="fsbClient" selection-mode="file" @select="onSelect" @cancel="onCancel" />
</template>
```

**React** 同樣以 `client` 設定項接收客戶端物件, 另外還提供一個專用的提供者元件 `FsbClientProvider`, 透過 context 把客戶端物件注入子樹. 兩者同時存在時一樣以設定項優先; 兩者都沒提供則會拋出例外.

```tsx
import { FsBrowser, FsbClientProvider } from "@nexgus/fsb-react";
import { fsbClient } from "./fsbClient.js";

function Picker() {
  return (
    <FsbClientProvider client={fsbClient}>
      <FsBrowser selectionMode="file" onSelect={handleSelect} onCancel={handleCancel} />
    </FsbClientProvider>
  );
}
```

在 React 中直接在 `<FsBrowser>` 上傳入 `client` 也是可行的, 不需要提供者元件:

```tsx
<FsBrowser client={fsbClient} selectionMode="file" onSelect={handleSelect} onCancel={handleCancel} />
```

## 2. 設定項

以下所有設定項都只在面板掛載時讀取一次; 之後才變更其中大多數設定項並沒有明確定義的行為, 因為面板本來就是設計成每次呼叫都重新掛載 (通常放在反覆開關的 modal 裡).

### 2.1 必填設定項

| Vue | React | 型別 | 必填 | 說明 |
|---|---|---|---|---|
| `client` | `client` | `FsbClient` | 是, 除非透過 injection/context 提供 | 與應用程式之間的橋樑; 見第 1 節. |
| `selection-mode` | `selectionMode` | `"file" \| "dir" \| "save"` | 是 | 使用者要挑選的是什麼. `"file"` 與 `"dir"` 限制哪些項目可供選取 (見 2.2 節); `"save"` 在瀏覽行為上與 `"file"` 相同, 但會多出一列檔名輸入列 (見第 5 節). |

### 2.2 選取與過濾

`selection-mode` 決定使用者*可以*選取哪些列. 在 `"dir"` 模式下, 只有目錄 (以及解析後指向目錄的符號連結) 可被選取; 一般檔案, socket, FIFO, 裝置檔與失效的連結雖然會顯示, 但無法被挑選. 在 `"file"` 與 `"save"` 模式下, 只有一般檔案 (以及解析後指向一般檔案的符號連結) 可被選取; 目錄仍可用雙擊進入, 但不能成為最終選取結果.

`return-mode` / `returnMode` (`"single" | "multiple"`, 預設為 `"single"`) 決定的是交給 `onSelect` 的結果*形狀*: 一個路徑字串, 或是一個路徑字串的陣列. 它不會改變使用者可以點選幾列 -- 不論回傳模式為何, Ctrl/Cmd 點擊與 Shift 點擊一律會擴充選取範圍, 因為批次操作 (剪下, 複製, 刪除) 即使面板最終只設定回傳一個路徑, 也需要能多列選取才好用. 回傳模式真正控制的是確認按鈕與狀態列: 在單選模式下, 只要選取超過一列就會停用確認, 狀態列也會說明原因, 直到選取範圍縮回一列為止.

`extensions` (`string[]`, 無預設值) 限制在 `"file"` 與 `"save"` 模式下哪些檔案算是可選取的; 目錄永遠不受它影響. 不符合的項目會變灰而非從清單中移除, 使用者因此仍能看見並進入只含不符合檔案的目錄. 比對規則以及開頭 `*.`/`.` 的處理方式詳見第 5 節, 該節也說明既有宿主 UI 中以分號分隔的 glob 字串該如何轉換成這個陣列.

### 2.3 呈現

| Vue | React | 型別 | 預設值 | 作用 |
|---|---|---|---|---|
| `locale` | `locale` | `LocalePack` | 內建英文 | 覆寫介面文字; 見第 9 節. |
| `theme` | `theme` | `ThemeName \| "auto" \| ThemeOverrides` | 內建淺色 | 選擇視覺配色; 見第 8 節. |
| `size-unit` | `sizeUnit` | `"si" \| "iec"` | `"si"` | 檔案大小的顯示方式: `"si"` 使用十進位單位 (kB, MB, GB, 以 1000 為底); `"iec"` 使用二進位單位 (KiB, MiB, GiB, 以 1024 為底). 純粹是外觀顯示上的差異 -- 不會改變任何位元組數, 只改變大小欄位的呈現方式. |
| `initial-dir` | `initialDir` | `string` | 客戶端物件的家目錄 | 面板開啟時所在的目錄. 不設定就會使用 `client.home()` 回傳的結果; 若想讓面板重新開啟在使用者上次離開的位置, 或想把挑選範圍限定在某個子目錄, 可以設定它 (但這只是起始位置 -- 使用者仍可導覽到客戶端物件允許的任何地方). |
| `default-name` | `defaultName` | `string` | `""` | 僅限存檔模式使用; 在 `"file"` 與 `"dir"` 模式下會被忽略. 面板開啟時預先填入檔名輸入列. 見第 5 節. |

### 2.4 完整對照表

| Vue 設定項 | React 設定項 | 型別 | 預設值 | 必填 | 說明 |
|---|---|---|---|---|---|
| `client` | `client` | `FsbClient` | -- | 是 (或透過 injection/context) | 與宿主 app 之間的橋樑; 見第 1 節. |
| `selection-mode` | `selectionMode` | `"file" \| "dir" \| "save"` | -- | 是 | 使用者要挑選哪一種項目; 同時也控制檔名輸入列 (存檔模式) 是否出現. |
| `return-mode` | `returnMode` | `"single" \| "multiple"` | `"single"` | 否 | 傳給 `onSelect` 的值是什麼形狀: 單一路徑, 或是陣列. 不限制瀏覽時可選取的列數 (見 2.2 節). |
| `locale` | `locale` | `LocalePack` | 內建英文 | 否 | 文字覆寫; 缺漏的鍵會自動回退為英文. |
| `theme` | `theme` | `ThemeName \| "auto" \| ThemeOverrides` | 內建淺色 | 否 | `"light"`, `"dark"`, `"auto"` (即時跟隨系統偏好), 或是自訂配色的局部 token 表. |
| `size-unit` | `sizeUnit` | `"si" \| "iec"` | `"si"` | 否 | 大小欄位採用十進位還是二進位單位. |
| `initial-dir` | `initialDir` | `string` | 客戶端物件的家目錄 | 否 | 起始目錄, 內部路徑形式. |
| `default-name` | `defaultName` | `string` | `""` | 否 | 僅限存檔模式: 檔名輸入列的初始內容. |
| `extensions` | `extensions` | `string[]` | 無 (不過濾) | 否 | 限制 `"file"`/`"save"` 模式下哪些檔案可選取; 在 `"dir"` 模式下被忽略. |

## 3. 事件

| Vue 事件 | React 設定項 | 引數型別 | 觸發時機 |
|---|---|---|---|
| `select` | `onSelect` | `string \| string[]` (依 `returnMode` 而定) | 使用者確認選取 (按下 Select/Save 按鈕, 在單選模式下雙擊一個可選取的項目, 或在存檔模式的檔名輸入列按 Enter), 或在存檔模式下確認覆寫. 存檔模式一律只送出單一字串, 與 `returnMode` 無關. |
| `cancel` | `onCancel` | 無 | 使用者按下 Cancel, 或宿主決定要關閉面板而呼叫 store 的 `cancel()` -- 元件本身不會自己關閉; 宿主 app 應在收到這個事件時卸載或隱藏面板. |
| `error` | `onError` | `FsbError` | 任何客戶端呼叫失敗時. 與狀態列顯示錯誤訊息是同一時刻觸發, 所以 `onError` 適合用來記錄 / 遙測, 而不是拿來重複顯示 UI -- 狀態列已經把訊息顯示給使用者看了. |
| `warning` | `onWarning` | `FsbWarning` | 目前只有一種情況會觸發: 貼上動作因為目的地是來源本身或來源的子孫而被擋下 (巢狀貼上, 見 6.2). 此事件為選用 -- 若不處理它, 使用者仍然會看到那些項目沒有任何動作發生, 只是不會有任何說明. |

### 錯誤物件 (`FsbError`)

```ts
interface FsbError {
  code: ErrorCode;      // 見下方表格
  message: string;      // 由實作端提供的人類可讀細節
  operation: FsbOperation; // "list" | "stat" | "home" | "roots" | "pathStyle" |
                             // "makeDir" | "rename" | "delete" | "capabilities" |
                             // "copy" | "move"
  path?: string;         // 該操作涉及的路徑 (若有的話)
}
```

`code` 是固定集合中的其中一個值 (`frontend/core/src/errors.ts`); 若實作回傳無法辨識的值, 會變成 `"unknown"`. `message` 是實作端自己的文字, 會以括號附註的方式顯示在該錯誤代碼內建的翻譯摘要旁邊 (見第 9 節的 `error.withDetail`).

| 代碼 | 內建英文文字 |
|---|---|
| `not_found` | Path not found. |
| `permission_denied` | Permission denied. |
| `already_exists` | The target already exists. |
| `not_empty` | The directory is not empty. |
| `disconnected` | The connection was lost. |
| `canceled` | The operation was canceled. |
| `io_error` | An input/output error occurred. |
| `unknown` | An unexpected error occurred. |

### 警告物件 (`FsbWarning`)

```ts
interface FsbWarning {
  code: "nestedPaste";       // 目前唯一的代碼
  paths: readonly string[];  // 被擋下的來源路徑
  targetDir: string;         // 觸發當下的目的地目錄
}
```

`FsbWarning` 刻意設計成一個封閉但可擴充的形狀 (一個 `code` 加上該代碼所需的資料), 這樣未來新增警告種類時, 不會破壞既有依 `code` 做分支處理的 `onWarning` 處理函式.

## 4. 選取行為

不論 `returnMode` 為何, 清單同時支援單列與多列選取:

- 單純點擊只會選取該列, 並取代之前的選取結果, 同時把它設為範圍選取的錨點.
- Ctrl 點擊 (macOS 上為 Cmd 點擊) 會把該列切換加入或移出目前的選取集合, 不影響其他項目.
- Shift 點擊會選取從上一個錨點到被點擊列之間的連續範圍. 錨點不會因為 Shift 點擊而移動, 所以連續的 Shift 點擊會一直從同一個起點延伸或縮小範圍. 範圍內被變灰的列 (被 `extensions` 過濾掉的) 會被跳過, 不會加入選取.
- 雙擊目錄 (或解析後指向目錄的符號連結) 會開啟它. 在單選模式下雙擊一個可選取的檔案, 會選取它並立即確認, 省下一次點擊.

在 `returnMode="single"` 下, 只要選取超過一列, 確認按鈕 (Select/Save) 就會停用, 狀態列會顯示 "Only one item can be confirmed.", 並持續維持這個狀態 -- 不會偷偷挑選第一個或最後一個項目. 把選取範圍縮回剛好一列 (或先歸零再選一個) 就會重新啟用確認.

`returnMode="multiple"` 只要求至少選取一列, 沒有上限.

## 5. 存檔模式與副檔名過濾

設定 `selection-mode="save"` (React 中為 `selectionMode="save"`) 會讓面板的瀏覽行為與檔案模式完全一致, 但會在清單與狀態列之間多出一列檔名輸入列. 這一列會在面板開啟時以 `default-name`/`defaultName` 預先填入 (若未提供, 則為空字串).

點擊清單中既有的檔案 (單純點擊, 或是把它加入選取的 Ctrl/Cmd 點擊) 會把該檔案的名稱寫入檔名輸入列, 覆蓋掉原本輸入的內容; 點擊目錄則只會導覽進去, 不會動到輸入列. 若 Ctrl/Cmd 點擊是把某個檔案*取消*選取, 輸入列則維持不變. 這代表檔名輸入列反映的一律是 "使用者最近一次點選的檔案", 不必然對應目前的選取集合 -- 存檔模式下的確認動作只使用檔名輸入列, 完全忽略選取集合, 即使當下因為某些其他原因 (例如面板恰好處於存檔模式時執行了一次批次刪除) 選取了好幾個項目也一樣.

確認動作 (Save 按鈕, 或在檔名輸入列按 Enter) 會驗證輸入的名稱:

- 空白 (去除前後空白後) -- 確認按鈕保持停用, 不會觸發任何事件.
- 含有路徑分隔符號, 或恰好是 `.` 或 `..`, 或者 -- 當客戶端物件回報為 Windows 路徑形式時 -- 含有 Windows 保留字元 (`< > : " | ? *`) 其中之一或控制字元 -- 輸入列會顯示 "無效字元" 的訊息, 確認按鈕維持停用.
- 命中一個既有的目錄名稱 -- 確認動作會改顯示 "已是既有目錄, 請另取名稱" 的訊息, 不會繼續進行.
- 命中一個既有的檔案名稱 -- 確認動作不會立即送出 `select`; 狀態列會改為顯示非強制型的覆寫確認 ("*name* already exists. Overwrite?"), 附上 Cancel 與 Overwrite 兩個按鈕. 只有確認那一步之後才會送出 `select`.
- 其他情況 -- `select` 立即以單一絕對路徑 (目前目錄與輸入的名稱組合而成) 觸發.

`returnMode` 在存檔模式下沒有作用: 送出的值一律是單一字串, 絕不會是陣列, 因為只有一列檔名輸入列可供確認.

不論在任何模式下, 包括存檔模式, 元件本身絕不會把任何東西寫入磁碟 -- 它只會回報使用者選了哪個路徑; 實際執行存檔是宿主 app 的責任.

### 副檔名過濾

`extensions` (一組不含符號的副檔名陣列, 例如 `["yaml", "yml"]`) 同時適用於 `"file"` 與 `"save"` 模式; 在 `"dir"` 模式下則完全被忽略. 每一個項目在使用前都會先正規化: 去除前後空白, 去掉開頭的 `*.` 或 `.`, 並以不分大小寫的方式與檔名比對 -- 因此 `"yaml"`, `".yaml"` 與 `"*.yaml"` 都是等效的輸入.

不符合的檔案會**變灰而非隱藏**: 它們仍會顯示在清單中 (使用者才不會搞不清楚某個檔案跑去哪了), 但無法被點選加入選取, 也會被 Shift 點擊的範圍選取跳過. 目錄不論是否符合, 都不會被這個過濾器變灰, 因為在目錄之間導覽不受最終要找哪種檔案影響.

在存檔模式下, 若使用者輸入的是不含副檔名的裸檔名 (開頭第一個字元是 `.`, 例如 `.bashrc`, 不算有副檔名), 且 `extensions` 非空, 元件會在送出 `select` 之前自動附加清單中的*第一個*副檔名. 若名稱本身已經帶有副檔名, 則完全照輸入的內容不變, 即使該副檔名不在清單中也一樣.

若宿主 app 目前是以單一分號分隔的 glob 字串 (例如 `*.yaml;*.yml` 這樣的樣式) 表達這種過濾條件, 請自行轉換後再傳入 `extensions`: 以 `;` 分割, 各自去除前後空白, 並捨棄空字串. 不需要自己先去掉開頭的 `*.` -- 元件本身的正規化會處理:

```ts
const extensions = filterString
  .split(";")
  .map((item) => item.trim())
  .filter((item) => item.length > 0);
```

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

## 6. 剪下, 複製與貼上

### 6.1 什麼情況下才會出現

宿主必須實作的檔案系統操作沒有任何一個能搬移或複製資料, 所以剪下 / 複製 / 貼上完全是選用功能. 宿主的 Go 實作只要額外滿足四個選用介面 (`Copier`, `CopierContext`, `Mover`, `MoverContext` -- 其簽章見 README) 其中一或多個, 就能解鎖這項功能; 橋接層 service 會偵測該實作滿足了哪些介面, 並以三個布林值回報給前端: `canCopy`, `canMove`, `canCancel`. 元件在初始化時透過 `client.capabilities()` 查詢一次, 之後在同一個面板實例的生命週期內都不會再檢查 (若宿主在執行期間換掉檔案系統實作, 又希望面板能取得新的能力, 需要重新掛載面板, 或者如果直接操作 store, 呼叫 store 的 `refreshCapabilities()`).

本節所有內容都以 `canCopy` 為第一判準. 剪下, 複製與貼上被視為同一個整體, 一榮俱榮一損俱損: 只要 `canCopy` 為否, 三者就會一併被拿掉, 不管 `canMove` 或 `canCancel` 回報什麼, 因為一個能剪下卻無處可貼的宿主等於是個半殘的功能. 具體來說, 當 `canCopy` 為否時:

- 兩個右鍵選單 (項目上的, 與清單空白處的) 都會完全省略 Cut, Copy 與 Paste -- 不是顯示成停用狀態, 而是根本不會渲染出來.
- 工具列的貼上按鈕不會渲染 (工具列其他按鈕維持原位置, 不會留下空隙).
- 三個鍵盤快速鍵 (剪下 / 複製 / 貼上) 完全不會被攔截 -- 按鍵會直接交給瀏覽器或作業系統原本的處理方式.

當 `canCopy` 為是但 `canMove` 為否時, 從使用者的角度來看剪下依然可以運作: 元件偵測到缺少搬移能力, 會改用客戶端物件既有的 `rename` 操作跨目錄完成剪下再貼上. 這個退回方案有一個值得注意的行為差異: 若退回使用 `rename` 的目的地已經存在, 元件會將此視為失敗, 而不是提供一般的覆寫提示, 因為它無法保證 `rename` 實作對既有目標會怎麼處理 (悄悄取代, 悄悄失敗, 或其他行為) -- 安全的預設做法就是不去嘗試.

`canCancel` 只有在複製或搬移真正執行時才有意義 (見 6.2); 它是依實作在 `*Context` 版本中是否接受並遵守 `context.Context` 推導出來的, 不是另外宣告的獨立旗標.

### 6.2 衝突, 取消與巢狀貼上

**進度與衝突. ** 貼上動作會一次處理剪貼簿中一個最上層項目 (絕不平行處理), 過程中會在狀態列顯示 "Copying N of M..." 或 "Moving N of M...". 在寫入每個項目之前, 元件會先檢查目的地是否已經存在同名項目:

- 若既有項目與傳入的項目種類不同 (一個是檔案, 另一個是目錄), 該項目會直接被拒絕, 不提供任何覆寫選項 -- 在這種情況下覆寫代表要用單一檔案取代整個目錄樹, 或反過來, 代價太高不該一鍵之隔就發生.
- 其他情況下, 狀態列會轉為一個只針對該項目的非強制型衝突提示: **Overwrite**, **Overwrite All**, **Skip**, **Skip All**, **Cancel**. 選擇 "All" 系列選項只會在目前這次貼上批次的剩餘部分生效 -- 不會延續到下一次觸發的貼上.

**取消. ** 複製 / 搬移進行中顯示的 Cancel 按鈕, 只有在該操作的 `canCancel` 為是時才會出現. 取消會在目前正在處理的項目處停下整個批次; 在取消之前已經完成的項目會**保留, 不會回滾** -- 元件不會嘗試復原先前已成功的操作, 因為一個誠實但不完整的結果, 總比猜測一個可能自己也會失敗的清理動作來得好. 結果會透過一般的錯誤路徑, 以 `canceled` 錯誤代碼回報. 若貼上以取消或斷線收場, 剪下用的剪貼簿內容會被保留 (不會清空), 讓使用者可以不必重新選取就重試貼上; 若剪下再貼上完整完成, 剪貼簿才會被清空. 複製用的剪貼簿內容則絕不會自動清空, 讓使用者可以再次貼上相同的項目.

**巢狀貼上. ** 貼到來源項目本身, 或貼到來源項目的任何子孫目錄, 一律會在前端完全被擋下 -- 元件甚至不會為那個項目呼叫檔案系統. 這項檢查純粹以路徑為準 (比對目的地與來源路徑, 當客戶端物件回報為 Windows 路徑形式時不分大小寫), 而不是依使用者是怎麼導覽過去的, 因為同一個目錄本來就可能有不只一條路徑可以到達. 被擋下的項目完全不會出現在狀態列的衝突或錯誤流程中; 而是等整個貼上批次結束後, 元件會呼叫一次 `onWarning`, 帶上完整的被擋來源路徑清單, 以及觸發此次阻擋的目的地目錄 (在 Vue 中即 `warning` 事件). 若沒有處理 `onWarning`, 這些項目就只會維持原狀, 使用者不會得到任何可見的說明 -- 建議任何預期使用者會嘗試這麼做的宿主都處理這個事件 (哪怕只是記錄下來, 或跳出一則提示).

**Vue 3**

```vue
<FsBrowser :client="fsbClient" ... @warning="(w) => console.warn(w.code, w.paths)" />
```

**React**

```tsx
<FsBrowser ... onWarning={(w) => console.warn(w.code, w.paths)} />
```

## 7. 鍵盤快速鍵與右鍵選單

剪下, 複製與貼上各自有對應的鍵盤快速鍵, 只有在清單本身持有鍵盤焦點時才會生效 (點擊一列, 或開啟右鍵選單, 都會把焦點移到清單上): macOS 上為 ⌘X/⌘C/⌘V, 其他平台為 Ctrl+X/Ctrl+C/Ctrl+V. 平台是從瀏覽器的 user agent 自動偵測出來的 -- 無法透過設定項調整, 因為元件對使用者實際鍵盤的了解不會比瀏覽器提供的更多. 按鍵處理本身不論偵測到的是哪個平台, 都同時接受 Meta 與 Ctrl 修飾鍵, 所以*顯示*出來的標籤即使對不上, 也絕不會影響快速鍵本身的功能, 只會影響外觀提示. 當行內編輯 (重新命名或新增資料夾) 正在進行中, 或焦點位於文字輸入框內時, 快速鍵不會被攔截 -- 此時會改由輸入框自己原生的剪下 / 複製 / 貼上接手. 如同 6.1 節所述, 當 `canCopy` 為否時, 三個快速鍵都不起作用.

**項目上的右鍵選單** (在某一列上按右鍵; 若該列原本不在選取範圍內, 右鍵點擊會先把它選取起來):

1. Copy Path -- 透過 `navigator.clipboard` 把選取的路徑 (每行一個) 以文字形式寫入系統剪貼簿.
2. *(分隔線)*
3. Cut -- 只在 `canCopy` 為是時顯示.
4. Copy -- 只在 `canCopy` 為是時顯示.
5. *(分隔線, 只有在項目 3-4 存在時才會出現)*
6. Rename -- 除非恰好選取一個項目, 否則停用.
7. Delete -- 選取超過一個項目時會顯示數量 ("Delete 3 items").

**清單空白處的右鍵選單** (在清單中任何非列的地方按右鍵):

1. New folder
2. Paste -- 只在 `canCopy` 為是**且**剪貼簿目前持有內容時顯示; 若因其他原因 (例如已有操作正在進行中) 目前無法執行貼上, 則顯示但呈現停用 (灰色).
3. *(分隔線, 只有在 Paste 存在時才會出現)*
4. Refresh
5. Show hidden -- 一個可勾選的切換開關, 反映目前隱藏檔案的顯示狀態.

**工具列**, 由左至右依序為: 上一層目錄, 家目錄, 根目錄切換器 (只有在客戶端物件回報有一個以上的根目錄時才會渲染, 例如 Windows 磁碟機代號 -- 單一根目錄的系統絕不會顯示它), 可編輯的路徑列, 新增資料夾, 貼上 (只在 `canCopy` 為是時渲染; 與選單不同, 這個按鈕的存在與否在單一 session 期間不會忽隱忽現, 因為能力只在啟動時查詢一次), 重新整理, 以及顯示 / 隱藏隱藏檔案的切換開關.

兩個右鍵選單都是面板內的浮層, 不是原生的作業系統視窗 -- 點擊外部區域或按 Escape 都會關閉它們, 且渲染範圍限定在面板自己的座標空間內.

## 8. 主題

元件內建兩套主題, `"light"` 與 `"dark"`, 另外還有一個 `"auto"` 模式, 會在面板渲染當下解析成符合作業系統 `prefers-color-scheme` 的那一套, 而且**會持續即時跟隨** -- 只要 `theme="auto"` 這個設定持續存在, 兩個框架都會訂閱該媒體查詢的變更事件, 讓使用者在 session 進行中切換作業系統外觀時, 不必重新開啟面板就能看到面板重繪. 明確傳入 `"light"` 或 `"dark"` 會固定該主題, 忽略作業系統設定.

兩套內建主題, 以及任何自訂主題, 都以一張扁平的具名字串 token 表來表示 -- 顏色, 字型堆疊, 字級大小, 以及少數幾何數值 (邊角半徑, 控制項高度, 列高, 圖示大小). 自訂主題可以是任何只包含這些 token 鍵值子集的一般物件; 省略的鍵會回退到內建淺色主題該鍵的值, 因此只想覆寫強調色之類的單一項目時, 不需要重新定義其他所有內容. 內部實作上, 每個 token 會變成一個名為 `--fsb-<kebab-case-key>` 的 CSS 自訂屬性 (例如 `accent` 這個 token 會變成 `--fsb-accent`), 作用範圍限定在面板的根元素上.

token 鍵的權威清單就是 `frontend/core/src/theme.ts` 中內建淺色主題擁有的鍵集合, 以 `THEME_KEYS` 的名稱從 `@nexgus/fsb-core` 匯出; 若要取得目前確切的完整集合, 請匯入並檢視它 (或直接讀該檔案), 因為這個集合允許隨版本增加 -- 新增的 token 都是附加性質, 不會造成破壞性變更. 截至目前為止, 其中包含 (但不限於): `appBg`, `panelBg`, `panelBorder`, `sectionBorder`, `rowBorder`, `subtleBg`, `buttonBg`, `textPrimary`, `textSecondary`, `textMuted`, `accent`, `selectedRowBg`, `errorText`, `errorBg`, `dangerBg`, `folderIcon`, `fileIcon`, `fontFamily`, `fontFamilyMono`, `fontSizeTitle`, `fontSizeRow`, `fontSizeStatus`, `fontSizeLabel`, `fontSizeMono`, `fontWeightTitle`, `radius`, `radiusPanel`, `controlHeight`, `rowHeight`, 以及 `iconSize`.

```ts
import type { ThemeOverrides } from "@nexgus/fsb-core";

const brandTheme: ThemeOverrides = {
  accent: "#a8433a",
  selectedRowBg: "#f6e3e1",
};
```

**Vue 3**

```vue
<FsBrowser :client="fsbClient" :theme="brandTheme" ... />
```

**React**

```tsx
<FsBrowser client={fsbClient} theme={brandTheme} ... />
```

## 9. 語言

元件內建英文, 在沒有提供 `locale`/`locale` 設定項時, 或提供的語言包缺漏某個文字鍵時, 都會使用英文 -- 一份不完整的翻譯仍然是有效的語言包, 缺漏處只會顯示英文, 而不是空字串或原始的鍵名. 元件不會自動從瀏覽器或作業系統偵測語言; 宿主每次呼叫時都要透過傳入 (或不傳入) 語言包來明確選擇語言.

隨核心套件一起提供的正體中文語言包, 供應方式與任何自訂語言包完全相同 -- 它在元件本身沒有任何特殊地位:

**Vue 3**

```vue
<script setup lang="ts">
import { FsBrowser } from "@nexgus/fsb-vue";
import { zhHant } from "@nexgus/fsb-locales";
</script>

<template>
  <FsBrowser :client="fsbClient" :locale="zhHant" ... />
</template>
```

**React**

```tsx
import { FsBrowser } from "@nexgus/fsb-react";
import { zhHant } from "@nexgus/fsb-locales";

<FsBrowser client={fsbClient} locale={zhHant} ... />;
```

自訂語言包是一個一般物件, 其鍵是內建英文語言包鍵集合的子集 (`LocalePack` 型別即 `Partial<Messages>`), 值則是字串, 其中有些會以 `{curlyBraces}` 的形式包含具名佔位符, 在渲染時會被替換 (例如 `"status.items": "{count} items"`). 若提供的值缺少該文字需要的佔位符, 或佔位符名稱與元件實際傳入的對不上, 該處會原樣留下字面上的 `{placeholderName}` 文字, 而不是悄悄消失, 這樣一來對不上的問題在審閱時就能看見, 而不是到了正式環境才變成一段莫名其妙的空白文字:

```ts
import type { LocalePack } from "@nexgus/fsb-core";

const myPack: LocalePack = {
  "title": "Choose a file",
  "button.cancel": "Never mind",
  "status.items": "{count} entries",
};
```

語言包可以翻譯的完整鍵集合 -- 標題, 工具列提示文字, 欄位標題, 狀態列訊息, 右鍵選單標籤, 按鈕, 錯誤摘要, 以及項目種類名稱 -- 定義在 `frontend/core/src/i18n.ts` (內建的 `en` 匯出) 中, 並以 `MESSAGE_KEYS` 的名稱從 `@nexgus/fsb-core` 重新匯出; 建立新語言包時, 該檔案就是應該拿來複製的權威清單, 因為 (與主題 token 一樣) 新的鍵會隨時間增加.

## 10. 延伸閱讀

- [interface-guide.zh-Hant.md](interface-guide.zh-Hant.md) -- 宿主 app 要實作的 Go 端介面完整指南, 包含必要的檔案系統操作, 以及第 6 節提到的選用複製 / 搬移能力.
- [README.zh-Hant.md](README.zh-Hant.md) -- 專案概覽, 整合步驟, 範例 app, 以及如何安裝前端套件.
