// FsBrowser: 瀏覽面板主元件 (計劃書第 5, 7 章). 版面五段結構由上而下: 標題列, 工具列,
// 欄位標頭, 列表, 狀態列 + 動作區. 所有狀態邏輯經 useBrowserStore 交給 core 的
// BrowserStore 處理, 本檔只負責畫面呈現與輸入事件轉呼叫.

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  createTranslator,
  fromDisplayPath,
  isDirectoryLike,
  isSelectableAs,
  resolveTheme,
  shortcutLabel,
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
import { ContextMenu, type ContextMenuEntry } from "./ContextMenu.js";
import {
  IconEye,
  IconEmptyFolder,
  IconHome,
  IconNewFolder,
  IconPaste,
  IconRefresh,
  IconUp,
} from "./icons.js";

interface MenuState {
  x: number;
  y: number;
  items: ContextMenuEntry[];
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
  const returnMode = props.returnMode ?? "single";

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
    onWarning: props.onWarning,
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
  const listRef = useRef<HTMLDivElement | null>(null);

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
    // 點擊項目時把焦點移入列表區域, 使快捷鍵 (Cut / Copy / Paste) 隨後可以生效.
    listRef.current?.focus();
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
    listRef.current?.focus();
    if (!store.getSnapshot().selection.includes(entry.Path)) store.selectOnly(entry.Path);
    const selection = store.getSnapshot().selection;
    setMenu({
      x: event.clientX,
      y: event.clientY,
      items: [
        { key: "copyPath", label: t("menu.copyPath"), onSelect: copyPath },
        { key: "sep1", separator: true },
        // 2026-08-31 裁決: 宿主未提供複製能力時剪下與複製兩項皆不顯示 (與複製同進退,
        // 避免出現剪得走卻無處可貼上的狀態); 搬移能力缺席時的重新命名退回路徑不受影響.
        ...(snapshot.capabilities.canCopy
          ? [{ key: "cut", label: t("menu.cut"), shortcut: shortcutLabel("X"), onSelect: () => store.cut() }]
          : []),
        ...(snapshot.capabilities.canCopy
          ? [{ key: "copy", label: t("menu.copy"), shortcut: shortcutLabel("C"), onSelect: () => store.copy() }]
          : []),
        // sep2 只界定剪下 / 複製這個區塊, 無複製能力而區塊整個消失時一併不顯示, 避免
        // 與 sep1 相鄰形成空區塊的雙分隔線.
        ...(snapshot.capabilities.canCopy ? [{ key: "sep2", separator: true as const }] : []),
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
      ],
    });
  }

  function handleListContextMenu(event: ReactMouseEvent): void {
    event.preventDefault();
    listRef.current?.focus();
    setMenu({
      x: event.clientX,
      y: event.clientY,
      items: [
        { key: "newFolder", label: t("menu.newFolder"), onSelect: () => store.beginNewFolder() },
        // 2026-08-31 裁決: 宿主未提供複製能力時貼上項不顯示; 有複製能力時維持既有規則,
        // 剪貼內容為空時不顯示.
        ...(snapshot.capabilities.canCopy && snapshot.clipboard !== null
          ? [
              {
                key: "paste",
                label: t("menu.paste"),
                shortcut: shortcutLabel("V"),
                disabled: !snapshot.canPaste,
                onSelect: () => void store.paste(),
              },
            ]
          : []),
        { key: "sep", separator: true },
        { key: "refresh", label: t("menu.refresh"), onSelect: () => void store.refresh() },
        {
          key: "showHidden",
          label: t("menu.showHidden"),
          checked: snapshot.showHidden,
          onSelect: () => store.toggleHidden(),
        },
      ],
    });
  }

  /**
   * handleListKeyDown 處理列表區域取得焦點時的剪下 / 複製 / 貼上快捷鍵 (計劃書第 5.2 節):
   * 修飾鍵同時接受 Meta 與 Ctrl, 兩者於任一平台皆可觸發; 列內編輯 (重新命名, 建立目錄)
   * 進行中時一律不攔截, 讓按鍵原樣交由編輯框處理. 2026-08-31 裁決: 宿主未提供複製能力
   * 時三個按鍵一律不攔截, 交由瀏覽器預設行為處理.
   */
  function handleListKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (snapshot.rename !== null || snapshot.newFolder !== null) return;
    if (!snapshot.capabilities.canCopy) return;
    if (!(event.metaKey || event.ctrlKey)) return;
    const key = event.key.toLowerCase();
    if (key === "x") {
      event.preventDefault();
      store.cut();
    } else if (key === "c") {
      event.preventDefault();
      store.copy();
    } else if (key === "v") {
      event.preventDefault();
      void store.paste();
    }
  }

  function handleConfirmDelete(): void {
    deletingCountRef.current = snapshot.deleteConfirm?.paths.length ?? 0;
    void store.confirmDelete();
  }

  const busy =
    snapshot.loading ||
    snapshot.deleting ||
    snapshot.pasting ||
    snapshot.rename !== null ||
    snapshot.newFolder !== null;

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
        {/*
          2026-08-31 裁決: 宿主未提供複製能力時貼上鈕整顆不顯示; 有複製能力時維持既有
          規則, 恆顯示只依 canPaste 除能. 工具列按鈕不採選單那種時隱時現的規則, 因為
          工具列是固定版面, 項目增減會使其餘按鈕左右位移 (第 5.2 節) -- 但複製能力於
          元件初始化時查得, 面板生命週期內不會變動, 不會出現忽隱忽現的位移, 故此處可以
          整顆不顯示.
        */}
        {snapshot.capabilities.canCopy ? (
          <button
            type="button"
            className="fsb-btn"
            aria-label={t("toolbar.paste")}
            title={t("toolbar.paste")}
            disabled={!snapshot.canPaste}
            onClick={() => void store.paste()}
          >
            <IconPaste />
          </button>
        ) : null}
        <button
          type="button"
          className="fsb-btn"
          aria-label={t("toolbar.refresh")}
          title={t("toolbar.refresh")}
          disabled={busy}
          onClick={() => void store.refresh()}
        >
          <IconRefresh />
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

      <div
        ref={listRef}
        className="fsb-list"
        tabIndex={0}
        onContextMenu={handleListContextMenu}
        onKeyDown={handleListKeyDown}
        onClick={(event) => {
          // 只在直接點到空白處 (而非透過冒泡的列或編輯框) 時取得焦點, 避免搶走列內編輯框的焦點.
          if (event.target === event.currentTarget) listRef.current?.focus();
        }}
      >
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
                cut={store.isEntryCut(entry)}
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
        returnMode={returnMode}
        t={t}
        deletingCount={deletingCountRef.current}
        onDismissError={() => store.dismissError()}
        onCancelPanel={() => store.cancel()}
        onConfirmSelection={() => store.confirmSelection()}
        onConfirmDelete={handleConfirmDelete}
        onCancelDelete={() => store.cancelDelete()}
        onConfirmOverwrite={() => void store.confirmOverwrite()}
        onCancelOverwrite={() => store.cancelOverwrite()}
        onResolvePasteConflict={(choice) => store.resolvePasteConflict(choice)}
        onCancelPaste={() => store.cancelPaste()}
        onDismissPasteOutcome={() => store.dismissPasteOutcome()}
      />

      {menu !== null ? <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} /> : null}
    </div>
  );
}
