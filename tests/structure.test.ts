import { describe, expect, it } from "vitest";
import {
  findBoilerplate,
  layoutOf,
  pageTitle,
  sectionIndexes,
  stripBoilerplate,
} from "../src/rag/structure.js";

const HEADER = "درس ساختمان داده ها – مدرس مریم غالمی";
const slides = Array.from({ length: 6 }, (_, i) => `${HEADER}\nعنوان اسلاید ${i}\n${i + 1}\nمتن`);

describe("findBoilerplate", () => {
  it("finds a header repeated on every slide", () => {
    expect(findBoilerplate(slides)).toEqual(new Set([HEADER]));
  });

  it("finds nothing in plain text", () => {
    const notes = ["فصل اول درباره نرم افزار است.", "فصل دوم درباره آزمون است.", "سوم", "چهارم"];

    expect(findBoilerplate(notes).size).toBe(0);
  });

  it("does nothing for short documents", () => {
    expect(findBoilerplate(slides.slice(0, 3)).size).toBe(0);
  });

  it("never treats repeated code as boilerplate", () => {
    const code = Array(6).fill("int main() {\nreturn 1;\n}");

    expect(findBoilerplate(code).size).toBe(0);
  });

  it("does not remove a title repeated on a run of slides (a section)", () => {
    const deck = [
      "هافمن\nالف",
      "هافمن\nب",
      "هافمن\nج",
      "کروسکال\nد",
      "پریم\nه",
      "دایجکسترا\nو",
      "خلاصه\nز",
      "تمرین\nح",
    ];

    expect(findBoilerplate(deck).has("هافمن")).toBe(false);
  });
});

describe("stripBoilerplate", () => {
  it("removes boilerplate and the printed page number", () => {
    expect(stripBoilerplate(`${HEADER}\nعنوان\n7\nمتن`, 7, new Set([HEADER]))).toBe("عنوان\nمتن");
  });

  it("keeps numbers that are not the page number", () => {
    expect(stripBoilerplate("نتیجه\n24", 10, new Set())).toBe("نتیجه\n24");
  });

  it("accepts a printed number one off from the real page (cover not numbered)", () => {
    expect(stripBoilerplate("2\nمتن", 3, new Set())).toBe("متن");
  });
});

describe("pageTitle", () => {
  it.each([
    ["مثال چهارم : الگوریتم هافمن\n• متن", "مثال چهارم : الگوریتم هافمن"],
    ["• یک نکته\nادامه", null],
    ["int fact(int n) {\nreturn 1;", null],
    ["این یک جمله کامل است که با نقطه تمام می‌شود.\nادامه", null],
    ["ب".repeat(100), null],
    ["", null],
  ])("%s -> %s", (text, title) => {
    expect(pageTitle(text)).toBe(title);
  });
});

describe("layoutOf", () => {
  it("short pages are a slide deck", () => {
    expect(layoutOf(["کوتاه", "یک اسلاید", "اسلاید دیگر"])).toBe("paged");
  });

  it("full pages are running text", () => {
    expect(layoutOf(["الف".repeat(500), "ب".repeat(500)])).toBe("flowing");
  });

  it("ignores empty pages", () => {
    expect(layoutOf(["", "", "الف".repeat(500)])).toBe("flowing");
  });
});

describe("sectionIndexes", () => {
  it("groups consecutive same-title pages; untitled pages stand alone", () => {
    expect(sectionIndexes(["هافمن", "هافمن", "پریم", null, null, "هافمن"])).toEqual([
      0, 0, 1, 2, 3, 4,
    ]);
  });

  it("treats 'continued' slides as the same section", () => {
    expect(sectionIndexes(["کلاس ( Class )", "کلاس ( ادامه )", "کلاس ( ادامه )", "شیء ( Object )"])).toEqual([
      0, 0, 0, 1,
    ]);
  });
});
