import { LLM_URL } from "./utils/env.js";
import type { ChatHistoryMessage } from "./db/messages.js";

const MODEL = process.env.OLLAMA_MODEL || "qwen3.5:9b";

interface OllamaResponse {
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

export async function askAI(history: ChatHistoryMessage[]): Promise<string> {
  const response = await fetch(LLM_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(700_000),
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

  const data = (await response.json()) as OllamaResponse;

  if (!data.message?.content) {
    throw new Error("Ollama returned an empty response.");
  }

  return data.message.content;
}
