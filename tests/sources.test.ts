import { describe, expect, it } from "vitest";
import { appendSources, buildSourceList } from "../src/rag/answer.js";

const chunk = (pageNumber: number | null) => ({
  filename: "notes.pdf",
  pageNumber,
  content: "x",
});

describe("sources", () => {
  it("deduplicates pages and skips unknown ones", () => {
    expect(buildSourceList([chunk(2), chunk(2), chunk(null), chunk(5)])).toEqual([
      "notes.pdf — صفحه PDF 2",
      "notes.pdf — صفحه PDF 5",
    ]);
  });

  it("returns the answer unchanged when there are no sources", () => {
    expect(appendSources("answer", [chunk(null)])).toBe("answer");
  });

  it("appends a sources section", () => {
    expect(appendSources("answer", [chunk(1)])).toContain("- notes.pdf — صفحه PDF 1");
  });
});
