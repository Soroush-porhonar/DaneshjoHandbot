import "dotenv/config";
import { pool } from "../db/pool.js";
import { retrieveRelevantChunks } from "./retrieve.js";

async function main() {
  const chatId = "2059726704";
  const documentId = 2;

  const question =
    "معماری پایگاه داده چیست و چه مدل‌هایی برای پایگاه داده وجود دارد؟";

  try {
    const userResult = await pool.query<{ id: number }>(
      `SELECT id FROM users WHERE bale_chat_id = $1`,
      [chatId],
    );

    const user = userResult.rows[0];

    if (!user) {
      throw new Error("Test user not found in database");
    }

    const chunks = await retrieveRelevantChunks(
      user.id,
      question,
      10,
      documentId,
    );

    console.log("Question:", question);
    console.log("User ID:", user.id);
    console.log("Document ID:", documentId);
    console.log("Retrieved chunks:", chunks.length);

    for (const [index, chunk] of chunks.entries()) {
      console.log(`\n--- Result ${index + 1} ---`);
      console.log("Document ID:", chunk.documentId);
      console.log("Filename:", chunk.filename);
      console.log("Cosine distance:", chunk.distance.toFixed(4));
      console.log("Content:\n", chunk.content);
    }
  } catch (error: unknown) {
    console.error("Retrieval test failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
