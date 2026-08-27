<script setup lang="ts">
// examples/vue3: 展示開啟參數 (語言, theme, 單位制, 選取模式, 回傳模式), 檔案系統來源
// 切換 (本機 / SSH 遠端, 由 hostctl 提供), 以及面板的選定 / 取消 / 錯誤事件.
import { computed, nextTick, ref, watch } from "vue";
import { FsBrowser } from "@nexgus/fsb-vue";
import type { FsbError, ReturnMode, SelectionMode, SizeUnitSystem, ThemeName } from "@nexgus/fsb-core";
// 隨附的繁體中文語言包, 以 file: 相依安裝為 @nexgus/fsb-locales; 語言包不內建為預設,
// 由宿主自行 import 後以開啟參數傳入, 與任何第三方自製語言包走完全相同的路徑.
import { zhHant } from "@nexgus/fsb-locales";
import { fsbClient } from "./bindings.js";
import * as hostctl from "../bindings/github.com/nexgus/fsbrowser/examples/pkg/hostctl/service.js";

// ---- 參數區 --------------------------------------------------------------

const lang = ref<"en" | "zh-Hant">("en");
const themeName = ref<ThemeName | "auto">("auto");
const sizeUnit = ref<SizeUnitSystem>("si");
const selectionMode = ref<SelectionMode>("file");
const returnMode = ref<ReturnMode>("single");
const defaultName = ref("");
const extensionFilter = ref("");

// extensions: 以分號切割宿主端輸入的 glob 字串, 逐項去除前後空白並濾除空字串後轉為陣列;
// 全空時傳 undefined, 交由元件套用預設行為.
const extensions = computed<string[]>(() =>
  extensionFilter.value
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item.length > 0),
);

// ---- 檔案系統區 --------------------------------------------------------------

type FsMode = "local" | "remote";
type ConnectionState = "disconnected" | "connecting" | "connected";

const fsMode = ref<FsMode>("local");
const remoteHost = ref("");
const remotePort = ref(22);
const remoteUser = ref("");
const remoteKeyFile = ref("");
const connectionState = ref<ConnectionState>("disconnected");
const connectedLabel = ref("");

const connectionStatusText = computed<string>(() => {
  switch (connectionState.value) {
    case "connecting":
      return "Connecting...";
    case "connected":
      return `Connected: ${connectedLabel.value}`;
    default:
      return "Not connected";
  }
});

const remoteControlsDisabled = computed(
  () => connectionState.value === "connecting" || connectionState.value === "connected",
);

watch(fsMode, (mode) => {
  // 切到本機時呼叫 UseLocal(); 遠端且尚未連線時切回本機亦同一動作, 不因目前沒有連線可
  // 關閉而略過呼叫 (底層可能仍殘留先前的狀態).
  if (mode === "local") void useLocal();
});

async function useLocal(): Promise<void> {
  try {
    await hostctl.UseLocal();
  } catch (err) {
    appendError("hostctl.UseLocal", err);
  }
}

async function connectRemote(): Promise<void> {
  connectionState.value = "connecting";
  try {
    await hostctl.ConnectRemote(remoteHost.value, remotePort.value, remoteUser.value, remoteKeyFile.value);
    connectionState.value = "connected";
    connectedLabel.value = `${remoteUser.value}@${remoteHost.value}`;
  } catch (err) {
    connectionState.value = "disconnected";
    appendError("hostctl.ConnectRemote", err);
  }
}

async function disconnectRemote(): Promise<void> {
  try {
    await hostctl.DisconnectRemote();
  } catch (err) {
    appendError("hostctl.DisconnectRemote", err);
  }
  // 底層已切回本機, 但 radio 停留在遠端; 狀態顯示回到未連線.
  connectionState.value = "disconnected";
  connectedLabel.value = "";
}

// ---- 初始目錄 --------------------------------------------------------------

const initialDir = ref("");

// ---- 開啟按鈕與 modal --------------------------------------------------------------

const modalOpen = ref(false);

function openPanel(): void {
  if (fsMode.value === "remote" && connectionState.value !== "connected") {
    appendError("Open file browser", new Error("Remote not connected."));
    return;
  }
  modalOpen.value = true;
}

function closeModal(): void {
  modalOpen.value = false;
}

function onSelect(result: string | string[]): void {
  resultText.value = JSON.stringify(result);
  closeModal();
}

function onCancel(): void {
  resultText.value = "Cancelled.";
  closeModal();
}

function onError(error: FsbError): void {
  appendError("FsBrowser", error);
}

// ---- 結果文字盒 --------------------------------------------------------------

const resultText = ref("(no result yet)");

// ---- 錯誤盒 --------------------------------------------------------------

const errorLines = ref<string[]>([]);
const errorBoxText = computed(() => errorLines.value.join("\n"));
const errorBox = ref<HTMLTextAreaElement | null>(null);

function appendError(source: string, err: unknown): void {
  errorLines.value.push(`${source}: ${describeError(err)}`);
  void nextTick(() => {
    if (errorBox.value !== null) errorBox.value.scrollTop = errorBox.value.scrollHeight;
  });
}

// 結構化錯誤 (FsbError, 或 @wailsio/runtime 拋出的 RuntimeError, 結構化內容掛在
// err.cause.code / err.cause.message) 一律取出 code / message; 其餘退回一般錯誤訊息.
function describeError(err: unknown): string {
  if (err !== null && typeof err === "object" && "code" in err) {
    const fe = err as FsbError;
    const parts = [fe.operation, fe.path].filter((part): part is string => !!part).join(" ");
    return `[${fe.code}] ${parts}${parts ? " -- " : ""}${fe.message}`;
  }
  const cause = (err as { cause?: unknown } | null)?.cause;
  if (cause !== null && typeof cause === "object" && "code" in cause) {
    const c = cause as { code: unknown; message?: unknown };
    return `[${String(c.code)}] ${c.message !== undefined ? String(c.message) : ""}`;
  }
  return err instanceof Error ? err.message : String(err);
}
</script>

