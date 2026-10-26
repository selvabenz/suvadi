import { expect, type Page } from '@playwright/test';

export interface Saved {
  settings?: Record<string, unknown>;
  place?: { book: string; ch: number; v: number };
  [k: string]: unknown;
}

/** Start the app with this saved state, then open `path` (relative to the app, e.g. "?tv=1"). */
export async function openWith(page: Page, state: Saved, path = ''): Promise<void> {
  await page.goto('');
  await page.evaluate((s) => localStorage.setItem('suvadi:v1', JSON.stringify(s)), state);
  await page.goto(path);
}

/** Collect uncaught page errors; assert none at the end of a test. */
export function pageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

export const card = (page: Page, key: string) => page.locator(`.card[data-key="${key}"]`);

/** The data-key of the card the feed is showing (cards are one screen tall). */
export function currentKey(page: Page): Promise<string | undefined> {
  return page.locator('.feed').evaluate((f) => {
    const i = Math.round(f.scrollTop / f.clientHeight);
    return (f.querySelectorAll('.card')[i] as HTMLElement | undefined)?.dataset.key;
  });
}

export function saved(page: Page): Promise<Saved> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('suvadi:v1') || '{}'));
}

export async function nav(page: Page, i: 0 | 1 | 2 | 3 | 4): Promise<void> {
  await page.locator('nav.bottom button').nth(i).click();
}

export async function expectNoErrors(errors: string[]): Promise<void> {
  expect(errors, errors.join('\n')).toEqual([]);
}
