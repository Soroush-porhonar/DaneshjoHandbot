import { pool } from "./pool.js";

export async function findOrCreateConversation(
  userId: number,
): Promise<number> {
  const result = await pool.query<{ id: number }>(
    `
      INSERT INTO conversations (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO UPDATE
      SET user_id = EXCLUDED.user_id
      RETURNING id
    `,
    [userId],
  );

  const conversation = result.rows[0];

  if (!conversation) {
    throw new Error("Failed to create or retrieve conversation");
  }

  return conversation.id;
}

export async function selectDocument(
  userId: number,
  documentId: number,
): Promise<boolean> {
  const result = await pool.query(
    `UPDATE conversations c
     SET selected_document_id = d.id,
         updated_at = NOW()
     FROM documents d
     WHERE c.user_id = $1
       AND d.id = $2
       AND d.user_id = $1
       AND d.status = 'completed'
     RETURNING c.id`,
    [userId, documentId],
  );

  return result.rowCount === 1;
}

export async function getSelectedDocumentId(
  userId: number,
): Promise<number | null> {
  const result = await pool.query<{ selected_document_id: number | null }>(
    `SELECT selected_document_id
     FROM conversations
     WHERE user_id = $1`,
    [userId],
  );

  return result.rows[0]?.selected_document_id ?? null;
}
