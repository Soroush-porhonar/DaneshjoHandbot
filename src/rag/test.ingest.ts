import "dotenv/config";
import { pool } from "../db/pool.js";
import { ingestPdf } from "./ingest.js";

async function main() {
  try {
    const result = await pool.query<{ id: number }>(
      `SELECT id FROM users WHERE bale_chat_id = $1`,
      ["2059726704"],
    );

    const user = result.rows[0];

    if (!user) {
      throw new Error("Test user not found in database");
    }

    const documentId = await ingestPdf(
      user.id,
      "DB-Chapter1.pdf",
      "/home/sushi/Downloads/DB-Chapter1.pdf",
    );

    console.log("PDF ingested successfully.");
    console.log("Document ID:", documentId);
  } catch (error: unknown) {
    console.error("PDF ingestion failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
