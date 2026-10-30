import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/db/conversations.js", () => ({
  getSelectedDocumentId: vi.fn(),
  selectDocument: vi.fn(),
}));
vi.mock("../src/db/documents.js", () => ({
  deleteDocument: vi.fn(),
  findDocumentFilename: vi.fn(),
  listDocuments: vi.fn(),
}));

const { parseCommand } = await import("../src/bot/commands/index.js");
type CommandReply = import("../src/bot/commands/types.js").CommandReply;
const { getSelectedDocumentId, selectDocument } = await import("../src/db/conversations.js");
const { deleteDocument, findDocumentFilename, listDocuments } = await import(
  "../src/db/documents.js"
);
const { clearPendingDeletion } = await import("../src/bot/pendingDelete.js");
const messages = await import("../src/messages.js");

const CHAT_ID = 5;
const USER_ID = 8;

/** Runs a command exactly like a user typing it; returns the full reply. */
async function reply(text: string): Promise<string | CommandReply> {
  const command = parseCommand(text);
  if (!command) throw new Error(`not a command: ${text}`);
  return command.handler({ chatId: CHAT_ID, userId: USER_ID, args: command.args });
}

/** The reply's text only. */
async function run(text: string): Promise<string> {
  const result = await reply(text);
  return typeof result === "string" ? result : result.text;
}

/** callback_data of the reply's inline buttons, row by row. */
async function buttonData(text: string): Promise<string[][]> {
  const result = await reply(text);
  if (typeof result === "string" || !("inline" in result.markup)) return [];
  return result.markup.inline.map((row) => row.map((button) => button.callback_data));
}

beforeEach(() => {
  vi.clearAllMocks();
  clearPendingDeletion(CHAT_ID);
  vi.mocked(findDocumentFilename).mockResolvedValue("notes.pdf");
  vi.mocked(deleteDocument).mockResolvedValue(true);
  vi.mocked(selectDocument).mockResolvedValue(true);
});

describe("/documents", () => {
  it("explains how to start when there are no documents", async () => {
    vi.mocked(listDocuments).mockResolvedValue([]);

    expect(await run("/documents")).toBe(messages.NO_DOCUMENTS_TEXT);
  });

  it("two rows per document: the name alone (full width), then [select] [delete]", async () => {
    vi.mocked(listDocuments).mockResolvedValue([
      { id: 3, filename: "notes.pdf", status: "completed" },
      { id: 4, filename: "broken.pdf", status: "failed" },
    ]);
    vi.mocked(getSelectedDocumentId).mockResolvedValue(3);

    // A failed document can only be deleted.
    expect(await buttonData("/documents")).toEqual([
      ["info:3"],
      ["sel:3", "del:3"],
      ["info:4"],
      ["del:4"],
    ]);
  });

  it("only explains the active document in text; the documents are the buttons", async () => {
    vi.mocked(listDocuments).mockResolvedValue([{ id: 3, filename: "notes.pdf", status: "completed" }]);
    vi.mocked(getSelectedDocumentId).mockResolvedValue(3);

    const text = await run("/documents");

    expect(text).toBe(messages.DOCUMENTS_LIST_TEXT);
    expect(text).not.toContain("notes.pdf");
  });

  it("labels: ✅ marks the active document, ⚠️ a failed one; long names are shortened", async () => {
    const long = "جزوه درس آزمون نرم افزاراستاد زاغری 405.pdf";
    vi.mocked(listDocuments).mockResolvedValue([
      { id: 3, filename: "notes.pdf", status: "completed" },
      { id: 9, filename: long, status: "completed" },
      { id: 4, filename: "broken.pdf", status: "failed" },
    ]);
    vi.mocked(getSelectedDocumentId).mockResolvedValue(3);

    const result = (await reply("/documents")) as CommandReply;
    const rows = "inline" in result.markup ? result.markup.inline.map((row) => row.map((b) => b.text)) : [];

    expect(rows[0]).toEqual(["✅ notes"]);
    expect(rows[1]).toEqual([messages.ACTIVE_BUTTON, messages.DELETE_BUTTON]);
    expect(rows[2]![0]!.startsWith("📄 ")).toBe(true);
    expect(rows[2]![0]!.length).toBeLessThanOrEqual(43);
    expect(rows[3]).toEqual([messages.SELECT_BUTTON, messages.DELETE_BUTTON]);
    expect(rows[4]).toEqual(["⚠️ broken"]);
    expect(rows[5]).toEqual([messages.DELETE_BUTTON]);
  });

  it("opens from the main menu button too", async () => {
    vi.mocked(listDocuments).mockResolvedValue([]);

    expect(await run(messages.MENU_DOCUMENTS)).toBe(messages.NO_DOCUMENTS_TEXT);
  });
});

describe("/select", () => {
  it.each(["/select", "/select abc", "/select 0", "/select -2", "/select 1.5", "/select 1 2"])(
    "shows usage for bad input: %s",
    async (text) => {
      expect(await run(text)).toBe(messages.SELECT_USAGE_TEXT);
      expect(selectDocument).not.toHaveBeenCalled();
    },
  );

  it("selects a document", async () => {
    expect(await run("/select 3")).toBe(messages.selectedText(3));
    expect(selectDocument).toHaveBeenCalledWith(USER_ID, 3);
  });

  it("reports a document that cannot be selected", async () => {
    vi.mocked(selectDocument).mockResolvedValue(false);

    expect(await run("/select 3")).toBe(messages.SELECT_FAILED_TEXT);
  });
});

describe("delete with confirmation", () => {
  it("asks for confirmation (with yes/no buttons) before deleting anything", async () => {
    expect(await run("/delete 4")).toBe(messages.deleteConfirmationText("notes.pdf", 4));
    expect(await buttonData("/delete 4")).toEqual([["delok", "delno"]]);
    expect(deleteDocument).not.toHaveBeenCalled();
  });

  it("deletes after /confirm_delete, only once", async () => {
    await run("/delete 4");

    expect(await run("/confirm_delete")).toBe(messages.deleteSucceededText(4));
    expect(deleteDocument).toHaveBeenCalledWith(USER_ID, 4);
    expect(await run("/confirm_delete")).toBe(messages.NO_PENDING_DELETE_TEXT);
    expect(deleteDocument).toHaveBeenCalledTimes(1);
  });

  it("/cancel_delete keeps the document", async () => {
    await run("/delete 4");

    expect(await run("/cancel_delete")).toBe(messages.DELETE_CANCELLED_TEXT);
    expect(await run("/confirm_delete")).toBe(messages.NO_PENDING_DELETE_TEXT);
    expect(deleteDocument).not.toHaveBeenCalled();
  });

  it("/cancel_delete without a pending delete says so", async () => {
    expect(await run("/cancel_delete")).toBe(messages.NO_PENDING_DELETE_TO_CANCEL_TEXT);
  });

  it("refuses unknown or foreign documents without asking for confirmation", async () => {
    vi.mocked(findDocumentFilename).mockResolvedValue(null);

    expect(await run("/delete 99")).toBe(messages.DELETE_NOT_FOUND_TEXT);
    expect(await run("/confirm_delete")).toBe(messages.NO_PENDING_DELETE_TEXT);
  });

  it("reports when the delete itself fails", async () => {
    vi.mocked(deleteDocument).mockResolvedValue(false);
    await run("/delete 4");

    expect(await run("/confirm_delete")).toBe(messages.DELETE_FAILED_TEXT);
  });

  it("shows usage for a missing id", async () => {
    expect(await run("/delete")).toBe(messages.DELETE_USAGE_TEXT);
  });
});
