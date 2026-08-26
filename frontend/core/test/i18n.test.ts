// 語言機制: fallback, 插值與繁體中文語言包的覆蓋率.

import { describe, expect, it } from "vitest";
import {
  MESSAGE_KEYS,
  createTranslator,
  en,
  errorMessageKey,
  formatErrorText,
  interpolate,
  resolveMessages,
} from "@nexgus/fsb-core";
import type { FsbError, LocalePack, MessageKey } from "@nexgus/fsb-core";
import { zhHant } from "../../locales/zh-Hant.js";

describe("詞條鍵集合", () => {
  it("鍵集合凍結且無重複", () => {
    expect(Object.isFrozen(en)).toBe(true);
    expect(new Set(MESSAGE_KEYS).size).toBe(MESSAGE_KEYS.length);
    expect(MESSAGE_KEYS.length).toBeGreaterThan(0);
  });

  it("每個錯誤代碼皆有對應詞條", () => {
    for (const code of ["not_found", "permission_denied", "already_exists", "not_empty", "disconnected", "io_error", "unknown"] as const) {
      expect(MESSAGE_KEYS).toContain(errorMessageKey(code));
    }
  });
});

describe("fallback", () => {
  it("語言包缺鍵以內建英文補齊, 不報錯", () => {
    const partial: LocalePack = { "title": "瀏覽檔案" };
    const t = createTranslator(partial);
    expect(t("title")).toBe("瀏覽檔案");
    expect(t("button.cancel")).toBe(en["button.cancel"]);
    const resolved = resolveMessages(partial);
    expect(Object.keys(resolved).length).toBe(MESSAGE_KEYS.length);
  });

  it("空字串視為未翻譯, 走英文", () => {
    const t = createTranslator({ "button.select": "" });
    expect(t("button.select")).toBe(en["button.select"]);
  });

  it("未提供語言包時全為英文", () => {
    const t = createTranslator();
    expect(t("title")).toBe("Browse Files");
    expect(t("edit.hint")).toBe("Enter to confirm · Esc to cancel");
  });
});

describe("插值", () => {
  it("以具名佔位符插值", () => {
    const t = createTranslator();
    expect(t("status.itemsSelected", { count: 5, selected: 1 })).toBe("5 items · 1 selected");
    expect(t("status.deleteConfirm", { count: 3 })).toBe("Delete 3 items? This cannot be undone.");
    expect(t("status.loading", { path: "/home/gus" })).toBe("Loading /home/gus...");
  });

  it("缺少參數時佔位符原樣保留", () => {
    expect(interpolate("Delete {count} items", {})).toBe("Delete {count} items");
    expect(interpolate("no params")).toBe("no params");
  });
});

describe("錯誤文字", () => {
  it("依代碼取詞條並附上實作訊息作為細節", () => {
    const t = createTranslator();
    const error: FsbError = {
      code: "permission_denied",
      message: "open /root: permission denied",
      operation: "list",
      path: "/root",
    };
    expect(formatErrorText(t, error)).toBe("Permission denied. (open /root: permission denied)");
  });

  it("訊息為空時只顯示代碼詞條", () => {
    const t = createTranslator();
    expect(formatErrorText(t, { code: "unknown", message: "", operation: "home" })).toBe(
      "An unexpected error occurred.",
    );
  });
});

describe("繁體中文語言包", () => {
  it("覆蓋全部詞條鍵且無多餘鍵", () => {
    const keys = Object.keys(zhHant) as MessageKey[];
    expect(new Set(keys)).toEqual(new Set(MESSAGE_KEYS));
    for (const key of MESSAGE_KEYS) expect(zhHant[key]).not.toBe("");
  });

  it("含參數的詞條保留同名佔位符", () => {
    const t = createTranslator(zhHant);
    expect(t("status.deleteConfirm", { count: 3 })).toBe("確定刪除 3 個項目? 此操作無法復原.");
    expect(t("status.itemsSelected", { count: 5, selected: 1 })).toBe("5 個項目 · 已選 1 個");
  });
});
