import type { MigrationBuilder } from "node-pg-migrate";

export const shorthands = undefined;

/**
 * One row per answered question: what was asked, how it was answered, which
 * pages were used, how long it took, and the user's 👍/👎. Used to find real
 * failures and turn them into eval questions.
 */
export function up(pgm: MigrationBuilder): void {
  pgm.createTable("answer_logs", {
    id: "id",
    user_id: { type: "integer", notNull: true, references: "users", onDelete: "CASCADE" },
    question: { type: "text", notNull: true },
    /** The standalone question used for search when a follow-up was rewritten. */
    rewritten_question: { type: "text" },
    route: { type: "text", notNull: true, check: "route IN ('document', 'chat')" },
    retrieval_mode: { type: "text" },
    document_id: { type: "integer", references: "documents", onDelete: "SET NULL" },
    /** Context given to the model: [{ page, pageEnd, chunkIndex, isHit }]. */
    context: { type: "jsonb", notNull: true, default: pgm.func("'[]'::jsonb") },
    answer: { type: "text", notNull: true },
    latency_ms: { type: "integer", notNull: true },
    /** 1 = 👍, -1 = 👎, null = no feedback yet. */
    feedback: { type: "smallint", check: "feedback IN (-1, 1)" },
    feedback_at: { type: "timestamptz" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createIndex("answer_logs", "user_id");
  pgm.createIndex("answer_logs", "feedback");
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropTable("answer_logs");
}
