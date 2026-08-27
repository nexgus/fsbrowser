// @nexgus/fsb-vue: fsbrowser 的 Vue 3 元件套件 (計劃書第 5.2 節).
// 元件透過 core 的 FsbClient / BrowserStore 運作, 不重複實作 core 已有的邏輯.

export { default as FsBrowser } from "./components/FsBrowser.vue";
export { fsbClientKey } from "./injectionKey.js";
export { useBrowserStore } from "./useBrowserStore.js";
export type { UseBrowserStoreResult } from "./useBrowserStore.js";
