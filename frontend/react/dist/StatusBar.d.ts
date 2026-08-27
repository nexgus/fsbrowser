import { type BrowserSnapshot, type PathStyle, type Translate } from "@nexgus/fsb-core";
export interface StatusBarProps {
    snapshot: BrowserSnapshot;
    pathStyle: PathStyle;
    t: Translate;
    /** 觸發刪除確認當下的項目數, 供 "正在刪除中" 文字使用 (刪除確認關閉後 snapshot 已無法得知該數字). */
    deletingCount: number;
    onDismissError: () => void;
    onCancelPanel: () => void;
    onConfirmSelection: () => void;
    onConfirmDelete: () => void;
    onCancelDelete: () => void;
}
export declare function StatusBar(props: StatusBarProps): import("react").JSX.Element;
//# sourceMappingURL=StatusBar.d.ts.map