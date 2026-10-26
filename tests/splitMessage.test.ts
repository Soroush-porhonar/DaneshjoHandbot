import { describe, expect, it } from "vitest";
import { splitMessage } from "../src/bale.js";

describe("splitMessage", () => {
  it("leaves short messages alone", () => {
    expect(splitMessage("hello")).toEqual(["hello"]);
  });

  it("splits long messages on newlines within the limit", () => {
    const line = "a".repeat(1000);
    const parts = splitMessage(Array(10).fill(line).join("\n"));

    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= 4000)).toBe(true);
    expect(parts.join("\n")).toBe(Array(10).fill(line).join("\n"));
  });

  it("hard-splits text with no break points", () => {
    const parts = splitMessage("a".repeat(9000));

    expect(parts.map((p) => p.length)).toEqual([4000, 4000, 1000]);
  });
});
