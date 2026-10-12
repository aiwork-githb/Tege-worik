// Генерирует room-project/plan.svg из layout.js. Единица viewBox = 1 см, печать 1:25.
// Запуск: node room-project/tools/build-plan.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ROOM, DOOR, WINDOW, RADIATOR, ITEMS, TRACKS, POWER } from '../layout.js';
import { runChecks } from './check-layout.mjs';

const W = ROOM.width, L = ROOM.length;
const OX = 80, OY = 95;                 // левый верхний угол комнаты (угол стен C и D)
const X = (x) => OX + x;
const Y = (y) => OY + (L - y);          // стена C сверху, стена A снизу
const VB_W = 820, VB_H = 720;

const C = {
  ink: '#2E2C2A', muted: '#6E6862', floor: '#F2ECE3', wall: '#4B4743', wallHatch: '#77716A',
  oak: '#DCC29E', oakDark: '#B8956A', enamel: '#E6E1DA', graphite: '#3A3836', soft: '#B9B2A8',
  linen: '#F6F2EC', rug: '#E4DED5', dim: '#2E2C2A', pass: '#2F7D55', power: '#2C64B0', ceiling: '#7A5FA8',
};
const FONT = "Golos Text, 'PT Sans', Arial, sans-serif";
const MONO = "'JetBrains Mono', 'DejaVu Sans Mono', monospace";

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const item = (id) => ITEMS.find((i) => i.id === id);
const out = [];
const push = (s) => out.push(s);

const rect = (x0, x1, y0, y1, attrs = '') =>
  `<rect x="${X(x0)}" y="${Y(y1)}" width="${x1 - x0}" height="${y1 - y0}" ${attrs}/>`;
const text = (x, y, s, attrs = '') => `<text x="${x}" y="${y}" ${attrs}>${esc(s)}</text>`;

// ---------- размерные цепочки ----------
function dimH(xs, yLine, yFrom, label = (a, b) => String(b - a), opts = {}) {
  const g = [];
  g.push(`<line x1="${X(xs[0])}" y1="${yLine}" x2="${X(xs[xs.length - 1])}" y2="${yLine}" stroke="${C.dim}" stroke-width="0.6"/>`);
  xs.forEach((x) => {
    g.push(`<line x1="${X(x)}" y1="${yFrom}" x2="${X(x)}" y2="${yLine + (yFrom > yLine ? -3 : 3)}" stroke="${C.dim}" stroke-width="0.35"/>`);
    g.push(`<line x1="${X(x) - 2.5}" y1="${yLine + 2.5}" x2="${X(x) + 2.5}" y2="${yLine - 2.5}" stroke="${C.dim}" stroke-width="0.9"/>`);
  });
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1];
    const t = label(a, b);
    const small = b - a < 18;
    const tx = (X(a) + X(b)) / 2 + (small ? (opts.smallShift ?? 0) : 0);
    g.push(text(tx, yLine - 2.5, t, `font-family="${MONO}" font-size="${small ? 6.5 : 8}" text-anchor="middle" fill="${C.dim}"`));
  }
  return g.join('\n');
}
function dimV(ys, xLine, xFrom, label = (a, b) => String(b - a), opts = {}) {
  const g = [];
  g.push(`<line x1="${xLine}" y1="${Y(ys[0])}" x2="${xLine}" y2="${Y(ys[ys.length - 1])}" stroke="${C.dim}" stroke-width="0.6"/>`);
  ys.forEach((y) => {
    g.push(`<line x1="${xFrom}" y1="${Y(y)}" x2="${xLine + (xFrom > xLine ? -3 : 3)}" y2="${Y(y)}" stroke="${C.dim}" stroke-width="0.35"/>`);
    g.push(`<line x1="${xLine - 2.5}" y1="${Y(y) + 2.5}" x2="${xLine + 2.5}" y2="${Y(y) - 2.5}" stroke="${C.dim}" stroke-width="0.9"/>`);
  });
  for (let i = 0; i < ys.length - 1; i++) {
    const a = ys[i], b = ys[i + 1];
    const small = b - a < 18;
    const cy = (Y(a) + Y(b)) / 2;
    const off = small ? (opts.smallOffset ?? -9) : -2.5;
    g.push(`<text x="${xLine + off}" y="${cy}" font-family="${MONO}" font-size="${small ? 6.5 : 8}" text-anchor="middle" fill="${C.dim}" transform="rotate(-90 ${xLine + off} ${cy})">${esc(label(a, b))}</text>`);
  }
  return g.join('\n');
}
// зелёная размерная линия прохода
function passH(x0, x1, y, label) {
  const yy = Y(y);
  return `<g stroke="${C.pass}" fill="${C.pass}">
  <line x1="${X(x0) + 1}" y1="${yy}" x2="${X(x1) - 1}" y2="${yy}" stroke-width="0.9" marker-start="url(#arrowG)" marker-end="url(#arrowG)"/>
  <rect x="${(X(x0) + X(x1)) / 2 - 13}" y="${yy - 6.2}" width="26" height="9" rx="2" fill="#FFFFFF" stroke="none" opacity="0.9"/>
  <text x="${(X(x0) + X(x1)) / 2}" y="${yy + 1}" stroke="none" font-family="${MONO}" font-size="7.5" font-weight="700" text-anchor="middle">${esc(label)}</text></g>`;
}
function passV(x, y0, y1, label) {
  const xx = X(x);
  const cy = (Y(y0) + Y(y1)) / 2;
  return `<g stroke="${C.pass}" fill="${C.pass}">
  <line x1="${xx}" y1="${Y(y0) - 1}" x2="${xx}" y2="${Y(y1) + 1}" stroke-width="0.9" marker-start="url(#arrowG)" marker-end="url(#arrowG)"/>
  <rect x="${xx - 13}" y="${cy - 6.2}" width="26" height="9" rx="2" fill="#FFFFFF" stroke="none" opacity="0.9"/>
  <text x="${xx}" y="${cy + 1}" stroke="none" font-family="${MONO}" font-size="7.5" font-weight="700" text-anchor="middle">${esc(label)}</text></g>`;
}
const badge = (x, y, n) => `<g><circle cx="${X(x)}" cy="${Y(y)}" r="6" fill="${C.ink}"/>` +
  `<text x="${X(x)}" y="${Y(y) + 2.4}" font-family="${MONO}" font-size="7" font-weight="700" text-anchor="middle" fill="#FFFFFF">${n}</text></g>`;

