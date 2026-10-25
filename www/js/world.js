// Генератор открытого мира VEXMORA (6400x6400):
// 4 биома, Убежище VEXMORA, 10 арен боссов, 10 точек спасения выживших (клетки + терминалы тревоги),
// 5 секретных бункеров/складов, 9 типов зданий с AABB-коллизиями, 6 видов транспорта и O(1) сетка препятствий.

import { WORLD_CONFIG, BIOMES, CAMPFIRES, SECRETS, BOSSES, RESCUE_MISSIONS, LOCATIONS } from './data.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function getBiomeIdAt(x, y) {
  const wave = Math.sin(x * 0.0024) * 80 + Math.cos(y * 0.0024) * 80;
  if (y < 1850 + wave * 0.5 && x >= 2100 + wave * 0.4) return 'mountains';
  if (x > 4050 - wave * 0.5 && y >= 1750 && y <= 4950) return 'city';
  if (y > 4150 - wave * 0.4 && x < 3950 + wave * 0.4) return 'desert';
  return 'forest';
}

// RISE OF THE ABYSS: особая локация в точке мира (или null, если обычный биом)
export function getLocationIdAt(x, y) {
  for (const loc of Object.values(LOCATIONS)) {
    const dx = x - loc.x;
    const dy = y - loc.y;
    if (dx * dx + dy * dy <= loc.radius * loc.radius) return loc.id;
  }
  return null;
}

export function getLocationAt(x, y) {
  const id = getLocationIdAt(x, y);
  return id ? LOCATIONS[id] : null;
}

const BUILDING_SPECS = {
  house:      { w: 112, h: 96,  colW: 84,  colH: 44, label: 'Жилой дом' },
  shop:       { w: 116, h: 96,  colW: 88,  colH: 48, label: 'Торговый павильон SHOP' },
  warehouse:  { w: 120, h: 88,  colW: 96,  colH: 46, label: 'Складской ангар' },
  bunker:     { w: 120, h: 92,  colW: 100, colH: 48, label: 'Укреплённый Бункер' },
  watchtower: { w: 68,  h: 112, colW: 40,  colH: 34, label: 'Сторожевая Вышка' },
  factory:    { w: 148, h: 112, colW: 124, colH: 50, label: 'Промышленный Завод' },
  hospital:   { w: 136, h: 104, colW: 108, colH: 52, label: 'Медкорпус' },
  police:     { w: 136, h: 100, colW: 108, colH: 50, label: 'Отдел Полиции' },
  base:       { w: 156, h: 108, colW: 132, colH: 54, label: 'Военный Штаб' }
};

