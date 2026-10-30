import { config } from "../config.js";
import { chat } from "../llm/ollamaClient.js";
import { OCR_PROMPT } from "../llm/prompts/ocr.js";
import { logger } from "../logger.js";
import type { PageText, PdfHandle } from "./pdf.js";
import { assessPage, isDegenerateOcr, normalizeText } from "./textQuality.js";

export interface ExtractionProgress {
  /** Pages that will be read with the vision model. */
  ocrTotal: number;
  ocrDone: number;
  /** Poor pages left on their text layer because of the page cap. */
  skipped: number;
}

export interface ExtractionResult {
  pages: PageText[];
  ocrPages: number;
}

/** Reads one page image with the vision model; returns "" if the output is unusable. */
export async function ocrPage(
  pdf: PdfHandle,
  pageNumber: number,
  signal?: AbortSignal,
): Promise<string> {
  const png = await pdf.renderPage(pageNumber, config.ocr.imageWidth);

  const text = await chat({
    think: false,
    options: { temperature: 0, num_predict: 2048 },
    timeoutMs: config.ocr.timeoutMs,
    signal,
    messages: [
      {
        role: "user",
        content: OCR_PROMPT,
        images: [Buffer.from(png).toString("base64")],
      },
    ],
  });

  if (isDegenerateOcr(text)) {
    logger.warn(`[OCR] Page ${pageNumber}: unusable output, keeping text layer`);
    return "";
  }

  return normalizeText(text);
}

/**
 * Returns the text of every page: the PDF's own text layer where it is good,
 * and vision-model OCR for pages that are empty or have broken letters.
 */
export async function extractPages(
  pdf: PdfHandle,
  onProgress?: (progress: ExtractionProgress) => Promise<void> | void,
  signal?: AbortSignal,
): Promise<ExtractionResult> {
  const poor = config.ocr.enabled
    ? pdf.pages.filter(
        (page) => !assessPage(page.text, config.ocr.minChars).ok,
      )
    : [];

  const toOcr = poor.slice(0, config.ocr.maxPages);
  const progress: ExtractionProgress = {
    ocrTotal: toOcr.length,
    ocrDone: 0,
    skipped: poor.length - toOcr.length,
  };

  if (toOcr.length === 0) {
    return { pages: pdf.pages, ocrPages: 0 };
  }

  logger.info(
    `[OCR] ${toOcr.length} of ${pdf.pages.length} pages need OCR` +
      (progress.skipped > 0 ? ` (${progress.skipped} skipped by page cap)` : ""),
  );
  await onProgress?.({ ...progress });

  const ocrByPage = new Map<number, string>();

  for (const page of toOcr) {
    const started = Date.now();
    const text = await ocrPage(pdf, page.pageNumber, signal);

    progress.ocrDone++;
    logger.info(
      `[OCR] Page ${page.pageNumber} done in ${Math.round((Date.now() - started) / 1000)}s ` +
        `(${progress.ocrDone}/${progress.ocrTotal})`,
    );

    if (text) ocrByPage.set(page.pageNumber, text);

    if (progress.ocrDone % config.ocr.progressEvery === 0) {
      await onProgress?.({ ...progress });
    }
  }

  const pages = pdf.pages.map((page) => {
    const text = ocrByPage.get(page.pageNumber);

    return text === undefined
      ? page
      : { pageNumber: page.pageNumber, text, method: "ocr" as const };
  });

  return { pages, ocrPages: ocrByPage.size };
}