// ---------- документ ----------
push(`<?xml version="1.0" encoding="UTF-8"?>`);
push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB_W} ${VB_H}" width="${VB_W * 0.4}mm" height="${VB_H * 0.4}mm" font-family="${FONT}">`);
push(`<title>План спальни подростка 365×525, М 1:25</title>`);
push(`<defs>
  <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="6" height="6" fill="${C.wall}"/><line x1="0" y1="0" x2="0" y2="6" stroke="${C.wallHatch}" stroke-width="1.2"/></pattern>
  <pattern id="perf" width="4" height="4" patternUnits="userSpaceOnUse">
    <rect width="4" height="4" fill="#5A5652"/><rect x="1" y="1" width="2" height="2" fill="#8E8983"/></pattern>
  <pattern id="peg" width="3" height="3" patternUnits="userSpaceOnUse">
    <rect width="3" height="3" fill="${C.graphite}"/><circle cx="1.5" cy="1.5" r="0.6" fill="#9A948D"/></pattern>
  <pattern id="shelf" width="4" height="4" patternUnits="userSpaceOnUse">
    <rect width="4" height="4" fill="#E9D7BD"/><line x1="0" y1="2" x2="4" y2="2" stroke="#9C7A55" stroke-width="0.6"/></pattern>
  <marker id="arrowG" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 z" fill="${C.pass}"/></marker>
</defs>`);
push(`<rect width="${VB_W}" height="${VB_H}" fill="#FFFFFF"/>`);

// пол
push(rect(0, W, 0, L, `fill="${C.floor}"`));
// планки пола (кварцвинил 18 см, вдоль длинной стороны)
for (let x = 18; x < W; x += 18) push(`<line x1="${X(x)}" y1="${Y(L)}" x2="${X(x)}" y2="${Y(0)}" stroke="#E6DDD0" stroke-width="0.4"/>`);

// стены
const T = ROOM.walls;
push(`<path fill-rule="evenodd" fill="url(#hatch)" stroke="${C.ink}" stroke-width="0.8" d="
  M ${X(-T.D)} ${Y(L + T.C)} H ${X(W + T.B)} V ${Y(-T.A)} H ${X(-T.D)} Z
  M ${X(0)} ${Y(L)} V ${Y(0)} H ${X(W)} V ${Y(L)} Z"/>`);

// окно в стене C
push(`<rect x="${X(WINDOW.x0)}" y="${Y(L + T.C)}" width="${WINDOW.x1 - WINDOW.x0}" height="${T.C}" fill="#FFFFFF" stroke="${C.ink}" stroke-width="0.6"/>`);
[0.35, 0.5, 0.65].forEach((k) => push(`<line x1="${X(WINDOW.x0)}" y1="${Y(L + T.C * k)}" x2="${X(WINDOW.x1)}" y2="${Y(L + T.C * k)}" stroke="${C.ink}" stroke-width="${k === 0.5 ? 0.9 : 0.5}"/>`));
push(text(X((WINDOW.x0 + WINDOW.x1) / 2), Y(L + T.C) - 4, 'окно 128×150, подоконник 74, без свеса', `font-size="7" text-anchor="middle" fill="${C.muted}"`));

