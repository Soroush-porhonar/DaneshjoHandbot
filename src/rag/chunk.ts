import { config } from "../config.js";

export interface TextChunk {
  chunkIndex: number;
  pageNumber: number;
  content: string;
}

export function chunkText(
  text: string,
  chunkSize = config.rag.chunkSize,
  overlap = config.rag.chunkOverlap,
): TextChunk[] {
  if (chunkSize <= 0 || overlap < 0 || overlap >= chunkSize) {
    throw new Error("Invalid chunkSize or overlap");
  }

  const normalizedText = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalizedText) return [];

  const pages = normalizedText
    .split(/(?=--\s*\d+\s+of\s+\d+\s*--)/g)
    .filter((page) => /^--\s*\d+\s+of\s+\d+\s*--/.test(page.trim()));

  const chunks: TextChunk[] = [];

  for (const page of pages) {
    const marker = page.match(/^--\s*(\d+)\s+of\s+\d+\s*--/);
    const pageNumber = marker ? Number(marker[1]) : 1;

    const cleanedPage = page
      .replace(/^--\s*\d+\s+of\s+\d+\s*--\s*/g, "")
      .trim();

    if (!cleanedPage) continue;

    if (cleanedPage.length <= chunkSize) {
      chunks.push({
        chunkIndex: chunks.length,
        pageNumber,
        content: cleanedPage,
      });
      continue;
    }

    let start = 0;

    while (start < cleanedPage.length) {
      let end = Math.min(start + chunkSize, cleanedPage.length);

      if (end < cleanedPage.length) {
        const searchStart = start + Math.floor(chunkSize * 0.7);
        const window = cleanedPage.slice(searchStart, end);

        const boundary = Math.max(
          window.lastIndexOf("\n\n"),
          window.lastIndexOf("۔"),
          window.lastIndexOf(". "),
        );

        if (boundary >= 0) {
          end = searchStart + boundary + 1;
        }
      }

      const content = cleanedPage.slice(start, end).trim();

      if (content) {
        chunks.push({
          chunkIndex: chunks.length,
          pageNumber,
          content,
        });
      }

      if (end >= cleanedPage.length) break;

      start = end - overlap;
    }
  }

  return chunks;
}
