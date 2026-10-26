import { sendMessage } from "../bale.js";
import { parseCommand } from "../bot/commands/index.js";
import {
  PROCESSING_FAILED_TEXT,
  SAVE_MESSAGE_FAILED_TEXT,
  THINKING_NOTICE_TEXT,
} from "../bot/messages.js";
import { config } from "../config.js";
import { findOrCreateConversation } from "../db/conversations.js";
import { listCompletedFilenames } from "../db/documents.js";
import { getRecentMessages, saveMessage } from "../db/messages.js";
import { findOrCreateUser } from "../db/users.js";
import { logDatabaseError } from "../errors.js";
import { askAI } from "../llm/generalChat.js";
import { logger } from "../logger.js";
import { answerFromDocuments } from "../rag/answer.js";
import { routeMessage } from "../rag/router.js";

interface Session {
  userId: number;
  conversationId: number;
}

/** Sends a best-effort notice; returns false if even that failed. */
async function notify(chatId: number, text: string): Promise<boolean> {
  try {
    await sendMessage(chatId, text);
    return true;
  } catch (error: unknown) {
    logger.error("Failed to notify user:", { chatId, error });
    return false;
  }
}

/** Answers a plain-text message, using documents when the router says so. */
async function answerQuestion(
  chatId: number,
  { userId, conversationId }: Session,
  text: string,
  signal?: AbortSignal,
): Promise<string> {
  await sendMessage(chatId, THINKING_NOTICE_TEXT);

  const documentNames = await listCompletedFilenames(userId);
  const history = await getRecentMessages(
    conversationId,
    config.rag.historyLimit,
  );

  if (documentNames.length === 0) {
    return askAI(history, signal);
  }

  const classification = await routeMessage(text, documentNames, history);

  if (classification.route === "document") {
    return answerFromDocuments(
      userId,
      text,
      classification.retrievalMode,
      signal,
    );
  }

  return askAI(history, signal);
}

/**
 * Handles one incoming text message end to end.
 * Returns false when the update should be retried.
 */
export async function handleMessage(
  chatId: number,
  text: string,
  signal?: AbortSignal,
): Promise<boolean> {
  let session: Session;

  try {
    const user = await findOrCreateUser(String(chatId));
    const conversationId = await findOrCreateConversation(user.id);
    await saveMessage(conversationId, "user", text);
    session = { userId: user.id, conversationId };
  } catch (error: unknown) {
    logDatabaseError("save incoming message", error, { chatId });
    return notify(chatId, SAVE_MESSAGE_FAILED_TEXT);
  }

  let answer: string;

  try {
    const command = parseCommand(text);

    answer = command
      ? await command.handler({
          chatId,
          userId: session.userId,
          args: command.args,
        })
      : await answerQuestion(chatId, session, text, signal);
  } catch (error: unknown) {
    if (signal?.aborted) {
      logger.info("Request cancelled:", { chatId });
      return true;
    }

    logger.error("Failed to handle message:", { chatId, error });
    return notify(chatId, PROCESSING_FAILED_TEXT);
  }

  try {
    await saveMessage(session.conversationId, "assistant", answer);
  } catch (error: unknown) {
    logger.error("Failed to save assistant response:", error);
    return false;
  }

  try {
    await sendMessage(chatId, answer);
    return true;
  } catch (error: unknown) {
    logger.error("Failed to send Bale message:", error);
    return false;
  }
}
