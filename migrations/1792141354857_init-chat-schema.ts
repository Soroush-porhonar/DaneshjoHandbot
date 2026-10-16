import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("users", {
    id: "id",
    bale_chat_id: {
      type: "text",
      notNull: true,
      unique: true,
    },
    first_name: { type: "text" },
    username: { type: "text" },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createTable("conversations", {
    id: "id",
    user_id: {
      type: "integer",
      notNull: true,
      references: "users",
      onDelete: "CASCADE",
    },
    title: { type: "text" },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createTable("messages", {
    id: "id",
    conversation_id: {
      type: "integer",
      notNull: true,
      references: "conversations",
      onDelete: "CASCADE",
    },
    role: {
      type: "text",
      notNull: true,
      check: "role IN ('user', 'assistant', 'system')",
    },
    content: {
      type: "text",
      notNull: true,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createIndex("conversations", "user_id");
  pgm.createIndex("messages", ["conversation_id", "created_at"]);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("messages");
  pgm.dropTable("conversations");
  pgm.dropTable("users");
}
