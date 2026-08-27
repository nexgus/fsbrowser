<script setup lang="ts">
// FsBrowser: fsbrowser 的 Vue 3 瀏覽面板 (計劃書第 5, 7 章). 元件只依賴 core 的
// FsbClient / BrowserStore, 不寫死 bindings; UI 文字一律經 core 的翻譯機制取詞條.
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { Entry, FsbClient, FsbError, LocalePack, ReturnMode, SelectionMode, ThemeOption } from "@nexgus/fsb-core";
import type { SizeUnitSystem } from "@nexgus/fsb-core";
import {
  createTranslator,
  effectiveKind,
  formatDateTime,
  formatErrorText,
  formatSize,
  fromDisplayPath,
  isBrokenLink,
  isDirectoryLike,
  isSelectableAs,
  resolveTheme,
  rootDisplayLabel,
  subscribeSystemTheme,
  themeToCssVars,
  toDisplayPath,
} from "@nexgus/fsb-core";
import { fsbClientKey } from "../injectionKey.js";
import { useBrowserStore } from "../useBrowserStore.js";
import EntryIcon from "./EntryIcon.vue";

const props = withDefaults(
  defineProps<{
    /** 對橋接層的呼叫介面; 未以 prop 提供時改用 provide / inject (fsbClientKey). */
    client?: FsbClient;
    /** 語言包; 未提供時使用內建英文. */
    locale?: LocalePack;
    /** theme: 內建名稱, "auto" (隨系統深淺色即時切換), 或自訂變數表; 未提供時使用內建淺色. */
    theme?: ThemeOption;
    /** 檔案大小單位制. */
    sizeUnit?: SizeUnitSystem;
    /** 選取模式: 使用者要挑的是檔案還是目錄. */
    selectionMode?: SelectionMode;
    /** 回傳模式: 單選或多選. */
    returnMode?: ReturnMode;
    /** 起始目錄; 未提供時用 client 的家目錄. */
    initialDir?: string;
    /** 存檔模式的預設檔名, 面板開啟時預填; 未提供時為空字串. */
    defaultName?: string;
    /** 副檔名過濾清單; 僅於檔案與存檔模式生效. */
    extensions?: string[];
  }>(),
  {
    client: undefined,
    locale: undefined,
    theme: undefined,
    sizeUnit: "si",
    selectionMode: "file",
    returnMode: "single",
    initialDir: undefined,
    defaultName: undefined,
    extensions: undefined,
  },
);

const emit = defineEmits<{
  /** 選定結果: 單選為一個路徑, 多選為路徑陣列 (內部形式). */
  select: [result: string | string[]];
  /** 取消. */
  cancel: [];
  /** 結構化錯誤外拋, 與面板內狀態列同時發生. */
  error: [error: FsbError];
}>();

const injectedClient = inject(fsbClientKey, undefined);
const resolvedClient = props.client ?? injectedClient;
if (resolvedClient === undefined) {
  throw new Error(
    "FsBrowser: 需要 client, 請以 prop 傳入或以 provide(fsbClientKey, client) 注入 (計劃書第 5.3 節).",
  );
}

const t = createTranslator(props.locale);

// theme 為 "auto" 時訂閱系統深淺色偏好, 變更時以 tick 觸發重新解析並重繪.
const systemThemeTick = ref(0);
let unsubscribeSystemTheme: (() => void) | null = null;

function syncSystemThemeSubscription(): void {
  unsubscribeSystemTheme?.();
  unsubscribeSystemTheme = null;
  if (props.theme === "auto") {
    unsubscribeSystemTheme = subscribeSystemTheme(() => {
      systemThemeTick.value += 1;
    });
  }
}

watch(() => props.theme, syncSystemThemeSubscription, { immediate: true });
onBeforeUnmount(() => {
  unsubscribeSystemTheme?.();
  unsubscribeSystemTheme = null;
});

const themeVars = computed(() => {
  void systemThemeTick.value;
  return themeToCssVars(resolveTheme(props.theme));
});

const { store, snapshot } = useBrowserStore({
  client: resolvedClient,
  selectionMode: props.selectionMode,
  returnMode: props.returnMode,
  initialDir: props.initialDir,
  defaultName: props.defaultName,
  extensions: props.extensions,
  onSelect: (result) => emit("select", result),
  onCancel: () => emit("cancel"),
  onError: (error) => emit("error", error),
});

