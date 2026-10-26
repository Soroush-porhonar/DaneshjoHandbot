import { describe, expect, it } from "vitest";
import { assessPage, isDegenerateOcr, normalizeText } from "../src/rag/textQuality.js";

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

describe("assessPage", () => {
  const good = "این یک جمله کامل و سالم فارسی است که شامل چندین کلمه معمولی می‌باشد و هیچ مشکلی ندارد";
  const broken = "ب ط ور ک ل ی و ی ر و س ی ب ه ن ام ک ر و ن ا و ج ود د ا ش ت ک ه ا ز خ ا ن و ا د ه";

  it("accepts a healthy text layer", () => {
    expect(assessPage(good, 20)).toEqual({ ok: true });
  });

  it("flags pages with almost no text as image-only", () => {
    expect(assessPage("  12  ", 20)).toEqual({ ok: false, reason: "no text layer" });
  });

  it("flags Persian text whose letters are split by spaces", () => {
    expect(assessPage(broken, 20)).toEqual({ ok: false, reason: "broken letters" });
  });

  it("does not treat the word و as a broken letter", () => {
    expect(assessPage(Array(20).fill("و").join(" ") + " " + good, 20)).toEqual({ ok: true });
  });
});

describe("isDegenerateOcr", () => {
  it("rejects empty output", () => {
    expect(isDegenerateOcr("  \n ")).toBe(true);
  });

  it("rejects output stuck repeating one line", () => {
    expect(isDegenerateOcr(Array(30).fill("same line").join("\n"))).toBe(true);
  });

  it("accepts normal multi-line output", () => {
    expect(isDegenerateOcr("line one\nline two\nline three")).toBe(false);
  });
});
