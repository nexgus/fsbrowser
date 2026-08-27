// 繁體中文語言包 (計劃書第 6.1 節).
//
// 本包隨 core 發佈但不內建為預設: 宿主要用繁體中文時 import 本包並於開啟參數傳入,
// 與任何第三方自製語言包走完全相同的路徑:
//
//     import { zhHant } from "@nexgus/fsb-locales";
//     <FsBrowser :client="fsbClient" :locale="zhHant" />
//
// 型別為 core 匯出的 LocalePack (詞條鍵集合由 core 定義並凍結); 缺鍵會以內建英文補齊,
// 本包則逐鍵翻譯, 不留缺口.

import type { LocalePack } from "@nexgus/fsb-core";

/** zhHant 是繁體中文語言包. */
export const zhHant: LocalePack = {
  // 標題列
  "title": "瀏覽檔案",
  "mode.file": "請選擇檔案",
  "mode.dir": "請選擇目錄",

  // 工具列
  "toolbar.up": "上層目錄",
  "toolbar.home": "家目錄",
  "toolbar.newFolder": "新增資料夾",
  "toolbar.showHidden": "顯示隱藏項目",
  "toolbar.hideHidden": "隱藏隱藏項目",
  "toolbar.root": "根",
  "toolbar.pathPlaceholder": "輸入路徑",

  // 欄位標頭
  "column.name": "名稱",
  "column.size": "大小",
  "column.modified": "修改時間",

  // 狀態列
  "status.items": "{count} 個項目",
  "status.itemsSelected": "{count} 個項目 · 已選 {selected} 個",
  "status.loading": "正在載入 {path}...",
  "status.renaming": "正在重新命名 {name}...",
  "status.creating": "正在建立 {name}...",
  "status.deleting": "正在刪除 {count} 個項目...",
  "status.deleteConfirm": "確定刪除 {count} 個項目? 此操作無法復原.",
  "status.deleteFailed": "{count} 個項目中有 {failed} 個無法刪除.",

  // 空目錄
  "empty.title": "此目錄沒有任何項目",
  "empty.hint": "按右鍵可新增資料夾",

  // 列內編輯
  "edit.hint": "Enter 確認 · Esc 取消",
  "newFolder.defaultName": "未命名資料夾",

  // 右鍵選單
  "menu.rename": "重新命名",
  "menu.delete": "刪除",
  "menu.deleteCount": "刪除 {count} 個項目",
  "menu.copyPath": "複製路徑",
  "menu.newFolder": "新增資料夾",
  "menu.refresh": "重新整理",
  "menu.showHidden": "顯示隱藏項目",

  // 按鈕
  "button.cancel": "取消",
  "button.select": "確定",
  "button.delete": "刪除",
  "button.dismissError": "關閉",

  // 錯誤
  "error.not_found": "找不到指定的路徑.",
  "error.permission_denied": "權限不足.",
  "error.already_exists": "目標已存在.",
  "error.not_empty": "目錄不是空的.",
  "error.disconnected": "連線已中斷.",
  "error.io_error": "讀寫時發生錯誤.",
  "error.unknown": "發生未預期的錯誤.",
  "error.withDetail": "{summary} ({detail})",

  // 項目種類
  "kind.file": "檔案",
  "kind.dir": "資料夾",
  "kind.socket": "Socket",
  "kind.fifo": "具名管線",
  "kind.device": "裝置檔",
  "kind.unknown": "未知",
  "kind.link": "連結",
  "kind.brokenLink": "失效連結",
};

export default zhHant;
