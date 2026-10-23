import "dotenv/config";
import { pool } from "../db/pool.js";
import { answerFromDocuments } from "./answer.js";
import { routeMessage } from "../router.js";

async function main() {
  const userId = 1;

  const questions = [
    "تابع بازگشتی چیست؟",
    "تابع فاکتوریل چگونه به روش بازگشتی پیاده‌سازی می‌شود؟",
    "مسئله برج‌های هانوی چیست؟",
    "مهم‌ترین مفاهیم این فصل چیست؟",
    "پایگاه داده رابطه‌ای چیست؟",
  ];

  try {
    for (const question of questions) {
      console.log("\n================================");
      console.log("Question:", question);
      console.log("================================");
      const classification = await routeMessage(question, ["DB-Chapter1.pdf"]);

      console.log("Classification:", classification);

      if (classification.route === "document") {
        const answer = await answerFromDocuments(
          userId,
          question,
          classification.retrievalMode,
        );

        console.log("Answer:\n", answer);
      } else {
        console.log("Routed to chat; skipping document retrieval.");
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
