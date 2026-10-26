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
import { retrieveContext, retrieveRelevantChunks } from "../src/rag/retrieve.js";

interface EvalQuestion {
  id: string;
  filename: string;
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
let hit2 = 0;
let oldCover = 0;
let newCover = 0;
let contextChunks = 0;
let scored = 0;
let hit3 = 0;
let hit5 = 0;
let reciprocalRankSum = 0;
let totalMs = 0;

for (const q of questions) {
  const found = await pool.query<{ id: number; user_id: number }>(
    `SELECT id, user_id FROM documents
     WHERE filename = $1 AND status = 'completed'
     ORDER BY id DESC LIMIT 1`,
    [q.filename],
  );
  const document = found.rows[0];

  if (!document) {
    console.warn(`Skipping ${q.id}: no completed document named ${q.filename}`);
    continue;
  }

  const start = performance.now();
  const chunks = await retrieveRelevantChunks(
    document.user_id,
    q.question,
    limit,
    document.id,
  );
  const ms = performance.now() - start;
  totalMs += ms;

  const rank =
    chunks.findIndex((c) => c.pageNumber !== null && q.expectedPages.includes(c.pageNumber)) + 1;

  if (rank === 1) hit1++;
  if (rank >= 1 && rank <= 2) hit2++;
  if (rank >= 1 && rank <= 3) hit3++;
  if (rank >= 1 && rank <= 5) hit5++;
  if (rank > 0) reciprocalRankSum += 1 / rank;

  // Context coverage: is an answer page inside what the model would actually see?
  const OLD_LIMIT = { focused: 2, multi_part: 4, broad: 4 } as const;
  const mode = q.mode === "broad" ? "multi_part" : q.mode;
  const covers = (pages: (number | null)[]) =>
    pages.some((p) => p !== null && q.expectedPages.includes(p));
  const oldHit = covers(chunks.slice(0, OLD_LIMIT[q.mode]).map((c) => c.pageNumber));
  const context = await retrieveContext(document.user_id, q.question, mode, document.id);
  const newHit = covers(context.map((c) => c.pageNumber));
  scored++;
  if (oldHit) oldCover++;
  if (newHit) newCover++;
  contextChunks += context.length;

  rows.push({
    id: q.id,
    mode: q.mode,
    expected: q.expectedPages.join(","),
    rank: rank || "MISS",
    old: oldHit ? "yes" : "NO",
    new: newHit ? "yes" : "NO",
    retrieved: chunks.length,
    pages: chunks.slice(0, 5).map((c) => c.pageNumber).join(","),
    ms: Math.round(ms),
  });
}

console.table(rows);

const n = rows.length;
const pct = (value: number) => `${((value / n) * 100).toFixed(0)}%`;

console.log(
  `context coverage: old(top-${"2/4"}, no neighbours)=${pct(oldCover)}  new=${pct(newCover)}  ` +
    `avgContextChunks=${(contextChunks / Math.max(scored, 1)).toFixed(1)}`,
);
console.log(
  `questions=${n}  hit@1=${pct(hit1)}  hit@2=${pct(hit2)}  hit@3=${pct(hit3)}  hit@5=${pct(hit5)}  ` +
    `MRR=${(reciprocalRankSum / n).toFixed(3)}  avgMs=${Math.round(totalMs / n)}  limit=${limit}`,
);

await pool.end();
