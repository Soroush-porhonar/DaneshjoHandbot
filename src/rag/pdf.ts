import { PDFParse } from "pdf-parse";
import { PdfExtractError } from "../errors.js";

export async function extractPdfText(filePath: string): Promise<string> {
  const parser = new PDFParse({ url: filePath });

  try {
    const result = await parser.getText();
    const text = result.text.trim();

    if (!text) {
      throw new PdfExtractError(
        "No text was extracted. The PDF may be scanned or image-only.",
      );
    }

    return text;
  } catch (error: unknown) {
    if (error instanceof PdfExtractError) {
      throw error;
    }

    throw new PdfExtractError(
      `Failed to parse PDF: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await parser.destroy();
  }
}
