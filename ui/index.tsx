import * as React from "react";
import { createRoot } from "react-dom/client";
import "./App.css";
import App from "./App";
import PluginCommunicator from "@ui/PluginCommunicator";

PluginCommunicator.init();

const container = document.getElementById("root");
if (!container) {
    throw new Error("找不到插件 UI 根节点");
}

// React 18 使用并发根入口，保留 StrictMode 检查副作用安全性。
createRoot(container).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);
