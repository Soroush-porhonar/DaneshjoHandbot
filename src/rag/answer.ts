import { pool } from "../db/pool.js";
import { getDocumentChunks, retrieveRelevantChunks } from "./retrieve.js";
import type { RetrievalMode } from "../router.js";
import { getSelectedDocumentId } from "../db/conversations.js";

const LLM_URL = process.env.LLM_URL ?? "http://localhost:11434/api/chat";
const LLM_MODEL = "qwen3.5:9b";

const RETRIEVAL_LIMITS = {
  focused: 2,
  multi_part: 4,
} as const;

const BROAD_BATCH_SIZE = 10;

const SYSTEM_PROMPT = `
تو یک دستیار آموزشی دقیق هستی که فقط بر اساس منابع ارائه‌شده پاسخ می‌دهد.

قوانین پاسخ‌گویی:
1. فقط از اطلاعات موجود در منابع ارائه‌شده استفاده کن.
2. مستقیماً به سؤال پاسخ بده و از مقدمه‌چینی غیرضروری خودداری کن.
3. پاسخ را متناسب با سؤال، واضح و مناسب مطالعه تنظیم کن.
4. برای سؤال‌های گسترده، تمام نکات مرتبط موجود در منابع را پوشش بده.
5. اطلاعات خارج از منابع را حدس نزن؛ حتی اگر از نظر علمی درست باشند.
6. هیچ فرمول، مثال، قطعه کد، الگوریتم یا شماره صفحه‌ای را از خودت نساز.
7. اگر منابع برای پاسخ کافی نیستند، این محدودیت را صریح بیان کن.
8. شماره صفحه یا منبع اختراع نکن.
9. بخش منابع را خودت اضافه نکن؛ برنامه آن را اضافه می‌کند.
10. پاسخ را به زبان سؤال بنویس.
`.trim();

