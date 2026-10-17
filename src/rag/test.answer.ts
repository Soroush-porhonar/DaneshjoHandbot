import "dotenv/config";
import { pool } from "../db/pool.js";
import { answerFromDocuments } from "./answer.js";

async function main() {
  try {
    const result = await pool.query<{ id: number }>(
      `SELECT id FROM users WHERE bale_chat_id = $1`,
      ["2059726704"],
    );

    const user = result.rows[0];

    if (!user) {
      throw new Error("Test user not found");
    }

    const question =
      "معماری پایگاه داده چیست و چه مدل‌هایی برای پایگاه داده وجود دارد؟";

    const answer = await answerFromDocuments(user.id, question);

    console.log("Question:", question);
    console.log("\nAnswer:\n", answer);
  } catch (error: unknown) {
    console.error("RAG answer test failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
