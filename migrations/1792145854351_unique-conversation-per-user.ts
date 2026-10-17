import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addConstraint("conversations", "conversations_user_id_unique", {
    unique: ["user_id"],
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropConstraint("conversations", "conversations_user_id_unique");
}
