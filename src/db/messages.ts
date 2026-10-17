import { pool } from "./pool.js";

export type MessageRole = "user" | "assistant" | "system";

export async function saveMessage(
  conversationId: number,
  role: MessageRole,
  content: string,
): Promise<void> {
  await pool.query(
    `
      WITH inserted AS (
        INSERT INTO messages (conversation_id, role, content)
        VALUES ($1, $2, $3)
        RETURNING conversation_id
      )
      UPDATE conversations
      SET updated_at = NOW()
      WHERE id = (SELECT conversation_id FROM inserted)
    `,
    [conversationId, role, content],
  );
}

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export async function getRecentMessages(
  conversationId: number,
  limit = 10,
): Promise<ChatHistoryMessage[]> {
  const result = await pool.query<ChatHistoryMessage>(
    `
      SELECT role, content
      FROM (
        SELECT id, role, content
        FROM messages
        WHERE conversation_id = $1
          AND role IN ('user', 'assistant')
        ORDER BY id DESC
        LIMIT $2
      ) AS recent
      ORDER BY id ASC
    `,
    [conversationId, limit],
  );

  return result.rows;
}
