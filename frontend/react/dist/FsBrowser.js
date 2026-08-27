import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// FsBrowser: 瀏覽面板主元件 (計劃書第 5, 7 章). 版面五段結構由上而下: 標題列, 工具列,
// 欄位標頭, 列表, 狀態列 + 動作區. 所有狀態邏輯經 useBrowserStore 交給 core 的
// BrowserStore 處理, 本檔只負責畫面呈現與輸入事件轉呼叫.
import { useEffect, useMemo, useRef, useState } from "react";
import { createTranslator, fromDisplayPath, isDirectoryLike, isSelectableAs, resolveTheme, themeToCssVars, toDisplayPath, } from "@nexgus/fsb-core";
import { useFsbClientContext } from "./context.js";
import { useBrowserStore } from "./useBrowserStore.js";
import { FSB_STYLE_CSS } from "./styles.js";
import { RootSwitcher } from "./RootSwitcher.js";
import { Row } from "./Row.js";
import { NewFolderRow } from "./NewFolderRow.js";
import { SaveNameRow } from "./SaveNameRow.js";
import { StatusBar } from "./StatusBar.js";
import { ContextMenu } from "./ContextMenu.js";
import { IconEye, IconEmptyFolder, IconHome, IconNewFolder, IconUp } from "./icons.js";
const SKELETON_ROWS = 6;
/** FsBrowser 是套件對外的瀏覽面板元件. */
export function FsBrowser(props) {
    const contextClient = useFsbClientContext();
    const client = props.client ?? contextClient ?? undefined;
    if (client === undefined) {
        throw new Error("<FsBrowser>: 未提供 client, 請以 prop 傳入 client, 或以 <FsbClientProvider> 注入.");
    }
    const t = useMemo(() => createTranslator(props.locale), [props.locale]);
    const theme = useMemo(() => resolveTheme(props.theme), [props.theme]);
    const cssVars = useMemo(() => themeToCssVars(theme), [theme]);
    const sizeUnit = props.sizeUnit ?? "si";
    const selectionMode = props.selectionMode;
    const { store, snapshot } = useBrowserStore({
        client,
        selectionMode,
        returnMode: props.returnMode,
        initialDir: props.initialDir,
        defaultName: props.defaultName,
        extensions: props.extensions,
        onSelect: props.onSelect,
        onCancel: props.onCancel,
        onError: props.onError,
    });
    useEffect(() => {
        void store.init();
    }, [store]);
    const [pathDraft, setPathDraft] = useState("");
    const pathFocusedRef = useRef(false);
    useEffect(() => {
        if (!pathFocusedRef.current)
            setPathDraft(toDisplayPath(snapshot.currentDir, snapshot.pathStyle));
    }, [snapshot.currentDir, snapshot.pathStyle]);
    const [menu, setMenu] = useState(null);
    const deletingCountRef = useRef(0);
    function commitPath() {
        const target = fromDisplayPath(pathDraft);
        if (target !== "")
            void store.navigateTo(target);
    }
    function copyPath() {
        const text = store.copyPathText();
        if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(text).catch(() => undefined);
        }
    }
    function handleRowClick(entry, event) {
        if (event.shiftKey)
            store.selectRange(entry.Path);
        else if (event.metaKey || event.ctrlKey)
            store.toggleSelection(entry.Path);
        else
            store.selectOnly(entry.Path);
    }
    function handleRowDoubleClick(entry) {
        if (isDirectoryLike(entry)) {
            void store.openEntry(entry.Path);
            return;
        }
        if (isSelectableAs(entry, selectionMode)) {
            store.selectOnly(entry.Path);
            store.confirmSelection();
        }
    }
    function handleRowContextMenu(entry, event) {
        event.preventDefault();
        event.stopPropagation();
        if (!store.getSnapshot().selection.includes(entry.Path))
            store.selectOnly(entry.Path);
        const selection = store.getSnapshot().selection;
        setMenu({
            x: event.clientX,
            y: event.clientY,
            items: [
                {
                    key: "rename",
                    label: t("menu.rename"),
                    disabled: selection.length !== 1,
                    onSelect: () => store.beginRename(entry.Path),
                },
                {
                    key: "delete",
                    label: selection.length > 1 ? t("menu.deleteCount", { count: selection.length }) : t("menu.delete"),
                    danger: true,
                    onSelect: () => store.requestDelete(),
                },
                { key: "copyPath", label: t("menu.copyPath"), onSelect: copyPath },
            ],
        });
    }
    function handleListContextMenu(event) {
        event.preventDefault();
        setMenu({
            x: event.clientX,
            y: event.clientY,
            items: [
                { key: "newFolder", label: t("menu.newFolder"), onSelect: () => store.beginNewFolder() },
                { key: "refresh", label: t("menu.refresh"), onSelect: () => void store.refresh() },
                { key: "showHidden", label: t("menu.showHidden"), onSelect: () => store.toggleHidden() },
            ],
        });
    }
    function handleConfirmDelete() {
        deletingCountRef.current = snapshot.deleteConfirm?.paths.length ?? 0;
        void store.confirmDelete();
    }
    const busy = snapshot.loading || snapshot.deleting || snapshot.rename !== null || snapshot.newFolder !== null;
    return (_jsxs("div", { className: "fsb-root", style: cssVars, onContextMenu: (event) => event.preventDefault(), children: [_jsx("style", { children: FSB_STYLE_CSS }), _jsxs("div", { className: "fsb-titlebar", children: [_jsx("span", { className: "fsb-title", children: t("title") }), _jsx("span", { className: "fsb-mode-hint", children: selectionMode === "dir" ? t("mode.dir") : selectionMode === "save" ? t("mode.save") : t("mode.file") })] }), _jsxs("div", { className: "fsb-toolbar", children: [_jsx("button", { type: "button", className: "fsb-btn", "aria-label": t("toolbar.up"), title: t("toolbar.up"), disabled: busy || snapshot.atRoot, onClick: () => void store.goUp(), children: _jsx(IconUp, {}) }), _jsx("button", { type: "button", className: "fsb-btn", "aria-label": t("toolbar.home"), title: t("toolbar.home"), disabled: busy, onClick: () => void store.goHome(), children: _jsx(IconHome, {}) }), _jsx(RootSwitcher, { roots: snapshot.roots, currentRoot: snapshot.currentRoot, pathStyle: snapshot.pathStyle, disabled: busy, ariaLabel: t("toolbar.root"), onSwitch: (root) => void store.switchRoot(root) }), _jsx("input", { className: "fsb-path-input", value: pathDraft, placeholder: t("toolbar.pathPlaceholder"), disabled: snapshot.loading, onFocus: () => {
                            pathFocusedRef.current = true;
                        }, onChange: (event) => setPathDraft(event.target.value), onKeyDown: (event) => {
                            if (event.key === "Enter") {
                                commitPath();
                                event.currentTarget.blur();
                            }
                            else if (event.key === "Escape") {
                                setPathDraft(toDisplayPath(snapshot.currentDir, snapshot.pathStyle));
                                event.currentTarget.blur();
                            }
                        }, onBlur: () => {
                            pathFocusedRef.current = false;
                            setPathDraft(toDisplayPath(snapshot.currentDir, snapshot.pathStyle));
                        } }), _jsx("button", { type: "button", className: "fsb-btn", "aria-label": t("toolbar.newFolder"), title: t("toolbar.newFolder"), disabled: busy, onClick: () => store.beginNewFolder(), children: _jsx(IconNewFolder, {}) }), _jsx("button", { type: "button", className: `fsb-btn${snapshot.showHidden ? " fsb-btn-active" : ""}`, "aria-label": snapshot.showHidden ? t("toolbar.hideHidden") : t("toolbar.showHidden"), title: snapshot.showHidden ? t("toolbar.hideHidden") : t("toolbar.showHidden"), disabled: busy, onClick: () => store.toggleHidden(), children: _jsx(IconEye, { crossed: !snapshot.showHidden }) })] }), _jsxs("div", { className: "fsb-columns", children: [_jsx("span", { className: "fsb-col-name", children: t("column.name") }), _jsx("span", { className: "fsb-col-size", children: t("column.size") }), _jsx("span", { className: "fsb-col-modified", children: t("column.modified") })] }), _jsx("div", { className: "fsb-list", onContextMenu: handleListContextMenu, children: snapshot.loading ? (Array.from({ length: SKELETON_ROWS }, (_, index) => (_jsxs("div", { className: "fsb-skeleton-row", children: [_jsx("span", { className: "fsb-skeleton-block", style: { width: 16 } }), _jsx("span", { className: "fsb-skeleton-block", style: { width: `${40 + (index % 3) * 15}%` } })] }, index)))) : snapshot.entries.length === 0 && snapshot.newFolder === null ? (_jsxs("div", { className: "fsb-empty", children: [_jsx("span", { className: "fsb-empty-icon", children: _jsx(IconEmptyFolder, {}) }), _jsx("span", { className: "fsb-empty-title", children: t("empty.title") }), _jsx("span", { className: "fsb-empty-hint", children: t("empty.hint") })] })) : (_jsxs(_Fragment, { children: [snapshot.newFolder !== null ? (_jsx(NewFolderRow, { draft: snapshot.newFolder.draft, t: t, onChange: (draft) => store.setNewFolderDraft(draft), onCommit: () => void store.commitNewFolder(), onCancel: () => store.cancelNewFolder() })) : null, snapshot.entries.map((entry) => (_jsx(Row, { entry: entry, selected: snapshot.selection.includes(entry.Path), dimmed: store.isEntryDimmed(entry), pathStyle: snapshot.pathStyle, sizeUnit: sizeUnit, t: t, editing: snapshot.rename !== null && snapshot.rename.path === entry.Path, editDraft: snapshot.rename !== null && snapshot.rename.path === entry.Path ? snapshot.rename.draft : "", onEditDraftChange: (draft) => store.setRenameDraft(draft), onEditCommit: () => void store.commitRename(), onEditCancel: () => store.cancelRename(), onClick: (event) => handleRowClick(entry, event), onDoubleClick: () => handleRowDoubleClick(entry), onContextMenu: (event) => handleRowContextMenu(entry, event) }, entry.Path)))] })) }), selectionMode === "save" ? (_jsx(SaveNameRow, { name: snapshot.saveName, issue: snapshot.saveNameIssue, t: t, onChange: (name) => store.setSaveName(name), onCommit: () => store.confirmSelection() })) : null, _jsx(StatusBar, { snapshot: snapshot, pathStyle: snapshot.pathStyle, selectionMode: selectionMode, t: t, deletingCount: deletingCountRef.current, onDismissError: () => store.dismissError(), onCancelPanel: () => store.cancel(), onConfirmSelection: () => store.confirmSelection(), onConfirmDelete: handleConfirmDelete, onCancelDelete: () => store.cancelDelete(), onConfirmOverwrite: () => void store.confirmOverwrite(), onCancelOverwrite: () => store.cancelOverwrite() }), menu !== null ? _jsx(ContextMenu, { x: menu.x, y: menu.y, items: menu.items, onClose: () => setMenu(null) }) : null] }));
}
//# sourceMappingURL=FsBrowser.js.map