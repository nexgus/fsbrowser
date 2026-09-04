// 接線檔: 唯一與 Wails 綁定的檔案 (計劃書第 5.1 節). 把 wails3 generate bindings
// 產生的模組交給 core 的 createClient, 收斂成 UI 元件唯一依賴的 FsbClient.
//
// 注意: bindings 目錄下的 index.js 只把 service.js 重新包成 { Service } 具名空間
// (Wails v3.0.0-beta.8 的產生器行為, 與 test/frontend/index.html 的驗證結果一致),
// 故此處直接匯入 service.js 取得扁平的方法集合, 而非匯入 index.
import * as bindings from "../bindings/github.com/nexgus/fsbrowser/fsb/service/service.js";
import { createClient } from "@nexgus/fsb-core";

export const fsbClient = createClient(bindings);
