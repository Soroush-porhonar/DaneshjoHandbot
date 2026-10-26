import { getUpdates } from "../bale.js";
import { logger } from "../logger.js";
import { dispatchUpdate } from "./dispatcher.js";

const ERROR_BACKOFF_MS = 3000;

export async function startPolling(): Promise<never> {
  let offset = 0;

  logger.info("Bale bot is starting...");

  while (true) {
    try {
      const updates = await getUpdates(offset);

      for (const update of updates) {
        logger.info("Received update:", update.update_id);

        try {
          await dispatchUpdate(update);
          offset = update.update_id + 1;
        } catch (error: unknown) {
          logger.error("Failed to dispatch update:", {
            updateId: update.update_id,
            error,
          });

          // Stop this batch here. The next poll can retry this update.
          break;
        }
      }
    } catch (error: unknown) {
      logger.error("Error receiving or handling messages:", error);
      await new Promise((resolve) => setTimeout(resolve, ERROR_BACKOFF_MS));
    }
  }
}
