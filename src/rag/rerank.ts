/**
 * Reranking: vector search finds chunks on the right *topic*; a cross-encoder
 * reads the question and each chunk together and scores how well the chunk
 * *answers* the question. Used to re-order the top search candidates.
 */
import { config } from "../config.js";
import { logger } from "../logger.js";

interface RerankResponse {
  results?: { index: number; relevance_score: number }[];
}

/**
 * Returns the chunks ordered by relevance to the question (best first).
 * On any failure the original order is kept, so search still works when the
 * reranker service is down.
 */
export async function rerankChunks<T extends { content: string }>(
  question: string,
  chunks: T[],
): Promise<T[]> {
  if (!config.reranker.enabled || chunks.length < 2) return chunks;

  try {
    const response = await fetch(config.reranker.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(config.reranker.timeoutMs),
      body: JSON.stringify({ query: question, documents: chunks.map((chunk) => chunk.content) }),
    });

    if (!response.ok) {
      throw new Error(`Reranker error: ${response.status} ${response.statusText}`);
    }

    const results = ((await response.json()) as RerankResponse).results;

    if (
      !results ||
      results.length !== chunks.length ||
      results.some((r) => !Number.isInteger(r.index) || r.index < 0 || r.index >= chunks.length)
    ) {
      throw new Error("Reranker returned an invalid response");
    }

    return [...results]
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .map((result) => chunks[result.index]!);
  } catch (error: unknown) {
    logger.warn("[RAG] Reranking failed, keeping search order:", error);
    return chunks;
  }
}
