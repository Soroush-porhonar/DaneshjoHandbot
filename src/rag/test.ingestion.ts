import "dotenv/config";
import { pool } from "../db/pool.js";

async function main() {
  try {
    // Show recent ingestion records and their chunk counts.
    const documents = await pool.query(`
      SELECT
        d.id AS document_id,
        d.user_id,
        d.filename,
        d.status,
        d.created_at,
        COUNT(dc.id)::int AS chunk_count,
        COUNT(DISTINCT dc.page_number)::int AS pages_with_chunks,
        MIN(dc.page_number) AS first_page,
        MAX(dc.page_number) AS last_page
      FROM documents d
      LEFT JOIN document_chunks dc ON dc.document_id = d.id
      GROUP BY d.id
      ORDER BY d.id DESC
      LIMIT 10
    `);

    console.log("\n=== RECENT DOCUMENTS ===");
    console.table(documents.rows);

    // Inspect the latest completed document.
    const latest = await pool.query<{ id: number; filename: string }>(`
      SELECT id, filename
      FROM documents
      WHERE status = 'completed'
      ORDER BY id DESC
      LIMIT 1
    `);

    const document = latest.rows[0];

    if (!document) {
      console.log("\nNo completed documents found.");
      return;
    }

    console.log("\n=== INSPECTING DOCUMENT ===");
    console.log(document);

    // Inspect chunk order, page numbers, content, and embedding dimensions.
    const chunks = await pool.query(
      `
      SELECT
        dc.chunk_index,
        dc.page_number,
        LENGTH(dc.content) AS content_length,
        vector_dims(dc.embedding) AS embedding_dimensions,
        LEFT(dc.content, 180) AS content_preview
      FROM document_chunks dc
      WHERE dc.document_id = $1
      ORDER BY dc.page_number ASC NULLS LAST, dc.chunk_index ASC
    `,
      [document.id],
    );

    console.log("\n=== CHUNKS ===");
    console.table(chunks.rows);

    // Detect repeated chunk content within this document.
    const duplicates = await pool.query(
      `
      SELECT
        content,
        COUNT(*)::int AS occurrences
      FROM document_chunks
      WHERE document_id = $1
      GROUP BY content
      HAVING COUNT(*) > 1
      ORDER BY occurrences DESC
      LIMIT 10
    `,
      [document.id],
    );

    console.log("\n=== DUPLICATE CHUNKS ===");
    console.log("Repeated content groups:", duplicates.rows.length);
    console.table(
      duplicates.rows.map((row) => ({
        occurrences: row.occurrences,
        preview: row.content.slice(0, 120),
      })),
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Ingestion verification failed:", error);
  process.exitCode = 1;
});
