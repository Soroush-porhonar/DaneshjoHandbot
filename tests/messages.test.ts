import { describe, expect, it } from "vitest";
import * as messages from "../src/messages.js";

/** Renders every exported message (calling the builders with sample values). */
function allMessages(): [string, string][] {
  const samples: [string, string][] = [];

  for (const [name, value] of Object.entries(messages)) {
    if (typeof value === "string") {
      samples.push([name, value]);
    } else if (name === "documentsListText") {
      samples.push([name, messages.documentsListText([{ id: 3, filename: "جزوه.pdf", status: "completed" }], 3)]);
      samples.push([`${name}(none selected)`, messages.documentsListText([{ id: 3, filename: "جزوه.pdf", status: "failed" }], null)]);
    } else if (typeof value === "function") {
      const fn = value as (...args: unknown[]) => string;
      samples.push([name, fn("جزوه.pdf", 2)]);
      samples.push([`${name}(zero)`, fn(0, 0)]);
    } else {
      samples.push([name, Object.values(value as Record<string, string>).join("\n")]);
    }
  }

  return samples;
}

/** Removes the Latin text that is allowed: commands, PDF, and file names. */
function stripAllowed(text: string): string {
  return text
    .replace(/\/[a-z_]+/g, "")
    .replace(/\bPDF\b/g, "")
    .replace(/\S+\.pdf/gi, "");
}

describe("user-facing messages", () => {
  it.each(allMessages())("%s is Persian only", (_name, text) => {
    expect(stripAllowed(text)).not.toMatch(/[A-Za-z]/);
  });

  it.each(allMessages())("%s uses no formal شما-style endings", (_name, text) => {
    expect(text).not.toMatch(/(کنید|بفرمایید|نکرده‌اید|ببینید|بفرستید)/);
  });

  it("advertises commands in the form the bot actually parses", () => {
    expect(messages.HELP_TEXT).toContain("/select 1");
    expect(messages.documentsListText([], null)).toContain("/select 3");
    expect(messages.documentsListText([], null)).not.toMatch(/\d\s*\/select/);
  });
});
