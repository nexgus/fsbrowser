import type { Translate } from "@nexgus/fsb-core";
export interface NewFolderRowProps {
    draft: string;
    t: Translate;
    onChange: (draft: string) => void;
    onCommit: () => void;
    onCancel: () => void;
}
export declare function NewFolderRow({ draft, t, onChange, onCommit, onCancel }: NewFolderRowProps): import("react").JSX.Element;
//# sourceMappingURL=NewFolderRow.d.ts.map