// дверной проём, полотно открыто на 90°, дуга открывания
push(`<rect x="${X(DOOR.x0)}" y="${Y(0)}" width="${DOOR.x1 - DOOR.x0}" height="${T.A}" fill="#FFFFFF" stroke="${C.ink}" stroke-width="0.6"/>`);
push(`<path d="M ${X(DOOR.x0)} ${Y(0)} A ${DOOR.swing} ${DOOR.swing} 0 0 1 ${X(DOOR.hingeX)} ${Y(DOOR.swing)}" fill="none" stroke="${C.ink}" stroke-width="0.6" stroke-dasharray="3 2"/>`);
push(`<rect x="${X(DOOR.hingeX)}" y="${Y(DOOR.swing)}" width="4" height="${DOOR.swing}" fill="${C.oakDark}" stroke="${C.ink}" stroke-width="0.6"/>`);
push(text(X((DOOR.x0 + DOOR.x1) / 2), Y(0) + T.A + 9, 'дверь 70×200, внутрь', `font-size="7" text-anchor="middle" fill="${C.muted}"`));

// ковёр
const rug = item('rug');
push(rect(rug.x0, rug.x1, rug.y0, rug.y1, `fill="${C.rug}" stroke="${C.muted}" stroke-width="0.5" stroke-dasharray="2 2"`));
// линии площадки на ковре
push(`<g fill="none" stroke="#FFFFFF" stroke-width="1.2">
  ${rect(rug.x0 + 8, rug.x1 - 8, rug.y0 + 8, rug.y1 - 8, '')}
  ${rect(rug.x0 + 55, rug.x1 - 55, rug.y0 + 8, rug.y0 + 85, '')}
  <circle cx="${X((rug.x0 + rug.x1) / 2)}" cy="${Y(rug.y0 + 85)}" r="25"/>
  <line x1="${X(rug.x0 + 8)}" y1="${Y((rug.y0 + rug.y1) / 2 + 25)}" x2="${X(rug.x1 - 8)}" y2="${Y((rug.y0 + rug.y1) / 2 + 25)}"/>
</g>`);

// 1 шкаф-купе
const wr = item('wardrobe');
push(rect(wr.x0, wr.x1, wr.y0, wr.y1 - 10, `fill="${C.enamel}" stroke="${C.ink}" stroke-width="0.8"`));
push(rect(wr.x0, wr.x0 + 106, wr.y1 - 10, wr.y1 - 5, `fill="url(#perf)" stroke="${C.ink}" stroke-width="0.5"`));
push(rect(wr.x1 - 106, wr.x1, wr.y1 - 5, wr.y1, `fill="url(#perf)" stroke="${C.ink}" stroke-width="0.5"`));
push(text(X(105), Y(32), 'Шкаф-купе 210×60×255', `font-size="8.5" text-anchor="middle" fill="${C.ink}" font-weight="600"`));
push(text(X(105), Y(22), 'двери: перфорированный МДФ, графит', `font-size="6.5" text-anchor="middle" fill="${C.muted}"`));
push(badge(14, 30, 1));

// 4 изголовье, 2 кровать
const hb = item('headboard');
push(rect(hb.x0, hb.x1, hb.y0, hb.y1, `fill="${C.soft}" stroke="${C.ink}" stroke-width="0.6"`));
const bed = item('bed');
push(rect(bed.x0, bed.x1, bed.y0, bed.y1, `fill="${C.oak}" stroke="${C.ink}" stroke-width="0.8"`));
push(rect(bed.x0 + 25, bed.x1 - 25, bed.y0 + 25, bed.y1 - 25, `fill="none" stroke="${C.oakDark}" stroke-width="0.5" stroke-dasharray="3 2"`));
push(rect(bed.x0 + 5, bed.x1 - 5, bed.y0 + 5, bed.y1 - 5, `fill="${C.linen}" stroke="${C.muted}" stroke-width="0.5"`));
push(rect(bed.x0 + 9, bed.x0 + 42, bed.y0 + 12, bed.y0 + 70, `fill="#FFFFFF" stroke="${C.muted}" stroke-width="0.5" rx="4"`));
push(rect(bed.x0 + 9, bed.x0 + 42, bed.y0 + 80, bed.y0 + 138, `fill="#FFFFFF" stroke="${C.muted}" stroke-width="0.5" rx="4"`));
push(rect(bed.x1 - 32, bed.x1 - 8, bed.y0 + 6, bed.y1 - 6, `fill="#C7652F" opacity="0.85" stroke="none"`));
const bedMid = (bed.y0 + bed.y1) / 2;
push(text(X(140), Y(bedMid + 7), 'Кровать 140×200', `font-size="8.5" text-anchor="middle" fill="${C.ink}" font-weight="600"`));
push(text(X(140), Y(bedMid - 3), 'рама 150×210, парящая', `font-size="6.5" text-anchor="middle" fill="${C.muted}"`));
push(text(X(140), Y(bedMid - 12), 'плед — оранжевый', `font-size="6" text-anchor="middle" fill="${C.muted}"`));
push(badge(150, bed.y1 - 15, 2));
push(badge(14, hb.y1 - 8, 4));

