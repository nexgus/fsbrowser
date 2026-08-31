// 瀏覽狀態邏輯: 框架無關的 store (訂閱 / 快照模式), 供 Vue 3 與 React 各自薄薄包一層
// (計劃書第 5 章).
//
// 快照為不可變物件, 每次狀態變更皆重建一個新物件, 因此 React 的 useSyncExternalStore
// 與 Vue 的 shallowRef 皆可直接以參考比較判定是否需要重繪.

import type { FsbCapabilities, FsbClient } from "./client.js";
import type { FsbError, FsbOperation } from "./errors.js";
import { toFsbError } from "./errors.js";
import { baseName, isInsidePath, joinPath, normalizePath, parentDir, rootOf } from "./path.js";
import type { Entry, Kind, PathStyle, ReturnMode, SelectionMode } from "./types.js";
import {
  effectiveKind,
  isDirectoryLike,
  isFileLike,
  isSelectableAs,
  matchesExtensions,
  normalizeExtensions,
} from "./types.js";

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

/**
 * SaveNameIssue 是存檔模式檔名輸入列目前的問題:
 * "empty" 為空字串, "invalid" 為含不合法字元, "isDirectory" 為目標已是既有目錄.
 */
export type SaveNameIssue = "empty" | "invalid" | "isDirectory";

/** OverwriteConfirmState 是存檔模式進行中的覆寫確認. */
export interface OverwriteConfirmState {
  /** 待覆寫的目標路徑, 內部形式. */
  path: string;
  /** 待覆寫的目標名稱, 供確認文字顯示. */
  name: string;
}

/** ClipboardMode 是剪貼內容的模式 (第 5.1 節). */
export type ClipboardMode = "cut" | "copy";

/**
 * ClipboardState 是元件內部保存的剪貼內容 (第 1 章). 純屬元件狀態, 不寫入系統剪貼簿:
 * 系統剪貼簿只能承載文字, 無法表達 "待搬移的遠端路徑" 這種語意.
 */
export interface ClipboardState {
  /** 剪下或複製. */
  mode: ClipboardMode;
  /** 頂層項目的路徑清單, 內部形式; 資料夾的內部成員不在其中. */
  paths: readonly string[];
  /** 剪下或複製當下所在的目錄. */
  sourceDir: string;
}

/** PasteProgressState 是進行中的單一作業 (第 5.3 節). */
export interface PasteProgressState {
  /** 進行中的是複製還是搬移, 決定狀態列取哪一則進行中文字. */
  mode: ClipboardMode;
  /** 進行到第幾項 (自 1 起算). */
  current: number;
  /** 本貼上批次的頂層項目總數. */
  count: number;
  /** 進行中項目的名稱. */
  name: string;
  /** 本作業能否取消: 宿主宣告可取消, 且呼叫層確實提供取消方法時才為 true. */
  canCancel: boolean;
}

/** PasteConflictState 是同名衝突的詢問 (第 5.3 節). */
export interface PasteConflictState {
  /** 衝突的項目名稱, 供詢問文字顯示. */
  name: string;
  /** 來源路徑. */
  sourcePath: string;
  /** 目標路徑. */
  targetPath: string;
  /** 衝突發生在第幾項 (自 1 起算). */
  current: number;
  /** 本貼上批次的頂層項目總數. */
  count: number;
}

/** PasteConflictChoice 是同名衝突詢問的五個選項; "全部" 只在本貼上批次內沿用. */
export type PasteConflictChoice = "overwrite" | "overwriteAll" | "skip" | "skipAll" | "cancel";

/**
 * PasteFailure 是貼上批次中單一失敗項目的紀錄.
 * reason 為 "typeMismatch" 者是目標存在但種類不同 (一為檔案一為目錄), 元件直接拒絕,
 * 不提供覆寫選項, 故無對應的操作錯誤.
 */
export interface PasteFailure {
  /** 來源路徑. */
  path: string;
  /** 項目名稱, 供狀態列文字取用. */
  name: string;
  /** 失敗原因. */
  reason: "typeMismatch" | "error";
  /** 操作回報的結構化錯誤; reason 為 "typeMismatch" 時為 null. */
  error: FsbError | null;
}

