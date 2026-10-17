import { PDFParse } from "pdf-parse";

export async function extractPdfText(filePath: string): Promise<string> {
  const parser = new PDFParse({ url: filePath });

  try {
    const result = await parser.getText();
    const text = result.text.trim();

    if (!text) {
      throw new Error(
        "No text was extracted. The PDF may be scanned or image-only.",
      );
    }

    return text;
  } finally {
    await parser.destroy();
  }
}
