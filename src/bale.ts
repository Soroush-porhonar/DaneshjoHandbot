import "dotenv/config";
import { BALE_TOKEN } from "./utils/env.js";

const BASE_URL = `https://tapi.bale.ai/bot${BALE_TOKEN}`;

export interface BaleUpdate {
  update_id: number;
  message?: {
    chat: {
      id: number;
    };
    text?: string;
  };
}

interface BaleResponse<T> {
  ok: boolean;
  result: T;
  description?: string;
}

async function callBale<T>(
  method: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${BASE_URL}/${method}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = (await response.json()) as BaleResponse<T>;

  if (!response.ok || !data.ok) {
    throw new Error(
      data.description ?? `Bale API error: HTTP ${response.status}`,
    );
  }

  return data.result;
}

export async function sendMessage(chatId: number, text: string): Promise<void> {
  await callBale("sendMessage", {
    chat_id: chatId,
    text,
  });
}

export async function getUpdates(offset?: number): Promise<BaleUpdate[]> {
  const query = offset === undefined ? "" : `?offset=${offset}`;

  return callBale<BaleUpdate[]>("getUpdates" + query);
}
