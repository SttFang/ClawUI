import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { resolve } from "path";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "electron/main/index.ts"),
        },
      },
    },
    resolve: {
      alias: {
        "@main": resolve("electron/main"),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "electron/preload/index.ts"),
        },
        // Electron sandbox preload runs as a classic script (not ESM module).
        // Ensure the bundled output contains no top-level `import` statements.
        output: {
          format: "cjs",
          entryFileNames: "[name].cjs",
        },
      },
    },
  },
  renderer: {
    root: ".",
    build: {
      rollupOptions: {
        input: resolve(__dirname, "index.html"),
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": resolve("src"),
        "@components": resolve("src/components"),
        "@features": resolve("src/features"),
        "@store": resolve("src/store"),
        "@hooks": resolve("src/hooks"),
        "@lib": resolve("src/lib"),
      },
    },
  },
});
