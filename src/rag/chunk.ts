import { config } from "../config.js";
import type { PageText } from "./pdf.js";
import { normalizeText } from "./textQuality.js";

export interface TextChunk {
  chunkIndex: number;
  pageNumber: number;
  content: string;
}

/** Sentence/paragraph terminators, strongest first. */
const BOUNDARIES = ["\n\n", "\n", "۔", "؟", "؛", "!", ". "];

function findBoundary(window: string): number {
  for (const boundary of BOUNDARIES) {
    const index = window.lastIndexOf(boundary);

    if (index >= 0) return index;
  }

  return -1;
}

/** Splits one page of text into chunks of at most chunkSize characters. */
function splitPage(page: string, chunkSize: number, overlap: number): string[] {
  if (page.length <= chunkSize) return [page];

  const parts: string[] = [];
  let start = 0;

  while (start < page.length) {
    let end = Math.min(start + chunkSize, page.length);

    if (end < page.length) {
      const searchStart = start + Math.floor(chunkSize * 0.7);
      const boundary = findBoundary(page.slice(searchStart, end));

      if (boundary >= 0) {
        end = searchStart + boundary + 1;
      }
    }

    const content = page.slice(start, end).trim();

    if (content) parts.push(content);

    if (end >= page.length) break;

    start = end - overlap;
  }

  return parts;
}

/** Normalizes each page and splits it into overlapping chunks tagged with their page. */
export function chunkPages(
  pages: PageText[],
  chunkSize = config.rag.chunkSize,
  overlap = config.rag.chunkOverlap,
): TextChunk[] {
  if (chunkSize <= 0 || overlap < 0 || overlap >= chunkSize) {
    throw new Error("Invalid chunkSize or overlap");
  }

  const chunks: TextChunk[] = [];

  for (const { pageNumber, text } of pages) {
    const page = normalizeText(text);

    if (!page) continue;

    for (const content of splitPage(page, chunkSize, overlap)) {
      chunks.push({ chunkIndex: chunks.length, pageNumber, content });
    }
  }

  return chunks;
}
