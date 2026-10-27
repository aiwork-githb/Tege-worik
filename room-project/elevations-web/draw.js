// Развёртки стен с электрикой — общий код рисования.
// Им пользуются страница elevations-web/index.html и tools/build-elevations.mjs (SVG-файлы в elevations/).
// Обычный скрипт без модулей, поэтому страница открывается двойным щелчком, без сервера.
// Единица = 1 см. Вид из комнаты, порядок листов — обход комнаты: D (кровать) → C (окно) → B (экран) → A (дверь).
'use strict';
(function () {
  const C = {
    ink: '#2E2C2A', muted: '#6E6862', wall: '#F4F1EC', oak: '#DCC29E', oakLine: '#A9875E', enamel: '#E6E1DA',
    soft: '#B9B2A8', graphite: '#3A3836', power: '#2C64B0', powerFill: '#E3ECF8', ceiling: '#7A5FA8', glass: '#DCE8F0',
  };
  const FONT = "Golos Text, 'PT Sans', Arial, sans-serif";
  const MONO = "'JetBrains Mono', 'DejaVu Sans Mono', monospace";
  const HALO = 'stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round" paint-order="stroke"'; // подписи читаются поверх мебели
  const SHEET_W = 742, SHEET_H = 525; // A4 альбом × 25
  const OX = 62, OY = 70;              // левый верхний угол стены (угол, черновой потолок)
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fmt = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

  const DEFS = `<defs>
  <pattern id="slats" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#1E1D1C"/><rect x="0.65" width="2.7" height="4" fill="#4A4642"/></pattern>
  <pattern id="perf" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="3" fill="#4A4642"/><rect x="0.8" y="0.8" width="1.4" height="1.4" fill="#8E8983"/></pattern>
  <pattern id="peg" width="2.5" height="2.5" patternUnits="userSpaceOnUse"><rect width="2.5" height="2.5" fill="${C.graphite}"/><circle cx="1.25" cy="1.25" r="0.5" fill="#9A948D"/></pattern>
</defs>`;

  function createElevations(data) {
    const { ROOM, DOOR, WINDOW, RADIATOR, ITEMS, POWER } = data;
    const W = ROOM.width, L = ROOM.length, H = ROOM.height, CEIL = ROOM.ceiling;
    const item = (id) => ITEMS.find((i) => i.id === id);
    const X = (u) => OX + u;
    const Y = (h) => OY + (H - h);

    const WALLS = {
      D: { n: 1, title: 'Стена D — кровать и учебная зона', short: 'Кровать и учёба', len: L, left: 'A', right: 'C', u: (p) => p.y, range: (it) => [it.y0, it.y1] },
      C: { n: 2, title: 'Стена C — окно', short: 'Окно', len: W, left: 'D', right: 'B', u: (p) => p.x, range: (it) => [it.x0, it.x1] },
      B: { n: 3, title: 'Стена B — экран и игровая зона', short: 'Экран и игра', len: L, left: 'C', right: 'A', u: (p) => L - p.y, range: (it) => [L - it.y1, L - it.y0] },
      A: { n: 4, title: 'Стена A — вход', short: 'Вход', len: W, left: 'B', right: 'D', u: (p) => W - p.x, range: (it) => [W - it.x1, W - it.x0] },
    };
    const ORDER = ['D', 'C', 'B', 'A'];
    // позиция точки вдоль стены в координатах развёртки
    const posU = (wall, pos) => ({ D: pos, C: pos, B: L - pos, A: W - pos }[wall]);

    const pointsOf = (key) => POWER.filter((p) => p.wall === key)
      .map((p) => ({ ...p, u: posU(key, p.pos) }))
      .sort((a, b) => a.u - b.u || a.h - b.h);
    // потолочные выводы ближе 80 см к стене показываются на её листе
    const ceilingOf = (key) => POWER.filter((p) => p.wall === 'ceiling')
      .map((p) => ({ ...p, u: WALLS[key].u(p), dist: { D: p.x, C: L - p.y, B: W - p.x, A: p.y }[key] }))
      .filter((p) => p.dist <= 80);
    const counts = (list) => ({
      sockets: list.filter((p) => p.type === 'socket').reduce((a, p) => a + p.count, 0),
      switches: list.filter((p) => p.type === 'switch').length,
      outs: list.filter((p) => p.type === 'out').length,
    });
    const what = (p) => p.wall === 'ceiling' ? 'вывод на потолке'
      : p.type === 'socket' ? `розетка × ${p.count}`
      : p.type === 'switch' ? `выключатель, ${(p.keys || 1) === 2 ? '2 клавиши' : '1 клавиша'}` : 'вывод';

    function symbol(p, x = X(p.u), y = Y(p.h)) {
      if (p.type === 'socket') {
        const pitch = 7.1, w = p.count * pitch + 1.6;
        let s = `<rect x="${x - w / 2}" y="${y - 4.3}" width="${w}" height="8.6" rx="1" fill="${C.powerFill}" stroke="${C.power}" stroke-width="0.8"/>`;
        for (let i = 0; i < p.count; i++) {
          const cx = x - ((p.count - 1) / 2) * pitch + i * pitch;
          s += `<circle cx="${cx}" cy="${y}" r="2.8" fill="#FFFFFF" stroke="${C.power}" stroke-width="0.6"/><circle cx="${cx - 1}" cy="${y}" r="0.5" fill="${C.power}"/><circle cx="${cx + 1}" cy="${y}" r="0.5" fill="${C.power}"/>`;
        }
        return s;
      }
      if (p.type === 'switch') {
        let s = `<rect x="${x - 4.3}" y="${y - 4.3}" width="8.6" height="8.6" rx="1" fill="${C.power}" stroke="${C.power}" stroke-width="0.8"/>`;
        if ((p.keys || 1) === 2) s += `<line x1="${x}" y1="${y - 3.3}" x2="${x}" y2="${y + 3.3}" stroke="#FFFFFF" stroke-width="0.8"/>`;
        else s += `<rect x="${x - 2.2}" y="${y - 3}" width="4.4" height="6" fill="none" stroke="#FFFFFF" stroke-width="0.7"/>`;
        return s;
      }
      const stroke = p.wall === 'ceiling' ? C.ceiling : C.power;
      return `<path d="M ${x} ${y - 4.5} L ${x + 4.5} ${y} L ${x} ${y + 4.5} L ${x - 4.5} ${y} Z" fill="#FFFFFF" stroke="${stroke}" stroke-width="1.1"/>`;
    }

    // Чертёж стены: мебель, проёмы, точки, шкала высот и привязки. Возвращает разметку и рамку чертежа.
    function drawing(key) {
      const wd = WALLS[key];
      const out = [];
      const push = (s) => out.push(s);
      const rect = (u0, u1, h0, h1, a = '') => `<rect x="${X(u0)}" y="${Y(h1)}" width="${u1 - u0}" height="${h1 - h0}" ${a}/>`;
      const line = (u0, h0, u1, h1, a = '') => `<line x1="${X(u0)}" y1="${Y(h0)}" x2="${X(u1)}" y2="${Y(h1)}" ${a}/>`;
      const label = (u, h, s, fill = C.muted) => `<text x="${X(u)}" y="${Y(h)}" font-size="6" fill="${fill}" text-anchor="middle">${esc(s)}</text>`;
      const furn = (u0, u1, h0, h1, fill = C.oak) => push(rect(u0, u1, h0, h1, `fill="${fill}" stroke="${C.oakLine}" stroke-width="0.6"`));
      const R = (id) => wd.range(item(id));
      const pts = pointsOf(key);

      // стена, пол, потолки
      push(rect(0, wd.len, 0, H, `fill="${C.wall}" stroke="none"`));
      push(line(0, CEIL, wd.len, CEIL, `stroke="${C.ink}" stroke-width="0.8"`));
      push(line(0, H, wd.len, H, `stroke="${C.muted}" stroke-width="0.5" stroke-dasharray="4 2"`));
      push(`<text x="${X(wd.len) + 3}" y="${Y(CEIL) + 2}" font-size="5.5" fill="${C.muted}">255 чистовой</text>`);
      push(`<text x="${X(wd.len) + 3}" y="${Y(H) + 2}" font-size="5.5" fill="${C.muted}">260</text>`);

      // ---- мебель и проёмы по стенам
      push('<g class="furniture">');
      if (key === 'D') {
        const [w0, w1] = R('wardrobe'); furn(w0, w1, 0, 255, C.enamel); push(label((w0 + w1) / 2, 140, 'шкаф-купе'));
        const [hb0, hb1] = R('headboard');
        push(rect(hb0, hb1, 0, 150, `fill="${C.soft}" stroke="${C.ink}" stroke-width="0.5"`));
        for (let u = hb0 + (hb1 - hb0) / 8; u < hb1 - 1; u += (hb1 - hb0) / 8) push(line(u, 2, u, 150, `stroke="#A39C93" stroke-width="0.5"`));
        push(label((hb0 + hb1) / 2, 140, 'мягкие панели изголовья, h 150'));
        const [b0, b1] = R('bed'); furn(b0, b1, 14, 34); push(rect(b0 + 5, b1 - 5, 30, 51, `fill="#FFFFFF" stroke="${C.muted}" stroke-width="0.5"`));
        push(rect(b0 + 25, b1 - 25, 0, 14, `fill="${C.graphite}"`)); push(label((b0 + b1) / 2, 38, 'кровать'));
        for (const id of ['nightstandL', 'nightstand']) { const [n0, n1] = R(id); furn(n0, n1, 33, 53); push(label((n0 + n1) / 2, 26, 'тумба')); }
        const [d0, d1] = R('studyDesk'); furn(d0, d1, 72, 75);
        const [p0, p1] = R('pedestal'); furn(p0, p1, 0, 72); for (const h of [18, 36, 54]) push(line(p0 + 2, h, p1 - 2, h, `stroke="${C.oakLine}" stroke-width="0.5"`));
        push(label((p0 + p1) / 2, 4, 'тумба с ящиками'));
        const sh = item('shelves'); const [s0, s1] = R('shelves');
        push(rect(s0, s1, sh.h0, sh.h1, `fill="none" stroke="${C.oakLine}" stroke-width="0.8"`));
        const mid = sh.h0 + sh.board + sh.rows[0].clear;
        for (const h of [sh.h0, mid, sh.h1 - sh.board]) push(rect(s0, s1, h, h + sh.board, `fill="${C.oak}" stroke="none"`));
        push(rect(s0 + 1, (s0 + s1) / 2 - 0.5, mid + sh.board, sh.h1 - sh.board, `fill="${C.oak}" stroke="${C.oakLine}" stroke-width="0.5"`));
        push(rect((s0 + s1) / 2 + 0.5, s1 - 1, mid + sh.board, sh.h1 - sh.board, `fill="${C.oak}" stroke="${C.oakLine}" stroke-width="0.5"`));
        for (let u = s0 + 3; u < s1 - 6; u += 7.8) push(rect(u, u + 6.5, sh.h0 + sh.board, sh.h0 + sh.board + 31.5, `fill="#D9D3CA" stroke="${C.muted}" stroke-width="0.3"`));
        push(label((s0 + s1) / 2, sh.h1 + 3, 'полки: открытый ряд и ряд с дверцами'));
        const [c0, c1] = R('studyBookcase'); furn(c0, c1, 0, 75); furn(c0, c1, 75, 235, '#EAD9BF');
        for (const h of [115, 155, 195]) push(rect(c0, c1, h - 2.5, h, `fill="${C.oak}"`));
        push(label((c0 + c1) / 2, 18, 'книжный шкаф')); furn(c0, c1, 235, 255);
        const [k0, k1] = R('seatBackL'); push(rect(k0, k1, 45, 75, `fill="#CDBFAA" stroke="${C.muted}" stroke-width="0.5"`));
        const [q0, q1] = R('windowSeat'); furn(q0, q1, 36, 45);
      }
      if (key === 'C') {
        for (const id of ['studyBookcase', 'gamingBookcase']) {
          const bc = item(id); const [c0, c1] = R(id);
          const sp = bc.split;
          furn(c0, c1, 0, 235);
          push(line(c0, 72, c1, 72, `stroke="${C.oakLine}" stroke-width="1.2"`));
          push(line((c0 + c1) / 2, 3, (c0 + c1) / 2, 72, `stroke="${C.oakLine}" stroke-width="0.6"`));
          const [z0, z1] = bc.openTo === '+x' ? [c0 + 2, sp - 1] : [sp + 1, c1 - 2];
          push(rect(z0, z1, 75, 188, `fill="#EAD9BF" stroke="none"`));
          for (const h of [115, 152]) push(rect(z0, z1, h - 2.5, h, `fill="${C.oak}"`));
          push(line(z0, 190, z1, 190, `stroke="${C.oakLine}" stroke-width="0.6"`));
          push(label((c0 + c1) / 2, 40, 'дверцы'));
          push(label((c0 + c1) / 2, 210, 'дверца'));
        }
        furn(0, W, 235, 255); push(label(W / 2, 242, 'дубовый короб, LED, римская штора'));
        push(rect(WINDOW.x0, WINDOW.x1, WINDOW.sill, WINDOW.top, `fill="${C.glass}" stroke="${C.ink}" stroke-width="0.8"`));
        push(line((WINDOW.x0 + WINDOW.x1) / 2, WINDOW.sill, (WINDOW.x0 + WINDOW.x1) / 2, WINDOW.top, `stroke="${C.ink}" stroke-width="0.6"`));
        push(rect(WINDOW.x0 - 2, WINDOW.x1 + 2, WINDOW.sill - 2, WINDOW.sill, `fill="#FFFFFF" stroke="${C.ink}" stroke-width="0.5"`));
        push(label((WINDOW.x0 + WINDOW.x1) / 2, 150, 'окно 128×150'));
        const [s0, s1] = R('windowSeat'); furn(s0, s1, 36, 45); push(rect(s0 + 6, s1 - 6, 45, 53, `fill="#E4D7C2" stroke="${C.muted}" stroke-width="0.4"`));
        for (const id of ['seatBackL', 'seatBackR']) { const [b0, b1] = R(id); push(rect(b0, b1, 45, 75, `fill="#CDBFAA" stroke="${C.muted}" stroke-width="0.5"`)); }
        push(rect(RADIATOR.x0, RADIATOR.x1, RADIATOR.h0, RADIATOR.h1, `fill="${C.graphite}"`)); push(label((RADIATOR.x0 + RADIATOR.x1) / 2, 15, 'радиатор', '#FFFFFF'));
        push(label((s0 + s1) / 2 + 40, 57, 'сиденье h 45'));
      }
      if (key === 'B') {
        const [sl0, sl1] = R('slats'); push(rect(sl0, sl1, 0, CEIL, `fill="url(#slats)" stroke="none" opacity="0.55"`));
        push(label((sl0 + sl1) / 2, 232, 'акустические рейки', '#FFFFFF'));
        const [c0, c1] = R('gamingBookcase'); furn(c0, c1, 0, 75); furn(c0, c1, 75, 235, '#EAD9BF');
        for (const h of [115, 155, 195]) push(rect(c0, c1, h - 2.5, h, `fill="${C.oak}"`));
        const [k0, k1] = R('seatBackR'); push(rect(k0, k1, 45, 75, `fill="#CDBFAA" stroke="${C.muted}" stroke-width="0.5"`));
        const [q0, q1] = R('windowSeat'); furn(q0, q1, 36, 45);
        push(label((c0 + c1) / 2, 20, 'шкаф'));
        const [g0, g1] = R('gamingDesk'); furn(g0, g1, 72, 75); push(rect(g1 - 4, g1, 0, 72, `fill="${C.graphite}"`));
        const [pc0, pc1] = R('pc'); push(rect(pc0, pc1, 3, 50, `fill="none" stroke="#CFC9C0" stroke-width="0.6" stroke-dasharray="2 2"`)); push(label((pc0 + pc1) / 2, 25, 'ПК', '#FFFFFF'));
        const gdk = item('gamingDesk');
        push(rect(L - (gdk.y1 - 15), L - (gdk.y0 + 40), 60, 70, `fill="none" stroke="#CFC9C0" stroke-width="0.6" stroke-dasharray="2 2"`));
        push(label(L - (gdk.y1 - 15 + gdk.y0 + 40) / 2, 62.5, 'кабель-канал', '#FFFFFF'));
        for (const yc of [374.5, 435.5]) { const u = L - yc; push(rect(u - 30.5, u + 30.5, 90, 126.5, `fill="#1A1A1A"`)); }
        const [pg0, pg1] = R('pegboard'); push(rect(pg0, pg1, 135, 195, `fill="url(#peg)" stroke="${C.ink}" stroke-width="0.4"`));
        push(label((g0 + g1) / 2, 77, 'игровой стол', '#FFFFFF'));
        const [m0, m1] = R('console'); furn(m0, m1, 15, 55); push(rect((m0 + m1) / 2 - 40, (m0 + m1) / 2 + 40, 55, 61, `fill="#1A1A1A"`));
        push(label(m0 + 45, 30, 'медиатумба'));
        push(rect(m0 + 4, m1 - 4, 12.5, 15, `fill="#F2C27A" stroke="none"`)); push(label((m0 + m1) / 2, 6, 'подсветка под тумбой', '#FFFFFF'));
        // гофры HDMI к проектору: от медиатумбы и от ПК вверх в потолок (в штробе за рейками)
        for (const id of ['E21', 'E18']) {
          const p = POWER.find((q) => q.id === id); const u = posU('B', p.pos) + (id === 'E21' ? 12 : -12);
          push(line(u, p.h, u, CEIL, `stroke="${C.ceiling}" stroke-width="0.8" stroke-dasharray="3 2"`));
        }
        push(`<text x="${X(posU('B', 225) + 14)}" y="${Y(232)}" font-size="5" fill="${C.ceiling}" ${HALO}>гофра HDMI к проектору E24</text>`);
        const [e0, e1] = R('screen'); push(rect(e0, e1, 247, 255, `fill="${C.graphite}"`));
        push(rect(L - 336.4, L - 115, 90, 214.5, `fill="none" stroke="${C.ceiling}" stroke-width="0.8" stroke-dasharray="4 2"`));
        push(label((L - 336.4 + L - 115) / 2, 150, 'экран 100″ опущен (пунктир)', '#FFFFFF'));
        const [h0, h1] = R('ballHolder'); push(`<circle cx="${X((h0 + h1) / 2)}" cy="${Y(120)}" r="12" fill="#9A5634" stroke="${C.ink}" stroke-width="0.5"/>`);
      }
      if (key === 'A') {
        const [w0, w1] = R('wardrobe'); furn(w0, w1, 0, 255, C.enamel);
        const half = (w1 - w0) / 2;
        for (const [a, b] of [[w0 + 2, w0 + half + 1], [w0 + half - 1, w1 - 2]]) push(rect(a, b, 10, 252, `fill="url(#perf)" stroke="${C.graphite}" stroke-width="1.5"`));
        push(`<text x="${X((w0 + w1) / 2)}" y="${Y(130)}" font-size="7" fill="#FFFFFF" text-anchor="middle">шкаф-купе, перфорированные двери</text>`);
        const d0 = W - DOOR.x1, d1 = W - DOOR.x0;
        push(rect(d0 - DOOR.casing, d1 + DOOR.casing, 0, DOOR.height + 12, `fill="${C.enamel}" stroke="${C.ink}" stroke-width="0.5"`));
        push(rect(d0, d1, 0, DOOR.height, `fill="#DAD4CB" stroke="${C.ink}" stroke-width="0.8"`));
        const hingeU = W - DOOR.hingeX;
        const freeU = hingeU === d0 ? d1 : d0;
        push(`<path d="M ${X(freeU)} ${Y(0)} L ${X(hingeU)} ${Y(DOOR.height / 2)} L ${X(freeU)} ${Y(DOOR.height)}" fill="none" stroke="${C.muted}" stroke-width="0.5" stroke-dasharray="3 2"/>`);
        push(label((d0 + d1) / 2, 120, 'дверь 70×200'));
        push(label((d0 + d1) / 2, 112, `петли ${hingeU === d0 ? 'слева' : 'справа'} (к стене B)`));
        const [hp0, hp1] = R('hoop'); push(rect(hp0, hp1, 222, 252, `fill="#FFFFFF" stroke="${C.graphite}" stroke-width="1"`));
        push(line((hp0 + hp1) / 2 - 11.5, 225, (hp0 + hp1) / 2 + 11.5, 225, `stroke="${C.graphite}" stroke-width="1.5"`));
        push(label((hp0 + hp1) / 2, 214, 'мини-кольцо'));
      }
      push('</g>');

      // контур стены и пол
      push(rect(0, wd.len, 0, H, `fill="none" stroke="${C.ink}" stroke-width="1.2"`));
      push(line(-8, 0, wd.len + 8, 0, `stroke="${C.ink}" stroke-width="2"`));
      push(`<text x="${X(0) - 4}" y="${Y(0) + 12}" font-size="7" font-weight="700" text-anchor="end" fill="${C.ink}">угол ${wd.left}</text>`);
      push(`<text x="${X(wd.len) + 4}" y="${Y(0) + 12}" font-size="7" font-weight="700" fill="${C.ink}">угол ${wd.right}</text>`);

      // шкала высот слева
      for (let h = 0; h <= H; h += 10) {
        const big = h % 50 === 0;
        push(`<line x1="${X(0) - (big ? 9 : 5)}" y1="${Y(h)}" x2="${X(0) - 2}" y2="${Y(h)}" stroke="${C.muted}" stroke-width="${big ? 0.6 : 0.3}"/>`);
        if (big) push(`<text x="${X(0) - 11}" y="${Y(h) + 2}" font-family="${MONO}" font-size="5.5" text-anchor="end" fill="${C.muted}">${h}</text>`);
      }

      // привязки от левого угла: ординатные размеры по центрам точек, близкие значения — стопкой
      const cols = [];
      for (const p of pts) {
        const c = cols.find((cl) => Math.abs(cl.u[cl.u.length - 1].u - p.u) < 16);
        if (!c) cols.push({ u: [{ u: p.u, ids: [p.id] }] });
        else {
          const same = c.u.find((v) => v.u === p.u);
          if (same) same.ids.push(p.id); else c.u.push({ u: p.u, ids: [p.id] });
        }
      }
      const baseY = Y(0) + 18;
      push(`<line x1="${X(0)}" y1="${baseY}" x2="${X(wd.len)}" y2="${baseY}" stroke="${C.ink}" stroke-width="0.5"/>`);
      push(`<text x="${X(0)}" y="${baseY + 7}" font-family="${MONO}" font-size="5.5" text-anchor="middle" fill="${C.ink}">0</text>`);
      let stack = 1;
      for (const c of cols) {
        const um = (c.u[0].u + c.u[c.u.length - 1].u) / 2;
        for (const v of c.u) push(`<line class="dim-tick" data-ids="${v.ids.join(' ')}" x1="${X(v.u)}" y1="${Y(0) + 2}" x2="${X(v.u)}" y2="${baseY}" stroke="${C.power}" stroke-width="0.4" stroke-dasharray="1.5 1.5"/>`);
        c.u.forEach((v, i) => push(`<text class="dim-value" data-ids="${v.ids.join(' ')}" x="${X(um)}" y="${baseY + 7 + i * 6.5}" font-family="${MONO}" font-size="5.5" text-anchor="middle" fill="${C.ink}">${fmt(v.u)}</text>`));
        stack = Math.max(stack, c.u.length);
      }
      push(`<text x="${X(wd.len)}" y="${baseY + 7}" font-family="${MONO}" font-size="5.5" text-anchor="middle" fill="${C.ink}">${fmt(wd.len)}</text>`);

      // ---- электроточки; точки одной высоты, стоящие рядом, подписываются вместе
      const groups = [];
      for (const p of pts) {
        const g = groups.find((gr) => gr.h === p.h && Math.abs(gr.items[gr.items.length - 1].u - p.u) < 14);
        if (g) g.items.push(p); else groups.push({ h: p.h, items: [p] });
      }
      for (const p of pts) push(`<g class="pt pt-${p.type}" data-id="${p.id}">${symbol(p)}</g>`);
      for (const g of groups) {
        const u0 = g.items[0].u, u1 = g.items[g.items.length - 1].u;
        const ids = g.items.map((p) => p.id).join(' ');
        const halfW = Math.max(...g.items.map((p) => (p.type === 'socket' ? (p.count * 7.1 + 1.6) / 2 : 4.5)));
        push(`<text class="pt-label" data-ids="${ids}" x="${(X(u0) + X(u1)) / 2}" y="${Y(g.h) - 6.5}" font-family="${MONO}" font-size="5.5" font-weight="700" text-anchor="middle" fill="${C.power}" ${HALO}>${ids}</text>`);
        push(`<text class="pt-label" data-ids="${ids}" x="${X(u1) + halfW + 2}" y="${Y(g.h) + 2}" font-family="${MONO}" font-size="5" fill="${C.power}" ${HALO}>h${fmt(g.h)}</text>`);
      }
      // потолочные выводы у этой стены
      const ceil = ceilingOf(key);
      for (const p of ceil) {
        push(`<g class="pt pt-out pt-ceiling" data-id="${p.id}">${symbol(p, X(p.u), Y(CEIL))}</g>`);
        push(`<text class="pt-label" data-ids="${p.id}" x="${X(p.u) + 6}" y="${Y(CEIL) + 9}" font-family="${MONO}" font-size="5" fill="${C.ceiling}" ${HALO}>${p.id} потолок, ${fmt(p.dist)} от стены</text>`);
      }

      const bottom = baseY + 7 + (stack - 1) * 6.5 + 4;
      return { body: out.join('\n'), pts, ceil, baseY, stack, box: { x: OX - 34, y: OY - 6, w: wd.len + 34 + 44, h: bottom - (OY - 6) } };
    }

    // Лист A4 целиком (заголовок, чертёж, таблица, обозначения) — для SVG-файлов.
    function sheetSVG(key) {
      const wd = WALLS[key];
      const d = drawing(key);
      const out = [];
      const push = (s) => out.push(s);
      push(`<?xml version="1.0" encoding="UTF-8"?>`);
      push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SHEET_W} ${SHEET_H}" width="${SHEET_W * 0.4}mm" height="${SHEET_H * 0.4}mm" font-family="${FONT}">`);
      push(`<title>Развёртка: ${esc(wd.title)}</title>`);
      push(DEFS);
      push(`<rect width="${SHEET_W}" height="${SHEET_H}" fill="#FFFFFF"/>`);

      const n = counts(d.pts);
      push(`<text x="${OX}" y="26" font-size="15" font-weight="800" fill="${C.ink}">Развёртка ${wd.n} из 4 · ${esc(wd.title)}</text>`);
      push(`<text x="${OX}" y="39" font-size="7" fill="${C.muted}">Вид из комнаты: слева угол со стеной ${wd.left}, справа — со стеной ${wd.right}. Привязки — от левого угла до центра изделия, высоты — от чистого пола до центра. М 1:25 (A4).</text>`);
      const list = [n.sockets && `розеток — ${n.sockets}`, n.switches && `выключателей — ${n.switches}`, n.outs && `выводов под свет и технику — ${n.outs}`].filter(Boolean);
      push(`<text x="${OX}" y="50" font-size="7" fill="${C.ink}">На стене: ${list.join(', ')}.</text>`);
      push(d.body);

      // таблица
      const ty = d.baseY + 16 + d.stack * 6.5;
      const TX = [OX, OX + 26, OX + 108, OX + 168, OX + 200];
      push(`<g font-size="6.5" fill="${C.ink}">`);
      ['№', 'Что', 'От угла ' + wd.left + ', см', 'h, см', 'Назначение'].forEach((t, i) => push(`<text x="${TX[i]}" y="${ty}" font-weight="700">${esc(t)}</text>`));
      push(`<line x1="${OX}" y1="${ty + 3}" x2="${SHEET_W - 20}" y2="${ty + 3}" stroke="${C.ink}" stroke-width="0.5"/>`);
      [...d.pts, ...d.ceil].forEach((p, i) => {
        const y = ty + 12 + i * 9.5;
        push(`<text x="${TX[0]}" y="${y}" font-family="${MONO}" font-weight="700" fill="${C.power}">${p.id}</text>`);
        push(`<text x="${TX[1]}" y="${y}">${esc(what(p))}</text>`);
        push(`<text x="${TX[2]}" y="${y}" font-family="${MONO}">${fmt(p.u)}</text>`);
        push(`<text x="${TX[3]}" y="${y}" font-family="${MONO}">${p.wall === 'ceiling' ? '—' : fmt(p.h)}</text>`);
        push(`<text x="${TX[4]}" y="${y}">${esc(p.label)}</text>`);
      });
      push('</g>');

      // условные обозначения
      const LX = SHEET_W - 150, LY = 22;
      LEGEND.forEach(([p, t], i) => {
        const y = LY + i * 11;
        push(symbol(p, LX + 5, y));
        push(`<text x="${LX + 14}" y="${y + 2}" font-size="6" fill="${C.ink}">${esc(t)}</text>`);
      });
      push('</svg>');
      return out.join('\n') + '\n';
    }

    const LEGEND = [
      [{ type: 'socket', count: 1 }, 'розетка (число гнёзд в рамке)'],
      [{ type: 'switch', keys: 1 }, 'выключатель 1 клавиша'],
      [{ type: 'switch', keys: 2 }, 'выключатель 2 клавиши'],
      [{ type: 'out' }, 'вывод под свет / технику'],
    ];

    return { ROOM, DOOR, WINDOW, ITEMS, POWER, WALLS, ORDER, LEGEND, DEFS, COLORS: C, X, Y, fmt, esc, posU, pointsOf, ceilingOf, counts, what, symbol, drawing, sheetSVG };
  }

  globalThis.createElevations = createElevations;
})();
