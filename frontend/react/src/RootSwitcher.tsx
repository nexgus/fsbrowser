// RootSwitcher: 工具列內的根切換下拉 (計劃書第 7.1, 7.3 節). 實作回報的根多於一個時才
// 出現 (例如 Windows 磁碟機); 單一根時完全不渲染, 元件內沒有任何 Windows 特例判斷.

import { useEffect, useRef, useState } from "react";
import { rootDisplayLabel, type PathStyle } from "@nexgus/fsb-core";
import { IconCheck, IconChevronDown } from "./icons.js";

export interface RootSwitcherProps {
  roots: readonly string[];
  currentRoot: string;
  pathStyle: PathStyle;
  disabled?: boolean;
  onSwitch: (root: string) => void;
  ariaLabel: string;
}

export function RootSwitcher({ roots, currentRoot, pathStyle, disabled, onSwitch, ariaLabel }: RootSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (ref.current !== null && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown, true);
    return () => document.removeEventListener("mousedown", handlePointerDown, true);
  }, [open]);

  if (roots.length <= 1) return null;

  return (
    <div className="fsb-root-switcher" ref={ref}>
      <button
        type="button"
        className="fsb-root-switcher-btn"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{rootDisplayLabel(currentRoot, pathStyle)}</span>
        <IconChevronDown size={12} />
      </button>
      {open ? (
        <div className="fsb-root-menu" role="menu">
          {roots.map((root) => {
            const current = root === currentRoot;
            return (
              <div
                key={root}
                role="menuitem"
                className={`fsb-root-menu-item${current ? " fsb-current" : ""}`}
                onClick={() => {
                  setOpen(false);
                  if (!current) onSwitch(root);
                }}
              >
                <span className="fsb-root-menu-item-check">{current ? <IconCheck size={12} /> : null}</span>
                <span>{rootDisplayLabel(root, pathStyle)}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
