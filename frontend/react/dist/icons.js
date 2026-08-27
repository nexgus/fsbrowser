import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function Svg({ size = 16, children, ...rest }) {
    return (_jsx("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", ...rest, children: children }));
}
/** IconFolder 是資料夾基本圖示. */
export function IconFolder(props) {
    return (_jsx(Svg, { ...props, children: _jsx("path", { d: "M1.75 3.75c0-.55.45-1 1-1h3.1l1.2 1.5h6.2c.55 0 1 .45 1 1v7c0 .55-.45 1-1 1h-10.5c-.55 0-1-.45-1-1z" }) }));
}
/** IconFile 是一般檔案基本圖示. */
export function IconFile(props) {
    return (_jsxs(Svg, { ...props, children: [_jsx("path", { d: "M4 1.75h5l3 3v9.5a.75.75 0 0 1-.75.75h-7.25a.75.75 0 0 1-.75-.75v-11.75a.75.75 0 0 1 .75-.75z" }), _jsx("path", { d: "M9 1.75v3h3" })] }));
}
/** IconSocket 是 socket 特殊檔案圖示 (插座形). */
export function IconSocket(props) {
    return (_jsxs(Svg, { ...props, children: [_jsx("rect", { x: "3", y: "3", width: "10", height: "10", rx: "1.5" }), _jsx("path", { d: "M6 6v1.2M10 6v1.2M6 12v-1.5M10 12v-1.5" }), _jsx("path", { d: "M5.5 9.2h5v1.2h-5z" })] }));
}
/** IconFifo 是 named pipe 特殊檔案圖示 (管線形). */
export function IconFifo(props) {
    return (_jsxs(Svg, { ...props, children: [_jsx("path", { d: "M2 6.5h5.5a2 2 0 0 0 2-2v-.5" }), _jsx("path", { d: "M14 9.5h-5.5a2 2 0 0 0-2 2v.5" }), _jsx("circle", { cx: "2", cy: "6.5", r: "1.1" }), _jsx("circle", { cx: "14", cy: "9.5", r: "1.1" })] }));
}
/** IconDevice 是裝置檔圖示 (晶片形). */
export function IconDevice(props) {
    return (_jsxs(Svg, { ...props, children: [_jsx("rect", { x: "4.5", y: "4.5", width: "7", height: "7", rx: "1" }), _jsx("path", { d: "M6 4.5v-2M10 4.5v-2M6 13.5v-2M10 13.5v-2M4.5 6v-0M2.5 6h2M2.5 10h2M11.5 6h2M11.5 10h2" })] }));
}
/** IconLinkBadge 是連結徽章: 疊於基本圖示右下角的 9px 小方框, 內含斜向箭頭. */
export function IconLinkBadge(props) {
    return (_jsxs("svg", { width: 9, height: 9, viewBox: "0 0 9 9", "aria-hidden": "true", ...props, children: [_jsx("rect", { x: "0.5", y: "0.5", width: "8", height: "8", rx: "1.5", fill: "var(--fsb-panel-bg)", stroke: "currentColor", strokeWidth: 1 }), _jsx("path", { d: "M3.2 5.8 5.8 3.2", stroke: "currentColor", strokeWidth: 1, strokeLinecap: "round" }), _jsx("path", { d: "M3.9 3.2h1.9v1.9", stroke: "currentColor", strokeWidth: 1, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" })] }));
}
/** IconBrokenLink 是失效連結圖示 (斷鏈). */
export function IconBrokenLink(props) {
    return (_jsxs(Svg, { ...props, children: [_jsx("path", { d: "M6.2 9.8 4.6 11.4a1.8 1.8 0 0 1-2.5-2.5l1.6-1.6" }), _jsx("path", { d: "M9.8 6.2l1.6-1.6a1.8 1.8 0 0 0-2.5-2.5L7.3 3.7" }), _jsx("path", { d: "M9.5 6.5 6.5 9.5", strokeDasharray: "1.4 1.4" })] }));
}
/** IconUp 是工具列上層目錄按鈕圖示. */
export function IconUp(props) {
    return (_jsx(Svg, { ...props, children: _jsx("path", { d: "M8 12.5v-9M4.2 7.3 8 3.5l3.8 3.8" }) }));
}
/** IconHome 是工具列家目錄按鈕圖示. */
export function IconHome(props) {
    return (_jsxs(Svg, { ...props, children: [_jsx("path", { d: "M2.5 7.5 8 2.5l5.5 5" }), _jsx("path", { d: "M4 6.8v6.7h8V6.8" }), _jsx("path", { d: "M6.5 13.5v-4h3v4" })] }));
}
/** IconNewFolder 是新增資料夾按鈕圖示. */
export function IconNewFolder(props) {
    return (_jsxs(Svg, { ...props, children: [_jsx("path", { d: "M1.75 3.75c0-.55.45-1 1-1h3.1l1.2 1.5h6.2c.55 0 1 .45 1 1v7c0 .55-.45 1-1 1h-10.5c-.55 0-1-.45-1-1z" }), _jsx("path", { d: "M8 7v3.4M6.3 8.7h3.4" })] }));
}
/** IconEye 是隱藏檔切換鈕圖示 (顯示中: 睜眼; 隱藏中: 加斜線). */
export function IconEye(props) {
    const { crossed, ...rest } = props;
    return (_jsxs(Svg, { ...rest, children: [_jsx("path", { d: "M1.5 8s2.3-4.2 6.5-4.2S14.5 8 14.5 8 12.2 12.2 8 12.2 1.5 8 1.5 8z" }), _jsx("circle", { cx: "8", cy: "8", r: "1.8" }), crossed ? _jsx("path", { d: "M2.5 2.5l11 11" }) : null] }));
}
/** IconChevronDown 是根切換器下拉箭頭. */
export function IconChevronDown(props) {
    return (_jsx(Svg, { ...props, children: _jsx("path", { d: "M4 6.2 8 10l4-3.8" }) }));
}
/** IconCheck 是根切換器展開清單中目前根的勾號. */
export function IconCheck(props) {
    return (_jsx(Svg, { ...props, children: _jsx("path", { d: "M3.2 8.4 6.4 11.5l6.4-7" }) }));
}
/** IconWarning 是錯誤橫幅圖示. */
export function IconWarning(props) {
    return (_jsxs(Svg, { ...props, children: [_jsx("path", { d: "M8 2 14.5 13.5h-13z" }), _jsx("path", { d: "M8 6.5v3M8 11.6v.1" })] }));
}
/** IconClose 是錯誤橫幅的關閉鈕圖示. */
export function IconClose(props) {
    return (_jsx(Svg, { ...props, children: _jsx("path", { d: "M4 4l8 8M12 4l-8 8" }) }));
}
const spinnerStyle = { animation: "fsb-spin 0.8s linear infinite" };
/** IconSpinner 是載入中轉圈圖示. */
export function IconSpinner(props) {
    return (_jsxs(Svg, { ...props, style: { ...spinnerStyle, ...props.style }, children: [_jsx("path", { d: "M8 2v2.4" }), _jsx("path", { d: "M8 11.6V14", opacity: 0.3 }), _jsx("path", { d: "M2 8h2.4", opacity: 0.55 }), _jsx("path", { d: "M11.6 8H14", opacity: 0.85 }), _jsx("path", { d: "M3.8 3.8l1.7 1.7", opacity: 0.4 }), _jsx("path", { d: "M10.5 10.5l1.7 1.7", opacity: 1 }), _jsx("path", { d: "M3.8 12.2l1.7-1.7", opacity: 0.7 }), _jsx("path", { d: "M10.5 5.5l1.7-1.7", opacity: 0.15 })] }));
}
/** IconEmptyFolder 是空目錄置中的大號淡化資料夾圖示. */
export function IconEmptyFolder(props) {
    return (_jsx(Svg, { viewBox: "0 0 16 16", ...props, size: props.size ?? 40, children: _jsx("path", { d: "M1.75 3.75c0-.55.45-1 1-1h3.1l1.2 1.5h6.2c.55 0 1 .45 1 1v7c0 .55-.45 1-1 1h-10.5c-.55 0-1-.45-1-1z" }) }));
}
//# sourceMappingURL=icons.js.map