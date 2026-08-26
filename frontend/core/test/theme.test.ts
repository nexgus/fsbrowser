// theme 機制: 內建二 theme 的初值, 自訂 theme 的補齊與 CSS 變數轉換.

import { describe, expect, it } from "vitest";
import {
  THEME_KEYS,
  cssVarName,
  darkTheme,
  lightTheme,
  resolveTheme,
  themeToCssVars,
} from "@nexgus/fsb-core";

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
