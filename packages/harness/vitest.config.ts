import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@orivoxx/benchmarks": fileURLToPath(
        new URL("../benchmarks/src/index.ts", import.meta.url),
      ),
      "@orivoxx/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
      "@orivoxx/results": fileURLToPath(
        new URL("../results/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
