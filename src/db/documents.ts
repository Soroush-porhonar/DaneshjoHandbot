import { pool } from "./pool.js";

export async function deleteDocument(
  userId: number,
  documentId: number,
): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM documents
     WHERE id = $1
       AND user_id = $2
     RETURNING id`,
    [documentId, userId],
  );

  return result.rowCount === 1;
}
