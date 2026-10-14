import "dotenv/config";
import express from "express";
import { getUpdates } from "./bale.js";
import { handleMessage } from "./handlers.js";

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
      console.dir(updates, { depth: null });
      for (const update of updates) {
        offset = update.update_id + 1;

        const message = update.message;

        if (!message?.text) continue;

        await handleMessage(message.chat.id, message.text);
      }
    } catch (error) {
      console.error("Error receiving or handling messages:", error);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

main();
