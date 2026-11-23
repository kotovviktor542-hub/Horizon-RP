// VEXMORA — OPEN WORLD: генерация территорий для исследования.
// Готовит данные, которые движок и 3D-мир используют как есть:
//   • древние руины (арки, колонны, алтари) с лутом и стражами;
//   • входы в пещеры в горах и каньонах;
//   • огромные открытые поля с травой и редкими деревьями;
//   • достопримечательности: обелиски, статуи, разрушенные врата, обсерватории;
//   • скрытые места (тайники) в труднодоступных точках карты.
// Ничего не ломает существующий мир: расстановка проверяет занятость точек.

const TAU = Math.PI * 2;

// Плотность и «характер» разных типов дикой природы по биомам
const REGION_STYLE = {
  forest: { ruins: 0.9, caves: 0.3, obelisk: 0.7 },
  deep_forest: { ruins: 1.4, caves: 0.2, obelisk: 0.5 },
  plains: { ruins: 0.5, caves: 0.1, obelisk: 0.9 },
  swamp: { ruins: 0.8, caves: 0.2, obelisk: 0.4 },
  desert: { ruins: 0.7, caves: 0.4, obelisk: 0.8 },
  ashland: { ruins: 0.9, caves: 0.5, obelisk: 0.5 },
  canyon: { ruins: 0.6, caves: 0.9, obelisk: 0.4 },
  mountains: { ruins: 0.8, caves: 1.2, obelisk: 0.6 },
  snow: { ruins: 0.5, caves: 0.7, obelisk: 0.4 },
  city: { ruins: 0.2, caves: 0.05, obelisk: 0.3 },
  coast: { ruins: 0.3, caves: 0.3, obelisk: 0.5 },
  ruins: { ruins: 2.4, caves: 0.2, obelisk: 0.8 }
};

// Названия достопримечательностей: тип → набор имён (подбираются по seed)
const LANDMARK_NAMES = {
  obelisk: ['Обелиск Павших', 'Шпиль Первого Света', 'Камень Клятвы', 'Столп Бездны'],
  statue: ['Статуя Забытого Короля', 'Идол Хранителя', 'Страж Перекрёстка', 'Колосс Времён'],
  gate: ['Врата Древних', 'Арка Странника', 'Портал Семи Ветров', 'Врата Пепельной Эпохи'],
  observatory: ['Обсерватория Звёздного Ока', 'Круг Астронома', 'Башня Созерцания'],
  camp: ['Лагерь Искателей', 'Стоянка Каравана', 'Привал Разведки'],
  shrine: ['Святилище Лунного Света', 'Алтарь Жертвы', 'Часовня Безмолвия'],
  wreck: ['Обломки «Гелиоса»', 'Разбитый Транспорт', 'Корпус Колонии-9']
};

const CAVE_NAMES = [
  'Пещера Шёпота', 'Грот Кристаллов', 'Разлом Теней', 'Логово Глубин',
  'Провал Забытых', 'Каверна Эха', 'Тоннель Контрабандистов', 'Бездна Костей'
];

const FIELD_NAMES = [
  'Золотые Поля', 'Пшеничный Разлив', 'Луговое Море', 'Степной Простор',
  'Поле Тихого Ветра', 'Пастбища Кочевников'
];

const RUIN_KINDS = ['arch', 'colonnade', 'altar', 'circle'];

function pickName(list, rnd) {
  return list[Math.floor(rnd() * list.length) % list.length];
}

/**
 * Генерирует территории исследования.
 * @param {object} ctx { seed, W, H, rand, map, isClearSpot, nodes, props, buildings,
 *                        hazards, makeNode, occupied }
 */
