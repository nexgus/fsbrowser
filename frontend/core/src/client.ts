// client 介面與 createClient: 把宿主產生的 Wails bindings 收斂成 UI 元件唯一依賴的
// 呼叫介面 (計劃書第 5.1 節). UI 元件只依賴 FsbClient, 不寫死 bindings 的檔案路徑,
// 因此單元測試以 mock client 進行, 元件層完全不依賴 Wails.

import { normalizeError } from "./errors.js";
import type { Entry, Kind, PathStyle } from "./types.js";
import { KINDS } from "./types.js";

/**
 * FsbCapabilities 是宿主實作滿足的選用能力 (計劃書第 3.1, 3.2 節). 三項皆為選用: 缺席
 * 時元件自動收斂 (隱藏選單項目或改走退回路徑), 不視為錯誤.
 */
export interface FsbCapabilities {
  /** 是否可遞迴複製; 為否時 Copy 選單項目不顯示. */
  canCopy: boolean;
  /** 是否可搬移; 為否時剪下貼上改以跨目錄重新命名完成 (退回路徑). */
  canMove: boolean;
  /** 是否可取消進行中的複製或搬移; 為否時不顯示取消. */
  canCancel: boolean;
}

/**
 * FsbOperationHandle 是一次複製或搬移作業的把手: 作業結果與 (可能存在的) 取消函式.
 *
 * 複製與搬移可能長時間進行, 呼叫端需要在等待結果的同時保有取消的手段, 因此本介面採
 * 同步回傳: 呼叫發出的當下即可取得取消函式, 不必等到作業結束.
 */
export interface FsbOperationHandle {
  /** 作業結果; 失敗一律為 FsbOperationError. */
  result: Promise<void>;
  /**
   * 取消進行中的作業; 底層回傳物件未提供可呼叫的取消方法時為 undefined.
   * 取消後 result 會以失敗收場 (代碼視實作而定), 呼叫端自行判定該失敗是否出於取消.
   */
  cancel?: () => void;
}

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
  /** 查詢宿主實作滿足哪些選用能力; 宿主抽換實作後再查一次即得到新結果. */
  capabilities(): Promise<FsbCapabilities>;
  /**
   * 遞迴複製: 來源為目錄時由宿主自行走訪整棵樹, 元件不遞迴.
   * overwrite 為 true 時, 目標已存在的同名項目一律覆寫 (含遞迴過程中的每一層).
   */
  copy(src: string, dst: string, overwrite: boolean): FsbOperationHandle;
  /** 搬移: 語意同 copy, 但來源於成功後不再存在. */
  move(src: string, dst: string, overwrite: boolean): FsbOperationHandle;
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
  "Capabilities",
  "Copy",
  "Move",
]);

/**
 * FsbBindings 描述 wails3 generate bindings 產生的橋接層模組形態.
 *
 * Copy 與 Move 的回傳型別刻意寫為 unknown 而非 Promise: 這兩個呼叫的回傳物件除了作為
 * 結果的 promise, 還可能帶有取消方法, 宣告為 Promise 會使該方法在型別上不可見.
 * bindings 的 context 參數不出現在前端簽章, 故此處只有三個參數.
 */
