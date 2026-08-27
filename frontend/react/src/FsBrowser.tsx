// FsBrowser: 瀏覽面板主元件 (計劃書第 5, 7 章). 版面五段結構由上而下: 標題列, 工具列,
// 欄位標頭, 列表, 狀態列 + 動作區. 所有狀態邏輯經 useBrowserStore 交給 core 的
// BrowserStore 處理, 本檔只負責畫面呈現與輸入事件轉呼叫.

import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import {
  createTranslator,
  fromDisplayPath,
  isDirectoryLike,
  isSelectableAs,
  resolveTheme,
  subscribeSystemTheme,
  themeToCssVars,
  toDisplayPath,
  type Entry,
} from "@nexgus/fsb-core";
import { useFsbClientContext } from "./context.js";
import { useBrowserStore } from "./useBrowserStore.js";
import type { FsBrowserProps } from "./types.js";
import { FSB_STYLE_CSS } from "./styles.js";
import { RootSwitcher } from "./RootSwitcher.js";
import { Row } from "./Row.js";
import { NewFolderRow } from "./NewFolderRow.js";
import { SaveNameRow } from "./SaveNameRow.js";
import { StatusBar } from "./StatusBar.js";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu.js";
import { IconEye, IconEmptyFolder, IconHome, IconNewFolder, IconUp } from "./icons.js";

interface MenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

const SKELETON_ROWS = 6;

