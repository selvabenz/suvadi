import type { Book, Manifest, OpenXref, Ref, StepWord, Verse } from './types';

const BASE = `${import.meta.env.BASE_URL}data/`;

let manifestPromise: Promise<Manifest> | null = null;
const bookCache = new Map<string, Promise<Book>>();
const xrefCache = new Map<string, Promise<Record<string, OpenXref[]>>>();
const wordsCache = new Map<string, Promise<Record<string, StepWord[]>>>();

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function loadManifest(): Promise<Manifest> {
  if (!manifestPromise) {
    manifestPromise = getJson<Manifest>('manifest.json').catch((e) => {
      manifestPromise = null;
      throw e;
    });
  }
  return manifestPromise;
}

export function loadBook(code: string): Promise<Book> {
  let p = bookCache.get(code);
  if (!p) {
    p = getJson<Book>(`books/${code}.json`).catch((e) => {
      bookCache.delete(code);
      throw e;
    });
    bookCache.set(code, p);
  }
  return p;
}

export function loadOpenXrefs(code: string): Promise<Record<string, OpenXref[]>> {
  let p = xrefCache.get(code);
  if (!p) {
    p = getJson<Record<string, OpenXref[]>>(`xrefs/${code}.json`).catch((e) => {
      xrefCache.delete(code);
      throw e;
    });
    xrefCache.set(code, p);
  }
  return p;
}

export function loadWords(code: string, ch: number): Promise<Record<string, StepWord[]>> {
  const key = `${code}/${ch}`;
  let p = wordsCache.get(key);
  if (!p) {
    p = getJson<Record<string, StepWord[]>>(`words/${code}/${ch}.json`).catch((e) => {
      wordsCache.delete(key);
      throw e;
    });
    wordsCache.set(key, p);
  }
  return p;
}

/** Find the verse record that contains verse number v (bridges included). */
export function findVerse(book: Book, ch: number, v: number): Verse | undefined {
  const chapter = book.chapters.find((c) => c.n === ch);
  if (!chapter) return undefined;
  return chapter.verses.find((x) => x.n === v) ?? chapter.verses.find((x) => x.n <= v && (x.end ?? x.n) >= v);
}

export async function getVerse(ref: Ref): Promise<Verse | undefined> {
  const book = await loadBook(ref.book);
  return findVerse(book, ref.ch, ref.v);
}

export interface SearchHit {
  ref: Ref;
  id: string;
  text: string;
}

/**
 * Plain substring search across the whole Bible. Books are loaded as needed
 * (and precached by the service worker after first visit). `onProgress` is
 * called after each book with the count scanned so far.
 */
export async function searchAll(
  books: string[],
  query: string,
  onProgress?: (scanned: number, total: number) => void,
  limit = 200,
  signal?: { cancelled: boolean },
): Promise<SearchHit[]> {
  const q = query.normalize('NFC');
  const hits: SearchHit[] = [];
  let scanned = 0;
  for (const code of books) {
    if (signal?.cancelled) break;
    const book = await loadBook(code);
    for (const ch of book.chapters) {
      for (const v of ch.verses) {
        if (v.text.includes(q)) {
          hits.push({ ref: { book: code, ch: ch.n, v: v.n }, id: v.id, text: v.text });
          if (hits.length >= limit) return hits;
        }
      }
    }
    scanned++;
    onProgress?.(scanned, books.length);
    // let the UI breathe between books
    await new Promise((r) => setTimeout(r, 0));
  }
  return hits;
}