/**
 * PasteOutcomeState 是貼上批次結束後的結果, 供狀態列顯示對應文字 (第 5.3, 5.6, 5.7 節).
 * 取消與斷線兩種收場需要 "已處理幾項, 共幾項" 這類參數才能組出文字, 錯誤代碼本身表達不了,
 * 因此另設此區塊; 失敗項的彙整仍照既有做法寫入 error.
 */
export interface PasteOutcomeState {
  /** 收場方式: 正常結束, 使用者取消, 或連線中斷. */
  reason: "completed" | "canceled" | "disconnected";
  /** 已決定結果的項目數 (含成功, 失敗, 略過與被擋下者); 未處理者不計入. */
  done: number;
  /** 本貼上批次的頂層項目總數. */
  count: number;
  /** 斷線當下正在處理的項目名稱 (其結果未知); 其他收場為空字串. */
  name: string;
  /** 失敗項目清單, 依處理順序排列. */
  failures: readonly PasteFailure[];
}

/**
 * FsbWarning 是交給宿主的警告 (第 5.5 節). 與錯誤不同, 警告不進狀態列, 由宿主決定要不要
 * 呈現以及怎麼呈現; 目前僅有嵌套貼上一種.
 */
export interface FsbWarning {
  /** 警告代碼; "nestedPaste" 為目標位於來源本身或其內部而被擋下. */
  code: "nestedPaste";
  /** 被擋下的來源路徑清單. */
  paths: readonly string[];
  /** 當時的目標目錄. */
  targetDir: string;
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
  /** 進行中的貼上批次 (含等待衝突詢問作答的期間). */
  pasting: boolean;
  /** 宿主實作滿足的選用能力, 決定選單項目的顯示與否; 尚未查得前三項皆為 false. */
  capabilities: FsbCapabilities;
  /** 目前的剪貼內容; 為空時 Paste 不顯示, 工具列的貼上鈕除能. */
  clipboard: ClipboardState | null;
  /** 貼上是否可執行: 有剪貼內容且目前沒有其他進行中的操作. */
  canPaste: boolean;
  /** 進行中的單一複製或搬移作業; 等待衝突詢問作答時為 null. */
  pasteProgress: PasteProgressState | null;
  /** 進行中的同名衝突詢問. */
  pasteConflict: PasteConflictState | null;
  /** 上一個貼上批次的結果; 下一次貼上或關閉時清除. */
  pasteOutcome: PasteOutcomeState | null;
  /** 目前的錯誤; 下一次成功操作自動清除. */
  error: FsbError | null;
  /** 進行中的重新命名. */
  rename: RenameState | null;
  /** 進行中的建立目錄. */
  newFolder: NewFolderState | null;
  /** 進行中的刪除確認. */
  deleteConfirm: DeleteConfirmState | null;
  /** 存檔模式檔名輸入列的目前內容; 其餘模式恆為空字串. */
  saveName: string;
  /** 存檔模式檔名目前的問題; 無問題時為 null. */
  saveNameIssue: SaveNameIssue | null;
  /** 存檔模式進行中的覆寫確認. */
  overwriteConfirm: OverwriteConfirmState | null;
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
  /** 存檔模式的預設檔名, 面板開啟時預填; 未提供時為空字串. */
  defaultName?: string;
  /**
   * 副檔名過濾清單 (例如 ["txt", ".md", "*.log"], 經 normalizeExtensions 正規化後使用).
   * 僅於檔案與存檔模式生效; 未提供或為空清單時不做過濾.
   */
  extensions?: readonly string[];
  /** 選定結果回呼: 單選為一個路徑, 多選為路徑陣列 (皆為內部形式). */
  onSelect?: (result: string | string[]) => void;
  /** 取消回呼. */
  onCancel?: () => void;
  /** 錯誤外拋回呼; 與面板內狀態列顯示同時發生. */
  onError?: (error: FsbError) => void;
  /**
   * 警告外拋回呼 (選填, 第 5.5 節): 目前僅用於被擋下的嵌套貼上. 警告不進狀態列, 宿主
   * 不提供本回呼亦不影響運作, 只是使用者看不到 "為什麼那幾項沒有貼上" 的說明.
   */
  onWarning?: (warning: FsbWarning) => void;
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