// 5 тумба
const ns = item('nightstand');
push(rect(ns.x0, ns.x1, ns.y0, ns.y1, `fill="${C.oak}" stroke="${C.ink}" stroke-width="0.7"`));
push(badge(28, (ns.y0 + ns.y1) / 2, 5));

// 6 стол, 7 полки (выше), 8 тумба (под столом)
const sd = item('studyDesk');
push(rect(sd.x0, sd.x1, sd.y0, sd.y1, `fill="${C.oak}" stroke="${C.ink}" stroke-width="0.8"`));
const sh = item('shelves');
push(rect(sh.x0, sh.x1, sh.y0, sh.y1, `fill="none" stroke="${C.ceiling}" stroke-width="0.7" stroke-dasharray="4 2"`));
const pd = item('pedestal');
push(rect(pd.x0, pd.x1, pd.y0, pd.y1, `fill="none" stroke="${C.muted}" stroke-width="0.6" stroke-dasharray="2 2"`));
for (const h of [365, 381]) push(`<line x1="${X(pd.x0 + 3)}" y1="${Y(h)}" x2="${X(pd.x1 - 3)}" y2="${Y(h)}" stroke="${C.muted}" stroke-width="0.4" stroke-dasharray="2 2"/>`);
push(`<text x="${X(46)}" y="${Y(433)}" font-size="8" font-weight="600" fill="${C.ink}" text-anchor="middle" transform="rotate(-90 ${X(46)} ${Y(433)})">Стол 130×65</text>`);
push(badge(46, 466, 6));
push(badge(15, 433, 7));
push(badge(30, (pd.y0 + pd.y1) / 2, 8));

// 9, 11 кресла
for (const id of ['studyChair', 'gamingChair']) {
  const ch = item(id);
  push(rect(ch.x0, ch.x1, ch.y0, ch.y1, `fill="none" stroke="${C.ink}" stroke-width="0.6" stroke-dasharray="3 2" rx="8"`));
  const cx = (ch.x0 + ch.x1) / 2, cy = (ch.y0 + ch.y1) / 2;
  push(`<circle cx="${X(cx)}" cy="${Y(cy)}" r="20" fill="#FFFFFF" stroke="${C.ink}" stroke-width="0.6"/>`);
  push(badge(cx, cy, ch.n));
}

// 10 игровой стол, мониторы, 12 перфопанель
const gd = item('gamingDesk');
push(rect(gd.x0, gd.x1, gd.y0, gd.y1, `fill="${C.oak}" stroke="${C.ink}" stroke-width="0.8"`));
const gMid = (gd.y0 + gd.y1) / 2;
push(`<line x1="${X(327)}" y1="${Y(gMid - 60)}" x2="${X(330)}" y2="${Y(gMid - 1)}" stroke="${C.graphite}" stroke-width="2.4"/>`);
push(`<line x1="${X(330)}" y1="${Y(gMid + 1)}" x2="${X(327)}" y2="${Y(gMid + 60)}" stroke="${C.graphite}" stroke-width="2.4"/>`);
push(rect(gd.x0 + 4, gd.x1 - 4, gd.y0, gd.y0 + 4, `fill="${C.graphite}" stroke="none"`));
push(`<text x="${X(312)}" y="${Y(gMid)}" font-size="8" font-weight="600" fill="${C.ink}" text-anchor="middle" transform="rotate(-90 ${X(312)} ${Y(gMid)})">Игровой стол 140×70</text>`);
const pg = item('pegboard');
push(rect(pg.x0 - 2, pg.x1, pg.y0, pg.y1, `fill="url(#peg)" stroke="${C.ink}" stroke-width="0.4"`));
push(badge(345, gd.y0 + 14, 10));
push(badge(352, pg.y1 - 8, 12));