onMounted(() => {
  void store.init();
});

const modeHint = computed(() => {
  if (props.selectionMode === "dir") return t("mode.dir");
  if (props.selectionMode === "save") return t("mode.save");
  return t("mode.file");
});

// ---- 路徑列 --------------------------------------------------------------

const pathDraft = ref("");
const pathEditing = ref(false);

watch(
  () => snapshot.value.currentDir,
  (dir) => {
    if (!pathEditing.value) pathDraft.value = toDisplayPath(dir, snapshot.value.pathStyle);
  },
  { immediate: true },
);

function onPathFocus(): void {
  pathEditing.value = true;
}

function onPathBlur(): void {
  pathEditing.value = false;
  pathDraft.value = toDisplayPath(snapshot.value.currentDir, snapshot.value.pathStyle);
}

function onPathKeydown(e: KeyboardEvent): void {
  if (e.key === "Enter") {
    void store.navigateTo(fromDisplayPath(pathDraft.value));
    (e.target as HTMLInputElement).blur();
  } else if (e.key === "Escape") {
    pathDraft.value = toDisplayPath(snapshot.value.currentDir, snapshot.value.pathStyle);
    (e.target as HTMLInputElement).blur();
  }
}

// ---- 根切換器 --------------------------------------------------------------

const rootMenuOpen = ref(false);

function toggleRootMenu(): void {
  rootMenuOpen.value = !rootMenuOpen.value;
}

function chooseRoot(root: string): void {
  rootMenuOpen.value = false;
  void store.switchRoot(root);
}

// ---- 列選取與開啟 --------------------------------------------------------------

function onRowClick(e: MouseEvent, entry: Entry): void {
  if (e.shiftKey) store.selectRange(entry.Path);
  else if (e.ctrlKey || e.metaKey) store.toggleSelection(entry.Path);
  else store.selectOnly(entry.Path);
}

function onRowDblClick(entry: Entry): void {
  if (isDirectoryLike(entry)) void store.openEntry(entry.Path);
}

// ---- 右鍵選單 --------------------------------------------------------------

interface ContextMenuState {
  x: number;
  y: number;
  kind: "row" | "blank";
}

const contextMenu = ref<ContextMenuState | null>(null);

function onRowContextMenu(e: MouseEvent, entry: Entry): void {
  e.preventDefault();
  if (!snapshot.value.selection.includes(entry.Path)) store.selectOnly(entry.Path);
  contextMenu.value = { x: e.clientX, y: e.clientY, kind: "row" };
}

function onBlankContextMenu(e: MouseEvent): void {
  e.preventDefault();
  contextMenu.value = { x: e.clientX, y: e.clientY, kind: "blank" };
}

function closeContextMenu(): void {
  contextMenu.value = null;
}

function onWindowClick(): void {
  if (contextMenu.value !== null) closeContextMenu();
}

onMounted(() => {
  window.addEventListener("click", onWindowClick);
  window.addEventListener("contextmenu", onWindowClick, true);
});
onBeforeUnmount(() => {
  window.removeEventListener("click", onWindowClick);
  window.removeEventListener("contextmenu", onWindowClick, true);
});

const canRename = computed(() => snapshot.value.selection.length === 1);

function menuRename(): void {
  if (!canRename.value) return;
  closeContextMenu();
  store.beginRename();
  void nextTick(() => renameInput.value?.focus());
}

function menuDelete(): void {
  closeContextMenu();
  store.requestDelete();
}

function menuCopyPath(): void {
  closeContextMenu();
  const text = store.copyPathText();
  void navigator.clipboard?.writeText(text);
}

function menuNewFolder(): void {
  closeContextMenu();
  store.beginNewFolder();
  void nextTick(() => newFolderInput.value?.focus());
}

function menuRefresh(): void {
  closeContextMenu();
  void store.refresh();
}

function menuToggleHidden(): void {
  closeContextMenu();
  store.toggleHidden();
}

// ---- 列內重新命名 / 建立目錄 --------------------------------------------------------------

const renameInput = ref<HTMLInputElement | null>(null);
const newFolderInput = ref<HTMLInputElement | null>(null);