export function buildExploration(ctx) {
  const { seed, W, H, rand, map, isClearSpot, nodes, props, buildings, hazards, makeNode, occupied = {} } = ctx;
  const landmarks = [];
  const caves = [];
  const fields = [];

  // Детерминированный генератор для этого прохода (не трогает rand мира)
  let state = (seed ^ 0x9e3779b9) >>> 0;
  const rnd = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };

  // Быстрый пространственный отсев: минимум расстояния между достопримечательностями
  const MIN_GAP = 420;
  const tooClose = (x, y, gap = MIN_GAP) => {
    for (const l of landmarks) {
      const dx = l.x - x, dy = l.y - y;
      if (dx * dx + dy * dy < gap * gap) return true;
    }
    for (const c of caves) {
      const dx = c.x - x, dy = c.y - y;
      if (dx * dx + dy * dy < gap * gap) return true;
    }
    for (const b of Object.values(occupied.bosses || {})) {
      const dx = b.x - x, dy = b.y - y;
      if (dx * dx + dy * dy < (b.arenaRadius || 320) ** 2) return true;
    }
    for (const c of occupied.camps || []) {
      const dx = c.x - x, dy = c.y - y;
      if (dx * dx + dy * dy < 300 * 300) return true;
    }
    for (const r of occupied.rescues || []) {
      const dx = r.x - x, dy = r.y - y;
      if (dx * dx + dy * dy < 220 * 220) return true;
    }
    for (const m of occupied.modCaches || []) {
      const dx = m.x - x, dy = m.y - y;
      if (dx * dx + dy * dy < 220 * 220) return true;
    }
    return false;
  };

  const isLand = (x, y) => {
    if (x < 260 || y < 260 || x > W - 260 || y > H - 260) return false;
    const t = map.terrainAt(x, y);
    return !t.water;
  };

  // ── 1. ОГРОМНЫЕ ПОЛЯ ───────────────────────────────────────────────────
  // Большие открытые пространства среди равнин и лесов: их видно издалека,
  // они дают передышку между чащами и служат ориентиром.
  for (let i = 0; i < 260 && fields.length < 9; i++) {
    const x = 900 + rnd() * (W - 1800);
    const y = 900 + rnd() * (H - 1800);
    if (!isLand(x, y)) continue;
    const t = map.terrainAt(x, y);
    if (t.biome !== 'plains' && t.biome !== 'forest') continue;
    if (tooClose(x, y, 900)) continue;
    // Радиус поля: 300–620 world-единиц (30–62 м) — это действительно простор
    const radius = 300 + rnd() * 320;
    // Проверяем, что поле целиком на суше и не задевает застройку
    let ok = true;
    for (let a = 0; a < 10 && ok; a++) {
      const ang = (a / 10) * TAU;
      const px = x + Math.cos(ang) * radius * 0.85;
      const py = y + Math.sin(ang) * radius * 0.85;
      if (!isLand(px, py)) ok = false;
      else if (!isClearSpot(px, py, 30)) ok = false;
    }
    if (!ok) continue;
    fields.push({
      id: `field_${fields.length + 1}`,
      name: pickName(FIELD_NAMES, rnd),
      x, y, radius,
      kind: rnd() < 0.5 ? 'wheat' : 'meadow',
      grassDensity: 0.9 + rnd() * 0.5
    });
  }

  // ── 2. ДРЕВНИЕ РУИНЫ ───────────────────────────────────────────────────
  // Каждая руина — небольшая площадка из колонн/арок/алтаря + стражи и лут.
  // Данные достаточны, чтобы 3D-мир собрал модель, а движок — бой и награду.
  const RUIN_TARGET = 22;
  for (let i = 0; i < 900 && landmarks.length < RUIN_TARGET; i++) {
    const x = 700 + rnd() * (W - 1400);
    const y = 700 + rnd() * (H - 1400);
    if (!isLand(x, y)) continue;
    const t = map.terrainAt(x, y);
    const style = REGION_STYLE[t.biome];
    if (!style || rnd() > style.ruins / 2.6) continue;
    if (!isClearSpot(x, y, 120) || tooClose(x, y, 520)) continue;

    const radius = 150 + rnd() * 120;
    const kind = RUIN_KINDS[Math.floor(rnd() * RUIN_KINDS.length)];
    landmarks.push({
      id: `ruin_${landmarks.length + 1}`,
      type: 'ruin',
      kind,
      name: pickName(LANDMARK_NAMES.obelisk, rnd).replace(/.*/, (m) => m), // имя задаётся ниже
      title: 'Древние Руины',
      x, y, radius,
      angle: rnd() * TAU,
      seed: Math.floor(rnd() * 100000),
      biome: t.biome,
      // Награда за зачистку и стражи
      guards: kind === 'altar' ? 4 : 3,
      guardKinds: t.biome === 'snow' ? ['frost_wraith', 'ice_skeleton']
        : t.biome === 'desert' || t.biome === 'ashland' ? ['skeleton_warrior', 'bone_hound']
        : t.biome === 'canyon' ? ['stone_golem', 'goblin_shaman']
        : ['skeleton_warrior', 'dark_archer'],
      loot: { coins: [40, 90], xp: 60 + Math.floor(rnd() * 60), resource: 'crystal' },
      discovered: false,
      cleared: false
    });
    landmarks[landmarks.length - 1].name = `Руины «${landmarks[landmarks.length - 1].title}»`;
  }
  // Даём руинам осмысленные имена
  for (const l of landmarks) {
    if (l.type === 'ruin') l.name = `Руины: ${pickName(LANDMARK_NAMES.gate, rnd)}`;
  }

  // ── 3. ДОСТОПРИМЕЧАТЕЛЬНОСТИ ───────────────────────────────────────────
  const LANDMARK_TYPES = ['obelisk', 'statue', 'gate', 'observatory', 'shrine', 'wreck', 'camp'];
  const LM_TARGET = 26;
  for (let i = 0; i < 1400 && landmarks.filter(l => l.type === 'landmark').length < LM_TARGET; i++) {
    const x = 600 + rnd() * (W - 1200);
    const y = 600 + rnd() * (H - 1200);
    if (!isLand(x, y)) continue;
    const t = map.terrainAt(x, y);
    const style = REGION_STYLE[t.biome];
    if (!style) continue;
    if (!isClearSpot(x, y, 110) || tooClose(x, y, 560)) continue;
    // В городе — обломки, в горах — обсерватории, на равнинах — лагеря
    let type = LANDMARK_TYPES[Math.floor(rnd() * LANDMARK_TYPES.length)];
    if (t.biome === 'city') type = rnd() < 0.7 ? 'wreck' : 'statue';
    if (t.biome === 'mountains' || t.biome === 'snow') type = rnd() < 0.6 ? 'observatory' : 'obelisk';
    if (t.biome === 'plains' || t.biome === 'deep_forest') type = rnd() < 0.5 ? 'camp' : type;
    if (rnd() > style.obelisk) continue;
    landmarks.push({
      id: `lm_${landmarks.length + 1}`,
      type: 'landmark',
      kind: type,
      name: pickName(LANDMARK_NAMES[type] || LANDMARK_NAMES.obelisk, rnd),
      title: type === 'wreck' ? 'Обломки' : type === 'camp' ? 'Лагерь' : 'Достопримечательность',
      x, y,
      radius: type === 'camp' ? 120 : type === 'observatory' ? 130 : 90,
      angle: rnd() * TAU,
      seed: Math.floor(rnd() * 100000),
      biome: t.biome,
      // Лагеря и святилища дают отдых/бафф, остальные — точку интереса
      rest: type === 'camp' || type === 'shrine',
      bonus: type === 'camp' ? 'heal' : type === 'shrine' ? 'xp' : null,
      discovered: false
    });
  }

  // ── 4. ПЕЩЕРЫ ──────────────────────────────────────────────────────────
  // Вход в пещеру: модель скального портала + подземный «карман» с лутом.
  // Сама пещера реализована как отдельная зона с ограниченным радиусом.
  const CAVE_TARGET = 14;
  for (let i = 0; i < 1200 && caves.length < CAVE_TARGET; i++) {
    const x = 700 + rnd() * (W - 1400);
    const y = 700 + rnd() * (H - 1400);
    if (!isLand(x, y)) continue;
    const t = map.terrainAt(x, y);
    const style = REGION_STYLE[t.biome];
    if (!style || rnd() > style.caves / 1.6) continue;
    if (!isClearSpot(x, y, 100) || tooClose(x, y, 520)) continue;
    caves.push({
      id: `cave_${caves.length + 1}`,
      name: pickName(CAVE_NAMES, rnd),
      x, y,
      radius: 70,
      // Глубина: внутренняя арена пещеры (для боя и лута)
      depth: 900 + Math.floor(rnd() * 700),
      angle: rnd() * TAU,
      seed: Math.floor(rnd() * 100000),
      biome: t.biome,
      kind: t.biome === 'canyon' ? 'red_rock' : t.biome === 'snow' ? 'ice' : 'stone',
      enemies: t.biome === 'snow' ? ['frost_wraith', 'ice_skeleton']
        : t.biome === 'canyon' || t.biome === 'ashland' ? ['cave_troll', 'goblin_shaman']
        : ['cave_troll', 'bone_hound'],
      loot: { coins: [60, 130], xp: 90, resource: 'crystal' },
      discovered: false,
      cleared: false
    });
    // Модель портала: груда скал вокруг входа
    for (let k = 0; k < 5; k++) {
      const ang = (k / 5) * TAU + rnd() * 0.4;
      const r = 52 + rnd() * 26;
      const px = x + Math.cos(ang) * r;
      const py = y + Math.sin(ang) * r;
      props.push({ id: `pr_cave_${caves.length}_${k}`, kind: 'rock', x: px, y: py, radius: 17 });
    }
    // Внутри пещеры — кристаллы и ящики
    for (let k = 0; k < 3; k++) {
      const ang = rnd() * TAU, r = 20 + rnd() * 40;
      nodes.push(makeNode(900000 + caves.length * 10 + k, rnd() < 0.5 ? 'crystal_node' : 'crates',
        x + Math.cos(ang) * r, y + Math.sin(ang) * r));
    }
  }

  // ── 5. СКРЫТЫЕ МЕСТА ───────────────────────────────────────────────────
  // Тайники в труднодоступных точках: у самых краёв карты, на островах, в горах.
  // Награда за исследование, а не за прохождение сюжета.
  const hiddenSpots = [];
  for (let i = 0; i < 1500 && hiddenSpots.length < 12; i++) {
    const x = 300 + rnd() * (W - 600);
    const y = 300 + rnd() * (H - 600);
    const t = map.terrainAt(x, y);
    if (!t.water || t.bridge) continue;                  // островки и отмели
    if (tooClose(x, y, 700)) continue;
    // Ищем ближайшую сушу — тайник стоит на кромке
    const land = map.nearestLand(x, y, 240);
    if (!land) continue;
    const dx = land.x - x, dy = land.y - y;
    if (dx * dx + dy * dy > 200 * 200) continue;
    if (!isClearSpot(land.x, land.y, 70)) continue;
    hiddenSpots.push({
      id: `hidden_${hiddenSpots.length + 1}`,
      type: 'hidden_cache',
      name: `Скрытый тайник №${hiddenSpots.length + 1}`,
      x: land.x, y: land.y,
      radius: 60,
      reward: { coins: 120 + Math.floor(rnd() * 180), xp: 80, item: rnd() < 0.5 ? 'medkit' : 'ammo' },
      discovered: false,
      opened: false
    });
  }
  for (const h of hiddenSpots) landmarks.push(h);

  // ── 6. Данные для быстрых запросов по полям ────────────────────────────
  // Поля нужны движку в каждом кадре (для травы и замедления), поэтому
  // раскладываем их по грубой сетке — O(1) вместо перебора всех полей.
  const FIELD_CELL = 600;
  const fcols = Math.ceil(W / FIELD_CELL);
  const frows = Math.ceil(H / FIELD_CELL);
  const fieldGrid = new Array(fcols * frows);
  for (const f of fields) {
    const r = f.radius * 1.05;
    const x0 = Math.max(0, Math.floor((f.x - r) / FIELD_CELL));
    const x1 = Math.min(fcols - 1, Math.floor((f.x + r) / FIELD_CELL));
    const y0 = Math.max(0, Math.floor((f.y - r) / FIELD_CELL));
    const y1 = Math.min(frows - 1, Math.floor((f.y + r) / FIELD_CELL));
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        const i = gy * fcols + gx;
        (fieldGrid[i] || (fieldGrid[i] = [])).push(f);
      }
    }
  }

  return {
    landmarks,
    caves,
    fields,
    hiddenSpots,
    fieldGrid,
    fieldCell: FIELD_CELL,
    fieldCols: fcols,
    // Поле в точке мира или null
    fieldAt(x, y) {
      const gx = Math.floor(x / FIELD_CELL);
      const gy = Math.floor(y / FIELD_CELL);
      if (gx < 0 || gy < 0 || gx >= fcols || gy >= frows) return null;
      const list = fieldGrid[gy * fcols + gx];
      if (!list) return null;
      for (const f of list) {
        const dx = x - f.x, dy = y - f.y;
        if (dx * dx + dy * dy <= f.radius * f.radius) return f;
      }
      return null;
    }
  };
}
