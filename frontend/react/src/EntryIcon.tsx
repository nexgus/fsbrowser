// EntryIcon: 依項目種類, 連結與失效連結狀態組出列表圖示 (計劃書第 7.4 節).

import { effectiveKind, isBrokenLink, type Entry } from "@nexgus/fsb-core";
import {
  IconBrokenLink,
  IconDevice,
  IconFifo,
  IconFile,
  IconFolder,
  IconLinkBadge,
  IconSocket,
} from "./icons.js";

export interface EntryIconProps {
  entry: Entry;
}

/** EntryIcon 依項目的有效種類挑選基本圖示, 連結疊右下角徽章, 失效連結改為斷鏈圖示. */
export function EntryIcon({ entry }: EntryIconProps) {
  if (isBrokenLink(entry)) {
    return (
      <span className="fsb-row-icon fsb-kind-broken">
        <IconBrokenLink />
      </span>
    );
  }

  const kind = effectiveKind(entry);
  const Base =
    kind === "dir"
      ? IconFolder
      : kind === "socket"
        ? IconSocket
        : kind === "fifo"
          ? IconFifo
          : kind === "device"
            ? IconDevice
            : IconFile;
  const kindClass =
    kind === "dir"
      ? "fsb-kind-dir"
      : kind === "socket"
        ? "fsb-kind-socket"
        : kind === "fifo"
          ? "fsb-kind-fifo"
          : kind === "device"
            ? "fsb-kind-device"
            : "";

  return (
    <span className={`fsb-row-icon ${kindClass}`}>
      <Base />
      {entry.IsLink ? (
        <span className="fsb-row-icon-badge">
          <IconLinkBadge />
        </span>
      ) : null}
    </span>
  );
}