function onRenameKeydown(e: KeyboardEvent): void {
  if (e.key === "Enter") void store.commitRename();
  else if (e.key === "Escape") store.cancelRename();
}

function onNewFolderKeydown(e: KeyboardEvent): void {
  if (e.key === "Enter") void store.commitNewFolder();
  else if (e.key === "Escape") store.cancelNewFolder();
}

// ---- 顯示格式化 --------------------------------------------------------------

function displaySize(entry: Entry): string {
  const kind = effectiveKind(entry);
  if (kind === "dir") return "";
  return formatSize(entry.Size, props.sizeUnit);
}

function displayModified(entry: Entry): string {
  return formatDateTime(entry.ModTime);
}

function rowSelectable(entry: Entry): boolean {
  return isSelectableAs(entry, props.selectionMode);
}

// ---- 存檔模式檔名輸入列 --------------------------------------------------------------

function onSaveNameKeydown(e: KeyboardEvent): void {
  if (e.key === "Enter") store.confirmSelection();
}

const confirmLabel = computed(() => (props.selectionMode === "save" ? t("button.save") : t("button.select")));

// ---- 狀態列文字 --------------------------------------------------------------

const statusText = computed<string>(() => {
  const snap = snapshot.value;
  if (snap.error !== null) return formatErrorText(t, snap.error);
  if (snap.overwriteConfirm !== null) return t("save.overwriteConfirm", { name: snap.overwriteConfirm.name });
  if (snap.deleteConfirm !== null) return t("status.deleteConfirm", { count: snap.deleteConfirm.paths.length });
  if (snap.deleting) return t("status.deleting", { count: snap.selectedCount });
  if (snap.rename !== null) return t("status.renaming", { name: snap.rename.draft || snap.rename.originalName });
  if (snap.newFolder !== null) return t("status.creating", { name: snap.newFolder.draft || t("newFolder.defaultName") });
  if (snap.loading) return t("status.loading", { path: toDisplayPath(snap.currentDir, snap.pathStyle) });
  return snap.selectedCount > 0
    ? t("status.itemsSelected", { count: snap.itemCount, selected: snap.selectedCount })
    : t("status.items", { count: snap.itemCount });
});

const statusVariant = computed<"neutral" | "error" | "confirm">(() => {
  if (snapshot.value.error !== null) return "error";
  if (snapshot.value.overwriteConfirm !== null || snapshot.value.deleteConfirm !== null) return "confirm";
  return "neutral";
});
</script>