// 13 медиатумба, 18 экран, 17 проектор и луч
const cs = item('console');
push(rect(cs.x0, cs.x1, cs.y0, cs.y1, `fill="${C.oak}" stroke="${C.ink}" stroke-width="0.8"`));
push(`<text x="${X(341)}" y="${Y(225)}" font-size="7.5" font-weight="600" fill="${C.ink}" text-anchor="middle" transform="rotate(-90 ${X(341)} ${Y(225)})">Медиатумба 200×40</text>`);
push(badge(341, 140, 13));
const sc = item('screen');
push(`<line x1="${X(362)}" y1="${Y(115)}" x2="${X(362)}" y2="${Y(336)}" stroke="#111111" stroke-width="2.4"/>`);
push(rect(sc.x0, sc.x1, sc.y0, sc.y1, `fill="none" stroke="${C.ceiling}" stroke-width="0.6" stroke-dasharray="4 2"`));
push(badge(318, 108, 18));
const pj = item('projector');
push(`<g stroke="${C.ceiling}" stroke-width="0.5" stroke-dasharray="1 2" fill="none">
  <line x1="${X(pj.x1)}" y1="${Y(225.5)}" x2="${X(362)}" y2="${Y(115)}"/>
  <line x1="${X(pj.x1)}" y1="${Y(225.5)}" x2="${X(362)}" y2="${Y(336)}"/></g>`);
push(rect(pj.x0, pj.x1, pj.y0, pj.y1, `fill="#FFFFFF" stroke="${C.ceiling}" stroke-width="0.8" stroke-dasharray="3 1.5"`));
push(badge(75, 254, 17));

// треки
for (const t of TRACKS) {
  push(`<line x1="${X(t.x)}" y1="${Y(t.y0)}" x2="${X(t.x)}" y2="${Y(t.y1)}" stroke="${C.ceiling}" stroke-width="1.1" stroke-dasharray="10 3 2 3"/>`);
}

// 14 сиденье, радиатор, 15 короб над окном
const ws = item('windowSeat');
push(rect(ws.x0, ws.x1, ws.y0, ws.y1, `fill="${C.oak}" stroke="${C.ink}" stroke-width="0.8"`));
push(rect(RADIATOR.x0 - 5, RADIATOR.x1 + 5, 512, 522, `fill="${C.oakDark}" stroke="${C.ink}" stroke-width="0.4"`));
for (let x = RADIATOR.x0; x < RADIATOR.x1; x += 4) push(`<line x1="${X(x)}" y1="${Y(521)}" x2="${X(x)}" y2="${Y(513)}" stroke="${C.ink}" stroke-width="0.4"/>`);
push(rect(RADIATOR.x0, RADIATOR.x1, RADIATOR.y0, RADIATOR.y1, `fill="none" stroke="#B03A2E" stroke-width="0.7" stroke-dasharray="3 2"`));
push(text(X(160), Y(494), 'Сиденье у окна 230×50, h 45', `font-size="7.5" text-anchor="middle" fill="${C.ink}" font-weight="600"`));
push(text(X(160), Y(485), 'под ним радиатор 100×30 (пунктир)', `font-size="6" text-anchor="middle" fill="${C.muted}"`));
const sf = item('soffit');
push(rect(sf.x0, sf.x1, sf.y0, sf.y1, `fill="none" stroke="${C.ceiling}" stroke-width="0.7" stroke-dasharray="6 3"`));
push(badge(80, 500, 14));

// 34, 35 книжные шкафы в углах стены C: к сиденью — открытые полки, к столу — шкаф
for (const id of ['studyBookcase', 'gamingBookcase']) {
  const bc = item(id);
  const seatSide = bc.openTo === '+x' ? [bc.split, bc.x1] : [bc.x0, bc.split];
  const zoneSide = bc.openTo === '+x' ? [bc.x0, bc.split] : [bc.split, bc.x1];
  push(rect(bc.x0, bc.x1, bc.y0, bc.y1, `fill="${C.oak}" stroke="${C.ink}" stroke-width="0.8"`));
  push(rect(seatSide[0], seatSide[1], bc.y0 + 2, bc.y1 - 2, `fill="url(#shelf)" stroke="${C.oakDark}" stroke-width="0.5"`));
  push(`<line x1="${X(bc.split)}" y1="${Y(bc.y0)}" x2="${X(bc.split)}" y2="${Y(bc.y1)}" stroke="${C.ink}" stroke-width="0.6"/>`);
  push(`<line x1="${X(zoneSide[0] + 3)}" y1="${Y(bc.y0 + 1.5)}" x2="${X(zoneSide[1] - 3)}" y2="${Y(bc.y0 + 1.5)}" stroke="${C.ink}" stroke-width="1.2"/>`);
  push(badge((seatSide[0] + seatSide[1]) / 2, 500, bc.n));
}
push(rect(333, 354, 478, 523, `fill="none" stroke="${C.muted}" stroke-width="0.6" stroke-dasharray="2 2"`));
push(badge(272, 500, 15));

