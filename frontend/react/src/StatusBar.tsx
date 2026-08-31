// StatusBar: 底部常駐狀態列 + 動作區 (計劃書第 5.3, 5.4, 5.6, 5.7, 7.1 節). 高度恆定,
// 各型態共用同一塊固定空間, 判定優先序 (由高至低): 存檔模式覆寫確認, 刪除確認, 貼上衝突
// 詢問, 貼上進行中, 刪除進行中, 貼上批次結果, 錯誤, 中性.

import {
  formatErrorText,
  toDisplayPath,
  type BrowserSnapshot,
  type PasteConflictChoice,
  type PathStyle,
  type ReturnMode,
  type SelectionMode,
  type Translate,
} from "@nexgus/fsb-core";
import { IconClose, IconSpinner, IconWarning } from "./icons.js";

export interface StatusBarProps {
  snapshot: BrowserSnapshot;
  pathStyle: PathStyle;
  selectionMode: SelectionMode;
  returnMode: ReturnMode;
  t: Translate;
  /** 觸發刪除確認當下的項目數, 供 "正在刪除中" 文字使用 (刪除確認關閉後 snapshot 已無法得知該數字). */
  deletingCount: number;
  onDismissError: () => void;
  onCancelPanel: () => void;
  onConfirmSelection: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onConfirmOverwrite: () => void;
  onCancelOverwrite: () => void;
  onResolvePasteConflict: (choice: PasteConflictChoice) => void;
  onCancelPaste: () => void;
  onDismissPasteOutcome: () => void;
}

export function StatusBar(props: StatusBarProps) {
  const { snapshot, pathStyle, t } = props;

  // 覆寫確認: 優先度最高 (僅存檔模式可能出現), 取代平時的中性 / Save 動作區.
  if (snapshot.overwriteConfirm !== null) {
    return (
      <div className="fsb-statusbar">
        <span className="fsb-status-text">{t("save.overwriteConfirm", { name: snapshot.overwriteConfirm.name })}</span>
        <div className="fsb-status-actions">
          <button type="button" className="fsb-action-btn" onClick={props.onCancelOverwrite}>
            {t("button.cancel")}
          </button>
          <button type="button" className="fsb-action-btn fsb-danger" onClick={props.onConfirmOverwrite}>
            {t("button.overwrite")}
          </button>
        </div>
      </div>
    );
  }

  // 刪除確認: 取代平時的中性 / Select 動作區.
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

  // 貼上同名衝突詢問: 五個選項一次排開, 以較窄的間距與內距因應, 不換行不增高.
  if (snapshot.pasteConflict !== null) {
    const conflict = snapshot.pasteConflict;
    return (
      <div className="fsb-statusbar">
        <span className="fsb-status-text">{t("status.pasteConflict", { name: conflict.name })}</span>
        <div className="fsb-status-actions fsb-status-actions-compact">
          <button type="button" className="fsb-action-btn" onClick={() => props.onResolvePasteConflict("overwrite")}>
            {t("button.overwrite")}
          </button>
          <button type="button" className="fsb-action-btn" onClick={() => props.onResolvePasteConflict("overwriteAll")}>
            {t("button.overwriteAll")}
          </button>
          <button type="button" className="fsb-action-btn" onClick={() => props.onResolvePasteConflict("skip")}>
            {t("button.skip")}
          </button>
          <button type="button" className="fsb-action-btn" onClick={() => props.onResolvePasteConflict("skipAll")}>
            {t("button.skipAll")}
          </button>
          <button type="button" className="fsb-action-btn" onClick={() => props.onResolvePasteConflict("cancel")}>
            {t("button.cancel")}
          </button>
        </div>
      </div>
    );
  }

  // 貼上進行中: 依模式取複製或搬移的文字, 可取消時右側顯示取消鈕.
  if (snapshot.pasteProgress !== null) {
    const progress = snapshot.pasteProgress;
    const key = progress.mode === "copy" ? "status.copying" : "status.moving";
    return (
      <div className="fsb-statusbar">
        <span className="fsb-status-text">
          <IconSpinner size={14} />
          {t(key, { current: progress.current, count: progress.count })}
        </span>
        {progress.canCancel ? (
          <div className="fsb-status-actions">
            <button type="button" className="fsb-action-btn" onClick={props.onCancelPaste}>
              {t("button.cancel")}
            </button>
          </div>
        ) : null}
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

  // 貼上批次結果: 取消與斷線恆顯示; 正常結束時僅在失敗項含種類不符且目前無錯誤才顯示,
  // 其餘正常結束情形不由本型態呈現 (落至下方的錯誤或中性).
  const pasteOutcomeText = pasteOutcomeStatusText(snapshot, t);
  if (pasteOutcomeText !== null) {
    return (
      <div className="fsb-statusbar">
        <span className="fsb-status-text">{pasteOutcomeText}</span>
        <div className="fsb-status-actions">
          <button
            type="button"
            className="fsb-status-dismiss"
            aria-label={t("button.dismissError")}
            onClick={props.onDismissPasteOutcome}
          >
            <IconClose size={14} />
          </button>
        </div>
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

  const neutralText = statusNeutralText(snapshot, pathStyle, props.selectionMode, props.returnMode, t);

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
          {props.selectionMode === "save" ? t("button.save") : t("button.select")}
        </button>
      </div>
    </div>
  );
}

/**
 * pasteOutcomeStatusText 依貼上批次結果組出狀態列文字 (計劃書第 5.3, 5.6, 5.7 節):
 * 取消, 斷線兩種收場恆顯示; 正常結束時僅在失敗項含種類不符且目前無錯誤才顯示種類不符文字,
 * 其餘正常結束情形回傳 null, 不由本型態呈現.
 */
function pasteOutcomeStatusText(snapshot: BrowserSnapshot, t: Translate): string | null {
  const outcome = snapshot.pasteOutcome;
  if (outcome === null) return null;
  if (outcome.reason === "canceled") {
    return t("status.pasteCanceled", { done: outcome.done, count: outcome.count });
  }
  if (outcome.reason === "disconnected") {
    return t("status.pasteDisconnected", { name: outcome.name, done: outcome.done, count: outcome.count });
  }
  if (snapshot.error !== null) return null;
  const mismatch = outcome.failures.find((failure) => failure.reason === "typeMismatch");
  if (mismatch === undefined) return null;
  return t("status.pasteTypeMismatch", { name: mismatch.name });
}

/** statusNeutralText 依進行中的重新命名 / 建立目錄 / 載入或選取狀態組出中性狀態文字. */
function statusNeutralText(
  snapshot: BrowserSnapshot,
  pathStyle: PathStyle,
  selectionMode: SelectionMode,
  returnMode: ReturnMode,
  t: Translate,
): string {
  if (snapshot.rename !== null) return t("status.renaming", { name: snapshot.rename.originalName });
  if (snapshot.newFolder !== null) {
    const name = snapshot.newFolder.draft.trim() || t("newFolder.defaultName");
    return t("status.creating", { name });
  }
  if (snapshot.loading) return t("status.loading", { path: toDisplayPath(snapshot.currentDir, pathStyle) });
  // 非存檔模式且回傳模式為單選時, 選取數超過一項無法確認, 以提示取代平時的計數文字.
  if (selectionMode !== "save" && returnMode === "single" && snapshot.selectedCount > 1) {
    return t("status.tooManySelected");
  }
  if (snapshot.selectedCount > 0) {
    return t("status.itemsSelected", { count: snapshot.itemCount, selected: snapshot.selectedCount });
  }
  return t("status.items", { count: snapshot.itemCount });
}
