import { type ReactNode } from "react";
import type { FsbClient } from "@nexgus/fsb-core";
/** FsbClientProviderProps 是 FsbClientProvider 的參數. */
export interface FsbClientProviderProps {
    client: FsbClient;
    children?: ReactNode;
}
/** FsbClientProvider 把 client 注入子樹, 供子樹內的 <FsBrowser> 取用. */
export declare function FsbClientProvider(props: FsbClientProviderProps): import("react").JSX.Element;
/** useFsbClientContext 取得目前 context 中的 client (未提供時為 null). */
export declare function useFsbClientContext(): FsbClient | null;
//# sourceMappingURL=context.d.ts.map