// 項目型別與路徑風格: 與 Go 端 fsb 套件的定義一一對應 (計劃書第 4.1, 4.2 節).
// 欄位名沿用 Wails bindings 產生的 PascalCase, 不另做欄位改名, 以免多一層無謂的轉換.

/** Kind 是項目的基本種類. "missing" 僅用於 Entry.Target, 表示失效連結. */
export type Kind = "file" | "dir" | "socket" | "fifo" | "device" | "unknown" | "missing";

/** KINDS 是基本種類的凍結集合. */
export const KINDS: readonly Kind[] = Object.freeze([
  "file",
  "dir",
  "socket",
  "fifo",
  "device",
  "unknown",
  "missing",
]);

/** Entry 是單一路徑項目的屬性. Path 一律為內部形式 (第 4.2 節). */
export interface Entry {
  /** 項目名稱 (不含路徑). */
  Name: string;
  /** 項目的完整路徑, 內部形式. */
  Path: string;
  /** 基本種類; IsLink 為 true 時為連結本身的種類. */
  Kind: Kind;
  /** 項目本身是否為連結. */
  IsLink: boolean;
  /** IsLink 為 true 時, 實作解析後的目標種類; 目標不存在時為 "missing". */
  Target: Kind;
  /** 位元組數. */
  Size: number;
  /** 修改時間, ISO 8601 UTC 字串 (例如 "2026-01-23T04:30:00Z"). */
  ModTime: string;
  /** 是否為隱藏項目. */
  Hidden: boolean;
}

/** PathStyle 是實作回報的路徑風格, 僅影響顯示層 (第 4.2 節). */
export type PathStyle = "posix" | "windows";

/** 選取模式: 元件要使用者挑的是檔案還是目錄 (開啟參數). */
export type SelectionMode = "file" | "dir";

/** 回傳模式: 選定結果為單一路徑或路徑陣列 (開啟參數). */
export type ReturnMode = "single" | "multiple";

/**
 * effectiveKind 取得項目的有效種類: 非連結者為其基本種類, 連結者為解析後的目標種類
 * (進入即 follow 的語意, 第 4.1 節).
 */
export function effectiveKind(entry: Entry): Kind {
  return entry.IsLink ? entry.Target : entry.Kind;
}

/** isBrokenLink 判斷是否為失效連結 (解析目標不存在). */
export function isBrokenLink(entry: Entry): boolean {
  return entry.IsLink && entry.Target === "missing";
}

/** isSpecial 判斷是否為特殊檔案 (socket, FIFO, 裝置檔或未知種類). */
export function isSpecial(entry: Entry): boolean {
  const kind = effectiveKind(entry);
  return kind === "socket" || kind === "fifo" || kind === "device" || kind === "unknown";
}

/** isDirectoryLike 判斷是否可進入 (目錄, 或連結到目錄者). */
export function isDirectoryLike(entry: Entry): boolean {
  return effectiveKind(entry) === "dir";
}

/** isFileLike 判斷是否為一般檔案 (或連結到一般檔案者). */
export function isFileLike(entry: Entry): boolean {
  return effectiveKind(entry) === "file";
}

/**
 * isSelectableAs 判斷項目能否作為選定結果: 特殊檔案與失效連結一律不可 (可刪除與重新
 * 命名, 但不可選取, 第 4.1 節); 其餘依選取模式判定.
 */
export function isSelectableAs(entry: Entry, mode: SelectionMode): boolean {
  if (isBrokenLink(entry) || isSpecial(entry)) return false;
  return mode === "dir" ? isDirectoryLike(entry) : isFileLike(entry);
}
