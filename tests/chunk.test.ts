import { describe, expect, it } from "vitest";
import { chunkPages } from "../src/rag/chunk.js";

describe("chunkPages", () => {
  it("returns no chunks for empty pages", () => {
    expect(chunkPages([{ pageNumber: 1, text: "  \n ", method: "text" }])).toEqual([]);
  });

  it("keeps each page's number and numbers chunks continuously", () => {
    const chunks = chunkPages([
      { pageNumber: 1, text: "first page", method: "text" },
      { pageNumber: 2, text: "second page", method: "ocr" },
    ]);

    expect(
      chunks.map((c) => [c.chunkIndex, c.pageNumber, c.content, c.method]),
    ).toEqual([
      [0, 1, "first page", "text"],
      [1, 2, "second page", "ocr"],
    ]);
  });

  it("splits long pages into overlapping chunks no larger than chunkSize", () => {
    const chunks = chunkPages([{ pageNumber: 3, text: "word ".repeat(100), method: "text" }], 100, 20);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.content.length <= 100)).toBe(true);
    expect(chunks.every((c) => c.pageNumber === 3)).toBe(true);
  });

  it("normalizes text before chunking", () => {
    const [chunk] = chunkPages([{ pageNumber: 1, text: "مثال\t6\t:", method: "text" }]);

    expect(chunk?.content).toBe("مثال 6 :");
  });

  it("rejects an overlap that is not smaller than the chunk size", () => {
    expect(() => chunkPages([], 100, 100)).toThrow();
  });
});
