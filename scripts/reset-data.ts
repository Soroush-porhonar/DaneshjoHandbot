/**
 * Prototype-only: wipes documents, chunks, conversations and messages
 * (users and processed updates are kept). Usage: npm run reset-data
 */
import { pool } from "../src/db/pool.js";

await pool.query(
  "TRUNCATE document_chunks, documents, messages, conversations RESTART IDENTITY CASCADE",
);
console.log("Documents, chunks, conversations and messages deleted.");

await pool.end();
