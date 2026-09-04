// 宿主 app 內唯一與 Wails 綁定的檔案 (計劃書第 5.1 節接線方式).
import { createClient } from "@nexgus/fsb-core";
import * as bindings from "../bindings/github.com/nexgus/fsbrowser/fsb/service/index.js";

export const fsbClient = createClient(bindings.Service);
