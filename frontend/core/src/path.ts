// 路徑工具: 內部形式 (一律 "/" 分隔, Windows 磁碟機為 "C:/" 字首) 的處理與顯示風格
// 轉換 (計劃書第 4.2 節).

import type { PathStyle } from "./types.js";

const DRIVE_PREFIX = /^([A-Za-z]:)(\/|$)/;

/** 拆出路徑的根字首 ("/" 或 "C:/") 與其餘部分; 相對路徑的字首為空字串. */
function split(path: string): { prefix: string; rest: string } {
  const slashed = path.replace(/\\/g, "/");
  const drive = DRIVE_PREFIX.exec(slashed);
  if (drive) {
    return { prefix: `${drive[1] as string}/`, rest: slashed.slice((drive[0] as string).length) };
  }
  if (slashed.startsWith("/")) return { prefix: "/", rest: slashed.slice(1) };
  return { prefix: "", rest: slashed };
}

/**
 * normalizePath 把路徑正規化為內部形式: 分隔符一律為 "/", 折除重複分隔符與 "." 段,
 * 就地解析 ".." 段, 去除結尾分隔符 (根本身除外). 使用者於路徑列輸入的 "\" 亦一併轉換,
 * 故本函式同時是使用者輸入的正規化入口.
 */
export function normalizePath(path: string): string {
  const { prefix, rest } = split(path);
  const segments: string[] = [];
  for (const segment of rest.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (segments.length > 0 && segments[segments.length - 1] !== "..") segments.pop();
      else if (prefix === "") segments.push("..");
      continue;
    }
    segments.push(segment);
  }
  if (prefix === "/") return `/${segments.join("/")}`;
  if (prefix !== "") return segments.length === 0 ? prefix : prefix + segments.join("/");
  return segments.join("/");
}

/** isAbsolutePath 判斷是否為絕對路徑 (POSIX 的 "/" 開頭或 Windows 的磁碟機字首). */
export function isAbsolutePath(path: string): boolean {
  return split(path).prefix !== "";
}

/** rootOf 取得路徑所屬的根 ("/" 或 "C:/"); 相對路徑回傳空字串. */
export function rootOf(path: string): string {
  return split(path).prefix;
}

/** isRootPath 判斷路徑本身是否即為根. */
export function isRootPath(path: string): boolean {
  const normalized = normalizePath(path);
  const root = rootOf(normalized);
  return root !== "" && normalized === root;
}

/** baseName 取得路徑的最後一段; 根回傳根本身. */
export function baseName(path: string): string {
  const normalized = normalizePath(path);
  if (isRootPath(normalized)) return normalized;
  const index = normalized.lastIndexOf("/");
  return index < 0 ? normalized : normalized.slice(index + 1);
}

/** parentDir 取得父目錄; 已在根時回傳根本身 (導覽至上層於根為無動作). */
export function parentDir(path: string): string {
  const normalized = normalizePath(path);
  if (isRootPath(normalized)) return normalized;
  const index = normalized.lastIndexOf("/");
  if (index < 0) return "";
  const root = rootOf(normalized);
  const parent = normalized.slice(0, index);
  if (parent === "" || (root !== "" && parent.length < root.length)) return root;
  return parent === root.slice(0, -1) ? root : parent;
}

/** joinPath 以內部形式串接路徑段, 結果經正規化. */
export function joinPath(base: string, ...segments: string[]): string {
  const parts = segments.filter((segment) => segment !== "");
  if (parts.length === 0) return normalizePath(base);
  const separator = base.endsWith("/") ? "" : "/";
  return normalizePath(`${base}${separator}${parts.join("/")}`);
}

/**
 * toDisplayPath 依路徑風格轉換為顯示用寫法: Windows 風格把 "/" 顯示為 "\";
 * POSIX 風格原樣呈現. 僅影響顯示, 內部形式不受影響.
 */
export function toDisplayPath(path: string, style: PathStyle): string {
  return style === "windows" ? path.replace(/\//g, "\\") : path;
}

/**
 * fromDisplayPath 把使用者輸入 (可能混用 "/" 與 "\") 正規化回內部形式.
 */
export function fromDisplayPath(input: string): string {
  return normalizePath(input.trim());
}

/**
 * isValidName 檢查單一項目名稱是否可用於建立目錄或重新命名: 不可為空, 不可含分隔符,
 * 不可為 "." 或 "..".
 */
export function isValidName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed === "" || trimmed === "." || trimmed === "..") return false;
  return !trimmed.includes("/") && !trimmed.includes("\\");
}
