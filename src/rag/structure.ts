/**
 * Detects the structure of a document from its pages: repeated headers and
 * footers, page numbers, slide titles, and whether it is a slide deck ("paged")
 * or running text ("flowing"). Everything here is detect-or-skip: plain text
 * without any of these features passes through unchanged.
 */

/**
 * Headers/footers repeat on most pages AND across the whole document; a slide
 * title repeated on a run of slides (a section) must not count.
 */
const BOILERPLATE_PAGE_SHARE = 0.6;
const BOILERPLATE_SPREAD = 0.75;
const MIN_PAGES_FOR_BOILERPLATE = 4;
const MAX_TITLE_LENGTH = 80;

/** Slide decks have short pages; measured slides average 240–360 characters. */
const PAGED_MEDIAN_LENGTH = 700;

export type Layout = "paged" | "flowing";

const lines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

/**
 * Lines that repeat on most pages, like a course header on every slide.
 * Only real text lines count (5+ characters with letters), so repeated code
 * such as "{" or "return 1;" is never treated as boilerplate.
 */
export function findBoilerplate(pages: string[]): Set<string> {
  if (pages.length < MIN_PAGES_FOR_BOILERPLATE) return new Set();

  // For each candidate line: on how many pages, first and last page index.
  const seen = new Map<string, { count: number; first: number; last: number }>();

  pages.forEach((page, index) => {
    for (const line of new Set(lines(page))) {
      if (line.length >= 5 && /\p{L}{2}/u.test(line) && !/[{};=]/.test(line)) {
        const entry = seen.get(line) ?? { count: 0, first: index, last: index };
        entry.count++;
        entry.last = index;
        seen.set(line, entry);
      }
    }
  });

  return new Set(
    [...seen]
      .filter(
        ([, { count, first, last }]) =>
          count / pages.length >= BOILERPLATE_PAGE_SHARE &&
          (last - first + 1) / pages.length >= BOILERPLATE_SPREAD,
      )
      .map(([line]) => line),
  );
}

/**
 * Removes boilerplate lines and the printed page number (a bare number close
 * to the real page number); other numbers on the page are kept.
 */
export function stripBoilerplate(
  text: string,
  pageNumber: number,
  boilerplate: Set<string>,
): string {
  return lines(text)
    .filter((line) => {
      if (boilerplate.has(line)) return false;
      if (/^\d{1,4}$/.test(line) && Math.abs(Number(line) - pageNumber) <= 2) return false;
      return true;
    })
    .join("\n");
}

/** The first line when it looks like a heading: short, not a bullet, code or sentence. */
export function pageTitle(text: string): string | null {
  const first = lines(text)[0];

  if (
    !first ||
    first.length > MAX_TITLE_LENGTH ||
    /^[•\-*·▪●○]/.test(first) ||
    /[{};=]/.test(first) ||
    /[.!؟?]$/.test(first) ||
    !/\p{L}{2}/u.test(first)
  ) {
    return null;
  }

  return first;
}

/** Slide decks have short pages; running text fills them. */
export function layoutOf(pages: string[]): Layout {
  const lengths = pages
    .map((page) => page.length)
    .filter((length) => length > 0)
    .sort((a, b) => a - b);

  if (lengths.length === 0) return "flowing";

  const median = lengths[Math.floor(lengths.length / 2)]!;
  return median < PAGED_MEDIAN_LENGTH ? "paged" : "flowing";
}

/**
 * What identifies a section: the title without parentheses, so
 * "کلاس ( Class )" and "کلاس ( ادامه )" ("continued") are the same topic.
 */
function sectionKey(title: string): string {
  return title.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Groups consecutive pages with the same title into one section
 * (e.g. nine slides titled "Huffman"). Untitled pages are their own section.
 */
export function sectionIndexes(titles: (string | null)[]): number[] {
  const keys = titles.map((title) => (title === null ? null : sectionKey(title)));
  const indexes: number[] = [];
  let current = -1;

  keys.forEach((key, i) => {
    if (i === 0 || key === null || key === "" || key !== keys[i - 1]) current++;
    indexes.push(current);
  });

  return indexes;
}
