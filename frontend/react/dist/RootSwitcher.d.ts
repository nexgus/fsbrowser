import { type PathStyle } from "@nexgus/fsb-core";
export interface RootSwitcherProps {
    roots: readonly string[];
    currentRoot: string;
    pathStyle: PathStyle;
    disabled?: boolean;
    onSwitch: (root: string) => void;
    ariaLabel: string;
}
export declare function RootSwitcher({ roots, currentRoot, pathStyle, disabled, onSwitch, ariaLabel }: RootSwitcherProps): import("react").JSX.Element | null;
//# sourceMappingURL=RootSwitcher.d.ts.map