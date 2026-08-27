// @nexgus/fsb-core: 框架無關的純 TypeScript 邏輯層 (計劃書第 5.2 節).
// Vue 3 與 React 元件皆依賴本套件, 各自只需薄薄包一層框架繫結.

export type { Entry, Kind, PathStyle, ReturnMode, SelectionMode } from "./types.js";
export {
  KINDS,
  effectiveKind,
  isBrokenLink,
  isDirectoryLike,
  isFileLike,
  isSelectableAs,
  isSpecial,
  matchesExtensions,
  normalizeExtensions,
} from "./types.js";

export type { ErrorCode, FsbError, FsbOperation } from "./errors.js";
export { ERROR_CODES, FsbOperationError, isErrorCode, normalizeError, toFsbError } from "./errors.js";

export type { FsbBindings, FsbClient } from "./client.js";
export { REQUIRED_BINDING_METHODS, createClient, missingBindingMethods } from "./client.js";

export {
  baseName,
  fromDisplayPath,
  isAbsolutePath,
  isRootPath,
  isValidName,
  joinPath,
  normalizePath,
  parentDir,
  rootOf,
  toDisplayPath,
} from "./path.js";

export type { SizeUnitSystem } from "./format.js";
export { formatDateTime, formatSize } from "./format.js";

export type { LocalePack, MessageKey, MessageParams, Messages, Translate } from "./i18n.js";
export {
  MESSAGE_KEYS,
  createTranslator,
  en,
  errorMessageKey,
  formatErrorText,
  interpolate,
  resolveMessages,
} from "./i18n.js";

export type { Theme, ThemeKey, ThemeName, ThemeOption, ThemeOverrides } from "./theme.js";
export {
  THEME_KEYS,
  builtinThemes,
  cssVarName,
  darkTheme,
  detectSystemTheme,
  lightTheme,
  resolveTheme,
  subscribeSystemTheme,
  themeToCssVars,
} from "./theme.js";

export type {
  BrowserSnapshot,
  BrowserStore,
  BrowserStoreOptions,
  DeleteConfirmState,
  NewFolderState,
  OverwriteConfirmState,
  RenameState,
  SaveNameIssue,
} from "./store.js";
export { createBrowserStore } from "./store.js";