/** FsBrowser 是套件對外的瀏覽面板元件. */
export function FsBrowser(props: FsBrowserProps) {
  const contextClient = useFsbClientContext();
  const client = props.client ?? contextClient ?? undefined;
  if (client === undefined) {
    throw new Error(
      "<FsBrowser>: 未提供 client, 請以 prop 傳入 client, 或以 <FsbClientProvider> 注入.",
    );
  }

  const t = useMemo(() => createTranslator(props.locale), [props.locale]);

  // theme 為 "auto" 時訂閱系統深淺色偏好, 變更時以 tick 觸發重新解析.
  const [systemThemeTick, setSystemThemeTick] = useState(0);
  useEffect(() => {
    if (props.theme !== "auto") return;
    const unsubscribe = subscribeSystemTheme(() => setSystemThemeTick((tick) => tick + 1));
    return unsubscribe;
  }, [props.theme]);

  const theme = useMemo(() => resolveTheme(props.theme), [props.theme, systemThemeTick]);
  const cssVars = useMemo(() => themeToCssVars(theme) as CSSProperties, [theme]);
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
    if (!pathFocusedRef.current) setPathDraft(toDisplayPath(snapshot.currentDir, snapshot.pathStyle));
  }, [snapshot.currentDir, snapshot.pathStyle]);

  const [menu, setMenu] = useState<MenuState | null>(null);
  const deletingCountRef = useRef(0);

  function commitPath(): void {
    const target = fromDisplayPath(pathDraft);
    if (target !== "") void store.navigateTo(target);
  }

  function copyPath(): void {
    const text = store.copyPathText();
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => undefined);
    }
  }

  function handleRowClick(entry: Entry, event: ReactMouseEvent): void {
    if (event.shiftKey) store.selectRange(entry.Path);
    else if (event.metaKey || event.ctrlKey) store.toggleSelection(entry.Path);
    else store.selectOnly(entry.Path);
  }

  function handleRowDoubleClick(entry: Entry): void {
    if (isDirectoryLike(entry)) {
      void store.openEntry(entry.Path);
      return;
    }
    if (isSelectableAs(entry, selectionMode)) {
      store.selectOnly(entry.Path);
      store.confirmSelection();
    }
  }

  function handleRowContextMenu(entry: Entry, event: ReactMouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!store.getSnapshot().selection.includes(entry.Path)) store.selectOnly(entry.Path);
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
          label:
            selection.length > 1 ? t("menu.deleteCount", { count: selection.length }) : t("menu.delete"),
          danger: true,
          onSelect: () => store.requestDelete(),
        },
        { key: "copyPath", label: t("menu.copyPath"), onSelect: copyPath },
      ],
    });
  }

  function handleListContextMenu(event: ReactMouseEvent): void {
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

  function handleConfirmDelete(): void {
    deletingCountRef.current = snapshot.deleteConfirm?.paths.length ?? 0;
    void store.confirmDelete();
  }

  const busy = snapshot.loading || snapshot.deleting || snapshot.rename !== null || snapshot.newFolder !== null;

  return (
    <div className="fsb-root" style={cssVars} onContextMenu={(event) => event.preventDefault()}>
      <style>{FSB_STYLE_CSS}</style>

      <div className="fsb-titlebar">
        <span className="fsb-title">{t("title")}</span>
        <span className="fsb-mode-hint">
          {selectionMode === "dir" ? t("mode.dir") : selectionMode === "save" ? t("mode.save") : t("mode.file")}
        </span>
      </div>

      <div className="fsb-toolbar">
        <button
          type="button"
          className="fsb-btn"
          aria-label={t("toolbar.up")}
          title={t("toolbar.up")}
          disabled={busy || snapshot.atRoot}
          onClick={() => void store.goUp()}
        >
          <IconUp />
        </button>
        <button
          type="button"
          className="fsb-btn"
          aria-label={t("toolbar.home")}
          title={t("toolbar.home")}
          disabled={busy}
          onClick={() => void store.goHome()}
        >
          <IconHome />
        </button>
        <RootSwitcher
          roots={snapshot.roots}
          currentRoot={snapshot.currentRoot}
          pathStyle={snapshot.pathStyle}
          disabled={busy}
          ariaLabel={t("toolbar.root")}
          onSwitch={(root) => void store.switchRoot(root)}
        />
        <input
          className="fsb-path-input"
          value={pathDraft}
          placeholder={t("toolbar.pathPlaceholder")}
          disabled={snapshot.loading}
          onFocus={() => {
            pathFocusedRef.current = true;
          }}
          onChange={(event) => setPathDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commitPath();
              event.currentTarget.blur();
            } else if (event.key === "Escape") {
              setPathDraft(toDisplayPath(snapshot.currentDir, snapshot.pathStyle));
              event.currentTarget.blur();
            }
          }}
          onBlur={() => {
            pathFocusedRef.current = false;
            setPathDraft(toDisplayPath(snapshot.currentDir, snapshot.pathStyle));
          }}
        />
        <button
          type="button"
          className="fsb-btn"
          aria-label={t("toolbar.newFolder")}
          title={t("toolbar.newFolder")}
          disabled={busy}
          onClick={() => store.beginNewFolder()}
        >
          <IconNewFolder />
        </button>
        <button
          type="button"
          className={`fsb-btn${snapshot.showHidden ? " fsb-btn-active" : ""}`}
          aria-label={snapshot.showHidden ? t("toolbar.hideHidden") : t("toolbar.showHidden")}
          title={snapshot.showHidden ? t("toolbar.hideHidden") : t("toolbar.showHidden")}
          disabled={busy}
          onClick={() => store.toggleHidden()}
        >
          <IconEye crossed={!snapshot.showHidden} />
        </button>
      </div>

      <div className="fsb-columns">
        <span className="fsb-col-name">{t("column.name")}</span>
        <span className="fsb-col-size">{t("column.size")}</span>
        <span className="fsb-col-modified">{t("column.modified")}</span>
      </div>

      <div className="fsb-list" onContextMenu={handleListContextMenu}>
        {snapshot.loading ? (
          Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <div className="fsb-skeleton-row" key={index}>
              <span className="fsb-skeleton-block" style={{ width: 16 }} />
              <span className="fsb-skeleton-block" style={{ width: `${40 + (index % 3) * 15}%` }} />
            </div>
          ))
        ) : snapshot.entries.length === 0 && snapshot.newFolder === null ? (
          <div className="fsb-empty">
            <span className="fsb-empty-icon">
              <IconEmptyFolder />
            </span>
            <span className="fsb-empty-title">{t("empty.title")}</span>
            <span className="fsb-empty-hint">{t("empty.hint")}</span>
          </div>
        ) : (
          <>
            {snapshot.newFolder !== null ? (
              <NewFolderRow
                draft={snapshot.newFolder.draft}
                t={t}
                onChange={(draft) => store.setNewFolderDraft(draft)}
                onCommit={() => void store.commitNewFolder()}
                onCancel={() => store.cancelNewFolder()}
              />
            ) : null}
            {snapshot.entries.map((entry) => (
              <Row
                key={entry.Path}
                entry={entry}
                selected={snapshot.selection.includes(entry.Path)}
                dimmed={store.isEntryDimmed(entry)}
                pathStyle={snapshot.pathStyle}
                sizeUnit={sizeUnit}
                t={t}
                editing={snapshot.rename !== null && snapshot.rename.path === entry.Path}
                editDraft={snapshot.rename !== null && snapshot.rename.path === entry.Path ? snapshot.rename.draft : ""}
                onEditDraftChange={(draft) => store.setRenameDraft(draft)}
                onEditCommit={() => void store.commitRename()}
                onEditCancel={() => store.cancelRename()}
                onClick={(event) => handleRowClick(entry, event)}
                onDoubleClick={() => handleRowDoubleClick(entry)}
                onContextMenu={(event) => handleRowContextMenu(entry, event)}
              />
            ))}
          </>
        )}
      </div>

      {selectionMode === "save" ? (
        <SaveNameRow
          name={snapshot.saveName}
          issue={snapshot.saveNameIssue}
          t={t}
          onChange={(name) => store.setSaveName(name)}
          onCommit={() => store.confirmSelection()}
        />
      ) : null}

      <StatusBar
        snapshot={snapshot}
        pathStyle={snapshot.pathStyle}
        selectionMode={selectionMode}
        t={t}
        deletingCount={deletingCountRef.current}
        onDismissError={() => store.dismissError()}
        onCancelPanel={() => store.cancel()}
        onConfirmSelection={() => store.confirmSelection()}
        onConfirmDelete={handleConfirmDelete}
        onCancelDelete={() => store.cancelDelete()}
        onConfirmOverwrite={() => void store.confirmOverwrite()}
        onCancelOverwrite={() => store.cancelOverwrite()}
      />

      {menu !== null ? <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} /> : null}
    </div>
  );
}
