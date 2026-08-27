// useBrowserStore: 把框架無關的 BrowserStore (訂閱 / 快照模式) 薄薄包成 Vue 的
// shallowRef, 供元件以 computed / 樣板直接讀取 (計劃書第 5.2 節).

import type { ShallowRef } from "vue";
import { onBeforeUnmount, shallowRef } from "vue";
import type { BrowserSnapshot, BrowserStore, BrowserStoreOptions } from "@nexgus/fsb-core";
import { createBrowserStore } from "@nexgus/fsb-core";

/** UseBrowserStoreResult 是包裝後的對外形態. */
export interface UseBrowserStoreResult {
  /** 狀態邏輯的完整操作集合. */
  store: BrowserStore;
  /** 目前快照, 隨狀態變更自動更新的 shallowRef. */
  snapshot: ShallowRef<BrowserSnapshot>;
}

/**
 * useBrowserStore 建立一個 BrowserStore 並訂閱其變更; 元件卸載時自動取消訂閱.
 * store 於呼叫當下以 options 建立一次, 不隨後續 options 變更重建 (client 與開啟參數
 * 於元件掛載期間視為固定, 與計劃書 "開啟參數" 為單次開啟設定的定位一致).
 */
export function useBrowserStore(options: BrowserStoreOptions): UseBrowserStoreResult {
  const store = createBrowserStore(options);
  const snapshot = shallowRef(store.getSnapshot());
  const unsubscribe = store.subscribe(() => {
    snapshot.value = store.getSnapshot();
  });
  onBeforeUnmount(unsubscribe);
  return { store, snapshot };
}
