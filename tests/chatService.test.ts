import { beforeEach, describe, expect, it, vi } from "vitest";

// Fakes for the database, Bale and every AI step, so only the flow is tested.
vi.mock("../src/bale.js", () => ({ sendMessage: vi.fn() }));
vi.mock("../src/db/users.js", () => ({ findOrCreateUser: vi.fn() }));
vi.mock("../src/db/conversations.js", () => ({
  findOrCreateConversation: vi.fn(),
  selectDocument: vi.fn(),
  getSelectedDocumentId: vi.fn(),
}));
vi.mock("../src/db/messages.js", () => ({
  saveMessage: vi.fn(),
  getRecentMessages: vi.fn(),
}));
vi.mock("../src/db/documents.js", () => ({
  listCompletedFilenames: vi.fn(),
  listDocuments: vi.fn(),
  findDocumentFilename: vi.fn(),
  deleteDocument: vi.fn(),
}));
vi.mock("../src/db/answerLogs.js", () => ({ createAnswerLog: vi.fn() }));
vi.mock("../src/llm/generalChat.js", () => ({ askAI: vi.fn() }));
vi.mock("../src/rag/answer.js", () => ({
  answerFromDocuments: vi.fn(),
  prefetchCandidates: vi.fn(),
}));
// Keep the real needsRewrite (which messages count as follow-ups); fake the LLM call.
vi.mock("../src/rag/rewrite.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/rag/rewrite.js")>()),
  rewriteQuestion: vi.fn(),
}));
vi.mock("../src/rag/router.js", () => ({ routeMessage: vi.fn() }));

const { handleMessage } = await import("../src/chat/chatService.js");
const { sendMessage } = await import("../src/bale.js");
const { findOrCreateUser } = await import("../src/db/users.js");
const { findOrCreateConversation } = await import("../src/db/conversations.js");
const { saveMessage, getRecentMessages } = await import("../src/db/messages.js");
const { listCompletedFilenames } = await import("../src/db/documents.js");
const { askAI } = await import("../src/llm/generalChat.js");
const { answerFromDocuments, prefetchCandidates } = await import("../src/rag/answer.js");
const { createAnswerLog } = await import("../src/db/answerLogs.js");
const { needsRewrite, rewriteQuestion } = await import("../src/rag/rewrite.js");
const { routeMessage } = await import("../src/rag/router.js");
const { logger } = await import("../src/logger.js");
const messages = await import("../src/messages.js");

const CHAT_ID = 42;
const USER_ID = 3;

const earlier = [
  { role: "user" as const, content: "پریم چیه؟" },
  { role: "assistant" as const, content: "یک الگوریتم درخت پوشا." },
];
const current = { role: "user" as const, content: "مرتبه‌اش چنده؟" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(logger, "error").mockImplementation(() => {});
  vi.spyOn(logger, "info").mockImplementation(() => {});

  vi.mocked(findOrCreateUser).mockResolvedValue({ id: USER_ID } as never);
  vi.mocked(findOrCreateConversation).mockResolvedValue(11);
  // The current message is saved first, so it is the last history entry.
  vi.mocked(getRecentMessages).mockResolvedValue([...earlier, current]);
  vi.mocked(listCompletedFilenames).mockResolvedValue(["Algorithm.pdf"]);
  // Like the real one: only follow-ups are rewritten.
  vi.mocked(rewriteQuestion).mockImplementation(async (text, previous) =>
    needsRewrite(text, previous) ? `بازنویسی: ${text}` : text,
  );
  vi.mocked(answerFromDocuments).mockResolvedValue("جواب از جزوه");
  vi.mocked(askAI).mockResolvedValue("جواب عمومی");
  vi.mocked(createAnswerLog).mockResolvedValue(77);
});

/** The final reply (the last message sent to the user). */
const lastReply = () => vi.mocked(sendMessage).mock.calls.at(-1)?.[1];

