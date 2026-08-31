// Row: 列表單列, 含一般顯示與列內重新命名兩種狀態 (計劃書第 7.1, 7.3 節).

import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import {
  effectiveKind,
  formatDateTime,
  formatSize,
  toDisplayPath,
  type Entry,
  type PathStyle,
  type SizeUnitSystem,
  type Translate,
} from "@nexgus/fsb-core";
import { EntryIcon } from "./EntryIcon.js";

export interface RowProps {
  entry: Entry;
  selected: boolean;
  /** 是否應淡化呈現且不可選取 (存檔模式下不符副檔名過濾, 或選取模式下的目錄以外等情形, 由 core 判定). */
  dimmed: boolean;
  /** 是否在剪下模式的剪貼內容中, 整列淡化呈現 (計劃書第 5.8 節); 複製狀態不改變外觀. */
  cut: boolean;
  pathStyle: PathStyle;
  sizeUnit: SizeUnitSystem;
  t: Translate;
  editing: boolean;
  editDraft: string;
  onEditDraftChange: (draft: string) => void;
  onEditCommit: () => void;
  onEditCancel: () => void;
  onClick: (event: ReactMouseEvent) => void;
  onDoubleClick: () => void;
  onContextMenu: (event: ReactMouseEvent) => void;
}

/** Row 渲染單一項目; editing 為真時該列轉為列內重新命名編輯狀態. */
export function Row(props: RowProps) {
  const { entry, selected, dimmed, cut, pathStyle, sizeUnit, t, editing } = props;
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const rowClass = [
    "fsb-row",
    selected ? "fsb-selected" : "",
    entry.Hidden ? "fsb-dim" : "",
    dimmed ? "fsb-row-unselectable" : "",
    cut ? "fsb-cut" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (editing) {
    return (
      <div className={rowClass}>
        <EntryIcon entry={entry} />
        <input
          ref={inputRef}
          className="fsb-row-edit-input"
          value={props.editDraft}
          onChange={(event) => props.onEditDraftChange(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Enter") props.onEditCommit();
            else if (event.key === "Escape") props.onEditCancel();
          }}
          onBlur={props.onEditCommit}
        />
        <span className="fsb-row-edit-hint">{t("edit.hint")}</span>
      </div>
    );
  }

  return (
    <div
      className={rowClass}
      onClick={props.onClick}
      onDoubleClick={props.onDoubleClick}
      onContextMenu={props.onContextMenu}
      title={toDisplayPath(entry.Path, pathStyle)}
    >
      <EntryIcon entry={entry} />
      <span className="fsb-row-name">{entry.Name}</span>
      <span className="fsb-row-size">{displaySize(entry, sizeUnit)}</span>
      <span className="fsb-row-modified">{formatDateTime(entry.ModTime)}</span>
    </div>
  );
}

/**
 * displaySize 決定大小欄的顯示文字: 目錄的大小為 0 時留白, 其餘情形 (含 0 位元組的一般
 * 檔案) 一律照單位制格式化. Windows 檔案系統對目錄固定回報 0, 留白可避免整欄出現無意義
 * 的 "0 B"; POSIX 檔案系統回報的是目錄本身佔用的位元組數, 則照常顯示.
 */
function displaySize(entry: Entry, sizeUnit: SizeUnitSystem): string {
  if (effectiveKind(entry) === "dir" && entry.Size === 0) return "";
  return formatSize(entry.Size, sizeUnit);
}
