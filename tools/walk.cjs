// Drive the built app in a real mobile-emulated browser and save screenshots.
// Uses the Edge already installed (Playwright "msedge" channel), so no browser download.
//   node tools/walk.cjs http://localhost:4173/ out-dir
// Playwright is resolved from PLAYWRIGHT_DIR if set (another project's node_modules).
const path = require('node:path');
const fs = require('node:fs');
const pwDir = process.env.PLAYWRIGHT_DIR;
const { chromium, devices } = require(pwDir ? path.join(pwDir, 'playwright') : 'playwright');

const url = process.argv[2] || 'http://localhost:4173/';
const out = process.argv[3] || 'shots';
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'ta-IN' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));

  const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`) });
  const report = {};

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('article.card[data-key="1:1"]', { timeout: 20000 });
  await page.waitForTimeout(500);
  await shot('01-read');
  report.title = await page.locator('header.top .title').innerText();
  report.firstVerse = (await page.locator('article.card[data-key="1:1"] .text').innerText()).slice(0, 80);

  // Swipe: scroll the feed by one screen.
  await page.locator('.feed').evaluate((el) => el.scrollBy({ top: el.clientHeight, behavior: 'instant' }));
  await page.waitForTimeout(600);
  report.afterSwipe = await page.locator('header.top .title').innerText();
  await shot('02-swipe');

  // Study sheet for the current verse.
  await page.locator('article.card[data-key="1:2"] .actions button').first().click();
  await page.waitForSelector('[role="dialog"]');
  await page.waitForTimeout(1500);
  await shot('03-study');
  report.studyHeadings = await page.locator('[role="dialog"] h3').allInnerTexts();
  report.studyWords = await page.locator('[role="dialog"] table.words tbody tr').count();
  report.studyOpenXrefs = await page.locator('[role="dialog"] ul.list li').count();
  // Scroll the sheet body to the words table for a second shot.
  await page.locator('[role="dialog"] table.words').scrollIntoViewIfNeeded();
  await shot('04-study-words');
  await page.locator('[role="dialog"] .close').click();

  // Bookmark + note.
  await page.locator('article.card[data-key="1:2"] .actions button').nth(1).click();
  await page.locator('article.card[data-key="1:2"] .actions button').nth(2).click();
  await page.waitForSelector('[role="dialog"] textarea');
  await page.fill('[role="dialog"] textarea', 'சோதனைக் குறிப்பு');
  await page.locator('[role="dialog"] .btn.primary').click();
  await page.waitForTimeout(300);

  // Picker: go to Psalm 23:1 via typed reference.
  await page.locator('header.top .title').click();
  await page.waitForSelector('[role="dialog"] input');
  await shot('05-picker');
  await page.fill('[role="dialog"] input', 'சங் 23:1');
  await page.locator('[role="dialog"] form .btn.primary').click();
  await page.waitForSelector('article.card[data-key="23:1"]', { timeout: 20000 });
  await page.waitForTimeout(600);
  report.afterPick = await page.locator('header.top .title').innerText();
  report.psalmSuperscription = await page.locator('article.card[data-key="23:1"] .superscription').innerText().catch(() => '(none)');
  await shot('06-psalm23');

  // Red letters: Matthew 5:3.
  await page.locator('header.top .title').click();
  await page.fill('[role="dialog"] input', 'மத் 5:3');
  await page.locator('[role="dialog"] form .btn.primary').click();
  await page.waitForSelector('article.card[data-key="5:3"]', { timeout: 20000 });
  await page.waitForTimeout(600);
  report.wjSpans = await page.locator('article.card[data-key="5:3"] .wj').count();
  report.mat5heading = await page.locator('article.card[data-key="5:1"] .heading').innerText().catch(() => '(none)');
  await shot('07-matthew5');

  // Plan.
  await page.locator('nav.bottom button').nth(1).click();
  await page.locator('.plans .btn.primary').first().click();
  await page.waitForTimeout(300);
  report.planDays = await page.locator('ol.days li').count();
  report.planDay1 = await page.locator('ol.days li .range').first().innerText();
  await shot('08-plan');

  // Saved.
  await page.locator('nav.bottom button').nth(2).click();
  await page.waitForTimeout(800);
  report.savedBookmarks = await page.locator('.list li').count();
  await shot('09-saved');

  // Search.
  await page.locator('nav.bottom button').nth(3).click();
  await page.fill('input[type="search"]', 'நல்ல மேய்ப்பன்');
  await page.locator('form.bar .btn.primary').click();
  await page.waitForSelector('ul.list li', { timeout: 60000 });
  await page.waitForTimeout(500);
  report.searchHits = await page.locator('ul.list li').count();
  report.searchFirst = await page.locator('ul.list li .rref').first().innerText();
  await shot('10-search');

  // Settings, dark theme, English UI.
  await page.locator('nav.bottom button').nth(4).click();
  await page.waitForTimeout(300);
  await shot('11-settings');
  await page.locator('.seg button', { hasText: 'இருள்' }).click();
  await page.locator('.seg button', { hasText: 'English' }).click();
  await page.waitForTimeout(300);
  await shot('12-settings-dark-en');
  await page.locator('nav.bottom button').nth(0).click();
  await page.waitForTimeout(500);
  await shot('13-read-dark');

  // Reload: place and bookmark must persist.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('article.card', { timeout: 20000 });
  await page.waitForTimeout(800);
  report.afterReload = await page.locator('header.top .title').innerText();
  report.swRegistered = await page.evaluate(() => navigator.serviceWorker?.controller ? 'controlled' : (navigator.serviceWorker ? 'registered-not-controlling' : 'none'));

  report.errors = errors;
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
