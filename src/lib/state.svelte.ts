import type { Lang, Ref, Theme } from './types';
import { refKey } from './refs';
import { localDateISO } from './plan';

// All reader state lives in localStorage under one key prefix. Nothing leaves
// the device. Every read and write is wrapped: private windows and cleared
// site data must never break the reader.

const KEY = 'tamil-irv-scroll:v1';

export interface Settings {
  lang: Lang;
  theme: Theme;
  fontScale: number;   // 0.8 .. 1.6
  redLetters: boolean;
  showNumbers: boolean;
}

export interface Bookmark { at: string }
export interface Note { text: string; at: string }
export interface PlanProgress { id: string; started: string; done: number[] }

interface Persisted {
  settings: Settings;
  place: Ref;
  bookmarks: Record<string, Bookmark>;
  notes: Record<string, Note>;
  plan: PlanProgress | null;
  readDates: string[];
  history: Ref[];
}

const DEFAULTS: Persisted = {
  settings: { lang: 'ta', theme: 'system', fontScale: 1, redLetters: true, showNumbers: true },
  place: { book: 'JHN', ch: 1, v: 1 },
  bookmarks: {},
  notes: {},
  plan: null,
  readDates: [],
  history: [],
};

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      ...structuredClone(DEFAULTS),
      ...parsed,
      settings: { ...DEFAULTS.settings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

class AppState {
  settings = $state<Settings>(DEFAULTS.settings);
  place = $state<Ref>(DEFAULTS.place);
  bookmarks = $state<Record<string, Bookmark>>({});
  notes = $state<Record<string, Note>>({});
  plan = $state<PlanProgress | null>(null);
  readDates = $state<string[]>([]);
  history = $state<Ref[]>([]);

  constructor() {
    const p = load();
    this.settings = p.settings;
    this.place = p.place;
    this.bookmarks = p.bookmarks;
    this.notes = p.notes;
    this.plan = p.plan;
    this.readDates = p.readDates;
    this.history = p.history;
  }

  persist() {
    try {
      const data: Persisted = {
        settings: $state.snapshot(this.settings),
        place: $state.snapshot(this.place),
        bookmarks: $state.snapshot(this.bookmarks),
        notes: $state.snapshot(this.notes),
        plan: $state.snapshot(this.plan),
        readDates: $state.snapshot(this.readDates),
        history: $state.snapshot(this.history),
      };
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* storage unavailable: the session still works, nothing is remembered */
    }
  }

  setPlace(ref: Ref) {
    if (this.place.book === ref.book && this.place.ch === ref.ch && this.place.v === ref.v) return;
    this.place = ref;
    const today = localDateISO();
    if (!this.readDates.includes(today)) this.readDates = [...this.readDates.slice(-400), today];
    this.persist();
  }

  pushHistory(ref: Ref) {
    const k = refKey(ref);
    this.history = [ref, ...this.history.filter((r) => refKey(r) !== k)].slice(0, 20);
    this.persist();
  }

  isBookmarked(ref: Ref): boolean {
    return refKey(ref) in this.bookmarks;
  }

  toggleBookmark(ref: Ref) {
    const k = refKey(ref);
    const next = { ...this.bookmarks };
    if (k in next) delete next[k];
    else next[k] = { at: new Date().toISOString() };
    this.bookmarks = next;
    this.persist();
  }

  setNote(ref: Ref, text: string) {
    const k = refKey(ref);
    const next = { ...this.notes };
    if (text.trim()) next[k] = { text: text.trim(), at: new Date().toISOString() };
    else delete next[k];
    this.notes = next;
    this.persist();
  }

  update<K extends keyof Settings>(key: K, value: Settings[K]) {
    this.settings = { ...this.settings, [key]: value };
    this.persist();
  }

  startPlan(id: string) {
    this.plan = { id, started: localDateISO(), done: [] };
    this.persist();
  }

  stopPlan() {
    this.plan = null;
    this.persist();
  }

  togglePlanDay(day: number) {
    if (!this.plan) return;
    const done = this.plan.done.includes(day)
      ? this.plan.done.filter((d) => d !== day)
      : [...this.plan.done, day].sort((a, b) => a - b);
    this.plan = { ...this.plan, done };
    this.persist();
  }

  resetPlace() {
    this.place = { ...DEFAULTS.place };
    this.persist();
  }
}

export const app = new AppState();
