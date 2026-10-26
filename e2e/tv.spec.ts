import { expect, test } from '@playwright/test';
import { card, expectNoErrors, openWith, pageErrors } from './helpers';

test.describe('TV', () => {
  test('a TV link opens TV mode; remote keys move; Escape returns to the reader', async ({ page }) => {
    const errors = pageErrors(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await openWith(page, {}, '?tv=1&ref=JHN.3.16&t=en-ult');
    const ref = page.locator('.tv .ref');
    await expect(ref).toContainText('John 3:16');
    expect(await page.evaluate(() => !!document.fullscreenElement)).toBe(false);
    await page.keyboard.press('ArrowRight');
    await expect(ref).toContainText('3:17');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(ref).toContainText('3:15');
    await page.keyboard.press('Escape');
    await expect(page.locator('.tv')).toHaveCount(0);
    await expect(card(page, '3:15').locator('.text')).toBeInViewport();
    await expectNoErrors(errors);
  });

  test('the sheet gives a QR code and a link to the current verse', async ({ page }) => {
    await openWith(page, { place: { book: 'PSA', ch: 23, v: 1 } });
    const c = card(page, '23:1');
    await c.locator('.rail button[aria-expanded]').click();
    await c.locator('.menu button').last().click();
    const sheet = page.locator('[role=dialog]');
    await sheet.locator('button.row').last().click();
    const link = await sheet.locator('.qrrow .link').innerText();
    expect(new URL(link).searchParams.get('ref')).toBe('PSA.23.1');
    expect(new URL(link).searchParams.get('tv')).toBe('1');
    const modules = await sheet.locator('svg.qr path').evaluate((p) => (p.getAttribute('d') ?? '').split('M').length - 1);
    expect(modules).toBeGreaterThan(100);
    // TV mode on this screen, and the Back button leaves it
    await sheet.locator('button.row').first().click();
    await expect(page.locator('.tv .ref')).toContainText('23:1');
    await page.goBack();
    await expect(page.locator('.tv')).toHaveCount(0);
  });

  test('desktop presenting sends the verse as the reader moves', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      const w = window as unknown as { sent: string[]; startedWith?: string; PresentationRequest: unknown };
      w.sent = [];
      w.PresentationRequest = class {
        urls: string[];
        constructor(urls: string[]) { this.urls = urls; }
        getAvailability() { return Promise.resolve({ value: true }); }
        start() {
          w.startedWith = this.urls[0];
          return Promise.resolve({ state: 'connected', send: (d: string) => w.sent.push(d), terminate() {}, close() {}, onconnect: null, onclose: null });
        }
      };
    });
    await openWith(page, { place: { book: 'JHN', ch: 1, v: 1 } });
    await expect(card(page, '1:1').locator('.text')).toBeVisible();
    await page.locator('nav.bottom button').nth(4).click();
    await page.locator('.settings .tvopen').click();
    const rows = page.locator('[role=dialog] .rows > button.row');
    await expect(rows).toHaveCount(3);
    await rows.nth(1).click();
    expect(await page.evaluate(() => (window as unknown as { startedWith: string }).startedWith)).toContain('receiver=1');
    await page.locator('nav.bottom button').nth(0).click();
    await page.locator('.feed').evaluate((f) => f.scrollBy({ top: f.clientHeight }));
    await expect.poll(() => page.evaluate(() => (window as unknown as { sent: string[] }).sent.at(-1))).toContain('"JHN.1.2"');
  });
});
