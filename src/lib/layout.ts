import type { Verse } from './types';

export type Part =
  | { t: 'text'; s: string; wj: boolean }
  | { t: 'fn'; i: number }
  | { t: 'x'; i: number };

export interface Line {
  style: string;   // p, m, q, q2, q3, qr, pi
  parts: Part[];
}

/**
 * Turn a verse's plain text plus offset data into renderable lines.
 * Lines break at "\n" (poetry). Words-of-Jesus ranges and footnote /
 * cross-reference markers are placed by character offset into the text.
 */
export function layoutVerse(v: Verse): Line[] {
  const text = v.text;
  const styles = v.styles ?? [];
  const wj = v.wj ?? [];
  const fnAt = new Map<number, number[]>();
  (v.footnotes ?? []).forEach((f, i) => fnAt.set(f.pos, [...(fnAt.get(f.pos) ?? []), i]));
  const xAt = new Map<number, number[]>();
  (v.xrefs ?? []).forEach((x, i) => xAt.set(x.pos, [...(xAt.get(x.pos) ?? []), i]));

  const lines: Line[] = [];
  let lineIdx = 0;
  let cur: Line = { style: styles[0] ?? 'p', parts: [] };
  let buf = '';
  let bufWj = false;

  const flush = () => {
    if (buf) cur.parts.push({ t: 'text', s: buf, wj: bufWj });
    buf = '';
  };
  const markersAt = (pos: number) => {
    const f = fnAt.get(pos);
    const x = xAt.get(pos);
    if (!f && !x) return;
    flush();
    for (const i of f ?? []) cur.parts.push({ t: 'fn', i });
    for (const i of x ?? []) cur.parts.push({ t: 'x', i });
  };
  const inWj = (pos: number) => wj.some(([a, b]) => pos >= a && pos < b);

  for (let pos = 0; pos < text.length; pos++) {
    markersAt(pos);
    const ch = text[pos];
    if (ch === '\n') {
      flush();
      lines.push(cur);
      lineIdx++;
      cur = { style: styles[lineIdx] ?? 'p', parts: [] };
      continue;
    }
    const w = inWj(pos);
    if (w !== bufWj) {
      flush();
      bufWj = w;
    }
    buf += ch;
  }
  flush();
  markersAt(text.length);
  lines.push(cur);
  return lines;
}

/** Plain text for copy/share: lines joined by newlines, no markers. */
export function plainText(v: Verse): string {
  return v.text;
}
