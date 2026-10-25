//import { startRequest, finishRequest } from "./cancellation.js";
import { askAI } from "./llm.js";
import { findOrCreateUser } from "./db/users.js";
import { getRecentMessages, saveMessage } from "./db/messages.js";
import { pool } from "./db/pool.js";
import { answerFromDocuments } from "./rag/answer.js";
import { routeMessage } from "./router.js";
import { downloadBaleDocument, sendMessage } from "./bale.js";
import type { BaleDocument } from "./bale.js";
import { ingestPdf } from "./rag/ingest.js";
import { START_TEXT, HELP_TEXT, ABOUT_TEXT } from "./text.js";
import { getErrorMessage, getDocumentErrorText } from "./errors.js";
import { logDatabaseError } from "./errors.js";
import {
  findOrCreateConversation,
  selectDocument,
  getSelectedDocumentId,
} from "./db/conversations.js";
import {
  setPendingDeletion,
  getPendingDeletion,
  clearPendingDeletion,
} from "./pendingDelete.js";

import { deleteDocument } from "./db/documents.js";
export async function handleMessage(
  chatId: number,
  text: string,
  signal?: AbortSignal,
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
    logDatabaseError("save incoming message", error, { chatId });

    try {
      await sendMessage(
        chatId,
        "ذخیره پیام شما با مشکل مواجه شد. لطفاً کمی بعد دوباره تلاش کنید.",
      );
      return true;
    } catch (sendError: unknown) {
      console.error("Failed to notify user about database failure:", {
        chatId,
        error: sendError,
      });
      return false;
    }
  }

  try {
    if (text === "/start") {
      answer = START_TEXT;
    } else if (text === "/help") {
      answer = HELP_TEXT;
    } else if (text === "/about") {
      answer = ABOUT_TEXT;
    } else if (text === "/documents") {
      const result = await pool.query<{
        id: number;
        filename: string;
        status: "pending" | "processing" | "completed" | "failed";
      }>(
        `SELECT id, filename, status
     FROM documents
     WHERE user_id = $1
     ORDER BY created_at DESC, id DESC`,
        [userId],
      );

      if (result.rows.length === 0) {
        answer =
          "هنوز هیچ جزوه‌ای بارگذاری نکرده‌اید.\n\nبرای شروع، یک فایل PDF ارسال کنید.";
      } else {
        const statusText = {
          pending: "در انتظار پردازش",
          processing: "در حال پردازش",
          completed: "آماده مطالعه",
          failed: "پردازش ناموفق",
        } as const;

        const selectedDocumentId = await getSelectedDocumentId(userId);

        const activeDocument = result.rows.find(
          (document) => document.id === selectedDocumentId,
        );

        const activeDocumentText = activeDocument
          ? `📌 **سند فعال**\n` +
            `📄 ${activeDocument.filename}\n` +
            `شناسه: ${activeDocument.id}\n` +
            `وضعیت: ${statusText[activeDocument.status]}`
          : `📌 **سند فعال**\nهنوز سندی انتخاب نشده است.`;

        const documentList = result.rows
          .map(
            (document, index) =>
              `\t${index + 1}. ${document.filename}\n` +
              `\tشناسه: ${document.id}\n` +
              `\tوضعیت: ${statusText[document.status]}`,
          )
          .join("\n\n");

        answer =
          `${activeDocumentText}\n\n` +
          `📚 **فهرست اسناد ذخیره‌شده**\n\n` +
          `${documentList}\n\n` +
          `🔄 **تغییر سند فعال**\n` +
          `اگر می‌خوای به‌جای سند فعلی، از یکی از جزوه‌های قبلی استفاده کنی، شناسه اون رو با دستور زیر وارد کن:\n` +
          `ID /select \n` +
          `مثلاً: 3 /select \n\n` +
          `🗑️ **حذف جزوه**\n` +
          `برای حذف جزوه‌ای که دیگه بهش نیاز نداری، از دستور زیر استفاده کن:\n` +
          `ID /delete \n` +
          `مثلاً: 3 /delete \n\n` +
          `💡 **نکته:** هر PDF جدیدی که با موفقیت پردازش بشه، به‌صورت خودکار سند فعال می‌شه.\n\n`;
      }
    } else if (text.startsWith("/select")) {
      const parts = text.trim().split(/\s+/);
      const documentId = Number(parts[1]);

      if (
        parts.length !== 2 ||
        !Number.isSafeInteger(documentId) ||
        documentId <= 0
      ) {
        answer = "لطفاً شناسه فایل را به شکل زیر وارد کنید:\n/select 1";
      } else {
        const selected = await selectDocument(userId, documentId);

        answer = selected
          ? `فایل شماره ${documentId} برای مطالعه انتخاب شد.`
          : "فایل موردنظر پیدا نشد، پردازش آن کامل نشده یا متعلق به شما نیست. ابتدا /documents را بررسی کنید.";
      }
    } else if (text === "/confirm_delete") {
      const documentId = getPendingDeletion(chatId);

      if (documentId === undefined || documentId === null) {
        answer =
          "درخواست حذف فعالی وجود ندارد. برای شروع، از دستور /delete ID استفاده کن.";
      } else {
        const deleted = await deleteDocument(userId, documentId);
        clearPendingDeletion(chatId);

        answer = deleted
          ? `✅ جزوه با شناسه ${documentId} با موفقیت حذف شد.`
          : "❌ حذف جزوه انجام نشد. ممکن است فایل قبلاً حذف شده باشد یا متعلق به شما نباشد.";
      }
    } else if (text === "/cancel_delete") {
      const documentId = getPendingDeletion(chatId);

      if (documentId === undefined) {
        answer = "درخواست حذف فعالی برای لغو وجود ندارد.";
      } else {
        clearPendingDeletion(chatId);
        answer = "عملیات حذف لغو شد. فایل شما حفظ شده است.";
      }
    } else if (text.startsWith("/delete")) {
      const parts = text.trim().split(/\s+/);
      const documentId = Number(parts[1]);

      if (
        parts.length !== 2 ||
        !Number.isSafeInteger(documentId) ||
        documentId <= 0
      ) {
        answer = "لطفاً شناسه جزوه را به شکل زیر وارد کن:\n/delete 1";
      } else {
        const result = await pool.query<{ filename: string }>(
          `SELECT filename
       FROM documents
       WHERE id = $1 AND user_id = $2`,
          [documentId, userId],
        );

        if (result.rows.length === 0) {
          answer =
            "جزوه موردنظر پیدا نشد یا متعلق به شما نیست. برای دیدن جزوه‌ها از /documents استفاده کن.";
        } else {
          setPendingDeletion(chatId, documentId);

          answer =
            `🗑️ تأیید حذف جزوه\n\n` +
            `نام فایل: ${result.rows[0]?.filename}\n` +
            `شناسه: ${documentId}\n\n` +
            "آیا مطمئنی که می‌خواهی این جزوه را حذف کنی؟\n\n" +
            "برای تأیید، دستور /confirm_delete را بفرست.\n" +
            "برای انصراف، دستور /cancel_delete را بفرست.\n\n" +
            "⚠️ با حذف جزوه، محتوای ذخیره‌شده آن نیز پاک می‌شود.";
        }
      }
    } else {
      await sendMessage(
        chatId,
        "⏳ دارم سؤال تو رو بررسی می‌کنم و پاسخ رو آماده می‌کنم...\n\n" +
          "برای توقف عملیات، دستور /cancel رو بفرست.",
      );

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
        answer = await askAI(history, signal);
      } else {
        const history = await getRecentMessages(conversationId, 10);
        const classification = await routeMessage(text, documentNames, history);

        if (classification.route === "document") {
          answer = await answerFromDocuments(
            userId,
            text,
            classification.retrievalMode,
            signal,
          );
        } else {
          const history = await getRecentMessages(conversationId, 10);
          answer = await askAI(history, signal);
        }
      }
    }
  } catch (error: unknown) {
    if (signal?.aborted) {
      console.log("Request cancelled:", { chatId });
      return true;
    }

    console.error("Failed to handle message:", {
      chatId,
      error,
    });

    try {
      await sendMessage(
        chatId,
        "متأسفم، هنگام پردازش پیام شما مشکلی پیش آمد. لطفاً کمی بعد دوباره تلاش کنید.",
      );
      return true;
    } catch (sendError: unknown) {
      console.error("Failed to send error message:", {
        chatId,
        error: sendError,
      });
      return false;
    }
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
      `✅ فایل PDF با موفقیت پردازش شد و به‌عنوان **سند فعال** انتخاب شد.

از این به بعد می‌تونی مستقیماً سؤالاتت رو درباره همین فایل بپرسی.

📚 **برای مشاهده فایل‌های قبلی یا تغییر سند فعال:**
/documents`,
    );

    return true;
  } catch (error: unknown) {
    console.error("Failed to process PDF document:", {
      chatId,
      errorMessage: getErrorMessage(error),
      error,
    });

    try {
      await sendMessage(chatId, getDocumentErrorText(error));
      return true;
    } catch (sendError: unknown) {
      console.error("Failed to send document error message:", {
        chatId,
        error: sendError,
      });
      return false;
    }
  }
}

