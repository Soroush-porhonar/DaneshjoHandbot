import "dotenv/config";
import { BALE_TOKEN } from "./utils/env.js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE_URL = `https://tapi.bale.ai/bot${BALE_TOKEN}`;
const FILE_BASE_URL = `https://tapi.bale.ai/file/bot${BALE_TOKEN}`;

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

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

  const response = await fetch(`${FILE_BASE_URL}/${fileInfo.file_path}`);

  if (!response.ok) {
    throw new Error(`File download failed: HTTP ${response.status}`);
  }

  const fileBuffer = Buffer.from(await response.arrayBuffer());

  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw new Error("The downloaded file exceeds the 20 MB limit.");
  }

  if (fileBuffer.length === 0) {
    throw new Error("The downloaded file is empty.");
  }

  const filePath = path.join(uploadDirectory, filename);
  await writeFile(filePath, fileBuffer);

  return { filePath, filename: originalName };
}
