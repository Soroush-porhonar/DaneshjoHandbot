import { sendMessage } from "./bale.js";
import { START_TEXT, HELP_TEXT, ABOUT_TEXT } from "./text.js";
import { askAI } from "./llm.js";
import { findOrCreateUser } from "./db/users.js";
import { findOrCreateConversation } from "./db/conversations.js";

import { getRecentMessages, saveMessage } from "./db/messages.js";
export async function handleMessage(
  chatId: number,
  text: string,
): Promise<void> {
  try {
    const user = await findOrCreateUser(String(chatId));
    const conversationId = await findOrCreateConversation(user.id);

    // Save the incoming message.
    await saveMessage(conversationId, "user", text);

    let answer: string;

    if (text === "/start") {
      answer = START_TEXT;
    } else if (text === "/help") {
      answer = HELP_TEXT;
    } else if (text === "/about") {
      answer = ABOUT_TEXT;
    } else {
      const history = await getRecentMessages(conversationId, 10);
      answer = await askAI(history);
    }

    // Save the reply before sending it to Bale.
    await saveMessage(conversationId, "assistant", answer);
    await sendMessage(chatId, answer);
  } catch (error: unknown) {
    console.error("Failed to handle message:", error);
  }
}
