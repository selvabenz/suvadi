import type { BookMeta, Ref } from './types';
import { ENGLISH_NAMES, indexFromBooks, resolveBook, type BookIndex } from './booknames';

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
 * Parse a typed reference: "யோவா 3:16", "John 3:16-18", "Jn 3", "I John 1:1",
 * "சங்கீதம்" (a book alone opens its first verse). Book names come from `index`
 * (every shipped translation) or, without it, from `books` alone.
 * A range keeps its first verse.
 */
export function parseTypedRef(books: BookMeta[], input: string, index?: BookIndex): Ref | null {
  const s = input.trim().replace(/\s+/g, ' ');
  const m = /^(.+?)(?:\s+(\d+)(?:[:\s.](\d+)(?:\s*[-–—]\s*(?:\d+:)?\d+)?)?)?$/.exec(s);
  if (!m) return null;
  const code = resolveBook(index ?? indexFromBooks(books), m[1]);
  const b = code ? books.find((x) => x.code === code) : undefined;
  if (!b) return null;
  const ch = m[2] ? Number(m[2]) : 1;
  const v = m[3] ? Number(m[3]) : 1;
  if (ch < 1 || ch > b.chapters.length) return null;
  return { book: b.code, ch, v: Math.max(1, Math.min(v, b.lastVerse[ch - 1] || 1)) };
}

export { ENGLISH_NAMES };
