// 結構化錯誤: 把 bindings 拋出的任意例外正規化為 "錯誤代碼 + 訊息 + 發生的操作與路徑"
// (計劃書第 4.3, 5.3 節).

/** ErrorCode 是結構化錯誤的代碼列舉, 集合隨版本凍結. */
export type ErrorCode =
  | "not_found"
  | "permission_denied"
  | "already_exists"
  | "not_empty"
  | "disconnected"
  | "io_error"
  | "unknown";

/** ERROR_CODES 是錯誤代碼的凍結集合. */
export const ERROR_CODES: readonly ErrorCode[] = Object.freeze([
  "not_found",
  "permission_denied",
  "already_exists",
  "not_empty",
  "disconnected",
  "io_error",
  "unknown",
]);

/** FsbOperation 是 client 的操作名稱, 用於標示錯誤發生在哪一個操作. */
export type FsbOperation =
  | "list"
  | "stat"
  | "home"
  | "roots"
  | "pathStyle"
  | "makeDir"
  | "rename"
  | "delete";

/** FsbError 是外拋給宿主與存放於狀態中的結構化錯誤 (純資料, 可直接序列化). */
export interface FsbError {
  /** 錯誤代碼; 無法辨識者為 "unknown". */
  code: ErrorCode;
  /** 實作提供的人類可讀訊息, 作為補充細節原樣顯示. */
  message: string;
  /** 發生錯誤的操作. */
  operation: FsbOperation;
  /** 發生錯誤的路徑 (若該操作有路徑參數). */
  path?: string;
}

/**
 * FsbOperationError 是 client 呼叫失敗時實際拋出的例外: 既是標準 Error (可被一般
 * try / catch 與堆疊追蹤處理), 亦攜帶結構化欄位.
 */
export class FsbOperationError extends Error {
  readonly code: ErrorCode;
  readonly operation: FsbOperation;
  readonly path: string | undefined;
  /** 觸發本錯誤的原始拋出物, 供除錯用. */
  override readonly cause: unknown;

  constructor(error: FsbError, cause?: unknown) {
    super(error.message);
    this.name = "FsbOperationError";
    this.code = error.code;
    this.operation = error.operation;
    this.path = error.path;
    this.cause = cause;
  }

  /** toStructured 取出純資料形式的結構化錯誤. */
  toStructured(): FsbError {
    const error: FsbError = { code: this.code, message: this.message, operation: this.operation };
    if (this.path !== undefined) error.path = this.path;
    return error;
  }
}

/** isErrorCode 判斷任意值是否為合法的錯誤代碼. */
export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && (ERROR_CODES as readonly string[]).includes(value);
}

function readCandidate(value: unknown): { code?: unknown; message?: unknown } | null {
  if (typeof value !== "object" || value === null) return null;
  return value as { code?: unknown; message?: unknown };
}

/**
 * normalizeError 把任意拋出物正規化為 FsbOperationError.
 *
 * 辨識順序: 拋出物的 cause 屬性 (Wails 把 Go 端序列化的 {code, message} 掛在此處),
 * 其次為拋出物本身的同名屬性; 皆不可辨識時歸類為 "unknown", 訊息取自 Error.message
 * 或字串化結果.
 */
export function normalizeError(
  thrown: unknown,
  operation: FsbOperation,
  path?: string,
): FsbOperationError {
  if (thrown instanceof FsbOperationError) return thrown;

  const self = readCandidate(thrown);
  const cause = self ? readCandidate((self as { cause?: unknown }).cause) : null;
  const source = cause && (isErrorCode(cause.code) || typeof cause.message === "string") ? cause : self;

  let code: ErrorCode = "unknown";
  let message = "";
  if (source) {
    if (isErrorCode(source.code)) code = source.code;
    if (typeof source.message === "string") message = source.message;
  }
  if (message === "") {
    if (thrown instanceof Error) message = thrown.message;
    else if (typeof thrown === "string") message = thrown;
    else if (thrown !== undefined && thrown !== null) message = String(thrown);
  }

  const error: FsbError = { code, message, operation };
  if (path !== undefined) error.path = path;
  return new FsbOperationError(error, thrown);
}

/** toFsbError 把任意拋出物正規化為純資料形式的結構化錯誤. */
export function toFsbError(thrown: unknown, operation: FsbOperation, path?: string): FsbError {
  return normalizeError(thrown, operation, path).toStructured();
}