<template>
  <div class="fsb-root" :style="themeVars">
    <!-- 標題列 -->
    <div class="fsb-titlebar">
      <span class="fsb-title">{{ t("title") }}</span>
      <span class="fsb-mode-hint">{{ modeHint }}</span>
    </div>

    <!-- 工具列 -->
    <div class="fsb-toolbar">
      <button
        type="button"
        class="fsb-btn fsb-btn-icon"
        :disabled="snapshot.atRoot"
        :title="t('toolbar.up')"
        @click="store.goUp()"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 12.5 V3.5 M4 7.5 L8 3.5 L12 7.5" />
        </svg>
      </button>
      <button type="button" class="fsb-btn fsb-btn-icon" :title="t('toolbar.home')" @click="store.goHome()">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 8 L8 2.5 L14 8 M4 6.5 V13 h8 V6.5" />
        </svg>
      </button>

      <div v-if="snapshot.roots.length > 1" class="fsb-root-switcher">
        <button type="button" class="fsb-btn fsb-root-btn" :title="t('toolbar.root')" @click.stop="toggleRootMenu()">
          <span class="fsb-mono">{{ rootDisplayLabel(snapshot.currentRoot, snapshot.pathStyle) }}</span>
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 6 L8 10 L12 6" />
          </svg>
        </button>
        <ul v-if="rootMenuOpen" class="fsb-menu fsb-root-menu" @click.stop>
          <li
            v-for="root in snapshot.roots"
            :key="root"
            class="fsb-menu-item fsb-mono"
            @click="chooseRoot(root)"
          >
            <span class="fsb-menu-check">{{ root === snapshot.currentRoot ? "✓" : "" }}</span>
            {{ rootDisplayLabel(root, snapshot.pathStyle) }}
          </li>
        </ul>
      </div>

      <input
        class="fsb-path-input fsb-mono"
        type="text"
        :value="pathDraft"
        :placeholder="t('toolbar.pathPlaceholder')"
        @input="pathDraft = ($event.target as HTMLInputElement).value"
        @focus="onPathFocus"
        @blur="onPathBlur"
        @keydown="onPathKeydown"
      />

      <button type="button" class="fsb-btn fsb-btn-icon" :title="t('toolbar.newFolder')" @click="menuNewFolder()">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1.5 4 a1 1 0 0 1 1 -1 h3.2 l1.3 1.6 h6 a1 1 0 0 1 1 1 v7.4 a1 1 0 0 1 -1 1 h-10.5 a1 1 0 0 1 -1 -1 z" />
          <path d="M8 7.5 v3.5 M6.25 9.25 h3.5" />
        </svg>
      </button>
      <button
        type="button"
        class="fsb-btn fsb-btn-icon"
        :class="{ 'fsb-btn-active': snapshot.showHidden }"
        :title="snapshot.showHidden ? t('toolbar.hideHidden') : t('toolbar.showHidden')"
        @click="store.toggleHidden()"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1.5 8 C3 4.8 5.3 3.2 8 3.2 S13 4.8 14.5 8 C13 11.2 10.7 12.8 8 12.8 S3 11.2 1.5 8 Z" />
          <circle cx="8" cy="8" r="2" />
          <path v-if="!snapshot.showHidden" d="M2.5 2.5 L13.5 13.5" />
        </svg>
      </button>
    </div>

    <!-- 欄位標頭 -->
    <div class="fsb-columns">
      <span class="fsb-col-name">{{ t("column.name") }}</span>
      <span class="fsb-col-size">{{ t("column.size") }}</span>
      <span class="fsb-col-modified">{{ t("column.modified") }}</span>
    </div>

    <!-- 列表 -->
    <div class="fsb-list" @contextmenu="onBlankContextMenu">
      <!-- 載入骨架 -->
      <template v-if="snapshot.loading && !snapshot.ready">
        <div v-for="n in 6" :key="n" class="fsb-row fsb-skeleton-row">
          <span class="fsb-skeleton fsb-skeleton-icon"></span>
          <span class="fsb-skeleton fsb-skeleton-text"></span>
        </div>
      </template>

      <!-- 空目錄 -->
      <div v-else-if="snapshot.ready && snapshot.entries.length === 0 && snapshot.newFolder === null" class="fsb-empty">
        <svg width="48" height="48" viewBox="0 0 16 16" fill="none" stroke="var(--fsb-text-muted)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1.5 4 a1 1 0 0 1 1 -1 h3.2 l1.3 1.6 h6 a1 1 0 0 1 1 1 v7.4 a1 1 0 0 1 -1 1 h-10.5 a1 1 0 0 1 -1 -1 z" />
        </svg>
        <p class="fsb-empty-title">{{ t("empty.title") }}</p>
        <p class="fsb-empty-hint">{{ t("empty.hint") }}</p>
      </div>

      <template v-else>
        <!-- 建立目錄的列內編輯列 -->
        <div v-if="snapshot.newFolder !== null" class="fsb-row fsb-row-editing">
          <EntryIcon kind="dir" />
          <input
            ref="newFolderInput"
            class="fsb-inline-input"
            type="text"
            :value="snapshot.newFolder.draft"
            :placeholder="t('newFolder.defaultName')"
            @input="store.setNewFolderDraft(($event.target as HTMLInputElement).value)"
            @keydown="onNewFolderKeydown"
            @blur="store.commitNewFolder()"
          />
          <span class="fsb-edit-hint">{{ t("edit.hint") }}</span>
        </div>

        <div
          v-for="entry in snapshot.entries"
          :key="entry.Path"
          class="fsb-row"
          :class="{
            'fsb-row-selected': snapshot.selection.includes(entry.Path),
            'fsb-row-hidden-item': entry.Hidden,
            'fsb-row-disabled': !rowSelectable(entry) && !isDirectoryLike(entry),
            'fsb-row-dimmed': store.isEntryDimmed(entry),
          }"
          @click="onRowClick($event, entry)"
          @dblclick="onRowDblClick(entry)"
          @contextmenu="onRowContextMenu($event, entry)"
        >
          <EntryIcon
            :kind="effectiveKind(entry)"
            :is-link="entry.IsLink"
            :broken="isBrokenLink(entry)"
          />
          <template v-if="snapshot.rename !== null && snapshot.rename.path === entry.Path">
            <input
              ref="renameInput"
              class="fsb-inline-input"
              type="text"
              :value="snapshot.rename.draft"
              @input="store.setRenameDraft(($event.target as HTMLInputElement).value)"
              @keydown="onRenameKeydown"
              @blur="store.commitRename()"
              @click.stop
            />
            <span class="fsb-edit-hint">{{ t("edit.hint") }}</span>
          </template>
          <template v-else>
            <span class="fsb-name">{{ entry.Name }}</span>
            <span class="fsb-size fsb-mono">{{ displaySize(entry) }}</span>
            <span class="fsb-modified fsb-mono">{{ displayModified(entry) }}</span>
          </template>
        </div>
      </template>
    </div>

    <!-- 存檔模式檔名輸入列 -->
    <div v-if="props.selectionMode === 'save'" class="fsb-save-row">
      <input
        class="fsb-save-input"
        type="text"
        :value="snapshot.saveName"
        :placeholder="t('save.namePlaceholder')"
        @input="store.setSaveName(($event.target as HTMLInputElement).value)"
        @keydown="onSaveNameKeydown"
      />
      <span v-if="snapshot.saveNameIssue === 'invalid'" class="fsb-save-issue">{{ t("save.invalidName") }}</span>
      <span v-else-if="snapshot.saveNameIssue === 'isDirectory'" class="fsb-save-issue">
        {{ t("save.isDirectory", { name: snapshot.saveName }) }}
      </span>
    </div>

    <!-- 右鍵選單 -->
    <ul
      v-if="contextMenu !== null"
      class="fsb-menu fsb-context-menu"
      :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
      @click.stop
    >
      <template v-if="contextMenu.kind === 'row'">
        <li class="fsb-menu-item" :class="{ 'fsb-menu-item-disabled': !canRename }" @click="menuRename()">
          {{ t("menu.rename") }}
        </li>
        <li class="fsb-menu-item fsb-menu-item-danger" @click="menuDelete()">
          {{ snapshot.selection.length > 1 ? t("menu.deleteCount", { count: snapshot.selection.length }) : t("menu.delete") }}
        </li>
        <li class="fsb-menu-item" @click="menuCopyPath()">{{ t("menu.copyPath") }}</li>
      </template>
      <template v-else>
        <li class="fsb-menu-item" @click="menuNewFolder()">{{ t("menu.newFolder") }}</li>
        <li class="fsb-menu-item" @click="menuRefresh()">{{ t("menu.refresh") }}</li>
        <li class="fsb-menu-item" @click="menuToggleHidden()">
          <span class="fsb-menu-check">{{ snapshot.showHidden ? "✓" : "" }}</span>
          {{ t("menu.showHidden") }}
        </li>
      </template>
    </ul>

    <!-- 狀態列 + 動作區 -->
    <div class="fsb-statusbar" :class="`fsb-statusbar-${statusVariant}`">
      <div class="fsb-status-text">
        <svg v-if="snapshot.loading" class="fsb-spinner" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M8 1.5 a6.5 6.5 0 1 1 -6.5 6.5" />
        </svg>
        <svg v-else-if="statusVariant === 'error'" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 5 v4 M8 11 v.1" />
        </svg>
        <span>{{ statusText }}</span>
        <button v-if="statusVariant === 'error'" type="button" class="fsb-status-dismiss" @click="store.dismissError()">
          {{ t("button.dismissError") }}
        </button>
      </div>
      <div class="fsb-actions">
        <template v-if="snapshot.overwriteConfirm !== null">
          <button type="button" class="fsb-btn" @click="store.cancelOverwrite()">{{ t("button.cancel") }}</button>
          <button type="button" class="fsb-btn fsb-btn-danger" @click="store.confirmOverwrite()">{{ t("button.overwrite") }}</button>
        </template>
        <template v-else-if="statusVariant === 'confirm'">
          <button type="button" class="fsb-btn" @click="store.cancelDelete()">{{ t("button.cancel") }}</button>
          <button type="button" class="fsb-btn fsb-btn-danger" @click="store.confirmDelete()">{{ t("button.delete") }}</button>
        </template>
        <template v-else>
          <button type="button" class="fsb-btn" @click="store.cancel()">{{ t("button.cancel") }}</button>
          <button
            type="button"
            class="fsb-btn fsb-btn-primary"
            :disabled="!snapshot.canConfirmSelection"
            @click="store.confirmSelection()"
          >
            {{ confirmLabel }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fsb-root {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 320px;
  background: var(--fsb-panel-bg);
  border: 1px solid var(--fsb-panel-border);
  border-radius: var(--fsb-radius-panel);
  overflow: hidden;
  font-family: var(--fsb-font-family);
  color: var(--fsb-text-primary);
  box-sizing: border-box;
}
.fsb-root * {
  box-sizing: border-box;
}
.fsb-mono {
  font-family: var(--fsb-font-family-mono);
}

/* 標題列 */
.fsb-titlebar {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0.6rem 0.9rem;
  border-bottom: 1px solid var(--fsb-section-border);
  flex: none;
}
.fsb-title {
  font-size: var(--fsb-font-size-title);
  font-weight: var(--fsb-font-weight-title);
}
.fsb-mode-hint {
  font-size: var(--fsb-font-size-label);
  color: var(--fsb-text-secondary);
}

/* 工具列 */
.fsb-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--fsb-section-border);
  flex: none;
  position: relative;
}
.fsb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: var(--fsb-control-height);
  padding: 0 10px;
  background: var(--fsb-button-bg);
  color: var(--fsb-text-primary);
  border: 1px solid var(--fsb-panel-border);
  border-radius: var(--fsb-radius);
  font-size: var(--fsb-font-size-status);
  cursor: pointer;
}
.fsb-btn:disabled {
  background: var(--fsb-subtle-bg);
  color: var(--fsb-text-muted);
  cursor: default;
}
.fsb-btn-icon {
  width: var(--fsb-control-height);
  padding: 0;
}
.fsb-btn-active {
  color: var(--fsb-accent);
  border-color: var(--fsb-accent);
}
.fsb-btn-primary {
  background: var(--fsb-accent);
  border-color: var(--fsb-accent);
  color: var(--fsb-panel-bg);
}
.fsb-btn-primary:disabled {
  background: var(--fsb-subtle-bg);
  border-color: var(--fsb-panel-border);
  color: var(--fsb-text-muted);
}
.fsb-btn-danger {
  background: var(--fsb-danger-bg);
  border-color: var(--fsb-danger-bg);
  color: #ffffff;
}
.fsb-path-input {
  flex: 1 1 auto;
  min-width: 0;
  height: var(--fsb-control-height);
  padding: 0 10px;
  background: var(--fsb-subtle-bg);
  border: 1px solid var(--fsb-panel-border);
  border-radius: var(--fsb-radius);
  color: var(--fsb-text-primary);
  font-size: var(--fsb-font-size-mono);
}
.fsb-root-switcher {
  position: relative;
}
.fsb-root-btn {
  gap: 6px;
}

