import type { FsbClient, FsbError, LocalePack, ReturnMode, SelectionMode, ThemeOption } from "@nexgus/fsb-core";
import type { SizeUnitSystem } from "@nexgus/fsb-core";
type __VLS_Props = {
    /** 對橋接層的呼叫介面; 未以 prop 提供時改用 provide / inject (fsbClientKey). */
    client?: FsbClient;
    /** 語言包; 未提供時使用內建英文. */
    locale?: LocalePack;
    /** theme: 內建名稱或自訂變數表; 未提供時使用內建淺色. */
    theme?: ThemeOption;
    /** 檔案大小單位制. */
    sizeUnit?: SizeUnitSystem;
    /** 選取模式: 使用者要挑的是檔案還是目錄. */
    selectionMode?: SelectionMode;
    /** 回傳模式: 單選或多選. */
    returnMode?: ReturnMode;
    /** 起始目錄; 未提供時用 client 的家目錄. */
    initialDir?: string;
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    select: (result: string | string[]) => any;
    cancel: () => any;
    error: (error: FsbError) => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onSelect?: ((result: string | string[]) => any) | undefined;
    onCancel?: (() => any) | undefined;
    onError?: ((error: FsbError) => any) | undefined;
}>, {
    client: FsbClient;
    locale: LocalePack;
    theme: ThemeOption;
    sizeUnit: SizeUnitSystem;
    selectionMode: SelectionMode;
    returnMode: ReturnMode;
    initialDir: string;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
//# sourceMappingURL=FsBrowser.vue.d.ts.map