export interface FsbBindings {
  List(dir: string): Promise<unknown>;
  Stat(path: string): Promise<unknown>;
  Home(): Promise<unknown>;
  Roots(): Promise<unknown>;
  PathStyle(): Promise<unknown>;
  MakeDir(path: string): Promise<unknown>;
  Rename(oldPath: string, newPath: string): Promise<unknown>;
  Delete(path: string): Promise<unknown>;
  Capabilities(): Promise<unknown>;
  Copy(src: string, dst: string, overwrite: boolean): unknown;
  Move(src: string, dst: string, overwrite: boolean): unknown;
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
 * CAPABILITY_FIELDS 是每項能力可接受的欄位名.
 *
 * 能力物件的欄位名取決於 Go 端結構的 json tag, 前端無從在編譯期驗證; 一旦兩端寫法不一致
 * (PascalCase 與 camelCase 之別), 嚴格比對的結果會是所有能力靜默歸零, 症狀是選單項目
 * 全部消失而毫無線索. 因此此處同時接受兩種常見寫法, 並在任何欄位缺漏或型別不符時一律
 * 視為該能力不存在 -- 誤判為 "不支援" 只會少一個選單項目, 誤判為 "支援" 則會讓使用者
 * 按下註定失敗的操作, 兩者代價不對等.
 */
const CAPABILITY_FIELDS = Object.freeze({
  canCopy: Object.freeze(["canCopy", "CanCopy", "copy", "Copy"]),
  canMove: Object.freeze(["canMove", "CanMove", "move", "Move"]),
  canCancel: Object.freeze(["canCancel", "CanCancel", "cancel", "Cancel"]),
});

function readCapabilityFlag(source: Record<string, unknown>, names: readonly string[]): boolean {
  for (const name of names) {
    const value = source[name];
    if (typeof value === "boolean") return value;
  }
  return false;
}

/** toCapabilities 把 bindings 回傳的能力物件收斂為 FsbCapabilities. */
function toCapabilities(value: unknown): FsbCapabilities {
  const source = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  return {
    canCopy: readCapabilityFlag(source, CAPABILITY_FIELDS.canCopy),
    canMove: readCapabilityFlag(source, CAPABILITY_FIELDS.canMove),
    canCancel: readCapabilityFlag(source, CAPABILITY_FIELDS.canCancel),
  };
}

/**
 * readCancel 取出回傳物件上的取消方法.
 *
 * core 不依賴 Wails: 判斷方式僅為 "回傳物件上是否有可呼叫的 cancel", 因此任何提供同名
 * 方法的呼叫層 (例如未來的純 web + HTTP 實作) 皆自動適用. 取消方法本身可能回傳 promise
 * (Wails 的 CancellablePromise 即是), 此處先行接住其失敗, 避免產生無人處理的 rejection
 * -- 取消是否奏效由後續作業結果反映, 不需要另行回報.
 */
function readCancel(returned: unknown): (() => void) | undefined {
  if (typeof returned !== "object" || returned === null) return undefined;
  const candidate = (returned as { cancel?: unknown }).cancel;
  if (typeof candidate !== "function") return undefined;
  return () => {
    const outcome = (candidate as (this: unknown) => unknown).call(returned);
    if (typeof (outcome as { then?: unknown } | null)?.then === "function") {
      void (outcome as Promise<unknown>).catch(() => undefined);
    }
  };
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

  /**
   * startOperation 發出一次複製或搬移呼叫, 並把回傳物件收斂為 FsbOperationHandle.
   * 呼叫本身若同步拋出 (例如 bindings 內部的參數檢查), 一樣正規化為失敗的結果, 使呼叫端
   * 只需處理一種失敗形式.
   */
  function startOperation(
    operation: "copy" | "move",
    src: string,
    invoke: () => unknown,
  ): FsbOperationHandle {
    let returned: unknown;
    try {
      returned = invoke();
    } catch (thrown) {
      return { result: Promise.reject(normalizeError(thrown, operation, src)) };
    }
    const result = Promise.resolve(returned).then(
      () => undefined,
      (thrown: unknown) => {
        throw normalizeError(thrown, operation, src);
      },
    );
    const cancel = readCancel(returned);
    return cancel === undefined ? { result } : { result, cancel };
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
    capabilities: () =>
      call("capabilities", undefined, () => bindings.Capabilities(), toCapabilities),
    copy: (src, dst, overwrite) =>
      startOperation("copy", src, () => bindings.Copy(src, dst, overwrite)),
    move: (src, dst, overwrite) =>
      startOperation("move", src, () => bindings.Move(src, dst, overwrite)),
  };
}
