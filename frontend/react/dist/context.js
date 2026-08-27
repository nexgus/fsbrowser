import { jsx as _jsx } from "react/jsx-runtime";
// client 的 Context provider (計劃書第 5.3 節): 宿主可以此方式把 client 注入子樹,
// 免於在每個 <FsBrowser> 上重複傳遞; 亦可改用 <FsBrowser client={...}> 以 prop 直接傳入,
// prop 優先於 context.
import { createContext, useContext } from "react";
const FsbClientContext = createContext(null);
/** FsbClientProvider 把 client 注入子樹, 供子樹內的 <FsBrowser> 取用. */
export function FsbClientProvider(props) {
    return _jsx(FsbClientContext.Provider, { value: props.client, children: props.children });
}
/** useFsbClientContext 取得目前 context 中的 client (未提供時為 null). */
export function useFsbClientContext() {
    return useContext(FsbClientContext);
}
//# sourceMappingURL=context.js.map