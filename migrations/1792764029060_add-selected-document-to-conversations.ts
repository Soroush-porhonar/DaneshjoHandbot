import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn("conversations", {
    selected_document_id: {
      type: "integer",
      references: "documents",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
  });

  pgm.createIndex("conversations", "selected_document_id");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex("conversations", "selected_document_id");
  pgm.dropColumn("conversations", "selected_document_id");
}
