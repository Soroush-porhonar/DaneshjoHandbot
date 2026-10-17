import { extractPdfText } from "./pdf.js";
import { chunkText } from "./chunk.js";

async function main() {
  const text = await extractPdfText("/home/sushi/Downloads/DB-Chapter1.pdf");

  console.log("Extracted text preview:");
  console.log(text.slice(0, 1000));

  const chunks = chunkText(text);

  console.log("\nTotal chunks:", chunks.length);

  for (const chunk of chunks.slice(0, 6)) {
    console.log({
      chunkIndex: chunk.chunkIndex,
      pageNumber: chunk.pageNumber,
      preview: chunk.content.slice(0, 80),
    });
  }
}

main().catch(console.error);
