import { expect, test } from '@playwright/test';
import { card, expectNoErrors, openWith, pageErrors } from './helpers';

test.describe('study page', () => {
  test('opens from the verse menu with its tabs, and Back closes it', async ({ page }) => {
    const errors = pageErrors(page);
    await openWith(page, { settings: { lang: 'en' }, place: { book: 'TIT', ch: 1, v: 1 } });
    const c = card(page, '1:1');
    await c.locator('.rail button[aria-expanded]').click();
    await c.locator('.menu button').first().click();
    const study = page.locator('.page[role=dialog]');
    await expect(study).toBeVisible();
    await expect(page.locator('nav.bottom')).toHaveCount(0);
    await expect(study.locator('[role=tab]')).toHaveText([/My note/, /Footnotes/, /Cross refs/, /Words/, /Helps/]);
    await study.locator('[role=tab]', { hasText: 'Helps' }).click();
    await expect(study.locator('.note').first()).toBeVisible();
    await study.locator('[role=tab]', { hasText: 'Words' }).click();
    await expect(study.locator('.wl li').first()).toBeVisible();
    await study.locator('.back').click();
    await expect(study).toHaveCount(0);
    await expect(page.locator('nav.bottom')).toBeVisible();
    await expectNoErrors(errors);
  });

  test('my note is saved and goes to WhatsApp with the verse', async ({ page }) => {
    await openWith(page, { settings: { lang: 'en' }, place: { book: 'JHN', ch: 1, v: 1 } });
    await page.evaluate(() => {
      (window as unknown as { opened: string[] }).opened = [];
      window.open = ((u: string) => {
        (window as unknown as { opened: string[] }).opened.push(u);
        return null;
      }) as typeof window.open;
    });
    const c = card(page, '1:1');
    await c.locator('.rail button[aria-expanded]').click();
    await c.locator('.menu button').nth(2).click();
    await page.locator('.page textarea').fill('Grace upon grace');
    await page.locator('.share .wa').click();
    const url = decodeURIComponent((await page.evaluate(() => (window as unknown as { opened: string[] }).opened[0])) ?? '');
    expect(url).toContain('wa.me');
    expect(url).toContain('1:1');
    expect(url).toContain('Grace upon grace');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('suvadi:v1')!).notes['JHN.1.1'].text)).toBe('Grace upon grace');
  });

  test('explain: circle words and see the original words (ULT)', async ({ page }) => {
    await openWith(page, { settings: { lang: 'en', translation: 'en-ult' }, place: { book: 'TIT', ch: 1, v: 1 } });
    const c = card(page, '1:1');
    await c.locator('.rail .ai').click();
    const words = c.locator('.w');
    const all = await words.allInnerTexts();
    const i = all.findIndex((w) => w.startsWith('faith'));
    await words.nth(i).click();
    await page.locator('.selbar .btn.primary').click();
    const explain = page.locator('.page .explain');
    await expect(explain).toContainText('faith');
    await expect(page.locator('.page .orig li').first()).toContainText('πίστιν');
    await expect(page.locator('.page .note.hit').first()).toBeVisible();
  });
});
