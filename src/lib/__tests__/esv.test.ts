import { describe, expect, it } from 'vitest';
import { parseEsvPassage } from '../esv';

describe('parseEsvPassage', () => {
  it('splits prose into verses on [n] markers', () => {
    const v = parseEsvPassage('[1] In the beginning, God created the heavens and the earth.\n\n[2] The earth was without form and void, and darkness was over the face of the deep.  ');
    expect(v.map((x) => x.n)).toEqual([1, 2]);
    expect(v[0].text).toBe('In the beginning, God created the heavens and the earth.');
    expect(v[1].styles).toBeUndefined();
  });

  it('keeps poetry lines as lines', () => {
    const v = parseEsvPassage('[1] The LORD is my shepherd; I shall not want.\n[2] He makes me lie down in green pastures.\n    He leads me beside still waters.\n');
    expect(v[1].text).toBe('He makes me lie down in green pastures.\nHe leads me beside still waters.');
    expect(v[1].styles).toEqual(['q', 'q']);
  });

  it('returns nothing for text without verse numbers', () => {
    expect(parseEsvPassage('')).toEqual([]);
  });
});
