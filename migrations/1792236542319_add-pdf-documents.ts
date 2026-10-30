import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  // pgvector provides the vector type and the <=> distance operator.
  pgm.createExtension("vector", { ifNotExists: true });

  pgm.createTable("documents", {
    id: "id",
    user_id: {
      type: "integer",
      notNull: true,
      references: "users",
      onDelete: "CASCADE",
    },
    filename: {
      type: "text",
      notNull: true,
    },
    status: {
      type: "text",
      notNull: true,
      default: "pending",
      check: "status IN ('pending', 'processing', 'completed', 'failed')",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createIndex("documents", "user_id");

  pgm.createTable("document_chunks", {
    id: "id",
    document_id: {
      type: "integer",
      notNull: true,
      references: "documents",
      onDelete: "CASCADE",
    },
    chunk_index: {
      type: "integer",
      notNull: true,
    },
    content: {
      type: "text",
      notNull: true,
    },
    embedding: {
      type: "vector(1024)",
      notNull: true,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.addConstraint(
    "document_chunks",
    "document_chunks_document_chunk_unique",
    { unique: ["document_id", "chunk_index"] },
  );

  pgm.createIndex("document_chunks", "document_id");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("document_chunks");
  pgm.dropTable("documents");
}
