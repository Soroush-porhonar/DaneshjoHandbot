const activeRequests = new Map<number, AbortController>();

export function startRequest(chatId: number): AbortController {
  // Cancel any previous request for this chat.
  activeRequests.get(chatId)?.abort();

  const controller = new AbortController();
  activeRequests.set(chatId, controller);

  return controller;
}

export function cancelRequest(chatId: number): boolean {
  const controller = activeRequests.get(chatId);

  if (!controller) {
    return false;
  }

  controller.abort();
  activeRequests.delete(chatId);
  return true;
}

export function finishRequest(
  chatId: number,
  controller: AbortController,
): void {
  // Don't remove a newer request that replaced this one.
  if (activeRequests.get(chatId) === controller) {
    activeRequests.delete(chatId);
  }
}
