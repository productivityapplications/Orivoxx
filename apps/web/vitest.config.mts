import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@orivoxx/benchmarks": fileURLToPath(
        new URL("../../packages/benchmarks/src/index.ts", import.meta.url),
      ),
      "@orivoxx/core": fileURLToPath(
        new URL("../../packages/core/src/index.ts", import.meta.url),
      ),
      "@orivoxx/harness": fileURLToPath(
        new URL("../../packages/harness/src/index.ts", import.meta.url),
      ),
      "@orivoxx/results": fileURLToPath(
        new URL("../../packages/results/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
