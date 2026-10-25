import "dotenv/config";
import { BALE_TOKEN } from "./utils/env.js";
import path from "node:path";
import { mkdir, open, writeFile } from "node:fs/promises";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

const BASE_URL = `https://tapi.bale.ai/bot${BALE_TOKEN}`;
const FILE_BASE_URL = `https://tapi.bale.ai/file/bot${BALE_TOKEN}`;

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_MESSAGE_LENGTH = 4000;

function splitMessage(text: string): string[] {
  const parts: string[] = [];
  let remaining = text.trim();

  while (remaining.length > MAX_MESSAGE_LENGTH) {
    let splitAt = remaining.lastIndexOf("\n", MAX_MESSAGE_LENGTH);

    if (splitAt < MAX_MESSAGE_LENGTH * 0.5) {
      splitAt = remaining.lastIndexOf(" ", MAX_MESSAGE_LENGTH);
    }

    if (splitAt < MAX_MESSAGE_LENGTH * 0.5) {
      splitAt = MAX_MESSAGE_LENGTH;
    }

    parts.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining.length > 0) {
    parts.push(remaining);
  }

  return parts;
}
export interface BaleDocument {
  file_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface BaleUpdate {
  update_id: number;
  message?: {
    chat: {
      id: number;
    };
    text?: string;
    document?: BaleDocument;
  };
}

interface BaleFile {
  file_id: string;
  file_path: string;
  file_size?: number;
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
    signal: AbortSignal.timeout(30_000),
  });

  let data: BaleResponse<T>;

  try {
    data = (await response.json()) as BaleResponse<T>;
  } catch {
    throw new Error(
      `Bale API returned an invalid response: HTTP ${response.status}`,
    );
  }

  if (!response.ok || data.ok !== true) {
    throw new Error(
      data.description ?? `Bale API error: HTTP ${response.status}`,
    );
  }

  return data.result;
}

export async function sendMessage(chatId: number, text: string): Promise<void> {
  const parts = splitMessage(text);

  for (const [index, part] of parts.entries()) {
    console.log(
      `[Bale] Sending part ${index + 1}/${parts.length}, length: ${part.length}`,
    );

    await callBale("sendMessage", {
      chat_id: chatId,
      text: part,
    });
  }
}

export async function getUpdates(offset?: number): Promise<BaleUpdate[]> {
  const query = offset === undefined ? "" : `?offset=${offset}`;

  return callBale<BaleUpdate[]>("getUpdates" + query);
}

async function saveResponseToFile(
  response: Response,
  filePath: string,
): Promise<void> {
  const contentLength = response.headers.get("content-length");

  if (contentLength !== null) {
    const size = Number(contentLength);

    if (Number.isFinite(size) && size > MAX_FILE_SIZE) {
      throw new Error("The downloaded file exceeds the 20 MB limit.");
    }
  }

  if (!response.body) {
    throw new Error("The download response has no body.");
  }

  let totalBytes = 0;

  const sizeLimiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      totalBytes += chunk.length;

      if (totalBytes > MAX_FILE_SIZE) {
        callback(new Error("The downloaded file exceeds the 20 MB limit."));
        return;
      }

      callback(null, chunk);
    },
  });

  const fileHandle = await open(filePath, "wx");

  try {
    await pipeline(response.body, sizeLimiter, fileHandle.createWriteStream());

    if (totalBytes === 0) {
      throw new Error("The downloaded file is empty.");
    }
  } catch (error) {
    await fileHandle.close().catch(() => {});
    const { unlink } = await import("node:fs/promises");
    await unlink(filePath).catch(() => {});
    throw error;
  }

  await fileHandle.close();
}

export async function downloadBaleDocument(
  document: BaleDocument,
): Promise<{ filePath: string; filename: string }> {
  if (document.file_size !== undefined && document.file_size > MAX_FILE_SIZE) {
    throw new Error("The file exceeds Bale's 20 MB download limit.");
  }

  const originalName = path.basename(document.file_name ?? "document.pdf");
  const filename = `${Date.now()}-${originalName}`;
  const uploadDirectory = path.resolve(process.cwd(), "uploads");

  await mkdir(uploadDirectory, { recursive: true });

  const fileInfo = await callBale<BaleFile>("getFile", {
    file_id: document.file_id,
  });

  if (!fileInfo.file_path) {
    throw new Error("Bale did not return a file path.");
  }

  if (fileInfo.file_size !== undefined && fileInfo.file_size > MAX_FILE_SIZE) {
    throw new Error("The file exceeds Bale's 20 MB download limit.");
  }
  const response = await fetch(`${FILE_BASE_URL}/${fileInfo.file_path}`, {
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    throw new Error(`File download failed: HTTP ${response.status}`);
  }

  const filePath = path.join(uploadDirectory, filename);

  await saveResponseToFile(response, filePath);

  return { filePath, filename: originalName };
}
