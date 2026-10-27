// Страница развёрток: ключевой план, листы стен, подсветка точек, фильтры, печать.
// Данные — data.js (из layout.js), чертёж — draw.js.
'use strict';
(function () {
  const E = createElevations(globalThis.ROOM_DATA);
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const el = (tag, attrs = {}, html = '') => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (html) n.innerHTML = html;
    return n;
  };
  const { fmt, esc } = E;

  const plural = (n, one, few, many) => {
    const a = n % 10, b = n % 100;
    return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
  };
  const tally = (c) => [
    c.sockets && `<b>${c.sockets}</b> ${plural(c.sockets, 'розетка', 'розетки', 'розеток')}`,
    c.switches && `<b>${c.switches}</b> ${plural(c.switches, 'выключатель', 'выключателя', 'выключателей')}`,
    c.outs && `<b>${c.outs}</b> ${plural(c.outs, 'вывод', 'вывода', 'выводов')}`,
  ].filter(Boolean).join(', ');
  const pointsWord = (n) => `${n} ${plural(n, 'точка', 'точки', 'точек')}`;

  const typeOf = new Map(E.POWER.map((p) => [p.id, p.type]));
  const byId = new Map(E.POWER.map((p) => [p.id, p]));
  const sheets = {};                       // key → { el, svg, d }
  const state = { view: 'D', pinned: null, hidden: new Set() };

  // маленькая иконка условного знака
  const icon = (p, w = 24, h = 18) => {
    const width = p.type === 'socket' ? p.count * 7.1 + 1.6 : 9;
    return `<svg viewBox="${-Math.max(width, 9) / 2 - 1} -5.5 ${Math.max(width, 9) + 2} 11" width="${w}" height="${h}" aria-hidden="true">${E.symbol(p, 0, 0)}</svg>`;
  };

  // ---------- ключевой план: стены кликабельны, конус показывает, на какую стену смотрим ----------
  const { ROOM, DOOR, WINDOW } = E;
  const RW = ROOM.width, RL = ROOM.length;
  const P = (x, y) => [x, RL - y];          // план: y от стены A вниз → SVG вверх
  const keyplan = $('#keyplan');
  function buildKeyplan() {
    keyplan.setAttribute('viewBox', '-44 -44 453 613');
    const things = E.ITEMS.filter((it) => (it.kind === 'floor' || it.kind === 'hung') && !it.nestedIn)
      .map((it) => { const [x, y] = P(it.x0, it.y1); return `<rect class="thing" x="${x}" y="${y}" width="${it.x1 - it.x0}" height="${it.y1 - it.y0}"/>`; }).join('');
    const seg = (x0, y0, x1, y1) => { const [a, b] = P(x0, y0), [c, d] = P(x1, y1); return `<line class="wall" x1="${a}" y1="${b}" x2="${c}" y2="${d}"/>`; };
    const hit = (x0, y0, x1, y1) => { const [a, b] = P(x0, y0), [c, d] = P(x1, y1); return `<line class="hit" x1="${a}" y1="${b}" x2="${c}" y2="${d}"/>`; };
    const walls = {
      D: { lines: seg(0, 0, 0, RL), hit: hit(0, 0, 0, RL), letter: P(-26, RL / 2) },
      C: { lines: seg(0, RL, WINDOW.x0, RL) + seg(WINDOW.x1, RL, RW, RL), hit: hit(0, RL, RW, RL), letter: P(RW / 2, RL + 26) },
      B: { lines: seg(RW, 0, RW, RL), hit: hit(RW, 0, RW, RL), letter: P(RW + 26, RL / 2) },
      A: { lines: seg(0, 0, DOOR.x0, 0) + seg(DOOR.x1, 0, RW, 0), hit: hit(0, 0, RW, 0), letter: P(RW / 2, -26) },
    };
    const [wx0, wy] = P(WINDOW.x0, RL), [wx1] = P(WINDOW.x1, RL);
    const [hx, hy] = P(DOOR.hingeX, 0);
    const r = DOOR.x1 - DOOR.x0;
    let html = `<rect class="room" x="0" y="0" width="${RW}" height="${RL}"/>${things}<polygon class="cone" id="cone"/><circle class="eye" id="eye" r="9"/>`;
    html += `<line class="window" x1="${wx0}" y1="${wy - 3}" x2="${wx1}" y2="${wy - 3}"/><line class="window" x1="${wx0}" y1="${wy + 3}" x2="${wx1}" y2="${wy + 3}"/>`;
    html += `<path class="door-swing" d="M ${hx - r} ${hy} A ${r} ${r} 0 0 1 ${hx} ${hy - r}"/>`;
    for (const key of E.ORDER) {
      const w = walls[key];
      html += `<a href="#${key}" data-wall="${key}" aria-label="${esc(E.WALLS[key].title)}"><title>${esc(E.WALLS[key].title)}</title>${w.hit}${w.lines}<text class="letter" x="${w.letter[0]}" y="${w.letter[1]}">${key}</text></a>`;
    }
    keyplan.innerHTML = html;
  }
  function updateKeyplan() {
    const cone = $('#cone', keyplan), eye = $('#eye', keyplan);
    const c = [RW / 2, RL / 2].map((v) => v);
    const ends = { D: [P(0, 0), P(0, RL)], C: [P(0, RL), P(RW, RL)], B: [P(RW, RL), P(RW, 0)], A: [P(RW, 0), P(0, 0)] }[state.view];
    const [cx, cy] = P(c[0], c[1]);
    cone.toggleAttribute('hidden', !ends); eye.toggleAttribute('hidden', !ends);
    if (ends) {
      cone.setAttribute('points', `${cx},${cy} ${ends[0].join(',')} ${ends[1].join(',')}`);
      eye.setAttribute('cx', cx); eye.setAttribute('cy', cy);
    }
    $$('a', keyplan).forEach((a) => a.classList.toggle('is-current', a.dataset.wall === state.view));
  }

  // ---------- список стен ----------
  function buildWallList() {
    const ul = $('#wall-list');
    for (const key of E.ORDER) {
      const n = E.pointsOf(key).length + E.ceilingOf(key).length;
      ul.append(el('li', {}, `<a href="#${key}" data-wall="${key}"><span class="key">${key}</span><span>${esc(E.WALLS[key].short)}</span><span class="count">${pointsWord(n)}</span></a>`));
    }
    ul.append(el('li', {}, `<a href="#all" data-wall="all"><span class="all">Все листы подряд</span></a>`));
  }

  // ---------- фильтры и итоги ----------
  function buildFilters() {
    const total = E.counts(E.POWER);
    const types = [
      ['socket', 'Розетки', total.sockets, { type: 'socket', count: 1 }],
      ['switch', 'Выключатели', total.switches, { type: 'switch', keys: 1 }],
      ['out', 'Выводы', total.outs, { type: 'out' }],
    ];
    const row = $('#filters');
    for (const [type, name, n, sample] of types) {
      const b = el('button', { type: 'button', class: 'chip', 'aria-pressed': 'true', 'data-type': type }, `${icon(sample, 18, 18)}<span>${name}</span><b>${n}</b>`);
      b.addEventListener('click', () => {
        const on = b.getAttribute('aria-pressed') === 'true';
        b.setAttribute('aria-pressed', String(!on));
        if (on) state.hidden.add(type); else state.hidden.delete(type);
        applyFilters();
      });
      row.append(b);
    }
    const common = E.POWER.filter((p) => p.type === 'switch' && /проходной|перекрёстный/.test(p.label)).map((p) => p.id);
    $('#totals').innerHTML = `<p><strong>Во всей комнате:</strong> ${tally(total)}.</p>` +
      (common.length ? `<p>Общий свет включается из ${common.length} мест: <span class="ids">${common.join(', ')}</span>.</p>` : '');
  }
  function applyFilters() {
    const hidden = (ids) => ids.every((id) => state.hidden.has(typeOf.get(id)));
    for (const { el: s } of Object.values(sheets)) {
      $$('[data-id], [data-ids]', s).forEach((n) => {
        const ids = (n.dataset.ids || n.dataset.id).split(' ');
        n.classList.toggle('is-filtered', hidden(ids));
      });
    }
    if (state.pinned && state.hidden.has(typeOf.get(state.pinned))) unpin();
  }

  // ---------- листы ----------
  function buildSheet(key) {
    const wd = E.WALLS[key];
    const d = E.drawing(key);
    const rows = [...d.pts, ...d.ceil];
    const s = el('section', { class: 'sheet', id: `sheet-${key}`, 'data-wall': key, 'aria-labelledby': `t-${key}` });
    const { x, y, w, h } = d.box;
    const tableRows = rows.map((p) => {
      const ceil = p.wall === 'ceiling';
      return `<tr data-id="${p.id}" data-type="${ceil ? 'ceiling' : p.type}"><td>${p.id}</td><td class="what">${esc(ceil ? `вывод на потолке, ${fmt(p.dist)} см от стены` : E.what(p))}</td><td class="num" data-label="от угла">${fmt(p.u)}</td><td class="num" data-label="h">${ceil ? '—' : fmt(p.h)}</td><td>${esc(p.label)}</td></tr>`;
    }).join('');
    s.innerHTML = `<div class="frame">
      <header class="sheet-head">
        <h2 id="t-${key}">${esc(wd.title)}</h2>
        <p class="view">Вид из комнаты: слева угол со стеной ${wd.left}, справа — со стеной ${wd.right}. Привязки — от левого угла до центра изделия, высоты — от чистого пола до центра.</p>
        <p class="tally">${tally(E.counts(d.pts))}</p>
      </header>
      <div class="drawing">
        <svg xmlns="${NS}" viewBox="${x} ${y} ${w} ${h}" style="--print-w: ${(w * 0.4).toFixed(1)}mm" font-family="Golos Text, 'PT Sans', Arial, sans-serif" role="group" aria-label="Развёртка: ${esc(wd.title)}">${d.body}<g class="locator" hidden></g></svg>
        <div class="tip" hidden></div>
      </div>
      <p class="scroll-note">Чертёж шире экрана — листайте его вбок.</p>
      <div class="sheet-foot">
        <table class="points">
          <thead><tr><th>№</th><th>Что</th><th class="num">От угла ${wd.left}, см</th><th class="num">Высота, см</th><th>Назначение</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
        <div class="sheet-side">
          <ul class="legend">${E.LEGEND.map(([p, t]) => `<li>${icon(p)}<span>${esc(t)}</span></li>`).join('')}</ul>
          <div class="stamp">
            <div class="name"><b>Спальня подростка ${ROOM.width} × ${ROOM.length}</b><span>Развёртка стены ${key}. Электрика</span></div>
            <div class="cap">Лист</div><div class="cap">Листов</div>
            <div class="val">${wd.n}</div><div class="val">${E.ORDER.length}</div>
            <div class="scale">Масштаб 1:25, размеры в сантиметрах</div>
          </div>
        </div>
      </div>
    </div>`;
    const svg = $('svg', s);
    $$('.pt', svg).forEach((g) => {
      const p = byId.get(g.dataset.id);
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', describe(p, key, true));
    });
    sheets[key] = { el: s, svg, d };
    return s;
  }

  function describe(p, key, plain = false) {
    const wd = E.WALLS[key];
    const u = p.wall === 'ceiling' ? wd.u(p) : E.posU(key, p.pos);
    const what = p.wall === 'ceiling' ? 'Вывод на потолке' : E.what(p).replace(/^./, (c) => c.toUpperCase());
    const where = p.wall === 'ceiling'
      ? `${fmt(u)} см от угла ${wd.left}, на потолке в ${fmt({ D: p.x, C: ROOM.length - p.y, B: ROOM.width - p.x, A: p.y }[key])} см от стены`
      : `${fmt(u)} см от угла ${wd.left}, высота ${fmt(p.h)} см`;
    if (plain) return `${p.id}. ${what}. ${where}. ${p.label}`;
    return `<div><span class="tip-id">${p.id}</span><span class="tip-what">${esc(what)}</span></div><div class="tip-where">${esc(where)}</div><div class="tip-label">${esc(p.label)}</div>`;
  }

  // ---------- подсветка точки ----------
  function clearActive() {
    for (const { svg, el: s } of Object.values(sheets)) {
      svg.classList.remove('is-on');
      $$('.is-active', s).forEach((n) => n.classList.remove('is-active'));
      $('.locator', svg).setAttribute('hidden', '');
      $('.tip', s).hidden = true;
    }
  }
  function activate(id, key) {
    clearActive();
    const sh = sheets[key];
    if (!sh || !id) return;
    const { svg, el: s, d } = sh;
    const p = byId.get(id);
    svg.classList.add('is-on');
    $$(`[data-id="${id}"]`, s).forEach((n) => n.classList.add('is-active'));
    $$('[data-ids]', s).forEach((n) => { if (n.dataset.ids.split(' ').includes(id)) n.classList.add('is-active'); });

    // направляющие от точки к шкале высот и к линии привязок
    const ceil = p.wall === 'ceiling';
    const u = ceil ? E.WALLS[key].u(p) : E.posU(key, p.pos);
    const px = E.X(u), py = ceil ? E.Y(ROOM.ceiling) : E.Y(p.h);
    const loc = $('.locator', svg);
    let html = `<line x1="${px}" y1="${py}" x2="${px}" y2="${d.baseY}"/>`;
    if (!ceil) {
      const t = fmt(p.h), wpx = t.length * 3.4 + 4;
      html += `<line x1="${E.X(0)}" y1="${py}" x2="${px}" y2="${py}"/><rect x="${E.X(0) - 4 - wpx}" y="${py - 4}" width="${wpx}" height="8" rx="2"/><text x="${E.X(0) - 6}" y="${py + 2}" text-anchor="end">${t}</text>`;
    }
    loc.innerHTML = html;
    loc.removeAttribute('hidden');
    svg.appendChild(loc); // поверх мебели

    // подсказка над точкой
    const tip = $('.tip', s);
    const box = $('.drawing', s);
    tip.innerHTML = describe(p, key);
    tip.hidden = false;
    const g = $(`.pt[data-id="${id}"]`, svg);
    const r = g.getBoundingClientRect(), br = box.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = r.left - br.left + box.scrollLeft + r.width / 2 - tw / 2;
    left = Math.max(4, Math.min(left, box.scrollWidth - tw - 4));
    let top = r.top - br.top - th - 10;
    if (top < 0) top = r.bottom - br.top + 10;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }
  const keyOf = (node) => node.closest('.sheet').dataset.wall;
  function restore() { if (state.pinned) activate(state.pinned.id, state.pinned.key); else clearActive(); }
  function pin(id, key) {
    state.pinned = state.pinned && state.pinned.id === id && state.pinned.key === key ? null : { id, key };
    restore();
  }
  function unpin() { state.pinned = null; clearActive(); }

  function wire() {
    const root = $('#sheets');
    root.addEventListener('pointerover', (e) => {
      const t = e.target.closest('.pt, tbody tr');
      if (t && t.dataset.id) activate(t.dataset.id, keyOf(t));
    });
    root.addEventListener('pointerout', (e) => {
      const t = e.target.closest('.pt, tbody tr');
      if (t && !t.contains(e.relatedTarget)) restore();
    });
    root.addEventListener('click', (e) => {
      const t = e.target.closest('.pt, tbody tr');
      if (t && t.dataset.id) pin(t.dataset.id, keyOf(t));
      else if (e.target.closest('.drawing')) unpin();
    });
    root.addEventListener('focusin', (e) => { const t = e.target.closest('.pt'); if (t) activate(t.dataset.id, keyOf(t)); });
    root.addEventListener('focusout', (e) => { if (e.target.closest('.pt')) restore(); });
    root.addEventListener('keydown', (e) => {
      const t = e.target.closest('.pt');
      if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pin(t.dataset.id, keyOf(t)); }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { unpin(); return; }
      if (state.view === 'all' || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.target.closest('input, textarea, select')) return;
      const i = E.ORDER.indexOf(state.view);
      if (e.key === 'ArrowRight') location.hash = E.ORDER[(i + 1) % E.ORDER.length];
      if (e.key === 'ArrowLeft') location.hash = E.ORDER[(i + E.ORDER.length - 1) % E.ORDER.length];
    });
    window.addEventListener('resize', restore);
    $('#print').addEventListener('click', () => window.print());
    window.addEventListener('beforeprint', unpin);
  }

  // ---------- переключение листов ----------
  function show() {
    const h = location.hash.slice(1);
    state.view = h === 'all' || E.WALLS[h] ? h : 'D';
    for (const [key, { el: s }] of Object.entries(sheets)) s.hidden = !(state.view === 'all' || state.view === key);
    $$('#wall-list a').forEach((a) => (a.dataset.wall === state.view ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    document.title = state.view === 'all' ? 'Развёртки электрики' : `${E.WALLS[state.view].title} — развёртка`;
    unpin();
    updateKeyplan();
  }

  // узоры (рейки, перфорация) объявлены один раз: у скрытого листа они бы не отрисовались на остальных
  document.body.insertAdjacentHTML('afterbegin', `<svg class="defs" width="0" height="0" aria-hidden="true" focusable="false">${E.DEFS}</svg>`);
  buildKeyplan();
  buildWallList();
  const root = $('#sheets');
  for (const key of E.ORDER) root.append(buildSheet(key));
  buildFilters();
  wire();
  window.addEventListener('hashchange', show);
  show();
  if (document.fonts) document.fonts.ready.then(restore);
})();
