import type { BookMeta, Ref } from './types';

export function refKey(r: Ref): string {
  return `${r.book}.${r.ch}.${r.v}`;
}

export function parseRefKey(key: string): Ref | null {
  const m = /^([1-3]?[A-Z]{2,3})\.(\d+)\.(\d+)$/.exec(key);
  if (!m) return null;
  return { book: m[1], ch: Number(m[2]), v: Number(m[3]) };
}

export function sameRef(a: Ref | null | undefined, b: Ref | null | undefined): boolean {
  return !!a && !!b && a.book === b.book && a.ch === b.ch && a.v === b.v;
}

/** "யோவான் 3:16" in Tamil, "John 3:16" style for the English UI (Tamil names are used in both). */
export function formatRef(books: BookMeta[], r: Ref, vEnd?: number, chEnd?: number): string {
  const b = books.find((x) => x.code === r.book);
  const name = b ? b.name : r.book;
  let tail = `${r.ch}:${r.v}`;
  if (vEnd && chEnd && chEnd !== r.ch) tail += `-${chEnd}:${vEnd}`;
  else if (vEnd && vEnd !== r.v) tail += `-${vEnd}`;
  return `${name} ${tail}`;
}

export function formatChapterRef(books: BookMeta[], book: string, ch: number): string {
  const b = books.find((x) => x.code === book);
  return `${b ? b.name : book} ${ch}`;
}

/** Order books canonically; returns -1/0/1. */
export function compareRefs(books: BookMeta[], a: Ref, b: Ref): number {
  const ia = books.findIndex((x) => x.code === a.book);
  const ib = books.findIndex((x) => x.code === b.book);
  if (ia !== ib) return ia < ib ? -1 : 1;
  if (a.ch !== b.ch) return a.ch < b.ch ? -1 : 1;
  if (a.v !== b.v) return a.v < b.v ? -1 : 1;
  return 0;
}

/** The chapter after (book, ch), crossing into the next book; null at Revelation 22. */
export function nextChapter(books: BookMeta[], book: string, ch: number): { book: string; ch: number } | null {
  const i = books.findIndex((x) => x.code === book);
  if (i < 0) return null;
  if (ch < books[i].chapters.length) return { book, ch: ch + 1 };
  if (i + 1 < books.length) return { book: books[i + 1].code, ch: 1 };
  return null;
}

export function prevChapter(books: BookMeta[], book: string, ch: number): { book: string; ch: number } | null {
  const i = books.findIndex((x) => x.code === book);
  if (i < 0) return null;
  if (ch > 1) return { book, ch: ch - 1 };
  if (i > 0) return { book: books[i - 1].code, ch: books[i - 1].chapters.length };
  return null;
}

/**
 * Parse a typed reference such as "யோவா 3:16", "John 3:16", "JHN 3 16", "சங் 23".
 * Matches Tamil names, Tamil abbreviations, USFM codes and a small English list.
 */
export function parseTypedRef(books: BookMeta[], input: string): Ref | null {
  const s = input.trim().replace(/\s+/g, ' ');
  const m = /^(.+?)\s+(\d+)(?:[:\s.](\d+))?$/.exec(s);
  if (!m) return null;
  const nameRaw = m[1].replace(/\s/g, '').toLowerCase();
  const ch = Number(m[2]);
  const v = m[3] ? Number(m[3]) : 1;
  const b = books.find((x) => {
    const cands = [x.code, x.name, x.abbr, x.header, x.long, ENGLISH_NAMES[x.code] ?? '']
      .map((c) => c.replace(/\s/g, '').toLowerCase())
      .filter(Boolean);
    return cands.some((c) => c === nameRaw || c.startsWith(nameRaw) && nameRaw.length >= 2);
  });
  if (!b) return null;
  if (ch < 1 || ch > b.chapters.length) return null;
  return { book: b.code, ch, v: Math.max(1, Math.min(v, b.lastVerse[ch - 1] || 1)) };
}

export const ENGLISH_NAMES: Record<string, string> = {
  GEN: 'Genesis', EXO: 'Exodus', LEV: 'Leviticus', NUM: 'Numbers', DEU: 'Deuteronomy', JOS: 'Joshua',
  JDG: 'Judges', RUT: 'Ruth', '1SA': '1 Samuel', '2SA': '2 Samuel', '1KI': '1 Kings', '2KI': '2 Kings',
  '1CH': '1 Chronicles', '2CH': '2 Chronicles', EZR: 'Ezra', NEH: 'Nehemiah', EST: 'Esther', JOB: 'Job',
  PSA: 'Psalms', PRO: 'Proverbs', ECC: 'Ecclesiastes', SNG: 'Song of Songs', ISA: 'Isaiah', JER: 'Jeremiah',
  LAM: 'Lamentations', EZK: 'Ezekiel', DAN: 'Daniel', HOS: 'Hosea', JOL: 'Joel', AMO: 'Amos', OBA: 'Obadiah',
  JON: 'Jonah', MIC: 'Micah', NAM: 'Nahum', HAB: 'Habakkuk', ZEP: 'Zephaniah', HAG: 'Haggai', ZEC: 'Zechariah',
  MAL: 'Malachi', MAT: 'Matthew', MRK: 'Mark', LUK: 'Luke', JHN: 'John', ACT: 'Acts', ROM: 'Romans',
  '1CO': '1 Corinthians', '2CO': '2 Corinthians', GAL: 'Galatians', EPH: 'Ephesians', PHP: 'Philippians',
  COL: 'Colossians', '1TH': '1 Thessalonians', '2TH': '2 Thessalonians', '1TI': '1 Timothy', '2TI': '2 Timothy',
  TIT: 'Titus', PHM: 'Philemon', HEB: 'Hebrews', JAS: 'James', '1PE': '1 Peter', '2PE': '2 Peter',
  '1JN': '1 John', '2JN': '2 John', '3JN': '3 John', JUD: 'Jude', REV: 'Revelation',
};
