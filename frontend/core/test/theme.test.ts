// theme 機制: 內建二 theme 的初值, 自訂 theme 的補齊與 CSS 變數轉換.

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  THEME_KEYS,
  cssVarName,
  darkTheme,
  detectSystemTheme,
  lightTheme,
  resolveTheme,
  subscribeSystemTheme,
  themeToCssVars,
} from "@nexgus/fsb-core";

// 測試環境為 node (無 jsdom), 全域沒有 window; 以下輔助函式以 vi.stubGlobal("window", ...)
// 模擬瀏覽器環境, 藉此驗證 detectSystemTheme / subscribeSystemTheme 對 window.matchMedia 的依賴.

/** stubWindowWithoutMatchMedia 模擬有 window 但無 matchMedia 的環境. */
function stubWindowWithoutMatchMedia(): void {
  vi.stubGlobal("window", {});
}

/** mockMatchMedia 模擬有 window.matchMedia 的環境, 固定回報 matches 為 matchesDark. */
function mockMatchMedia(matchesDark: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mql = {
    matches: matchesDark,
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
  };
  vi.stubGlobal("window", { matchMedia: vi.fn().mockReturnValue(mql) });
  return {
    fire(matches: boolean): void {
      mql.matches = matches;
      for (const listener of listeners) listener({ matches } as MediaQueryListEvent);
    },
    listenerCount(): number {
      return listeners.size;
    },
  };
}

describe("內建 theme", () => {
  it("初值依計劃書第 7.2 節表格", () => {
    expect(lightTheme.appBg).toBe("#f0f2f5");
    expect(lightTheme.panelBg).toBe("#ffffff");
    expect(lightTheme.panelBorder).toBe("#d4d8de");
    expect(lightTheme.accent).toBe("#3a6fa8");
    expect(lightTheme.selectedRowBg).toBe("#e4eefa");
    expect(lightTheme.errorText).toBe("#a03e34");
    expect(lightTheme.errorBg).toBe("#fdf1f0");
    expect(lightTheme.folderIcon).toBe("#b08a3e");

    expect(darkTheme.appBg).toBe("#1b1e23");
    expect(darkTheme.panelBg).toBe("#23272e");
    expect(darkTheme.textPrimary).toBe("#d7dbe2");
    expect(darkTheme.accent).toBe("#6ba1d8");
    expect(darkTheme.selectedRowBg).toBe("#2b3b50");
    expect(darkTheme.errorBg).toBe("#352625");
    expect(darkTheme.fileIcon).toBe("#828c98");
  });

  it("危險動作按鈕深淺色相同, 幾何與字體共用", () => {
    expect(darkTheme.dangerBg).toBe(lightTheme.dangerBg);
    expect(darkTheme.radius).toBe("3px");
    expect(darkTheme.radiusPanel).toBe("4px");
    expect(darkTheme.controlHeight).toBe("30px");
    expect(darkTheme.fontFamilyMono).toBe(lightTheme.fontFamilyMono);
  });

  it("兩個內建 theme 的變數鍵完全一致且皆凍結", () => {
    expect(Object.keys(darkTheme).sort()).toEqual(Object.keys(lightTheme).sort());
    expect(Object.isFrozen(lightTheme)).toBe(true);
    expect(Object.isFrozen(darkTheme)).toBe(true);
  });
});

describe("resolveTheme", () => {
  it("未指定時為內建淺色", () => {
    expect(resolveTheme()).toEqual({ ...lightTheme });
  });

  it("以內建名稱指定", () => {
    expect(resolveTheme("dark")).toEqual({ ...darkTheme });
  });

  it("自訂 theme 缺鍵以內建淺色補齊", () => {
    const custom = resolveTheme({ accent: "#ff6600" });
    expect(custom.accent).toBe("#ff6600");
    expect(custom.panelBg).toBe(lightTheme.panelBg);
    expect(Object.keys(custom).length).toBe(THEME_KEYS.length);
  });

  it("空字串視為未提供", () => {
    expect(resolveTheme({ accent: "" }).accent).toBe(lightTheme.accent);
  });
});

describe("系統深淺色 (auto)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("無 matchMedia 時 detectSystemTheme 退回 light", () => {
    stubWindowWithoutMatchMedia();
    expect(detectSystemTheme()).toBe("light");
  });

  it("無 matchMedia 時 resolveTheme(\"auto\") 亦退回內建淺色", () => {
    stubWindowWithoutMatchMedia();
    expect(resolveTheme("auto")).toEqual({ ...lightTheme });
  });

  it("mock matchMedia 為 dark 時 detectSystemTheme 回傳 dark", () => {
    mockMatchMedia(true);
    expect(detectSystemTheme()).toBe("dark");
  });

  it("mock matchMedia 為 dark 時 resolveTheme(\"auto\") 得到內建深色", () => {
    mockMatchMedia(true);
    expect(resolveTheme("auto")).toEqual({ ...darkTheme });
  });

  it("無 matchMedia 時 subscribeSystemTheme 為 no-op, 取消訂閱函式可安全呼叫", () => {
    stubWindowWithoutMatchMedia();
    const callback = vi.fn();
    const unsubscribe = subscribeSystemTheme(callback);
    expect(() => unsubscribe()).not.toThrow();
    expect(callback).not.toHaveBeenCalled();
  });

  it("subscribeSystemTheme 在系統深淺色變更時呼叫 callback, 取消訂閱後不再呼叫", () => {
    const media = mockMatchMedia(false);
    const callback = vi.fn();
    const unsubscribe = subscribeSystemTheme(callback);

    media.fire(true);
    expect(callback).toHaveBeenCalledWith("dark");

    media.fire(false);
    expect(callback).toHaveBeenCalledWith("light");
    expect(callback).toHaveBeenCalledTimes(2);

    unsubscribe();
    expect(media.listenerCount()).toBe(0);
    media.fire(true);
    expect(callback).toHaveBeenCalledTimes(2);
  });
});

describe("CSS 變數", () => {
  it("變數鍵轉為 kebab-case 的 CSS 變數名", () => {
    expect(cssVarName("panelBg")).toBe("--fsb-panel-bg");
    expect(cssVarName("accent")).toBe("--fsb-accent");
    expect(cssVarName("fontFamilyMono")).toBe("--fsb-font-family-mono");
  });

  it("themeToCssVars 產生全部變數", () => {
    const vars = themeToCssVars(resolveTheme("dark"));
    expect(Object.keys(vars).length).toBe(THEME_KEYS.length);
    expect(vars["--fsb-panel-bg"]).toBe("#23272e");
  });
});
