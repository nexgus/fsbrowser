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
  const { entry, selected, pathStyle, sizeUnit, t, editing } = props;
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
      <span className="fsb-row-size">{effectiveKind(entry) === "dir" ? "" : formatSize(entry.Size, sizeUnit)}</span>
      <span className="fsb-row-modified">{formatDateTime(entry.ModTime)}</span>
    </div>
  );
}
