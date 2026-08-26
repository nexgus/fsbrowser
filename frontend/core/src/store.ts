// 瀏覽狀態邏輯: 框架無關的 store (訂閱 / 快照模式), 供 Vue 3 與 React 各自薄薄包一層
// (計劃書第 5 章).
//
// 快照為不可變物件, 每次狀態變更皆重建一個新物件, 因此 React 的 useSyncExternalStore
// 與 Vue 的 shallowRef 皆可直接以參考比較判定是否需要重繪.

import type { FsbClient } from "./client.js";
import type { FsbError, FsbOperation } from "./errors.js";
import { toFsbError } from "./errors.js";
import { baseName, joinPath, normalizePath, parentDir, rootOf } from "./path.js";
import type { Entry, PathStyle, ReturnMode, SelectionMode } from "./types.js";
import { effectiveKind, isDirectoryLike, isSelectableAs } from "./types.js";

/** RenameState 是進行中的重新命名 (列內編輯). */
export interface RenameState {
  /** 被重新命名項目的原路徑. */
  path: string;
  /** 原名稱, 供比對是否真的改了名. */
  originalName: string;
  /** 編輯框目前的內容. */
  draft: string;
}

/** NewFolderState 是進行中的建立目錄 (列內編輯). */
export interface NewFolderState {
  /** 編輯框目前的內容. */
  draft: string;
}

/** DeleteConfirmState 是狀態列的刪除確認步驟. */
export interface DeleteConfirmState {
  /** 待刪除的路徑集合 (觸發確認當下的選取集). */
  paths: readonly string[];
}

/** BrowserSnapshot 是 store 對外的唯讀狀態快照. */
export interface BrowserSnapshot {
  /** 目前目錄, 內部形式. */
  currentDir: string;
  /** 實作回報的路徑風格, 僅影響顯示層. */
  pathStyle: PathStyle;
  /** 所有根; 多於一個時 UI 才顯示根切換器. */
  roots: readonly string[];
  /** 目前目錄所屬的根. */
  currentRoot: string;
  /** 已過濾 (隱藏檔) 與排序後的可見項目. */
  entries: readonly Entry[];
  /** 選取的路徑集合, 順序與可見項目一致. */
  selection: readonly string[];
  /** 範圍選 (Shift) 的錨點路徑. */
  anchor: string | null;
  /** 是否顯示隱藏項目. */
  showHidden: boolean;
  /** 是否有進行中的載入. */
  loading: boolean;
  /** 首次載入是否已完成. */
  ready: boolean;
  /** 進行中的批次刪除. */
  deleting: boolean;
  /** 目前的錯誤; 下一次成功操作自動清除. */
  error: FsbError | null;
  /** 進行中的重新命名. */
  rename: RenameState | null;
  /** 進行中的建立目錄. */
  newFolder: NewFolderState | null;
  /** 進行中的刪除確認. */
  deleteConfirm: DeleteConfirmState | null;
  /** 可見項目數. */
  itemCount: number;
  /** 選取項目數. */
  selectedCount: number;
  /** 確認 (Select) 鈕是否可用. */
  canConfirmSelection: boolean;
  /** 是否已在根 (上層導覽鈕是否可用的判準). */
  atRoot: boolean;
}

/** BrowserStoreOptions 是開啟參數中與狀態邏輯相關的部分. */
export interface BrowserStoreOptions {
  /** 對橋接層的呼叫介面. */
  client: FsbClient;
  /** 選取模式: 使用者要挑的是檔案還是目錄. */
  selectionMode: SelectionMode;
  /** 回傳模式: 單選或多選; 預設單選. */
  returnMode?: ReturnMode;
  /** 起始目錄; 未提供時用介面的家目錄. */
  initialDir?: string;
  /** 是否一開始就顯示隱藏項目; 預設否. */
  showHidden?: boolean;
  /** 選定結果回呼: 單選為一個路徑, 多選為路徑陣列 (皆為內部形式). */
  onSelect?: (result: string | string[]) => void;
  /** 取消回呼. */
  onCancel?: () => void;
  /** 錯誤外拋回呼; 與面板內狀態列顯示同時發生. */
  onError?: (error: FsbError) => void;
}

