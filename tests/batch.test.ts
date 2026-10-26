import { describe, expect, it } from "vitest";
import { batchByChars } from "../src/rag/batch.js";

const chunk = (length: number) => ({ content: "x".repeat(length) });

describe("batchByChars", () => {
  it("returns no batches for no chunks", () => {
    expect(batchByChars([], 100)).toEqual([]);
  });

  it("keeps order and respects the character limit", () => {
    const batches = batchByChars([chunk(40), chunk(40), chunk(40), chunk(40)], 100);

    expect(batches.map((b) => b.length)).toEqual([2, 2]);
  });

  it("gives an oversized chunk its own batch", () => {
    const batches = batchByChars([chunk(10), chunk(500), chunk(10)], 100);

    expect(batches.map((b) => b.length)).toEqual([1, 1, 1]);
  });
});
