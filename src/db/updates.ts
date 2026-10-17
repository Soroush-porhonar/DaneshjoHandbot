import { pool } from "./pool.js";

export async function isUpdateProcessed(updateId: number): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM processed_updates
        WHERE update_id = $1
      ) AS exists
    `,
    [updateId],
  );

  return result.rows[0]?.exists ?? false;
}

export async function markUpdateProcessed(updateId: number): Promise<void> {
  await pool.query(
    `
      INSERT INTO processed_updates (update_id)
      VALUES ($1)
      ON CONFLICT (update_id) DO NOTHING
    `,
    [updateId],
  );
}
