import { describe, expect, it } from "vitest";
import { cleanRewrite, needsRewrite } from "../src/rag/rewrite.js";

const exchange = [
  { role: "user" as const, content: "الگوریتم دایجکسترا چیست؟" },
  { role: "assistant" as const, content: "یک الگوریتم مسیریابی است." },
];

describe("needsRewrite", () => {
  it("rewrites short messages that follow an exchange", () => {
    expect(needsRewrite("بیشتر توضیح بده", exchange)).toBe(true);
  });

  it("does not rewrite the first message of a conversation", () => {
    expect(needsRewrite("بیشتر توضیح بده", [])).toBe(false);
  });

  it("does not rewrite long, self-contained questions", () => {
    expect(needsRewrite("الف".repeat(80), exchange)).toBe(false);
  });
});

describe("cleanRewrite", () => {
  it("strips quotes and whitespace", () => {
    expect(cleanRewrite('  «الگوریتم دایجکسترا را بیشتر توضیح بده»\n')).toBe(
      "الگوریتم دایجکسترا را بیشتر توضیح بده",
    );
  });

  it.each(["", "   ", "خط اول\nخط دوم", "الف".repeat(400)])(
    "rejects unusable output %#",
    (output) => {
      expect(cleanRewrite(output)).toBeNull();
    },
  );
});
