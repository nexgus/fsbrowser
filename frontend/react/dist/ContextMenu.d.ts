export interface ContextMenuItem {
    key: string;
    label: string;
    disabled?: boolean;
    danger?: boolean;
    onSelect: () => void;
}
export interface ContextMenuProps {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onClose: () => void;
}
/** ContextMenu 於指定座標渲染選單, 點擊外部或按 Esc 即收合. */
export declare function ContextMenu({ x, y, items, onClose }: ContextMenuProps): import("react").JSX.Element;
//# sourceMappingURL=ContextMenu.d.ts.map