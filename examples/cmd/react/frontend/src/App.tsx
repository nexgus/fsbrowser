// App: 示範 @nexgus/fsb-react 的接線與開啟參數 (計劃書第 10 章 P4 階段整合驗證).
// 提供語言 / theme / 單位制 / 選取模式 / 回傳模式的手動切換, 本機與 SSH 遠端檔案系統的
// 切換 (經由宿主控制 service hostctl), 以及以 modal 形式開啟 <FsBrowser>, 並把選定 /
// 取消 / 錯誤結果顯示於頁面, 供人工驗證元件行為.
import { useState } from "react";
import type { FsbError, ReturnMode, SelectionMode, SizeUnitSystem, ThemeName } from "@nexgus/fsb-core";
import { FsBrowser, FsbClientProvider } from "@nexgus/fsb-react";
import { zhHant } from "@nexgus/fsb-locales";
import { fsbClient } from "./fsbClient.js";
import * as hostctl from "../bindings/github.com/nexgus/fsbrowser/examples/pkg/hostctl/service.js";

type LanguageOption = "en" | "zh-Hant";
type FsMode = "local" | "remote";
type RemoteStatus = "disconnected" | "connecting" | "connected";

/** describeCause 從 @wailsio/runtime 拋出的 RuntimeError 取出結構化錯誤描述. */
function describeCause(err: unknown): string {
  const cause = (err as { cause?: { code?: string; message?: string } } | undefined)?.cause;
  if (cause?.code) {
    return `[${cause.code}] ${cause.message ?? ""}`;
  }
  return err instanceof Error ? err.message : String(err);
}

