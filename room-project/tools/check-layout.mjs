// Проверка планировки: пересечения мебели, дверь, окно, радиатор, проходы ≥ 70 см.
// Запуск: node room-project/tools/check-layout.mjs
import { ROOM, DOOR, WINDOW, RADIATOR, ITEMS, PASSAGES } from '../layout.js';

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

  // 7. Учебное место: сидящий смотрит на стену D, левая рука — к стене A (меньшие y).
  const desk = ITEMS.find((it) => it.id === 'studyDesk');
  const ped = ITEMS.find((it) => it.id === 'pedestal');
  const chairS = ITEMS.find((it) => it.id === 'studyChair');
  const knee = desk.y1 - ped.y1;
  add('Учебное место', 'Тумба с ящиками слева от сидящего', (ped.y0 + ped.y1) / 2 < (chairS.y0 + chairS.y1) / 2, '');
  add('Учебное место', `Место для ног под столом ${knee} см (нужно ≥ 70)`, knee >= 70, '');

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