export function createWorld(seed = 20261025) {
  const rand = mulberry32(seed);
  const W = WORLD_CONFIG.width;
  const H = WORLD_CONFIG.height;

  const buildings = [];
  const props = [];
  const nodes = [];
  const vehicles = [];
  const hazards = [];
  const traps = [];   // RISE OF THE ABYSS: шипы, огненные и ядовитые ловушки
  const chests = [];  // Сундуки (обычные и проклятые)
  const steppingStones = [];
  const roads = [];
  const modCaches = []; // Спецконтейнеры модификаций под охраной мини-боссов

  let nextId = 1;

  // Главные магистрали Зоны VEXMORA
  roads.push(
    { x1: 3160, y1: 3180, x2: 5650, y2: 3180, width: 78, kind: 'asphalt' }, // Восток -> Мегаполис
    { x1: 4920, y1: 1880, x2: 4920, y2: 4660, width: 74, kind: 'asphalt' }, // Проспект Мегаполиса
    { x1: 3160, y1: 3180, x2: 1860, y2: 4680, width: 64, kind: 'dirt' },    // ЮЗ -> Промзона Завода
    { x1: 1860, y1: 4680, x2: 3560, y2: 5640, width: 60, kind: 'dirt' },    // Юг -> Каньон Пустыни
    { x1: 3160, y1: 3180, x2: 1580, y2: 2180, width: 60, kind: 'dirt' },    // Запад -> Лесная Чаща
    { x1: 3160, y1: 3180, x2: 4460, y2: 1280, width: 64, kind: 'dirt' },    // Север -> Хребет
    { x1: 4460, y1: 1280, x2: 5660, y2: 780,  width: 66, kind: 'asphalt' }  // В Цитадель VEXMORA
  );

  function addBuilding(kind, x, y, opts = {}) {
    const sp = BUILDING_SPECS[kind];
    buildings.push({
      id: opts.id || `bld_${nextId++}`,
      kind,
      name: opts.name || sp.label,
      x,
      y,
      spriteW: sp.w,
      spriteH: sp.h,
      colW: sp.colW,
      colH: sp.colH,
      interactType: opts.interactType || null,
      secretId: opts.secretId || null,
      smokes: !!opts.smokes,
      looted: false
    });
  }

  // ── 1. УБЕЖИЩЕ VEXMORA (Главная развиваемая База игрока в центре) ─────
  addBuilding('shop',       3030, 3065, { interactType: 'shop', name: 'Торговый Отсек VEXMORA' });
  addBuilding('hospital',   2880, 3260, { interactType: 'heal', name: 'Медблок Убежища' });
  addBuilding('warehouse',  3380, 3075, { interactType: 'base_hub', name: 'Инженерный и Гаражный Цех' });
  addBuilding('watchtower', 3480, 3310, { interactType: 'loot_once', name: 'Дозорная Вышка Базы' });
  addBuilding('house',      2760, 3420, { interactType: 'loot_once', name: 'Агроферма Убежища' });

  props.push(
    { id: `pr_${nextId++}`, kind: 'tent', x: 3290, y: 3060, radius: 24 },
    { id: `pr_${nextId++}`, kind: 'tent', x: 3060, y: 3390, radius: 24 },
    { id: `pr_${nextId++}`, kind: 'fence', x: 2680, y: 3465, radius: 18 },
    { id: `pr_${nextId++}`, kind: 'fence', x: 2630, y: 3465, radius: 18 },
    { id: `pr_${nextId++}`, kind: 'fence', x: 2850, y: 3465, radius: 18 }
  );

  // Стартовые ящики, бочки, кусты и деревья рядом с Убежищем
  const starterNodes = [
    ['crates', 3390, 3390], ['crates', 2940, 3380], ['barrel', 2980, 3390],
    ['bush', 2910, 3510], ['bush', 3340, 3500], ['tree', 2820, 3090], ['tree', 3560, 3420],
    ['barrel_red', 3630, 3260]
  ];
  for (const [k, nx, ny] of starterNodes) nodes.push(makeNode(nextId++, k, nx, ny));

  vehicles.push(
    { id: 'veh_base_moto', kind: 'moto', name: 'Развед-мотоцикл Базы', x: 3530, y: 3150, vx: 0, vy: 0, angle: 0, radius: 20, drivable: true, baseSpeed: 360 }
  );

  // ── 2. ЗАБРОШЕННЫЙ МЕГАПОЛИС (Восток) ─────────────────────────────────
  addBuilding('hospital',  4680, 3040, { interactType: 'heal', name: 'Центральная Больница' });
  addBuilding('police',    5120, 3040, { interactType: 'loot_once', name: 'Управление Полиции' });
  addBuilding('shop',      4680, 3420, { interactType: 'shop', name: 'Городской Маркет SHOP' });
  addBuilding('house',     5140, 3420, { interactType: 'loot_once', name: 'Высотный Дом' });
  addBuilding('house',     4720, 2260, { interactType: 'loot_once', name: 'Северный Особняк' });
  addBuilding('factory',   5420, 4340, { interactType: 'loot_once', name: 'Техно-Ангар Роботов', smokes: true });
  addBuilding('warehouse', 4980, 2400, {
    id: 'bld_sec_warehouse',
    interactType: 'secret_vault',
    secretId: 'sec_warehouse_city',
    name: 'Спецсклад Полиции'
  });

  vehicles.push(
    { id: 'veh_city_car', kind: 'car', name: 'Патрульный седан', x: 4340, y: 3260, vx: 0, vy: 0, angle: 0, radius: 24, drivable: true, baseSpeed: 340 },
    { id: 'veh_city_bus', kind: 'bus', name: 'Городской автобус', x: 4920, y: 3680, vx: 0, vy: 0, angle: 0, radius: 34, drivable: false }
  );

  // ── 3. ПРОМЗОНА ХИМЗАВОДА И ПЕСЧАНЫЙ КАНЬОН (Юг / Юго-Запад) ──────────
  addBuilding('factory',    1540, 4880, { interactType: 'loot_once', name: 'Химкомбинат VEXMORA', smokes: true });
  addBuilding('warehouse',  1760, 4880, { interactType: 'loot_once', name: 'Цеховое Хранилище' });
  addBuilding('watchtower', 2040, 4720, { interactType: 'loot_once', name: 'Вышка Промзоны' });
  addBuilding('factory',    2520, 5660, { interactType: 'loot_once', name: 'Био-Лаборатория Векса', smokes: true });
  addBuilding('bunker',     2820, 5840, {
    id: 'bld_sec_bunker_desert',
    interactType: 'secret_vault',
    secretId: 'sec_bunker_desert',
    name: 'Подземное Хранилище Лаборатории'
  });

  vehicles.push(
    { id: 'veh_desert_jeep', kind: 'jeep', name: 'Пустынный Бронеджип', x: 1960, y: 4620, vx: 0, vy: 0, angle: 0, radius: 26, drivable: true, baseSpeed: 335 }
  );

  // ── 4. ЛЕСНОЙ СЕКТОР НА СЕВЕРО-ЗАПАДЕ ─────────────────────────────────
  addBuilding('bunker', 1380, 1360, {
    id: 'bld_sec_bunker_west',
    interactType: 'secret_vault',
    secretId: 'sec_bunker_west',
    name: 'Секретный Бункер «Альфа-7»'
  });
  addBuilding('watchtower', 1540, 1370, { interactType: 'loot_once', name: 'Северо-Западная Вышка' });

  // ── 5. СЕВЕРНЫЙ ХРЕБЕТ И ЦИТАДЕЛЬ VEXMORA ─────────────────────────────
  addBuilding('base',       4680, 920,  { interactType: 'loot_once', name: 'Штаб Генерала Армии' });
  addBuilding('base',       5420, 620,  { interactType: 'loot_once', name: 'Цитадель Ядра VEXMORA' });
  addBuilding('watchtower', 4880, 1120, { interactType: 'loot_once', name: 'Радарная Вышка Хребта' });
  addBuilding('bunker',     5180, 960,  {
    id: 'bld_sec_mountain',
    interactType: 'secret_vault',
    secretId: 'sec_mountain_vault',
    name: 'Секретный Арсенал Цитадели'
  });

  vehicles.push(
    { id: 'veh_base_heli', kind: 'heli', name: 'Штурмовой вертолёт VEXMORA', x: 4820, y: 1020, vx: 0, vy: 0, angle: 0, radius: 34, drivable: false },
    { id: 'veh_north_jeep', kind: 'jeep', name: 'Арктический Внедорожник', x: 4380, y: 1340, vx: 0, vy: 0, angle: 0, radius: 26, drivable: true, baseSpeed: 340 }
  );

  // ── 6. ОСТРОВ КОНТРАБАНДИСТОВ С ПЛИТАМИ ЧЕРЕЗ РЕКУ И КАТЕРОМ ──────────
  hazards.push({
    id: 'river_island',
    kind: 'water_moat',
    x: 4080, y: 4860,
    innerRadius: 114,
    outerRadius: 238
  });
  for (const py of [4608, 4664, 4720]) {
    steppingStones.push({ x: 4080, y: py, radius: 28 });
  }
  vehicles.push({
    id: 'veh_island_boat', kind: 'boat', name: 'Катер контрабандистов',
    x: 3955, y: 4865, vx: 0, vy: 0, angle: 0, radius: 22, drivable: false
  });
  addBuilding('warehouse', 4080, 4845, {
    id: 'bld_sec_island',
    interactType: 'secret_vault',
    secretId: 'sec_island_stash',
    name: 'Тайник Острова Контрабандистов'
  });

  // ── 6b. RISE OF THE ABYSS: секретные бункеры трёх новых локаций ───────
  addBuilding('bunker', 560, 940, {
    id: 'bld_sec_ruins', interactType: 'secret_vault', secretId: 'sec_ruins_vault', name: 'Рунный Склеп Забытых'
  });
  addBuilding('bunker', 5140, 5920, {
    id: 'bld_sec_cursed', interactType: 'secret_vault', secretId: 'sec_cursed_shrine', name: 'Проклятое Святилище Леса'
  });
  addBuilding('bunker', 6040, 560, {
    id: 'bld_sec_abyss', interactType: 'secret_vault', secretId: 'sec_abyss_vault', name: 'Сокровищница Крепости Бездны'
  });
  addBuilding('watchtower', 470, 560, { interactType: 'loot_once', name: 'Руинная Башня Стражей' });
  addBuilding('base', 5980, 300, { interactType: 'loot_once', name: 'Цитадель Крепости Бездны' });

  // Руинные колонны вокруг Забытых Руин
  for (const [px, py] of [[600, 620], [850, 640], [620, 900], [880, 890], [740, 560], [520, 760], [930, 770]]) {
    props.push({ id: `pr_${nextId++}`, kind: 'ruins_pillar', x: px, y: py, radius: 15 });
  }

  // Ловушки локаций: шипы в Руинах, яд в Лесу Проклятых, огонь в Крепости
  const trapDefs = [
    ['trap_spikes', 660, 700], ['trap_spikes', 800, 820], ['trap_spikes', 590, 830], ['trap_spikes', 830, 690],
    ['trap_poison', 4820, 5580], ['trap_poison', 5030, 5780], ['trap_poison', 4860, 5840], ['trap_poison', 5080, 5560],
    ['trap_fire', 5880, 470], ['trap_fire', 6040, 340], ['trap_fire', 5830, 300], ['trap_fire', 6100, 470]
  ];
  for (const [kind, tx, ty] of trapDefs) {
    traps.push({ id: `trap_${nextId++}`, kind, x: tx, y: ty, radius: 26, damage: kind === 'trap_fire' ? 26 : kind === 'trap_spikes' ? 20 : 16, hitCd: 0 });
  }

  // Сундуки локаций (часть — проклятые, с засадой и двойной добычей!)
  const chestDefs = [
    ['chest_ruins_1', 640, 660, false], ['chest_ruins_2', 880, 950, true],
    ['chest_cursed_1', 4780, 5750, false], ['chest_cursed_2', 5120, 5520, true],
    ['chest_abyss_1', 5900, 520, false], ['chest_abyss_2', 6180, 360, true],
    ['chest_forest_1', 2100, 2900, false], ['chest_city_1', 5300, 2900, false]
  ];
  for (const [id, cx, cy, cursed] of chestDefs) {
    chests.push({ id, x: cx, y: cy, looted: false, cursed });
  }

  // Кристаллические жилы Бездны (редкий ресурс для легендарного крафта)
  for (const [cx, cy] of [[690, 840], [790, 610], [5000, 5600], [4760, 5900], [6000, 430], [5850, 560], [6150, 300], [430, 880]]) {
    nodes.push(makeNode(nextId++, 'crystal_node', cx, cy));
  }

  // ── 7. Спецконтейнеры модификаций оружия под охраной Кибер-Карателей ──
  modCaches.push(
    { id: 'mcache_1', x: 2280, y: 2640, looted: false, modId: 'mod_scope',  weaponId: 'autopistol' },
    { id: 'mcache_2', x: 5260, y: 2740, looted: false, modId: 'mod_mag',    weaponId: 'smg_storm' },
    { id: 'mcache_3', x: 2880, y: 4620, looted: false, modId: 'mod_barrel', weaponId: 'auto_shotgun' }
  );

  // ── 8. Заполнение ландшафта деревьями, елями, камнями, кустами, ящиками и взрывными бочками ──
  function isClearSpot(x, y, pad = 75) {
    if (dist2(x, y, 3160, 3180) < (380 + pad) ** 2) return false;
    for (const c of CAMPFIRES) {
      if (dist2(x, y, c.x, c.y) < (160 + pad) ** 2) return false;
    }
    for (const b of Object.values(BOSSES)) {
      if (dist2(x, y, b.x, b.y) < (b.arenaRadius + pad) ** 2) return false;
    }
    for (const rm of RESCUE_MISSIONS) {
      if (dist2(x, y, rm.x, rm.y) < (170 + pad) ** 2) return false;
    }
    for (const mc of modCaches) {
      if (dist2(x, y, mc.x, mc.y) < (130 + pad) ** 2) return false;
    }
    for (const bld of buildings) {
      if (Math.abs(x - bld.x) < bld.colW * 0.5 + pad && Math.abs(y - (bld.y - bld.colH * 0.5)) < bld.colH * 0.5 + pad) {
        return false;
      }
    }
    if (dist2(x, y, 4080, 4860) < (265 + pad) ** 2) return false;
    for (const r of roads) {
      const dx = r.x2 - r.x1, dy = r.y2 - r.y1;
      const len2 = dx * dx + dy * dy;
      const t = Math.max(0, Math.min(1, ((x - r.x1) * dx + (y - r.y1) * dy) / len2));
      if (dist2(x, y, r.x1 + t * dx, r.y1 + t * dy) < (r.width * 0.65 + pad * 0.45) ** 2) return false;
    }
    return true;
  }

  for (let i = 0; i < 680; i++) {
    const x = 140 + rand() * (W - 280);
    const y = 140 + rand() * (H - 280);
    if (!isClearSpot(x, y, 52)) continue;

    let overlap = false;
    for (let j = nodes.length - 1; j >= Math.max(0, nodes.length - 65); j--) {
      if (dist2(x, y, nodes[j].x, nodes[j].y) < 78 * 78) { overlap = true; break; }
    }
    if (overlap) continue;

    const biome = getBiomeIdAt(x, y);
    const roll = rand();

    if (biome === 'forest') {
      if (roll < 0.45) nodes.push(makeNode(nextId++, 'tree', x, y));
      else if (roll < 0.70) nodes.push(makeNode(nextId++, 'bush', x, y));
      else if (roll < 0.84) props.push({ id: `pr_${nextId++}`, kind: 'rock', x, y, radius: 17 });
      else if (roll < 0.94) nodes.push(makeNode(nextId++, 'crates', x, y));
      else nodes.push(makeNode(nextId++, 'barrel', x, y));
    } else if (biome === 'city') {
      if (roll < 0.35) nodes.push(makeNode(nextId++, 'crates', x, y));
      else if (roll < 0.60) nodes.push(makeNode(nextId++, 'barrel', x, y));
      else if (roll < 0.80) nodes.push(makeNode(nextId++, 'barrel_red', x, y));
      else if (roll < 0.92) props.push({ id: `pr_${nextId++}`, kind: 'fence', x, y, radius: 18 });
      else nodes.push(makeNode(nextId++, 'bush', x, y));
    } else if (biome === 'desert') {
      if (roll < 0.35) props.push({ id: `pr_${nextId++}`, kind: 'rock', x, y, radius: 17 });
      else if (roll < 0.58) nodes.push(makeNode(nextId++, 'barrel', x, y));
      else if (roll < 0.78) nodes.push(makeNode(nextId++, 'barrel_red', x, y));
      else if (roll < 0.92) nodes.push(makeNode(nextId++, 'crates', x, y));
      else nodes.push(makeNode(nextId++, 'bush', x, y));
    } else {
      if (roll < 0.45) nodes.push(makeNode(nextId++, 'pine_tree', x, y));
      else if (roll < 0.70) props.push({ id: `pr_${nextId++}`, kind: 'rock', x, y, radius: 17 });
      else if (roll < 0.86) nodes.push(makeNode(nextId++, 'crates', x, y));
      else nodes.push(makeNode(nextId++, 'barrel_red', x, y));
    }
  }

  // O(1) пространственная сетка статических пропов
  const CELL = 260;
  const cols = Math.ceil(W / CELL);
  const rows = Math.ceil(H / CELL);
  const propGrid = Array.from({ length: cols * rows }, () => []);

  for (const pr of props) {
    const cx = Math.max(0, Math.min(cols - 1, Math.floor(pr.x / CELL)));
    const cy = Math.max(0, Math.min(rows - 1, Math.floor(pr.y / CELL)));
    propGrid[cy * cols + cx].push(pr);
  }

  function queryPropsNear(x, y) {
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    const out = [];
    for (let dy = -1; dy <= 1; dy++) {
      const ny = cy + dy;
      if (ny < 0 || ny >= rows) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx;
        if (nx < 0 || nx >= cols) continue;
        const cell = propGrid[ny * cols + nx];
        for (let k = 0; k < cell.length; k++) out.push(cell[k]);
      }
    }
    return out;
  }

  return {
    width: W,
    height: H,
    biomes: BIOMES,
    buildings,
    props,
    nodes,
    vehicles,
    hazards,
    steppingStones,
    roads,
    modCaches,
    traps,
    chests,
    queryPropsNear
  };
}

