// Vite 設定: 輸出至 dist/, 供 examples/react/main.go 以 go:embed 內嵌 (相對路徑資產,
// 以便 Wails webview 以 "/" 為根路徑載入時皆能正確解析).
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      // "/wails/runtime.js" 由 Wails webview 於執行期提供 (非打包資產), 生成的 bindings
      // 直接以絕對路徑 import 該檔, 故建置時排除, 留待瀏覽器於執行期向 Wails 要求.
      external: ["/wails/runtime.js"],
    },
  },
});