  /**
   * 剪下: 以指定路徑 (未指定時取目前選取集) 建立剪下模式的剪貼內容.
   * 搬移能力缺席時仍可用, 貼上時改走重新命名的退回路徑; 複製能力缺席時無動作
   * (2026-08-31 裁決: 剪下, 複製, 貼上三項同進退).
   */
  cut(paths?: readonly string[]): void;
  /** 複製: 同 cut, 但為複製模式; 宿主未提供複製能力時無動作. */
  copy(paths?: readonly string[]): void;
  /** 貼上至目前目錄: 對剪貼內容中的頂層項目依序處理 (第 5.3 節). */
  paste(): Promise<void>;
  /** 清除剪貼內容. */
  clearClipboard(): void;
  /** 回答同名衝突詢問; 無進行中的詢問時無動作. */
  resolvePasteConflict(choice: PasteConflictChoice): void;
  /** 取消進行中的貼上批次: 取消當下的作業, 並中止尚未處理的項目. */
  cancelPaste(): void;
  /** 關閉上一個貼上批次的結果. */
  dismissPasteOutcome(): void;
  /** 重新查詢宿主的選用能力 (宿主於執行期抽換實作後使用). */
  refreshCapabilities(): Promise<void>;
  /** 判斷項目是否在剪下模式的剪貼內容中 (供整列淡化呈現). */
  isEntryCut(entry: Entry): boolean;

  /** 設定存檔模式的檔名輸入列內容. */
  setSaveName(name: string): void;
  /** 確認覆寫: 發出選定結果並清除覆寫確認. */
  confirmOverwrite(): Promise<void> | void;
  /** 取消覆寫確認. */
  cancelOverwrite(): void;

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

  /**
   * 判斷項目是否因副檔名過濾而淡化 (顯示但不可選); 目錄模式與未設過濾時一律為 false,
   * 目錄 (含連結到目錄者) 亦不受過濾影響.
   */
  isEntryDimmed(entry: Entry): boolean;
}

/** compareEntries 是列表排序: 目錄優先, 其次以名稱不分大小寫升冪. */
function compareEntries(a: Entry, b: Entry): number {
  const aDir = effectiveKind(a) === "dir";
  const bDir = effectiveKind(b) === "dir";
  if (aDir !== bDir) return aDir ? -1 : 1;
  const byName = a.Name.toLocaleLowerCase().localeCompare(b.Name.toLocaleLowerCase());
  return byName !== 0 ? byName : a.Name.localeCompare(b.Name);
}

/**
 * InternalClipboard 是剪貼內容的內部形式: 除對外的三項之外, 另記下各頂層項目當時的有效
 * 種類, 供貼上時與目標比對種類 (第 5.3 節).
 *
 * 種類於剪下或複製當下取自列表, 而非貼上時再向宿主查詢: 元件不遞迴, 每項多一次往返只為
 * 取得一個早已顯示在畫面上的資訊並不划算, 且使用者的判斷本來就是依當時所見的種類.
 */
interface InternalClipboard extends ClipboardState {
  kinds: readonly Kind[];
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
  pasting: boolean;
  capabilities: FsbCapabilities;
  clipboard: InternalClipboard | null;
  pasteProgress: PasteProgressState | null;
  pasteConflict: PasteConflictState | null;
  pasteOutcome: PasteOutcomeState | null;
  error: FsbError | null;
  rename: RenameState | null;
  newFolder: NewFolderState | null;
  deleteConfirm: DeleteConfirmState | null;
  saveName: string;
  /** 目標為既有目錄的旗標; 只在確認時設立, 檔名再變更或導覽後清除. */
  saveIsDirectory: boolean;
  overwriteConfirm: OverwriteConfirmState | null;
}

/** WINDOWS_RESERVED_CHARS 是 Windows 風格下檔名不可含的保留字元. */
const WINDOWS_RESERVED_CHARS = '<>:"|?*';

/**
 * hasWindowsReservedChar 判斷名稱是否含 Windows 風格下不可用的字元: 保留字元或控制
 * 字元 (含 DEL).
 */
