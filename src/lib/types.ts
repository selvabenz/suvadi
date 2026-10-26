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
}

export interface Manifest {
  version: number;
  title: { ta: string; en: string };
  books: BookMeta[];
  verseCount: number;
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

export type Theme = 'light' | 'dark' | 'sepia' | 'system';
export type Lang = 'ta' | 'en';