export function App() {
  const [language, setLanguage] = useState<LanguageOption>("en");
  const [theme, setTheme] = useState<ThemeName | "auto">("auto");
  const [sizeUnit, setSizeUnit] = useState<SizeUnitSystem>("si");
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("file");
  const [returnMode, setReturnMode] = useState<ReturnMode>("single");
  const [defaultName, setDefaultName] = useState("");
  const [extensionFilter, setExtensionFilter] = useState("");

  const [fsMode, setFsMode] = useState<FsMode>("local");
  const [remoteStatus, setRemoteStatus] = useState<RemoteStatus>("disconnected");
  const [remoteHost, setRemoteHost] = useState("");
  const [remotePort, setRemotePort] = useState(22);
  const [remoteUser, setRemoteUser] = useState("");
  const [remoteKeyFile, setRemoteKeyFile] = useState("");

  const [initialDir, setInitialDir] = useState("");
  const [isPanelOpen, setPanelOpen] = useState(false);
  const [result, setResult] = useState<string>("(no result yet)");
  const [errors, setErrors] = useState<string>("");

  const locale = language === "zh-Hant" ? zhHant : undefined;

  // extensions: 以分號切割宿主端輸入的 glob 字串, 逐項去除前後空白並濾除空字串後
  // 轉為陣列; 全空時傳 undefined, 交由元件套用預設行為.
  const extensions = extensionFilter
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  function appendError(message: string): void {
    setErrors((previous) => (previous ? `${previous}\n${message}` : message));
  }

  async function useLocal(): Promise<void> {
    try {
      await hostctl.UseLocal();
    } catch (err) {
      appendError(`[hostctl] ${describeCause(err)}`);
    }
  }

  function handleModeChange(nextMode: FsMode): void {
    setFsMode(nextMode);
    if (nextMode === "local") {
      void useLocal();
    } else if (remoteStatus !== "connected") {
      // 切到遠端但尚未連線: 底層維持本機, 待使用者按下連線後再切換.
      void useLocal();
    }
  }

  async function handleConnect(): Promise<void> {
    setRemoteStatus("connecting");
    try {
      await hostctl.ConnectRemote(remoteHost, remotePort, remoteUser, remoteKeyFile);
      setRemoteStatus("connected");
    } catch (err) {
      setRemoteStatus("disconnected");
      appendError(`[hostctl] ${describeCause(err)}`);
    }
  }

  async function handleDisconnect(): Promise<void> {
    try {
      await hostctl.DisconnectRemote();
    } catch (err) {
      appendError(`[hostctl] ${describeCause(err)}`);
    } finally {
      setRemoteStatus("disconnected");
    }
  }

  function handleOpenPanel(): void {
    if (fsMode === "remote" && remoteStatus !== "connected") {
      appendError("Remote not connected.");
      return;
    }
    setPanelOpen(true);
  }

  function handleSelect(selection: string | string[]): void {
    setResult(JSON.stringify(selection));
    setPanelOpen(false);
  }

  function handleCancel(): void {
    setResult("Cancelled.");
    setPanelOpen(false);
  }

  function handleError(error: FsbError): void {
    appendError(`[${error.code}] ${error.operation} ${error.path ?? ""} -- ${error.message}`);
  }

  const remoteBusy = remoteStatus === "connecting";
  const remoteStatusText =
    remoteStatus === "connected"
      ? `Connected: ${remoteUser}@${remoteHost}`
      : remoteStatus === "connecting"
        ? "Connecting..."
        : "Not connected";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100vh", padding: 12, fontFamily: "system-ui, sans-serif", boxSizing: "border-box", overflow: "auto" }}>
      <section style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
        <label>
          Language:
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
          <select value={theme} onChange={(event) => setTheme(event.target.value as ThemeName | "auto")}>
            <option value="auto">auto</option>
            <option value="light">light</option>
            <option value="dark">dark</option>
          </select>
        </label>
        <label>
          Size units:
          <select value={sizeUnit} onChange={(event) => setSizeUnit(event.target.value as SizeUnitSystem)}>
            <option value="si">SI (MB)</option>
            <option value="iec">IEC (MiB)</option>
          </select>
        </label>
        <label>
          Selection mode:
          <select value={selectionMode} onChange={(event) => setSelectionMode(event.target.value as SelectionMode)}>
            <option value="file">file</option>
            <option value="dir">dir</option>
            <option value="save">save</option>
          </select>
        </label>
        <label>
          Default name:
          <input
            type="text"
            value={defaultName}
            onChange={(event) => setDefaultName(event.target.value)}
            style={{ width: 160 }}
          />
        </label>
        <label>
          Extension filter:
          <input
            type="text"
            value={extensionFilter}
            onChange={(event) => setExtensionFilter(event.target.value)}
            placeholder="*.yaml;*.yml"
            style={{ width: 160 }}
          />
        </label>
        <label>
          Return mode:
          <select value={returnMode} onChange={(event) => setReturnMode(event.target.value as ReturnMode)}>
            <option value="single">single</option>
            <option value="multiple">multiple</option>
          </select>
        </label>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 8, border: "1px solid #ccc", borderRadius: 4, padding: 12 }}>
        <strong>File system</strong>
        <div style={{ display: "flex", gap: 16 }}>
          <label>
            <input
              type="radio"
              name="fsMode"
              value="local"
              checked={fsMode === "local"}
              onChange={() => handleModeChange("local")}
            />
            Local
          </label>
          <label>
            <input
              type="radio"
              name="fsMode"
              value="remote"
              checked={fsMode === "remote"}
              onChange={() => handleModeChange("remote")}
            />
            Remote
          </label>
        </div>

        {fsMode === "remote" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <label>
              host:
              <input
                type="text"
                value={remoteHost}
                disabled={remoteBusy || remoteStatus === "connected"}
                onChange={(event) => setRemoteHost(event.target.value)}
              />
            </label>
            <label>
              port:
              <input
                type="number"
                value={remotePort}
                disabled={remoteBusy || remoteStatus === "connected"}
                onChange={(event) => setRemotePort(Number(event.target.value))}
                style={{ width: 72 }}
              />
            </label>
            <label>
              user:
              <input
                type="text"
                value={remoteUser}
                disabled={remoteBusy || remoteStatus === "connected"}
                onChange={(event) => setRemoteUser(event.target.value)}
              />
            </label>
            <label>
              Private key file:
              <input
                type="text"
                value={remoteKeyFile}
                disabled={remoteBusy || remoteStatus === "connected"}
                onChange={(event) => setRemoteKeyFile(event.target.value)}
                placeholder="(empty = ~/.ssh/id_ed25519 | id_ecdsa | id_rsa)"
                style={{ width: 240 }}
              />
            </label>
            {remoteStatus === "connected" ? (
              <button type="button" onClick={() => void handleDisconnect()}>
                Disconnect
              </button>
            ) : (
              <button type="button" disabled={remoteBusy} onClick={() => void handleConnect()}>
                Connect
              </button>
            )}
            <span>Status: {remoteStatusText}</span>
          </div>
        )}
      </section>

      <section>
        <label>
          Initial directory:
          <input
            type="text"
            value={initialDir}
            onChange={(event) => setInitialDir(event.target.value)}
            style={{ width: 320, marginLeft: 8 }}
            placeholder="empty string means home directory"
          />
        </label>
      </section>

      <section>
        <button type="button" onClick={handleOpenPanel}>
          Open file browser
        </button>
      </section>

      <section>
        <label>
          Result:
          <input type="text" value={result} readOnly style={{ width: "100%", marginLeft: 8 }} />
        </label>
      </section>

      <section>
        <label style={{ display: "block" }}>Errors:</label>
        <textarea
          value={errors}
          readOnly
          rows={6}
          style={{ width: "100%", fontFamily: "monospace" }}
          ref={(element) => {
            if (element) {
              element.scrollTop = element.scrollHeight;
            }
          }}
        />
      </section>

      {isPanelOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div style={{ width: "80vw", height: "80vh", background: "#fff", borderRadius: 4, overflow: "hidden" }}>
            <FsbClientProvider client={fsbClient}>
              <FsBrowser
                locale={locale}
                theme={theme}
                sizeUnit={sizeUnit}
                selectionMode={selectionMode}
                returnMode={returnMode}
                defaultName={defaultName || undefined}
                extensions={extensions.length > 0 ? extensions : undefined}
                initialDir={initialDir || undefined}
                onSelect={handleSelect}
                onCancel={handleCancel}
                onError={handleError}
              />
            </FsbClientProvider>
          </div>
        </div>
      )}
    </div>
  );
}
