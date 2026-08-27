import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// RootSwitcher: 工具列內的根切換下拉 (計劃書第 7.1, 7.3 節). 實作回報的根多於一個時才
// 出現 (例如 Windows 磁碟機); 單一根時完全不渲染, 元件內沒有任何 Windows 特例判斷.
import { useEffect, useRef, useState } from "react";
import { toDisplayPath } from "@nexgus/fsb-core";
import { IconCheck, IconChevronDown } from "./icons.js";
/** rootLabel 把根路徑轉為顯示用簡短名稱 (例如 "C:/" 顯示為 "C:"). */
function rootLabel(root, style) {
    const display = toDisplayPath(root, style);
    return display.length > 1 && (display.endsWith("/") || display.endsWith("\\"))
        ? display.slice(0, -1)
        : display;
}
export function RootSwitcher({ roots, currentRoot, pathStyle, disabled, onSwitch, ariaLabel }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        if (!open)
            return;
        function handlePointerDown(event) {
            if (ref.current !== null && !ref.current.contains(event.target))
                setOpen(false);
        }
        document.addEventListener("mousedown", handlePointerDown, true);
        return () => document.removeEventListener("mousedown", handlePointerDown, true);
    }, [open]);
    if (roots.length <= 1)
        return null;
    return (_jsxs("div", { className: "fsb-root-switcher", ref: ref, children: [_jsxs("button", { type: "button", className: "fsb-root-switcher-btn", "aria-label": ariaLabel, disabled: disabled, onClick: () => setOpen((value) => !value), children: [_jsx("span", { children: rootLabel(currentRoot, pathStyle) }), _jsx(IconChevronDown, { size: 12 })] }), open ? (_jsx("div", { className: "fsb-root-menu", role: "menu", children: roots.map((root) => {
                    const current = root === currentRoot;
                    return (_jsxs("div", { role: "menuitem", className: `fsb-root-menu-item${current ? " fsb-current" : ""}`, onClick: () => {
                            setOpen(false);
                            if (!current)
                                onSwitch(root);
                        }, children: [_jsx("span", { className: "fsb-root-menu-item-check", children: current ? _jsx(IconCheck, { size: 12 }) : null }), _jsx("span", { children: rootLabel(root, pathStyle) })] }, root));
                }) })) : null] }));
}
//# sourceMappingURL=RootSwitcher.js.map