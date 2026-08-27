import { type BrowserSnapshot, type BrowserStore, type BrowserStoreOptions } from "@nexgus/fsb-core";
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
export declare function useBrowserStore(options: BrowserStoreOptions): UseBrowserStoreResult;
//# sourceMappingURL=useBrowserStore.d.ts.map