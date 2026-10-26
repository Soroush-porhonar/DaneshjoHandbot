import { downloadBaleDocument, sendMessage } from "../bale.js";
import type { BaleDocument } from "../bale.js";
import {
  fileProcessedText,
  FILE_RECEIVED_TEXT,
  FILE_TOO_LARGE_TEXT,
  NOT_A_PDF_TEXT,
  ocrProgressText,
  ocrStartedText,
} from "../bot/messages.js";
import { config } from "../config.js";
import { findOrCreateUser } from "../db/users.js";
import { getDocumentErrorText, getErrorMessage } from "../errors.js";
import { logger } from "../logger.js";
import { ingestPdf } from "../rag/ingest.js";

function isPdf(document: BaleDocument, filename: string): boolean {
  return (
    filename.toLowerCase().endsWith(".pdf") ||
    document.mime_type === "application/pdf"
  );
}

/**
 * Downloads and ingests an uploaded PDF.
 * Returns false when the update should be retried.
 */
export async function handleDocument(
  chatId: number,
  document: BaleDocument,
): Promise<boolean> {
  try {
    const filename = document.file_name ?? "document.pdf";

    if (!isPdf(document, filename)) {
      await sendMessage(chatId, NOT_A_PDF_TEXT);
      return true;
    }

    if (
      document.file_size !== undefined &&
      document.file_size > config.bale.maxFileSize
    ) {
      await sendMessage(chatId, FILE_TOO_LARGE_TEXT);
      return true;
    }

    await sendMessage(chatId, FILE_RECEIVED_TEXT);

    const user = await findOrCreateUser(String(chatId));
    const downloaded = await downloadBaleDocument(document);

    const result = await ingestPdf(
      user.id,
      downloaded.filename,
      downloaded.filePath,
      async ({ ocrDone, ocrTotal, skipped }) => {
        await sendMessage(
          chatId,
          ocrDone === 0
            ? ocrStartedText(ocrTotal, skipped)
            : ocrProgressText(ocrDone, ocrTotal),
        );
      },
    );

    await sendMessage(chatId, fileProcessedText(result.ocrPages));

    return true;
  } catch (error: unknown) {
    logger.error("Failed to process PDF document:", {
      chatId,
      errorMessage: getErrorMessage(error),
      error,
    });

    try {
      await sendMessage(chatId, getDocumentErrorText(error));
      return true;
    } catch (sendError: unknown) {
      logger.error("Failed to send document error message:", {
        chatId,
        error: sendError,
      });
      return false;
    }
  }
}
