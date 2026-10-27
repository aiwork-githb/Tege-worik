// Картинки развёрток: elevations/1-wall-D.png … 4-wall-A.png.
// Это те же листы A4 альбомные, что выходят при печати страницы elevations-web, примерно 290 dpi.
// Сначала пересоберите данные: node room-project/tools/build-elevations.mjs
// Запуск (нужен Playwright): NODE_PATH=$(npm root -g) node room-project/tools/elevations-png.cjs
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const root = path.join(__dirname, '..');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1240, height: 900 }, deviceScaleFactor: 3 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + path.join(root, 'elevations-web', 'index.html'));
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => document.fonts.ready);
  const keys = await page.$$eval('.sheet', (sheets) => sheets.map((s) => s.dataset.wall));
  for (const [i, key] of keys.entries()) {
    const file = path.join(root, 'elevations', `${i + 1}-wall-${key}.png`);
    await (await page.$(`#sheet-${key}`)).screenshot({ path: file });
    console.log('записан', path.relative(root, file));
  }
  await browser.close();
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
})();
