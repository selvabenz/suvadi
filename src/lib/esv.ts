import type { Book, BookMeta, Manifest, Ref, TranslationInfo, Verse } from './types';
import { ENGLISH_NAMES } from './refs';

// The ESV is © Crossway and may not be bundled with the app. Crossway's ESV
// API (https://api.esv.org) allows a non-commercial app to show the text with
// an API key, on these terms that shape this module:
//   - text is fetched one chapter at a time, never a whole book or Bible;
//   - no more than 500 verses are kept at once (here: in memory only, never
//     in localStorage or the service-worker cache);
//   - the copyright notice is shown (Settings > Credits) and "(ESV)" follows
//     every shared verse.
// The key comes from VITE_ESV_API_KEY at build time, or the reader pastes their
// own in Settings (stored only on the device).

export const ESV_ID = 'en-esv';

/** Book names as the ESV prints them (and the API parses them). */
function esvName(code: string): string {
  return code === 'SNG' ? 'Song of Solomon' : ENGLISH_NAMES[code] ?? code;
}
const API = 'https://api.esv.org/v3/passage';
const MAX_CACHED_VERSES = 500;

export const ESV_NOTICE =
  'Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.';

export const ESV_INFO: TranslationInfo = {
  id: ESV_ID,
  lang: 'en',
  script: 'Latn',
  dir: 'ltr',
  name: 'ESV',
  nameEn: 'English Standard Version',
  abbr: 'ESV',
  publisher: 'Crossway',
  licence: { name: 'ESV API terms, online only', url: 'https://api.esv.org/' },
  study: { xrefs: true, words: true },
};

const BUILD_KEY: string = (import.meta.env.VITE_ESV_API_KEY as string | undefined) ?? '';
let userKey = '';

/** Called by the app whenever the key in Settings changes. */
export function setEsvKey(key: string) {
  userKey = key.trim();
}

export function esvKey(): string {
  return userKey || BUILD_KEY;
}

export function hasBuildKey(): boolean {
  return !!BUILD_KEY;
}

export class EsvError extends Error {
  constructor(public kind: 'nokey' | 'auth' | 'limit' | 'network', msg: string) {
    super(msg);
  }
}

async function call(path: string, params: Record<string, string>): Promise<any> {
  const key = esvKey();
  if (!key) throw new EsvError('nokey', 'ESV API key missing');
  const qs = new URLSearchParams(params).toString();
  let res: Response;
  try {
    res = await fetch(`${API}/${path}/?${qs}`, { headers: { Authorization: `Token ${key}` } });
  } catch {
    throw new EsvError('network', 'ESV API unreachable');
  }
  if (res.status === 401 || res.status === 403) throw new EsvError('auth', 'ESV API key rejected');
  if (res.status === 429) throw new EsvError('limit', 'ESV API rate limit');
  if (!res.ok) throw new EsvError('network', `ESV API HTTP ${res.status}`);
  return res.json();
}

/**
 * Split the API's plain-text passage into verses. With verse numbers on and
 * headings, footnotes and copyright off, the text is "[1] In the beginning…
 * [2] The earth…", poetry lines separated by newlines.
 */
export function parseEsvPassage(passage: string): Verse[] {
  const verses: Verse[] = [];
  const parts = passage.split(/\[(\d+)\]/);
  // parts: [before, n1, text1, n2, text2, ...]
  for (let i = 1; i < parts.length; i += 2) {
    const n = Number(parts[i]);
    const lines = parts[i + 1]
      .replace(/\r/g, '')
      .split('\n')
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (!lines.length) continue;
    const poetic = lines.length > 1;
    const v: Verse = { n, id: String(n), text: poetic ? lines.join('\n') : lines[0] };
    if (poetic) v.styles = lines.map(() => 'q');
    verses.push(v);
  }
  return verses;
}

// chapter cache, oldest first; bounded by verse count
const chapters = new Map<string, Promise<Verse[]>>();
const sizes = new Map<string, number>();

function trim() {
  let total = [...sizes.values()].reduce((a, b) => a + b, 0);
  for (const k of chapters.keys()) {
    if (total <= MAX_CACHED_VERSES) break;
    if (!sizes.has(k)) continue;
    total -= sizes.get(k)!;
    sizes.delete(k);
    chapters.delete(k);
  }
}

export function loadEsvChapter(code: string, ch: number): Promise<Verse[]> {
  const k = `${code}.${ch}`;
  const hit = chapters.get(k);
  if (hit) {
    // refresh its place in the LRU order
    chapters.delete(k);
    chapters.set(k, hit);
    return hit;
  }
  const name = esvName(code);
  const p = call('text', {
    q: `${name} ${ch}`,
    'include-passage-references': 'false',
    'include-verse-numbers': 'true',
    'include-first-verse-numbers': 'true',
    'include-footnotes': 'false',
    'include-footnote-body': 'false',
    'include-headings': 'false',
    'include-short-copyright': 'false',
    'include-copyright': 'false',
    'include-selahs': 'true',
    'indent-paragraphs': '0',
    'indent-poetry': 'false',
    'indent-declares': '0',
    'indent-psalm-doxology': '0',
    'line-length': '0',
  }).then((data) => {
    const verses = parseEsvPassage((data?.passages ?? [])[0] ?? '');
    if (!verses.length) throw new EsvError('network', 'ESV API returned no verses');
    sizes.set(k, verses.length);
    trim();
    return verses;
  });
  p.catch(() => {
    chapters.delete(k);
    sizes.delete(k);
  });
  chapters.set(k, p);
  return p;
}

/** A Book that holds just one chapter; `partial` tells the feed to offer the next chapter. */
export async function loadEsvBook(code: string, ch: number): Promise<Book> {
  const verses = await loadEsvChapter(code, ch);
  return { code, names: {}, intro: [], chapters: [{ n: ch, verses }], partial: true };
}

/** The ESV manifest: the same canon and chapter counts as the bundled text, English names. */
export function esvManifest(base: Manifest): Manifest {
  const books: BookMeta[] = base.books.map((b) => {
    const name = esvName(b.code);
    return { ...b, name, long: name, abbr: name, header: name };
  });
  return {
    ...ESV_INFO,
    version: base.version,
    books,
    verseCount: base.verseCount,
    sample: 'In the beginning, God created the heavens and the earth.',
    source: { api: 'https://api.esv.org/v3/passage/text/' },
  };
}

export interface EsvHit {
  ref: Ref;
  text: string;
}

/** Word search through the ESV API (first 100 results). */
export async function searchEsv(query: string, toRef: (reference: string) => Ref | null): Promise<EsvHit[]> {
  const data = await call('search', { q: query, 'page-size': '100' });
  const out: EsvHit[] = [];
  for (const r of data?.results ?? []) {
    const ref = toRef(String(r.reference ?? ''));
    if (ref) out.push({ ref, text: String(r.content ?? '') });
  }
  return out;
}
