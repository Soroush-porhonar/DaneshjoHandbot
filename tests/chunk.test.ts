import { describe, expect, it } from "vitest";
import { chunkPages } from "../src/rag/chunk.js";

describe("chunkPages", () => {
  it("returns no chunks for empty pages", () => {
    expect(chunkPages([{ pageNumber: 1, text: "  \n " }])).toEqual([]);
  });

  it("keeps each page's number and numbers chunks continuously", () => {
    const chunks = chunkPages([
      { pageNumber: 1, text: "first page" },
      { pageNumber: 2, text: "second page" },
    ]);

    expect(chunks.map((c) => [c.chunkIndex, c.pageNumber, c.content])).toEqual([
      [0, 1, "first page"],
      [1, 2, "second page"],
    ]);
  });

  it("splits long pages into overlapping chunks no larger than chunkSize", () => {
    const chunks = chunkPages([{ pageNumber: 3, text: "word ".repeat(100) }], 100, 20);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.content.length <= 100)).toBe(true);
    expect(chunks.every((c) => c.pageNumber === 3)).toBe(true);
  });

  it("normalizes text before chunking", () => {
    const [chunk] = chunkPages([{ pageNumber: 1, text: "مثال\t6\t:" }]);

    expect(chunk?.content).toBe("مثال 6 :");
  });

  it("rejects an overlap that is not smaller than the chunk size", () => {
    expect(() => chunkPages([], 100, 100)).toThrow();
  });
});
