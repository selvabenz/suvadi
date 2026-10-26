import type { Ref } from './types';
import { parseRefKey, refKey } from './refs';

// Deep links and TV links:
//   https://…/suvadi/?ref=JHN.3.16&t=ta-irv          open the reader at a verse
//   https://…/suvadi/?tv=1&ref=JHN.3.16&t=ta-irv     open TV mode there (a smart TV's browser)
//   https://…/suvadi/?tv=1&receiver=1                the page a desktop browser presents on a TV
//   #tv                                              TV mode entered from inside the app

export interface AppUrl {
  tv: boolean;
  receiver: boolean;
  ref: Ref | null;
  translation: string | null;
}

export function parseAppUrl(search: string, hash: string): AppUrl {
  const q = new URLSearchParams(search);
  const ref = q.get('ref');
  return {
    tv: q.get('tv') === '1' || hash === '#tv',
    receiver: q.get('receiver') === '1',
    ref: ref ? parseRefKey(ref) : null,
    translation: q.get('t') || null,
  };
}

/** A link that opens TV mode at this verse (base ends with "/"). */
export function tvUrl(base: string, ref: Ref, translation: string): string {
  return `${base}?tv=1&ref=${refKey(ref)}&t=${encodeURIComponent(translation)}`;
}

export function receiverUrl(base: string): string {
  return `${base}?tv=1&receiver=1`;
}

/** The app's own address, e.g. https://selvabenz.github.io/suvadi/ */
export function appBase(): string {
  return `${location.origin}${import.meta.env.BASE_URL}`;
}
