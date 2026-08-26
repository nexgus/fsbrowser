// client 介面與 createClient: 把宿主產生的 Wails bindings 收斂成 UI 元件唯一依賴的
// 呼叫介面 (計劃書第 5.1 節). UI 元件只依賴 FsbClient, 不寫死 bindings 的檔案路徑,
// 因此單元測試以 mock client 進行, 元件層完全不依賴 Wails.

import { normalizeError } from "./errors.js";
import type { Entry, Kind, PathStyle } from "./types.js";
import { KINDS } from "./types.js";

/** FsbClient 是 UI 元件對橋接層的全部呼叫; 路徑進出一律為內部形式 (第 4.2 節). */
export interface FsbClient {
  /** 列出目錄內容. */
  list(dir: string): Promise<Entry[]>;
  /** 查詢單一路徑的屬性. */
  stat(path: string): Promise<Entry>;
  /** 取得起始 / 家目錄. */
  home(): Promise<string>;
  /** 取得所有根 (POSIX 為單一根; Windows 為各磁碟機). */
  roots(): Promise<string[]>;
  /** 取得路徑風格, 僅影響顯示層. */
  pathStyle(): Promise<PathStyle>;
  /** 建立目錄. */
  makeDir(path: string): Promise<void>;
  /** 重新命名. */
  rename(oldPath: string, newPath: string): Promise<void>;
  /** 刪除單一檔案或目錄; 元件不遞迴, 對選取集中每個項目各呼叫一次. */
  delete(path: string): Promise<void>;
}

/**
 * REQUIRED_BINDING_METHODS 是 bindings 必須提供的方法名 (橋接層 service 的方法名,
 * PascalCase). SetFileSystem 屬宿主端操作, UI 元件不使用, 故不列入驗證.
 */
export const REQUIRED_BINDING_METHODS: readonly string[] = Object.freeze([
  "List",
  "Stat",
  "Home",
  "Roots",
  "PathStyle",
  "MakeDir",
  "Rename",
  "Delete",
]);

/** FsbBindings 描述 wails3 generate bindings 產生的橋接層模組形態. */
export interface FsbBindings {
  List(dir: string): Promise<unknown>;
  Stat(path: string): Promise<unknown>;
  Home(): Promise<unknown>;
  Roots(): Promise<unknown>;
  PathStyle(): Promise<unknown>;
  MakeDir(path: string): Promise<unknown>;
  Rename(oldPath: string, newPath: string): Promise<unknown>;
  Delete(path: string): Promise<unknown>;
}

function asKind(value: unknown): Kind {
  return typeof value === "string" && (KINDS as readonly string[]).includes(value)
    ? (value as Kind)
    : "unknown";
}

/**
 * toEntry 把 bindings 回傳的物件收斂為 Entry: 欄位缺漏或型別不符時以安全預設值補齊,
 * 避免任何一列的異常資料使整個列表無法呈現.
 */
function toEntry(value: unknown): Entry {
  const source = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  const modTime = source["ModTime"];
  return {
    Name: typeof source["Name"] === "string" ? source["Name"] : "",
    Path: typeof source["Path"] === "string" ? source["Path"] : "",
    Kind: asKind(source["Kind"]),
    IsLink: source["IsLink"] === true,
    Target: asKind(source["Target"]),
    Size: typeof source["Size"] === "number" ? source["Size"] : 0,
    ModTime:
      typeof modTime === "string"
        ? modTime
        : modTime instanceof Date
          ? modTime.toISOString()
          : "",
    Hidden: source["Hidden"] === true,
  };
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function toPathStyle(value: unknown): PathStyle {
  return value === "windows" ? "windows" : "posix";
}

/**
 * missingBindingMethods 回傳 bindings 缺少的方法名清單; 全部齊備時回傳空陣列.
 */
export function missingBindingMethods(bindings: unknown): string[] {
  if (typeof bindings !== "object" && typeof bindings !== "function") return [...REQUIRED_BINDING_METHODS];
  if (bindings === null) return [...REQUIRED_BINDING_METHODS];
  const source = bindings as Record<string, unknown>;
  return REQUIRED_BINDING_METHODS.filter((name) => typeof source[name] !== "function");
}

/**
 * createClient 把 wails3 generate bindings 產生的模組收斂成 FsbClient.
 *
 * 宿主的接線檔為唯一與 Wails 綁定之處:
 *
 *     import * as bindings from "./bindings/github.com/nexgus/fsbrowser/service";
 *     import { createClient } from "@nexgus/fsb-core";
 *     export const fsbClient = createClient(bindings);
 *
 * bindings 缺少任一必要方法時立即丟出明確錯誤 (列出缺少的方法名), 使接線問題在啟動時
 * 就暴露, 而非等到使用者按下某個按鈕才失敗. 所有呼叫的失敗一律正規化為
 * FsbOperationError (第 4.3 節).
 */
export function createClient(bindings: FsbBindings): FsbClient {
  const missing = missingBindingMethods(bindings);
  if (missing.length > 0) {
    throw new Error(
      `createClient: bindings 缺少必要方法 ${missing.join(", ")}; ` +
        `必要方法為 ${REQUIRED_BINDING_METHODS.join(", ")}. ` +
        "請確認傳入的是 fsbrowser 橋接層 service 的 bindings 模組.",
    );
  }

  async function call<T>(
    operation: Parameters<typeof normalizeError>[1],
    path: string | undefined,
    invoke: () => Promise<unknown> | unknown,
    convert: (value: unknown) => T,
  ): Promise<T> {
    try {
      return convert(await invoke());
    } catch (thrown) {
      throw normalizeError(thrown, operation, path);
    }
  }

  return {
    list: (dir) =>
      call("list", dir, () => bindings.List(dir), (value) =>
        Array.isArray(value) ? value.map(toEntry) : [],
      ),
    stat: (path) => call("stat", path, () => bindings.Stat(path), toEntry),
    home: () =>
      call("home", undefined, () => bindings.Home(), (value) =>
        typeof value === "string" ? value : "",
      ),
    roots: () => call("roots", undefined, () => bindings.Roots(), toStringList),
    pathStyle: () => call("pathStyle", undefined, () => bindings.PathStyle(), toPathStyle),
    makeDir: (path) => call("makeDir", path, () => bindings.MakeDir(path), () => undefined),
    rename: (oldPath, newPath) =>
      call("rename", oldPath, () => bindings.Rename(oldPath, newPath), () => undefined),
    delete: (path) => call("delete", path, () => bindings.Delete(path), () => undefined),
  };
}
