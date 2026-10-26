import { describe, expect, it } from "vitest";
import { chunkText } from "../src/rag/chunk.js";

describe("chunkText", () => {
  it("returns no chunks for empty text", () => {
    expect(chunkText("   ")).toEqual([]);
  });

  it("keeps the page number from the page marker", () => {
    const chunks = chunkText("-- 1 of 2 --\nfirst page\n-- 2 of 2 --\nsecond page");

    expect(chunks.map((c) => [c.pageNumber, c.content])).toEqual([
      [1, "first page"],
      [2, "second page"],
    ]);
    expect(chunks.map((c) => c.chunkIndex)).toEqual([0, 1]);
  });

  it("splits long pages into overlapping chunks no larger than chunkSize", () => {
    const chunks = chunkText(`-- 1 of 1 --\n${"word ".repeat(100)}`, 100, 20);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.content.length <= 100)).toBe(true);
    expect(chunks.every((c) => c.pageNumber === 1)).toBe(true);
  });

  it("rejects an overlap that is not smaller than the chunk size", () => {
    expect(() => chunkText("x", 100, 100)).toThrow();
  });
});
