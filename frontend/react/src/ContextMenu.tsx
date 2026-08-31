// ContextMenu: 面板內暫態元素, 點擊外部即收合, 非視窗 (計劃書第 5.5 節).

import { useEffect, useRef } from "react";
import { IconCheck } from "./icons.js";

export interface ContextMenuItem {
  key: string;
  label: string;
  disabled?: boolean;
  danger?: boolean;
  /** 勾選狀態, 選填; 未提供代表此項不是可勾選項目 (詳見下方渲染規則). */
  checked?: boolean;
  /** 快捷鍵顯示文字, 選填; 未提供者右側留白 (詳見下方渲染規則). */
  shortcut?: string;
  onSelect: () => void;
}

/** ContextMenuSeparator 是選單中的一道分隔線, 不可點選. */
export interface ContextMenuSeparator {
  key: string;
  separator: true;
}

/** ContextMenuEntry 是選單中的一列: 一般項目或分隔線. */
export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator;

export interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuEntry[];
  onClose: () => void;
}

function isSeparator(entry: ContextMenuEntry): entry is ContextMenuSeparator {
  return "separator" in entry && entry.separator;
}

/** ContextMenu 於指定座標渲染選單, 點擊外部或按 Esc 即收合. */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (ref.current !== null && !ref.current.contains(event.target as Node)) onClose();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [onClose]);

  const left = typeof window === "undefined" ? x : Math.min(x, window.innerWidth - 190);
  const top = typeof window === "undefined" ? y : Math.min(y, window.innerHeight - items.length * 32 - 16);

  const menuItems = items.filter((entry): entry is ContextMenuItem => !isSeparator(entry));
  // 只要選單中有任一項提供勾選狀態 (或快捷鍵), 每一項都要保留固定寬度的欄位, 讓文字對齊.
  const showCheckColumn = menuItems.some((item) => item.checked !== undefined);
  const showShortcutColumn = menuItems.some((item) => item.shortcut !== undefined);

  return (
    <div ref={ref} className="fsb-menu" style={{ left, top }} role="menu">
      {items.map((entry) =>
        isSeparator(entry) ? (
          <div key={entry.key} className="fsb-menu-sep" role="separator" />
        ) : (
          <div
            key={entry.key}
            role="menuitem"
            aria-disabled={entry.disabled}
            className={`fsb-menu-item${entry.disabled ? " fsb-disabled" : ""}${entry.danger ? " fsb-danger" : ""}`}
            onClick={() => {
              if (entry.disabled) return;
              entry.onSelect();
              onClose();
            }}
          >
            {showCheckColumn ? (
              <span className="fsb-menu-item-check">{entry.checked ? <IconCheck size={12} /> : null}</span>
            ) : null}
            <span className="fsb-menu-item-label">{entry.label}</span>
            {showShortcutColumn ? (
              <span className="fsb-menu-item-shortcut">{entry.shortcut ?? ""}</span>
            ) : null}
          </div>
        ),
      )}
    </div>
  );
}
