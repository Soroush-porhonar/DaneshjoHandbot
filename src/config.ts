import "dotenv/config";

function required(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`${key} is not defined`);
  }

  return value;
}

export const config = {
  port: Number(required("PORT")),
  baleToken: required("BALE_TOKEN"),
  databaseUrl: required("DATABASE_URL"),

  llm: {
    url: required("LLM_URL"),
    model: required("LLM_MODEL"),
    timeoutMs: 120_000,
    routerTimeoutMs: 60_000,
    /** Ollama defaults to 4096 tokens, which silently truncates long prompts. */
    numCtx: 8192,
    temperature: { rag: 0.2, router: 0, chat: 0.7 },
  },

  embedding: {
    url: process.env.OLLAMA_EMBED_URL ?? "http://localhost:11434/api/embed",
    model: required("EMBEDDING_MODEL"),
    dimensions: 1024,
    timeoutMs: 120_000,
  },

  rag: {
    chunkSize: 1200,
    chunkOverlap: 200,
    maxCosineDistance: 0.55,
    /** Vector hits per question mode. */
    retrievalLimits: { focused: 3, multi_part: 5 },
    /** Hits plus their neighbouring chunks may fill at most this many chunks. */
    maxContextChunks: { focused: 5, multi_part: 8 },
    /** Broad mode: max characters of PDF text per extraction batch (~2.8 chars/token). */
    broadBatchChars: 9000,
    historyLimit: 10,
  },

  ocr: {
    enabled: process.env.OCR_ENABLED !== "false",
    /** Pages with fewer characters than this are treated as images. */
    minChars: 20,
    /** Maximum pages OCR'd per document (CPU inference is slow). */
    maxPages: 30,
    imageWidth: 1000,
    timeoutMs: 300_000,
    progressEvery: 5,
  },

  bale: {
    maxFileSize: 20 * 1024 * 1024,
    maxMessageLength: 4000,
    apiTimeoutMs: 30_000,
    downloadTimeoutMs: 60_000,
  },
} as const;
