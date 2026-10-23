import { pool } from "../db/pool.js";
import { generateEmbedding } from "./embeddings.js";

const MAX_COSINE_DISTANCE = 0.55;

export interface RetrievedChunk {
  documentId: number;
  filename: string;
  pageNumber: number | null;
  content: string;
  distance: number;
}

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
): Promise<RetrievedChunk[]> {
  const embedding = await generateEmbedding(question);
  const vector = `[${embedding.join(",")}]`;

  const result = await pool.query<RetrievedChunk>(
    `WITH ranked_chunks AS (
       SELECT
         dc.document_id AS "documentId",
         d.filename,
         dc.page_number AS "pageNumber",
         dc.content,
         dc.embedding <=> $2::vector AS distance,
         ROW_NUMBER() OVER (
           PARTITION BY
             d.user_id,
             d.filename,
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
       content,
       distance
     FROM ranked_chunks
     WHERE duplicate_rank = 1
       AND distance <= $5
     ORDER BY distance ASC
     LIMIT $3`,
    [userId, vector, limit, documentId ?? null, MAX_COSINE_DISTANCE],
  );

  return result.rows;
}
