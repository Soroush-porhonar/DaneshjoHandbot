import type { MigrationBuilder } from "node-pg-migrate";

export const shorthands = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.addColumn("document_chunks", {
    extraction_method: {
      type: "text",
      notNull: true,
      default: "text",
      check: "extraction_method IN ('text', 'ocr')",
    },
  });
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropColumn("document_chunks", "extraction_method");
}
