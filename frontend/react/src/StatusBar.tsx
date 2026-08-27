// StatusBar: 底部常駐狀態列 + 動作區 (計劃書第 5.4, 7.1 節). 高度恆定, 三型態共用同一塊
// 固定空間: 中性資訊, 錯誤 (可手動關閉, 下一次成功操作自動清除), 刪除確認.

import {
  formatErrorText,
  toDisplayPath,
  type BrowserSnapshot,
  type PathStyle,
  type Translate,
} from "@nexgus/fsb-core";
import { IconClose, IconSpinner, IconWarning } from "./icons.js";

export interface StatusBarProps {
  snapshot: BrowserSnapshot;
  pathStyle: PathStyle;
  t: Translate;
  /** 觸發刪除確認當下的項目數, 供 "正在刪除中" 文字使用 (刪除確認關閉後 snapshot 已無法得知該數字). */
  deletingCount: number;
  onDismissError: () => void;
  onCancelPanel: () => void;
  onConfirmSelection: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}

export function StatusBar(props: StatusBarProps) {
  const { snapshot, pathStyle, t } = props;

  // 刪除確認: 優先度最高, 取代平時的中性 / Select 動作區.
  if (snapshot.deleteConfirm !== null) {
    const count = snapshot.deleteConfirm.paths.length;
    return (
      <div className="fsb-statusbar">
        <span className="fsb-status-text">{t("status.deleteConfirm", { count })}</span>
        <div className="fsb-status-actions">
          <button type="button" className="fsb-action-btn" onClick={props.onCancelDelete}>
            {t("button.cancel")}
          </button>
          <button type="button" className="fsb-action-btn fsb-danger" onClick={props.onConfirmDelete}>
            {t("button.delete")}
          </button>
        </div>
      </div>
    );
  }

  if (snapshot.deleting) {
    return (
      <div className="fsb-statusbar">
        <span className="fsb-status-text">
          <IconSpinner size={14} />
          {t("status.deleting", { count: props.deletingCount })}
        </span>
      </div>
    );
  }

  if (snapshot.error !== null) {
    return (
      <div className="fsb-statusbar fsb-error">
        <span className="fsb-status-text">
          <IconWarning size={14} />
          {formatErrorText(t, snapshot.error)}
        </span>
        <div className="fsb-status-actions">
          <button
            type="button"
            className="fsb-status-dismiss"
            aria-label={t("button.dismissError")}
            onClick={props.onDismissError}
          >
            <IconClose size={14} />
          </button>
        </div>
      </div>
    );
  }

  const neutralText = statusNeutralText(snapshot, pathStyle, t);

  return (
    <div className="fsb-statusbar">
      <span className="fsb-status-text">
        {snapshot.loading ? <IconSpinner size={14} /> : null}
        {neutralText}
      </span>
      <div className="fsb-status-actions">
        <button type="button" className="fsb-action-btn" onClick={props.onCancelPanel}>
          {t("button.cancel")}
        </button>
        <button
          type="button"
          className="fsb-action-btn fsb-primary"
          disabled={!snapshot.canConfirmSelection}
          onClick={props.onConfirmSelection}
        >
          {t("button.select")}
        </button>
      </div>
    </div>
  );
}

/** statusNeutralText 依進行中的重新命名 / 建立目錄 / 載入或選取狀態組出中性狀態文字. */
function statusNeutralText(snapshot: BrowserSnapshot, pathStyle: PathStyle, t: Translate): string {
  if (snapshot.rename !== null) return t("status.renaming", { name: snapshot.rename.originalName });
  if (snapshot.newFolder !== null) {
    const name = snapshot.newFolder.draft.trim() || t("newFolder.defaultName");
    return t("status.creating", { name });
  }
  if (snapshot.loading) return t("status.loading", { path: toDisplayPath(snapshot.currentDir, pathStyle) });
  if (snapshot.selectedCount > 0) {
    return t("status.itemsSelected", { count: snapshot.itemCount, selected: snapshot.selectedCount });
  }
  return t("status.items", { count: snapshot.itemCount });
}
