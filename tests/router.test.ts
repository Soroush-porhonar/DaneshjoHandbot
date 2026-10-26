import { describe, expect, it } from "vitest";
import { parseClassification } from "../src/rag/router.js";

describe("parseClassification", () => {
  it("accepts a valid document route", () => {
    expect(
      parseClassification('{"route":"document","retrievalMode":"broad"}'),
    ).toEqual({ route: "document", retrievalMode: "broad" });
  });

  it("forces focused retrieval for chat", () => {
    expect(
      parseClassification('{"route":"chat","retrievalMode":"broad"}'),
    ).toEqual({ route: "chat", retrievalMode: "focused" });
  });

  it.each([
    "not json",
    '{"route":"other","retrievalMode":"focused"}',
    '{"route":"document","retrievalMode":"huge"}',
    '{"route":"document"}',
  ])("rejects %s", (content) => {
    expect(() => parseClassification(content)).toThrow();
  });
});
