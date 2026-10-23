
import "dotenv/config";
import { routeMessage } from "./router.js";

async function main() {
  const documents = ["DB-Chapter1.pdf"];

  const questions = [
    {
      text: "سلام، خوبی؟",
      expectedRoute: "chat",
      expectedMode: "focused",
    },
    {
      text: "دادگان چیست؟",
      expectedRoute: "document",
      expectedMode: "focused",
    },
    {
      text: "معماری پایگاه داده چیست و چه مدل‌هایی دارد؟",
      expectedRoute: "document",
      expectedMode: "multi_part",
    },
    {
      text: "مهم‌ترین مفاهیم این فصل چیست؟",
      expectedRoute: "document",
      expectedMode: "broad",
    },
    {
      text: "این فصل را کامل خلاصه کن",
      expectedRoute: "document",
      expectedMode: "broad",
    },
    {
      text: "بهترین بازی‌های نقش‌آفرینی کدام‌اند؟",
      expectedRoute: "chat",
      expectedMode: "focused",
    },
  ] as const;

  let passed = 0;

  for (const test of questions) {
    console.log("\n================================");
    console.log("Question:", test.text);
    console.log("Expected:", {
      route: test.expectedRoute,
      retrievalMode: test.expectedMode,
    });

    try {
      const result = await routeMessage(test.text, documents);

      const success =
        result.route === test.expectedRoute &&
        result.retrievalMode === test.expectedMode;

      console.log("Actual:", result);
      console.log(success ? "PASS" : "FAIL");

      if (success) passed++;
    } catch (error) {
      console.error("ERROR:", error);
    }
  }

  console.log(`\nResults: ${passed}/${questions.length} passed`);
}

main().catch(console.error);