function makeNode(numId, kind, x, y) {
  const defs = {
    tree:       { name: 'Лесное дерево',     hp: 50, radius: 16, solid: true,  res: 'wood',   amt: [2, 4] },
    pine_tree:  { name: 'Горная ель',        hp: 60, radius: 16, solid: true,  res: 'wood',   amt: [3, 5] },
    bush:       { name: 'Био-куст',          hp: 20, radius: 13, solid: false, res: 'herb',   amt: [2, 3] },
    crates:     { name: 'Ящики снабжения',   hp: 30, radius: 16, solid: true,  res: 'crates', amt: [1, 2] },
    barrel:     { name: 'Бочка с припасами', hp: 28, radius: 13, solid: true,  res: 'barrel', amt: [1, 2] },
    barrel_red: { name: 'Топливная бочка',   hp: 22, radius: 13, solid: true,  res: 'boom',   amt: [1, 1], explosive: true },
    crystal_node: { name: 'Жила Кристалла Бездны', hp: 70, radius: 15, solid: true, res: 'crystal', amt: [1, 3] }
  };
  const d = defs[kind] || defs.crates;
  return {
    id: `node_${numId}`,
    kind,
    name: d.name,
    x,
    y,
    radius: d.radius,
    solid: d.solid,
    explosive: !!d.explosive,
    hp: d.hp,
    maxHp: d.hp,
    hitFlash: 0,
    respawnTimer: 0,
    dropType: d.res,
    dropAmount: d.amt
  };
}
