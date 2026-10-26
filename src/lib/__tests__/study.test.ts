import { describe, expect, it } from 'vitest';
import { overlaps, strongBase, versesOf } from '../study';
import { parseMd } from '../md';
import { layoutVerse, selectionText, splitWords } from '../layout';
import type { Verse } from '../types';

describe('strongBase', () => {
  it('reduces STEP and unfoldingWord forms to one key', () => {
    expect(strongBase('G2316')).toBe('G2316');
    expect(strongBase('G23160')).toBe('G2316');
    expect(strongBase('G41775')).toBe('G4177');
    expect(strongBase('H0430')).toBe('H0430');
    expect(strongBase('H430')).toBe('H0430');
    expect(strongBase('b:H7225')).toBe('H7225');
    expect(strongBase('c:d:H1254a')).toBe('H1254');
    expect(strongBase('H1254A')).toBe('H1254');
    expect(strongBase('g2316')).toBe('G2316');
  });
  it('gives nothing for prefix-only or empty tokens', () => {
    expect(strongBase('l')).toBe('');
    expect(strongBase('c:b')).toBe('');
    expect(strongBase('')).toBe('');
    expect(strongBase(undefined)).toBe('');
  });
});

describe('versesOf / overlaps', () => {
  it('expands bridges', () => {
    expect(versesOf({ n: 3 })).toEqual([3]);
    expect(versesOf({ n: 68, end: 70 })).toEqual([68, 69, 70]);
  });
  it('detects overlap of half-open ranges', () => {
    expect(overlaps([0, 4], { start: 3, end: 6 })).toBe(true);
    expect(overlaps([0, 4], { start: 4, end: 6 })).toBe(false);
  });
});

describe('splitWords', () => {
  const words = (v: Verse) => splitWords(layoutVerse(v)).flatMap((l) => l.items).filter((i) => i.t === 'word');

  it('keeps punctuation with its word and offsets into the text', () => {
    const v: Verse = { n: 1, id: '1', text: 'In the beginning, God created.' };
    const w = words(v);
    expect(w.map((x) => (x.t === 'word' ? x.s : ''))).toEqual(['In', 'the', 'beginning,', 'God', 'created.']);
    for (const x of w) if (x.t === 'word') expect(v.text.slice(x.start, x.end)).toBe(x.s);
  });

  it('counts the line break between poetry lines as one character', () => {
    const v: Verse = { n: 1, id: '1', text: 'The LORD is my shepherd;\nI shall not want.', styles: ['q', 'q'] };
    for (const x of words(v)) if (x.t === 'word') expect(v.text.slice(x.start, x.end)).toBe(x.s);
    const lines = splitWords(layoutVerse(v));
    const sel = selectionText(v.text, lines, 4, 5);
    expect(sel?.text).toBe('shepherd; I');
  });

  it('a marker inside a word makes two fragments with one word index', () => {
    const v: Verse = {
      n: 1, id: '1', text: 'grace upon grace',
      footnotes: [{ pos: 2, ref: '', text: 'x', quote: '' }],
    };
    const w = words(v);
    expect(w.length).toBe(4);
    expect(w[0].t === 'word' && w[1].t === 'word' && w[0].w === w[1].w).toBe(true);
    for (const x of w) if (x.t === 'word') expect(v.text.slice(x.start, x.end)).toBe(x.s);
  });

  it('keeps words-of-Jesus colouring on fragments', () => {
    const v: Verse = { n: 1, id: '1', text: 'He said, Follow me.', wj: [[9, 19]] };
    const w = words(v).filter((x) => x.t === 'word' && x.wj);
    expect(w.map((x) => (x.t === 'word' ? x.s : ''))).toEqual(['Follow', 'me.']);
  });
});

describe('parseMd', () => {
  it('reads bold, links and drops unsafe links to text', () => {
    const [b] = parseMd('See **grace** and [Metaphor](ta:figs-metaphor) or [x](javascript:void).');
    expect(b.inl).toEqual([
      { t: 'text', s: 'See ' },
      { t: 'b', s: 'grace' },
      { t: 'text', s: ' and ' },
      { t: 'a', s: 'Metaphor', href: 'ta:figs-metaphor' },
      { t: 'text', s: ' or ' },
      { t: 'text', s: 'x' },
      { t: 'text', s: '.' },
    ]);
  });
  it('splits the alternate translation into its own block', () => {
    const b = parseMd('Here **walking** is a metaphor. Alternate translation: [you are living]');
    expect(b.length).toBe(2);
    expect(b[1].alt).toBe(true);
    expect(b[1].inl).toEqual([{ t: 'text', s: '[you are living]' }]);
  });
  it('reads headings and list items', () => {
    const b = parseMd('# grace, gracious\n\n## Definition:\n\n* a gift\n* kindness');
    expect(b.map((x) => x.t)).toEqual(['h', 'h', 'li', 'li']);
    expect(b[1].inl).toEqual([{ t: 'text', s: 'Definition' }]);
  });
});
