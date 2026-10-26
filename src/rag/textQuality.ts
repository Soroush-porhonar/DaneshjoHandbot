/** Invisible characters that carry no meaning (ZWNJ U+200C is kept: it matters in Persian). */
const INVISIBLE = /[​‍‎‏‪-‮⁠﻿]/g;

/** Tabs, no-break and other unusual spaces. */
const ODD_SPACES = /[\t   -   　]/g;

/**
 * Cleans text extracted from a PDF so embeddings and prompts see normal Persian:
 * - NFKC turns Arabic presentation forms (ﺑﺨﺶ) into regular letters (بخش)
 * - Arabic yeh/kaf become Persian ی/ک
 * - tabs and odd spaces become single spaces
 */
export function normalizeText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(INVISIBLE, "")
    .replace(ODD_SPACES, " ")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\r\n?/g, "\n")
    .replace(/ {2,}/g, " ")
    .replace(/ +\n/g, "\n")
    .replace(/\n +/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type PageAssessment = { ok: true } | { ok: false; reason: string };

/** A single Arabic-script letter standing alone (و is a real one-letter word, so it is ignored). */
const ISOLATED_LETTER = /^[\u0621-\u063A\u0641-\u064A\u067E\u0686\u0698\u06A9\u06AF\u06CC]$/;

/** Share of isolated letters above which Persian text is considered broken (م ی کرد). */
const BROKEN_LETTER_RATIO = 0.12;
const MIN_TOKENS_FOR_RATIO = 15;

/**
 * Decides whether a page's text layer is trustworthy.
 * Poor pages (empty, or letters split by spaces) are candidates for OCR.
 */
export function assessPage(text: string, minChars: number): PageAssessment {
  const normalized = normalizeText(text);

  if (normalized.length < minChars) {
    return { ok: false, reason: "no text layer" };
  }

  const tokens = normalized.split(/\s+/);

  if (tokens.length >= MIN_TOKENS_FOR_RATIO) {
    const isolated = tokens.filter(
      (token) => token !== "و" && ISOLATED_LETTER.test(token),
    ).length;

    if (isolated / tokens.length > BROKEN_LETTER_RATIO) {
      return { ok: false, reason: "broken letters" };
    }
  }

  return { ok: true };
}

/** True for model output that is empty or stuck in a loop (same line repeated). */
export function isDegenerateOcr(text: string): boolean {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return true;

  const counts = new Map<string, number>();

  for (const line of lines) {
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }

  return Math.max(...counts.values()) > 8 && lines.length > 12;
}
