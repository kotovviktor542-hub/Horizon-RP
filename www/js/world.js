// Генератор пиксельного открытого мира (4800x4800):
// 4 биома, асфальтовые улицы, 9 типов зданий с точными AABB-коллизиями и дверями,
// 6 видов транспорта (часть управляема!), деревья, кусты, камни, ящики, взрывные бочки, палатки и заборы.

import { WORLD_CONFIG, BIOMES, CAMPFIRES, NPCS, SECRETS, BOSSES } from './data.js';

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
  const wave = Math.sin(x * 0.003) * 64 + Math.cos(y * 0.003) * 64;
  if (x >= 2350 + wave * 0.5 && y < 1520 + wave * 0.5) return 'mountains';
  if (x > 2940 - wave * 0.5 && y >= 1520 && y <= 3320) return 'city';
  if (x < 2600 + wave * 0.5 && y > 3140 - wave * 0.4) return 'desert';
  return 'forest';
}

// Размеры спрайтов и коллизий всех 9 зданий
const BUILDING_SPECS = {
  house:      { w: 112, h: 96,  colW: 84,  colH: 44, label: 'Жилой дом' },
  shop:       { w: 116, h: 96,  colW: 88,  colH: 48, label: 'Магазин SHOP' },
  warehouse:  { w: 120, h: 88,  colW: 96,  colH: 46, label: 'Склад' },
  bunker:     { w: 120, h: 92,  colW: 100, colH: 48, label: 'Укреплённый Бункер' },
  watchtower: { w: 68,  h: 112, colW: 40,  colH: 34, label: 'Сторожевая Вышка' },
  factory:    { w: 148, h: 112, colW: 124, colH: 50, label: 'Промышленный Завод' },
  hospital:   { w: 136, h: 104, colW: 108, colH: 52, label: 'Городская Больница' },
  police:     { w: 136, h: 100, colW: 108, colH: 50, label: 'Отдел Полиции' },
  base:       { w: 156, h: 108, colW: 132, colH: 54, label: 'Военная База' }
};

