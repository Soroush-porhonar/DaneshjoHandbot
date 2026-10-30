import { describe, expect, it, vi } from "vitest";
import { chunkDocument, semanticChunks, splitUnits } from "../src/rag/semanticChunk.js";
import type { CleanPage } from "../src/rag/chunk.js";
import type { PageText } from "../src/rag/pdf.js";

/** Fake embeddings: sentences about testing point one way, about OOP another. */
const fakeEmbed = vi.fn(async (texts: string[]) =>
  texts.map((text) => (text.includes("تست") ? [1, 0] : [0, 1])),
);

const page = (pageNumber: number, text: string): CleanPage => ({ pageNumber, text, method: "text" });

const testing = (n: number) =>
  Array.from({ length: n }, (_, i) => `جمله شماره ${i} درباره تست نرم افزار و یافتن خطاها است.`).join(" ");
const oop = (n: number) =>
  Array.from({ length: n }, (_, i) => `جمله شماره ${i} درباره کلاس و شیء در برنامه نویسی است.`).join(" ");

describe("splitUnits", () => {
  it("splits into sentences and merges tiny pieces (headings) into the next one", () => {
    const units = splitUnits([page(1, "۲.۱ تعریف\nاین یک جمله کامل و نسبتا طولانی درباره تست است. این هم جمله دوم طولانی درباره تست است.")], 1200);

    expect(units.map((u) => u.text)).toEqual([
      "۲.۱ تعریف\nاین یک جمله کامل و نسبتا طولانی درباره تست است.",
      "این هم جمله دوم طولانی درباره تست است.",
    ]);
  });
});

describe("semanticChunks", () => {
  it("cuts where the topic changes, even in the middle of a page", async () => {
    const chunks = await semanticChunks([page(1, `${testing(6)} ${oop(6)}`)], 1200, fakeEmbed);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.content).toContain("تست");
    expect(chunks[0]!.content).not.toContain("کلاس");
    expect(chunks[1]!.content).toContain("کلاس");
  });

  it("keeps one topic together across a page break and records both pages", async () => {
    const chunks = await semanticChunks([page(4, testing(3)), page(5, testing(3))], 1200, fakeEmbed);

    expect(chunks).toHaveLength(1);
    expect([chunks[0]!.pageNumber, chunks[0]!.pageEnd]).toEqual([4, 5]);
  });

  it("never exceeds the maximum size", async () => {
    const chunks = await semanticChunks([page(1, testing(60))], 600, fakeEmbed);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.content.length <= 600)).toBe(true);
  });
});

describe("chunkDocument", () => {
  const prose = (n: number, text: string): PageText => ({
    pageNumber: n,
    text: Array(3).fill(text).join(" "),
    method: "text",
  });

  it("uses semantic chunking for running text only when enabled", async () => {
    const pages = [prose(1, testing(8)), prose(2, oop(8))];
    fakeEmbed.mockClear();

    await chunkDocument(pages, { semantic: false }, fakeEmbed);
    expect(fakeEmbed).not.toHaveBeenCalled();

    await chunkDocument(pages, { semantic: true }, fakeEmbed);
    expect(fakeEmbed).toHaveBeenCalled();
  });

  it("keeps slide decks on per-slide chunks", async () => {
    const slides: PageText[] = [1, 2, 3].map((n) => ({ pageNumber: n, text: `عنوان ${n}\n• نکته کوتاه`, method: "text" }));
    fakeEmbed.mockClear();

    const chunks = await chunkDocument(slides, { semantic: true }, fakeEmbed);

    expect(fakeEmbed).not.toHaveBeenCalled();
    expect(chunks.map((c) => c.pageNumber)).toEqual([1, 2, 3]);
  });
});
