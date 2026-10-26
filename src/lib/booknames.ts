import type { BookMeta } from './types';

// One index of book names across every shipped translation, so a reference
// typed in any of them resolves whatever translation is open: the USFM long
// name (\toc1), short name (\toc2), abbreviation (\toc3) and running header
// (\h), the USFM code, English names and common English abbreviations.

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

/** Common English abbreviations (the ESV's "Song of Solomon" included). */
export const COMMON_ABBR: Record<string, string[]> = {
  GEN: ['Gen', 'Gn'], EXO: ['Ex', 'Exod'], LEV: ['Lev', 'Lv'], NUM: ['Num', 'Nm'], DEU: ['Dt', 'Deut'], JOS: ['Josh'],
  JDG: ['Jdg', 'Judg'], RUT: ['Ru', 'Rth'], '1SA': ['1Sa', '1Sam'], '2SA': ['2Sa', '2Sam'], '1KI': ['1Ki', '1Kgs'], '2KI': ['2Ki', '2Kgs'],
  '1CH': ['1Ch', '1Chr'], '2CH': ['2Ch', '2Chr'], EZR: ['Ezr'], NEH: ['Neh'], EST: ['Est', 'Esth'], JOB: ['Jb'],
  PSA: ['Ps', 'Psa', 'Pss', 'Psalm'], PRO: ['Pr', 'Prov'], ECC: ['Ec', 'Eccl', 'Qoh'],
  SNG: ['SS', 'Song', 'SoS', 'Cant', 'Song of Solomon'], ISA: ['Is', 'Isa'], JER: ['Je', 'Jer'], LAM: ['La', 'Lam'],
  EZK: ['Eze', 'Ezk', 'Ezek'], DAN: ['Da', 'Dan'], HOS: ['Ho', 'Hos'], JOL: ['Joe', 'Jl'], AMO: ['Am'], OBA: ['Ob', 'Obad'],
  JON: ['Jnh'], MIC: ['Mi', 'Mic'], NAM: ['Na', 'Nah'], HAB: ['Hab'], ZEP: ['Zep', 'Zeph'], HAG: ['Hag'], ZEC: ['Zec', 'Zech'], MAL: ['Mal'],
  MAT: ['Mt', 'Matt'], MRK: ['Mk', 'Mrk'], LUK: ['Lk', 'Luk'], JHN: ['Jn', 'Jhn'], ACT: ['Ac'], ROM: ['Ro', 'Rom'],
  '1CO': ['1Co', '1Cor'], '2CO': ['2Co', '2Cor'], GAL: ['Ga', 'Gal'], EPH: ['Eph'], PHP: ['Php', 'Phil'], COL: ['Col'],
  '1TH': ['1Th', '1Thess'], '2TH': ['2Th', '2Thess'], '1TI': ['1Ti', '1Tim'], '2TI': ['2Ti', '2Tim'], TIT: ['Tit'], PHM: ['Phm', 'Phlm'],
  HEB: ['Heb'], JAS: ['Jas', 'Jam'], '1PE': ['1Pe', '1Pet'], '2PE': ['2Pe', '2Pet'], '1JN': ['1Jn'], '2JN': ['2Jn'], '3JN': ['3Jn'],
  JUD: ['Jud'], REV: ['Re', 'Rev', 'Rv'],
};

/** Lower rank wins among prefix matches: 0 = code/abbreviation, 1 = name, 2 = long title. */
type Rank = 0 | 1 | 2;

export interface BookIndex {
  exact: Map<string, string>;
  entries: { key: string; code: string; rank: Rank; order: number }[];
}

/** "I John." -> "1john", "Song of Solomon" -> "songofsolomon"; Tamil is NFC-normalised. */
export function normaliseBookName(raw: string): string {
  let s = raw.normalize('NFC').trim().toLowerCase();
  s = s.replace(/^(iii|ii|i)[\s.]+/, (m) => ({ iii: '3', ii: '2', i: '1' })[m.replace(/[\s.]+$/, '') as 'i' | 'ii' | 'iii'] + ' ');
  return s.replace(/[\s.\-_'’]/g, '');
}

/**
 * Index the names of several translations' book lists. The first list sets the
 * canon order used to break ties (pass the active translation first).
 */
export function buildBookIndex(sets: BookMeta[][]): BookIndex {
  const order = new Map<string, number>();
  for (const set of sets) for (const b of set) if (!order.has(b.code)) order.set(b.code, order.size);
  const exact = new Map<string, string>();
  const entries: BookIndex['entries'] = [];
  const seen = new Set<string>();
  const add = (raw: string | undefined, code: string, rank: Rank) => {
    if (!raw) return;
    const key = normaliseBookName(raw);
    if (!key || seen.has(`${key}|${code}`)) return;
    seen.add(`${key}|${code}`);
    entries.push({ key, code, rank, order: order.get(code) ?? 999 });
  };
  for (const set of sets) {
    for (const b of set) {
      add(b.code, b.code, 0);
      add(b.abbr, b.code, 0);
      for (const a of COMMON_ABBR[b.code] ?? []) add(a, b.code, 0);
      add(b.name, b.code, 1);
      add(b.header, b.code, 1);
      add(ENGLISH_NAMES[b.code], b.code, 1);
      add(b.long, b.code, 2);
      // a numbered book is also found without its number ("Corinthians" -> 1 Corinthians)
      const m = /^[1-3]\s*(.+)$/.exec(b.name ?? '');
      if (m && b.code.startsWith('1')) add(m[1], b.code, 2);
    }
  }
  entries.sort((a, b) => a.rank - b.rank || a.order - b.order);
  for (const e of entries) if (!exact.has(e.key)) exact.set(e.key, e.code);
  return { exact, entries };
}

/** The USFM code for a typed book name, or null. Exact names win; then the best prefix. */
export function resolveBook(index: BookIndex, raw: string): string | null {
  const q = normaliseBookName(raw);
  if (q.length < 2) return index.exact.get(q) ?? null;
  const hit = index.exact.get(q);
  if (hit) return hit;
  for (const e of index.entries) if (e.key.startsWith(q)) return e.code; // entries are sorted by (rank, canon)
  return null;
}

const fallback = new WeakMap<BookMeta[], BookIndex>();
/** An index of one book list (used until the all-translations index has loaded). */
export function indexFromBooks(books: BookMeta[]): BookIndex {
  let i = fallback.get(books);
  if (!i) {
    i = buildBookIndex([books]);
    fallback.set(books, i);
  }
  return i;
}
