import { pool } from "../db/pool.js";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { generateEmbedding } from "./embeddings.js";

export interface RetrievedChunk {
  documentId: number;
  filename: string;
  pageNumber: number | null;
  chunkIndex: number;
  content: string;
  distance: number;
}

/** A chunk that will be placed in the model's context (a hit or its neighbour). */
export interface ContextChunk {
  documentId: number;
  filename: string;
  pageNumber: number | null;
  chunkIndex: number;
  content: string;
  /** True for a direct search hit, false for a neighbour added for context. */
  isHit: boolean;
}

export type ContextMode = "focused" | "multi_part";

export interface DocumentChunk {
  documentId: number;
  filename: string;
  pageNumber: number | null;
  chunkIndex: number;
  content: string;
}

/**
 * Retrieves every chunk belonging to a specific completed document.
 * Used for whole-document summaries, regardless of similarity to a query.
 */
export async function getDocumentChunks(
  userId: number,
  documentId: number,
): Promise<DocumentChunk[]> {
  const result = await pool.query<DocumentChunk>(
    `SELECT
       d.id AS "documentId",
       d.filename,
       dc.page_number AS "pageNumber",
       dc.chunk_index AS "chunkIndex",
       dc.content
     FROM documents d
     JOIN document_chunks dc ON dc.document_id = d.id
     WHERE d.user_id = $1
       AND d.id = $2
       AND d.status = 'completed'
     ORDER BY
       dc.page_number ASC NULLS LAST,
       dc.chunk_index ASC`,
    [userId, documentId],
  );

  if (result.rows.length === 0) {
    throw new Error(
      `No completed document chunks found for document ${documentId}.`,
    );
  }

  return result.rows;
}

/**
 * Retrieves chunks semantically relevant to a question.
 * Used for focused and multi-part questions.
 */
export async function retrieveRelevantChunks(
  userId: number,
  question: string,
  limit = 4,
  documentId?: number,
  /** Chunks farther than this are dropped; the eval passes a looser value. */
  maxDistance: number = config.rag.maxCosineDistance,
): Promise<RetrievedChunk[]> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20) {
    throw new Error("Retrieval limit must be an integer between 1 and 20.");
  }
  const embedding = await generateEmbedding(question);
  const vector = `[${embedding.join(",")}]`;

  const result = await pool.query<RetrievedChunk>(
    `WITH ranked_chunks AS (
       SELECT
         dc.document_id AS "documentId",
         d.filename,
         dc.page_number AS "pageNumber",
         dc.chunk_index AS "chunkIndex",
         dc.content,
         dc.embedding <=> $2::vector AS distance,
         ROW_NUMBER() OVER (
           PARTITION BY
            dc.document_id,
            dc.page_number,
            dc.content
           ORDER BY
             CASE WHEN dc.page_number IS NOT NULL THEN 0 ELSE 1 END,
             d.id DESC,
             dc.id DESC
         ) AS duplicate_rank
       FROM document_chunks dc
       JOIN documents d ON d.id = dc.document_id
       WHERE d.user_id = $1
         AND d.status = 'completed'
         AND ($4::integer IS NULL OR dc.document_id = $4)
     )
     SELECT
       "documentId",
       filename,
       "pageNumber",
       "chunkIndex",
       content,
       distance
     FROM ranked_chunks
     WHERE duplicate_rank = 1
       AND distance <= $5
     ORDER BY distance ASC
     LIMIT $3`,
    [userId, vector, limit, documentId ?? null, maxDistance],
  );
  logger.debug(
    "[RAG] Retrieved chunks:",
    result.rows.map((chunk) => ({
      documentId: chunk.documentId,
      pageNumber: chunk.pageNumber,
      distance: Number(chunk.distance),
      contentPreview: chunk.content.slice(0, 120),
    })),
  );
  return result.rows;
}

async function getChunksByIndex(
  documentId: number,
  chunkIndexes: number[],
): Promise<ContextChunk[]> {
  if (chunkIndexes.length === 0) return [];

  const result = await pool.query<ContextChunk>(
    `SELECT
       dc.document_id AS "documentId",
       d.filename,
       dc.page_number AS "pageNumber",
       dc.chunk_index AS "chunkIndex",
       dc.content,
       false AS "isHit"
     FROM document_chunks dc
     JOIN documents d ON d.id = dc.document_id
     WHERE dc.document_id = $1
       AND dc.chunk_index = ANY($2::int[])`,
    [documentId, chunkIndexes],
  );

  return result.rows;
}

/**
 * Combines ranked hits with their neighbouring chunks: hits always come first,
 * then neighbours (closest to the best hit first) until `cap` chunks are used.
 * The result is de-duplicated and in reading order.
 */
export function mergeContext(
  hits: ContextChunk[],
  neighbours: ContextChunk[],
  cap: number,
): ContextChunk[] {
  const chosen = new Map<number, ContextChunk>();

  for (const chunk of hits) {
    if (chosen.size >= cap) break;
    chosen.set(chunk.chunkIndex, chunk);
  }

  const hitRank = new Map(hits.map((hit, rank) => [hit.chunkIndex, rank]));
  const nearestHit = (chunk: ContextChunk): number => {
    const ranks = [chunk.chunkIndex - 1, chunk.chunkIndex + 1]
      .map((index) => hitRank.get(index))
      .filter((rank): rank is number => rank !== undefined);

    return ranks.length > 0 ? Math.min(...ranks) : Number.MAX_SAFE_INTEGER;
  };

  const ranked = [...neighbours].sort((a, b) => nearestHit(a) - nearestHit(b));

  for (const chunk of ranked) {
    if (chosen.size >= cap) break;
    if (!chosen.has(chunk.chunkIndex)) chosen.set(chunk.chunkIndex, chunk);
  }

  return [...chosen.values()].sort((a, b) => a.chunkIndex - b.chunkIndex);
}

/**
 * The context sent to the model for focused / multi-part questions:
 * the most similar chunks plus the chunks right before and after them.
 */
export async function retrieveContext(
  userId: number,
  question: string,
  mode: ContextMode,
  documentId: number,
): Promise<ContextChunk[]> {
  const hits = (
    await retrieveRelevantChunks(
      userId,
      question,
      config.rag.retrievalLimits[mode],
      documentId,
    )
  ).map((hit) => ({ ...hit, isHit: true }));

  if (hits.length === 0) return [];

  const hitIndexes = new Set(hits.map((hit) => hit.chunkIndex));
  const wanted = new Set<number>();

  for (const hit of hits) {
    for (const index of [hit.chunkIndex - 1, hit.chunkIndex + 1]) {
      if (index >= 0 && !hitIndexes.has(index)) wanted.add(index);
    }
  }

  const neighbours = await getChunksByIndex(documentId, [...wanted]);

  return mergeContext(hits, neighbours, config.rag.maxContextChunks[mode]);
}
