import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PageText, PdfHandle } from "../src/rag/pdf.js";

// The vision model is replaced by a fake that "reads" a page image.
vi.mock("../src/llm/ollamaClient.js", () => ({ chat: vi.fn() }));

const { extractPages } = await import("../src/rag/ocr.js");
const { chat } = await import("../src/llm/ollamaClient.js");
const { logger } = await import("../src/logger.js");

const GOOD_TEXT = "این یک صفحه سالم با متن کامل فارسی است که نیازی به خواندن دوباره ندارد.";

const textPage = (pageNumber: number): PageText => ({
  pageNumber,
  text: GOOD_TEXT,
  method: "text",
});
const imagePage = (pageNumber: number): PageText => ({ pageNumber, text: "", method: "text" });

function fakePdf(pages: PageText[]): PdfHandle {
  return {
    pages,
    renderPage: vi.fn(async () => new Uint8Array([1, 2, 3])),
    close: vi.fn(async () => {}),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(logger, "info").mockImplementation(() => {});
  vi.spyOn(logger, "warn").mockImplementation(() => {});
  vi.mocked(chat).mockImplementation(async () => "متن خوانده‌شده از تصویر صفحه");
});

describe("extractPages", () => {
  it("keeps good text pages and never calls the vision model for them", async () => {
    const pdf = fakePdf([textPage(1), textPage(2)]);

    const result = await extractPages(pdf);

    expect(result.ocrPages).toBe(0);
    expect(result.pages).toEqual(pdf.pages);
    expect(chat).not.toHaveBeenCalled();
  });

  it("OCRs only the pages without a usable text layer", async () => {
    const pdf = fakePdf([textPage(1), imagePage(2), textPage(3)]);

    const result = await extractPages(pdf);

    expect(pdf.renderPage).toHaveBeenCalledTimes(1);
    expect(pdf.renderPage).toHaveBeenCalledWith(2, expect.any(Number));
    expect(result.ocrPages).toBe(1);
    expect(result.pages.map((page) => page.method)).toEqual(["text", "ocr", "text"]);
    expect(result.pages[1]!.text).toBe("متن خوانده‌شده از تصویر صفحه");
  });

  it("sends the page image to the model as base64", async () => {
    await extractPages(fakePdf([imagePage(1)]));

    const request = vi.mocked(chat).mock.calls[0]![0];
    expect(request.messages[0]!.images).toEqual([Buffer.from([1, 2, 3]).toString("base64")]);
    expect(request.options?.temperature).toBe(0);
  });

  it("keeps the text layer when the model output is a repetition loop", async () => {
    vi.mocked(chat).mockResolvedValue(Array(30).fill("خط تکراری").join("\n"));
    const pdf = fakePdf([imagePage(1)]);

    const result = await extractPages(pdf);

    expect(result.ocrPages).toBe(0);
    expect(result.pages[0]!.method).toBe("text");
  });

  it("stops at the page cap and reports skipped pages", async () => {
    const pages = Array.from({ length: 35 }, (_, i) => imagePage(i + 1));
    const progress = vi.fn();

    const result = await extractPages(fakePdf(pages), progress);

    expect(chat).toHaveBeenCalledTimes(30);
    expect(result.ocrPages).toBe(30);
    expect(progress).toHaveBeenNthCalledWith(1, { ocrTotal: 30, ocrDone: 0, skipped: 5 });
  });

  it("reports progress every 5 pages", async () => {
    const pages = Array.from({ length: 12 }, (_, i) => imagePage(i + 1));
    const progress = vi.fn();

    await extractPages(fakePdf(pages), progress);

    expect(progress.mock.calls.map(([p]) => p.ocrDone)).toEqual([0, 5, 10]);
  });
});
