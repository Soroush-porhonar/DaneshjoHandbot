import { sendMessage } from "./bale.js";
import { START_TEXT, HELP_TEXT, ABOUT_TEXT } from "./text.js";
import { askAI } from "./llm.js";
import { findOrCreateUser } from "./db/users.js";
import { findOrCreateConversation } from "./db/conversations.js";
import { getRecentMessages, saveMessage } from "./db/messages.js";
import { pool } from "./db/pool.js";
import { answerFromDocuments } from "./rag/answer.js";
import { routeMessage } from "./router.js";

export async function handleMessage(
  chatId: number,
  text: string,
): Promise<boolean> {
  let conversationId: number;
  let answer: string;
  let userId: number;
  try {
    const user = await findOrCreateUser(String(chatId));
    userId = user.id;
    conversationId = await findOrCreateConversation(userId);
    await saveMessage(conversationId, "user", text);
  } catch (error: unknown) {
    console.error("Failed to save incoming message:", error);
    return false;
  }

  try {
    if (text === "/start") {
      answer = START_TEXT;
    } else if (text === "/help") {
      answer = HELP_TEXT;
    } else if (text === "/about") {
      answer = ABOUT_TEXT;
    } else {
      const documentsResult = await pool.query<{ filename: string }>(
        `SELECT DISTINCT filename
   FROM documents
   WHERE user_id = $1
     AND status = 'completed'`,
        [userId],
      );

      const documentNames = documentsResult.rows.map(
        (document) => document.filename,
      );

      if (documentNames.length === 0) {
        const history = await getRecentMessages(conversationId, 10);
        answer = await askAI(history);
      } else {
        const route = await routeMessage(text, documentNames);
        console.log("Message routing:", {
          text,
          route,
          availableDocuments: documentNames,
        });
        if (route === "document") {
          answer = await answerFromDocuments(userId, text);
        } else {
          const history = await getRecentMessages(conversationId, 10);
          answer = await askAI(history);
        }
      }
    }
  } catch (error: unknown) {
    console.error("Failed to generate answer:", error);
    return false;
  }

  try {
    await saveMessage(conversationId, "assistant", answer);
  } catch (error: unknown) {
    console.error("Failed to save assistant response:", error);
    return false;
  }

  try {
    await sendMessage(chatId, answer);
    return true;
  } catch (error: unknown) {
    console.error("Failed to send Bale message:", error);
    return false;
  }
}
