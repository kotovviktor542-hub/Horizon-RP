// Генератор открытого мира VEXMORA: процедурная карта в духе WorldBox.
// Континент с океаном, морями, озёрами, реками и мостами, ущельями, горами, лесами,
// равнинами, пустынями, снегами, болотами, мегаполисом и архипелагом.
// Убежище VEXMORA, арены боссов, точки спасения, секретные бункеры, здания с AABB-коллизиями,
// транспорт и O(1) сетка препятствий — всё привязано к сгенерированной карте.

import { WORLD_CONFIG, BIOMES, CAMPFIRES, SECRETS, BOSSES, RESCUE_MISSIONS, LOCATIONS } from './data.js';
import { buildExploration } from './exploration.js';
import {
  createMap, createMapFromSave, setActiveMap, getActiveMap, getBiomeIdAt as mapBiomeAt,
  getTerrainAt, MAP_CONFIG, MAP_BIOMES, mulberry32, fbm, randomMapSeed
} from './mapgen.js';

export { getTerrainAt, getActiveMap, MAP_BIOMES, MAP_CONFIG };
export { randomMapSeed };

export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

// Биом в точке мира: читается из активной процедурной карты (WorldBox-стиль)
export function getBiomeIdAt(x, y) {
  return mapBiomeAt(x, y);
}

// Проходимость и тип поверхности (вода, мост, глубина, замедление)

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


// ── GLOBAL MAP & TRANSPORT: классы техники ───────────────────────────────
// speed — базовая скорость (px/сек), accel — разгон, grip — управляемость, hp — прочность кузова
export const VEHICLE_KINDS = {
  sportscar: { name: 'Спорткар',      speed: 470, accel: 3.1, grip: 0.94, radius: 25, hp: 190 },
  muscle:    { name: 'Маслкар',       speed: 440, accel: 2.9, grip: 0.90, radius: 25, hp: 220 },
  sedan:     { name: 'Седан',         speed: 360, accel: 2.2, grip: 0.88, radius: 24, hp: 200 },
  suv:       { name: 'Внедорожник',   speed: 355, accel: 2.3, grip: 0.92, radius: 26, hp: 260 },
  miljeep:   { name: 'Военный джип',  speed: 370, accel: 2.5, grip: 0.93, radius: 26, hp: 280 },
  pickup:    { name: 'Пикап',         speed: 345, accel: 2.2, grip: 0.90, radius: 27, hp: 250 },
  bike:      { name: 'Мотоцикл',      speed: 400, accel: 3.4, grip: 0.82, radius: 18, hp: 120 },
  truck:     { name: 'Грузовик',      speed: 300, accel: 1.7, grip: 0.80, radius: 32, hp: 380 },
  apc:       { name: 'Бронетранспортёр', speed: 285, accel: 1.8, grip: 0.86, radius: 34, hp: 520 },
  // ── OPEN WORLD: техника для исследования большой карты ────────────────
  buggy:     { name: 'Багги «Скарабей»', speed: 415, accel: 3.3, grip: 0.96, radius: 22, hp: 210 },
  quad:      { name: 'Квадроцикл',       speed: 385, accel: 3.5, grip: 0.94, radius: 17, hp: 140 },
  speedboat: { name: 'Катер «Волна»',    speed: 480, accel: 3.0, grip: 0.70, radius: 26, hp: 260, water: true }
};

const BUILDING_SPECS = {
  // colW/colH — прямоугольник СТЕН здания (в world-единицах, 10 ед = 1 м 3D).
  // Раньше коллизия была заметно шире/глубже корпуса, из-за чего герой
  // упирался в «воздух» в паре метров от стены. Теперь совпадает с моделью
  // (см. Structures.house(w, h, d) в js3d/world/models.js): 112×96 ед = 11.2×9.6 м.
  house:      { w: 112, h: 96,  colW: 112, colH: 96, label: 'Жилой дом' },
  shop:       { w: 116, h: 96,  colW: 116, colH: 96, label: 'Торговый павильон SHOP' },
  warehouse:  { w: 120, h: 88,  colW: 120, colH: 88, label: 'Складской ангар' },
  bunker:     { w: 120, h: 92,  colW: 120, colH: 92, label: 'Укреплённый Бункер' },
  watchtower: { w: 68,  h: 112, colW: 44,  colH: 44, label: 'Сторожевая Вышка' },
  factory:    { w: 148, h: 112, colW: 148, colH: 112, label: 'Промышленный Завод' },
  hospital:   { w: 136, h: 104, colW: 136, colH: 104, label: 'Медкорпус' },
  police:     { w: 136, h: 100, colW: 136, colH: 100, label: 'Отдел Полиции' },
  base:       { w: 156, h: 108, colW: 156, colH: 108, label: 'Военный Штаб' }
};

