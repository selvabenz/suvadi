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

export type WordItem =
  | { t: 'word'; w: number; s: string; start: number; end: number; wj: boolean }
  | { t: 'space'; s: string }
  | { t: 'fn'; i: number }
  | { t: 'x'; i: number };

export interface WordLine {
  style: string;
  items: WordItem[];
}

/**
 * Re-cut laid-out lines into tappable words for the explain/select mode.
 * Splits on whitespace only, so punctuation stays with its word. Offsets index
 * verse.text exactly like footnote positions (the "\n" between lines is one
 * character). A word cut by a marker or a words-of-Jesus boundary becomes two
 * fragments that share one word index `w`.
 */
export function splitWords(lines: Line[]): WordLine[] {
  const out: WordLine[] = [];
  let pos = 0;
  let w = -1;
  let inWord = false;
  lines.forEach((line, li) => {
    if (li > 0) {
      pos += 1; // the "\n"
      inWord = false;
    }
    const items: WordItem[] = [];
    for (const part of line.parts) {
      if (part.t !== 'text') {
        items.push(part);
        continue;
      }
      for (const piece of part.s.split(/(\s+)/)) {
        if (!piece) continue;
        if (/^\s+$/.test(piece)) {
          items.push({ t: 'space', s: piece });
          inWord = false;
        } else {
          if (!inWord) w++;
          inWord = true;
          items.push({ t: 'word', w, s: piece, start: pos, end: pos + piece.length, wj: part.wj });
        }
        pos += piece.length;
      }
    }
    out.push({ style: line.style, items });
  });
  return out;
}

/** The selection covering words a..b (inclusive word indices); line breaks read as spaces. */
export function selectionText(text: string, lines: WordLine[], a: number, b: number): { start: number; end: number; text: string } | null {
  let start = -1;
  let end = -1;
  for (const line of lines) {
    for (const it of line.items) {
      if (it.t !== 'word' || it.w < a || it.w > b) continue;
      if (start < 0 || it.start < start) start = it.start;
      if (it.end > end) end = it.end;
    }
  }
  if (start < 0) return null;
  return { start, end, text: text.slice(start, end).replace(/\s*\n\s*/g, ' ') };
}
