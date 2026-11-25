import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": process.cwd(),
    },
  },
  test: {
    environment: "node",
    include: ["tests/smoke/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    env: {
      LLM_ENABLED: "false",
      EMBEDDINGS_ENABLED: "true",
    },
  },
});
