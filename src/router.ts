import { LLM_URL } from "./utils/env.js";

const MODEL = process.env.OLLAMA_MODEL || "qwen3.5:9b";

export type MessageRoute = "document" | "chat";

export type RetrievalMode = "focused" | "multi_part" | "broad";

export interface MessageClassification {
  route: MessageRoute;
  retrievalMode: RetrievalMode;
}

interface RouterResponse {
  message?: {
    content?: string;
  };
  done_reason?: string;
}

export async function routeMessage(
  text: string,
  documentNames: string[],
): Promise<MessageClassification> {
  const response = await fetch(LLM_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      think: false,
      format: {
  type: "object",
  properties: {
    route: {
      type: "string",
      enum: ["document", "chat"],
    },
    retrievalMode: {
      type: "string",
      enum: ["focused", "multi_part", "broad"],
    },
  },
  required: ["route", "retrievalMode"],
  additionalProperties: false,
},
      options: {
        num_predict: 64,
      },
      messages: [
        {
          role: "system",
          content: `
تو دسته‌بند پیام‌های یک دستیار تحصیلی هستی.
فقط باید مسیر مناسب پیام را انتخاب کنی؛ به سؤال کاربر پاسخ نده.

مسیر document:
- سؤال درباره مطالب درسی که ممکن است در فایل‌های آموزشی موجود باشند.
- توضیح یک مفهوم درسی، مثل معماری پایگاه داده.
- خلاصه‌کردن فصل یا جزوه.
- استخراج نکات مهم از فایل‌های آموزشی.

مسیر chat:
- سلام و احوال‌پرسی و گفت‌وگوی عادی.
- سرگرمی و سؤال‌های عمومی نامرتبط با فایل‌های آموزشی.

انتخاب retrievalMode برای پیام‌های document:

- focused:
  سؤال کوتاه و مشخص درباره یک مفهوم یا تعریف واحد.
  مثال: «دادگان چیست؟»

- multi_part:
  سؤال شامل چند بخش مشخص یا درخواست توضیح چند مفهوم مرتبط.
  مثال: «معماری پایگاه داده چیست و چه مدل‌هایی دارد؟»

- broad:
  درخواست خلاصه‌سازی فصل، استخراج مهم‌ترین مفاهیم،
  مرور کلی یک جزوه یا پوشش گسترده مطالب یک فایل.
  مثال: «مهم‌ترین مفاهیم این فصل چیست؟»

برای پیام‌های chat مقدار focused را انتخاب کن.
اگر کاربر درباره یک مفهوم درسی سؤال دارد، حتی اگر نام فایل را ذکر نکرده باشد، document را انتخاب کن.
اگر کاربر می‌گوید «این فصل را خلاصه کن» و فایل آموزشی موجود است، document را انتخاب کن.
اگر پیام صرفاً احوال‌پرسی یا سؤال نامرتبط است، chat را انتخاب کن.

فایل‌های آموزشی موجود:
${documentNames.map((name) => `- ${name}`).join("\n")}

فقط شیء JSON مطابق ساختار درخواستی برگردان.
مقدار route باید document یا chat باشد.
          `.trim(),
        },
        {
          role: "user",
          content: text,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Ollama router error: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as RouterResponse;
  const content = data.message?.content?.trim();

  console.log("Router response:", {
    content,
    done_reason: data.done_reason,
  });

  if (!content) {
    throw new Error("Ollama router returned empty content.");
  }

 let result: {
  route?: unknown;
  retrievalMode?: unknown;
};

try {
  result = JSON.parse(content) as typeof result;
} catch {
  throw new Error(`Router returned invalid JSON: ${content}`);
}

if (result.route !== "document" && result.route !== "chat") {
  throw new Error(`Router returned an invalid route: ${content}`);
}

const validModes: RetrievalMode[] = [
  "focused",
  "multi_part",
  "broad",
];

if (
  typeof result.retrievalMode !== "string" ||
  !validModes.includes(result.retrievalMode as RetrievalMode)
) {
  throw new Error(`Router returned an invalid retrieval mode: ${content}`);
}

if (result.route === "chat") {
  return {
    route: "chat",
    retrievalMode: "focused",
  };
}

return {
  route: "document",
  retrievalMode: result.retrievalMode as RetrievalMode,
};
}
