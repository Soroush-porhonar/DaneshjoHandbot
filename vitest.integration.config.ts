import { defineConfig } from "vitest/config";
import { TEST_DATABASE_URL } from "./tests/integration/globalSetup.js";

/** Tests against a real PostgreSQL + pgvector (docker compose up first). */
export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/globalSetup.ts"],
    // All files share one database, so run them one after another.
    fileParallelism: false,
    env: {
      PORT: "3000",
      BALE_TOKEN: "test-token",
      DATABASE_URL: TEST_DATABASE_URL,
      LLM_URL: "http://localhost:11434/api/chat",
      LLM_MODEL: "test-model",
      EMBEDDING_MODEL: "test-embed",
      LOG_LEVEL: "error",
    },
  },
});
