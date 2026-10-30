import { describe, expect, it } from "vitest";
import { chunkPages } from "../src/rag/chunk.js";
import type { PageText } from "../src/rag/pdf.js";

const page = (pageNumber: number, text: string, method: "text" | "ocr" = "text"): PageText => ({
  pageNumber,
  text,
  method,
});

const HEADER = "درس طراحی الگوریتم – مدرس مریم غالمی";

/** A slide: repeated course header, title, printed page number, body. */
const slide = (pageNumber: number, title: string, body: string) =>
  page(pageNumber, `${HEADER}\n${title}\n${pageNumber}\n${body}`);

/** A long page of running text (no titles, headers or page numbers). */
const prose = (pageNumber: number, sentence: string) =>
  page(pageNumber, Array(40).fill(sentence).join(" "));

describe("chunkPages", () => {
  it("returns no chunks for empty pages", () => {
    expect(chunkPages([page(1, "  \n ")])).toEqual([]);
  });

  it("normalizes text before chunking", () => {
    const [chunk] = chunkPages([page(1, "مثال\t6\t:")]);

    expect(chunk?.content).toBe("مثال 6 :");
  });

  it("rejects an overlap that is not smaller than the chunk size", () => {
    expect(() => chunkPages([], { chunkSize: 100, overlap: 100 })).toThrow();
  });

  describe("slide decks", () => {
    const deck = [
      slide(1, "الگوریتم هافمن", "• کدگذاری با طول متغیر"),
      slide(2, "الگوریتم هافمن", "• درخت از پایین به بالا ساخته می‌شود"),
      slide(3, "الگوریتم کروسکال", "• مرتب سازی یال‌ها"),
      slide(4, "الگوریتم دایجکسترا", "• کوتاه‌ترین مسیر تک منبع"),
    ];

    it("keeps one chunk per slide with its page", () => {
      const chunks = chunkPages(deck);

      expect(chunks.map((c) => [c.chunkIndex, c.pageNumber, c.pageEnd])).toEqual([
        [0, 1, 1],
        [1, 2, 2],
        [2, 3, 3],
        [3, 4, 4],
      ]);
    });

    it("removes the repeated header and the printed page number", () => {
      const [chunk] = chunkPages(deck);

      expect(chunk!.content).toBe("الگوریتم هافمن\n• کدگذاری با طول متغیر");
    });

    it("keeps the header when stripping is switched off", () => {
      const [chunk] = chunkPages(deck, { stripBoilerplate: false });

      expect(chunk!.content.startsWith(HEADER)).toBe(true);
    });

    it("stores the slide title and groups same-title slides into a section", () => {
      const chunks = chunkPages(deck);

      expect(chunks.map((c) => c.sectionTitle)).toEqual([
        "الگوریتم هافمن",
        "الگوریتم هافمن",
        "الگوریتم کروسکال",
        "الگوریتم دایجکسترا",
      ]);
      expect(chunks.map((c) => c.sectionIndex)).toEqual([0, 0, 1, 2]);
    });

    it("adds the title to the embedded text only when the chunk lacks it", () => {
      const longBody = Array(60).fill("• نکته‌ای درباره هافمن.").join("\n");
      const chunks = chunkPages([...deck, slide(5, "الگوریتم هافمن", longBody)].slice(1), {
        chunkSize: 400,
        overlap: 50,
      });
      const fromLongSlide = chunks.filter((c) => c.pageNumber === 5);

      expect(fromLongSlide.length).toBeGreaterThan(1);
      expect(fromLongSlide[0]!.embedText).toBe(fromLongSlide[0]!.content);
      expect(fromLongSlide[1]!.embedText).toBe(`الگوریتم هافمن\n${fromLongSlide[1]!.content}`);
    });

    it("never adds a title when the feature is off", () => {
      const longBody = Array(60).fill("• نکته‌ای درباره هافمن.").join("\n");
      const chunks = chunkPages([slide(1, "الگوریتم هافمن", longBody)], {
        chunkSize: 400,
        overlap: 50,
        titleInEmbedding: false,
      });

      expect(chunks.every((c) => c.embedText === c.content)).toBe(true);
    });
  });

  describe("running text", () => {
    const notes = [
      prose(1, "مهندسی نرم افزار به طراحی و ساخت نرم افزار می‌پردازد."),
      prose(2, "آزمون نرم افزار برای یافتن خطاها انجام می‌شود."),
    ];

    it("has no titles or sections", () => {
      const chunks = chunkPages(notes);

      expect(chunks.every((c) => c.sectionTitle === null && c.sectionIndex === null)).toBe(true);
      expect(chunks.every((c) => c.embedText === c.content)).toBe(true);
    });

    it("lets a chunk continue onto the next page and records both pages", () => {
      const chunks = chunkPages(notes, { chunkSize: 1200, overlap: 200, crossPage: true });

      expect(chunks.some((c) => c.pageNumber === 1 && c.pageEnd === 2)).toBe(true);
      expect(chunks.every((c) => c.content.length <= 1200)).toBe(true);
    });

    it("keeps chunks inside their page when cross-page chunking is off", () => {
      const chunks = chunkPages(notes, { crossPage: false });

      expect(chunks.every((c) => c.pageNumber === c.pageEnd)).toBe(true);
      expect(new Set(chunks.map((c) => c.pageNumber))).toEqual(new Set([1, 2]));
    });

    it("marks a chunk as OCR when any of its pages was read by OCR", () => {
      const chunks = chunkPages([notes[0]!, { ...notes[1]!, method: "ocr" }], { crossPage: true });

      expect(chunks.find((c) => c.pageEnd === 2 && c.pageNumber === 1)?.method).toBe("ocr");
      expect(chunks[0]!.method).toBe("text");
    });

    it("fixes lines stored with their words in reverse order", () => {
      const reversed = Array(12).fill(".آمدم دنیا به مذهبی خانواده یک در").join("\n");
      const [chunk] = chunkPages([page(1, reversed)]);

      expect(chunk!.content.split("\n")[0]).toBe("در یک خانواده مذهبی به دنیا آمدم.");
    });
  });
});
