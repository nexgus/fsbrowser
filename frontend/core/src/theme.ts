// theme 機制: 扁平的 "變數鍵 -> 值" 物件, 實作上對應 CSS 變數 (計劃書第 6.2 節).
//
// 內建淺色與深色兩個 theme, 初值取自計劃書第 7.2 節的定案表格. 宿主提供同結構的變數表
// 即為自訂 theme, 未提供的變數以內建淺色補齊, 因此只覆寫少數變數 (例如換強調色) 亦可.
// 變數鍵集合由本檔定義並凍結; 新增視為向下相容, 更名或刪除視為破壞性變更 (第 8 章).

const SYSTEM_FONT =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const MONO_FONT = '"JetBrains Mono", Menlo, monospace';

/** lightTheme 是內建淺色 theme, 同時是變數鍵集合的定義來源與自訂 theme 的補齊來源. */
export const lightTheme = Object.freeze({
  // 色彩
  appBg: "#f0f2f5",
  panelBg: "#ffffff",
  panelBorder: "#d4d8de",
  sectionBorder: "#e2e5ea",
  rowBorder: "#f0f2f5",
  subtleBg: "#fafbfc",
  buttonBg: "#f4f6f8",
  textPrimary: "#22262b",
  textSecondary: "#6b7280",
  textMuted: "#9aa2ad",
  accent: "#3a6fa8",
  selectedRowBg: "#e4eefa",
  errorText: "#a03e34",
  errorBg: "#fdf1f0",
  dangerBg: "#b2453a",
  folderIcon: "#b08a3e",
  fileIcon: "#8a94a0",

  // 字體與字級
  fontFamily: SYSTEM_FONT,
  fontFamilyMono: MONO_FONT,
  fontSizeTitle: "14px",
  fontSizeRow: "13px",
  fontSizeStatus: "12px",
  fontSizeLabel: "11px",
  fontSizeMono: "11px",
  fontWeightTitle: "600",

  // 幾何
  radius: "3px",
  radiusPanel: "4px",
  controlHeight: "30px",
  rowHeight: "30px",
  iconSize: "16px",
});

/** darkTheme 是內建深色 theme. */
export const darkTheme: Theme = Object.freeze({
  ...lightTheme,
  appBg: "#1b1e23",
  panelBg: "#23272e",
  panelBorder: "#3a4048",
  sectionBorder: "#2f343c",
  rowBorder: "#262b32",
  subtleBg: "#1f2329",
  buttonBg: "#2b3038",
  textPrimary: "#d7dbe2",
  textSecondary: "#98a1ad",
  textMuted: "#6b747f",
  accent: "#6ba1d8",
  selectedRowBg: "#2b3b50",
  errorText: "#e0968c",
  errorBg: "#352625",
  dangerBg: "#b2453a",
  folderIcon: "#c9a35c",
  fileIcon: "#828c98",
});

/** Theme 是完整的視覺變數表. */
export type Theme = { -readonly [K in keyof typeof lightTheme]: string };

/** ThemeKey 是凍結的變數鍵集合. */
export type ThemeKey = keyof Theme;

/** THEME_KEYS 是全部變數鍵的凍結清單. */
export const THEME_KEYS: readonly ThemeKey[] = Object.freeze(Object.keys(lightTheme) as ThemeKey[]);

/** ThemeOverrides 是自訂 theme 的形態: 只需提供要覆寫的變數. */
export type ThemeOverrides = Partial<Theme>;

/** ThemeName 是內建 theme 的名稱. */
export type ThemeName = "light" | "dark";

/** ThemeOption 是開啟參數可傳入的 theme: 內建名稱, 自動依系統深淺色, 或自訂變數表. */
export type ThemeOption = ThemeName | "auto" | ThemeOverrides;

/** builtinThemes 是內建 theme 的查表. */
export const builtinThemes: Readonly<Record<ThemeName, Theme>> = Object.freeze({
  light: lightTheme,
  dark: darkTheme,
});

const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

/**
 * detectSystemTheme 偵測目前系統的深淺色偏好, 回傳對應的內建 theme 名稱.
 * 無 `window` 或無 `matchMedia` 的環境 (SSR / 測試) 一律回傳 "light".
 */
export function detectSystemTheme(): ThemeName {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia(DARK_MEDIA_QUERY).matches ? "dark" : "light";
}

/**
 * subscribeSystemTheme 訂閱系統深淺色偏好變更: 變更時以新的 ThemeName 呼叫 callback,
 * 回傳取消訂閱函式. 無 `matchMedia` 的環境為 no-op, 回傳空的取消函式.
 */
export function subscribeSystemTheme(callback: (theme: ThemeName) => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
  const media = window.matchMedia(DARK_MEDIA_QUERY);
  const listener = (event: MediaQueryListEvent): void => {
    callback(event.matches ? "dark" : "light");
  };
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

/**
 * resolveTheme 把開啟參數的 theme 補齊為完整變數表: 傳入內建名稱時取該內建 theme;
 * 傳入 "auto" 時依系統深淺色偏好取對應內建 theme; 傳入自訂變數表時, 缺少的變數一律以
 * 內建淺色補齊 (第 6.2 節). 未提供時為內建淺色.
 */
export function resolveTheme(option?: ThemeOption): Theme {
  if (option === undefined) return { ...lightTheme };
  if (option === "auto") return { ...builtinThemes[detectSystemTheme()] };
  if (option === "light" || option === "dark") return { ...builtinThemes[option] };
  const resolved = { ...lightTheme } as Theme;
  for (const key of THEME_KEYS) {
    const value = option[key];
    if (typeof value === "string" && value !== "") resolved[key] = value;
  }
  return resolved;
}

/** cssVarName 把變數鍵轉為 CSS 變數名 (例如 panelBg -> --fsb-panel-bg). */
export function cssVarName(key: string): string {
  return `--fsb-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

/** themeToCssVars 把 theme 轉為可直接套用於元素 style 的 CSS 變數對照表. */
export function themeToCssVars(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const key of THEME_KEYS) vars[cssVarName(key)] = theme[key];
  return vars;
}
