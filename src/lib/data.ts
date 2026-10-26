import type { Book, Manifest, OpenXref, Ref, StepWord, TranslationInfo, Verse } from './types';
import { ESV_ID, ESV_INFO, esvManifest, loadEsvBook, searchEsv } from './esv';
import { parseTypedRef } from './refs';

// Layout under public/data/ (written by tools/build_data.py):
//   translations.json        the list of translations shipped with the app
//   <id>/manifest.json       one translation: books, names, counts, provenance
//   <id>/books/<CODE>.json   that translation's text, one file per book
//   xrefs/<CODE>.json        OpenBible cross-references (shared, English versification)
//   words/<CODE>/<ch>.json   STEP original-language words (shared)
//
// Every loader takes the translation id explicitly, so the UI can show two
// translations side by side later without touching this file.

const BASE = `${import.meta.env.BASE_URL}data/`;

/** The translation precached by the service worker and used before any choice is made. */
export const DEFAULT_TRANSLATION = 'ta-irv';

let translationsPromise: Promise<TranslationInfo[]> | null = null;
const manifestCache = new Map<string, Promise<Manifest>>();
const bookCache = new Map<string, Promise<Book>>();
const xrefCache = new Map<string, Promise<Record<string, OpenXref[]>>>();
const wordsCache = new Map<string, Promise<Record<string, StepWord[]>>>();

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Load once and keep; on failure forget the promise so a retry can succeed. */
function cached<T>(cache: Map<string, Promise<T>>, key: string, path: string): Promise<T> {
  let p = cache.get(key);
  if (!p) {
    p = getJson<T>(path).catch((e) => {
      cache.delete(key);
      throw e;
    });
    cache.set(key, p);
  }
  return p;
}

export function loadTranslations(): Promise<TranslationInfo[]> {
  if (!translationsPromise) {
    // The ESV is not bundled: it is listed here and read from Crossway's API (see esv.ts).
    translationsPromise = getJson<TranslationInfo[]>('translations.json').then((list) => [...list, ESV_INFO]).catch((e) => {
      translationsPromise = null;
      throw e;
    });
  }
  return translationsPromise;
}

export function loadManifest(translation: string): Promise<Manifest> {
  if (translation === ESV_ID) return loadManifest(DEFAULT_TRANSLATION).then(esvManifest);
  return cached(manifestCache, translation, `${translation}/manifest.json`);
}

/**
 * A bundled translation loads the whole book. The ESV loads only chapter `ch`
 * (the returned book is marked `partial`).
 */
export function loadBook(translation: string, code: string, ch = 1): Promise<Book> {
  if (translation === ESV_ID) return loadEsvBook(code, ch);
  return cached(bookCache, `${translation}/${code}`, `${translation}/books/${code}.json`);
}

export function isOnline(translation: string): boolean {
  return translation === ESV_ID;
}

export function loadOpenXrefs(code: string): Promise<Record<string, OpenXref[]>> {
  return cached(xrefCache, code, `xrefs/${code}.json`);
}

export function loadWords(code: string, ch: number): Promise<Record<string, StepWord[]>> {
  return cached(wordsCache, `${code}/${ch}`, `words/${code}/${ch}.json`);
}

/** Find the verse record that contains verse number v (bridges included). */
export function findVerse(book: Book, ch: number, v: number): Verse | undefined {
  const chapter = book.chapters.find((c) => c.n === ch);
  if (!chapter) return undefined;
  return chapter.verses.find((x) => x.n === v) ?? chapter.verses.find((x) => x.n <= v && (x.end ?? x.n) >= v);
}

export async function getVerse(translation: string, ref: Ref): Promise<Verse | undefined> {
  const book = await loadBook(translation, ref.book, ref.ch);
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
 * called after each book with the count scanned so far. A book that cannot be
 * loaded (offline, not yet cached) is skipped and counted in `skipped`.
 */
export async function searchAll(
  translation: string,
  books: string[],
  query: string,
  onProgress?: (scanned: number, total: number) => void,
  limit = 200,
  signal?: { cancelled: boolean; skipped?: number },
): Promise<SearchHit[]> {
  const q = query.normalize('NFC');
  if (translation === ESV_ID) {
    const m = await loadManifest(ESV_ID);
    const found = await searchEsv(q, (reference) => parseTypedRef(m.books, reference));
    onProgress?.(books.length, books.length);
    return found.slice(0, limit).map((h) => ({ ref: h.ref, id: String(h.ref.v), text: h.text }));
  }
  const hits: SearchHit[] = [];
  let scanned = 0;
  for (const code of books) {
    if (signal?.cancelled) break;
    let book: Book;
    try {
      book = await loadBook(translation, code);
    } catch {
      if (signal) signal.skipped = (signal.skipped ?? 0) + 1;
      scanned++;
      onProgress?.(scanned, books.length);
      continue;
    }
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