<template>
  <div class="demo-page">
    <h1>fsbrowser · Vue 3 Integration Example</h1>

    <section class="demo-settings">
      <label>
        Language:
        <select v-model="lang">
          <option value="en">English</option>
          <option value="zh-Hant">繁體中文</option>
        </select>
      </label>
      <label>
        Theme:
        <select v-model="themeName">
          <option value="auto">auto</option>
          <option value="light">light</option>
          <option value="dark">dark</option>
        </select>
      </label>
      <label>
        Size units:
        <select v-model="sizeUnit">
          <option value="si">SI (MB)</option>
          <option value="iec">IEC (MiB)</option>
        </select>
      </label>
      <label>
        Selection mode:
        <select v-model="selectionMode">
          <option value="file">file</option>
          <option value="dir">dir</option>
          <option value="save">save</option>
        </select>
      </label>
      <label>
        Default name:
        <input type="text" v-model="defaultName" />
      </label>
      <label>
        Extension filter:
        <input type="text" v-model="extensionFilter" placeholder="*.yaml;*.yml" />
      </label>
      <label>
        Return mode:
        <select v-model="returnMode">
          <option value="single">single</option>
          <option value="multiple">multiple</option>
        </select>
      </label>
    </section>

    <section class="demo-fsmode">
      <h2>File system</h2>
      <div class="demo-fsmode-radio">
        <label>
          <input type="radio" value="local" v-model="fsMode" />
          Local
        </label>
        <label>
          <input type="radio" value="remote" v-model="fsMode" />
          Remote (SSH)
        </label>
      </div>

      <div v-if="fsMode === 'remote'" class="demo-remote">
        <label>
          Host
          <input type="text" v-model="remoteHost" :disabled="remoteControlsDisabled" />
        </label>
        <label>
          Port
          <input type="number" v-model.number="remotePort" :disabled="remoteControlsDisabled" />
        </label>
        <label>
          User
          <input type="text" v-model="remoteUser" :disabled="remoteControlsDisabled" />
        </label>
        <label>
          Private key file:
          <input
            type="text"
            v-model="remoteKeyFile"
            :disabled="remoteControlsDisabled"
            placeholder="(empty = ~/.ssh/id_ed25519 | id_ecdsa | id_rsa)"
          />
        </label>
        <button type="button" :disabled="remoteControlsDisabled" @click="connectRemote">Connect</button>
        <button
          type="button"
          :disabled="connectionState !== 'connected'"
          @click="disconnectRemote"
        >
          Disconnect
        </button>
        <span class="demo-remote-status">{{ connectionStatusText }}</span>
      </div>
    </section>

    <section class="demo-initial-dir">
      <label>
        Initial directory:
        <input type="text" v-model="initialDir" placeholder="Leave empty to use home directory" />
      </label>
    </section>

    <section class="demo-open">
      <button type="button" @click="openPanel">Open file browser</button>
    </section>

    <section class="demo-result">
      <label>
        Result:
        <input type="text" class="demo-result-input" :value="resultText" readonly />
      </label>
    </section>

    <section class="demo-error">
      <label>
        Errors:
        <textarea ref="errorBox" class="demo-error-box" :value="errorBoxText" readonly rows="6"></textarea>
      </label>
    </section>

    <div v-if="modalOpen" class="demo-modal-overlay" @click.self="closeModal">
      <div class="demo-modal-panel">
        <FsBrowser
          :client="fsbClient"
          :locale="lang === 'zh-Hant' ? zhHant : undefined"
          :theme="themeName"
          :size-unit="sizeUnit"
          :selection-mode="selectionMode"
          :return-mode="returnMode"
          :default-name="defaultName || undefined"
          :extensions="extensions.length > 0 ? extensions : undefined"
          :initial-dir="initialDir || undefined"
          @select="onSelect"
          @cancel="onCancel"
          @error="onError"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.demo-page {
  max-width: 960px;
  margin: 1.5rem auto;
  padding: 0 1rem;
  font-family: system-ui, sans-serif;
}
.demo-settings {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-end;
  margin-bottom: 1rem;
}
.demo-settings label {
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
  gap: 0.25rem;
}
.demo-fsmode {
  margin-bottom: 1rem;
}
.demo-fsmode-radio {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 0.5rem;
}
.demo-remote {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-end;
}
.demo-remote label {
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
  gap: 0.25rem;
}
.demo-remote-status {
  align-self: center;
  font-size: 0.85rem;
  color: #555;
}
.demo-initial-dir {
  margin-bottom: 1rem;
}
.demo-initial-dir label {
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
  gap: 0.25rem;
}
.demo-initial-dir input {
  width: 100%;
  box-sizing: border-box;
}
.demo-open {
  margin-bottom: 1rem;
}
.demo-result,
.demo-error {
  margin-bottom: 1rem;
}
.demo-result label,
.demo-error label {
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
  gap: 0.25rem;
}
.demo-result-input {
  width: 100%;
  box-sizing: border-box;
}
.demo-error-box {
  width: 100%;
  box-sizing: border-box;
  font-family: ui-monospace, monospace;
  font-size: 0.8rem;
  color: #a03e34;
  resize: vertical;
}
.demo-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.demo-modal-panel {
  width: 80vw;
  height: 80vh;
  background: #f0f2f5;
  padding: 1rem;
  border-radius: 6px;
  box-sizing: border-box;
}
</style>
