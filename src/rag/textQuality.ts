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
