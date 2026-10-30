/**
 * Inline buttons and their callback data. Formats (all within Bale's 64 bytes):
 *   fb:<log id>:<1|-1>   👍/👎 on an answer
 *   sel:<document id>    make a document the active one
 *   del:<document id>    ask to delete a document
 *   delok / delno        confirm / cancel the pending delete
 *   docs                 show the documents list
 *   cancel               stop the running request
 */
import type { InlineButton } from "../bale.js";
import type { DocumentSummary } from "../db/documents.js";
import {
  CANCEL_BUTTON,
  DELETE_BUTTON,
  DELETE_CANCEL_BUTTON,
  DELETE_CONFIRM_BUTTON,
  MENU_DOCUMENTS,
  selectButtonText,
} from "../messages.js";

export type Callback =
  | { action: "select" | "delete"; documentId: number }
  | { action: "confirmDelete" | "cancelDelete" | "documents" | "cancel" };

/** Longest document name shown on a button. */
const MAX_NAME_LENGTH = 28;

function shortName(filename: string): string {
  const name = filename.replace(/\.pdf$/i, "");
  return name.length > MAX_NAME_LENGTH ? `${name.slice(0, MAX_NAME_LENGTH - 1)}…` : name;
}

/** One row per document: select it (only when ready; ✅ marks the active one) and delete it. */
export function documentButtons(
  documents: DocumentSummary[],
  selectedDocumentId: number | null,
): InlineButton[][] {
  return documents.map((document) => [
    ...(document.status === "completed"
      ? [
          {
            text: selectButtonText(shortName(document.filename), document.id === selectedDocumentId),
            callback_data: `sel:${document.id}`,
          },
        ]
      : []),
    { text: DELETE_BUTTON, callback_data: `del:${document.id}` },
  ]);
}

export const confirmDeleteButtons = (): InlineButton[][] => [
  [
    { text: DELETE_CONFIRM_BUTTON, callback_data: "delok" },
    { text: DELETE_CANCEL_BUTTON, callback_data: "delno" },
  ],
];

export const cancelButton = (): InlineButton[][] => [[{ text: CANCEL_BUTTON, callback_data: "cancel" }]];

export const documentsButton = (): InlineButton[][] => [[{ text: MENU_DOCUMENTS, callback_data: "docs" }]];

const SIMPLE: Record<string, Callback> = {
  delok: { action: "confirmDelete" },
  delno: { action: "cancelDelete" },
  docs: { action: "documents" },
  cancel: { action: "cancel" },
};

/** Parses document and menu callback data; feedback ("fb:") is parsed in feedback.ts. */
export function parseCallback(data: string | undefined): Callback | null {
  if (!data) return null;
  if (Object.hasOwn(SIMPLE, data)) return SIMPLE[data]!;

  const match = /^(sel|del):(\d+)$/.exec(data);
  if (!match) return null;

  return { action: match[1] === "sel" ? "select" : "delete", documentId: Number(match[2]) };
}
