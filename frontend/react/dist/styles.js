// 面板樣式: 純 CSS 字串, 全部取值一律走 core 提供的 CSS 變數 (--fsb-*), 不寫死顏色與
// 字級 (計劃書第 6.2, 7 章). 由 FsBrowser 以行內 <style> 標籤注入, 以 .fsb-root 為根,
// 不依賴外部樣式表, 使套件可直接嵌入任意宿主頁面.
export const FSB_STYLE_CSS = `
.fsb-root {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--fsb-panel-bg);
  color: var(--fsb-text-primary);
  border: 1px solid var(--fsb-panel-border);
  border-radius: var(--fsb-radius-panel);
  font-family: var(--fsb-font-family);
  overflow: hidden;
}
.fsb-root * { box-sizing: border-box; }

.fsb-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  flex-shrink: 0;
  padding: 0 12px;
  border-bottom: 1px solid var(--fsb-section-border);
}
.fsb-title {
  font-size: var(--fsb-font-size-title);
  font-weight: var(--fsb-font-weight-title);
}
.fsb-mode-hint {
  font-size: var(--fsb-font-size-label);
  color: var(--fsb-text-secondary);
}

.fsb-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 6px 10px;
  border-bottom: 1px solid var(--fsb-section-border);
  background: var(--fsb-subtle-bg);
}
.fsb-btn {
  width: var(--fsb-control-height);
  height: var(--fsb-control-height);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--fsb-radius);
  border: 1px solid var(--fsb-panel-border);
  background: var(--fsb-button-bg);
  color: var(--fsb-text-primary);
  cursor: pointer;
  padding: 0;
}
.fsb-btn:hover:not(:disabled) { border-color: var(--fsb-accent); }
.fsb-btn:disabled { opacity: 0.45; cursor: default; }
.fsb-btn.fsb-btn-active { color: var(--fsb-accent); border-color: var(--fsb-accent); }

.fsb-path-input {
  flex: 1;
  min-width: 0;
  height: var(--fsb-control-height);
  border: 1px solid var(--fsb-panel-border);
  border-radius: var(--fsb-radius);
  background: var(--fsb-panel-bg);
  color: var(--fsb-text-primary);
  font-family: var(--fsb-font-family-mono);
  font-size: var(--fsb-font-size-mono);
  padding: 0 8px;
}
.fsb-path-input:focus {
  outline: none;
  border-color: var(--fsb-accent);
  box-shadow: 0 0 0 3px var(--fsb-selected-row-bg);
}

.fsb-root-switcher { position: relative; flex-shrink: 0; }
.fsb-root-switcher-btn {
  height: var(--fsb-control-height);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  border: 1px solid var(--fsb-panel-border);
  border-radius: var(--fsb-radius);
  background: var(--fsb-button-bg);
  color: var(--fsb-text-primary);
  font-family: var(--fsb-font-family-mono);
  font-size: var(--fsb-font-size-mono);
  cursor: pointer;
}
.fsb-root-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 110px;
  background: var(--fsb-panel-bg);
  border: 1px solid var(--fsb-panel-border);
  border-radius: var(--fsb-radius);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
  padding: 4px;
  z-index: 30;
}
.fsb-root-menu-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: var(--fsb-radius);
  font-family: var(--fsb-font-family-mono);
  font-size: var(--fsb-font-size-mono);
  cursor: pointer;
}
.fsb-root-menu-item:hover { background: var(--fsb-subtle-bg); }
.fsb-root-menu-item.fsb-current { background: var(--fsb-selected-row-bg); }
.fsb-root-menu-item-check { width: 14px; flex-shrink: 0; color: var(--fsb-accent); }

.fsb-columns {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding: 6px 12px;
  border-bottom: 1px solid var(--fsb-section-border);
  font-size: var(--fsb-font-size-label);
  color: var(--fsb-text-secondary);
}
.fsb-col-name { flex: 1; padding-left: 24px; }
.fsb-col-size { width: 76px; text-align: right; }
.fsb-col-modified { width: 156px; text-align: right; }

.fsb-list { flex: 1; overflow-y: auto; position: relative; min-height: 0; }

.fsb-row {
  display: flex;
  align-items: center;
  height: var(--fsb-row-height);
  padding: 0 12px;
  border-bottom: 1px solid var(--fsb-row-border);
  cursor: default;
  user-select: none;
}
.fsb-row:hover { background: var(--fsb-subtle-bg); }
.fsb-row.fsb-selected {
  background: var(--fsb-selected-row-bg);
  box-shadow: inset 2px 0 0 var(--fsb-accent);
}
.fsb-row.fsb-dim { opacity: 0.45; }
.fsb-row.fsb-broken { opacity: 0.55; }
.fsb-row.fsb-row-unselectable { opacity: 0.45; cursor: default; }
.fsb-row.fsb-row-unselectable:hover { background: none; }

.fsb-row-icon {
  width: 16px;
  height: 16px;
  position: relative;
  flex-shrink: 0;
  margin-right: 8px;
  color: var(--fsb-file-icon);
}
.fsb-row-icon.fsb-kind-dir { color: var(--fsb-folder-icon); }
.fsb-row-icon.fsb-kind-socket { color: #8a6fb0; }
.fsb-row-icon.fsb-kind-fifo { color: #3f9aa0; }
.fsb-row-icon.fsb-kind-device { color: #b08a3e; }
.fsb-row-icon.fsb-kind-broken { color: var(--fsb-error-text); }
.fsb-row-icon-badge { position: absolute; right: -3px; bottom: -3px; color: var(--fsb-text-secondary); }

.fsb-row-name {
  flex: 1;
  min-width: 0;
  font-size: var(--fsb-font-size-row);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fsb-row-size {
  width: 76px;
  flex-shrink: 0;
  text-align: right;
  font-family: var(--fsb-font-family-mono);
  font-size: var(--fsb-font-size-mono);
  color: var(--fsb-text-secondary);
}
.fsb-row-modified {
  width: 156px;
  flex-shrink: 0;
  text-align: right;
  font-family: var(--fsb-font-family-mono);
  font-size: var(--fsb-font-size-mono);
  color: var(--fsb-text-secondary);
}

.fsb-row-edit-input {
  flex: 1;
  min-width: 0;
  height: 22px;
  border: 1px solid var(--fsb-accent);
  border-radius: var(--fsb-radius);
  background: var(--fsb-panel-bg);
  color: var(--fsb-text-primary);
  font-size: var(--fsb-font-size-row);
  padding: 0 6px;
  outline: none;
  box-shadow: 0 0 0 3px var(--fsb-selected-row-bg);
}
.fsb-row-edit-hint {
  margin-left: 8px;
  flex-shrink: 0;
  font-size: var(--fsb-font-size-label);
  color: var(--fsb-text-muted);
  white-space: nowrap;
}

.fsb-skeleton-row {
  display: flex;
  align-items: center;
  height: var(--fsb-row-height);
  padding: 0 12px;
  gap: 8px;
}
.fsb-skeleton-block {
  height: 12px;
  border-radius: var(--fsb-radius);
  background: var(--fsb-subtle-bg);
}

.fsb-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 160px;
  color: var(--fsb-text-muted);
  gap: 6px;
}
.fsb-empty-icon { opacity: 0.5; }
.fsb-empty-title { font-size: var(--fsb-font-size-row); }
.fsb-empty-hint { font-size: var(--fsb-font-size-label); }

.fsb-menu {
  position: fixed;
  min-width: 170px;
  background: var(--fsb-panel-bg);
  border: 1px solid var(--fsb-panel-border);
  border-radius: var(--fsb-radius-panel);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.24);
  padding: 4px;
  z-index: 100;
  font-size: var(--fsb-font-size-status);
}
.fsb-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 10px;
  border-radius: var(--fsb-radius);
  cursor: pointer;
}
.fsb-menu-item:hover:not(.fsb-disabled) { background: var(--fsb-subtle-bg); }
.fsb-menu-item.fsb-disabled { color: var(--fsb-text-muted); cursor: default; }
.fsb-menu-item.fsb-danger { color: var(--fsb-error-text); background: var(--fsb-error-bg); }
.fsb-menu-item.fsb-danger:hover { background: var(--fsb-error-bg); }
.fsb-menu-sep { height: 1px; margin: 4px 2px; background: var(--fsb-section-border); }

.fsb-savename {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
  padding: 8px 12px;
  border-top: 1px solid var(--fsb-section-border);
  background: var(--fsb-subtle-bg);
}
.fsb-savename-input {
  height: var(--fsb-control-height);
  border: 1px solid var(--fsb-panel-border);
  border-radius: var(--fsb-radius);
  background: var(--fsb-panel-bg);
  color: var(--fsb-text-primary);
  font-size: var(--fsb-font-size-row);
  padding: 0 8px;
}
.fsb-savename-input:focus {
  outline: none;
  border-color: var(--fsb-accent);
  box-shadow: 0 0 0 3px var(--fsb-selected-row-bg);
}
.fsb-savename-issue {
  font-size: var(--fsb-font-size-label);
  color: var(--fsb-error-text);
}

.fsb-statusbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  flex-shrink: 0;
  padding: 0 12px;
  gap: 12px;
  border-top: 1px solid var(--fsb-section-border);
  background: var(--fsb-subtle-bg);
  font-size: var(--fsb-font-size-status);
  color: var(--fsb-text-secondary);
}
.fsb-statusbar.fsb-error {
  background: var(--fsb-error-bg);
  color: var(--fsb-error-text);
}
.fsb-status-text {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fsb-status-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.fsb-status-dismiss {
  display: flex;
  align-items: center;
  background: none;
  border: none;
  padding: 2px;
  color: var(--fsb-error-text);
  cursor: pointer;
  flex-shrink: 0;
}

.fsb-action-btn {
  height: var(--fsb-control-height);
  padding: 0 14px;
  border-radius: var(--fsb-radius);
  border: 1px solid var(--fsb-panel-border);
  background: var(--fsb-button-bg);
  color: var(--fsb-text-primary);
  cursor: pointer;
  font-size: var(--fsb-font-size-status);
}
.fsb-action-btn:hover:not(:disabled) { border-color: var(--fsb-accent); }
.fsb-action-btn.fsb-primary { background: var(--fsb-accent); border-color: var(--fsb-accent); color: #fff; }
.fsb-action-btn.fsb-danger { background: var(--fsb-danger-bg); border-color: var(--fsb-danger-bg); color: #fff; }
.fsb-action-btn:disabled { opacity: 0.45; cursor: default; }

@keyframes fsb-spin { to { transform: rotate(360deg); } }
`;
//# sourceMappingURL=styles.js.map