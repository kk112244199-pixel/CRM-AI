import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/**/*.test.ts",
      "apps/api/**/*.test.ts",
      "apps/web/src/**/*.test.ts",
      "deploy/**/*.test.ts",
    ],
    environment: "node",
  },
  resolve: {
    alias: {
      "@hengce/domain": fileURLToPath(
        new URL("./packages/domain/src/index.ts", import.meta.url),
      ),
      "@hengce/harness": fileURLToPath(
        new URL("./packages/harness/src/index.ts", import.meta.url),
      ),
    },
  },
});
