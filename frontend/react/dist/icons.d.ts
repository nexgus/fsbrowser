import type { SVGProps } from "react";
interface IconProps extends SVGProps<SVGSVGElement> {
    size?: number;
}
/** IconFolder 是資料夾基本圖示. */
export declare function IconFolder(props: IconProps): import("react").JSX.Element;
/** IconFile 是一般檔案基本圖示. */
export declare function IconFile(props: IconProps): import("react").JSX.Element;
/** IconSocket 是 socket 特殊檔案圖示 (插座形). */
export declare function IconSocket(props: IconProps): import("react").JSX.Element;
/** IconFifo 是 named pipe 特殊檔案圖示 (管線形). */
export declare function IconFifo(props: IconProps): import("react").JSX.Element;
/** IconDevice 是裝置檔圖示 (晶片形). */
export declare function IconDevice(props: IconProps): import("react").JSX.Element;
/** IconLinkBadge 是連結徽章: 疊於基本圖示右下角的 9px 小方框, 內含斜向箭頭. */
export declare function IconLinkBadge(props: IconProps): import("react").JSX.Element;
/** IconBrokenLink 是失效連結圖示 (斷鏈). */
export declare function IconBrokenLink(props: IconProps): import("react").JSX.Element;
/** IconUp 是工具列上層目錄按鈕圖示. */
export declare function IconUp(props: IconProps): import("react").JSX.Element;
/** IconHome 是工具列家目錄按鈕圖示. */
export declare function IconHome(props: IconProps): import("react").JSX.Element;
/** IconNewFolder 是新增資料夾按鈕圖示. */
export declare function IconNewFolder(props: IconProps): import("react").JSX.Element;
/** IconEye 是隱藏檔切換鈕圖示 (顯示中: 睜眼; 隱藏中: 加斜線). */
export declare function IconEye(props: IconProps & {
    crossed?: boolean;
}): import("react").JSX.Element;
/** IconChevronDown 是根切換器下拉箭頭. */
export declare function IconChevronDown(props: IconProps): import("react").JSX.Element;
/** IconCheck 是根切換器展開清單中目前根的勾號. */
export declare function IconCheck(props: IconProps): import("react").JSX.Element;
/** IconWarning 是錯誤橫幅圖示. */
export declare function IconWarning(props: IconProps): import("react").JSX.Element;
/** IconClose 是錯誤橫幅的關閉鈕圖示. */
export declare function IconClose(props: IconProps): import("react").JSX.Element;
/** IconSpinner 是載入中轉圈圖示. */
export declare function IconSpinner(props: IconProps): import("react").JSX.Element;
/** IconEmptyFolder 是空目錄置中的大號淡化資料夾圖示. */
export declare function IconEmptyFolder(props: IconProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=icons.d.ts.map