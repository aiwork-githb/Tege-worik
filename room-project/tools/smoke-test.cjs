// Открывает 3D-сцену в Chromium, перебирает все виды и сценарии света, ловит ошибки консоли.
// Нужен Playwright (npm i -g playwright) и запущенный сервер:
//   cd room-project && python3 -m http.server 8000
//   NODE_PATH=$(npm root -g) node tools/smoke-test.cjs http://localhost:8000/index.html [папка-для-снимков]
const { chromium } = require('playwright');

const url = process.argv[2] || 'http://localhost:8000/index.html';
const shotsDir = process.argv[3];
const VIEWS = ['overview', 'door', 'bed', 'window', 'gaming', 'top'];
const SCENES = ['day', 'general', 'work', 'evening', 'cinema'];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const problems = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
  page.on('requestfailed', (r) => { if (!r.url().includes('fonts.g')) problems.push('request: ' + r.url()); });

  await page.goto(url);
  await page.waitForFunction(() => window.__room && window.__room.ready, null, { timeout: 60000 });

  for (let i = 0; i < VIEWS.length; i++) {
    const view = VIEWS[i], scene = SCENES[i % SCENES.length];
    await page.click(`[data-view="${view}"]`);
    await page.click(`[data-scene="${scene}"]`);
    await page.waitForTimeout(1500);
    if (shotsDir) await page.screenshot({ path: `${shotsDir}/${view}-${scene}.png` });
  }
  await page.click('#door-toggle');
  await page.waitForTimeout(800);

  const state = await page.evaluate(() => ({ ...window.__room }));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (state.errors.length) problems.push(...state.errors);
  if (overflow) problems.push('страница шире окна');

  console.log(`кадров: ${state.frames}, вызовов отрисовки: ${state.calls}, вид: ${state.view}, свет: ${state.scene}`);
  console.log(problems.length ? 'ОШИБКИ:\n' + problems.join('\n') : 'Сцена открывается без ошибок');
  await browser.close();
  process.exit(problems.length ? 1 : 0);
})();
