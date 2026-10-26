import type { Verse } from './types';

// Helpers shared by the study sheet, the explain panel and their tests.

/**
 * One Strong's number form for matching across datasets. STEP writes "H0430",
 * "G2316", "H1254A"; unfoldingWord writes "H0430", "G23160", "b:H7225",
 * "H1254a". The base is the letter plus four digits; prefixes, a fifth uW
 * digit and homonym letters are dropped. A prefix-only token ("l", "c:b")
 * has no base and gives "".
 */
export function strongBase(s: string | null | undefined): string {
  if (!s) return '';
  const m = /([GH])(\d{1,4})(\d)?[A-Za-z]?$/i.exec(s.replace(/^(?:[a-z]+:)+/i, '').trim());
  if (!m) return '';
  return m[1].toUpperCase() + m[2].padStart(4, '0');
}

/** The verse numbers a verse record covers (a bridge "68-79" covers twelve). */
export function versesOf(v: Pick<Verse, 'n' | 'end'>): number[] {
  const out: number[] = [];
  for (let n = v.n; n <= (v.end ?? v.n); n++) out.push(n);
  return out;
}

/** Do two half-open ranges share at least one character? */
export function overlaps(a: [number, number], b: { start: number; end: number }): boolean {
  return a[0] < b.end && b.start < a[1];
}

/** The unfoldingWord Translation Academy article on Door43 (used when it is not bundled). */
export function taUrl(id: string): string {
  return `https://git.door43.org/unfoldingWord/en_ta/src/branch/master/translate/${encodeURIComponent(id)}/01.md`;
}
