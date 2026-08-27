<script setup lang="ts">
// 項目種類圖示 (計劃書第 7.4 節): 一律線條式 (stroke) SVG, 16px 格線, 線寬 1.5.
// 連結於右下角疊 9px 徽章 (內含斜向箭頭); 失效連結改用斷鏈圖示並套用淡化.
import { computed } from "vue";
import type { Kind } from "@nexgus/fsb-core";

const props = defineProps<{
  /** 有效種類: 非連結者為基本種類, 連結者為解析後的目標種類. */
  kind: Kind;
  /** 項目本身是否為連結. */
  isLink?: boolean;
  /** 是否為失效連結. */
  broken?: boolean;
}>();

// 特殊檔案種類的固定色系 (計劃書第 7.4 節以色系描述, 非 theme 變數, 與淺深色 theme 無關).
const SPECIAL_COLORS: Partial<Record<Kind, string>> = {
  socket: "#8a63d2",
  fifo: "#3f9c9c",
  device: "#b8860b",
};

const stroke = computed<string>(() => {
  if (props.broken) return "var(--fsb-error-text)";
  if (props.kind === "dir") return "var(--fsb-folder-icon)";
  if (SPECIAL_COLORS[props.kind] !== undefined) return SPECIAL_COLORS[props.kind] as string;
  return "var(--fsb-file-icon)";
});

const opacity = computed(() => (props.broken ? 0.55 : 1));
</script>

<template>
  <span class="fsb-icon" :style="{ opacity }">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" :stroke="stroke" stroke-width="1.5"
      stroke-linecap="round" stroke-linejoin="round">
      <!-- 失效連結: 斷鏈圖示優先於基本種類圖示 -->
      <template v-if="broken">
        <path d="M6 10 L4 12 a2 2 0 1 1 -2.8 -2.8 L3 7.4" />
        <path d="M10 6 L12 4 a2 2 0 1 1 2.8 2.8 L14 8.6" />
        <path d="M6.5 9.5 L9.5 6.5" stroke-dasharray="1.4 1.4" />
      </template>
      <template v-else-if="kind === 'dir'">
        <path d="M1.5 4 a1 1 0 0 1 1 -1 h3.2 l1.3 1.6 h6 a1 1 0 0 1 1 1 v7.4 a1 1 0 0 1 -1 1 h-10.5 a1 1 0 0 1 -1 -1 z" />
      </template>
      <template v-else-if="kind === 'socket'">
        <path d="M5 2.5 v3 M11 2.5 v3 M4 5.5 h8 v3 a4 4 0 0 1 -8 0 z" />
        <path d="M8 12.5 v2" />
      </template>
      <template v-else-if="kind === 'fifo'">
        <path d="M2 6 h5 a2 2 0 0 1 2 2 a2 2 0 0 0 2 2 h3" />
        <circle cx="2" cy="6" r="1" />
        <circle cx="14" cy="10" r="1" />
      </template>
      <template v-else-if="kind === 'device'">
        <rect x="4" y="4" width="8" height="8" rx="1" />
        <path d="M6.5 4 v-1.5 M9.5 4 v-1.5 M6.5 12 v1.5 M9.5 12 v1.5 M4 6.5 h-1.5 M4 9.5 h-1.5 M12 6.5 h1.5 M12 9.5 h1.5" />
      </template>
      <template v-else-if="kind === 'unknown'">
        <circle cx="8" cy="8" r="6" />
        <path d="M6.3 6.3 a1.8 1.8 0 1 1 2.6 1.6 c-.6 .4 -.9 .8 -.9 1.5" />
        <circle cx="8" cy="11.2" r=".4" fill="currentColor" stroke="none" />
      </template>
      <template v-else>
        <path d="M4.5 1.5 h4.6 l2.4 2.4 v9.6 a1 1 0 0 1 -1 1 h-6 a1 1 0 0 1 -1 -1 v-11 a1 1 0 0 1 1 -1 z" />
        <path d="M9.1 1.5 v2.4 h2.4" />
      </template>
    </svg>
    <svg v-if="isLink && !broken" class="fsb-icon-badge" width="9" height="9" viewBox="0 0 9 9" fill="none"
      stroke="var(--fsb-panel-bg)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
      <rect x="0.5" y="0.5" width="8" height="8" rx="1.5" fill="var(--fsb-text-secondary)" stroke="none" />
      <path d="M3.2 5.8 L5.8 3.2 M4 3.2 h1.8 v1.8" />
    </svg>
  </span>
</template>

<style scoped>
.fsb-icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex: none;
}
.fsb-icon-badge {
  position: absolute;
  right: -3px;
  bottom: -3px;
}
</style>
