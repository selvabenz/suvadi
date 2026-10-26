import type { FontId, Lang, Ref, TextAlign, Theme } from './types';
import { refKey } from './refs';
import { localDateISO } from './plan';
import { DEFAULT_TRANSLATION } from './data';

// All reader state lives in localStorage under one key. Nothing leaves the
// device. Every read and write is wrapped: private windows and cleared site
// data must never break the reader.

const KEY = 'suvadi:v1';
// The app was called "tamil-irv-scroll" before it became Suvadi; a reader who
// installed it under that name keeps their place, bookmarks and notes.
const LEGACY_KEYS = ['tamil-irv-scroll:v1'];

export interface Settings {
  lang: Lang;
  translation: string;  // id from data/translations.json
  theme: Theme;
  fontScale: number;   // 0.8 .. 1.6
  redLetters: boolean;
  showNumbers: boolean;   // the verse number inside the text
  showRef: boolean;       // "1:1" after the book name above the verse
  showHeadings: boolean;  // section headings and parallel-passage lines
  textAlign: TextAlign;
  font: FontId;
}

export interface Bookmark { at: string }
export interface Like { at: string }
export interface Note { text: string; at: string }
export interface PlanProgress { id: string; started: string; done: number[] }

interface Persisted {
  settings: Settings;
  place: Ref;
  bookmarks: Record<string, Bookmark>;
  likes: Record<string, Like>;
  notes: Record<string, Note>;
  plan: PlanProgress | null;
  readDates: string[];
  history: Ref[];
}

const DEFAULTS: Persisted = {
  settings: { lang: 'ta', translation: DEFAULT_TRANSLATION, theme: 'system', fontScale: 1, redLetters: true, showNumbers: true, showRef: true, showHeadings: true, textAlign: 'left', font: 'meera' },
  place: { book: 'JHN', ch: 1, v: 1 },
  bookmarks: {},
  likes: {},
  notes: {},
  plan: null,
  readDates: [],
  history: [],
};

function load(): Persisted {
  try {
    let raw = localStorage.getItem(KEY);
    if (!raw) {
      for (const k of LEGACY_KEYS) {
        raw = localStorage.getItem(k);
        if (raw) {
          localStorage.setItem(KEY, raw);
          localStorage.removeItem(k);
          break;
        }
      }
    }
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
  likes = $state<Record<string, Like>>({});
  notes = $state<Record<string, Note>>({});
  plan = $state<PlanProgress | null>(null);
  readDates = $state<string[]>([]);
  history = $state<Ref[]>([]);

  constructor() {
    const p = load();
    this.settings = p.settings;
    this.place = p.place;
    this.bookmarks = p.bookmarks;
    this.likes = p.likes;
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
        likes: $state.snapshot(this.likes),
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

  isLiked(ref: Ref): boolean {
    return refKey(ref) in this.likes;
  }

  /** Double-tap on a verse: a red heart. Separate from bookmarks. */
  toggleLike(ref: Ref) {
    const k = refKey(ref);
    const next = { ...this.likes };
    if (k in next) delete next[k];
    else next[k] = { at: new Date().toISOString() };
    this.likes = next;
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
