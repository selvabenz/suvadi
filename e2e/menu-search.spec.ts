import { expect, test } from '@playwright/test';
import { card, expectNoErrors, nav, openWith, pageErrors } from './helpers';

test.describe('Bible menu, search and settings', () => {
  test('the Bible pill opens the menu and switches translation', async ({ page }) => {
    const errors = pageErrors(page);
    await openWith(page, { place: { book: 'JHN', ch: 3, v: 16 } });
    await expect(page.locator('.pill.tr')).toContainText('தமிழ்');
    await expect(page.locator('.pill.title')).toContainText('யோவா 3');
    await page.locator('.pill.tr').click();
    const items = page.locator('[role=dialog] [role=radio] .nm');
    await expect(items).toHaveCount(6);
    await expect(items.nth(1)).toContainText('हिन्दी');
    await page.locator('[role=dialog] [role=radio]').nth(1).click();
    await expect(page.locator('.pill.tr')).toHaveText(/^हिन्दी/);
    await expect(card(page, '3:16').locator('.text')).toHaveAttribute('lang', 'hi');
    await expectNoErrors(errors);
  });

  test('search finds a book by an English short form while Tamil is open, and keeps history', async ({ page }) => {
    await openWith(page, { settings: { lang: 'en' }, place: { book: 'GEN', ch: 1, v: 1 } });
    await expect(card(page, '1:1').locator('.text')).toBeVisible();
    await nav(page, 3);
    const box = page.locator('.view input[type=search]');
    await box.fill('Jn 3:16-18');
    await page.locator('.btn.goto').click();
    await expect(card(page, '3:16').locator('.text')).toBeInViewport();
    await nav(page, 3);
    await box.fill('கிருபை');
    await page.locator('.view button[type=submit]').click();
    await expect(page.getByText(/^Results:/)).toBeVisible({ timeout: 45_000 });
    await box.fill('');
    await expect(page.locator('.hchip')).toContainText(['யோவான் 3:16']);
    await expect(page.locator('.qrow')).toContainText(['கிருபை']);
  });

  test('settings are grouped, switches work, and About tells the truth about offline', async ({ page }) => {
    await openWith(page, { settings: { lang: 'en' } });
    await nav(page, 4);
    await expect(page.locator('.settings .group')).toHaveCount(7);
    const sw = page.locator('input[role=switch]').nth(2);
    const before = await sw.isChecked();
    await page.locator('.sw-row').nth(2).click();
    expect(await sw.isChecked()).toBe(!before);
    const about = page.locator('.about');
    await expect(about).toContainText('Tamil IRV');
    await expect(about).not.toContainText('whole text is stored on the device');
  });
});
