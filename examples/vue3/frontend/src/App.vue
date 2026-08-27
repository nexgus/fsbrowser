<script setup lang="ts">
// examples/vue3: 展示開啟參數 (語言, theme, 單位制, 選取模式, 回傳模式) 與接收
// 選定 / 取消 / 錯誤事件 (計劃書第 10 章 P3 階段).
import { ref } from "vue";
import { FsBrowser } from "@nexgus/fsb-vue";
import type { FsbError, ReturnMode, SelectionMode, SizeUnitSystem, ThemeName } from "@nexgus/fsb-core";
// 隨附的繁體中文語言包, 以 file: 相依安裝為 @nexgus/fsb-locales; 語言包不內建為預設,
// 由宿主自行 import 後以開啟參數傳入, 與任何第三方自製語言包走完全相同的路徑.
import { zhHant } from "@nexgus/fsb-locales";
import { fsbClient } from "./bindings.js";

const lang = ref<"en" | "zh-Hant">("en");
const themeName = ref<ThemeName>("light");
const sizeUnit = ref<SizeUnitSystem>("si");
const selectionMode = ref<SelectionMode>("file");
const returnMode = ref<ReturnMode>("single");

// 面板每次 "開啟" 為一組固定的開啟參數; 變更設定後按 "重新開啟面板" 以新的參數重新掛載.
const panelKey = ref(0);
const panelOpen = ref(true);

function reopenPanel(): void {
  panelOpen.value = false;
  panelKey.value += 1;
  requestAnimationFrame(() => {
    panelOpen.value = true;
  });
}

const lastResult = ref<string | string[] | null>(null);
const lastCancelled = ref(false);
const lastError = ref<FsbError | null>(null);

function onSelect(result: string | string[]): void {
  lastResult.value = result;
  lastCancelled.value = false;
}

function onCancel(): void {
  lastCancelled.value = true;
  lastResult.value = null;
}

function onError(error: FsbError): void {
  lastError.value = error;
}
</script>

<template>
  <div class="demo-page">
    <h1>fsbrowser · Vue 3 整合範例</h1>

    <section class="demo-settings">
      <label>
        語言
        <select v-model="lang">
          <option value="en">English (內建)</option>
          <option value="zh-Hant">繁體中文</option>
        </select>
      </label>
      <label>
        Theme
        <select v-model="themeName">
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
      <label>
        大小單位制
        <select v-model="sizeUnit">
          <option value="si">SI (MB)</option>
          <option value="iec">IEC (MiB)</option>
        </select>
      </label>
      <label>
        選取模式
        <select v-model="selectionMode">
          <option value="file">檔案</option>
          <option value="dir">目錄</option>
        </select>
      </label>
      <label>
        回傳模式
        <select v-model="returnMode">
          <option value="single">單選</option>
          <option value="multiple">多選</option>
        </select>
      </label>
      <button type="button" @click="reopenPanel">以目前設定重新開啟面板</button>
    </section>

    <section class="demo-panel">
      <FsBrowser
        v-if="panelOpen"
        :key="panelKey"
        :client="fsbClient"
        :locale="lang === 'zh-Hant' ? zhHant : undefined"
        :theme="themeName"
        :size-unit="sizeUnit"
        :selection-mode="selectionMode"
        :return-mode="returnMode"
        @select="onSelect"
        @cancel="onCancel"
        @error="onError"
      />
    </section>

    <section class="demo-result">
      <h2>事件結果</h2>
      <p v-if="lastResult !== null">選定: <code>{{ JSON.stringify(lastResult) }}</code></p>
      <p v-else-if="lastCancelled">已取消.</p>
      <p v-else>(尚未選定或取消)</p>
      <p v-if="lastError !== null" class="demo-error">
        錯誤外拋: {{ lastError.code }} / {{ lastError.operation }} / {{ lastError.message }}
      </p>
    </section>
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
.demo-panel {
  height: 520px;
  background: #f0f2f5;
  padding: 1rem;
  border-radius: 6px;
}
.demo-result {
  margin-top: 1rem;
}
.demo-error {
  color: #a03e34;
}
</style>
