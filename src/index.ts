import "dotenv/config";
import express from "express";
import { getUpdates } from "./bale.js";
import { handleMessage } from "./handlers.js";
import { isUpdateProcessed, markUpdateProcessed } from "./db/updates.js";
const app = express();
const port = Number(process.env.PORT) || 3000;

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

          if (message?.text) {
            await handleMessage(message.chat.id, message.text);
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
