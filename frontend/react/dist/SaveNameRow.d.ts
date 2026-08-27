import type { SaveNameIssue, Translate } from "@nexgus/fsb-core";
export interface SaveNameRowProps {
    name: string;
    issue: SaveNameIssue | null;
    t: Translate;
    onChange: (name: string) => void;
    onCommit: () => void;
}
export declare function SaveNameRow({ name, issue, t, onChange, onCommit }: SaveNameRowProps): import("react").JSX.Element;
//# sourceMappingURL=SaveNameRow.d.ts.map