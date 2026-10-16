import { pool } from "./pool.js";

export type MessageRole = "user" | "assistant" | "system";

export async function saveMessage(
  conversationId: number,
  role: MessageRole,
  content: string,
): Promise<void> {
  await pool.query(
    `
      INSERT INTO messages (conversation_id, role, content)
      VALUES ($1, $2, $3)
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