// 16 кольцо и держатель мяча
const hp = item('hoop');
push(`<path d="M ${X(258.5)} ${Y(0)} A 11.5 11.5 0 0 0 ${X(281.5)} ${Y(0)}" fill="none" stroke="${C.ceiling}" stroke-width="0.8" stroke-dasharray="2 1.5"/>`);
push(rect(hp.x0, hp.x1, 0, 2, `fill="${C.ceiling}" opacity="0.6"`));
push(`<circle cx="${X(353)}" cy="${Y(35)}" r="12" fill="none" stroke="${C.ink}" stroke-width="0.7"/>`);
push(badge(270, 40, 16));
push(badge(332, 35, 16));
push(badge(258, rug.y0 + 15, 30));

// проходы
push(passV(150, 60, bed.y0, String(bed.y0 - 60)));
push(passH(215, 325, bed.y1 - 30, '110'));
push(passH(135, 225, 433, '90'));
push(passH(235, 305, 100, '70'));

// электроточки
const powerXY = (p) => {
  if (p.wall === 'A') return [X(p.pos), Y(0) - 5];
  if (p.wall === 'C') return [X(p.pos), Y(L) + 5];
  if (p.wall === 'B') return [X(W) - 5, Y(p.pos)];
  if (p.wall === 'D') return [X(0) + 5, Y(p.pos)];
  return [X(p.x), Y(p.y)];
};
for (const p of POWER) {
  const [px, py] = powerXY(p);
  if (p.type === 'socket') {
    push(`<circle cx="${px}" cy="${py}" r="4.6" fill="${C.power}"/><text x="${px}" y="${py + 2.2}" font-family="${MONO}" font-size="6" font-weight="700" fill="#FFFFFF" text-anchor="middle">${p.count}</text>`);
  } else if (p.type === 'switch') {
    push(`<rect x="${px - 4.2}" y="${py - 4.2}" width="8.4" height="8.4" fill="${C.power}"/><text x="${px}" y="${py + 2.2}" font-family="${MONO}" font-size="6" font-weight="700" fill="#FFFFFF" text-anchor="middle">S</text>`);
  } else {
    push(`<path d="M ${px} ${py - 5} L ${px + 5} ${py} L ${px} ${py + 5} L ${px - 5} ${py} Z" fill="#FFFFFF" stroke="${C.power}" stroke-width="1.2"/>`);
  }
  const lx = p.wall === 'B' ? px - 8 : p.wall === 'D' ? px + 8 : px + 7;
  const ly = p.wall === 'A' ? py - 6 : p.wall === 'C' ? py + 10 : py + 2.5;
  const anchor = p.wall === 'B' ? 'end' : 'start';
  push(text(lx, ly, p.id, `font-family="${MONO}" font-size="5.5" fill="${C.power}" text-anchor="${anchor}"`));
}

// размеры
push(dimH([0, 65, WINDOW.x0, WINDOW.x1, 295, W], Y(L + T.C) - 16, Y(L + T.C) - 2));
push(dimH([0, W], Y(L + T.C) - 32, Y(L + T.C) - 2));
push(dimH([0, wr.x1, DOOR.x0, DOOR.x1, W], Y(0) + T.A + 22, Y(0) + T.A + 2));
push(dimH([0, W], Y(0) + T.A + 40, Y(0) + T.A + 2));
push(dimV([0, 60, bed.y0, bed.y1, ns.y0, ns.y1, sd.y0, sd.y1, L], X(-T.D) - 14, X(-T.D) - 2, undefined, { smallOffset: -9 }));
push(dimV([0, L], X(-T.D) - 36, X(-T.D) - 2));
push(dimV([0, cs.y0, cs.y1, gd.y0, gd.y1, L], X(W + T.B) + 16, X(W + T.B) + 2, undefined, { smallOffset: -9 }));
push(dimV([0, L], X(W + T.B) + 36, X(W + T.B) + 2));

// подписи стен
const wallLabel = (x, y, s, rot = 0) => `<text x="${x}" y="${y}" font-size="9" font-weight="700" fill="${C.ink}" text-anchor="middle"${rot ? ` transform="rotate(${rot} ${x} ${y})"` : ''}>${esc(s)}</text>`;
push(wallLabel(X(W / 2), Y(L) + 27 - T.C - 22, ''));
push(wallLabel(X(-T.D) - 50, Y(L / 2), 'Стена D', -90));
push(wallLabel(X(W + T.B) + 50, Y(L / 2), 'Стена B — медиастена', 90));
push(wallLabel(X(W / 2), Y(0) + T.A + 56, 'Стена A — вход'));
push(wallLabel(X(W / 2), Y(L + T.C) - 44, 'Стена C — окно (восток)'));

