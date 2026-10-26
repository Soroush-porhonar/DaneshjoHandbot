import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    env: {
      PORT: "3000",
      BALE_TOKEN: "test-token",
      DATABASE_URL: "postgres://test:test@localhost:5432/test",
      LLM_URL: "http://localhost:11434/api/chat",
      LLM_MODEL: "test-model",
      EMBEDDING_MODEL: "test-embed",
    },
  },
});
