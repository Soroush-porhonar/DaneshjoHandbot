import type { MigrationBuilder } from "node-pg-migrate";

export const shorthands = undefined;

/** Chunk metadata from structure detection; NULL for chunks ingested before it. */
export function up(pgm: MigrationBuilder): void {
  pgm.addColumns("document_chunks", {
    page_end: { type: "integer" },
    section_title: { type: "text" },
    section_index: { type: "integer" },
  });
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropColumns("document_chunks", ["page_end", "section_title", "section_index"]);
}