interface OllamaResponse {
  message?: { content?: string };
  done?: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface DocumentRow {
  id: number;
}

interface SourceChunk {
  filename: string;
  pageNumber: number | null;
  content: string;
}

async function askOllama(
  systemPrompt: string,
  userPrompt: string,
  signal?: AbortSignal,
): Promise<string> {
  let response: Response;

  try {
    response = await fetch(LLM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(120_000)])
        : AbortSignal.timeout(120_000),
      body: JSON.stringify({
        model: LLM_MODEL,
        stream: false,
        think: false,
        options: {
          num_predict: 4096,
        },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
  } catch (error: unknown) {
    // Preserve user-requested cancellation so the caller can handle it.
    if (signal?.aborted) {
      throw error;
    }

    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error("Ollama chat request timed out after 120 seconds.");
    }

    // Preserve other network errors for logging and diagnosis.
    throw error;
  }

  if (!response.ok) {
    throw new Error(
      `Ollama chat error: ${response.status} ${response.statusText}`,
    );
  }

  let data: OllamaResponse;

  try {
    data = (await response.json()) as OllamaResponse;
  } catch {
    throw new Error("Ollama returned an invalid JSON response.");
  }

  console.log("[LLM] Done reason:", data.done_reason);
  console.log("[LLM] Generated tokens:", data.eval_count);
  const answer = data.message?.content;

  if (typeof answer !== "string" || answer.trim().length === 0) {
    throw new Error("Ollama returned an empty or invalid answer.");
  }
  console.log("[LLM] Response length:", answer.length);
  console.log("[LLM] Response preview:", answer.slice(-500));
  return answer.trim();
}

function formatChunks(chunks: SourceChunk[]): string {
  return chunks
    .map(
      (chunk) =>
        `[فایل: ${chunk.filename}، صفحه PDF ${
          chunk.pageNumber ?? "نامشخص"
        }]\n${chunk.content}`,
    )
    .join("\n\n---\n\n");
}

function buildSourceList(chunks: SourceChunk[]): string[] {
  return [
    ...new Set(
      chunks
        .filter((chunk) => chunk.pageNumber != null)
        .map((chunk) => `${chunk.filename} — صفحه PDF ${chunk.pageNumber}`),
    ),
  ];
}

function appendSources(answer: string, chunks: SourceChunk[]): string {
  const sources = buildSourceList(chunks);

  if (sources.length === 0) {
    return answer;
  }

  return `${answer}\n\n**منابع بازیابی‌شده:**\n${sources
    .map((source) => `- ${source}`)
    .join("\n")}`;
}

async function answerBroadQuestion(
  userId: number,
  documentId: number,
  question: string,
  signal?: AbortSignal,
): Promise<{ answer: string; chunks: SourceChunk[] }> {
  const chunks = await getDocumentChunks(userId, documentId);

  if (chunks.length === 0) {
    return {
      answer: "در فایل انتخاب‌شده محتوایی برای بازیابی پیدا نکردم.",
      chunks: [],
    };
  }

  const batchSummaries: string[] = [];

  for (let start = 0; start < chunks.length; start += BROAD_BATCH_SIZE) {
    const batch = chunks.slice(start, start + BROAD_BATCH_SIZE);

    const summary = await askOllama(
      `تو یک استخراج‌کننده دقیق اطلاعات از جزوه درسی هستی.

قوانین الزامی:
- اطلاعات مرتبط با سؤال دانشجو را با اولویت استخراج کن.
- مطالب مرتبطی را که برای فهم پاسخ ضروری هستند نیز حفظ کن.
- فقط اطلاعاتی را ثبت کن که صریحاً در متن ورودی وجود دارند.
- هیچ دانش عمومی، مثال، تعریف، کد یا توضیحی از خودت اضافه نکن.
- فرمول‌ها، نام توابع، کدها، مراحل الگوریتم‌ها و شرایط پایه را دقیق حفظ کن.
- نتیجه‌گیری‌های موجود در متن را از توضیحات و مثال‌ها جدا نگه دار.
- اگر کد یا فرمولی در متن وجود دارد، آن را دقیقاً حفظ کن.
- شماره صفحات PDF را دقیقاً مطابق برچسب‌های ورودی حفظ کن.
- نکات مهم، محدودیت‌ها و استثناها را حذف نکن.
- اطلاعات تکراری را فقط زمانی ادغام کن که معنای آن تغییر نکند.
- اگر متن به سؤال پاسخ نمی‌دهد، اطلاعات مرتبط موجود را ثبت کن و چیزی اختراع نکن.
- خروجی را به‌صورت ساختاریافته و وفادار به متن بنویس.`,

      `سؤال دانشجو:
${question}

متن این بخش از PDF:
${formatChunks(batch)}

اطلاعات این بخش را با توجه به سؤال استخراج کن، اما جزئیات مهم و مرتبطی را که برای پاسخ دقیق ضروری هستند حذف نکن.`,
      signal,
    );

    batchSummaries.push(
      `خلاصه بخش ${Math.floor(start / BROAD_BATCH_SIZE) + 1}:\n${summary}`,
    );
    console.log(
      `[RAG] Batch ${Math.floor(start / BROAD_BATCH_SIZE) + 1} summary:\n`,
      summary,
    );
  }

  // Combine the batch summaries into a single coherent answer.
  const finalAnswer = await askOllama(
    SYSTEM_PROMPT,
    `درخواست دانشجو:
${question}

در ادامه خلاصه‌های بخش‌های مختلف یک PDF کامل ارائه شده‌اند.
با استفاده از همه خلاصه‌ها، یک پاسخ جامع، منسجم و ساختاریافته تهیه کن.
مباحث مهم را حذف نکن، از تکرار غیرضروری جلوگیری کن و فقط بر اساس این خلاصه‌ها پاسخ بده.
شماره صفحه‌های موجود را حفظ کن و شماره جدید اختراع نکن.

${batchSummaries.join("\n\n---\n\n")}`,
    signal,
  );

  return { answer: finalAnswer, chunks };
}

export async function answerFromDocuments(
  userId: number,
  question: string,
  retrievalMode: RetrievalMode = "multi_part",
  signal?: AbortSignal,
): Promise<string> {
  const documentId = await getSelectedDocumentId(userId);

  if (documentId === null) {
    return (
      "هنوز جزوه‌ای برای مطالعه انتخاب نکرده‌اید.\n\n" +
      "ابتدا /documents را ارسال کنید تا فهرست جزوه‌ها را ببینید، " +
      "سپس با دستور /select شناسه جزوه موردنظر را انتخاب کنید.\n" +
      "مثال: /select 1"
    );
  }

  if (retrievalMode === "broad") {
    const result = await answerBroadQuestion(
      userId,
      documentId,
      question,
      signal,
    );

    return appendSources(result.answer, result.chunks);
  }

  const chunks = await retrieveRelevantChunks(
    userId,
    question,
    RETRIEVAL_LIMITS[retrievalMode],
    documentId,
  );

  if (chunks.length === 0) {
    return "در جزوه انتخاب‌شده مطلب مرتبطی پیدا نکردم.";
  }

  const context = formatChunks(chunks);

  const answer = await askOllama(
    SYSTEM_PROMPT,
    `سؤال:
${question}

متن منابع بازیابی‌شده:
${context}

بر اساس متن منابع به سؤال پاسخ بده.`,
    signal,
  );

  return appendSources(answer, chunks);
}
