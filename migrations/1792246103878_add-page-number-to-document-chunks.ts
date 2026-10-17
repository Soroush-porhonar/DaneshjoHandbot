import type { MigrationBuilder } from "node-pg-migrate";

export const shorthands = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.addColumn("document_chunks", {
    page_number: {
      type: "integer",
      notNull: false,
    },
  });
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropColumn("document_chunks", "page_number");
}
