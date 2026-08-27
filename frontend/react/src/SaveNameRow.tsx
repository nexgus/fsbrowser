// SaveNameRow: 存檔模式的檔名輸入列, 置於清單與狀態列之間 (計劃書第 5.4, 7 章).

import type { SaveNameIssue, Translate } from "@nexgus/fsb-core";

export interface SaveNameRowProps {
  name: string;
  issue: SaveNameIssue | null;
  t: Translate;
  onChange: (name: string) => void;
  onCommit: () => void;
}

export function SaveNameRow({ name, issue, t, onChange, onCommit }: SaveNameRowProps) {
  return (
    <div className="fsb-savename">
      <input
        className="fsb-savename-input"
        value={name}
        placeholder={t("save.namePlaceholder")}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onCommit();
        }}
      />
      {issue === "invalid" ? <span className="fsb-savename-issue">{t("save.invalidName")}</span> : null}
      {issue === "isDirectory" ? (
        <span className="fsb-savename-issue">{t("save.isDirectory", { name })}</span>
      ) : null}
    </div>
  );
}