// Единый детерминированный угол поворота здания: и модель, и коллизия берут
// его отсюда, поэтому физика совпадает с тем, что видит игрок.
// (rnd(x, 3) из mapgen недоступен на уровне модуля — считаем такой же стабильный угол.)
export function rotFromCoords(x, y) {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return (n - Math.floor(n)) * Math.PI * 2;
}

export function createWorld(seed = 20261025, savedGrid = null) {
  const rand = mulberry32(seed);
  const W = WORLD_CONFIG.width;
  const H = WORLD_CONFIG.height;

  // Процедурная карта: новый континент по seed или восстановление из сохранения
  const map = savedGrid ? createMapFromSave(seed, savedGrid) : createMap(seed);
  setActiveMap(map);

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
      // Угол поворота корпуса в 3D (радианы). Модель здания поворачивается
      // детерминированно от координат, поэтому коллизия может повторять её
      // ориентацию — иначе у повёрнутого дома невидимая стена «в воздухе».
      angle: rotFromCoords(x, y),
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

  // ── GLOBAL MAP & TRANSPORT: новый автопарк ────────────────────────────
  // Sportscar (скорость), pickup/SUV (проходимость), military jeep, truck (грузовик),
  // bike (мотоцикл), APC (бронетранспортёр) — детализированные модели с анимацией колёс.
  const addVehicle = (id, kind, name, x, y, opts = {}) => {
    const spec = VEHICLE_KINDS[kind] || VEHICLE_KINDS.sedan;
    vehicles.push({
      id, kind, name, x, y, vx: 0, vy: 0, angle: opts.angle || 0,
      radius: spec.radius, drivable: opts.drivable !== false,
      baseSpeed: opts.baseSpeed || spec.speed, accel: spec.accel, grip: spec.grip,
      hp: spec.hp, maxHp: spec.hp, ...opts
    });
  };

  addVehicle('veh_base_moto', 'bike', 'Развед-мотоцикл «Вихрь»', 3530, 3150, { baseSpeed: 400 });
  // OPEN WORLD: быстрый транспорт для дальних вылазок и катер для воды
  addVehicle('veh_base_quad', 'quad', 'Квадроцикл «Стрекоза»', 3620, 3080, { baseSpeed: 385 });
  addVehicle('veh_base_buggy', 'buggy', 'Багги «Скарабей»', 3450, 3320, { baseSpeed: 415 });
  addVehicle('veh_base_sport', 'sportscar', 'Спорткар «Фантом»', 3260, 3420, { baseSpeed: 470, angle: -0.4 });

  // Катер — только на реальной воде: ищем ближайшую глубокую точку рядом с лагерем.
  (function placeBoat() {
    const isDeep = (x, y) => {
      const t = map.terrainAt(x, y);
      return !!t.water && t.deep;
    };
    for (let ring = 0; ring < 110; ring++) {
      const r = 260 + ring * 52;
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2 + ring * 0.4;
        const x = Math.min(W - 120, Math.max(120, 3160 + Math.cos(ang) * r));
        const y = Math.min(H - 120, Math.max(120, 3180 + Math.sin(ang) * r));
        if (isDeep(x, y) && isDeep(x + 40, y) && isDeep(x - 40, y)) {
          addVehicle('veh_base_boat', 'speedboat', 'Катер «Волна»', Math.round(x), Math.round(y), { baseSpeed: 480 });
          return;
        }
      }
    }
  })();

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

  addVehicle('veh_city_car', 'sedan', 'Патрульный седан', 4340, 3260, { baseSpeed: 360 });
  addVehicle('veh_city_muscle', 'muscle', 'Маслкар «Ярость»', 5060, 3480, { baseSpeed: 455, angle: Math.PI });
  addVehicle('veh_city_truck', 'truck', 'Грузовик снабжения', 4760, 3820, { baseSpeed: 300, angle: 0.2 });
  addVehicle('veh_city_apc', 'apc', 'Бронетранспортёр Нацгвардии', 5320, 3120, { baseSpeed: 285, angle: Math.PI * 0.9 });

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

  addVehicle('veh_desert_jeep', 'miljeep', 'Пустынный военный джип', 1960, 4620, { baseSpeed: 370 });
  addVehicle('veh_desert_pickup', 'pickup', 'Пикап «Каньон»', 2360, 5140, { baseSpeed: 345, angle: 1.1 });
  addVehicle('veh_desert_truck', 'truck', 'Тяжёлый грузовик Промзоны', 1400, 5240, { baseSpeed: 290, angle: -0.5 });

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

  addVehicle('veh_north_jeep', 'suv', 'Арктический внедорожник', 4380, 1340, { baseSpeed: 355 });
  addVehicle('veh_north_apc', 'apc', 'Армейский БТР-«Мороз»', 4560, 1180, { baseSpeed: 300, angle: 0.6 });
  addVehicle('veh_north_truck', 'truck', 'Военный грузовик', 5040, 1260, { baseSpeed: 295, angle: Math.PI });

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
  // VEXMORA 3.0: секретные бункеры Небесных Руин и Подземного Царства
  addBuilding('bunker', 1350, 4520, {
    id: 'bld_sec_sky', interactType: 'secret_vault', secretId: 'sec_sky_vault', name: 'Сокровищница Небесных Руин'
  });
  addBuilding('bunker', 3150, 5080, {
    id: 'bld_sec_under', interactType: 'secret_vault', secretId: 'sec_under_vault', name: 'Лаборатория Подземного Царства'
  });
  addBuilding('watchtower', 1080, 2720, { interactType: 'loot_once', name: 'Пепельная Башня Вулкара' });
  addBuilding('watchtower', 5450, 4720, { interactType: 'loot_once', name: 'Башня Последнего Лагеря' });
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

  // VEXMORA 3.0: ловушки, сундуки и жилы новых регионов
  const trapDefs3 = [
    ['trap_fire', 820, 2820], ['trap_fire', 990, 2990], ['trap_fire', 760, 3050],
    ['trap_spikes', 2820, 720], ['trap_spikes', 2990, 890], ['trap_poison', 1620, 830],
    ['trap_poison', 1780, 990], ['trap_fire', 5520, 4810], ['trap_spikes', 5690, 4990]
  ];
  for (const [kind, tx, ty] of trapDefs3) {
    traps.push({ id: `trap_${nextId++}`, kind, x: tx, y: ty, radius: 26, damage: kind === 'trap_fire' ? 26 : kind === 'trap_spikes' ? 20 : 16, hitCd: 0 });
  }
  const chestDefs3 = [
    ['chest_ash_1', 840, 2790, false], ['chest_ash_2', 1010, 3060, true],
    ['chest_lost_1', 1600, 1010, false], ['chest_ice_1', 3010, 690, true],
    ['chest_dead_1', 4200, 1390, false], ['chest_sky_1', 1620, 4820, true],
    ['chest_under_1', 3420, 4790, false], ['chest_gods_1', 5720, 5020, true]
  ];
  for (const [id, cx, cy, cursed] of chestDefs3) {
    chests.push({ id, x: cx, y: cy, looted: false, cursed });
  }
  for (const [cx, cy] of [[950, 2760], [1760, 790], [2790, 910], [4410, 1610], [1390, 4810], [3210, 4780], [5490, 5010], [5710, 4780]]) {
    nodes.push(makeNode(nextId++, 'crystal_node', cx, cy));
  }

  // ПАДЕНИЕ ДРЕВНИХ: ловушки, сундуки и жилы катакомб, пещер и цитадели
  const trapDefsF = [
    ['trap_spikes', 480, 4720], ['trap_spikes', 630, 4900], ['trap_poison', 4700, 2310],
    ['trap_spikes', 4910, 2500], ['trap_fire', 2420, 5810], ['trap_fire', 2590, 5990]
  ];
  for (const [kind, tx, ty] of trapDefsF) {
    traps.push({ id: `trap_${nextId++}`, kind, x: tx, y: ty, radius: 26, damage: kind === 'trap_fire' ? 26 : kind === 'trap_spikes' ? 20 : 16, hitCd: 0 });
  }
  const chestDefsF = [
    ['chest_cata_1', 640, 4690, false], ['chest_cata_2', 430, 4930, true],
    ['chest_crys_1', 4690, 2510, false], ['chest_crys_2', 4930, 2280, true],
    ['chest_cita_1', 2380, 6010, false], ['chest_cita_2', 2640, 5780, true]
  ];
  for (const [id, cx, cy, cursed] of chestDefsF) {
    chests.push({ id, x: cx, y: cy, looted: false, cursed });
  }
  for (const [cx, cy] of [[660, 4910], [4680, 2290], [2610, 6020], [420, 4660]]) {
    nodes.push(makeNode(nextId++, 'crystal_node', cx, cy));
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

  // ── 9. OPEN WORLD: древние руины, пещеры, огромные поля, достопримечательности ──
  // Генератор получает готовую карту и уже расставленный контент, чтобы не
  // ставить руины поверх арен боссов, дорог или зданий.
  const exploration = buildExploration({
    seed, W, H, rand, map,
    isClearSpot,
    nodes, props, buildings, hazards,
    makeNode,
    occupied: { camps: CAMPFIRES, bosses: Object.values(BOSSES), rescues: RESCUE_MISSIONS, modCaches }
  });

  // Точка внутри площадки исследования (руины, пещера, достопримечательность, поле)
  const exploreSites = [
    ...exploration.landmarks.map(l => ({ x: l.x, y: l.y, r: (l.radius || 90) + 30 })),
    ...exploration.caves.map(c => ({ x: c.x, y: c.y, r: 110 })),
    ...exploration.fields.map(f => ({ x: f.x, y: f.y, r: f.radius * 0.55 }))
  ];
  function insideExplorationSite(x, y) {
    for (const s2 of exploreSites) {
      const dx = x - s2.x, dy = y - s2.y;
      if (dx * dx + dy * dy < s2.r * s2.r) return true;
    }
    return false;
  }

  // ── GLOBAL MAP: естественное распределение растительности по биомам ──
  const BIOME_FLORA = {
    forest:  { density: 0.62, pick: [[0.50, 'tree'], [0.70, 'bush'], [0.84, 'rock'], [0.94, 'crates'], [1.0, 'barrel']] },
    plains:  { density: 0.52, pick: [[0.30, 'tree'], [0.62, 'bush'], [0.82, 'rock'], [0.92, 'crates'], [1.0, 'barrel']] },
    swamp:   { density: 0.58, pick: [[0.34, 'tree'], [0.72, 'bush'], [0.84, 'rock'], [0.94, 'barrel'], [1.0, 'crates']] },
    desert:  { density: 0.44, pick: [[0.34, 'rock'], [0.62, 'bush'], [0.80, 'barrel'], [0.92, 'crates'], [1.0, 'barrel_red']] },
    snow:    { density: 0.55, pick: [[0.46, 'pine_tree'], [0.72, 'rock'], [0.88, 'crates'], [1.0, 'barrel']] },
    mountains:{ density: 0.48, pick: [[0.52, 'rock'], [0.74, 'pine_tree'], [0.88, 'crates'], [1.0, 'barrel']] },
    city:    { density: 0.62, pick: [[0.30, 'crates'], [0.52, 'barrel'], [0.70, 'barrel_red'], [0.86, 'fence'], [1.0, 'bush']] },
    coast:   { density: 0.42, pick: [[0.40, 'rock'], [0.62, 'crates'], [0.84, 'barrel'], [1.0, 'bush']] },
    // OPEN WORLD: новые территории
    deep_forest: { density: 0.78, pick: [[0.62, 'tree'], [0.80, 'bush'], [0.90, 'rock'], [0.96, 'crates'], [1.0, 'barrel']] },
    ruins:       { density: 0.40, pick: [[0.30, 'rock'], [0.52, 'bush'], [0.72, 'crates'], [0.88, 'barrel'], [1.0, 'crystal_node']] },
    ashland:     { density: 0.34, pick: [[0.44, 'rock'], [0.66, 'bush'], [0.84, 'barrel_red'], [1.0, 'crates']] },
    canyon:      { density: 0.38, pick: [[0.56, 'rock'], [0.76, 'bush'], [0.90, 'crates'], [1.0, 'barrel']] },
    water:   { density: 0 }
  };

  const FLORA_TRIES = 7200;
  for (let i = 0; i < FLORA_TRIES; i++) {
    const x = 120 + rand() * (W - 240);
    const y = 120 + rand() * (H - 240);
    if (!isClearSpot(x, y, 46)) continue;

    const terrain = map.terrainAt(x, y);
    if (terrain.water) continue;                 // растительность только на суше
    // Не засоряем площадки исследования: руины, пещеры и поля должны
    // оставаться читаемыми, иначе игрок их не заметит среди деревьев.
    if (insideExplorationSite(x, y)) continue;
    const flora = BIOME_FLORA[terrain.biome];
    if (!flora || !flora.density) continue;
    // Кластерность: густые чащи и редколесье вместо равномерного «гороха»
    const cluster = fbm(x * 0.0042, y * 0.0042, seed + 77, 3, 0.55);
    if (cluster > flora.density) continue;

    let overlap = false;
    for (let j = nodes.length - 1; j >= Math.max(0, nodes.length - 80); j--) {
      if (dist2(x, y, nodes[j].x, nodes[j].y) < 62 * 62) { overlap = true; break; }
    }
    if (overlap) continue;

    const roll = rand();
    let kind = 'rock';
    for (const [threshold, k] of flora.pick) if (roll <= threshold) { kind = k; break; }

    // «fence» — статичный проп, остальное — разрушаемые узлы
    if (kind === 'fence') props.push({ id: `pr_${nextId++}`, kind, x, y, radius: 18 });
    else if (kind === 'rock') props.push({ id: `pr_${nextId++}`, kind, x, y, radius: 17 });
    else nodes.push(makeNode(nextId++, kind, x, y));
  }

  // Камыш и коряги по берегам рек и болот (декор + ресурс трав)
  for (let i = 0; i < 320; i++) {
    const x = 200 + rand() * (W - 400);
    const y = 200 + rand() * (H - 400);
    const c = map.cellAt(x, y);
    if (!(c.river || c.biome === 'swamp') || c.bridge) continue;
    if (!isClearSpot(x, y, 40)) continue;
    nodes.push(makeNode(nextId++, 'bush', x, y));
  }

  // Рудные выходы в горах и кристаллы в снегах
  for (let i = 0; i < 220; i++) {
    const x = 200 + rand() * (W - 400);
    const y = 200 + rand() * (H - 400);
    const terrain = map.terrainAt(x, y);
    if (terrain.water) continue;
    if (terrain.biome !== 'mountains' && terrain.biome !== 'snow') continue;
    if (!isClearSpot(x, y, 44)) continue;
    const roll = rand();
    if (roll < 0.55) props.push({ id: `pr_${nextId++}`, kind: 'rock', x, y, radius: 18 });
    else if (roll < 0.85) nodes.push(makeNode(nextId++, 'crystal_node', x, y));
    else nodes.push(makeNode(nextId++, 'pine_tree', x, y));
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
    seed,
    map,
    mapGrid: null,
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
    landmarks: exploration.landmarks,     // достопримечательности и скрытые места
    caves: exploration.caves,             // входы в пещеры
    fields: exploration.fields,           // огромные открытые поля
    fieldAt: exploration.fieldAt,         // O(1) запрос поля по точке мира
    queryPropsNear
  };
}

