import type { ChatHistoryMessage } from "../db/messages.js";
import { chat } from "./ollamaClient.js";
import { CHAT_SYSTEM_PROMPT } from "./prompts/chat.js";

/** Answers a general (non-document) question using the recent conversation. */
export async function askAI(
  history: ChatHistoryMessage[],
  signal?: AbortSignal,
): Promise<string> {
  return chat({
    messages: [{ role: "system", content: CHAT_SYSTEM_PROMPT }, ...history],
    signal,
  });
}
