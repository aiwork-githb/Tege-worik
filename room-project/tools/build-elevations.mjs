// Развёртки стен с электрикой из layout.js:
//   elevations/1-wall-D.svg … 4-wall-A.svg — листы A4 для печати в масштабе 1:25;
//   elevations-web/data.js — данные для страницы elevations-web/index.html.
// Рисует общий скрипт elevations-web/draw.js, поэтому SVG-файлы и страница всегда совпадают.
// Запуск: node room-project/tools/build-elevations.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { ROOM, DOOR, WINDOW, RADIATOR, ITEMS, POWER } from '../layout.js';

const data = { ROOM, DOOR, WINDOW, RADIATOR, ITEMS, POWER };
const web = fileURLToPath(new URL('../elevations-web/', import.meta.url));
const ctx = vm.createContext({});
vm.runInContext(readFileSync(web + 'draw.js', 'utf8'), ctx, { filename: 'draw.js' });
const E = ctx.createElevations(data);

const dir = fileURLToPath(new URL('../elevations/', import.meta.url));
mkdirSync(dir, { recursive: true });
for (const key of E.ORDER) {
  const name = `${E.WALLS[key].n}-wall-${key}.svg`;
  writeFileSync(dir + name, E.sheetSVG(key));
  console.log('записан', 'elevations/' + name);
}

writeFileSync(web + 'data.js',
  '// Создаётся tools/build-elevations.mjs из layout.js — не править вручную.\n' +
  `globalThis.ROOM_DATA = ${JSON.stringify(data, null, 1)};\n`);
console.log('записан', 'elevations-web/data.js');
