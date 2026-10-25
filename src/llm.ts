import { LLM_MODEL, LLM_URL } from "./utils/env.js";
import type { ChatHistoryMessage } from "./db/messages.js";

const MODEL = LLM_MODEL;

interface OllamaResponse {
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

export async function askAI(
  history: ChatHistoryMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(LLM_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(120_000)])
      : AbortSignal.timeout(120_000),
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "تو یک دستیار هوشمند تحصیلی هستی. به سؤالات دانشجویان دقیق، واضح و دوستانه پاسخ بده. در صورت امکان، به زبان خود دانشجو پاسخ بده. برای ارجاع به منابع، فقط از نام فایل و شماره صفحه PDF درج‌شده در متن منابع استفاده کن.شماره صفحه یا منبع جدیدی اختراع نکن.",
        },
        ...history,
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Ollama API error: ${response.status} ${response.statusText}`,
    );
  }

  let data: OllamaResponse;

  try {
    data = (await response.json()) as OllamaResponse;
  } catch {
    throw new Error("Ollama returned an invalid JSON response.");
  }

  if (
    typeof data.message?.content !== "string" ||
    data.message.content.trim().length === 0
  ) {
    console.error("[LLM] Empty response details:", {
      response: data,
      model: MODEL,
      stream: false,
      num_ctx: 16384,
      num_predict: 8192,
      historyLength: history.length,
      lastMessage: history.at(-1),
    });

    throw new Error("Ollama returned an empty or invalid response.");
  }

  return data.message.content;
}
