import { sendMessage } from "../bale.js";
import type { BaleUpdate } from "../bale.js";
import { handleMessage } from "../chat/chatService.js";
import { handleDocument } from "../chat/documentUpload.js";
import { isUpdateProcessed, markUpdateProcessed } from "../db/updates.js";
import { logger } from "../logger.js";
import { cancelRequest, finishRequest, startRequest } from "./cancellation.js";
import { handleFeedback } from "./feedback.js";
import { NO_REQUEST_TO_CANCEL_TEXT, REQUEST_CANCELLED_TEXT } from "../messages.js";

/**
 * Runs slow work (LLM calls, PDF ingestion) without blocking the polling loop,
 * and records the update as processed only if the work succeeded.
 */
function runInBackground(
  updateId: number,
  work: () => Promise<boolean>,
  cleanup?: () => void,
): void {
  void (async () => {
    try {
      if (await work()) {
        await markUpdateProcessed(updateId);
      } else {
        logger.error("Update handling failed:", updateId);
      }
    } catch (error: unknown) {
      logger.error("Failed to process update:", { updateId, error });
    } finally {
      cleanup?.();
    }
  })();
}

/**
 * Routes one update to the right handler. Throws if the update could not even
 * be dispatched, so the poller can stop the batch.
 */
export async function dispatchUpdate(update: BaleUpdate): Promise<void> {
  if (await isUpdateProcessed(update.update_id)) {
    logger.info("Skipping already processed update:", update.update_id);
    return;
  }

  if (update.callback_query) {
    // A 👍/👎 press: quick, so it is handled right away.
    await handleFeedback(update.callback_query);
    await markUpdateProcessed(update.update_id);
    return;
  }

  const message = update.message;

  if (message?.document) {
    const { chat, document } = message;
    runInBackground(update.update_id, () => handleDocument(chat.id, document));
    return;
  }

  if (message?.text) {
    const chatId = message.chat.id;
    const text = message.text.trim();

    if (text === "/cancel") {
      const cancelled = cancelRequest(chatId);

      await sendMessage(
        chatId,
        cancelled ? REQUEST_CANCELLED_TEXT : NO_REQUEST_TO_CANCEL_TEXT,
      );
      await markUpdateProcessed(update.update_id);
      return;
    }

    const controller = startRequest(chatId);

    runInBackground(
      update.update_id,
      () => handleMessage(chatId, text, controller.signal),
      () => finishRequest(chatId, controller),
    );
    return;
  }

  // Nothing we handle (stickers, edits, ...): acknowledge so it isn't replayed.
  await markUpdateProcessed(update.update_id);
}
