import { type MouseEvent as ReactMouseEvent } from "react";
import { type Entry, type PathStyle, type SizeUnitSystem, type Translate } from "@nexgus/fsb-core";
export interface RowProps {
    entry: Entry;
    selected: boolean;
    /** 是否應淡化呈現且不可選取 (存檔模式下不符副檔名過濾, 或選取模式下的目錄以外等情形, 由 core 判定). */
    dimmed: boolean;
    pathStyle: PathStyle;
    sizeUnit: SizeUnitSystem;
    t: Translate;
    editing: boolean;
    editDraft: string;
    onEditDraftChange: (draft: string) => void;
    onEditCommit: () => void;
    onEditCancel: () => void;
    onClick: (event: ReactMouseEvent) => void;
    onDoubleClick: () => void;
    onContextMenu: (event: ReactMouseEvent) => void;
}
/** Row 渲染單一項目; editing 為真時該列轉為列內重新命名編輯狀態. */
export declare function Row(props: RowProps): import("react").JSX.Element;
//# sourceMappingURL=Row.d.ts.map