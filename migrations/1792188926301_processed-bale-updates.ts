import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("processed_updates", {
    update_id: {
      type: "bigint",
      primaryKey: true,
    },
    processed_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("processed_updates");
}
