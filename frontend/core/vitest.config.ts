import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 測試環境把 "@nexgus/fsb-core" 對映到套件原始碼: 外部語言包 (frontend/locales/) 以
// 套件名 import 型別, 與第三方語言包的寫法完全一致, 測試因此需要此對映.
export default defineConfig({
  resolve: {
    alias: {
      "@nexgus/fsb-core": fileURLToPath(new URL("./src/index.ts", import.meta.url)),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    // 日期格式化以宿主系統時區呈現, 測試固定時區才有可預期的期望值.
    env: { TZ: "Asia/Taipei" },
  },
});
