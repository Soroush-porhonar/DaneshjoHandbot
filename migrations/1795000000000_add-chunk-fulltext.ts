import type { MigrationBuilder } from "node-pg-migrate";

export const shorthands = undefined;

/**
 * Full-text search for hybrid retrieval. The 'simple' configuration splits on
 * spaces and punctuation without stemming, which keeps Persian words (including
 * half-spaces), numbers and English terms intact. Generated, so existing and
 * new chunks are indexed automatically.
 */
export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE document_chunks
    ADD COLUMN content_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED
  `);
  pgm.createIndex("document_chunks", "content_tsv", { method: "gin" });
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropIndex("document_chunks", "content_tsv");
  pgm.dropColumn("document_chunks", "content_tsv");
}
