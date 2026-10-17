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
  let conversationId: number;

  try {
    const user = await findOrCreateUser(String(chatId));
    conversationId = await findOrCreateConversation(user.id);
    await saveMessage(conversationId, "user", text);
  } catch (error: unknown) {
    console.error("Failed to save incoming message:", error);

    try {
      await sendMessage(
        chatId,
        "مشکلی در ذخیره پیام شما پیش آمد. لطفاً دوباره تلاش کنید.",
      );
    } catch (sendError: unknown) {
      console.error("Failed to send database error message:", sendError);
    }

    return;
  }

  let answer: string;

  if (text === "/start") {
    answer = START_TEXT;
  } else if (text === "/help") {
    answer = HELP_TEXT;
  } else if (text === "/about") {
    answer = ABOUT_TEXT;
  } else {
    try {
      const history = await getRecentMessages(conversationId, 10);
      answer = await askAI(history);
    } catch (error: unknown) {
      console.error("AI request failed:", error);

      try {
        await sendMessage(
          chatId,
          "متأسفانه در حال حاضر امکان پاسخ‌گویی وجود ندارد. لطفاً کمی بعد دوباره تلاش کنید.",
        );
      } catch (sendError: unknown) {
        console.error("Failed to send AI error message:", sendError);
      }

      return;
    }
  }

  try {
    await saveMessage(conversationId, "assistant", answer);
  } catch (error: unknown) {
    console.error("Failed to save assistant response:", error);
    // Still attempt to deliver the generated response to the user.
  }

  try {
    await sendMessage(chatId, answer);
  } catch (error: unknown) {
    console.error("Failed to send Bale message:", error);
  }
}
