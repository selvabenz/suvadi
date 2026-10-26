import { describe, expect, it } from 'vitest';
import { PLANS, buildPlan, dayOf, streak, todayIndex } from '../plan';
import type { BookMeta } from '../types';

function mk(code: string, testament: 'ot' | 'nt', chapters: number[]): BookMeta {
  return { code, testament, name: code, long: '', abbr: code, header: code, chapters, lastVerse: chapters };
}

const books: BookMeta[] = [
  mk('GEN', 'ot', [31, 25, 24, 26, 32]),
  mk('PSA', 'ot', [6, 12, 8, 8, 12, 10]),
  mk('MAT', 'nt', [25, 23, 17, 25]),
  mk('MRK', 'nt', [45, 28]),
];

describe('reading plan', () => {
  it('covers every chapter exactly once, in order', () => {
    const plan = buildPlan(books, { id: 't', days: 5, filter: () => true });
    expect(plan).toHaveLength(5);
    const seen: string[] = [];
    for (const d of plan) for (const r of d.ranges) for (let c = r.chFrom; c <= r.chTo; c++) seen.push(`${r.book}.${c}`);
    const all: string[] = [];
    for (const b of books) b.chapters.forEach((_, i) => all.push(`${b.code}.${i + 1}`));
    expect(seen).toEqual(all);
  });

  it('never leaves a day empty while chapters remain', () => {
    const plan = buildPlan(books, { id: 't', days: 17, filter: () => true });
    expect(plan.every((d) => d.ranges.length > 0)).toBe(true);
  });

  it('respects the book filter', () => {
    const nt = PLANS.find((p) => p.id === 'nt-90')!;
    const plan = buildPlan(books, { ...nt, days: 3 });
    const codes = new Set(plan.flatMap((d) => d.ranges.map((r) => r.book)));
    expect([...codes].sort()).toEqual(['MAT', 'MRK']);
  });

  it('finds the day of a chapter', () => {
    const plan = buildPlan(books, { id: 't', days: 5, filter: () => true });
    expect(dayOf(plan, 'GEN', 1)).toBe(1);
    expect(dayOf(plan, 'MRK', 2)).toBe(5);
    expect(dayOf(plan, 'REV', 1)).toBe(0);
  });

  it('counts days since start and streaks', () => {
    expect(todayIndex('2026-10-20', new Date(2026, 9, 26, 15))).toBe(7);
    expect(streak(['2026-10-24', '2026-10-25', '2026-10-26'], new Date(2026, 9, 26))).toBe(3);
    expect(streak(['2026-10-24', '2026-10-25'], new Date(2026, 9, 26))).toBe(2);
    expect(streak(['2026-10-23'], new Date(2026, 9, 26))).toBe(0);
  });
});
