export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function getDocumentErrorText(error: unknown): string {
  const message = getErrorMessage(error).toLowerCase();

  if (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("aborted")
  ) {
    return "پردازش فایل بیش از حد طول کشید. لطفاً کمی بعد دوباره تلاش کنید.";
  }

  if (
    message.includes("ollama") ||
    message.includes("embedding") ||
    message.includes("connection refused")
  ) {
    return "سرویس هوش مصنوعی در حال حاضر در دسترس نیست. لطفاً کمی بعد دوباره تلاش کنید.";
  }

  if (
    message.includes("pdf") ||
    message.includes("parse") ||
    message.includes("invalid")
  ) {
    return "خواندن فایل PDF با مشکل مواجه شد. لطفاً از سالم بودن فایل مطمئن شوید و دوباره تلاش کنید.";
  }

  return "پردازش فایل با خطا مواجه شد. لطفاً کمی بعد دوباره تلاش کنید.";
}

export function logDatabaseError(
  operation: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  console.error(`Database operation failed: ${operation}`, {
    ...context,
    error,
  });
}
