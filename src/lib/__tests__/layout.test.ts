import { describe, expect, it } from 'vitest';
import { layoutVerse } from '../layout';

describe('layoutVerse', () => {
  it('splits poetry lines and keeps styles', () => {
    const lines = layoutVerse({ n: 1, id: '1', text: 'அ\nஆ\nஇ', styles: ['q', 'q2', 'q'] });
    expect(lines.map((l) => l.style)).toEqual(['q', 'q2', 'q']);
    expect(lines.map((l) => l.parts)).toEqual([
      [{ t: 'text', s: 'அ', wj: false }],
      [{ t: 'text', s: 'ஆ', wj: false }],
      [{ t: 'text', s: 'இ', wj: false }],
    ]);
  });

  it('marks words of Jesus across a line break', () => {
    const lines = layoutVerse({ n: 4, id: '4', text: 'அவர்: ஒன்று\nஇரண்டு', styles: ['p', 'q'], wj: [[6, 11], [12, 18]] });
    expect(lines[0].parts).toEqual([
      { t: 'text', s: 'அவர்: ', wj: false },
      { t: 'text', s: 'ஒன்று', wj: true },
    ]);
    expect(lines[1].parts).toEqual([{ t: 'text', s: 'இரண்டு', wj: true }]);
  });

  it('places footnote and cross-reference markers by offset, including at the end', () => {
    const lines = layoutVerse({
      n: 2, id: '2', text: 'இரண்டாம் வசனம்.',
      footnotes: [{ pos: 8, ref: '1:2', text: 'x', quote: '' }],
      xrefs: [{ pos: 15, ref: '1:2', raw: 'r', targets: [] }],
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].parts).toEqual([
      { t: 'text', s: 'இரண்டாம்', wj: false },
      { t: 'fn', i: 0 },
      { t: 'text', s: ' வசனம்.', wj: false },
      { t: 'x', i: 0 },
    ]);
  });
});