/* 選單 (右鍵選單與根切換器共用外觀) */
.fsb-menu {
  position: fixed;
  z-index: 50;
  min-width: 160px;
  background: var(--fsb-panel-bg);
  border: 1px solid var(--fsb-panel-border);
  border-radius: var(--fsb-radius);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  list-style: none;
  margin: 0;
  padding: 4px;
}
.fsb-root-menu {
  position: absolute;
  left: 0;
  top: calc(var(--fsb-control-height) + 4px);
}
.fsb-menu-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  font-size: var(--fsb-font-size-status);
  border-radius: var(--fsb-radius);
  cursor: pointer;
  white-space: nowrap;
}
.fsb-menu-item:hover {
  background: var(--fsb-selected-row-bg);
}
.fsb-menu-item-disabled {
  color: var(--fsb-text-muted);
  cursor: default;
  pointer-events: none;
}
.fsb-menu-item-danger {
  color: var(--fsb-error-text);
  background: var(--fsb-error-bg);
}
.fsb-menu-check {
  display: inline-block;
  width: 1em;
}

/* 欄位標頭 */
.fsb-columns {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  background: var(--fsb-subtle-bg);
  border-bottom: 1px solid var(--fsb-section-border);
  font-size: var(--fsb-font-size-label);
  color: var(--fsb-text-secondary);
  flex: none;
}
.fsb-col-name {
  flex: 1 1 auto;
  padding-left: 24px;
}
.fsb-col-size {
  width: 76px;
  text-align: right;
}
.fsb-col-modified {
  width: 156px;
  text-align: right;
}