/** BrowserStore 是瀏覽狀態邏輯的對外操作集合. */
export interface BrowserStore {
  /** 取得目前快照. */
  getSnapshot(): BrowserSnapshot;
  /** 訂閱狀態變更, 回傳解除訂閱的函式. */
  subscribe(listener: () => void): () => void;

  /** 首次載入: 取得路徑風格, 根清單與起始目錄並列出內容. */
  init(): Promise<void>;
  /** 導覽至指定目錄 (接受內部形式或使用者輸入的混用寫法). */
  navigateTo(dir: string): Promise<void>;
  /** 重新列出目前目錄. */
  refresh(): Promise<void>;
  /** 導覽至上層; 已在根時無動作. */
  goUp(): Promise<void>;
  /** 導覽至家目錄. */
  goHome(): Promise<void>;
  /** 切換根. */
  switchRoot(root: string): Promise<void>;
  /** 開啟項目: 目錄 (含連結到目錄者) 進入; 其餘無動作. */
  openEntry(path: string): Promise<void>;

  /** 設定是否顯示隱藏項目. */
  setShowHidden(show: boolean): void;
  /** 切換隱藏項目顯示. */
  toggleHidden(): void;

  /** 單純點選: 只選取該項. */
  selectOnly(path: string): void;
  /** Ctrl / Cmd 點選: 加減單項. */
  toggleSelection(path: string): void;
  /** Shift 點選: 自錨點到該項的範圍選. */
  selectRange(path: string): void;
  /** 清除選取. */
  clearSelection(): void;

  /** 開始重新命名; 未指定路徑時取選取集中唯一的一項. */
  beginRename(path?: string): void;
  /** 更新重新命名的編輯內容. */
  setRenameDraft(draft: string): void;
  /** 確認重新命名. */
  commitRename(): Promise<void>;
  /** 取消重新命名. */
  cancelRename(): void;

  /** 開始建立目錄. */
  beginNewFolder(): void;
  /** 更新建立目錄的編輯內容. */
  setNewFolderDraft(draft: string): void;
  /** 確認建立目錄. */
  commitNewFolder(): Promise<void>;
  /** 取消建立目錄. */
  cancelNewFolder(): void;

  /** 觸發刪除: 狀態列轉為確認條. */
  requestDelete(): void;
  /** 確認刪除: 對選取集中每個項目各呼叫一次 Delete 並彙整結果. */
  confirmDelete(): Promise<void>;
  /** 取消刪除確認. */
  cancelDelete(): void;

  /** 關閉目前錯誤. */
  dismissError(): void;

  /** 確認選定結果: 依回傳模式呼叫 onSelect; 條件不符時無動作. */
  confirmSelection(): void;
  /** 取消整個元件: 呼叫 onCancel. */
  cancel(): void;

  /** 組出 Copy path 的文字: 選取項目的絕對路徑, 多選時每列一個. */
  copyPathText(): string;

  /** 取得目前可見項目中指定路徑的項目. */
  findEntry(path: string): Entry | undefined;
}

/** compareEntries 是列表排序: 目錄優先, 其次以名稱不分大小寫升冪. */
function compareEntries(a: Entry, b: Entry): number {
  const aDir = effectiveKind(a) === "dir";
  const bDir = effectiveKind(b) === "dir";
  if (aDir !== bDir) return aDir ? -1 : 1;
  const byName = a.Name.toLocaleLowerCase().localeCompare(b.Name.toLocaleLowerCase());
  return byName !== 0 ? byName : a.Name.localeCompare(b.Name);
}

interface InternalState {
  currentDir: string;
  pathStyle: PathStyle;
  roots: string[];
  allEntries: Entry[];
  selection: string[];
  anchor: string | null;
  showHidden: boolean;
  loading: boolean;
  ready: boolean;
  deleting: boolean;
  error: FsbError | null;
  rename: RenameState | null;
  newFolder: NewFolderState | null;
  deleteConfirm: DeleteConfirmState | null;
}

/**
 * createBrowserStore 建立瀏覽狀態邏輯.
 *
 * store 只依賴 FsbClient, 不碰任何框架 API; 單元測試以 mock client 進行. 所有對外
 * 狀態一律經 getSnapshot 取得, 所有變更一律經本介面的操作進行.
 */
