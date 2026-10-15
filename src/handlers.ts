import { sendMessage } from "./bale.js";
import { START_TEXT, HELP_TEXT, ABOUT_TEXT } from "./text.js";
import { askAI } from "./llm.js";

export async function handleMessage(
  chatId: number,
  text: string,
): Promise<void> {
  try {
    if (text === "/start") {
      await sendMessage(chatId, START_TEXT);
    } else if (text === "/help") {
      await sendMessage(chatId, HELP_TEXT);
    } else if (text === "/about") {
      await sendMessage(chatId, ABOUT_TEXT);
    } else {
      const answer = await askAI(text);
      await sendMessage(chatId, answer);
    }
  } catch (error: unknown) {
    console.error("Failed to handle message:", error);
  }
}
