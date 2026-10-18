import "dotenv/config";
import { routeMessage } from "./router.js";

async function main() {
  const documents = ["DB-Chapter1.pdf"];

  for (const question of [
    "سلام، خوبی؟",
    "معماری پایگاه داده چیست؟",
    "این فصل را خلاصه کن",
    "بهترین بازی‌های نقش‌آفرینی کدام‌اند؟",
  ]) {
    console.log("\nQuestion:", question);
    console.log("Route:", await routeMessage(question, documents));
  }
}

main().catch(console.error);