// ---------- правая панель ----------
const PX = 535;
push(text(PX, 38, 'Спальня подростка', `font-size="20" font-weight="800" fill="${C.ink}"`));
push(text(PX, 52, 'План с мебелью · вариант 2 · М 1:25 (лист A3, печать 100 %)', `font-size="7" fill="${C.muted}"`));
push(text(PX, 62, 'Размеры в см. Потолок 260 черновой / 255 чистовой (натяжной).', `font-size="7" fill="${C.muted}"`));

const legend = [
  [1, 'Шкаф-купе, перфорированный МДФ'], [2, 'Кровать парящая 140×200'], [4, 'Мягкие панели изголовья'],
  [5, 'Тумба подвесная'], [6, 'Учебный стол 130×65'], [7, 'Полки над столом (h 120–235)'],
  [8, 'Тумба с 4 ящиками, слева под столом'], [9, 'Кресло для учёбы'], [10, 'Игровой стол 140×70'],
  [11, 'Игровое кресло'], [12, 'Перфопанель (h 135–195)'], [13, 'Медиатумба (h 15–55)'],
  [14, 'Сиденье у окна (h 45)'], [15, 'Дубовый короб над окном (h 235)'], [16, 'Мини-кольцо и держатель мяча'],
  [17, 'Проектор на потолке'], [18, 'Экран 100″, низ на 90'], [30, 'Ковёр 160×230'],
  [34, 'Книжный шкаф 65×50×235 у учёбы'], [35, 'Книжный шкаф 70×50×235 у игры'],
];
push(text(PX, 84, 'МЕБЕЛЬ И ОБОРУДОВАНИЕ', `font-size="7" font-weight="700" letter-spacing="0.8" fill="${C.ink}"`));
legend.forEach(([n, s], i) => {
  const y = 98 + i * 11.5;
  push(`<circle cx="${PX + 5}" cy="${y - 2.6}" r="5" fill="${C.ink}"/><text x="${PX + 5}" y="${y - 0.4}" font-family="${MONO}" font-size="6" font-weight="700" fill="#FFFFFF" text-anchor="middle">${n}</text>`);
  push(text(PX + 14, y, s, `font-size="7.2" fill="${C.ink}"`));
});

const PX2 = 680;
push(text(PX2, 84, 'ЭЛЕКТРИКА', `font-size="7" font-weight="700" letter-spacing="0.8" fill="${C.ink}"`));
const shortPower = {
  E1: 'выключатель, h 90', E2: '1 розетка, h 30, уборка', E3: '4 розетки, h 35, медиа + LAN',
  E4: '4 розетки, h 85, игра', E5: '4 розетки, h 30, ниша ПК + LAN', E6: '1 розетка USB, h 55',
  E7: '2 розетки, h 60, кровать', E8: '1 розетка, h 20, LED', E9: 'бра у кровати, h 105',
  E10: '2 розетки, h 85, учёба', E11: 'LED полок, h 118', E12: 'бра у окна, h 100',
  E13: 'проектор: розетка + HDMI', E14: 'мотор экрана', E15: 'LED в коробе',
  E16: 'LED шкафа у учёбы, h 225', E17: 'LED шкафа у игры, h 225',
};
POWER.forEach((p, i) => {
  const y = 98 + i * 11.5;
  push(text(PX2, y, p.id, `font-family="${MONO}" font-size="6.5" font-weight="700" fill="${C.power}"`));
  push(text(PX2 + 17, y, shortPower[p.id], `font-size="6.8" fill="${C.ink}"`));
});
const sockets = POWER.filter((p) => p.type === 'socket').reduce((a, p) => a + p.count, 0);
push(text(PX2, 98 + POWER.length * 11.5 + 4, `Розеток всего ${sockets}: игра 8, кровать 2, учёба 2`, `font-size="6.5" fill="${C.muted}"`));

