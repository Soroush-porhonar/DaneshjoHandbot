import { EMBEDDING_MODEL } from "../utils/env.js";

const OLLAMA_EMBED_URL =
  process.env.OLLAMA_EMBED_URL ?? "http://localhost:11434/api/embed";

interface OllamaEmbedResponse {
  embeddings: number[][];
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(OLLAMA_EMBED_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Ollama embedding error: ${response.status} ${response.statusText}`,
    );
  }

  let data: OllamaEmbedResponse;

  try {
    data = (await response.json()) as OllamaEmbedResponse;
  } catch {
    throw new Error("Ollama returned an invalid embedding response.");
  }

  const embedding = data.embeddings?.[0];

  if (
    !embedding ||
    embedding.length !== 1024 ||
    !embedding.every(Number.isFinite)
  ) {
    throw new Error(
      `Invalid embedding: expected 1024 finite values, received ${
        embedding?.length ?? 0
      }`,
    );
  }

  return embedding;
}
