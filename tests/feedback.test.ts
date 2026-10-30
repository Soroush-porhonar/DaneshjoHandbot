import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/bale.js", () => ({
  answerCallbackQuery: vi.fn(),
  removeButtons: vi.fn(),
}));
vi.mock("../src/db/answerLogs.js", () => ({ setFeedback: vi.fn() }));
vi.mock("../src/db/users.js", () => ({ findOrCreateUser: vi.fn() }));

const { feedbackButtons, handleFeedback, parseFeedback } = await import("../src/bot/feedback.js");
const { answerCallbackQuery, removeButtons } = await import("../src/bale.js");
const { setFeedback } = await import("../src/db/answerLogs.js");
const { findOrCreateUser } = await import("../src/db/users.js");
const { logger } = await import("../src/logger.js");
const messages = await import("../src/messages.js");

const press = (data: string | undefined) => ({
  id: "cb1",
  ...(data === undefined ? {} : { data }),
  message: { message_id: 55, chat: { id: 42 } },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findOrCreateUser).mockResolvedValue({ id: 3 } as never);
  vi.mocked(setFeedback).mockResolvedValue(true);
});

describe("feedback buttons", () => {
  it("encode the answer id and the vote, within Bale's 64-byte limit", () => {
    const [good, bad] = feedbackButtons(123456)[0]!;

    expect(good!.callback_data).toBe("fb:123456:1");
    expect(bad!.callback_data).toBe("fb:123456:-1");
    expect(Buffer.byteLength(bad!.callback_data)).toBeLessThanOrEqual(64);
  });

  it.each([
    ["fb:7:1", { logId: 7, feedback: 1 }],
    ["fb:7:-1", { logId: 7, feedback: -1 }],
    ["fb:7:2", null],
    ["fb:x:1", null],
    ["something else", null],
    [undefined, null],
  ])("parse %s", (data, expected) => {
    expect(parseFeedback(data)).toEqual(expected);
  });
});

describe("handleFeedback", () => {
  it("saves a 👍 for the user's own answer, thanks them and removes the buttons", async () => {
    await handleFeedback(press("fb:7:1"));

    expect(findOrCreateUser).toHaveBeenCalledWith("42");
    expect(setFeedback).toHaveBeenCalledWith(7, 3, 1);
    expect(answerCallbackQuery).toHaveBeenCalledWith("cb1", messages.FEEDBACK_THANKS_TEXT);
    expect(removeButtons).toHaveBeenCalledWith(42, 55);
  });

  it("answers a 👎 differently", async () => {
    await handleFeedback(press("fb:7:-1"));

    expect(answerCallbackQuery).toHaveBeenCalledWith("cb1", messages.FEEDBACK_SORRY_TEXT);
  });

  it("does not accept a vote on someone else's answer", async () => {
    vi.mocked(setFeedback).mockResolvedValue(false);

    await handleFeedback(press("fb:7:1"));

    expect(answerCallbackQuery).toHaveBeenCalledWith("cb1", messages.FEEDBACK_FAILED_TEXT);
    expect(removeButtons).not.toHaveBeenCalled();
  });

  it("always acknowledges unknown button data, so the button does not hang", async () => {
    await handleFeedback(press("nonsense"));

    expect(setFeedback).not.toHaveBeenCalled();
    expect(answerCallbackQuery).toHaveBeenCalledWith("cb1");
  });

  it("still succeeds when the buttons cannot be removed", async () => {
    vi.mocked(removeButtons).mockRejectedValue(new Error("too old"));
    vi.spyOn(logger, "warn").mockImplementation(() => {});

    await expect(handleFeedback(press("fb:7:1"))).resolves.toBeUndefined();
    expect(setFeedback).toHaveBeenCalled();
  });
});
