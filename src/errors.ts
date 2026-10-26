import { logger } from "./logger.js";

/** The Ollama service failed, was unreachable, or returned bad data. */
export class OllamaError extends Error {
  override name = "OllamaError";
}

export class OllamaTimeoutError extends OllamaError {
  override name = "OllamaTimeoutError";
}

/** The PDF could not be read or contained no usable text. */
export class PdfExtractError extends Error {
  override name = "PdfExtractError";
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isTimeoutOrAbort(error: unknown): boolean {
  return (
    error instanceof OllamaTimeoutError ||
    (error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError"))
  );
}

export function getDocumentErrorText(error: unknown): string {
  if (isTimeoutOrAbort(error)) {
    return "پردازش فایل بیش از حد طول کشید. لطفاً کمی بعد دوباره تلاش کنید.";
  }

  if (error instanceof OllamaError || getErrorMessage(error).includes("ECONNREFUSED")) {
    return "سرویس هوش مصنوعی در حال حاضر در دسترس نیست. لطفاً کمی بعد دوباره تلاش کنید.";
  }

  if (error instanceof PdfExtractError) {
    return "خواندن فایل PDF با مشکل مواجه شد. لطفاً از سالم بودن فایل مطمئن شوید و دوباره تلاش کنید.";
  }

  return "پردازش فایل با خطا مواجه شد. لطفاً کمی بعد دوباره تلاش کنید.";
}

export function logDatabaseError(
  operation: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  logger.error(`Database operation failed: ${operation}`, {
    ...context,
    error,
  });
}
