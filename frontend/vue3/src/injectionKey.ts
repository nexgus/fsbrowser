// client 注入用的 injection key (計劃書第 5.3 節): client 支援 prop 或
// provide / inject 兩種注入方式; 宿主亦可用本 key 以 provide 注入, 不透過 prop.

import type { InjectionKey } from "vue";
import type { FsbClient } from "@nexgus/fsb-core";

/** fsbClientKey 是 client 的 injection key. */
export const fsbClientKey: InjectionKey<FsbClient> = Symbol("fsbClient");
