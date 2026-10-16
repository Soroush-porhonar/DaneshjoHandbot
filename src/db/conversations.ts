import { pool } from "./pool.js";

export async function findOrCreateConversation(
  userId: number,
): Promise<number> {
  const result = await pool.query<{ id: number }>(
    `
      SELECT id
      FROM conversations
      WHERE user_id = $1
      ORDER BY id
      LIMIT 1
    `,
    [userId],
  );

  const existingConversation = result.rows[0];

  if (existingConversation) {
    return existingConversation.id;
  }

  const created = await pool.query<{ id: number }>(
    `
      INSERT INTO conversations (user_id)
      VALUES ($1)
      RETURNING id
    `,
    [userId],
  );

  const conversation = created.rows[0];

  if (!conversation) {
    throw new Error("Failed to create conversation");
  }

  return conversation.id;
}
