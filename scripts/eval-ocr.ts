/**
 * OCR quality evaluation with an automatic answer key: pages whose text layer
 * is good are rendered to images, read by the vision model, and compared with
 * the real text. Lets OCR settings (prompt, image width) be compared with numbers.
 * Slow on CPU (~40 s per page).
 *
 *   npm run eval:ocr -- uploads/x.pdf              # first 3 good pages
 *   npm run eval:ocr -- uploads/x.pdf --pages 2,5  # chosen pages
 *
 * Metrics (lower CER / higher recall is better):
 *   CER         - character error rate: edit distance / reference length
 *   word recall - share of the reference words that appear in the OCR text
 *                 (ignores reading order, which differs on slides with columns)
 */
import { performance } from "node:perf_hooks";
import { config } from "../src/config.js";
import { ocrPage } from "../src/rag/ocr.js";
import { openPdf } from "../src/rag/pdf.js";
import { assessPage, normalizeText } from "../src/rag/textQuality.js";

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith("--") && arg.endsWith(".pdf"));
const pagesIndex = args.indexOf("--pages");
const chosen = pagesIndex >= 0 ? args[pagesIndex + 1]!.split(",").map(Number) : null;

if (!file) {
  console.error("Usage: npm run eval:ocr -- <file.pdf> [--pages 2,5]");
  process.exit(1);
}

/** Levenshtein distance with two rows of memory. */
function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j]! + 1,
        current[j - 1]! + 1,
        previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }

  return previous[b.length]!;
}

const clean = (text: string) => normalizeText(text).replace(/\s+/g, " ").trim();
const words = (text: string) => clean(text).split(" ").filter((w) => w.length > 1);

const pdf = await openPdf(file);
const rows: Record<string, string | number>[] = [];

try {
  const candidates = pdf.pages.filter(
    (page) =>
      (chosen ? chosen.includes(page.pageNumber) : true) &&
      assessPage(page.text, config.ocr.minChars).ok,
  );
  const pages = chosen ? candidates : candidates.slice(0, 3);

  for (const page of pages) {
    console.log(`... page ${page.pageNumber}`);
    const start = performance.now();
    const ocr = await ocrPage(pdf, page.pageNumber);
    const seconds = (performance.now() - start) / 1000;

    const reference = clean(page.text);
    const read = clean(ocr);
    const ocrWords = new Set(words(read));
    const referenceWords = words(reference);

    rows.push({
      page: page.pageNumber,
      chars: reference.length,
      CER: `${((editDistance(read, reference) / Math.max(reference.length, 1)) * 100).toFixed(0)}%`,
      "word recall": `${(
        (referenceWords.filter((w) => ocrWords.has(w)).length / Math.max(referenceWords.length, 1)) *
        100
      ).toFixed(0)}%`,
      s: Math.round(seconds),
    });

    console.log(`reference: ${reference.slice(0, 160)}\nocr:       ${read.slice(0, 160)}\n`);
  }
} finally {
  await pdf.close();
}

console.table(rows);
console.log(`model=${config.llm.model} imageWidth=${config.ocr.imageWidth}`);
