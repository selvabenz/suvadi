import { describe, expect, it } from 'vitest';
import { compareRefs, formatRef, nextChapter, parseTypedRef, prevChapter, refKey, parseRefKey } from '../refs';
import type { BookMeta } from '../types';

const books: BookMeta[] = [
  { code: 'MAL', testament: 'ot', name: 'மல்கியா', long: '', abbr: 'மல்கி', header: 'மல்கியா', chapters: [14, 17, 18, 6], lastVerse: [14, 17, 18, 6] },
  { code: 'MAT', testament: 'nt', name: 'மத்தேயு', long: 'மத்தேயு எழுதின நற்செய்தி', abbr: 'மத்', header: 'மத்தேயு', chapters: [25, 23, 17], lastVerse: [25, 23, 17] },
  { code: 'JHN', testament: 'nt', name: 'யோவான்', long: '', abbr: 'யோவா', header: 'யோவான்', chapters: [51, 25, 36], lastVerse: [51, 25, 36] },
];

describe('refs', () => {
  it('round-trips a key', () => {
    const r = { book: '1JN', ch: 3, v: 16 };
    expect(parseRefKey(refKey(r))).toEqual(r);
    expect(parseRefKey('nope')).toBeNull();
  });

  it('formats with Tamil names and ranges', () => {
    expect(formatRef(books, { book: 'JHN', ch: 3, v: 16 })).toBe('யோவான் 3:16');
    expect(formatRef(books, { book: 'JHN', ch: 3, v: 16 }, 18)).toBe('யோவான் 3:16-18');
    expect(formatRef(books, { book: 'MAT', ch: 1, v: 1 }, 5, 2)).toBe('மத்தேயு 1:1-2:5');
  });

  it('walks chapters across books', () => {
    expect(nextChapter(books, 'MAL', 4)).toEqual({ book: 'MAT', ch: 1 });
    expect(nextChapter(books, 'MAT', 1)).toEqual({ book: 'MAT', ch: 2 });
    expect(nextChapter(books, 'JHN', 3)).toBeNull();
    expect(prevChapter(books, 'MAT', 1)).toEqual({ book: 'MAL', ch: 4 });
    expect(prevChapter(books, 'MAL', 1)).toBeNull();
  });

  it('orders canonically', () => {
    expect(compareRefs(books, { book: 'MAL', ch: 4, v: 6 }, { book: 'MAT', ch: 1, v: 1 })).toBe(-1);
    expect(compareRefs(books, { book: 'MAT', ch: 2, v: 1 }, { book: 'MAT', ch: 1, v: 9 })).toBe(1);
  });

  it('parses typed references in Tamil, English and code', () => {
    expect(parseTypedRef(books, 'யோவா 3:16')).toEqual({ book: 'JHN', ch: 3, v: 16 });
    expect(parseTypedRef(books, 'யோவான் 3 16')).toEqual({ book: 'JHN', ch: 3, v: 16 });
    expect(parseTypedRef(books, 'John 3:16')).toEqual({ book: 'JHN', ch: 3, v: 16 });
    expect(parseTypedRef(books, 'jhn 2')).toEqual({ book: 'JHN', ch: 2, v: 1 });
    expect(parseTypedRef(books, 'Matt 1:99')).toEqual({ book: 'MAT', ch: 1, v: 25 });
    expect(parseTypedRef(books, 'John 99')).toBeNull();
    expect(parseTypedRef(books, 'hello')).toBeNull();
  });
});
