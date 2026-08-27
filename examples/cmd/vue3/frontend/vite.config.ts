import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// examples/vue3 前端建置設定. 產物輸出至 dist, 由 main.go 以 go:embed 內嵌.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      // /wails/runtime.js 由 Wails webview 於執行期提供 (bindings 產生的程式碼所匯入),
      // 建置時無法解析, 標記為 external 使其於執行期以原始路徑載入.
      external: ["/wails/runtime.js"],
      // Wails 產生的 bindings 檔自帶未使用的 import (CancellablePromise), 非本專案可修
      // 之處; 僅吞掉針對該執行期模組的未使用 import 警告, 其他警告照常顯示.
      onwarn(warning, warn) {
        if (warning.code === "UNUSED_EXTERNAL_IMPORT" && warning.exporter === "/wails/runtime.js") {
          return;
        }
        warn(warning);
      },
    },
  },
});
