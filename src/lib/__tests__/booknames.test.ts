import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Manifest, Ref } from '../types';
import { buildBookIndex, normaliseBookName, resolveBook } from '../booknames';
import { parseTypedRef } from '../refs';
import { esvManifest } from '../esv';

// The real manifests, so the test follows the shipped \toc1 / \toc2 / \toc3 names.
const load = (id: string) => JSON.parse(readFileSync(resolve(__dirname, `../../../public/data/${id}/manifest.json`), 'utf8')) as Manifest;
const irv = load('ta-irv');
const ult = load('en-ult');
const esv = esvManifest(irv);
const index = buildBookIndex([irv.books, ult.books]);

const at = (books: Manifest['books'], q: string): string | null => {
  const r: Ref | null = parseTypedRef(books, q, index);
  return r ? `${r.book} ${r.ch}:${r.v}` : null;
};

describe('normaliseBookName', () => {
  it('folds case, spaces, periods and Roman numerals', () => {
    expect(normaliseBookName('I John')).toBe('1john');
    expect(normaliseBookName('II Ki.')).toBe('2ki');
    expect(normaliseBookName('III John')).toBe('3john');
    expect(normaliseBookName('Is')).toBe('is');
    expect(normaliseBookName('Song of Solomon')).toBe('songofsolomon');
  });
  it('NFC-normalises Tamil and removes spaces', () => {
    expect(normaliseBookName('1 கொரி')).toBe('1கொரி');
    expect(normaliseBookName('கொெரி'.normalize('NFD'))).toBe('கொெரி'.normalize('NFC'));
  });
});

describe('book names from every translation', () => {
  it('Tamil names resolve while an English translation is open', () => {
    expect(at(esv.books, 'யோவா 3:16')).toBe('JHN 3:16');
    expect(at(ult.books, 'யோவான் 3:16')).toBe('JHN 3:16');
    expect(at(ult.books, irv.books.find((b) => b.code === 'JHN')!.long + ' 3:16')).toBe('JHN 3:16');
    expect(at(esv.books, 'சங்கீதம் 23:1')).toBe('PSA 23:1');
    expect(at(ult.books, 'சங் 23')).toBe('PSA 23:1');
    expect(at(ult.books, '1கொரி 13:4')).toBe('1CO 13:4');
  });
  it('English names resolve while the Tamil translation is open', () => {
    expect(at(irv.books, 'John 3:16')).toBe('JHN 3:16');
    expect(at(irv.books, 'The Gospel of John 3:16')).toBe('JHN 3:16');
    expect(at(irv.books, 'First Corinthians 13')).toBe('1CO 13:1');
    expect(at(irv.books, 'Song of Songs 2:1')).toBe('SNG 2:1');
  });
  it('common English abbreviations', () => {
    for (const [q, want] of [
      ['Jn 3:16', 'JHN 3:16'], ['Mt 5:3', 'MAT 5:3'], ['Mk 1:1', 'MRK 1:1'], ['Lk 2:1', 'LUK 2:1'],
      ['I John 1:1', '1JN 1:1'], ['1John 1:1', '1JN 1:1'], ['1 Jn 1:1', '1JN 1:1'],
      ['Song of Solomon 2:1', 'SNG 2:1'], ['Song 1', 'SNG 1:1'], ['SS 1', 'SNG 1:1'],
      ['Phil 1:1', 'PHP 1:1'], ['Phm 1', 'PHM 1:1'], ['Jud 1', 'JUD 1:1'], ['Judg 1', 'JDG 1:1'],
      ['Ps 23', 'PSA 23:1'], ['Psalm 23:1', 'PSA 23:1'], ['1 Cor 13:4', '1CO 13:4'], ['Rev 22:21', 'REV 22:21'],
      ['Gen 1:1', 'GEN 1:1'], ['II Kings 2:11', '2KI 2:11'],
    ] as const) {
      expect(at(irv.books, q), q).toBe(want);
      expect(at(ult.books, q), q).toBe(want);
    }
  });
  it('exact names beat prefixes; ties go to the first book in canon', () => {
    expect(at(ult.books, 'Mat 1')).toBe('MAT 1:1');
    expect(at(ult.books, 'Ma 1')).toBe('MAL 1:1');
    expect(at(ult.books, 'Jo 1')).toBe('JOS 1:1');
    expect(at(ult.books, 'Joh 3')).toBe('JHN 3:1');
    expect(at(irv.books, 'யோவா 1')).toBe('JHN 1:1');
  });
  it('ranges, chapters and bare book names', () => {
    expect(at(ult.books, 'John 3:16-18')).toBe('JHN 3:16');
    expect(at(ult.books, 'John 3:16–4:2')).toBe('JHN 3:16');
    expect(at(ult.books, 'John 3')).toBe('JHN 3:1');
    expect(at(irv.books, 'யோவான்')).toBe('JHN 1:1');
    expect(at(ult.books, 'Psalms')).toBe('PSA 1:1');
    expect(at(ult.books, 'Jn')).toBe('JHN 1:1');
  });
  it('rejects what is not a book or a chapter', () => {
    expect(at(ult.books, 'J')).toBeNull();
    expect(at(ult.books, 'hello 3')).toBeNull();
    expect(at(ult.books, 'John 99')).toBeNull();
  });
  it('still works without the all-translations index', () => {
    expect(parseTypedRef(irv.books, 'யோவா 3:16')).toEqual({ book: 'JHN', ch: 3, v: 16 });
    expect(parseTypedRef(irv.books, 'John 3:16')).toEqual({ book: 'JHN', ch: 3, v: 16 });
    expect(resolveBook(index, 'xx')).toBeNull();
  });
});
