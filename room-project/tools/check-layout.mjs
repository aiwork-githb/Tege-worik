// Проверка планировки: пересечения мебели, дверь, окно, радиатор, проходы ≥ 70 см.
// Запуск: node room-project/tools/check-layout.mjs
import { ROOM, DOOR, WINDOW, RADIATOR, ITEMS, PASSAGES, POWER } from '../layout.js';

const MIN_PASSAGE = 70;

const overlap1 = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0) > 0;
const footprintOverlap = (a, b) => overlap1(a.x0, a.x1, b.x0, b.x1) && overlap1(a.y0, a.y1, b.y0, b.y1);
const volumeOverlap = (a, b) => footprintOverlap(a, b) && overlap1(a.h0, a.h1, b.h0, b.h1);

// Предмет мешает проходу, если он ниже 150 см и не плоский (ковёр не мешает).
const blocksPassage = (it) => it.kind !== 'flat' && it.h0 < 150;

export function runChecks() {
  const results = [];
  const add = (group, label, ok, detail) => results.push({ group, label, ok, detail });

  // 1. Всё внутри комнаты.
  for (const it of ITEMS) {
    const ok = it.x0 >= 0 && it.x1 <= ROOM.width && it.y0 >= 0 && it.y1 <= ROOM.length && it.h1 <= ROOM.ceiling;
    if (!ok) add('Габариты', `${it.name} выходит за стены или потолок`, false, `${it.x0}–${it.x1} × ${it.y0}–${it.y1}, h ${it.h0}–${it.h1}`);
  }
  add('Габариты', 'Вся мебель внутри 365 × 525 × 255', results.every((r) => r.ok), '');

  // 2. Пересечения предметов в объёме.
  const clashes = [];
  for (let i = 0; i < ITEMS.length; i++) {
    for (let j = i + 1; j < ITEMS.length; j++) {
      const a = ITEMS[i], b = ITEMS[j];
      if (a.kind === 'flat' || b.kind === 'flat') continue;
      if (a.nestedIn === b.id || b.nestedIn === a.id) continue;
      if (volumeOverlap(a, b)) clashes.push(`${a.name} × ${b.name}`);
    }
  }
  add('Пересечения', 'Предметы не пересекаются', clashes.length === 0, clashes.join('; '));

  // 3. Дверь: четверть круга R=70 от петли (305, 0) внутрь комнаты, высота полотна 200.
  const doorHits = [];
  for (const it of ITEMS) {
    if (it.kind === 'flat' || it.h0 >= DOOR.height) continue;
    let hit = false;
    for (let x = DOOR.x0; x <= DOOR.hingeX && !hit; x += 1) {
      for (let y = 0; y <= DOOR.swing && !hit; y += 1) {
        if (Math.hypot(x - DOOR.hingeX, y) > DOOR.swing) continue;
        if (x > it.x0 && x < it.x1 && y > it.y0 && y < it.y1) hit = true;
      }
    }
    if (hit) doorHits.push(it.name);
  }
  add('Дверь', 'Зона открывания двери (R 70) свободна', doorHits.length === 0, doorHits.join(', '));

  // Открытое полотно ложится вдоль x = 305…309 — за ним только держатель мяча на высоте 108+.
  const leaf = { x0: DOOR.hingeX, x1: DOOR.hingeX + 4, y0: 0, y1: DOOR.swing, h0: 0, h1: DOOR.height };
  const leafHits = ITEMS.filter((it) => it.kind !== 'flat' && volumeOverlap(it, leaf)).map((it) => it.name);
  add('Дверь', 'Открытое на 90° полотно ни во что не упирается', leafHits.length === 0, leafHits.join(', '));

  // 4. Окно: перед проёмом (30 см от стены) выше подоконника ничего нет.
  const windowZone = { x0: WINDOW.x0, x1: WINDOW.x1, y0: ROOM.length - 30, y1: ROOM.length, h0: WINDOW.sill, h1: WINDOW.top };
  const windowHits = ITEMS.filter((it) => it.kind !== 'flat' && volumeOverlap(it, windowZone)).map((it) => it.name);
  add('Окно', `Проём ${WINDOW.x1 - WINDOW.x0}×${WINDOW.top - WINDOW.sill} выше подоконника 74 свободен`, windowHits.length === 0, windowHits.join(', '));

  // 5. Радиатор: над ним и перед ним (10 см) ничего, кроме сиденья с вентиляционной решёткой.
  const radZone = { x0: RADIATOR.x0 - 5, x1: RADIATOR.x1 + 5, y0: RADIATOR.y0 - 10, y1: ROOM.length, h0: 0, h1: WINDOW.sill };
  const radHits = ITEMS.filter((it) => it.kind !== 'flat' && volumeOverlap(it, radZone) && !it.ventSlot).map((it) => it.name);
  const radRect = { ...RADIATOR };
  const radClash = ITEMS.filter((it) => it.kind !== 'flat' && volumeOverlap(it, radRect)).map((it) => it.name);
  add('Радиатор', 'Радиатор открыт снизу и спереди, над ним решётка сиденья', radHits.length === 0 && radClash.length === 0,
    [...radHits, ...radClash].join(', '));
  const seat = ITEMS.find((it) => it.id === 'windowSeat');
  add('Радиатор', `Зазор радиатор → сиденье ${seat.h0 - RADIATOR.h1} см (нужно ≥ 4)`, seat.h0 - RADIATOR.h1 >= 4, '');

  // 6. Книжные шкафы по углам стены C: глубина как у сиденья, примыкают к его торцам.
  const studyBc = ITEMS.find((it) => it.id === 'studyBookcase');
  const gameBc = ITEMS.find((it) => it.id === 'gamingBookcase');
  const seatDepth = seat.y1 - seat.y0;
  add('Шкафы у окна', `Глубина шкафов ${studyBc.y1 - studyBc.y0} и ${gameBc.y1 - gameBc.y0} = глубине сиденья ${seatDepth}`,
    studyBc.y1 - studyBc.y0 === seatDepth && gameBc.y1 - gameBc.y0 === seatDepth && studyBc.y1 === ROOM.length && gameBc.y1 === ROOM.length, '');
  add('Шкафы у окна', 'Шкафы стоят в углах и примыкают к торцам сиденья',
    studyBc.x0 === 0 && studyBc.x1 === seat.x0 && gameBc.x1 === ROOM.width && gameBc.x0 === seat.x1, '');

  // Мягкие спинки у торцов сиденья: от сиденья до уровня столов; нижние дверцы шкафов открываются под столешницей.
  const gDesk = ITEMS.find((it) => it.id === 'gamingDesk');
  const backs = ITEMS.filter((it) => it.id.startsWith('seatBack'));
  add('Шкафы у окна', `Мягкие спинки от сиденья (${seat.h1}) до уровня столов (${gDesk.h1})`,
    backs.length === 2 && backs.every((b) => b.h0 === seat.h1 && b.h1 === gDesk.h1 && b.h1 === ITEMS.find((it) => it.id === 'studyDesk').h1), '');
  const doorBlockers = [];
  for (const bc of [studyBc, gameBc]) {
    const leafW = (bc.x1 - bc.x0) / 2;
    const swing = { x0: bc.x0, x1: bc.x1, y0: bc.y0 - leafW, y1: bc.y0, h0: 0, h1: bc.lower };
    ITEMS.filter((it) => it.kind === 'floor' && !['studyDesk', 'gamingDesk'].includes(it.id) && it.id !== bc.id && volumeOverlap(it, swing))
      .forEach((it) => doorBlockers.push(`${bc.name}: ${it.name}`));
  }
  add('Шкафы у окна', 'Нижние дверцы шкафов открываются под столешницей свободно', doorBlockers.length === 0, doorBlockers.join('; '));

  // Полки над учебным столом: 2 ряда, просвет каждого ≥ А4 по длинной стороне + 5 см, верхний ряд с дверцами.
  const sh = ITEMS.find((it) => it.id === 'shelves');
  const A4 = 29.7, need = A4 + 5;
  const builtH = sh.board * 3 + sh.rows.reduce((a, r) => a + r.clear, 0);
  add('Учебное место', `Полки над столом: 2 ряда в свету по ${sh.rows.map((r) => r.clear).join(' и ')} см (нужно ≥ ${need.toFixed(1)})`,
    sh.rows.length === 2 && sh.rows.every((r) => r.clear >= need) && Math.abs(builtH - (sh.h1 - sh.h0)) < 0.01, '');
  add('Учебное место', 'Верхний ряд полок закрыт дверцами, нижний открыт', sh.rows[1].doors && !sh.rows[0].doors, '');

  // 7. Учебное место: сидящий смотрит на стену D, левая рука — к стене A (меньшие y).
  const desk = ITEMS.find((it) => it.id === 'studyDesk');
  const ped = ITEMS.find((it) => it.id === 'pedestal');
  const chairS = ITEMS.find((it) => it.id === 'studyChair');
  const knee = desk.y1 - ped.y1;
  add('Учебное место', 'Тумба с ящиками слева от сидящего', (ped.y0 + ped.y1) / 2 < (chairS.y0 + chairS.y1) / 2, '');
  add('Учебное место', `Место для ног под столом ${knee} см (нужно ≥ 70)`, knee >= 70, '');

  // Перед шкафом-купе: у стены D до тумбы ≥ 40 см, на остальной ширине основной проход.
  const wr = ITEMS.find((it) => it.id === 'wardrobe');
  const front = { x0: wr.x0, x1: wr.x1, y0: wr.y1, y1: wr.y1 + 40, h0: 0, h1: 150 };
  const frontHits = ITEMS.filter((it) => it.kind !== 'flat' && volumeOverlap(it, front)).map((it) => it.name);
  add('Шкаф-купе', 'Перед дверями свободно 40 см по всей ширине (у тумбы) и 80 см в проходе', frontHits.length === 0, frontHits.join(', '));

  // Электрика по заданию.
  const onD = POWER.filter((p) => p.wall === 'D');
  for (const id of ['nightstandL', 'nightstand']) {
    const ns = ITEMS.find((it) => it.id === id);
    const above = onD.filter((p) => p.pos >= ns.y0 && p.pos <= ns.y1 && p.h > ns.h1);
    const ok = above.some((p) => p.type === 'socket') && above.some((p) => p.type === 'switch') && above.some((p) => p.type === 'out');
    add('Электрика', `${ns.name}: над ней розетка, выключатель и бра`, ok, above.map((p) => p.id).join(', '));
  }
  const deskMid = (desk.y0 + desk.y1) / 2;
  const overDesk = onD.filter((p) => p.pos >= desk.y0 && p.pos <= desk.y1 && p.h > desk.h1 && p.h < sh.h0);
  const leftSockets = overDesk.filter((p) => p.pos < deskMid && p.type === 'socket').reduce((a, p) => a + p.count, 0);
  const right = overDesk.filter((p) => p.pos > deskMid);
  add('Электрика', `Над учебным столом слева ${leftSockets} розетки`, leftSockets === 2, '');
  add('Электрика', 'Над учебным столом справа розетка и выключатель подсветки стола',
    right.some((p) => p.type === 'socket') && right.some((p) => p.type === 'switch'), right.map((p) => p.id).join(', '));
  const onC = POWER.filter((p) => p.wall === 'C');
  const ledIn = (bc) => onC.some((p) => p.type === 'out' && p.pos > bc.x0 && p.pos < bc.x1);
  add('Электрика', 'Стена C: выводы подсветки полок обоих книжных шкафов и выключатель к ним',
    ledIn(studyBc) && ledIn(gameBc) && onC.some((p) => p.type === 'switch'), '');
  // Стена B, вид из комнаты: слева угол C (большие y), справа угол A (малые y).
  const onB = POWER.filter((p) => p.wall === 'B');
  const sum = (list) => list.filter((p) => p.type === 'socket').reduce((a, p) => a + p.count, 0);
  const con = ITEMS.find((it) => it.id === 'console');
  const conMid = (con.y0 + con.y1) / 2, conThird = (con.y1 - con.y0) / 6;
  add('Электрика', 'Над медиатумбой по центру 2 розетки',
    sum(onB.filter((p) => Math.abs(p.pos - conMid) <= conThird && p.h > con.h1)) === 2, '');
  const edge = onB.filter((p) => p.type === 'socket' && p.count === 1 && p.h === 20 && p.pos < con.y0 && p.pos >= con.y0 - 25);
  add('Электрика', 'У правого края медиатумбы 1 розетка на высоте 20 см', edge.length === 1, edge.map((p) => p.id).join(', '));
  add('Электрика', 'Вывод подсветки медиатумбы спрятан за ней',
    onB.some((p) => p.type === 'out' && p.pos > con.y0 && p.pos < con.y1 && p.h > con.h0 && p.h < con.h1), '');
  const gd = ITEMS.find((it) => it.id === 'gamingDesk');
  const gMid = (gd.y0 + gd.y1) / 2;
  const onGame = onB.filter((p) => p.pos >= gd.y0 && p.pos <= gd.y1);
  const overG = onGame.filter((p) => p.h > gd.h1), underG = onGame.filter((p) => p.h < gd.h1 - 5);
  add('Электрика', 'Над игровым столом: 4 розетки у левого края, 2 у правого',
    sum(overG.filter((p) => p.pos > gMid)) === 4 && sum(overG.filter((p) => p.pos < gMid)) === 2, '');
  add('Электрика', 'Под игровым столом у правого края 4 розетки',
    sum(underG.filter((p) => p.pos < gMid)) === 4 && sum(underG.filter((p) => p.pos > gMid)) === 0, '');
  // Розетки и выключатели не прячутся за мебелью: перед ними свободно 5 см от лицевой плоскости
  // (стены, реек на B или мягкой панели изголовья на D). Розетка за кроватью на h 20 закрыта намеренно.
  const W = ROOM.width, L = ROOM.length;
  const skins = ITEMS.filter((it) => it.id === 'slats' || it.id === 'headboard');
  const zone = (p) => {
    const half = p.type === 'socket' ? (p.count * 7.1 + 1.6) / 2 : 4.3;
    const z = { h0: p.h - 4.3, h1: p.h + 4.3 };
    const [lo, hi] = [p.pos - half, p.pos + half];
    const skin = skins.find((it) => (p.wall === 'D' ? it.x0 === 0 : p.wall === 'B' ? it.x1 === W : false)
      && it.y0 <= lo && it.y1 >= hi && it.h0 <= z.h0 && it.h1 >= z.h1);
    const d = (skin ? skin.x1 - skin.x0 : 0) + 5;
    if (p.wall === 'D') return { x0: 0, x1: d, y0: lo, y1: hi, ...z };
    if (p.wall === 'B') return { x0: W - d, x1: W, y0: lo, y1: hi, ...z };
    if (p.wall === 'A') return { x0: lo, x1: hi, y0: 0, y1: d, ...z };
    return { x0: lo, x1: hi, y0: L - d, y1: L, ...z };
  };
  // у столов мешает только столешница: под ней место для ног и розеток
  const solid = ITEMS.filter((it) => it.kind !== 'flat' && !skins.includes(it))
    .map((it) => (it.id === 'studyDesk' || it.id === 'gamingDesk' ? { ...it, h0: it.h1 - 3 } : it));
  const hidden = POWER.filter((p) => p.type !== 'out' && p.wall !== 'ceiling' && !(p.wall === 'D' && p.h <= 25))
    .map((p) => [p.id, solid.filter((it) => volumeOverlap(it, zone(p))).map((it) => it.name)])
    .filter(([, hits]) => hits.length);
  add('Электрика', 'Розетки и выключатели не закрыты мебелью', hidden.length === 0, hidden.map(([id, h]) => `${id}: ${h.join(', ')}`).join('; '));

  // 8. Проходы.
  for (const p of PASSAGES) {
    const width = Math.min(p.x1 - p.x0, p.y1 - p.y0);
    const blockers = ITEMS.filter((it) => blocksPassage(it) && footprintOverlap(it, p)).map((it) => it.name);
    add('Проходы', `${p.label}: ${width} см`, width >= MIN_PASSAGE && blockers.length === 0, blockers.join(', '));
  }

  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const results = runChecks();
  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? 'OK  ' : 'FAIL'}  [${r.group}] ${r.label}${r.detail ? ' — ' + r.detail : ''}`);
  }
  console.log(failed ? `\n${failed} проверок не прошли` : '\nВсе проверки пройдены');
  process.exit(failed ? 1 : 0);
}
