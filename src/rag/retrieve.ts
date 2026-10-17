import { pool } from "../db/pool.js";
import { generateEmbedding } from "./embeddings.js";

export interface RetrievedChunk {
  documentId: number;
  filename: string;
  pageNumber: number;
  content: string;
  distance: number;
}

export async function retrieveRelevantChunks(
  userId: number,
  question: string,
  limit = 4,
  documentId?: number,
): Promise<RetrievedChunk[]> {
  const embedding = await generateEmbedding(question);
  const vector = `[${embedding.join(",")}]`;

  const result = await pool.query<RetrievedChunk>(
    `SELECT
       dc.document_id AS "documentId",
       d.filename,
       dc.page_number AS "pageNumber",
       dc.content,
       dc.embedding <=> $2::vector AS distance
     FROM document_chunks dc
     JOIN documents d ON d.id = dc.document_id
     WHERE d.user_id = $1
       AND d.status = 'completed'
       AND ($4::integer IS NULL OR dc.document_id = $4)
     ORDER BY dc.embedding <=> $2::vector
     LIMIT $3`,
    [userId, vector, limit, documentId ?? null],
  );

  return result.rows;
}