function makeNode(numId, kind, x, y) {
  const defs = {
    // radius — физический радиус для столкновений. Ствол дерева в 3D ~0.2 м,
    // то есть ~2 world-единицы: коллизия 16 давала 1.6 м «невидимой стены»
    // вокруг дерева (плюс радиус героя 14 — итого упор в 3 м от ствола).
    tree:       { name: 'Лесное дерево',     hp: 50, radius: 15, solid: true,  res: 'wood',   amt: [2, 4],
                  colRadius: 5 },
    pine_tree:  { name: 'Горная ель',        hp: 60, radius: 15, solid: true,  res: 'wood',   amt: [3, 5],
                  colRadius: 5 },
    bush:       { name: 'Био-куст',          hp: 20, radius: 13, solid: false, res: 'herb',   amt: [2, 3] },
    crates:     { name: 'Ящики снабжения',   hp: 30, radius: 16, solid: true,  res: 'crates', amt: [1, 2],
                  colRadius: 6 },
    barrel:     { name: 'Бочка с припасами', hp: 28, radius: 13, solid: true,  res: 'barrel', amt: [1, 2],
                  colRadius: 6 },
    barrel_red: { name: 'Топливная бочка',   hp: 22, radius: 13, solid: true,  res: 'boom',   amt: [1, 1],
                  colRadius: 6, explosive: true },
    crystal_node: { name: 'Жила Кристалла Бездны', hp: 70, radius: 15, solid: true, res: 'crystal', amt: [1, 3],
                  colRadius: 6 }
  };
  const d = defs[kind] || defs.crates;
  return {
    id: `node_${numId}`,
    kind,
    name: d.name,
    x,
    y,
    radius: d.radius,
    // Отдельный физический радиус: у деревьев это ствол, а не крона
    colRadius: d.colRadius ?? d.radius,
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
