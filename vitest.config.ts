import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["src/test/vitest.setup.ts"],
    include: [
      "src/**/__tests__/**/*.test.ts",
      "packages/**/__tests__/**/*.test.ts",
      "packages/**/*.test.ts",
      "electron/**/__tests__/**/*.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@clawui/config-core": resolve(__dirname, "packages/config-core/src/index.ts"),
      "@clawui/config-core/": resolve(__dirname, "packages/config-core/src/"),
      "@clawui/types/tool-call": resolve(__dirname, "packages/types/src/tool-call.ts"),
      "@": resolve(__dirname, "src"),
      "@components": resolve(__dirname, "src/components"),
      "@features": resolve(__dirname, "src/features"),
      "@store": resolve(__dirname, "src/store"),
      "@hooks": resolve(__dirname, "src/hooks"),
      "@lib": resolve(__dirname, "src/lib"),
    },
  },
});
