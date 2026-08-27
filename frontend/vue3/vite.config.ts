import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// vite 建置設定: 以 library mode 輸出 @nexgus/fsb-vue, 型別宣告改由 vue-tsc 產生
// (見 package.json 的 build script), 本設定只負責 JS / CSS 輸出.
export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      name: "FsbVue",
      fileName: () => "fsb-vue.js",
      formats: ["es"],
    },
    rollupOptions: {
      external: ["vue", "@nexgus/fsb-core"],
      output: {
        globals: { vue: "Vue" },
      },
    },
    cssCodeSplit: false,
  },
});
