import { pool } from "../db/pool.js";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { generateEmbedding } from "./embeddings.js";
import { rerankChunks } from "./rerank.js";

export interface RetrievedChunk {
  documentId: number;
  filename: string;
  pageNumber: number | null;
  /** Last page of a chunk that crosses pages; null for older chunks. */
  pageEnd?: number | null;
  chunkIndex: number;
  /** Slide decks: chunks with the same title share a section; null otherwise. */
  sectionIndex?: number | null;
  content: string;
  distance: number;
}

/** A chunk that will be placed in the model's context (a hit or its neighbour). */
export interface ContextChunk {
  documentId: number;
  filename: string;
  pageNumber: number | null;
  pageEnd?: number | null;
  chunkIndex: number;
  sectionIndex?: number | null;
  content: string;
  /** True for a direct search hit, false for a neighbour added for context. */
  isHit: boolean;
}

export type ContextMode = "focused" | "multi_part";

export interface DocumentChunk {
  documentId: number;
  filename: string;
  pageNumber: number | null;
  pageEnd?: number | null;
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
       dc.page_end AS "pageEnd",
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
         dc.page_end AS "pageEnd",
         dc.chunk_index AS "chunkIndex",
         dc.section_index AS "sectionIndex",
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
       "pageEnd",
       "chunkIndex",
       "sectionIndex",
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

/** Chunks by position, plus every chunk of the given sections. */
async function getNeighbours(
  documentId: number,
  chunkIndexes: number[],
  sectionIndexes: number[],
): Promise<ContextChunk[]> {
  if (chunkIndexes.length === 0 && sectionIndexes.length === 0) return [];

  const result = await pool.query<ContextChunk>(
    `SELECT
       dc.document_id AS "documentId",
       d.filename,
       dc.page_number AS "pageNumber",
       dc.page_end AS "pageEnd",
       dc.chunk_index AS "chunkIndex",
       dc.section_index AS "sectionIndex",
       dc.content,
       false AS "isHit"
     FROM document_chunks dc
     JOIN documents d ON d.id = dc.document_id
     WHERE dc.document_id = $1
       AND (dc.chunk_index = ANY($2::int[]) OR dc.section_index = ANY($3::int[]))`,
    [documentId, chunkIndexes, sectionIndexes],
  );

  return result.rows;
}

/** A neighbour belongs to a hit when it is next to it or in the same section. */
function belongsTo(chunk: ContextChunk, hit: ContextChunk): boolean {
  return (
    Math.abs(chunk.chunkIndex - hit.chunkIndex) === 1 ||
    (hit.sectionIndex != null && chunk.sectionIndex === hit.sectionIndex)
  );
}

/**
 * Combines ranked hits with their neighbours: hits always come first, then
 * neighbours of the best-ranked hit (closest first), then of the next hit,
 * until `cap` chunks are used. The result is de-duplicated and in reading order.
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

  // Lower is better: rank of the hit it belongs to, then distance from that hit.
  const priority = (chunk: ContextChunk): number => {
    const scores = hits
      .map((hit, rank) =>
        belongsTo(chunk, hit) ? rank * 10_000 + Math.abs(chunk.chunkIndex - hit.chunkIndex) : null,
      )
      .filter((score): score is number => score !== null);

    return scores.length > 0 ? Math.min(...scores) : Number.MAX_SAFE_INTEGER;
  };

  const ranked = [...neighbours].sort((a, b) => priority(a) - priority(b));

  for (const chunk of ranked) {
    if (chosen.size >= cap) break;
    if (!chosen.has(chunk.chunkIndex)) chosen.set(chunk.chunkIndex, chunk);
  }

  return [...chosen.values()].sort((a, b) => a.chunkIndex - b.chunkIndex);
}

/**
 * The context sent to the model for focused / multi-part questions:
 * the most similar chunks plus the chunks right before and after them, and
 * for slide decks the other slides of the same section.
 */
export async function retrieveContext(
  userId: number,
  question: string,
  mode: ContextMode,
  documentId: number,
): Promise<ContextChunk[]> {
  const limit = config.rag.retrievalLimits[mode];
  // With a reranker: fetch more candidates, let it pick the best `limit`.
  const candidates = await retrieveRelevantChunks(
    userId,
    question,
    config.reranker.enabled ? Math.max(limit, config.reranker.candidates) : limit,
    documentId,
  );
  const hits = (await rerankChunks(question, candidates))
    .slice(0, limit)
    .map((hit) => ({ ...hit, isHit: true }));

  if (hits.length === 0) return [];

  const hitIndexes = new Set(hits.map((hit) => hit.chunkIndex));
  const wanted = new Set<number>();

  for (const hit of hits) {
    for (const index of [hit.chunkIndex - 1, hit.chunkIndex + 1]) {
      if (index >= 0 && !hitIndexes.has(index)) wanted.add(index);
    }
  }

  const sections = config.rag.sectionExpansion
    ? [...new Set(hits.map((hit) => hit.sectionIndex).filter((s): s is number => s != null))]
    : [];

  const neighbours = (await getNeighbours(documentId, [...wanted], sections)).filter(
    (chunk) => !hitIndexes.has(chunk.chunkIndex),
  );

  return mergeContext(hits, neighbours, config.rag.maxContextChunks[mode]);
}
