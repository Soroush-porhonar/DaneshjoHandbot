import "dotenv/config";
import { pool } from "../db/pool.js";
import { answerFromDocuments } from "./answer.js";

async function main() {
  const userId = 1;

  const questions = [
    "معماری پایگاه داده چیست و چه مدل‌هایی برای پایگاه داده وجود دارد؟",
    "بهترین بازی‌های نقش‌آفرینی کدام‌اند؟",
  ];

  try {
    for (const question of questions) {
      console.log("\n================================");
      console.log("Question:", question);
      console.log("================================\n");

      const answer = await answerFromDocuments(userId, question);

      console.log("Answer:\n", answer);
    }
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
