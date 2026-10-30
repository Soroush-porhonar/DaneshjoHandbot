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
const { selectDocument } = await import("../src/db/conversations.js");
const { deleteDocument, findDocumentFilename, listDocuments } = await import(
  "../src/db/documents.js"
);
const { clearPendingDeletion } = await import("../src/bot/pendingDelete.js");
const messages = await import("../src/messages.js");

const CHAT_ID = 5;
const USER_ID = 8;

/** Runs a command exactly like a user typing it. */
async function run(text: string): Promise<string> {
  const command = parseCommand(text);
  if (!command) throw new Error(`not a command: ${text}`);
  return command.handler({ chatId: CHAT_ID, userId: USER_ID, args: command.args });
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
  it("asks for confirmation before deleting anything", async () => {
    expect(await run("/delete 4")).toBe(messages.deleteConfirmationText("notes.pdf", 4));
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
