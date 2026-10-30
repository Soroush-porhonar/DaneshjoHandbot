import { sendMessage } from "../bale.js";
import { parseCommand } from "../bot/commands/index.js";
import {
  PROCESSING_FAILED_TEXT,
  SAVE_MESSAGE_FAILED_TEXT,
  THINKING_NOTICE_TEXT,
} from "../messages.js";
import { config } from "../config.js";
import { findOrCreateConversation } from "../db/conversations.js";
import { listCompletedFilenames } from "../db/documents.js";
import { getRecentMessages, saveMessage } from "../db/messages.js";
import { findOrCreateUser } from "../db/users.js";
import { logDatabaseError } from "../errors.js";
import { askAI } from "../llm/generalChat.js";
import { logger } from "../logger.js";
import { answerFromDocuments, prefetchCandidates } from "../rag/answer.js";
import type { AnswerTrace } from "../rag/answer.js";
import { createAnswerLog } from "../db/answerLogs.js";
import type { NewAnswerLog } from "../db/answerLogs.js";
import { feedbackButtons } from "../bot/feedback.js";
import { needsRewrite, rewriteQuestion } from "../rag/rewrite.js";
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

type AnswerLogInfo = Omit<NewAnswerLog, "userId" | "answer" | "latencyMs">;

/** A reply, plus what to record about it when it answered a question. */
interface Reply {
  answer: string;
  log?: AnswerLogInfo;
}

const chatLog = (question: string): AnswerLogInfo => ({
  question,
  rewrittenQuestion: null,
  route: "chat",
  retrievalMode: null,
  documentId: null,
  context: [],
});

/** Answers a plain-text message, using documents when the router says so. */
async function answerQuestion(
  chatId: number,
  { userId, conversationId }: Session,
  text: string,
  signal?: AbortSignal,
): Promise<Reply> {
  await sendMessage(chatId, THINKING_NOTICE_TEXT);

  const documentNames = await listCompletedFilenames(userId);
  const history = await getRecentMessages(
    conversationId,
    config.rag.historyLimit,
  );

  if (documentNames.length === 0) {
    return { answer: await askAI(history, signal), log: chatLog(text) };
  }

  // The current message is already saved, so it is the last history entry.
  const previous = history.slice(0, -1);

  // A standalone question can be searched while the router decides (saves the
  // search time). Follow-ups are searched only after they are rewritten.
  const prefetch = needsRewrite(text, previous)
    ? undefined
    : prefetchCandidates(userId, text);
  const classification = await routeMessage(text, documentNames, previous);

  if (classification.route === "document") {
    const question = await rewriteQuestion(text, previous, signal);
    const trace: AnswerTrace = {};
    const answer = await answerFromDocuments(
      userId,
      question,
      classification.retrievalMode,
      signal,
      prefetch,
      trace,
    );

    return {
      answer,
      log: {
        question: text,
        rewrittenQuestion: question === text ? null : question,
        route: "document",
        retrievalMode: classification.retrievalMode,
        documentId: trace.documentId ?? null,
        context: (trace.context ?? []).map((chunk) => ({
          page: chunk.pageNumber,
          pageEnd: chunk.pageEnd ?? null,
          chunkIndex: chunk.chunkIndex,
          isHit: chunk.isHit,
        })),
      },
    };
  }

  return { answer: await askAI(history, signal), log: chatLog(text) };
}

/** Records an answer for review; returns its id, or null if logging failed (never blocks the reply). */
async function logAnswer(userId: number, reply: Reply, latencyMs: number): Promise<number | null> {
  if (!reply.log) return null;

  try {
    return await createAnswerLog({ ...reply.log, userId, answer: reply.answer, latencyMs });
  } catch (error: unknown) {
    logger.warn("Failed to log answer:", error);
    return null;
  }
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

  let reply: Reply;
  const started = Date.now();

  try {
    const command = parseCommand(text);

    reply = command
      ? {
          answer: await command.handler({
            chatId,
            userId: session.userId,
            args: command.args,
          }),
        }
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
    await saveMessage(session.conversationId, "assistant", reply.answer);
  } catch (error: unknown) {
    logger.error("Failed to save assistant response:", error);
    return false;
  }

  // Answers to questions get 👍/👎 buttons; commands and errors do not.
  const logId = await logAnswer(session.userId, reply, Date.now() - started);

  try {
    await sendMessage(chatId, reply.answer, logId === null ? undefined : feedbackButtons(logId));
    return true;
  } catch (error: unknown) {
    logger.error("Failed to send Bale message:", error);
    return false;
  }
}
