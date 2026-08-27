// 進入點: 掛載 App (計劃書第 5.1 節接線方式的完整示範).
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";

const container = document.getElementById("root");
if (container === null) throw new Error("找不到 #root 掛載點.");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
