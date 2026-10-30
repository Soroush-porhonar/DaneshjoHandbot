/**
 * Inline buttons and their callback data. Formats (all within Bale's 64 bytes):
 *   fb:<log id>:<1|-1>   👍/👎 on an answer
 *   info:<document id>   show a document's full name and status
 *   sel:<document id>    make a document the active one
 *   del:<document id>    ask to delete a document
 *   delok / delno        confirm / cancel the pending delete
 *   docs                 show the documents list
 *   cancel               stop the running request
 */
import type { InlineButton } from "../bale.js";
import type { DocumentSummary } from "../db/documents.js";
import {
  ACTIVE_BUTTON,
  CANCEL_BUTTON,
  DELETE_BUTTON,
  DELETE_CANCEL_BUTTON,
  DELETE_CONFIRM_BUTTON,
  MENU_DOCUMENTS,
  SELECT_BUTTON,
  documentNameButton,
} from "../messages.js";

export type Callback =
  | { action: "info" | "select" | "delete"; documentId: number }
  | { action: "confirmDelete" | "cancelDelete" | "documents" | "cancel" };

/** Longest document name shown on its (full-width) button. */
const MAX_NAME_LENGTH = 40;

function shortName(filename: string): string {
  const name = filename.replace(/\.pdf$/i, "");
  return name.length > MAX_NAME_LENGTH ? `${name.slice(0, MAX_NAME_LENGTH - 1)}…` : name;
}

/**
 * Two rows per document: the name alone (buttons in a row share the width
 * equally, so it gets the full width), then [📌 انتخاب] [🗑️ حذف]. Tapping the
 * name shows its full name and status; only ready documents can be selected;
 * the active one reads «✅ فعال».
 */
export function documentButtons(
  documents: DocumentSummary[],
  selectedDocumentId: number | null,
): InlineButton[][] {
  return documents.flatMap((document) => {
    const active = document.id === selectedDocumentId;

    return [
      [
        {
          text: documentNameButton(shortName(document.filename), document.status, active),
          callback_data: `info:${document.id}`,
        },
      ],
      [
        ...(document.status === "completed"
          ? [{ text: active ? ACTIVE_BUTTON : SELECT_BUTTON, callback_data: `sel:${document.id}` }]
          : []),
        { text: DELETE_BUTTON, callback_data: `del:${document.id}` },
      ],
    ];
  });
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

  const match = /^(info|sel|del):(\d+)$/.exec(data);
  if (!match) return null;

  const action = match[1] === "info" ? "info" : match[1] === "sel" ? "select" : "delete";
  return { action, documentId: Number(match[2]) };
}
