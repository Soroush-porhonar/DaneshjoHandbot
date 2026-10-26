import { PDFParse } from "pdf-parse";
import { PdfExtractError } from "../errors.js";

export interface PageText {
  pageNumber: number;
  text: string;
}

/** Extracts the raw text layer of every page (1-based page numbers). */
export async function extractPdfPages(filePath: string): Promise<PageText[]> {
  const parser = new PDFParse({ url: filePath });

  try {
    const result = await parser.getText();

    return result.pages.map((page) => ({
      pageNumber: page.num,
      text: page.text,
    }));
  } catch (error: unknown) {
    throw new PdfExtractError(
      `Failed to parse PDF: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await parser.destroy();
  }
}
