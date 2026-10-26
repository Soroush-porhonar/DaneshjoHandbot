import { config } from "../config.js";
import { OllamaError, OllamaTimeoutError } from "../errors.js";
import { logger } from "../logger.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  /** Base64-encoded images for vision models. */
  images?: string[];
}

export interface ChatRequest {
  messages: ChatMessage[];
  signal?: AbortSignal | undefined;
  timeoutMs?: number;
  /** JSON schema for structured output. */
  format?: Record<string, unknown>;
  /** Ollama model options such as num_predict. */
  options?: Record<string, unknown>;
  /** Pass false to disable thinking on reasoning models. */
  think?: boolean;
}

interface OllamaChatResponse {
  message?: { content?: string };
  done_reason?: string;
  eval_count?: number;
}

interface OllamaEmbedResponse {
  embeddings?: number[][];
}

function withTimeout(timeoutMs: number, signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

async function post<T>(
  url: string,
  body: unknown,
  signal: AbortSignal,
  label: string,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify(body),
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new OllamaTimeoutError(`Ollama ${label} request timed out.`);
    }

    // Preserve user cancellation and network errors for the caller.
    throw error;
  }

  if (!response.ok) {
    throw new OllamaError(
      `Ollama ${label} error: ${response.status} ${response.statusText}`,
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new OllamaError(`Ollama returned an invalid ${label} response.`);
  }
}

/** Sends a chat request and returns the trimmed, non-empty answer. */
export async function chat(request: ChatRequest): Promise<string> {
  const data = await post<OllamaChatResponse>(
    config.llm.url,
    {
      model: config.llm.model,
      stream: false,
      messages: request.messages,
      ...(request.think !== undefined ? { think: request.think } : {}),
      ...(request.format ? { format: request.format } : {}),
      ...(request.options ? { options: request.options } : {}),
    },
    withTimeout(request.timeoutMs ?? config.llm.timeoutMs, request.signal),
    "chat",
  );

  logger.debug("[LLM] chat finished", {
    doneReason: data.done_reason,
    tokens: data.eval_count,
  });

  const content = data.message?.content;

  if (typeof content !== "string" || content.trim().length === 0) {
    throw new OllamaError("Ollama returned an empty or invalid answer.");
  }

  return content.trim();
}

/** Embeds one or many texts; returns one vector per input, in order. */
export async function embed(input: string[]): Promise<number[][]> {
  const data = await post<OllamaEmbedResponse>(
    config.embedding.url,
    { model: config.embedding.model, input },
    AbortSignal.timeout(config.embedding.timeoutMs),
    "embedding",
  );

  const embeddings = data.embeddings;

  if (!embeddings || embeddings.length !== input.length) {
    throw new OllamaError(
      `Invalid embedding response: expected ${input.length} vectors, received ${
        embeddings?.length ?? 0
      }`,
    );
  }

  for (const vector of embeddings) {
    if (
      vector.length !== config.embedding.dimensions ||
      !vector.every(Number.isFinite)
    ) {
      throw new OllamaError(
        `Invalid embedding: expected ${config.embedding.dimensions} finite values, received ${vector.length}`,
      );
    }
  }

  return embeddings;
}
