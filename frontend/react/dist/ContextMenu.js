import { jsx as _jsx } from "react/jsx-runtime";
// ContextMenu: 面板內暫態元素, 點擊外部即收合, 非視窗 (計劃書第 5.5 節).
import { useEffect, useRef } from "react";
/** ContextMenu 於指定座標渲染選單, 點擊外部或按 Esc 即收合. */
export function ContextMenu({ x, y, items, onClose }) {
    const ref = useRef(null);
    useEffect(() => {
        function handlePointerDown(event) {
            if (ref.current !== null && !ref.current.contains(event.target))
                onClose();
        }
        function handleKeyDown(event) {
            if (event.key === "Escape")
                onClose();
        }
        document.addEventListener("mousedown", handlePointerDown, true);
        document.addEventListener("keydown", handleKeyDown, true);
        return () => {
            document.removeEventListener("mousedown", handlePointerDown, true);
            document.removeEventListener("keydown", handleKeyDown, true);
        };
    }, [onClose]);
    const left = typeof window === "undefined" ? x : Math.min(x, window.innerWidth - 190);
    const top = typeof window === "undefined" ? y : Math.min(y, window.innerHeight - items.length * 32 - 16);
    return (_jsx("div", { ref: ref, className: "fsb-menu", style: { left, top }, role: "menu", children: items.map((item) => (_jsx("div", { role: "menuitem", "aria-disabled": item.disabled, className: `fsb-menu-item${item.disabled ? " fsb-disabled" : ""}${item.danger ? " fsb-danger" : ""}`, onClick: () => {
                if (item.disabled)
                    return;
                item.onSelect();
                onClose();
            }, children: _jsx("span", { children: item.label }) }, item.key))) }));
}
//# sourceMappingURL=ContextMenu.js.map