export async function handleDocuments(chatId: number): Promise<boolean> {
  try {
    const user = await findOrCreateUser(String(chatId));

    const result = await pool.query<{
      id: number;
      filename: string;
      status: "pending" | "processing" | "completed" | "failed";
      created_at: Date;
    }>(
      `SELECT id, filename, status, created_at
       FROM documents
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC`,
      [user.id],
    );

    if (result.rows.length === 0) {
      await sendMessage(
        chatId,
        "هنوز هیچ جزوه‌ای بارگذاری نکرده‌اید.\n\nبرای شروع، یک فایل PDF ارسال کنید.",
      );
      return true;
    }

    const statusText = {
      pending: "در انتظار پردازش",
      processing: "در حال پردازش",
      completed: "آماده مطالعه",
      failed: "پردازش ناموفق",
    } as const;

    const documentList = result.rows
      .map(
        (document, index) =>
          `${index + 1}. ${document.filename}\n` +
          `   شناسه: ${document.id}\n` +
          `   وضعیت: ${statusText[document.status]}`,
      )
      .join("\n\n");

    await sendMessage(
      chatId,
      `📚 جزوه‌های شما:\n\n${documentList}\n\n` +
        "برای افزودن جزوه جدید، یک فایل PDF ارسال کنید.",
    );

    return true;
  } catch (error: unknown) {
    console.error("Failed to list documents:", error);

    try {
      await sendMessage(
        chatId,
        "دریافت فهرست جزوه‌ها با خطا مواجه شد. لطفاً دوباره تلاش کنید.",
      );
      return true;
    } catch (sendError: unknown) {
      console.error("Failed to send document list error:", sendError);
      return false;
    }
  }
}
