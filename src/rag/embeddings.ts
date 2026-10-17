const OLLAMA_EMBED_URL =
  process.env.OLLAMA_EMBED_URL ?? "http://localhost:11434/api/embed";

const EMBEDDING_MODEL = "bge-m3";

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

  const data = (await response.json()) as OllamaEmbedResponse;
  const embedding = data.embeddings?.[0];

  if (!embedding || embedding.length !== 1024) {
    throw new Error(
      `Expected a 1024-dimensional embedding, received ${embedding?.length ?? 0}`,
    );
  }

  return embedding;
}
