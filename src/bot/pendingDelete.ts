interface PendingDeletion {
  documentId: number;
  createdAt: number;
}

const pendingDeletions = new Map<number, PendingDeletion>();

const CONFIRMATION_TIMEOUT = 60_000; // 1 minute

export function setPendingDeletion(chatId: number, documentId: number): void {
  pendingDeletions.set(chatId, {
    documentId,
    createdAt: Date.now(),
  });
}

export function getPendingDeletion(chatId: number): number | null {
  const pending = pendingDeletions.get(chatId);

  if (!pending) {
    return null;
  }

  if (Date.now() - pending.createdAt > CONFIRMATION_TIMEOUT) {
    pendingDeletions.delete(chatId);
    return null;
  }

  return pending.documentId;
}

export function clearPendingDeletion(chatId: number): void {
  pendingDeletions.delete(chatId);
}
