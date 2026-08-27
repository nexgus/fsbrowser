import type { FsbClient, FsbError, LocalePack, ReturnMode, SelectionMode, SizeUnitSystem, ThemeOption } from "@nexgus/fsb-core";
/** FsBrowserProps 是 <FsBrowser> 的開啟參數. */
export interface FsBrowserProps {
    /** 對橋接層的呼叫介面; 未提供時取 FsbClientProvider 注入的 client, 兩者皆無視為錯誤. */
    client?: FsbClient;
    /** 語言包; 未提供時使用內建英文. */
    locale?: LocalePack;
    /** theme: 內建名稱或自訂變數表; 未提供時為內建淺色. */
    theme?: ThemeOption;
    /** 檔案大小單位制; 未提供時為 SI (十進位). */
    sizeUnit?: SizeUnitSystem;
    /** 選取模式: 使用者要挑的是檔案還是目錄. */
    selectionMode: SelectionMode;
    /** 回傳模式: 單選或多選; 未提供時為單選. */
    returnMode?: ReturnMode;
    /** 起始目錄; 未提供時用 client 的家目錄. */
    initialDir?: string;
    /** 存檔模式的預設檔名; 其他模式忽略. */
    defaultName?: string;
    /** 副檔名過濾清單 (檔案模式與存檔模式適用); 未提供時不過濾. */
    extensions?: string[];
    /** 選定結果回呼: 單選為一個路徑, 多選為路徑陣列 (皆為內部形式). */
    onSelect?: (result: string | string[]) => void;
    /** 取消回呼. */
    onCancel?: () => void;
    /** 錯誤外拋回呼 (結構化: 代碼 + 訊息 + 操作 + 路徑); 與面板內狀態列顯示同時發生. */
    onError?: (error: FsbError) => void;
}
//# sourceMappingURL=types.d.ts.map