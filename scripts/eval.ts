/**
 * Retrieval evaluation: for each question, checks whether a page that contains
 * the answer shows up in the top-k retrieved chunks.
 *
 *   npm run eval              # all questions
 *   npm run eval -- --limit 10 --only lisbon
 *
 * eval/questions.json entries are DRAFTS generated from the document text;
 * review/extend them with real questions from your own usage.
 */
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { pool } from "../src/db/pool.js";
import { retrieveRelevantChunks } from "../src/rag/retrieve.js";

interface EvalQuestion {
  id: string;
  documentId: number;
  mode: "focused" | "multi_part" | "broad";
  question: string;
  expectedPages: number[];
}

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

const limit = Number(flag("limit") ?? 10);
const only = flag("only");

const questions = (
  JSON.parse(await readFile("eval/questions.json", "utf-8")) as EvalQuestion[]
).filter((q) => !only || q.id.includes(only));

const rows: Record<string, string | number>[] = [];
let hit1 = 0;
let hit3 = 0;
let hit5 = 0;
let reciprocalRankSum = 0;
let totalMs = 0;

for (const q of questions) {
  const owner = await pool.query<{ user_id: number }>(
    "SELECT user_id FROM documents WHERE id = $1",
    [q.documentId],
  );
  const userId = owner.rows[0]?.user_id;

  if (userId === undefined) {
    console.warn(`Skipping ${q.id}: document ${q.documentId} not found`);
    continue;
  }

  const start = performance.now();
  const chunks = await retrieveRelevantChunks(userId, q.question, limit, q.documentId);
  const ms = performance.now() - start;
  totalMs += ms;

  const rank =
    chunks.findIndex((c) => c.pageNumber !== null && q.expectedPages.includes(c.pageNumber)) + 1;

  if (rank === 1) hit1++;
  if (rank >= 1 && rank <= 3) hit3++;
  if (rank >= 1 && rank <= 5) hit5++;
  if (rank > 0) reciprocalRankSum += 1 / rank;

  rows.push({
    id: q.id,
    mode: q.mode,
    expected: q.expectedPages.join(","),
    rank: rank || "MISS",
    retrieved: chunks.length,
    pages: chunks.slice(0, 5).map((c) => c.pageNumber).join(","),
    ms: Math.round(ms),
  });
}

console.table(rows);

const n = rows.length;
const pct = (value: number) => `${((value / n) * 100).toFixed(0)}%`;

console.log(
  `questions=${n}  hit@1=${pct(hit1)}  hit@3=${pct(hit3)}  hit@5=${pct(hit5)}  ` +
    `MRR=${(reciprocalRankSum / n).toFixed(3)}  avgMs=${Math.round(totalMs / n)}  limit=${limit}`,
);

await pool.end();
