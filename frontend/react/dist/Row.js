import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Row: 列表單列, 含一般顯示與列內重新命名兩種狀態 (計劃書第 7.1, 7.3 節).
import { useEffect, useRef } from "react";
import { effectiveKind, formatDateTime, formatSize, toDisplayPath, } from "@nexgus/fsb-core";
import { EntryIcon } from "./EntryIcon.js";
/** Row 渲染單一項目; editing 為真時該列轉為列內重新命名編輯狀態. */
export function Row(props) {
    const { entry, selected, pathStyle, sizeUnit, t, editing } = props;
    const inputRef = useRef(null);
    useEffect(() => {
        if (editing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [editing]);
    const rowClass = [
        "fsb-row",
        selected ? "fsb-selected" : "",
        entry.Hidden ? "fsb-dim" : "",
    ]
        .filter(Boolean)
        .join(" ");
    if (editing) {
        return (_jsxs("div", { className: rowClass, children: [_jsx(EntryIcon, { entry: entry }), _jsx("input", { ref: inputRef, className: "fsb-row-edit-input", value: props.editDraft, onChange: (event) => props.onEditDraftChange(event.target.value), onClick: (event) => event.stopPropagation(), onKeyDown: (event) => {
                        if (event.key === "Enter")
                            props.onEditCommit();
                        else if (event.key === "Escape")
                            props.onEditCancel();
                    }, onBlur: props.onEditCommit }), _jsx("span", { className: "fsb-row-edit-hint", children: t("edit.hint") })] }));
    }
    return (_jsxs("div", { className: rowClass, onClick: props.onClick, onDoubleClick: props.onDoubleClick, onContextMenu: props.onContextMenu, title: toDisplayPath(entry.Path, pathStyle), children: [_jsx(EntryIcon, { entry: entry }), _jsx("span", { className: "fsb-row-name", children: entry.Name }), _jsx("span", { className: "fsb-row-size", children: effectiveKind(entry) === "dir" ? "" : formatSize(entry.Size, sizeUnit) }), _jsx("span", { className: "fsb-row-modified", children: formatDateTime(entry.ModTime) })] }));
}
//# sourceMappingURL=Row.js.map