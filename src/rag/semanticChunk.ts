/**
 * Semantic chunking for running text: instead of cutting every N characters,
 * cut where the topic changes. Each sentence/line is embedded, and a chunk ends
 * where the meaning jumps most between neighbouring sentences.
 */
import { chunkOptions, chunkPages, prepareDocument, splitRanges } from "./chunk.js";
import type { ChunkOptions, CleanPage, TextChunk } from "./chunk.js";
import { generateEmbeddings } from "./embeddings.js";

/** Chunks smaller than this are not cut even at a topic change. */
const MIN_CHUNK_CHARS = 200;
/** Units shorter than this (a heading, a bullet) are joined to the next one. */
const MIN_UNIT_CHARS = 40;
/** Cut at the biggest topic jumps: distances above this percentile. */
const BREAKPOINT_PERCENTILE = 0.9;
const EMBED_BATCH = 32;

type Embed = (texts: string[]) => Promise<number[][]>;

interface Unit {
  text: string;
  page: CleanPage;
}

/** Lines, further split after sentence ends; tiny units are merged forward. */
export function splitUnits(pages: CleanPage[], maxChars: number): Unit[] {
  const raw: Unit[] = [];

  for (const page of pages) {
    for (const line of page.text.split("\n")) {
      for (const sentence of line.split(/(?<=[.!?؟])\s+/)) {
        const text = sentence.trim();
        if (!text) continue;
        // A single over-long sentence is split by size.
        for (const [start, end] of splitRanges(text, maxChars, 0)) {
          raw.push({ text: text.slice(start, end).trim(), page });
        }
      }
    }
  }

  const units: Unit[] = [];
  let pending: Unit | null = null;

  for (const unit of raw) {
    const merged: Unit = pending ? { text: `${pending.text}\n${unit.text}`, page: pending.page } : unit;
    if (merged.text.length < MIN_UNIT_CHARS) {
      pending = merged;
    } else {
      units.push(merged);
      pending = null;
    }
  }

  if (pending) units.push(pending);
  return units;
}

function cosineDistance(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  return 1 - dot / (Math.sqrt(normA * normB) || 1);
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? Infinity;
}

/** Groups units into chunks, cutting at topic jumps and never above maxChars. */
export async function semanticChunks(
  pages: CleanPage[],
  maxChars: number,
  embed: Embed,
): Promise<Omit<TextChunk, "chunkIndex">[]> {
  const units = splitUnits(pages, maxChars);
  if (units.length === 0) return [];

  const vectors: number[][] = [];
  for (let start = 0; start < units.length; start += EMBED_BATCH) {
    vectors.push(...(await embed(units.slice(start, start + EMBED_BATCH).map((u) => u.text))));
  }

  // distances[i] = how much the topic changes between unit i and unit i + 1.
  const distances = units.slice(1).map((_, i) => cosineDistance(vectors[i]!, vectors[i + 1]!));
  const cutAbove = percentile(distances, BREAKPOINT_PERCENTILE);

  const groups: Unit[][] = [];
  let current: Unit[] = [];
  const length = (group: Unit[]) => group.reduce((sum, u) => sum + u.text.length + 1, 0);

  units.forEach((unit, i) => {
    if (current.length > 0 && length(current) + unit.text.length > maxChars) {
      groups.push(current);
      current = [];
    }
    current.push(unit);

    // Strictly above: when the text is one topic, all jumps are equal and none is a cut.
    const topicChanges = i < distances.length && distances[i]! > cutAbove;
    if (topicChanges && length(current) >= MIN_CHUNK_CHARS) {
      groups.push(current);
      current = [];
    }
  });
  if (current.length > 0) groups.push(current);

  return groups.map((group) => {
    const content = group.map((unit) => unit.text).join("\n");
    return {
      pageNumber: group[0]!.page.pageNumber,
      pageEnd: group.at(-1)!.page.pageNumber,
      content,
      embedText: content,
      method: group.some((unit) => unit.page.method === "ocr") ? "ocr" : "text",
      sectionTitle: null,
      sectionIndex: null,
    };
  });
}

/**
 * Chunks a document for ingestion: semantic chunking for running text when
 * enabled, otherwise the regular (synchronous) chunker.
 */
export async function chunkDocument(
  pages: Parameters<typeof chunkPages>[0],
  overrides: Partial<ChunkOptions> = {},
  embed: Embed = generateEmbeddings,
): Promise<TextChunk[]> {
  const options = chunkOptions(overrides);
  const { clean, layout } = prepareDocument(pages, options);

  if (!options.semantic || layout === "paged" || clean.length === 0) {
    return chunkPages(pages, options);
  }

  const chunks = await semanticChunks(clean, options.chunkSize, embed);
  return chunks.map((chunk, chunkIndex) => ({ ...chunk, chunkIndex }));
}
