import { describe, expect, it } from "vitest";
import { normalizeText } from "../src/rag/textQuality.js";

describe("normalizeText", () => {
  it("turns tabs and repeated spaces into single spaces", () => {
    expect(normalizeText("a\tb    c")).toBe("a b c");
  });

  it("converts Arabic presentation forms to regular letters", () => {
    expect(normalizeText("ﺑﺨﺶ")).toBe("بخش");
  });

  it("converts Arabic yeh and kaf to Persian ones", () => {
    expect(normalizeText("كتاب ي")).toBe("کتاب ی");
  });

  it("keeps the zero-width non-joiner used in Persian words", () => {
    expect(normalizeText("می‌کند")).toBe("می‌کند");
  });

  it("removes invisible direction marks and collapses blank lines", () => {
    expect(normalizeText("a‏\n\n\n\n b ")).toBe("a\n\nb");
  });
});
