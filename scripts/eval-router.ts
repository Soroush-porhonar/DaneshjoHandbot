/**
 * Router evaluation: sends labelled messages to the router and measures how
 * often it picks the right route (document/chat) and retrieval mode.
 *
 *   npm run eval:router
 *   npm run eval:router -- --only followup
 *
 * The confusion matrix shows *which* mistakes happen: rows are the expected
 * label, columns what the router answered.
 */
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { routeMessage } from "../src/rag/router.js";
import type { HistoryMessage } from "../src/rag/rewrite.js";

interface RouterCase {
  id: string;
  message: string;
  history?: HistoryMessage[];
  route: "document" | "chat";
  mode?: "focused" | "multi_part" | "broad";
}

/** The documents a student would have uploaded while asking these messages. */
const DOCUMENTS = [
  "DataStructure_Chapter1.pdf",
  "DataStructure_Chapter2.pdf",
  "Algorithm-Chapter4.pdf",
  "زلزلهٔ لیسبون ۱۷۵۵.pdf",
];

const args = process.argv.slice(2);
const onlyIndex = args.indexOf("--only");
const only = onlyIndex >= 0 ? args[onlyIndex + 1] : undefined;

const cases = (
  JSON.parse(await readFile("eval/router.json", "utf-8")) as RouterCase[]
).filter((c) => !only || c.id.includes(only));

const label = (route: string, mode?: string) =>
  route === "chat" ? "chat" : `doc:${mode}`;

const labels = ["chat", "doc:focused", "doc:multi_part", "doc:broad"];
const matrix = new Map<string, Map<string, number>>(
  labels.map((row) => [row, new Map(labels.map((col) => [col, 0]))]),
);

const rows: Record<string, string | number>[] = [];
let routeCorrect = 0;
let exactCorrect = 0;
let totalMs = 0;

for (const c of cases) {
  const start = performance.now();
  let actual: string;

  try {
    const result = await routeMessage(c.message, DOCUMENTS, c.history ?? []);
    actual = label(result.route, result.retrievalMode);
    if (result.route === c.route) routeCorrect++;
  } catch (error: unknown) {
    actual = "error";
    console.warn(`${c.id}: router failed`, error);
  }

  const ms = performance.now() - start;
  totalMs += ms;

  const expected = label(c.route, c.mode);
  if (actual === expected) exactCorrect++;
  const cell = matrix.get(expected)?.get(actual);
  if (cell !== undefined) matrix.get(expected)!.set(actual, cell + 1);

  rows.push({
    id: c.id,
    expected,
    actual,
    ok: actual === expected ? "yes" : "NO",
    ms: Math.round(ms),
  });
}

console.table(rows);

console.log("\nConfusion matrix (rows = expected, columns = router):");
console.table(
  Object.fromEntries(
    labels.map((row) => [row, Object.fromEntries(matrix.get(row)!)]),
  ),
);

const n = rows.length;
const pct = (value: number) => `${((value / Math.max(n, 1)) * 100).toFixed(0)}%`;

console.log(
  `cases=${n}  route accuracy=${pct(routeCorrect)}  ` +
    `route+mode accuracy=${pct(exactCorrect)}  avgMs=${Math.round(totalMs / Math.max(n, 1))}`,
);
