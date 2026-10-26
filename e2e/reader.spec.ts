import { expect, test } from '@playwright/test';
import { card, currentKey, expectNoErrors, nav, openWith, pageErrors, saved } from './helpers';

test.describe('reader', () => {
  test('opens a long book at the saved verse and fills only the cards near it', async ({ page }) => {
    const errors = pageErrors(page);
    await openWith(page, { place: { book: 'PSA', ch: 119, v: 105 } });
    await expect(card(page, '119:105').locator('.text')).toBeVisible();
    expect(await page.locator('.card').count()).toBeGreaterThan(2000); // every verse has a card…
    expect(await page.locator('.card .text').count()).toBeLessThanOrEqual(7); // …but only nearby ones are filled
    expect(await currentKey(page)).toBe('119:105');
    await expectNoErrors(errors);
  });

  test('scrolling moves to the next verse and remembers the place', async ({ page }) => {
    await openWith(page, { place: { book: 'JHN', ch: 3, v: 16 } });
    await expect(card(page, '3:16').locator('.text')).toBeVisible();
    await page.locator('.feed').evaluate((f) => f.scrollBy({ top: f.clientHeight }));
    await expect.poll(() => currentKey(page)).toBe('3:17');
    await expect.poll(async () => (await saved(page)).place).toEqual({ book: 'JHN', ch: 3, v: 17 });
    // a far jump still lands on a filled card
    await page.locator('.feed').evaluate((f) => (f.scrollTop = f.clientHeight * 400));
    await expect.poll(async () => page.locator(`.card[data-key="${await currentKey(page)}"] .text`).count()).toBe(1);
  });

  test('the Read tab comes back at the same verse', async ({ page }) => {
    await openWith(page, { place: { book: 'GEN', ch: 1, v: 1 } });
    await expect(card(page, '1:1').locator('.text')).toBeVisible();
    // (snapping stops a smooth scroll at every verse, so jump there directly)
    await page.locator('.feed').evaluate((f) => (f.scrollTop += f.clientHeight * 5));
    await expect.poll(() => currentKey(page)).toBe('1:6');
    await nav(page, 4);
    await expect(page.locator('.settings')).toBeVisible();
    await nav(page, 0);
    await expect(card(page, '1:6').locator('.text')).toBeInViewport();
    expect(await currentKey(page)).toBe('1:6');
  });

  test('a deep link opens that verse and clears the address', async ({ page }) => {
    await openWith(page, {}, '?ref=PSA.23.1');
    await expect(card(page, '23:1').locator('.text')).toBeInViewport();
    expect(page.url()).not.toContain('?');
  });

  test('a long Tamil word is never split across lines', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 760 });
    await openWith(page, { settings: { font: 'tiro', fontScale: 1.6 }, place: { book: '1CO', ch: 1, v: 30 } });
    const text = card(page, '1:30').locator('.text');
    await expect(text).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    // the verse shrinks to fit instead of breaking a word: nothing overflows the column
    await expect.poll(() => text.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(await text.evaluate((el) => el.style.getPropertyValue('--fit'))).not.toBe('');
  });
});
