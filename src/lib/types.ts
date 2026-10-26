// Shapes written by tools/build_data.py. Keep in step with it.

export interface BookMeta {
  code: string;
  testament: 'ot' | 'nt';
  name: string;      // short Tamil name (\toc2)
  long: string;      // long Tamil title (\toc1)
  abbr: string;      // Tamil abbreviation (\toc3), as used inside cross-references
  header: string;    // running header (\h)
  chapters: number[];   // verse record count per chapter
  lastVerse: number[];  // highest verse number per chapter
  /** Taken from an unreleased source commit (some ULT books). */
  draft?: boolean;
}

/**
 * One entry of data/translations.json: everything the app needs to list a
 * translation before loading its manifest.
 */
export interface TranslationInfo {
  id: string;          // folder under data/, e.g. "ta-irv"
  lang: string;        // BCP 47 language tag of the Scripture text, e.g. "ta", "hi"
  script?: string;     // ISO 15924, e.g. "Taml", "Deva"
  dir?: 'ltr' | 'rtl';
  name: string;        // name in its own language, e.g. "தமிழ் IRV"
  nameEn: string;      // English name, e.g. "Tamil IRV"
  abbr: string;        // short label used after a shared verse, e.g. "IRV"
  publisher?: string;
  licence?: { name: string; url?: string };
  /** Which shared study datasets apply to this text (English versification). */
  study?: { xrefs?: boolean; words?: boolean; notes?: boolean };
  verseCount?: number;
}

export interface Manifest extends TranslationInfo {
  version: number;
  books: BookMeta[];
  verseCount: number;
  sample?: string;     // Genesis 1:1, shown as the text-size sample in Settings
  source: Record<string, unknown>;
}

export interface Footnote {
  pos: number;
  ref: string;
  text: string;
  quote: string;
}

export interface XrefTarget {
  book?: string;
  ch?: number;
  v?: number;
  vEnd?: number;
  chEnd?: number;
  raw?: string;
}

export interface Xref {
  pos: number;
  ref: string;
  raw: string;
  targets: XrefTarget[];
}

export interface Verse {
  n: number;          // first verse number
  id: string;         // "3" or "68-79"
  end?: number;       // last verse number of a bridge
  text: string;       // plain text, "\n" between poetry lines
  styles?: string[];  // one per line when poetic: p, q, q2, q3, m, ...
  wj?: [number, number][];
  heading?: string;
  parallel?: string;
  superscription?: string;
  lead?: string;
  footnotes?: Footnote[];
  xrefs?: Xref[];
  /** Words the translators supplied (ULT {braces}), as offsets into text. */
  supplied?: [number, number][];
}

export interface Chapter {
  n: number;
  verses: Verse[];
}

export interface IntroBlock {
  kind: 'is' | 'ip' | 'iot' | 'io1';
  text: string;
}

export interface Book {
  code: string;
  names: Record<string, string>;
  intro: IntroBlock[];
  chapters: Chapter[];
  /** Only some chapters are present (online translations load one chapter at a time). */
  partial?: boolean;
}

/** OpenBible cross-reference: [toBook, ch, v, vEnd|0, votes] */
export type OpenXref = [string, number, number, number, number];

/** STEP word: [surface, transliteration, gloss, strongs, morphology, flag] */
export type StepWord = [string, string, string, string, string, string];

export interface Ref {
  book: string;
  ch: number;
  v: number;
}

export type Theme = 'light' | 'dark' | 'sepia' | 'system' | 'mono' | 'teen' | 'genz' | 'pastel';
export type TextAlign = 'left' | 'center' | 'right' | 'justify';
/** Bundled Tamil typefaces (public/fonts). */
export type FontId = 'meera' | 'mukta' | 'pavanam' | 'lohit' | 'tiro';
export type Lang = 'ta' | 'en';

/** Which tab the study sheet opens on; 'explain' opens Helps with the explain panel on top. */
export type StudySection = 'notes' | 'footnotes' | 'xrefs' | 'words' | 'helps' | 'explain';

/** A circled word or phrase: character offsets into verse.text (end exclusive), plus its text. */
export interface Selection {
  start: number;
  end: number;
  text: string;
}

// unfoldingWord helps (tools/uw_study.py) and the ULT alignment (build_data.py).

/** An original-language word in a ULT verse: [content, strong, morph, occurrence]. */
export type AlignToken = [string, string, string, number];
/** An English word of the verse: [start, end, indices into the verse's tokens]. */
export type AlignSpan = [number, number, number[]];
export interface AlignVerse {
  o: AlignToken[];
  a: AlignSpan[];
  /** words inside a Psalm title that sits in this verse */
  d?: AlignSpan[];
}
/** align/<CODE>/<ch>.json: "lex" maps a Strong's base to its lemma; other keys are verse numbers ("0" = Psalm title). */
export type AlignChapter = { lex: Record<string, string> } & Record<string, AlignVerse | Record<string, string>>;

/** A Translation Note. hl/hld are spans in the ULT verse / its title. */
export interface TnNote {
  id: string;
  ta: string;
  q: string;
  occ: number;
  note: string;
  hl?: [number, number][];
  hld?: [number, number][];
  partial?: boolean;
  ref?: string;
}
/** Translation Words link: [origWords, occurrence, slug, category, strong, hl, hld]. */
export type TwlRow = [string, number, string, 'kt' | 'names' | 'other', string, [number, number][], [number, number][]];
export interface TwArticle {
  slug: string;
  cat: 'kt' | 'names' | 'other';
  title: string;
  body: string;
  see: string[];
  refs: [string, number, number][];
  strongs: string[];
}
/** slug -> [title, category, strongs] */
export type TwIndex = Record<string, [string, string, string[]]>;
export interface TaArticle {
  id: string;
  title: string;
  subtitle: string;
  body: string;
}
/** id -> [title, subtitle] */
export type TaIndex = Record<string, [string, string]>;
