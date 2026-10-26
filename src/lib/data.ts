import type { AlignChapter, Book, Manifest, OpenXref, Ref, StepWord, TaArticle, TaIndex, TnNote, TranslationInfo, TwArticle, TwIndex, TwlRow, Verse } from './types';
import { strongBase } from './study';
import { ESV_ID, ESV_INFO, esvManifest, loadEsvBook, searchEsv } from './esv';
import { parseTypedRef } from './refs';

// Layout under public/data/ (written by tools/build_data.py):
//   translations.json        the list of translations shipped with the app
//   <id>/manifest.json       one translation: books, names, counts, provenance
//   <id>/books/<CODE>.json   that translation's text, one file per book
//   xrefs/<CODE>.json        OpenBible cross-references (shared, English versification)
//   words/<CODE>/<ch>.json   STEP original-language words (shared)
//   <id>/align/<CODE>/<ch>.json  word alignment of an aligned text (the ULT)
//   tn/<CODE>/<ch>.json      unfoldingWord Translation Notes (shared; intro.json per book)
//   twl/<CODE>/<ch>.json     Translation Words links per verse (shared)
//   tw/<slug>.json, tw/index.json   Translation Words articles (shared)
//   ta/<id>.json, ta/index.json     Translation Academy articles the notes cite (shared)
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
const alignCache = new Map<string, Promise<AlignChapter>>();
const notesCache = new Map<string, Promise<Record<string, TnNote[]>>>();
const introCache = new Map<string, Promise<Record<string, string>>>();
const twlCache = new Map<string, Promise<Record<string, TwlRow[]>>>();
const twCache = new Map<string, Promise<TwArticle>>();
const taCache = new Map<string, Promise<TaArticle>>();
const indexCache = new Map<string, Promise<unknown>>();

class MissingError extends Error {}
const isMissing = (e: unknown) => e instanceof MissingError;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path);
  // A chapter with no notes has no file: that is "nothing here", not a failure.
  // (A dev or preview server answers a missing file with the app's HTML page.)
  if (res.status === 404 || /text\/html/.test(res.headers.get('content-type') ?? '')) throw new MissingError(`${path}: not found`);
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

/** Does this translation carry Hebrew/Greek word alignment (the ULT)? */
export function hasAlignment(m: Manifest | null | undefined): boolean {
  return (m?.source as { text?: { aligned?: boolean } } | undefined)?.text?.aligned === true;
}

export function loadAlign(translation: string, code: string, ch: number): Promise<AlignChapter> {
  return cached(alignCache, `${translation}/${code}/${ch}`, `${translation}/align/${code}/${ch}.json`);
}

const orEmpty = <T,>(p: Promise<T>, empty: T): Promise<T> => p.catch((e) => (isMissing(e) ? empty : Promise.reject(e)));

/** Translation Notes for a chapter (keyed by verse; "0" holds notes on a Psalm title). No file = no notes. */
export function loadNotes(code: string, ch: number): Promise<Record<string, TnNote[]>> {
  return orEmpty(cached(notesCache, `${code}/${ch}`, `tn/${code}/${ch}.json`), {});
}

export function loadNotesIntro(code: string): Promise<Record<string, string>> {
  return orEmpty(cached(introCache, code, `tn/${code}/intro.json`), {});
}

export function loadTwl(code: string, ch: number): Promise<Record<string, TwlRow[]>> {
  return orEmpty(cached(twlCache, `${code}/${ch}`, `twl/${code}/${ch}.json`), {});
}

export function loadTw(slug: string): Promise<TwArticle> {
  return cached(twCache, slug, `tw/${slug}.json`);
}

export function loadTa(id: string): Promise<TaArticle> {
  return cached(taCache, id, `ta/${id}.json`);
}

export function loadTwIndex(): Promise<TwIndex> {
  return cached(indexCache, 'tw', 'tw/index.json') as Promise<TwIndex>;
}

export function loadTaIndex(): Promise<TaIndex> {
  return cached(indexCache, 'ta', 'ta/index.json') as Promise<TaIndex>;
}

/** Strong's base -> Translation Words slugs, built once from the index. */
let strongMap: Promise<Map<string, string[]>> | null = null;
export function loadStrongToTw(): Promise<Map<string, string[]>> {
  if (!strongMap) {
    strongMap = loadTwIndex()
      .then((idx) => {
        const m = new Map<string, string[]>();
        for (const [slug, [, , strongs]] of Object.entries(idx)) {
          for (const s of strongs) {
            const b = strongBase(s);
            if (!b) continue;
            const list = m.get(b) ?? [];
            if (!list.includes(slug)) list.push(slug);
            m.set(b, list);
          }
        }
        return m;
      })
      .catch((e) => {
        strongMap = null;
        throw e;
      });
  }
  return strongMap;
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