/* 列表 */
.fsb-list {
  flex: 1 1 auto;
  overflow-y: auto;
  min-height: 0;
}
.fsb-row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: var(--fsb-row-height);
  padding: 7px 12px;
  border-bottom: 1px solid var(--fsb-row-border);
  font-size: var(--fsb-font-size-row);
  cursor: default;
  user-select: none;
}
.fsb-row-selected {
  background: var(--fsb-selected-row-bg);
  box-shadow: inset 2px 0 0 var(--fsb-accent);
}
.fsb-row-hidden-item {
  opacity: 0.45;
}
.fsb-row-disabled {
  color: var(--fsb-text-muted);
}
.fsb-row-dimmed {
  opacity: 0.45;
  cursor: default;
}
.fsb-row-editing {
  background: var(--fsb-subtle-bg);
}
.fsb-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fsb-size {
  width: 76px;
  text-align: right;
  font-size: var(--fsb-font-size-mono);
  color: var(--fsb-text-secondary);
}
.fsb-modified {
  width: 156px;
  text-align: right;
  font-size: var(--fsb-font-size-mono);
  color: var(--fsb-text-secondary);
}
.fsb-inline-input {
  flex: 1 1 auto;
  height: 22px;
  padding: 0 6px;
  border: 1px solid var(--fsb-accent);
  border-radius: var(--fsb-radius);
  outline: 2px solid transparent;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--fsb-accent) 25%, transparent);
  background: var(--fsb-panel-bg);
  color: var(--fsb-text-primary);
  font-size: var(--fsb-font-size-row);
}
.fsb-edit-hint {
  flex: none;
  color: var(--fsb-text-muted);
  font-size: var(--fsb-font-size-label);
}

