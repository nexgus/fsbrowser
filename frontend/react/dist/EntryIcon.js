import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// EntryIcon: 依項目種類, 連結與失效連結狀態組出列表圖示 (計劃書第 7.4 節).
import { effectiveKind, isBrokenLink } from "@nexgus/fsb-core";
import { IconBrokenLink, IconDevice, IconFifo, IconFile, IconFolder, IconLinkBadge, IconSocket, } from "./icons.js";
/** EntryIcon 依項目的有效種類挑選基本圖示, 連結疊右下角徽章, 失效連結改為斷鏈圖示. */
export function EntryIcon({ entry }) {
    if (isBrokenLink(entry)) {
        return (_jsx("span", { className: "fsb-row-icon fsb-kind-broken", children: _jsx(IconBrokenLink, {}) }));
    }
    const kind = effectiveKind(entry);
    const Base = kind === "dir"
        ? IconFolder
        : kind === "socket"
            ? IconSocket
            : kind === "fifo"
                ? IconFifo
                : kind === "device"
                    ? IconDevice
                    : IconFile;
    const kindClass = kind === "dir"
        ? "fsb-kind-dir"
        : kind === "socket"
            ? "fsb-kind-socket"
            : kind === "fifo"
                ? "fsb-kind-fifo"
                : kind === "device"
                    ? "fsb-kind-device"
                    : "";
    return (_jsxs("span", { className: `fsb-row-icon ${kindClass}`, children: [_jsx(Base, {}), entry.IsLink ? (_jsx("span", { className: "fsb-row-icon-badge", children: _jsx(IconLinkBadge, {}) })) : null] }));
}
//# sourceMappingURL=EntryIcon.js.map