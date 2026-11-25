import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(root),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/api/**/*.test.ts"],
    globalSetup: ["./tests/setup/global.ts"],
    env: {
      CASAMOVE_DATABASE_URL:
        "postgresql://casamove@127.0.0.1:5544/casamove_test",
      LLM_ENABLED: "false",
      EMBEDDINGS_ENABLED: "false",
      RENEWAL_AUTO: "false",
      COOKIE_SECURE: "false",
    },
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});
