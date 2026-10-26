import type { BookMeta } from './types';

export interface PlanDay {
  day: number;                   // 1-based
  ranges: { book: string; chFrom: number; chTo: number }[];
}

export interface PlanDef {
  id: string;
  days: number;
  filter: (b: BookMeta) => boolean;
}

export const PLANS: PlanDef[] = [
  { id: 'bible-1y', days: 365, filter: () => true },
  { id: 'nt-90', days: 90, filter: (b) => b.testament === 'nt' },
  { id: 'psalms-30', days: 30, filter: (b) => b.code === 'PSA' },
  { id: 'gospels-40', days: 40, filter: (b) => ['MAT', 'MRK', 'LUK', 'JHN'].includes(b.code) },
];

/**
 * Split the chosen books' chapters, in canonical order, into `days` consecutive
 * portions of nearly equal verse count. Deterministic: the same manifest always
 * gives the same plan, so a reader's progress (a set of completed day numbers)
 * stays valid across app updates.
 */
export function buildPlan(books: BookMeta[], def: PlanDef): PlanDay[] {
  const chapters: { book: string; ch: number; verses: number }[] = [];
  for (const b of books.filter(def.filter)) {
    b.chapters.forEach((count, i) => chapters.push({ book: b.code, ch: i + 1, verses: count }));
  }
  const total = chapters.reduce((s, c) => s + c.verses, 0);
  const days: PlanDay[] = [];
  let idx = 0;
  let consumed = 0;
  for (let d = 1; d <= def.days; d++) {
    const target = Math.round((total * d) / def.days);
    const remainingDays = def.days - d;
    const ranges: PlanDay['ranges'] = [];
    // Always take at least one chapter per day while chapters remain, and
    // never take so many that a later day would be left with none.
    while (idx < chapters.length) {
      const c = chapters[idx];
      if (ranges.length > 0) {
        const mustLeave = chapters.length - idx <= remainingDays;
        const overshoot = consumed + c.verses > target + c.verses / 2;
        if (mustLeave || consumed >= target || overshoot) break;
      }
      const last = ranges[ranges.length - 1];
      if (last && last.book === c.book && last.chTo === c.ch - 1) last.chTo = c.ch;
      else ranges.push({ book: c.book, chFrom: c.ch, chTo: c.ch });
      consumed += c.verses;
      idx++;
    }
    days.push({ day: d, ranges });
  }
  // Any leftover chapters (rounding) go to the final day.
  while (idx < chapters.length) {
    const c = chapters[idx++];
    const lastDay = days[days.length - 1];
    const last = lastDay.ranges[lastDay.ranges.length - 1];
    if (last && last.book === c.book && last.chTo === c.ch - 1) last.chTo = c.ch;
    else lastDay.ranges.push({ book: c.book, chFrom: c.ch, chTo: c.ch });
  }
  return days;
}

/** Which day of a plan contains this chapter (1-based), or 0 if the plan skips it. */
export function dayOf(plan: PlanDay[], book: string, ch: number): number {
  for (const d of plan) {
    for (const r of d.ranges) if (r.book === book && ch >= r.chFrom && ch <= r.chTo) return d.day;
  }
  return 0;
}

/** Days since the plan was started, 1-based, by local calendar date. */
export function todayIndex(startedISO: string, now = new Date()): number {
  const start = new Date(startedISO + 'T00:00:00');
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((a.getTime() - start.getTime()) / 86400000) + 1;
}

export function localDateISO(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Consecutive-day streak ending today or yesterday, from a set of ISO dates read. */
export function streak(datesRead: Iterable<string>, now = new Date()): number {
  const set = new Set(datesRead);
  let d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!set.has(localDateISO(d))) {
    d.setDate(d.getDate() - 1);
    if (!set.has(localDateISO(d))) return 0;
  }
  let n = 0;
  while (set.has(localDateISO(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
