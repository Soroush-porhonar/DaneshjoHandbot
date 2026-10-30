import { answerCallbackQuery, removeButtons } from "../bale.js";
import type { BaleUpdate, InlineButton } from "../bale.js";
import { setFeedback } from "../db/answerLogs.js";
import type { Feedback } from "../db/answerLogs.js";
import { findOrCreateUser } from "../db/users.js";
import { logger } from "../logger.js";
import {
  FEEDBACK_BAD_BUTTON,
  FEEDBACK_FAILED_TEXT,
  FEEDBACK_GOOD_BUTTON,
  FEEDBACK_SORRY_TEXT,
  FEEDBACK_THANKS_TEXT,
} from "../messages.js";

type CallbackQuery = NonNullable<BaleUpdate["callback_query"]>;

/** 👍/👎 buttons for an answer; the callback data is "fb:<log id>:<1|-1>". */
export function feedbackButtons(logId: number): InlineButton[][] {
  return [
    [
      { text: FEEDBACK_GOOD_BUTTON, callback_data: `fb:${logId}:1` },
      { text: FEEDBACK_BAD_BUTTON, callback_data: `fb:${logId}:-1` },
    ],
  ];
}

export function parseFeedback(data: string | undefined): { logId: number; feedback: Feedback } | null {
  const match = /^fb:(\d+):(1|-1)$/.exec(data ?? "");

  if (!match) return null;

  return { logId: Number(match[1]), feedback: Number(match[2]) as Feedback };
}

/**
 * Stores a 👍/👎 press. Only the user who received the answer can rate it.
 * The press is always acknowledged, otherwise Bale keeps the button loading.
 */
export async function handleFeedback(query: CallbackQuery): Promise<void> {
  const parsed = parseFeedback(query.data);
  const chatId = query.message?.chat.id;

  if (!parsed || chatId === undefined) {
    await answerCallbackQuery(query.id);
    return;
  }

  const user = await findOrCreateUser(String(chatId));
  const saved = await setFeedback(parsed.logId, user.id, parsed.feedback);

  await answerCallbackQuery(
    query.id,
    !saved ? FEEDBACK_FAILED_TEXT : parsed.feedback === 1 ? FEEDBACK_THANKS_TEXT : FEEDBACK_SORRY_TEXT,
  );

  if (saved && query.message) {
    // One vote per answer: hide the buttons. Not critical if it fails.
    try {
      await removeButtons(chatId, query.message.message_id);
    } catch (error: unknown) {
      logger.warn("Could not remove feedback buttons:", error);
    }
  }
}
