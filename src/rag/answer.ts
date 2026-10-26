import { config } from "../config.js";
import { logger } from "../logger.js";
import { getSelectedDocumentId } from "../db/conversations.js";
import { chat } from "../llm/ollamaClient.js";
import {
  BROAD_EXTRACTION_SYSTEM_PROMPT,
  RAG_SYSTEM_PROMPT,
  buildBatchExtractionPrompt,
  buildBroadSynthesisPrompt,
  buildFocusedUserPrompt,
} from "../llm/prompts/rag.js";
import { batchByChars } from "./batch.js";
import { getDocumentChunks, retrieveContext } from "./retrieve.js";
import type { RetrievalMode } from "./router.js";

interface SourceChunk {
  filename: string;
  pageNumber: number | null;
  content: string;
  /** False for neighbour chunks, which are context but not cited. */
  isHit?: boolean;
}

const GENERATION_OPTIONS = {
  num_predict: 4096,
  temperature: config.llm.temperature.rag,
};

const NO_DOCUMENT_SELECTED_TEXT =
  "هنوز جزوه‌ای برای مطالعه انتخاب نکرده‌اید.\n\n" +
  "ابتدا /documents را ارسال کنید تا فهرست جزوه‌ها را ببینید، " +
  "سپس با دستور /select شناسه جزوه موردنظر را انتخاب کنید.\n" +
  "مثال: /select 1";

function generate(
  system: string,
  user: string,
  signal?: AbortSignal,
): Promise<string> {
  return chat({
    think: false,
    options: GENERATION_OPTIONS,
    signal,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
}

export function formatChunks(chunks: SourceChunk[]): string {
  return chunks
    .map(
      (chunk) =>
        `[فایل: ${chunk.filename}، صفحه PDF ${
          chunk.pageNumber ?? "نامشخص"
        }]\n${chunk.content}`,
    )
    .join("\n\n---\n\n");
}

export function buildSourceList(chunks: SourceChunk[]): string[] {
  return [
    ...new Set(
      chunks
        .filter((chunk) => chunk.pageNumber != null && chunk.isHit !== false)
        .map((chunk) => `${chunk.filename} — صفحه PDF ${chunk.pageNumber}`),
    ),
  ];
}

export function appendSources(answer: string, chunks: SourceChunk[]): string {
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
): Promise<string> {
  const chunks = await getDocumentChunks(userId, documentId);

  if (chunks.length === 0) {
    return "در فایل انتخاب‌شده محتوایی برای بازیابی پیدا نکردم.";
  }

  const summaries: string[] = [];

  for (const [index, batch] of batchByChars(
    chunks,
    config.rag.broadBatchChars,
  ).entries()) {
    const batchNumber = index + 1;

    const summary = await generate(
      BROAD_EXTRACTION_SYSTEM_PROMPT,
      buildBatchExtractionPrompt(question, formatChunks(batch)),
      signal,
    );

    summaries.push(`خلاصه بخش ${batchNumber}:\n${summary}`);
    logger.debug(`[RAG] Batch ${batchNumber} summary:\n${summary}`);
  }

  const answer = await generate(
    RAG_SYSTEM_PROMPT,
    buildBroadSynthesisPrompt(question, summaries),
    signal,
  );

  return appendSources(answer, chunks);
}

async function answerFocusedQuestion(
  userId: number,
  documentId: number,
  question: string,
  mode: "focused" | "multi_part",
  signal?: AbortSignal,
): Promise<string> {
  const chunks = await retrieveContext(userId, question, mode, documentId);

  if (chunks.length === 0) {
    return "در جزوه انتخاب‌شده مطلب مرتبطی پیدا نکردم.";
  }

  const answer = await generate(
    RAG_SYSTEM_PROMPT,
    buildFocusedUserPrompt(question, formatChunks(chunks)),
    signal,
  );

  return appendSources(answer, chunks);
}

export async function answerFromDocuments(
  userId: number,
  question: string,
  retrievalMode: RetrievalMode = "multi_part",
  signal?: AbortSignal,
): Promise<string> {
  const documentId = await getSelectedDocumentId(userId);

  if (documentId === null) {
    return NO_DOCUMENT_SELECTED_TEXT;
  }

  if (retrievalMode === "broad") {
    return answerBroadQuestion(userId, documentId, question, signal);
  }

  return answerFocusedQuestion(
    userId,
    documentId,
    question,
    retrievalMode,
    signal,
  );
}