// обозначения
const LY = 335;
push(text(PX, LY, 'ОБОЗНАЧЕНИЯ', `font-size="7" font-weight="700" letter-spacing="0.8" fill="${C.ink}"`));
const sym = [
  [(x, y) => `<line x1="${x}" y1="${y}" x2="${x + 20}" y2="${y}" stroke="${C.pass}" stroke-width="0.9" marker-start="url(#arrowG)" marker-end="url(#arrowG)"/>`, 'проход, см (минимум 70)'],
  [(x, y) => `<line x1="${x}" y1="${y}" x2="${x + 20}" y2="${y}" stroke="${C.ceiling}" stroke-width="0.8" stroke-dasharray="4 2"/>`, 'выше 120 см / на потолке'],
  [(x, y) => `<line x1="${x}" y1="${y}" x2="${x + 20}" y2="${y}" stroke="${C.ceiling}" stroke-width="1.1" stroke-dasharray="10 3 2 3"/>`, 'магнитный трек в потолке'],
  [(x, y) => `<rect x="${x}" y="${y - 3}" width="20" height="6" fill="none" stroke="#B03A2E" stroke-width="0.7" stroke-dasharray="3 2"/>`, 'радиатор 100×30, h 6–32'],
  [(x, y) => `<circle cx="${x + 10}" cy="${y}" r="4.6" fill="${C.power}"/><text x="${x + 10}" y="${y + 2.2}" font-family="${MONO}" font-size="6" font-weight="700" fill="#FFFFFF" text-anchor="middle">4</text>`, 'розетки (число в кружке)'],
  [(x, y) => `<path d="M ${x + 10} ${y - 5} L ${x + 15} ${y} L ${x + 10} ${y + 5} L ${x + 5} ${y} Z" fill="#FFFFFF" stroke="${C.power}" stroke-width="1.2"/>`, 'вывод под свет / технику'],
  [(x, y) => `<rect x="${x}" y="${y - 3}" width="20" height="6" fill="url(#hatch)"/>`, 'стены (толщина условная)'],
  [(x, y) => `<path d="M ${x} ${y + 4} A 12 12 0 0 1 ${x + 12} ${y - 8}" fill="none" stroke="${C.ink}" stroke-width="0.6" stroke-dasharray="3 2"/>`, 'открывание двери R 70'],
];
sym.forEach(([draw, s], i) => {
  const col = i % 2, row = Math.floor(i / 2);
  const x = PX + col * 140, y = LY + 16 + row * 15;
  push(draw(x, y));
  push(text(x + 26, y + 2.5, s, `font-size="6.8" fill="${C.ink}"`));
});

// результаты проверки
const CY = 412;
push(text(PX, CY, 'ПРОВЕРКА ПЛАНИРОВКИ (tools/check-layout.mjs)', `font-size="7" font-weight="700" letter-spacing="0.8" fill="${C.ink}"`));
const results = runChecks();
results.forEach((r, i) => {
  const y = CY + 14 + i * 10.5;
  push(text(PX, y, r.ok ? '✓' : '✗', `font-size="8" font-weight="700" fill="${r.ok ? C.pass : '#B03A2E'}"`));
  push(text(PX + 11, y, `${r.group}: ${r.label}`, `font-size="6.8" fill="${C.ink}"`));
});

// компас и масштабная линейка
const KY = 620;
push(`<g transform="translate(${PX + 20} ${KY})">
  <circle r="16" fill="none" stroke="${C.ink}" stroke-width="0.6"/>
  <path d="M -14 0 L 4 -5 L 4 5 Z" fill="${C.ink}"/>
  <text x="-22" y="3" font-size="8" font-weight="700" text-anchor="end" fill="${C.ink}">С</text>
  <text x="0" y="-20" font-size="7" text-anchor="middle" fill="${C.muted}">В (окно)</text>
</g>`);
const SX = PX + 80;
push(`<g>
  <rect x="${SX}" y="${KY - 4}" width="50" height="5" fill="${C.ink}"/>
  <rect x="${SX + 50}" y="${KY - 4}" width="50" height="5" fill="#FFFFFF" stroke="${C.ink}" stroke-width="0.6"/>
  <text x="${SX}" y="${KY + 11}" font-family="${MONO}" font-size="6.5" text-anchor="middle" fill="${C.ink}">0</text>
  <text x="${SX + 50}" y="${KY + 11}" font-family="${MONO}" font-size="6.5" text-anchor="middle" fill="${C.ink}">50</text>
  <text x="${SX + 100}" y="${KY + 11}" font-family="${MONO}" font-size="6.5" text-anchor="middle" fill="${C.ink}">100 см</text>
  <text x="${SX}" y="${KY - 9}" font-size="6.5" fill="${C.muted}">1 м на плане = 40 мм при печати A3</text>
</g>`);
push(text(PX, 690, 'Площадь 19,2 м² · кровать изголовьем к D, экран напротив на B', `font-size="7" fill="${C.muted}"`));
push(text(PX, 701, 'Учёба — у стены D рядом с окном; игра — у стены B рядом с медиастеной', `font-size="7" fill="${C.muted}"`));

push('</svg>');

const target = fileURLToPath(new URL('../plan.svg', import.meta.url));
writeFileSync(target, out.join('\n') + '\n');
console.log('plan.svg записан:', target);
