import { pool } from "../db/pool.js";
import { extractPdfPages } from "./pdf.js";
import { chunkPages } from "./chunk.js";
import { generateEmbeddings } from "./embeddings.js";
import { PdfExtractError } from "../errors.js";
import { logger } from "../logger.js";

const EMBED_BATCH_SIZE = 16;

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
    const pages = await extractPdfPages(filePath);
    const chunks = chunkPages(pages);

    if (chunks.length === 0) {
      throw new PdfExtractError("The PDF contains no usable text");
    }

    // Generate embeddings before opening the transaction.
    const embeddedChunks: {
      chunkIndex: number;
      pageNumber: number;
      content: string;
      embedding: number[];
    }[] = [];

    for (let start = 0; start < chunks.length; start += EMBED_BATCH_SIZE) {
      const batch = chunks.slice(start, start + EMBED_BATCH_SIZE);
      const embeddings = await generateEmbeddings(
        batch.map((chunk) => chunk.content),
      );

      batch.forEach((chunk, index) => {
        embeddedChunks.push({
          chunkIndex: chunk.chunkIndex,
          pageNumber: chunk.pageNumber,
          content: chunk.content,
          embedding: embeddings[index]!,
        });
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

      // Automatically select the newly uploaded document.
      await client.query(
        `
    UPDATE conversations
    SET selected_document_id = $2,
        updated_at = NOW()
    WHERE user_id = $1
  `,
        [userId, documentId],
      );

      await client.query("COMMIT");
    } catch (error: unknown) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError: unknown) {
        logger.error("Failed to roll back document ingestion:", {
          documentId,
          error: rollbackError,
        });
      }

      throw error;
    } finally {
      client.release();
    }

    logger.info(`Document ${documentId} ingested: ${chunks.length} chunks`);

    return documentId;
  } catch (error: unknown) {
    try {
      await pool.query(`UPDATE documents SET status = 'failed' WHERE id = $1`, [
        documentId,
      ]);
    } catch (statusError: unknown) {
      logger.error("Failed to update document status:", statusError);
    }

    throw error;
  }
}
