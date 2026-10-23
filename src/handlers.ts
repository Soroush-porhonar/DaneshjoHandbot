import { START_TEXT, HELP_TEXT, ABOUT_TEXT } from "./text.js";
import { askAI } from "./llm.js";
import { findOrCreateUser } from "./db/users.js";
import { findOrCreateConversation } from "./db/conversations.js";
import { getRecentMessages, saveMessage } from "./db/messages.js";
import { pool } from "./db/pool.js";
import { answerFromDocuments } from "./rag/answer.js";
import { routeMessage } from "./router.js";
import { downloadBaleDocument, sendMessage } from "./bale.js";
import type { BaleDocument } from "./bale.js";
import { ingestPdf } from "./rag/ingest.js";

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
        const classification = await routeMessage(text, documentNames);

        if (classification.route === "document") {
          answer = await answerFromDocuments(
            userId,
            text,
            classification.retrievalMode,
          );
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

export async function handleDocument(
  chatId: number,
  document: BaleDocument,
): Promise<boolean> {
  try {
    const filename = document.file_name ?? "document.pdf";
    const isPdf =
      filename.toLowerCase().endsWith(".pdf") ||
      document.mime_type === "application/pdf";

    if (!isPdf) {
      await sendMessage(chatId, "لطفاً فایل را با فرمت PDF ارسال کنید.");
      return true;
    }

    if (
      document.file_size !== undefined &&
      document.file_size > 20 * 1024 * 1024
    ) {
      await sendMessage(chatId, "حجم فایل بیشتر از محدودیت ۲۰ مگابایت است.");
      return true;
    }

    await sendMessage(
      chatId,
      "فایل شما دریافت شد. در حال پردازش و آماده‌سازی برای پاسخ‌گویی هستم...",
    );

    const user = await findOrCreateUser(String(chatId));

    const downloaded = await downloadBaleDocument(document);

    const documentId = await ingestPdf(
      user.id,
      downloaded.filename,
      downloaded.filePath,
    );

    await sendMessage(
      chatId,
      `فایل «${downloaded.filename}» با موفقیت پردازش شد.\nشناسه سند: ${documentId}\nاکنون می‌توانید درباره محتوای آن سؤال بپرسید.`,
    );

    return true;
  } catch (error: unknown) {
    console.error("Failed to process PDF document:", error);

    try {
      await sendMessage(
        chatId,
        "پردازش فایل با خطا مواجه شد. لطفاً دوباره تلاش کنید.",
      );
      return true;
    } catch (sendError: unknown) {
      console.error("Failed to send document error message:", sendError);
      return false;
    }
  }
}
