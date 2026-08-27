import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// NewFolderRow: 建立目錄的列內編輯列, 樣式比照重新命名 (計劃書第 7.3 節).
import { useEffect, useRef } from "react";
import { IconFolder } from "./icons.js";
export function NewFolderRow({ draft, t, onChange, onCommit, onCancel }) {
    const inputRef = useRef(null);
    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);
    return (_jsxs("div", { className: "fsb-row", children: [_jsx("span", { className: "fsb-row-icon fsb-kind-dir", children: _jsx(IconFolder, {}) }), _jsx("input", { ref: inputRef, className: "fsb-row-edit-input", placeholder: t("newFolder.defaultName"), value: draft, onChange: (event) => onChange(event.target.value), onClick: (event) => event.stopPropagation(), onKeyDown: (event) => {
                    if (event.key === "Enter")
                        onCommit();
                    else if (event.key === "Escape")
                        onCancel();
                }, onBlur: onCommit }), _jsx("span", { className: "fsb-row-edit-hint", children: t("edit.hint") })] }));
}
//# sourceMappingURL=NewFolderRow.js.map