// useBrowserStore: 把 core 的 createBrowserStore 以 useSyncExternalStore 訂閱 (計劃書
// 第 5.2 節: React 元件只需薄薄包一層框架繫結, 狀態邏輯完全交給 core).

import { useMemo, useRef, useSyncExternalStore } from "react";
import {
  createBrowserStore,
  type BrowserSnapshot,
  type BrowserStore,
  type BrowserStoreOptions,
} from "@nexgus/fsb-core";

/** UseBrowserStoreResult 是 hook 的回傳值: store 供呼叫操作, snapshot 為目前快照. */
export interface UseBrowserStoreResult {
  store: BrowserStore;
  snapshot: BrowserSnapshot;
}

/**
 * useBrowserStore 建立 (僅一次) 一個 BrowserStore 並訂閱其快照; options 中的 client 等
 * 建構參數只在初次掛載時生效 (與 store 的生命週期一致), 回呼函式則每次 render 皆取最新值,
 * 使呼叫端每次傳入新的函式參考時不必重建整個 store (重建會遺失瀏覽狀態).
 */
export function useBrowserStore(options: BrowserStoreOptions): UseBrowserStoreResult {
  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  const store = useMemo<BrowserStore>(() => {
    const stable: BrowserStoreOptions = {
      ...options,
      onSelect: (result) => callbacksRef.current.onSelect?.(result),
      onCancel: () => callbacksRef.current.onCancel?.(),
      onError: (error) => callbacksRef.current.onError?.(error),
    };
    return createBrowserStore(stable);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.client, options.selectionMode, options.returnMode, options.initialDir]);

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { store, snapshot };
}
