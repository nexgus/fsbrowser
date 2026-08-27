// App: 示範 @nexgus/fsb-react 的接線與開啟參數 (計劃書第 10 章 P4 階段整合驗證).
// 提供語言 / theme / 單位制 / 選取模式 / 回傳模式的手動切換, 並把選定 / 取消 / 錯誤結果
// 顯示於頁面, 供人工驗證元件行為.
import { useMemo, useState } from "react";
import type { FsbError, ReturnMode, SelectionMode, SizeUnitSystem, ThemeName } from "@nexgus/fsb-core";
import { FsBrowser, FsbClientProvider } from "@nexgus/fsb-react";
import { zhHant } from "@nexgus/fsb-locales";
import { fsbClient } from "./fsbClient.js";

type LanguageOption = "en" | "zh-Hant";

export function App() {
  const [language, setLanguage] = useState<LanguageOption>("en");
  const [theme, setTheme] = useState<ThemeName>("light");
  const [sizeUnit, setSizeUnit] = useState<SizeUnitSystem>("si");
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("file");
  const [returnMode, setReturnMode] = useState<ReturnMode>("single");
  const [panelKey, setPanelKey] = useState(0);
  const [result, setResult] = useState<string>("(尚無結果)");

  const locale = useMemo(() => (language === "zh-Hant" ? zhHant : undefined), [language]);

  function remount(): void {
    // 開啟參數 (選取模式, 回傳模式) 屬 <FsBrowser> 掛載時的固定設定, 變更後以 key 重新掛載.
    setPanelKey((value) => value + 1);
  }

  function handleSelect(selection: string | string[]): void {
    setResult(`已選定: ${JSON.stringify(selection)}`);
  }

  function handleCancel(): void {
    setResult("已取消.");
  }

  function handleError(error: FsbError): void {
    setResult(`錯誤: [${error.code}] ${error.operation} ${error.path ?? ""} -- ${error.message}`);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100vh", padding: 12, fontFamily: "system-ui, sans-serif", boxSizing: "border-box" }}>
      <section style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
        <label>
          語言:
          <select
            value={language}
            onChange={(event) => {
              setLanguage(event.target.value as LanguageOption);
            }}
          >
            <option value="en">English</option>
            <option value="zh-Hant">繁體中文</option>
          </select>
        </label>
        <label>
          Theme:
          <select value={theme} onChange={(event) => setTheme(event.target.value as ThemeName)}>
            <option value="light">light</option>
            <option value="dark">dark</option>
          </select>
        </label>
        <label>
          大小單位制:
          <select value={sizeUnit} onChange={(event) => setSizeUnit(event.target.value as SizeUnitSystem)}>
            <option value="si">SI (MB)</option>
            <option value="iec">IEC (MiB)</option>
          </select>
        </label>
        <label>
          選取模式:
          <select
            value={selectionMode}
            onChange={(event) => {
              setSelectionMode(event.target.value as SelectionMode);
              remount();
            }}
          >
            <option value="file">file</option>
            <option value="dir">dir</option>
          </select>
        </label>
        <label>
          回傳模式:
          <select
            value={returnMode}
            onChange={(event) => {
              setReturnMode(event.target.value as ReturnMode);
              remount();
            }}
          >
            <option value="single">single</option>
            <option value="multiple">multiple</option>
          </select>
        </label>
      </section>

      <section style={{ flex: 1, minHeight: 0 }}>
        <FsbClientProvider client={fsbClient}>
          <FsBrowser
            key={panelKey}
            locale={locale}
            theme={theme}
            sizeUnit={sizeUnit}
            selectionMode={selectionMode}
            returnMode={returnMode}
            onSelect={handleSelect}
            onCancel={handleCancel}
            onError={handleError}
          />
        </FsbClientProvider>
      </section>

      <section>
        <strong>結果: </strong>
        <span>{result}</span>
      </section>
    </div>
  );
}