describe("handleMessage", () => {
  it("answers document questions from the documents with the rewritten question", async () => {
    vi.mocked(routeMessage).mockResolvedValue({ route: "document", retrievalMode: "focused" });

    await expect(handleMessage(CHAT_ID, current.content)).resolves.toBe(true);

    expect(rewriteQuestion).toHaveBeenCalledWith(current.content, earlier, undefined);
    expect(answerFromDocuments).toHaveBeenCalledWith(
      USER_ID,
      `بازنویسی: ${current.content}`,
      "focused",
      undefined,
      undefined, // a follow-up is not searched before it is rewritten
      expect.any(Object),
    );
    expect(prefetchCandidates).not.toHaveBeenCalled();
    expect(saveMessage).toHaveBeenLastCalledWith(11, "assistant", "جواب از جزوه");
    expect(lastReply()).toBe("جواب از جزوه");
  });

  it("starts searching a standalone question while the router decides", async () => {
    const question = "الگوریتم پریم چطور درخت پوشای کمینه را پیدا می‌کند و مرتبه اجرایی آن چیست؟";
    const early = Promise.resolve({ question, documentId: 5, ranked: [] });
    vi.mocked(prefetchCandidates).mockReturnValue(early);
    vi.mocked(routeMessage).mockResolvedValue({ route: "document", retrievalMode: "focused" });

    await handleMessage(CHAT_ID, question);

    expect(prefetchCandidates).toHaveBeenCalledWith(USER_ID, question);
    expect(answerFromDocuments).toHaveBeenCalledWith(
      USER_ID,
      question,
      "focused",
      undefined,
      early,
      expect.any(Object),
    );
  });

  it("logs a document answer and attaches 👍/👎 buttons to it", async () => {
    vi.mocked(routeMessage).mockResolvedValue({ route: "document", retrievalMode: "focused" });
    vi.mocked(answerFromDocuments).mockImplementation(
      async (_user, _q, _mode, _signal, _prefetch, trace) => {
        trace!.documentId = 5;
        trace!.context = [
          { documentId: 5, filename: "a.pdf", pageNumber: 14, chunkIndex: 13, content: "x", isHit: true },
        ];
        return "جواب از جزوه";
      },
    );

    await handleMessage(CHAT_ID, current.content);

    expect(createAnswerLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        question: current.content,
        rewrittenQuestion: `بازنویسی: ${current.content}`,
        route: "document",
        retrievalMode: "focused",
        documentId: 5,
        context: [{ page: 14, pageEnd: null, chunkIndex: 13, isHit: true }],
        answer: "جواب از جزوه",
        latencyMs: expect.any(Number),
      }),
    );
    expect(vi.mocked(sendMessage).mock.calls.at(-1)?.[2]).toEqual([
      [
        expect.objectContaining({ callback_data: "fb:77:1" }),
        expect.objectContaining({ callback_data: "fb:77:-1" }),
      ],
    ]);
  });

  it("logs chat answers too", async () => {
    vi.mocked(routeMessage).mockResolvedValue({ route: "chat", retrievalMode: "focused" });

    await handleMessage(CHAT_ID, "سلام");

    expect(createAnswerLog).toHaveBeenCalledWith(
      expect.objectContaining({ route: "chat", question: "سلام", context: [] }),
    );
  });

  it("does not log commands or add buttons to them", async () => {
    await handleMessage(CHAT_ID, "/help");

    expect(createAnswerLog).not.toHaveBeenCalled();
    expect(vi.mocked(sendMessage).mock.calls.at(-1)?.[2]).toBeUndefined();
  });

  it("still sends the answer, without buttons, when logging fails", async () => {
    vi.mocked(routeMessage).mockResolvedValue({ route: "chat", retrievalMode: "focused" });
    vi.mocked(createAnswerLog).mockRejectedValue(new Error("db down"));
    vi.spyOn(logger, "warn").mockImplementation(() => {});

    await expect(handleMessage(CHAT_ID, "سلام")).resolves.toBe(true);

    expect(lastReply()).toBe("جواب عمومی");
    expect(vi.mocked(sendMessage).mock.calls.at(-1)?.[2]).toBeUndefined();
  });

  it("ignores the early search when the message is chat", async () => {
    vi.mocked(prefetchCandidates).mockReturnValue(
      Promise.resolve({ question: "x", documentId: 5, ranked: [] }),
    );
    vi.mocked(routeMessage).mockResolvedValue({ route: "chat", retrievalMode: "focused" });

    await handleMessage(CHAT_ID, "سلام، امروز حال و هوای درس خوندن ندارم، چیکار کنم که انگیزه بگیرم؟");

    expect(answerFromDocuments).not.toHaveBeenCalled();
    expect(lastReply()).toBe("جواب عمومی");
  });

  it("gives the router the earlier messages without repeating the current one", async () => {
    vi.mocked(routeMessage).mockResolvedValue({ route: "chat", retrievalMode: "focused" });

    await handleMessage(CHAT_ID, current.content);

    expect(routeMessage).toHaveBeenCalledWith(current.content, ["Algorithm.pdf"], earlier);
  });

  it("uses general chat when the router says chat", async () => {
    vi.mocked(routeMessage).mockResolvedValue({ route: "chat", retrievalMode: "focused" });

    await handleMessage(CHAT_ID, "سلام");

    expect(askAI).toHaveBeenCalled();
    expect(answerFromDocuments).not.toHaveBeenCalled();
    expect(lastReply()).toBe("جواب عمومی");
  });

  it("skips the router when the user has no documents", async () => {
    vi.mocked(listCompletedFilenames).mockResolvedValue([]);

    await handleMessage(CHAT_ID, "سلام");

    expect(routeMessage).not.toHaveBeenCalled();
    expect(askAI).toHaveBeenCalled();
  });

  it("runs commands without calling the AI", async () => {
    await handleMessage(CHAT_ID, "/help");

    expect(routeMessage).not.toHaveBeenCalled();
    expect(lastReply()).toBe(messages.HELP_TEXT);
  });

  it("tells the user when the message could not be saved", async () => {
    vi.mocked(saveMessage).mockRejectedValueOnce(new Error("db down"));

    await expect(handleMessage(CHAT_ID, "سلام")).resolves.toBe(true);

    expect(lastReply()).toBe(messages.SAVE_MESSAGE_FAILED_TEXT);
    expect(routeMessage).not.toHaveBeenCalled();
  });

  it("tells the user when answering fails", async () => {
    vi.mocked(routeMessage).mockRejectedValue(new Error("ollama down"));

    await expect(handleMessage(CHAT_ID, "سؤال")).resolves.toBe(true);

    expect(lastReply()).toBe(messages.PROCESSING_FAILED_TEXT);
  });

  it("stays quiet when the user cancelled the request", async () => {
    const controller = new AbortController();
    vi.mocked(routeMessage).mockImplementation(async () => {
      controller.abort();
      throw new DOMException("aborted", "AbortError");
    });

    await expect(handleMessage(CHAT_ID, "سؤال", controller.signal)).resolves.toBe(true);

    expect(lastReply()).toBe(messages.THINKING_NOTICE_TEXT);
  });

  it("asks for a retry when the answer cannot be delivered", async () => {
    vi.mocked(routeMessage).mockResolvedValue({ route: "chat", retrievalMode: "focused" });
    vi.mocked(sendMessage)
      .mockResolvedValueOnce(undefined) // thinking notice
      .mockRejectedValueOnce(new Error("bale down")); // the answer

    await expect(handleMessage(CHAT_ID, "سلام")).resolves.toBe(false);
  });
});
