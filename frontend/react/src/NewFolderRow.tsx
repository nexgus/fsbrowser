// NewFolderRow: 建立目錄的列內編輯列, 樣式比照重新命名 (計劃書第 7.3 節).

import { useEffect, useRef } from "react";
import type { Translate } from "@nexgus/fsb-core";
import { IconFolder } from "./icons.js";

export interface NewFolderRowProps {
  draft: string;
  t: Translate;
  onChange: (draft: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

export function NewFolderRow({ draft, t, onChange, onCommit, onCancel }: NewFolderRowProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div className="fsb-row">
      <span className="fsb-row-icon fsb-kind-dir">
        <IconFolder />
      </span>
      <input
        ref={inputRef}
        className="fsb-row-edit-input"
        placeholder={t("newFolder.defaultName")}
        value={draft}
        onChange={(event) => onChange(event.target.value)}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Enter") onCommit();
          else if (event.key === "Escape") onCancel();
        }}
        onBlur={onCommit}
      />
      <span className="fsb-row-edit-hint">{t("edit.hint")}</span>
    </div>
  );
}