function hasWindowsReservedChar(name: string): boolean {
  for (const ch of name) {
    if (WINDOWS_RESERVED_CHARS.includes(ch)) return true;
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * validateSaveName 檢查存檔模式的檔名: 空字串為 "empty"; 含分隔符, 為 "." 或 "..",
 * 或 Windows 風格下含保留字元者為 "invalid"; 其餘為 null.
 */
function validateSaveName(name: string, pathStyle: PathStyle): SaveNameIssue | null {
  const trimmed = name.trim();
  if (trimmed === "") return "empty";
  if (trimmed === "." || trimmed === "..") return "invalid";
  if (trimmed.includes("/") || trimmed.includes("\\")) return "invalid";
  if (pathStyle === "windows" && hasWindowsReservedChar(trimmed)) return "invalid";
  return null;
}

/**
 * hasExtension 判斷檔名是否已帶副檔名: 第一個字元之後含 "." 才算, 故 ".bashrc" 這類
 * 以點開頭的名稱視為無副檔名.
 */
function hasExtension(name: string): boolean {
  return name.indexOf(".", 1) >= 0;
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
    pasting: false,
    capabilities: { canCopy: false, canMove: false, canCancel: false },
    clipboard: null,
    pasteProgress: null,
    pasteConflict: null,
    pasteOutcome: null,
    error: null,
    rename: null,
    newFolder: null,
    deleteConfirm: null,
    saveName: options.defaultName ?? "",
    saveIsDirectory: false,
    overwriteConfirm: null,
  };

  // 副檔名過濾只在檔案與存檔模式生效; 目錄模式完全忽略.
  const extensions = selectionMode === "dir" ? [] : normalizeExtensions(options.extensions);

  const listeners = new Set<() => void>();
  let snapshot: BrowserSnapshot = buildSnapshot();
  let initialized = false;

  /** isDimmed 判斷項目是否因副檔名過濾而淡化: 目錄不受過濾影響. */
  function isDimmed(entry: Entry): boolean {
    if (extensions.length === 0) return false;
    if (isDirectoryLike(entry)) return false;
    return !matchesExtensions(entry.Name, extensions);
  }

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
      selected.length > 0 &&
      selected.every((entry) => isSelectableAs(entry, selectionMode) && !isDimmed(entry));
    const countOk = returnMode === "single" ? selection.length === 1 : selection.length >= 1;
    const busy =
      state.loading ||
      state.deleting ||
      state.pasting ||
      state.rename !== null ||
      state.newFolder !== null;
    const saveNameIssue =
      selectionMode === "save"
        ? (validateSaveName(state.saveName, state.pathStyle) ??
          (state.saveIsDirectory ? "isDirectory" : null))
        : null;
    // 存檔模式的確認只看檔名是否可用: 不看選取集, 回傳模式無意義, 固定單一路徑.
    const canConfirm =
      selectionMode === "save" ? saveNameIssue === null && !busy : allSelectable && countOk && !busy;

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
      pasting: state.pasting,
      capabilities: Object.freeze({ ...state.capabilities }),
      clipboard:
        state.clipboard === null
          ? null
          : Object.freeze({
              mode: state.clipboard.mode,
              paths: Object.freeze(state.clipboard.paths.slice()),
              sourceDir: state.clipboard.sourceDir,
            }),
      // 貼上鈕恆顯示, 剪貼內容為空或有其他進行中的操作時除能 (第 5.2 節); 2026-08-31
      // 裁決: 宿主未提供複製能力時貼上一律不可用 (剪下, 複製, 貼上三項同進退).
      canPaste:
        state.capabilities.canCopy && state.clipboard !== null && state.currentDir !== "" && !busy,
      pasteProgress: state.pasteProgress === null ? null : Object.freeze({ ...state.pasteProgress }),
      pasteConflict: state.pasteConflict === null ? null : Object.freeze({ ...state.pasteConflict }),
      pasteOutcome:
        state.pasteOutcome === null
          ? null
          : Object.freeze({
              ...state.pasteOutcome,
              failures: Object.freeze(state.pasteOutcome.failures.slice()),
            }),
      error: state.error,
      rename: state.rename === null ? null : Object.freeze({ ...state.rename }),
      newFolder: state.newFolder === null ? null : Object.freeze({ ...state.newFolder }),
      deleteConfirm:
        state.deleteConfirm === null
          ? null
          : Object.freeze({ paths: Object.freeze(state.deleteConfirm.paths.slice()) }),
      saveName: selectionMode === "save" ? state.saveName : "",
      saveNameIssue,
      overwriteConfirm:
        state.overwriteConfirm === null ? null : Object.freeze({ ...state.overwriteConfirm }),
      itemCount: entries.length,
      selectedCount: selection.length,
      canConfirmSelection: canConfirm,
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
    // 導覽時清除覆寫確認與 "目標為目錄" 的提示; 檔名本身保留不清空.
    state.overwriteConfirm = null;
    state.saveIsDirectory = false;
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

  /** isDimmedPath 判斷可見項目中的指定路徑是否為淡化項目; 不在列表中者視為非淡化. */
  function isDimmedPath(path: string): boolean {
    const entry = entriesInView().find((item) => item.Path === path);
    return entry !== undefined && isDimmed(entry);
  }

  /**
   * applySaveName 設定檔名輸入列內容, 並清除因舊檔名而生的 "目標為目錄" 提示與覆寫確認
   * (兩者皆繫於當時的檔名, 檔名一改即失效).
   */
  function applySaveName(name: string): void {
    if (state.saveName === name && !state.saveIsDirectory && state.overwriteConfirm === null) return;
    state.saveName = name;
    state.saveIsDirectory = false;
    state.overwriteConfirm = null;
    emit();
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

  // --- 剪貼與貼上 (第 5.1, 5.3 至 5.7 節) ---

  /** pendingConflict 是等待作答的衝突詢問; 作答後即清除. */
  let pendingConflict: ((choice: PasteConflictChoice) => void) | null = null;
  /** activeCancel 是進行中作業的取消函式; 無進行中作業或該作業不可取消時為 null. */
  let activeCancel: (() => void) | null = null;
  /** cancelRequested 標記本批次已被要求取消; 批次結束時重置. */
  let cancelRequested = false;

  async function loadCapabilities(): Promise<void> {
    const result = await run("capabilities", undefined, () => options.client.capabilities());
    // 查詢失敗時一律視為三項皆不支援: 少一個選單項目只是功能收斂, 顯示了卻註定失敗的
    // 操作才是使用者真正踩得到的坑.
    state.capabilities = result.ok
      ? result.value
      : { canCopy: false, canMove: false, canCancel: false };
    emit();
  }

  /** setClipboard 以指定路徑 (未指定時取選取集) 建立剪貼內容, 一併記下各項當時的種類. */
  function setClipboard(mode: ClipboardMode, paths?: readonly string[]): void {
    const chosen = (paths ?? state.selection).filter((path) => path !== "");
    if (chosen.length === 0) return;
    const entries = entriesInView();
    const kinds = chosen.map((path) => {
      const entry = entries.find((item) => item.Path === path);
      return entry === undefined ? "unknown" : effectiveKind(entry);
    });
    state.clipboard = { mode, paths: chosen.slice(), sourceDir: state.currentDir, kinds };
    emit();
  }

  /**
   * askConflict 把狀態列轉為衝突詢問條並等待作答. 詢問期間先撤下進行中的作業資訊, 兩者
   * 不同時出現於恆定高度的狀態列.
   */
  function askConflict(conflict: PasteConflictState): Promise<PasteConflictChoice> {
    state.pasteConflict = conflict;
    state.pasteProgress = null;
    emit();
    return new Promise((resolve) => {
      pendingConflict = (choice) => {
        pendingConflict = null;
        state.pasteConflict = null;
        resolve(choice);
      };
    });
  }

  /**
   * runPaste 執行一次完整的貼上批次 (第 5.3 節): 對頂層項目依序處理, 同一時間只有一個
   * 作業在進行. 取消與斷線皆中止整個批次, 差別在於前者重新整理清單, 後者維持原畫面.
   */
  async function runPaste(): Promise<void> {
    const clipboard = state.clipboard;
    if (clipboard === null || state.pasting || state.currentDir === "") return;
    // 2026-08-31 裁決: 宿主未提供複製能力時剪下, 複製, 貼上三項皆不提供, 正常情況下
    // 不會走到這裡; 此處僅為能力於執行期被抽換掉的防線.
    if (!state.capabilities.canCopy) return;

    const targetDir = state.currentDir;
    const items = clipboard.paths.slice();
    const count = items.length;
    const moving = clipboard.mode === "cut";
    // 退回路徑: 搬移能力缺席時以跨目錄重新命名完成剪下貼上 (第 5.4 節).
    const fallbackRename = moving && !state.capabilities.canMove;
    const operation: FsbOperation = fallbackRename ? "rename" : moving ? "move" : "copy";

    state.rename = null;
    state.newFolder = null;
    state.deleteConfirm = null;
    state.overwriteConfirm = null;
    state.pasteOutcome = null;
    state.pasting = true;
    cancelRequested = false;
    emit();

    const created: string[] = [];
    const failures: PasteFailure[] = [];
    /** blocked 是命中嵌套防護的來源路徑; 不進狀態列, 批次結束後一次交給宿主的警告回呼. */
    const blocked: string[] = [];
    /** applyAll 是 "全部" 的決定, 只在本批次內沿用. */
    let applyAll: "overwrite" | "skip" | null = null;
    let done = 0;
    let reason: PasteOutcomeState["reason"] = "completed";
    let interruptedName = "";
    let interruptedError: FsbError | null = null;

    for (let index = 0; index < count; index += 1) {
      if (cancelRequested) {
        reason = "canceled";
        break;
      }

      const src = items[index] as string;
      const name = baseName(src);
      const dst = joinPath(targetDir, name);

      // 嵌套檢查: 目標目錄即為來源本身或位於來源之內時一律擋下, 不呼叫宿主 (第 5.5 節).
      // 貼到來源的父目錄 (原地複製) 不屬於嵌套, 照常走同名衝突流程.
      if (isInsidePath(targetDir, src, state.pathStyle)) {
        blocked.push(src);
        done += 1;
        continue;
      }

      const progress = (canCancel: boolean): PasteProgressState => ({
        mode: clipboard.mode,
        current: index + 1,
        count,
        name,
        canCancel,
      });
      state.pasteProgress = progress(false);
      emit();

      // 目標查詢: 回報找不到即視為無衝突.
      let existing: Entry | null = null;
      try {
        existing = await options.client.stat(dst);
      } catch (thrown) {
        const error = toFsbError(thrown, "stat", dst);
        if (error.code === "not_found") {
          existing = null;
        } else if (error.code === "disconnected") {
          reason = "disconnected";
          interruptedName = name;
          interruptedError = error;
          break;
        } else {
          failures.push({ path: src, name, reason: "error", error });
          done += 1;
          continue;
        }
      }

      let overwrite = false;
      if (existing !== null) {
        if (fallbackRename) {
          // 退回路徑遇目標已存在一律記為失敗: 既有的重新命名操作對已存在目標的行為由各
          // 實作自行決定, 元件無從保證覆寫真的發生, 也無從保證不會靜默毀掉目標 (第 5.4 節).
          failures.push({
            path: src,
            name,
            reason: "error",
            error: { code: "already_exists", message: "", operation: "rename", path: dst },
          });
          done += 1;
          continue;
        }

        // 種類比對: 一為檔案一為目錄時直接拒絕, 不提供覆寫 -- 覆寫在此等於用一個檔案換掉
        // 整棵目錄樹, 誤觸代價與其他衝突不在同一量級 (第 5.3 節).
        const sourceIsDir = clipboard.kinds[index] === "dir";
        if (sourceIsDir !== (effectiveKind(existing) === "dir")) {
          failures.push({ path: src, name, reason: "typeMismatch", error: null });
          done += 1;
          continue;
        }

        let choice: PasteConflictChoice;
        if (applyAll === "overwrite") choice = "overwrite";
        else if (applyAll === "skip") choice = "skip";
        else {
          choice = await askConflict({
            name,
            sourcePath: src,
            targetPath: dst,
            current: index + 1,
            count,
          });
        }
        if (choice === "overwriteAll") {
          applyAll = "overwrite";
          choice = "overwrite";
        } else if (choice === "skipAll") {
          applyAll = "skip";
          choice = "skip";
        }
        if (choice === "cancel") {
          reason = "canceled";
          break;
        }
        if (choice === "skip") {
          done += 1;
          continue;
        }
        overwrite = true;
      }

      state.pasteProgress = progress(false);
      emit();

      if (fallbackRename) {
        try {
          await options.client.rename(src, dst);
          created.push(dst);
        } catch (thrown) {
          const error = toFsbError(thrown, "rename", src);
          if (error.code === "disconnected") {
            reason = "disconnected";
            interruptedName = name;
            interruptedError = error;
            break;
          }
          failures.push({ path: src, name, reason: "error", error });
        }
        done += 1;
        continue;
      }

      const handle = moving
        ? options.client.move(src, dst, overwrite)
        : options.client.copy(src, dst, overwrite);
      // 實際可用的取消能力 = 宿主宣告可取消 且 呼叫層回傳物件提供取消方法 (第 4 章).
      activeCancel =
        state.capabilities.canCancel && handle.cancel !== undefined ? handle.cancel : null;
      state.pasteProgress = progress(activeCancel !== null);
      emit();
      // 取消可能在本作業發出之前就已按下 (前一項結束與本項開始之間), 此時補送一次.
      if (cancelRequested && activeCancel !== null) activeCancel();

      try {
        await handle.result;
        created.push(dst);
        done += 1;
      } catch (thrown) {
        const error = toFsbError(thrown, operation, src);
        // 取消後底層以何種代碼收場依實作而定, 因此以元件自己的取消旗標為主要判準.
        if (cancelRequested || error.code === "canceled") {
          reason = "canceled";
          break;
        }
        if (error.code === "disconnected") {
          reason = "disconnected";
          interruptedName = name;
          interruptedError = error;
          break;
        }
        failures.push({ path: src, name, reason: "error", error });
        done += 1;
      } finally {
        activeCancel = null;
      }
    }

    activeCancel = null;
    cancelRequested = false;
    state.pasting = false;
    state.pasteProgress = null;
    state.pasteConflict = null;
    state.pasteOutcome = {
      reason,
      done,
      count,
      name: interruptedName,
      failures: failures.slice(),
    };
    // 剪下的內容於正常結束時清除; 取消與斷線一律保留, 使用者再貼一次不必重新選取
    // (第 5.1, 5.6, 5.7 節). 複製的內容一律保留, 可連續貼多次.
    if (moving && reason === "completed" && state.clipboard === clipboard) state.clipboard = null;
    // 選取本次成功產生的項目; 實際不存在者由重新列出時自動濾除.
    if (created.length > 0) {
      state.selection = created.slice();
      state.anchor = null;
    }
    emit();

    if (blocked.length > 0) {
      options.onWarning?.({ code: "nestedPaste", paths: blocked.slice(), targetDir });
    }

    if (reason === "disconnected") {
      // 連線已斷, 重新整理只會再失敗一次, 因此維持斷線前的畫面; 狀態列的說明由
      // pasteOutcome 提供, 結構化錯誤僅外拋給宿主, 以免狀態列同時出現兩段訊息 (第 5.7 節).
      if (interruptedError !== null) options.onError?.(interruptedError);
      return;
    }

    await loadDir(targetDir);

    if (failures.length === 0) return;
    // 種類不符沒有對應的錯誤代碼, 且已有專屬的狀態列說明 (第 6 章); 失敗全屬此類時不另
    // 設錯誤, 以免冒用一個不相干的代碼, 使狀態列顯示與實際情形不符的文字.
    const errored = failures.filter((failure) => failure.error !== null);
    if (errored.length === 0) return;
    // 失敗彙整比照刪除: 以第一個帶錯誤者的代碼為代表, 訊息串接各失敗項 (種類不符者只
    // 列名稱, 無細節可附).
    const first = errored[0] as PasteFailure;
    const detail = failures
      .map((failure) =>
        failure.error === null || failure.error.message === ""
          ? failure.name
          : `${failure.name}: ${failure.error.message}`,
      )
      .join("; ");
    setError({
      code: (first.error as FsbError).code,
      message: detail,
      operation,
      path: first.path,
    });
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

      await loadCapabilities();

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
      // 淡化項目不可選, 點選一律無動作 (亦不改動既有選取).
      if (isDimmedPath(path)) return;
      setSelection([path], path);
      if (selectionMode !== "save") return;
      // 存檔模式點到檔案時把檔名帶入輸入列; 目錄與其他種類不影響.
      const entry = entriesInView().find((item) => item.Path === path);
      if (entry !== undefined && isFileLike(entry)) applySaveName(entry.Name);
    },

    toggleSelection(path) {
      // 淡化項目不可選, 點選一律無動作 (亦不改動既有選取); 單選與多選模式下的加減選
      // 行為完全一致, 回傳模式只影響確認條件與確認時回傳的形態, 不影響選取本身.
      if (isDimmedPath(path)) return;
      const wasSelected = state.selection.includes(path);
      const next = wasSelected
        ? state.selection.filter((item) => item !== path)
        : [...state.selection, path];
      setSelection(next, path);
      // 存檔模式下, 以 Ctrl / Cmd 點選 "選中" (非取消選取) 一個檔案時, 比照單純點選把
      // 檔名帶入輸入列, 以最後點到的檔案為準; 取消選取不改動輸入列.
      if (selectionMode !== "save" || wasSelected) return;
      const entry = entriesInView().find((item) => item.Path === path);
      if (entry !== undefined && isFileLike(entry)) applySaveName(entry.Name);
    },

    selectRange(path) {
      // 淡化項目不可選; 單選與多選模式行為一致.
      if (isDimmedPath(path)) return;
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
      // 範圍內的淡化項目自動跳過, 不納入選取.
      const range = entries
        .slice(from, to + 1)
        .filter((entry) => !isDimmed(entry))
        .map((entry) => entry.Path);
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
      state.overwriteConfirm = null;
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
      state.overwriteConfirm = null;
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
      state.overwriteConfirm = null;
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

    cut(paths) {
      // 2026-08-31 裁決: 宿主未提供複製能力時剪下, 複製, 貼上三項一律不提供; 剪下之所以
      // 也隨複製能力進退, 是因為三項要同進同退, 否則會出現剪得走卻無處可貼上的狀態.
      // 搬移能力缺席時的重新命名退回路徑不受影響, 仍只看複製能力.
      if (!state.capabilities.canCopy) return;
      setClipboard("cut", paths);
    },

    copy(paths) {
      // 複製能力缺席時 Copy 選單項目不顯示; 仍在此擋一次, 避免快捷鍵繞過選單.
      if (!state.capabilities.canCopy) return;
      setClipboard("copy", paths);
    },

    paste() {
      return runPaste();
    },

    clearClipboard() {
      if (state.clipboard === null) return;
      state.clipboard = null;
      emit();
    },

    resolvePasteConflict(choice) {
      if (pendingConflict === null) return;
      pendingConflict(choice);
      emit();
    },

    cancelPaste() {
      if (!state.pasting) return;
      cancelRequested = true;
      // 詢問中被取消時以取消作答結束該次詢問, 讓批次流程自行收尾; 進行中的作業則直接
      // 送出取消, 不可取消者留待下一輪迴圈起點中止批次.
      if (pendingConflict !== null) {
        pendingConflict("cancel");
        emit();
        return;
      }
      if (activeCancel === null) return;
      const cancel = activeCancel;
      activeCancel = null;
      cancel();
    },

    dismissPasteOutcome() {
      if (state.pasteOutcome === null) return;
      state.pasteOutcome = null;
      emit();
    },

    refreshCapabilities() {
      return loadCapabilities();
    },

    isEntryCut(entry) {
      const clipboard = state.clipboard;
      return clipboard !== null && clipboard.mode === "cut" && clipboard.paths.includes(entry.Path);
    },

    setSaveName(name) {
      applySaveName(name);
    },

    confirmOverwrite() {
      const confirm = state.overwriteConfirm;
      if (confirm === null) return;
      state.overwriteConfirm = null;
      emit();
      options.onSelect?.(confirm.path);
    },

    cancelOverwrite() {
      if (state.overwriteConfirm === null) return;
      state.overwriteConfirm = null;
      emit();
    },

    dismissError() {
      if (state.error === null) return;
      state.error = null;
      emit();
    },

    confirmSelection() {
      if (!snapshot.canConfirmSelection) return;

      if (selectionMode === "save") {
        let name = state.saveName.trim();
        // 未帶副檔名時補上清單中的第一個副檔名; 已帶者原樣保留.
        if (extensions.length > 0 && !hasExtension(name)) name = `${name}.${extensions[0] as string}`;
        const target = joinPath(state.currentDir, name);
        // 以完整清單 (含隱藏項目) 判定目標是否已存在.
        const existing = state.allEntries.find((entry) => entry.Name === name);
        if (existing !== undefined && effectiveKind(existing) === "dir") {
          state.saveIsDirectory = true;
          emit();
          return;
        }
        if (existing !== undefined) {
          state.overwriteConfirm = { path: target, name };
          emit();
          return;
        }
        options.onSelect?.(target);
        return;
      }

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

    isEntryDimmed(entry) {
      return isDimmed(entry);
    },
  };
}
