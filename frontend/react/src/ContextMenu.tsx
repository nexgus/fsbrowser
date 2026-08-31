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
  onSelect: () => void;
}

export interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
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

  // 只要選單中有任一項提供勾選狀態, 每一項都要保留固定寬度的勾選欄位, 讓文字左緣對齊.
  const showCheckColumn = items.some((item) => item.checked !== undefined);

  return (
    <div ref={ref} className="fsb-menu" style={{ left, top }} role="menu">
      {items.map((item) => (
        <div
          key={item.key}
          role="menuitem"
          aria-disabled={item.disabled}
          className={`fsb-menu-item${item.disabled ? " fsb-disabled" : ""}${item.danger ? " fsb-danger" : ""}`}
          onClick={() => {
            if (item.disabled) return;
            item.onSelect();
            onClose();
          }}
        >
          {showCheckColumn ? (
            <span className="fsb-menu-item-check">{item.checked ? <IconCheck size={12} /> : null}</span>
          ) : null}
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
