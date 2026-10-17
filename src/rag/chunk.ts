export interface TextChunk {
  chunkIndex: number;
  content: string;
}

export function chunkText(
  text: string,
  chunkSize = 1200,
  overlap = 200,
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

  // Split the extracted PDF text into individual pages.
  const pages = normalizedText.split(/(?=--\s*\d+\s+of\s+\d+\s*--)/g);

  const chunks: TextChunk[] = [];

  for (const page of pages) {
    const cleanedPage = page
      .replace(/^--\s*\d+\s+of\s+\d+\s*--\s*/g, "")
      .trim();

    if (!cleanedPage) continue;

    // Keep short pages together.
    if (cleanedPage.length <= chunkSize) {
      chunks.push({
        chunkIndex: chunks.length,
        content: cleanedPage,
      });
      continue;
    }

    // Split long pages into smaller overlapping chunks.
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
          content,
        });
      }

      if (end >= cleanedPage.length) break;

      start = end - overlap;
    }
  }

  return chunks;
}
