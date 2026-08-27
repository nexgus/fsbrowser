// 語言機制: 扁平的 "詞條鍵 -> 顯示文字" 物件 (計劃書第 6.1 節).
//
// 內建英文包為預設與 fallback: 語言包缺少的詞條以英文補齊, 不報錯, 因此部分翻譯的
// 語言包亦可用. 含參數的詞條以具名佔位符 ({name}) 插值. 詞條鍵集合由本檔定義並凍結;
// 新增詞條鍵視為向下相容, 更名或刪除視為破壞性變更 (第 8 章).

import type { ErrorCode, FsbError } from "./errors.js";

/** en 是內建英文語言包, 同時是詞條鍵集合的定義來源. */
export const en = Object.freeze({
  // 標題列
  "title": "Browse Files",
  "mode.file": "Select a file",
  "mode.dir": "Select a directory",
  "mode.save": "Save file",

  // 工具列 (按鈕 tooltip 與路徑列)
  "toolbar.up": "Parent directory",
  "toolbar.home": "Home directory",
  "toolbar.newFolder": "New folder",
  "toolbar.showHidden": "Show hidden items",
  "toolbar.hideHidden": "Hide hidden items",
  "toolbar.root": "Root",
  "toolbar.pathPlaceholder": "Enter a path",

  // 欄位標頭
  "column.name": "Name",
  "column.size": "Size",
  "column.modified": "Modified",

  // 狀態列
  "status.items": "{count} items",
  "status.itemsSelected": "{count} items · {selected} selected",
  "status.loading": "Loading {path}...",
  "status.renaming": "Renaming {name}...",
  "status.creating": "Creating {name}...",
  "status.deleting": "Deleting {count} items...",
  "status.deleteConfirm": "Delete {count} items? This cannot be undone.",
  "status.deleteFailed": "{failed} of {count} items could not be deleted.",

  // 空目錄
  "empty.title": "This directory is empty",
  "empty.hint": "Right-click for New folder",

  // 列內編輯 (重新命名與建立目錄共用)
  "edit.hint": "Enter to confirm · Esc to cancel",
  "newFolder.defaultName": "untitled folder",

  // 存檔模式 (檔名輸入列與覆寫確認)
  "save.namePlaceholder": "File name",
  "save.overwriteConfirm": "\"{name}\" already exists. Overwrite?",
  "save.invalidName": "The file name contains characters that cannot be used.",
  "save.isDirectory": "\"{name}\" is an existing directory. Choose another name.",

  // 右鍵選單
  "menu.rename": "Rename",
  "menu.delete": "Delete",
  "menu.deleteCount": "Delete {count} items",
  "menu.copyPath": "Copy path",
  "menu.newFolder": "New folder",
  "menu.refresh": "Refresh",
  "menu.showHidden": "Show hidden",

  // 按鈕
  "button.cancel": "Cancel",
  "button.select": "Select",
  "button.save": "Save",
  "button.overwrite": "Overwrite",
  "button.delete": "Delete",
  "button.dismissError": "Dismiss",

  // 錯誤 (依錯誤代碼取詞條, 實作訊息作為細節補充)
  "error.not_found": "Path not found.",
  "error.permission_denied": "Permission denied.",
  "error.already_exists": "The target already exists.",
  "error.not_empty": "The directory is not empty.",
  "error.disconnected": "The connection was lost.",
  "error.io_error": "An input/output error occurred.",
  "error.unknown": "An unexpected error occurred.",
  "error.withDetail": "{summary} ({detail})",

  // 項目種類 (供輔助說明與 tooltip)
  "kind.file": "File",
  "kind.dir": "Folder",
  "kind.socket": "Socket",
  "kind.fifo": "Named pipe",
  "kind.device": "Device file",
  "kind.unknown": "Unknown",
  "kind.link": "Link",
  "kind.brokenLink": "Broken link",
});

/** Messages 是完整的詞條表. */
export type Messages = { -readonly [K in keyof typeof en]: string };

/** MessageKey 是凍結的詞條鍵集合. */
export type MessageKey = keyof Messages;

/** MESSAGE_KEYS 是全部詞條鍵的凍結清單. */
export const MESSAGE_KEYS: readonly MessageKey[] = Object.freeze(
  Object.keys(en) as MessageKey[],
);

/** LocalePack 是外部語言包的形態: 可只翻譯部分詞條, 其餘走英文 fallback. */
export type LocalePack = Partial<Messages>;

/** MessageParams 是含參數詞條的具名佔位符對照表. */
export type MessageParams = Record<string, string | number>;

/** Translate 是取詞條文字的函式. */
export type Translate = (key: MessageKey, params?: MessageParams) => string;

/**
 * interpolate 以具名佔位符插值; 語言包未提供對應參數時, 佔位符原樣保留, 以便一眼看出
 * 詞條與參數不符, 而非默默顯示空白.
 */
export function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

/** resolveMessages 以內建英文補齊語言包缺少的詞條, 產生完整詞條表. */
export function resolveMessages(pack?: LocalePack): Messages {
  const resolved = { ...en } as Messages;
  if (!pack) return resolved;
  for (const key of MESSAGE_KEYS) {
    const text = pack[key];
    if (typeof text === "string" && text !== "") resolved[key] = text;
  }
  return resolved;
}

/** createTranslator 依語言包建立取詞條函式; 缺鍵自動以英文補齊. */
export function createTranslator(pack?: LocalePack): Translate {
  const messages = resolveMessages(pack);
  return (key, params) => interpolate(messages[key] ?? en[key], params);
}

/** errorMessageKey 取得錯誤代碼對應的詞條鍵. */
export function errorMessageKey(code: ErrorCode): MessageKey {
  return `error.${code}` as MessageKey;
}

/**
 * formatErrorText 組出狀態列的錯誤文字: 依錯誤代碼取詞條, 實作提供的訊息原樣附加為
 * 細節 (第 4.3, 5.4 節).
 */
export function formatErrorText(t: Translate, error: FsbError): string {
  const summary = t(errorMessageKey(error.code));
  if (error.message === "") return summary;
  return t("error.withDetail", { summary, detail: error.message });
}