export function createBrowserStore(options: BrowserStoreOptions): BrowserStore {
  const returnMode: ReturnMode = options.returnMode ?? "single";
  const selectionMode: SelectionMode = options.selectionMode;

  const state: InternalState = {
    currentDir: "",
    pathStyle: "posix",
    roots: [],
    allEntries: [],
    selection: [],
    anchor: null,
    showHidden: options.showHidden === true,
    loading: false,
    ready: false,
    deleting: false,
    error: null,
    rename: null,
    newFolder: null,
    deleteConfirm: null,
  };

  const listeners = new Set<() => void>();
  let snapshot: BrowserSnapshot = buildSnapshot();
  let initialized = false;

  function visibleEntries(): Entry[] {
    const filtered = state.showHidden
      ? state.allEntries.slice()
      : state.allEntries.filter((entry) => !entry.Hidden);
    return filtered.sort(compareEntries);
  }

  function buildSnapshot(): BrowserSnapshot {
    const entries = visibleEntries();
    const order = new Map(entries.map((entry, index) => [entry.Path, index]));
    const selection = state.selection
      .filter((path) => order.has(path))
      .sort((a, b) => (order.get(a) as number) - (order.get(b) as number));
    const selected = selection
      .map((path) => entries[order.get(path) as number])
      .filter((entry): entry is Entry => entry !== undefined);
    const allSelectable =
      selected.length > 0 && selected.every((entry) => isSelectableAs(entry, selectionMode));
    const countOk = returnMode === "single" ? selection.length === 1 : selection.length >= 1;
    const busy = state.loading || state.deleting || state.rename !== null || state.newFolder !== null;

    return Object.freeze({
      currentDir: state.currentDir,
      pathStyle: state.pathStyle,
      roots: Object.freeze(state.roots.slice()),
      currentRoot: rootOf(state.currentDir),
      entries: Object.freeze(entries),
      selection: Object.freeze(selection),
      anchor: state.anchor,
      showHidden: state.showHidden,
      loading: state.loading,
      ready: state.ready,
      deleting: state.deleting,
      error: state.error,
      rename: state.rename === null ? null : Object.freeze({ ...state.rename }),
      newFolder: state.newFolder === null ? null : Object.freeze({ ...state.newFolder }),
      deleteConfirm:
        state.deleteConfirm === null
          ? null
          : Object.freeze({ paths: Object.freeze(state.deleteConfirm.paths.slice()) }),
      itemCount: entries.length,
      selectedCount: selection.length,
      canConfirmSelection: allSelectable && countOk && !busy,
      atRoot: state.currentDir !== "" && state.currentDir === rootOf(state.currentDir),
    });
  }

  function emit(): void {
    snapshot = buildSnapshot();
    for (const listener of listeners) listener();
  }

  function setError(error: FsbError): void {
    state.error = error;
    emit();
    options.onError?.(error);
  }

  function clearError(): void {
    state.error = null;
  }

  /**
   * run 執行一次 client 呼叫並處理錯誤: 成功時清除既有錯誤 (下一次成功操作自動清除),
   * 失敗時把結構化錯誤寫入狀態並同時外拋給宿主.
   */
  async function run<T>(
    operation: FsbOperation,
    path: string | undefined,
    call: () => Promise<T>,
  ): Promise<{ ok: true; value: T } | { ok: false; error: FsbError }> {
    try {
      const value = await call();
      clearError();
      return { ok: true, value };
    } catch (thrown) {
      const error = toFsbError(thrown, operation, path);
      setError(error);
      return { ok: false, error };
    }
  }

  async function loadDir(dir: string): Promise<void> {
    state.loading = true;
    state.rename = null;
    state.newFolder = null;
    state.deleteConfirm = null;
    emit();

    const result = await run("list", dir, () => options.client.list(dir));
    state.loading = false;
    if (result.ok) {
      const changed = dir !== state.currentDir;
      state.currentDir = dir;
      state.allEntries = result.value;
      if (changed) {
        state.selection = [];
        state.anchor = null;
      } else {
        const alive = new Set(result.value.map((entry) => entry.Path));
        state.selection = state.selection.filter((path) => alive.has(path));
        if (state.anchor !== null && !alive.has(state.anchor)) state.anchor = null;
      }
    }
    state.ready = true;
    emit();
  }

  function entriesInView(): Entry[] {
    return snapshot.entries as Entry[];
  }

  function setSelection(paths: string[], anchor: string | null): void {
    state.selection = paths;
    state.anchor = anchor;
    emit();
  }

  function setShowHidden(show: boolean): void {
    if (state.showHidden === show) return;
    state.showHidden = show;
    // 隱藏後不可見的項目一併移出選取集, 避免使用者看不到卻仍在選取結果中.
    if (!show) {
      const hidden = new Set(
        state.allEntries.filter((entry) => entry.Hidden).map((entry) => entry.Path),
      );
      state.selection = state.selection.filter((path) => !hidden.has(path));
      if (state.anchor !== null && hidden.has(state.anchor)) state.anchor = null;
    }
    emit();
  }

  return {
    getSnapshot: () => snapshot,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async init() {
      if (initialized) return;
      initialized = true;

      const style = await run("pathStyle", undefined, () => options.client.pathStyle());
      if (style.ok) state.pathStyle = style.value;

      const roots = await run("roots", undefined, () => options.client.roots());
      if (roots.ok) state.roots = roots.value.map((root) => normalizePath(root));

      let dir = options.initialDir === undefined ? "" : normalizePath(options.initialDir);
      if (dir === "") {
        const home = await run("home", undefined, () => options.client.home());
        if (!home.ok) {
          state.ready = true;
          emit();
          return;
        }
        dir = normalizePath(home.value);
      }
      await loadDir(dir);
    },

    async navigateTo(dir) {
      const target = normalizePath(dir);
      if (target === "") return;
      await loadDir(target);
    },

    async refresh() {
      if (state.currentDir === "") return;
      await loadDir(state.currentDir);
    },

    async goUp() {
      if (state.currentDir === "") return;
      const parent = parentDir(state.currentDir);
      if (parent === state.currentDir) return;
      await loadDir(parent);
    },

    async goHome() {
      const home = await run("home", undefined, () => options.client.home());
      if (!home.ok) return;
      await loadDir(normalizePath(home.value));
    },

    async switchRoot(root) {
      const target = normalizePath(root);
      if (target === "" || target === state.currentDir) return;
      await loadDir(target);
    },

    async openEntry(path) {
      const entry = entriesInView().find((item) => item.Path === path);
      if (entry === undefined || !isDirectoryLike(entry)) return;
      await loadDir(normalizePath(entry.Path));
    },

    setShowHidden,

    toggleHidden() {
      setShowHidden(!state.showHidden);
    },

    selectOnly(path) {
      setSelection([path], path);
    },

    toggleSelection(path) {
      if (returnMode === "single") {
        // 單選模式下 Ctrl / Cmd 點選僅在同一項時取消選取, 不累積多項.
        setSelection(state.selection.includes(path) ? [] : [path], path);
        return;
      }
      const next = state.selection.includes(path)
        ? state.selection.filter((item) => item !== path)
        : [...state.selection, path];
      setSelection(next, path);
    },

    selectRange(path) {
      if (returnMode === "single") {
        setSelection([path], path);
        return;
      }
      const entries = entriesInView();
      const targetIndex = entries.findIndex((entry) => entry.Path === path);
      if (targetIndex < 0) return;
      const anchorIndex =
        state.anchor === null ? -1 : entries.findIndex((entry) => entry.Path === state.anchor);
      if (anchorIndex < 0) {
        setSelection([path], path);
        return;
      }
      const from = Math.min(anchorIndex, targetIndex);
      const to = Math.max(anchorIndex, targetIndex);
      const range = entries.slice(from, to + 1).map((entry) => entry.Path);
      // 錨點保持不變, 使連續的 Shift 點選皆以同一起點計算範圍.
      setSelection(range, state.anchor);
    },

    clearSelection() {
      setSelection([], null);
    },

    beginRename(path) {
      const target = path ?? (state.selection.length === 1 ? state.selection[0] : undefined);
      if (target === undefined) return;
      const entry = entriesInView().find((item) => item.Path === target);
      if (entry === undefined) return;
      state.newFolder = null;
      state.deleteConfirm = null;
      state.rename = { path: entry.Path, originalName: entry.Name, draft: entry.Name };
      emit();
    },

    setRenameDraft(draft) {
      if (state.rename === null) return;
      state.rename = { ...state.rename, draft };
      emit();
    },

    async commitRename() {
      const rename = state.rename;
      if (rename === null) return;
      const name = rename.draft.trim();
      if (name === "" || name === rename.originalName) {
        state.rename = null;
        emit();
        return;
      }
      const newPath = joinPath(parentDir(rename.path), name);
      const result = await run("rename", rename.path, () =>
        options.client.rename(rename.path, newPath),
      );
      if (!result.ok) return;
      state.rename = null;
      // 重新命名後路徑改變, 選取集隨之更新, 使操作後仍選著同一個項目.
      state.selection = state.selection.map((path) => (path === rename.path ? newPath : path));
      if (state.anchor === rename.path) state.anchor = newPath;
      await loadDir(state.currentDir);
    },

    cancelRename() {
      if (state.rename === null) return;
      state.rename = null;
      emit();
    },

    beginNewFolder() {
      state.rename = null;
      state.deleteConfirm = null;
      state.newFolder = { draft: "" };
      emit();
    },

    setNewFolderDraft(draft) {
      if (state.newFolder === null) return;
      state.newFolder = { draft };
      emit();
    },

    async commitNewFolder() {
      const newFolder = state.newFolder;
      if (newFolder === null) return;
      const name = newFolder.draft.trim();
      if (name === "") {
        state.newFolder = null;
        emit();
        return;
      }
      const target = joinPath(state.currentDir, name);
      const result = await run("makeDir", target, () => options.client.makeDir(target));
      if (!result.ok) return;
      state.newFolder = null;
      await loadDir(state.currentDir);
    },

    cancelNewFolder() {
      if (state.newFolder === null) return;
      state.newFolder = null;
      emit();
    },

    requestDelete() {
      if (state.selection.length === 0) return;
      state.rename = null;
      state.newFolder = null;
      state.deleteConfirm = { paths: state.selection.slice() };
      emit();
    },

    async confirmDelete() {
      const confirm = state.deleteConfirm;
      if (confirm === null) return;
      const paths = confirm.paths.slice();
      state.deleteConfirm = null;
      state.deleting = true;
      emit();

      const failures: { path: string; error: FsbError }[] = [];
      for (const path of paths) {
        try {
          await options.client.delete(path);
        } catch (thrown) {
          failures.push({ path, error: toFsbError(thrown, "delete", path) });
        }
      }
      state.deleting = false;

      if (failures.length === 0) {
        // 全數成功屬一次成功操作, 清除既有錯誤.
        clearError();
        state.selection = [];
        state.anchor = null;
        await loadDir(state.currentDir);
        return;
      }

      const first = failures[0] as { path: string; error: FsbError };
      const detail = failures
        .map((failure) => `${baseName(failure.path)}: ${failure.error.message}`)
        .join("; ");
      const aggregated: FsbError = {
        code: first.error.code,
        message: detail,
        operation: "delete",
        path: first.path,
      };
      const stillThere = new Set(failures.map((failure) => failure.path));
      state.selection = state.selection.filter((path) => stillThere.has(path));
      state.anchor = null;
      await loadDir(state.currentDir);
      setError(aggregated);
    },

    cancelDelete() {
      if (state.deleteConfirm === null) return;
      state.deleteConfirm = null;
      emit();
    },

    dismissError() {
      if (state.error === null) return;
      state.error = null;
      emit();
    },

    confirmSelection() {
      if (!snapshot.canConfirmSelection) return;
      const paths = snapshot.selection.slice();
      if (returnMode === "single") options.onSelect?.(paths[0] as string);
      else options.onSelect?.(paths);
    },

    cancel() {
      options.onCancel?.();
    },

    copyPathText() {
      return snapshot.selection.join("\n");
    },

    findEntry(path) {
      return entriesInView().find((entry) => entry.Path === path);
    },
  };
}
