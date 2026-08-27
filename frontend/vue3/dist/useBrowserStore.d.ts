import type { ShallowRef } from "vue";
import type { BrowserSnapshot, BrowserStore, BrowserStoreOptions } from "@nexgus/fsb-core";
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
export declare function useBrowserStore(options: BrowserStoreOptions): UseBrowserStoreResult;
//# sourceMappingURL=useBrowserStore.d.ts.map