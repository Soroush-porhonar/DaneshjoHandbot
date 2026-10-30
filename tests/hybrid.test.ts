import { describe, expect, it } from "vitest";
import { fuseRankings, keywordTerms } from "../src/rag/retrieve.js";
import type { RetrievedChunk } from "../src/rag/retrieve.js";

const chunk = (chunkIndex: number, documentId = 1): RetrievedChunk => ({
  documentId,
  filename: "a.pdf",
  pageNumber: chunkIndex + 1,
  chunkIndex,
  content: `c${chunkIndex}`,
  distance: 0.3,
});

const indexes = (chunks: RetrievedChunk[]) => chunks.map((c) => c.chunkIndex);

describe("keywordTerms", () => {
  it("keeps meaningful words and drops common Persian words", () => {
    expect(keywordTerms("الگوریتم هافمن برای چه کاری استفاده می‌شود؟")).toEqual([
      "الگوریتم",
      "هافمن",
      "کاری",
      "استفاده",
    ]);
  });

  it("keeps numbers and English terms, lower-cased", () => {
    expect(keywordTerms("مراحل تست طبق استاندارد 29119 و ابزار JMeter چیست؟")).toEqual([
      "مراحل",
      "تست",
      "استاندارد",
      "29119",
      "ابزار",
      "jmeter",
    ]);
  });

  it("normalizes Arabic letter forms like the stored text", () => {
    expect(keywordTerms("كد يك")).toEqual(["کد"]);
  });

  it("returns nothing for a question made only of common words", () => {
    expect(keywordTerms("این چیست؟")).toEqual([]);
  });
});

describe("fuseRankings (Reciprocal Rank Fusion)", () => {
  it("ranks chunks found by both searches first", () => {
    const vector = [chunk(1), chunk(2), chunk(3)];
    const keyword = [chunk(3), chunk(9)];

    expect(indexes(fuseRankings([vector, keyword]))).toEqual([3, 1, 2, 9]);
  });

  it("keeps a keyword-only hit that vector search missed", () => {
    expect(indexes(fuseRankings([[chunk(1)], [chunk(7)]]))).toContain(7);
  });

  it("treats the same chunk index in different documents as different chunks", () => {
    const fused = fuseRankings([[chunk(1, 1)], [chunk(1, 2)]]);

    expect(fused).toHaveLength(2);
  });

  it("with one list keeps its order", () => {
    expect(indexes(fuseRankings([[chunk(5), chunk(2), chunk(8)]]))).toEqual([5, 2, 8]);
  });
});