/* 骨架列 */
.fsb-skeleton-row {
  cursor: default;
}
.fsb-skeleton {
  display: block;
  background: var(--fsb-subtle-bg);
  border-radius: var(--fsb-radius);
}
.fsb-skeleton-icon {
  width: 16px;
  height: 16px;
}
.fsb-skeleton-text {
  flex: 1 1 auto;
  height: 12px;
  max-width: 240px;
}

/* 空目錄 */
.fsb-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 100%;
  padding: 2rem;
  color: var(--fsb-text-muted);
  text-align: center;
}
.fsb-empty-title {
  margin: 0;
  font-size: var(--fsb-font-size-row);
}
.fsb-empty-hint {
  margin: 0;
  font-size: var(--fsb-font-size-label);
}

/* 存檔模式檔名輸入列 */
.fsb-save-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--fsb-section-border);
  flex: none;
}
.fsb-save-input {
  flex: 1 1 auto;
  min-width: 0;
  height: var(--fsb-control-height);
  padding: 0 10px;
  background: var(--fsb-subtle-bg);
  border: 1px solid var(--fsb-panel-border);
  border-radius: var(--fsb-radius);
  color: var(--fsb-text-primary);
  font-size: var(--fsb-font-size-row);
}
.fsb-save-issue {
  flex: none;
  color: var(--fsb-error-text);
  font-size: var(--fsb-font-size-label);
}

/* 狀態列 + 動作區 */
.fsb-statusbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: calc(var(--fsb-control-height) + 8px);
  padding: 0 12px;
  background: var(--fsb-subtle-bg);
  border-top: 1px solid var(--fsb-section-border);
  font-size: var(--fsb-font-size-status);
  color: var(--fsb-text-secondary);
  flex: none;
}
.fsb-statusbar-error {
  background: var(--fsb-error-bg);
  color: var(--fsb-error-text);
}
.fsb-statusbar-confirm {
  color: var(--fsb-error-text);
}
.fsb-status-text {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fsb-status-dismiss {
  background: none;
  border: none;
  color: inherit;
  text-decoration: underline;
  cursor: pointer;
  font-size: var(--fsb-font-size-label);
  padding: 0;
}
.fsb-actions {
  display: flex;
  gap: 8px;
  flex: none;
}
.fsb-spinner {
  animation: fsb-spin 0.9s linear infinite;
}
@keyframes fsb-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
