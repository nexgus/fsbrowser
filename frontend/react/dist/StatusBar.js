import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// StatusBar: 底部常駐狀態列 + 動作區 (計劃書第 5.4, 7.1 節). 高度恆定, 三型態共用同一塊
// 固定空間: 中性資訊, 錯誤 (可手動關閉, 下一次成功操作自動清除), 刪除確認.
import { formatErrorText, toDisplayPath, } from "@nexgus/fsb-core";
import { IconClose, IconSpinner, IconWarning } from "./icons.js";
export function StatusBar(props) {
    const { snapshot, pathStyle, t } = props;
    // 刪除確認: 優先度最高, 取代平時的中性 / Select 動作區.
    if (snapshot.deleteConfirm !== null) {
        const count = snapshot.deleteConfirm.paths.length;
        return (_jsxs("div", { className: "fsb-statusbar", children: [_jsx("span", { className: "fsb-status-text", children: t("status.deleteConfirm", { count }) }), _jsxs("div", { className: "fsb-status-actions", children: [_jsx("button", { type: "button", className: "fsb-action-btn", onClick: props.onCancelDelete, children: t("button.cancel") }), _jsx("button", { type: "button", className: "fsb-action-btn fsb-danger", onClick: props.onConfirmDelete, children: t("button.delete") })] })] }));
    }
    if (snapshot.deleting) {
        return (_jsx("div", { className: "fsb-statusbar", children: _jsxs("span", { className: "fsb-status-text", children: [_jsx(IconSpinner, { size: 14 }), t("status.deleting", { count: props.deletingCount })] }) }));
    }
    if (snapshot.error !== null) {
        return (_jsxs("div", { className: "fsb-statusbar fsb-error", children: [_jsxs("span", { className: "fsb-status-text", children: [_jsx(IconWarning, { size: 14 }), formatErrorText(t, snapshot.error)] }), _jsx("div", { className: "fsb-status-actions", children: _jsx("button", { type: "button", className: "fsb-status-dismiss", "aria-label": t("button.dismissError"), onClick: props.onDismissError, children: _jsx(IconClose, { size: 14 }) }) })] }));
    }
    const neutralText = statusNeutralText(snapshot, pathStyle, t);
    return (_jsxs("div", { className: "fsb-statusbar", children: [_jsxs("span", { className: "fsb-status-text", children: [snapshot.loading ? _jsx(IconSpinner, { size: 14 }) : null, neutralText] }), _jsxs("div", { className: "fsb-status-actions", children: [_jsx("button", { type: "button", className: "fsb-action-btn", onClick: props.onCancelPanel, children: t("button.cancel") }), _jsx("button", { type: "button", className: "fsb-action-btn fsb-primary", disabled: !snapshot.canConfirmSelection, onClick: props.onConfirmSelection, children: t("button.select") })] })] }));
}
/** statusNeutralText 依進行中的重新命名 / 建立目錄 / 載入或選取狀態組出中性狀態文字. */
function statusNeutralText(snapshot, pathStyle, t) {
    if (snapshot.rename !== null)
        return t("status.renaming", { name: snapshot.rename.originalName });
    if (snapshot.newFolder !== null) {
        const name = snapshot.newFolder.draft.trim() || t("newFolder.defaultName");
        return t("status.creating", { name });
    }
    if (snapshot.loading)
        return t("status.loading", { path: toDisplayPath(snapshot.currentDir, pathStyle) });
    if (snapshot.selectedCount > 0) {
        return t("status.itemsSelected", { count: snapshot.itemCount, selected: snapshot.selectedCount });
    }
    return t("status.items", { count: snapshot.itemCount });
}
//# sourceMappingURL=StatusBar.js.map