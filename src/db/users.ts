import { pool } from "./pool.js";

export interface BaleUser {
  id: number;
  bale_chat_id: string;
  first_name: string | null;
  username: string | null;
}

export async function findOrCreateUser(
  chatId: string,
  firstName?: string,
  username?: string,
): Promise<BaleUser> {
  const result = await pool.query<BaleUser>(
    `
      INSERT INTO users (bale_chat_id, first_name, username)
      VALUES ($1, $2, $3)
      ON CONFLICT (bale_chat_id)
      DO UPDATE SET
        first_name = EXCLUDED.first_name,
        username = EXCLUDED.username
      RETURNING id, bale_chat_id, first_name, username
    `,
    [chatId, firstName ?? null, username ?? null],
  );
  const user = result.rows[0];

  if (!user) {
    throw new Error("Failed to create or retrieve user");
  }

  return user;
}
