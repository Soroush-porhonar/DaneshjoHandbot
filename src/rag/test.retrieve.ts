import "dotenv/config";
import { pool } from "../db/pool.js";
import { getDocumentChunks } from "./retrieve.js";

async function main() {
  try {
    const userId = 1;
    const documentId = 3;

    const chunks = await getDocumentChunks(userId, documentId);

    console.log("Total chunks:", chunks.length);
    console.log("Filename:", chunks[0]?.filename);

    const pages = [
      ...new Set(
        chunks
          .map((chunk) => chunk.pageNumber)
          .filter((page): page is number => page !== null),
      ),
    ];

    console.log("Pages represented:", pages.length);
    console.log("First chunk:", chunks[0]);
    console.log("Last chunk:", chunks[chunks.length - 1]);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
