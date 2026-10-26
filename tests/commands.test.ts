import { describe, expect, it } from "vitest";
import { parseCommand } from "../src/bot/commands/index.js";

describe("parseCommand", () => {
  it("returns null for plain text", () => {
    expect(parseCommand("what is a database?")).toBeNull();
  });

  it("parses a command with arguments", () => {
    const parsed = parseCommand("  /select   3 ");

    expect(parsed?.args).toEqual(["3"]);
  });

  it("does not treat inherited object keys as commands", () => {
    expect(parseCommand("constructor")).toBeNull();
    expect(parseCommand("toString")).toBeNull();
  });

  it("ignores unknown slash commands", () => {
    expect(parseCommand("/unknown")).toBeNull();
  });
});
