import { pool } from "../db/pool.js";
import { extractPdfText } from "./pdf.js";
import { chunkText } from "./chunk.js";
import { generateEmbedding } from "./embeddings.js";

export async function ingestPdf(
  userId: number,
  filename: string,
  filePath: string,
): Promise<number> {
  const documentResult = await pool.query<{ id: number }>(
    `
      INSERT INTO documents (user_id, filename, status)
      VALUES ($1, $2, 'processing')
      RETURNING id
    `,
    [userId, filename],
  );

  const document = documentResult.rows[0];

  if (!document) {
    throw new Error("Failed to create document record");
  }

  const documentId = document.id;

  try {
    const text = await extractPdfText(filePath);
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      throw new Error("The PDF contains no usable text");
    }

    // Generate embeddings before opening the transaction.
    const embeddedChunks = [];

    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk.content);

      embeddedChunks.push({
        chunkIndex: chunk.chunkIndex,
        pageNumber: chunk.pageNumber,
        content: chunk.content,
        embedding,
      });
    }

    // Save all chunks and mark the document completed atomically.
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      for (const chunk of embeddedChunks) {
        const vector = `[${chunk.embedding.join(",")}]`;

        await client.query(
          `INSERT INTO document_chunks
     (document_id, chunk_index, page_number, content, embedding)
   VALUES ($1, $2, $3, $4, $5::vector)`,
          [
            documentId,
            chunk.chunkIndex,
            chunk.pageNumber,
            chunk.content,
            vector,
          ],
        );
      }

      await client.query(
        `
          UPDATE documents
          SET status = 'completed'
          WHERE id = $1
        `,
        [documentId],
      );

      await client.query("COMMIT");
    } catch (error: unknown) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    console.log(`Document ${documentId} ingested: ${chunks.length} chunks`);

    return documentId;
  } catch (error: unknown) {
    try {
      await pool.query(`UPDATE documents SET status = 'failed' WHERE id = $1`, [
        documentId,
      ]);
    } catch (statusError: unknown) {
      console.error("Failed to update document status:", statusError);
    }

    throw error;
  }
}
