// Icon 體系 (計劃書第 7.4 節): 一律線條式 (stroke) SVG, 16px 格線, 線寬 1.5, 不用 emoji,
// 不引入 icon 庫, 全部 inline 手繪.

import type { CSSProperties, SVGProps } from "react";

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

function Svg({ size = 16, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** IconFolder 是資料夾基本圖示. */
export function IconFolder(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M1.75 3.75c0-.55.45-1 1-1h3.1l1.2 1.5h6.2c.55 0 1 .45 1 1v7c0 .55-.45 1-1 1h-10.5c-.55 0-1-.45-1-1z" />
    </Svg>
  );
}

/** IconFile 是一般檔案基本圖示. */
export function IconFile(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 1.75h5l3 3v9.5a.75.75 0 0 1-.75.75h-7.25a.75.75 0 0 1-.75-.75v-11.75a.75.75 0 0 1 .75-.75z" />
      <path d="M9 1.75v3h3" />
    </Svg>
  );
}

/** IconSocket 是 socket 特殊檔案圖示 (插座形). */
export function IconSocket(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="10" height="10" rx="1.5" />
      <path d="M6 6v1.2M10 6v1.2M6 12v-1.5M10 12v-1.5" />
      <path d="M5.5 9.2h5v1.2h-5z" />
    </Svg>
  );
}

/** IconFifo 是 named pipe 特殊檔案圖示 (管線形). */
export function IconFifo(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2 6.5h5.5a2 2 0 0 0 2-2v-.5" />
      <path d="M14 9.5h-5.5a2 2 0 0 0-2 2v.5" />
      <circle cx="2" cy="6.5" r="1.1" />
      <circle cx="14" cy="9.5" r="1.1" />
    </Svg>
  );
}

/** IconDevice 是裝置檔圖示 (晶片形). */
export function IconDevice(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.5" y="4.5" width="7" height="7" rx="1" />
      <path d="M6 4.5v-2M10 4.5v-2M6 13.5v-2M10 13.5v-2M4.5 6v-0M2.5 6h2M2.5 10h2M11.5 6h2M11.5 10h2" />
    </Svg>
  );
}

/** IconLinkBadge 是連結徽章: 疊於基本圖示右下角的 9px 小方框, 內含斜向箭頭. */
export function IconLinkBadge(props: IconProps) {
  return (
    <svg width={9} height={9} viewBox="0 0 9 9" aria-hidden="true" {...props}>
      <rect x="0.5" y="0.5" width="8" height="8" rx="1.5" fill="var(--fsb-panel-bg)" stroke="currentColor" strokeWidth={1} />
      <path d="M3.2 5.8 5.8 3.2" stroke="currentColor" strokeWidth={1} strokeLinecap="round" />
      <path d="M3.9 3.2h1.9v1.9" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/** IconBrokenLink 是失效連結圖示 (斷鏈). */
export function IconBrokenLink(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.2 9.8 4.6 11.4a1.8 1.8 0 0 1-2.5-2.5l1.6-1.6" />
      <path d="M9.8 6.2l1.6-1.6a1.8 1.8 0 0 0-2.5-2.5L7.3 3.7" />
      <path d="M9.5 6.5 6.5 9.5" strokeDasharray="1.4 1.4" />
    </Svg>
  );
}

/** IconUp 是工具列上層目錄按鈕圖示. */
export function IconUp(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 12.5v-9M4.2 7.3 8 3.5l3.8 3.8" />
    </Svg>
  );
}

/** IconHome 是工具列家目錄按鈕圖示. */
export function IconHome(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.5 7.5 8 2.5l5.5 5" />
      <path d="M4 6.8v6.7h8V6.8" />
      <path d="M6.5 13.5v-4h3v4" />
    </Svg>
  );
}

/** IconNewFolder 是新增資料夾按鈕圖示. */
export function IconNewFolder(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M1.75 3.75c0-.55.45-1 1-1h3.1l1.2 1.5h6.2c.55 0 1 .45 1 1v7c0 .55-.45 1-1 1h-10.5c-.55 0-1-.45-1-1z" />
      <path d="M8 7v3.4M6.3 8.7h3.4" />
    </Svg>
  );
}

/** IconEye 是隱藏檔切換鈕圖示 (顯示中: 睜眼; 隱藏中: 加斜線). */
export function IconEye(props: IconProps & { crossed?: boolean }) {
  const { crossed, ...rest } = props;
  return (
    <Svg {...rest}>
      <path d="M1.5 8s2.3-4.2 6.5-4.2S14.5 8 14.5 8 12.2 12.2 8 12.2 1.5 8 1.5 8z" />
      <circle cx="8" cy="8" r="1.8" />
      {crossed ? <path d="M2.5 2.5l11 11" /> : null}
    </Svg>
  );
}

/** IconChevronDown 是根切換器下拉箭頭. */
export function IconChevronDown(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6.2 8 10l4-3.8" />
    </Svg>
  );
}

/** IconCheck 是根切換器展開清單中目前根的勾號. */
export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.2 8.4 6.4 11.5l6.4-7" />
    </Svg>
  );
}

/** IconWarning 是錯誤橫幅圖示. */
export function IconWarning(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 2 14.5 13.5h-13z" />
      <path d="M8 6.5v3M8 11.6v.1" />
    </Svg>
  );
}

/** IconClose 是錯誤橫幅的關閉鈕圖示. */
export function IconClose(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </Svg>
  );
}

const spinnerStyle: CSSProperties = { animation: "fsb-spin 0.8s linear infinite" };

/** IconSpinner 是載入中轉圈圖示. */
export function IconSpinner(props: IconProps) {
  return (
    <Svg {...props} style={{ ...spinnerStyle, ...props.style }}>
      <path d="M8 2v2.4" />
      <path d="M8 11.6V14" opacity={0.3} />
      <path d="M2 8h2.4" opacity={0.55} />
      <path d="M11.6 8H14" opacity={0.85} />
      <path d="M3.8 3.8l1.7 1.7" opacity={0.4} />
      <path d="M10.5 10.5l1.7 1.7" opacity={1} />
      <path d="M3.8 12.2l1.7-1.7" opacity={0.7} />
      <path d="M10.5 5.5l1.7-1.7" opacity={0.15} />
    </Svg>
  );
}

/** IconEmptyFolder 是空目錄置中的大號淡化資料夾圖示. */
export function IconEmptyFolder(props: IconProps) {
  return (
    <Svg viewBox="0 0 16 16" {...props} size={props.size ?? 40}>
      <path d="M1.75 3.75c0-.55.45-1 1-1h3.1l1.2 1.5h6.2c.55 0 1 .45 1 1v7c0 .55-.45 1-1 1h-10.5c-.55 0-1-.45-1-1z" />
    </Svg>
  );
}
