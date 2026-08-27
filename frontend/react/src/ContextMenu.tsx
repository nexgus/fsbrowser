// ContextMenu: 面板內暫態元素, 點擊外部即收合, 非視窗 (計劃書第 5.5 節).

import { useEffect, useRef } from "react";

export interface ContextMenuItem {
  key: string;
  label: string;
  disabled?: boolean;
  danger?: boolean;
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
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