export function createWorld(seed = 20261025) {
  const rand = mulberry32(seed);
  const W = WORLD_CONFIG.width;
  const H = WORLD_CONFIG.height;

  const buildings = [];     // прямоугольные здания с дверями/тайниками
  const props = [];         // статические пропы: палатки, заборы, камни (круговая/прямоугольная коллизия)
  const nodes = [];         // разрушаемые и собираемые объекты: деревья, кусты, ящики, бочки, красные взрывные бочки
  const vehicles = [];      // транспорт: управляемый (car, moto, jeep) и декоративный (bus, heli, boat)
  const hazards = [];       // водная преграда с островом
  const steppingStones = [];// каменные плиты для прыжков через воду
  const roads = [];         // дороги между локациями

  let nextId = 1;

  // Главные дороги мира
  roads.push(
    { x1: 2360, y1: 2380, x2: 4100, y2: 2380, width: 76, kind: 'asphalt' }, // в Город
    { x1: 3560, y1: 1680, x2: 3560, y2: 3060, width: 72, kind: 'asphalt' }, // поперечный проспект Города
    { x1: 2360, y1: 2380, x2: 1380, y2: 3520, width: 62, kind: 'dirt' },    // к Заводу в Пустыне
    { x1: 2360, y1: 2380, x2: 1360, y2: 1280, width: 58, kind: 'dirt' },    // к Северному Бункеру
    { x1: 2360, y1: 2380, x2: 3460, y2: 1080, width: 62, kind: 'dirt' }     // в Снежные Горы к Базе
  );

  function addBuilding(kind, x, y, opts = {}) {
    const sp = BUILDING_SPECS[kind];
    buildings.push({
      id: opts.id || `bld_${nextId++}`,
      kind,
      name: opts.name || sp.label,
      x,
      y, // координата Y основания фасада (для корректной 2.5D сортировки!)
      spriteW: sp.w,
      spriteH: sp.h,
      colW: sp.colW,
      colH: sp.colH,
      interactType: opts.interactType || null, // 'shop' | 'heal' | 'loot_once' | 'secret_vault'
      secretId: opts.secretId || null,
      looted: false
    });
  }

  // ── 1. ЛАГЕРЬ ВЫЖИВШИХ И ФЕРМА (Лес, центр карты) ────────────────────
  addBuilding('shop', 2240, 2265, { interactType: 'shop', name: 'Магазин Лагеря (SHOP)' });
  addBuilding('watchtower', 2555, 2275, { interactType: 'loot_once', name: 'Вышка Дозора' });
  addBuilding('house', 1960, 2495, { interactType: 'loot_once', name: 'Дом Фермера' });

  // Палатки и заборы лагеря/фермы
  props.push(
    { id: `pr_${nextId++}`, kind: 'tent', x: 2455, y: 2275, radius: 24 },
    { id: `pr_${nextId++}`, kind: 'tent', x: 2260, y: 2545, radius: 24 },
    { id: `pr_${nextId++}`, kind: 'fence', x: 1875, y: 2545, radius: 18 },
    { id: `pr_${nextId++}`, kind: 'fence', x: 1825, y: 2545, radius: 18 },
    { id: `pr_${nextId++}`, kind: 'fence', x: 2045, y: 2545, radius: 18 },
    { id: `pr_${nextId++}`, kind: 'fence', x: 2095, y: 2545, radius: 18 }
  );

  // Стартовые ящики, бочки, кусты и деревья рядом с лагерем
  const starterNodes = [
    ['crates', 2520, 2420], ['crates', 2160, 2440], ['barrel', 2195, 2445],
    ['bush', 2120, 2600], ['bush', 2480, 2610], ['tree', 2060, 2340], ['tree', 2650, 2550],
    ['barrel_red', 2740, 2420]
  ];
  for (const [k, nx, ny] of starterNodes) nodes.push(makeNode(nextId++, k, nx, ny));

  // Мотоцикл у выхода из лагеря (можно сесть и поехать!)
  vehicles.push({
    id: 'veh_camp_moto', kind: 'moto', name: 'Мотоцикл разведчика',
    x: 2610, y: 2335, vx: 0, vy: 0, angle: 0, radius: 20, drivable: true, maxSpeed: 355
  });

  // ── 2. ЗАБРОШЕННЫЙ ГОРОД (Восток: Магазин, Больница, Полиция, Дома, Склад) ──
  addBuilding('hospital', 3430, 2240, { interactType: 'heal', name: 'Городская Больница' });
  addBuilding('police',   3710, 2240, { interactType: 'loot_once', name: 'Отдел Полиции' });
  addBuilding('shop',     3430, 2560, { interactType: 'shop', name: 'Городской Супермаркет' });
  addBuilding('house',    3710, 2560, { interactType: 'loot_once', name: 'Заброшенный Дом' });
  addBuilding('house',    3430, 1920, { interactType: 'loot_once', name: 'Северный Коттедж' });
  addBuilding('warehouse', 3820, 1760, {
    id: 'bld_sec_warehouse',
    interactType: 'secret_vault',
    secretId: 'sec_warehouse_city',
    name: 'Запертый Спецсклад Полиции'
  });

  vehicles.push(
    { id: 'veh_city_car', kind: 'car', name: 'Городской седан', x: 3250, y: 2450, vx: 0, vy: 0, angle: 0, radius: 24, drivable: true, maxSpeed: 335 },
    { id: 'veh_city_bus', kind: 'bus', name: 'Разбитый автобус', x: 3560, y: 2740, vx: 0, vy: 0, angle: 0, radius: 34, drivable: false }
  );

  // ── 3. ПУСТЫНЯ И ЗАВОД (Юго-Запад: Завод, Вышки, Склад, Бункер, Внедорожник) ──
  addBuilding('factory',    1140, 3680, { interactType: 'loot_once', name: 'Химзавод №4', smokes: true });
  addBuilding('warehouse',  1340, 3680, { interactType: 'loot_once', name: 'Цеховой Склад' });
  addBuilding('watchtower', 1520, 3580, { interactType: 'loot_once', name: 'Южная Вышка' });
  addBuilding('bunker',     2150, 4260, {
    id: 'bld_sec_bunker_desert',
    interactType: 'secret_vault',
    secretId: 'sec_bunker_desert',
    name: 'Подземный Бункер Пустыни'
  });

  vehicles.push({
    id: 'veh_desert_jeep', kind: 'jeep', name: 'Штурмовой внедорожник',
    x: 1470, y: 3440, vx: 0, vy: 0, angle: 0, radius: 26, drivable: true, maxSpeed: 325
  });

  // ── 4. СЕВЕРО-ЗАПАДНЫЙ БУНКЕР В ЧАЩЕ ЛЕСА ────────────────────────────
  addBuilding('bunker', 1120, 1220, {
    id: 'bld_sec_bunker_west',
    interactType: 'secret_vault',
    secretId: 'sec_bunker_west',
    name: 'Секретный Бункер «Альфа-7»'
  });
  addBuilding('watchtower', 1270, 1230, { interactType: 'loot_once', name: 'Лесная Вышка' });
  props.push({ id: `pr_${nextId++}`, kind: 'tent', x: 1440, y: 1230, radius: 24 });

  // ── 5. СНЕЖНЫЕ ГОРЫ И ВОЕННАЯ БАЗА (Северо-Восток) ───────────────────
  addBuilding('base',       3820, 660, { interactType: 'loot_once', name: 'Штаб Военной Базы' });
  addBuilding('bunker',     3620, 670, { interactType: 'loot_once', name: 'Арсенал Базы' });
  addBuilding('watchtower', 3510, 820, { interactType: 'loot_once', name: 'Северная Вышка Базы' });

  vehicles.push(
    { id: 'veh_base_heli', kind: 'heli', name: 'Военный вертолёт', x: 3680, y: 830, vx: 0, vy: 0, angle: 0, radius: 34, drivable: false },
    { id: 'veh_base_jeep', kind: 'jeep', name: 'Армейский джип', x: 3340, y: 1160, vx: 0, vy: 0, angle: 0, radius: 26, drivable: true, maxSpeed: 330 }
  );

  // ── 6. СЕКРЕТНЫЙ ОСТРОВ КОНТРАБАНДИСТОВ С ЛОДКОЙ И ПЛИТАМИ НА ВОДЕ ───
  hazards.push({
    id: 'river_island',
    kind: 'water_moat',
    x: 3120,
    y: 3820,
    innerRadius: 112,
    outerRadius: 235
  });
  for (const py of [3570, 3625, 3680]) {
    steppingStones.push({ x: 3120, y: py, radius: 28 });
  }
  vehicles.push({
    id: 'veh_island_boat', kind: 'boat', name: 'Катер контрабандистов',
    x: 2995, y: 3825, vx: 0, vy: 0, angle: 0, radius: 22, drivable: false
  });
  addBuilding('warehouse', 3120, 3805, {
    id: 'bld_sec_island',
    interactType: 'secret_vault',
    secretId: 'sec_island_stash',
    name: 'Тайник Контрабандистов'
  });

  // ── 7. Процедурное расселение деревьев, камней, кустов, ящиков и бочек ──
  function isClearSpot(x, y, pad = 75) {
    if (dist2(x, y, 2360, 2380) < (300 + pad) ** 2) return false;
    for (const c of CAMPFIRES) {
      if (dist2(x, y, c.x, c.y) < (145 + pad) ** 2) return false;
    }
    for (const b of Object.values(BOSSES)) {
      if (dist2(x, y, b.x, b.y) < (b.arenaRadius + pad) ** 2) return false;
    }
    for (const bld of buildings) {
      if (Math.abs(x - bld.x) < bld.colW * 0.5 + pad && Math.abs(y - (bld.y - bld.colH * 0.5)) < bld.colH * 0.5 + pad) {
        return false;
      }
    }
    if (dist2(x, y, 3120, 3820) < (260 + pad) ** 2) return false;
    for (const r of roads) {
      const dx = r.x2 - r.x1, dy = r.y2 - r.y1;
      const len2 = dx * dx + dy * dy;
      const t = Math.max(0, Math.min(1, ((x - r.x1) * dx + (y - r.y1) * dy) / len2));
      if (dist2(x, y, r.x1 + t * dx, r.y1 + t * dy) < (r.width * 0.65 + pad * 0.45) ** 2) return false;
    }
    return true;
  }

  for (let i = 0; i < 460; i++) {
    const x = 140 + rand() * (W - 280);
    const y = 140 + rand() * (H - 280);
    if (!isClearSpot(x, y, 52)) continue;

    let overlap = false;
    for (let j = nodes.length - 1; j >= Math.max(0, nodes.length - 65); j--) {
      if (dist2(x, y, nodes[j].x, nodes[j].y) < 76 * 76) { overlap = true; break; }
    }
    if (overlap) continue;

    const biome = getBiomeIdAt(x, y);
    const roll = rand();

    if (biome === 'forest') {
      if (roll < 0.46) nodes.push(makeNode(nextId++, 'tree', x, y));
      else if (roll < 0.72) nodes.push(makeNode(nextId++, 'bush', x, y));
      else if (roll < 0.86) props.push({ id: `pr_${nextId++}`, kind: 'rock', x, y, radius: 17 });
      else if (roll < 0.95) nodes.push(makeNode(nextId++, 'crates', x, y));
      else nodes.push(makeNode(nextId++, 'barrel', x, y));
    } else if (biome === 'city') {
      if (roll < 0.36) nodes.push(makeNode(nextId++, 'crates', x, y));
      else if (roll < 0.62) nodes.push(makeNode(nextId++, 'barrel', x, y));
      else if (roll < 0.80) nodes.push(makeNode(nextId++, 'barrel_red', x, y));
      else if (roll < 0.92) props.push({ id: `pr_${nextId++}`, kind: 'fence', x, y, radius: 18 });
      else nodes.push(makeNode(nextId++, 'bush', x, y));
    } else if (biome === 'desert') {
      if (roll < 0.36) props.push({ id: `pr_${nextId++}`, kind: 'rock', x, y, radius: 17 });
      else if (roll < 0.60) nodes.push(makeNode(nextId++, 'barrel', x, y));
      else if (roll < 0.78) nodes.push(makeNode(nextId++, 'barrel_red', x, y));
      else if (roll < 0.92) nodes.push(makeNode(nextId++, 'crates', x, y));
      else nodes.push(makeNode(nextId++, 'bush', x, y));
    } else {
      // mountains
      if (roll < 0.46) nodes.push(makeNode(nextId++, 'pine_tree', x, y));
      else if (roll < 0.72) props.push({ id: `pr_${nextId++}`, kind: 'rock', x, y, radius: 17 });
      else if (roll < 0.88) nodes.push(makeNode(nextId++, 'crates', x, y));
      else nodes.push(makeNode(nextId++, 'barrel_red', x, y));
    }
  }

  // Пространственная сетка статических препятствий (пропы + здания) для O(1) коллизий на Android
  const CELL = 240;
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
    queryPropsNear
  };
}

function makeNode(numId, kind, x, y) {
  const defs = {
    tree:       { name: 'Лесное дерево',     hp: 50, radius: 16, solid: true,  res: 'wood',   amt: [2, 4] },
    pine_tree:  { name: 'Горная ель',        hp: 60, radius: 16, solid: true,  res: 'wood',   amt: [3, 5] },
    bush:       { name: 'Ягодный куст',      hp: 20, radius: 13, solid: false, res: 'herb',   amt: [2, 3] },
    crates:     { name: 'Ящики с припасами', hp: 30, radius: 16, solid: true,  res: 'crates', amt: [1, 2] },
    barrel:     { name: 'Деревянная бочка',  hp: 28, radius: 13, solid: true,  res: 'barrel', amt: [1, 2] },
    barrel_red: { name: 'Бочка с топливом',  hp: 22, radius: 13, solid: true,  res: 'boom',   amt: [1, 1], explosive: true }
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
