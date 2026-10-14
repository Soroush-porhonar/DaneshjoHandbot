import { sendMessage } from "./bale.js";
import { GREETING_TEXT } from "./utils/env.js";

const HELP_TEXT = `
Available commands:

/start - Start the study assistant
/help - Show available commands

Soon, you'll be able to upload PDFs and ask questions about your study materials.
`;

export async function handleMessage(
  chatId: number,
  text: string,
): Promise<void> {
  try {
    if (text === "/start") {
      await sendMessage(chatId, GREETING_TEXT);
    } else if (text === "/help") {
      await sendMessage(chatId, HELP_TEXT);
    } else {
      await sendMessage(
        chatId,
        "I didn't recognize that command. Send /help to see what I can do.",
      );
    }
  } catch (error: unknown) {
    console.error("Failed to handle message:", error);
  }
}
