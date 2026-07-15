import { resolve } from "path";
import { defineConfig, BuildOptions } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import react from "@vitejs/plugin-react";

const target = process.env.TARGET;

export default defineConfig(() => {
    const buildConfig =
        target === "ui"
            ? {
                  target: "esnext",
                  assetsInlineLimit: 100000000,
                  chunkSizeWarningLimit: 100000000,
                  cssCodeSplit: false,
              }
            : {
                  lib: {
                      entry: resolve(__dirname, "./lib/main.ts"),
                      name: "myLib",
                      formats: ["umd"],
                      fileName: () => `main.js`,
                  },
              };

    return {
        // 主线程不需要 React 与单文件插件，避免扫描 UI 依赖并产生无关警告。
        plugins: target === "ui" ? [react(), viteSingleFile()] : [],
        build: {
            ...(buildConfig as BuildOptions),
            emptyOutDir: false,
        },
        resolve: {
            alias: {
                "@lib": resolve(__dirname, "./lib"),
                "@ui": resolve(__dirname, "./ui"),
                "@messages": resolve(__dirname, "./messages"),
            },
        },
    };
});
