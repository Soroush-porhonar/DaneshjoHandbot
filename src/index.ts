import "dotenv/config";
import express from "express";
import { getUpdates } from "./bale.js";
import { isUpdateProcessed, markUpdateProcessed } from "./db/updates.js";
import { handleMessage, handleDocument, handleDocuments } from "./handlers.js";
import { startRequest, cancelRequest, finishRequest } from "./cancellation.js";
import { sendMessage } from "./bale.js";

const app = express();
const port = Number(process.env.PORT);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "daneshjohandbot",
  });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

async function main(): Promise<void> {
  let offset = 0;

  console.log("Bale bot is starting...");

  while (true) {
    try {
      const updates = await getUpdates(offset);

      for (const update of updates) {
        console.log("Received update:", update.update_id);

        try {
          if (await isUpdateProcessed(update.update_id)) {
            console.log("Skipping already processed update:", update.update_id);
            offset = update.update_id + 1;
            continue;
          }

          const message = update.message;

          if (message?.document) {
            const succeeded = await handleDocument(
              message.chat.id,
              message.document,
            );

            if (!succeeded) {
              console.error("Update handling failed:", update.update_id);
              break;
            }
          } else if (message?.text) {
            const chatId = message.chat.id;
            const text = message.text.trim();

            if (text === "/cancel") {
              const cancelled = cancelRequest(chatId);

              await sendMessage(
                chatId,
                cancelled
                  ? "درخواست لغو شد."
                  : "در حال حاضر درخواست فعالی برای لغو وجود ندارد.",
              );
            } else {
              const controller = startRequest(chatId);

              void (async () => {
                try {
                  const succeeded = await handleMessage(
                    chatId,
                    text,
                    controller.signal,
                  );

                  if (!succeeded) {
                    console.error("Update handling failed:", update.update_id);
                  } else {
                    await markUpdateProcessed(update.update_id);
                  }
                } catch (error) {
                  console.error(
                    "Failed to process update:",
                    update.update_id,
                    error,
                  );
                } finally {
                  finishRequest(chatId, controller);
                }
              })();
            }

            if (text === "/cancel") {
              await markUpdateProcessed(update.update_id);
            }
          }

          // Record completion only after the handler returns.
          await markUpdateProcessed(update.update_id);

          offset = update.update_id + 1;
        } catch (error: unknown) {
          console.error("Failed to process update:", update.update_id, error);

          // Stop this batch here. The next poll can retry this update.
          break;
        }
      }
    } catch (error) {
      console.error("Error receiving or handling messages:", error);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

main();
