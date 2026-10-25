// Генератор большого открытого мира (4800x4800), биомов, ресурсов, ловушек и 4 секретных локаций

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
  // Плавные границы с детерминированным волновым смещением
  const wave = Math.sin(x * 0.0035) * 75 + Math.cos(y * 0.0035) * 75;
  if (x < 1960 + wave && y < 1960 - wave * 0.5) return 'mire';
  if (x >= 1960 + wave && y < 1500 + wave * 0.6) return 'frost';
  if (x > 2860 + wave * 0.6 && y > 3160 - wave * 0.5) return 'rift';
  if (x > 2940 - wave * 0.5 && y >= 1500 && y <= 3160) return 'ruins';
  return 'meadow';
}

export function createWorld(seed = 20261025) {
  const rand = mulberry32(seed);
  const W = WORLD_CONFIG.width;
  const H = WORLD_CONFIG.height;

  const obstacles = [];     // статические препятствия (камни, колонны, стены)
  const nodes = [];         // добываемые ресурсы и ящики (с респавном)
  const hazards = [];       // шипы, кислота, лава, глубокая вода
  const steppingStones = [];// каменные плиты через воду к секретному острову
  const chests = [];        // сундуки с добычей
  const braziers = [];      // жаровни загадки Монолита
  const roads = [];         // тропы от лагеря к биомам

  let nextId = 1;

  // Тропы от центрального лагеря к ключевым кострам
  const hubs = [
    { x: 3320, y: 2360 },
    { x: 1460, y: 1460 },
    { x: 3050, y: 1080 },
    { x: 3360, y: 3520 },
    { x: 1180, y: 3960 }
  ];
  for (const h of hubs) {
    roads.push({ x1: 2400, y1: 2380, x2: h.x, y2: h.y, width: 68 });
  }

  function isProtectedZone(x, y, pad = 90) {
    // Лагерь Рубежа
    if (dist2(x, y, 2400, 2380) < (330 + pad) ** 2) return true;
    // Костры
    for (const c of CAMPFIRES) {
      if (dist2(x, y, c.x, c.y) < (145 + pad) ** 2) return true;
    }
    // Арены боссов
    for (const b of Object.values(BOSSES)) {
      if (dist2(x, y, b.x, b.y) < (b.arenaRadius + pad) ** 2) return true;
    }
    // Секретные зоны
    for (const s of SECRETS) {
      if (dist2(x, y, s.x, s.y) < (240 + pad) ** 2) return true;
    }
    // Дороги
    for (const r of roads) {
      const dx = r.x2 - r.x1;
      const dy = r.y2 - r.y1;
      const len2 = dx * dx + dy * dy;
      const t = Math.max(0, Math.min(1, ((x - r.x1) * dx + (y - r.y1) * dy) / len2));
      const px = r.x1 + t * dx;
      const py = r.y1 + t * dy;
      if (dist2(x, y, px, py) < (r.width + pad * 0.4) ** 2) return true;
    }
    return false;
  }

  // ── 1. Постройки Лагеря Рубежа ──────────────────────────────────────
  // Каменные фонари по углам площади лагеря
  const lanternCoords = [
    [2240, 2240], [2560, 2240], [2240, 2520], [2560, 2520]
  ];
  for (const [lx, ly] of lanternCoords) {
    obstacles.push({ id: `obs_${nextId++}`, kind: 'lantern', x: lx, y: ly, radius: 18 });
  }
  // Наковальня возле Кузнеца Торна
  obstacles.push({ id: `obs_${nextId++}`, kind: 'anvil', x: 2548, y: 2318, radius: 18 });

  // Стартовые ресурсы прямо рядом с лагерем, чтобы игрок увидел добычу в первые 10 секунд
  const starterNodes = [
    { kind: 'herb', x: 2150, y: 2560 },
    { kind: 'herb', x: 2220, y: 2640 },
    { kind: 'tree', x: 2080, y: 2460 },
    { kind: 'tree', x: 2670, y: 2590 },
    { kind: 'iron_vein', x: 2690, y: 2200 },
    { kind: 'iron_vein', x: 2130, y: 2210 },
    { kind: 'crate', x: 2280, y: 2580 },
    { kind: 'crate', x: 2610, y: 2460 }
  ];
  for (const sn of starterNodes) {
    nodes.push(makeNode(nextId++, sn.kind, sn.x, sn.y));
  }

  // ── 2. Секрет №1: Забытый Склеп Руин (за разрушаемой рунной стеной) ──
  // Каменная ограда склепа с проходом с запада (x=4250, y=1620), перекрытым рунной преградой
  const cryptWalls = [
    [4260, 1540], [4305, 1540], [4350, 1540], [4395, 1540], [4430, 1575],
    [4430, 1620], [4430, 1665], [4395, 1700], [4350, 1700], [4305, 1700], [4260, 1700],
    [4255, 1572], [4255, 1668]
  ];
  for (const [wx, wy] of cryptWalls) {
    obstacles.push({ id: `obs_${nextId++}`, kind: 'ruin_pillar', x: wx, y: wy, radius: 22 });
  }
  nodes.push({
    id: 'secret_rune_wall',
    kind: 'rune_wall',
    name: 'Треснувшая рунная печать',
    x: 4255,
    y: 1620,
    radius: 26,
    hp: 160,
    maxHp: 160,
    respawnTimer: 0,
    permanentBreak: true,
    dropResource: 'soul',
    dropAmount: [2, 3]
  });
  chests.push({
    id: 'chest_secret_crypt',
    secretId: 'secret_crypt',
    kind: 'mythic',
    x: 4355,
    y: 1620,
    opened: false
  });

  // ── 3. Секрет №2: Остров Светлячков (озеро + прыжки по плитам) ──────
  // Водное кольцо вокруг (920, 3960), с востока мостик из каменных плит (нужно перепрыгивать!)
  hazards.push({
    id: 'lake_firefly',
    kind: 'water_moat',
    x: 920,
    y: 3960,
    innerRadius: 110,
    outerRadius: 235
  });
  // Каменные островки с восточной стороны (от x=1165 до x=1025)
  const padX = [1150, 1095, 1040];
  for (const px of padX) {
    steppingStones.push({ x: px, y: 3960, radius: 28 });
  }
  chests.push({
    id: 'chest_secret_island',
    secretId: 'secret_island',
    kind: 'mythic',
    x: 920,
    y: 3960,
    opened: false
  });

  // ── 4. Секрет №3: Монолит Предтеч (3 жаровни) ───────────────────────
  obstacles.push({
    id: 'monolith_core',
    kind: 'monolith',
    x: 2450,
    y: 560,
    radius: 30
  });
  const monoSecret = SECRETS.find(s => s.id === 'secret_monolith');
  for (const br of monoSecret.braziers) {
    braziers.push({ id: br.id, x: br.x, y: br.y, radius: 20, lit: false });
  }
  chests.push({
    id: 'chest_secret_monolith',
    secretId: 'secret_monolith',
    kind: 'mythic',
    x: 2450,
    y: 635,
    lockedUntilBraziers: true,
    opened: false
  });

  // ── 5. Секрет №4: Тайник Алхимика в Топях ───────────────────────────
  // Окружён кислотными лужами (можно обойти по узкой тропе или перепрыгнуть)
  const mireRing = [
    [520, 1555], [615, 1605], [615, 1715], [520, 1765], [425, 1715], [425, 1605]
  ];
  for (const [hx, hy] of mireRing) {
    hazards.push({ id: `haz_${nextId++}`, kind: 'acid', x: hx, y: hy, radius: 38 });
  }
  chests.push({
    id: 'chest_secret_alchemist',
    secretId: 'secret_alchemist',
    kind: 'mythic',
    x: 520,
    y: 1660,
    opened: false
  });

  // ── 6. Оформление арен 4 боссов колоннами по периметру ──────────────
  for (const boss of Object.values(BOSSES)) {
    const count = 10;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      // Оставляем широкий вход со стороны центра карты
      const toCenter = Math.atan2(2400 - boss.y, 2400 - boss.x);
      let diff = Math.abs(((ang - toCenter + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff < 0.55) continue;
      const px = boss.x + Math.cos(ang) * boss.arenaRadius;
      const py = boss.y + Math.sin(ang) * boss.arenaRadius;
      obstacles.push({
        id: `obs_${nextId++}`,
        kind: boss.biome === 'frost' ? 'ice_pillar' : boss.biome === 'rift' ? 'obsidian_spire' : 'ruin_pillar',
        x: px,
        y: py,
        radius: 22
      });
    }
  }

  // ── 7. Процедурное наполнение мира: деревья, руда, травы, сундуки, ловушки ──
  for (let i = 0; i < 420; i++) {
    const x = 140 + rand() * (W - 280);
    const y = 140 + rand() * (H - 280);
    if (isProtectedZone(x, y, 45)) continue;
    const biome = getBiomeIdAt(x, y);

    // Проверка минимальной дистанции до других объектов
    let tooClose = false;
    for (let j = obstacles.length - 1; j >= Math.max(0, obstacles.length - 60); j--) {
      if (dist2(x, y, obstacles[j].x, obstacles[j].y) < 88 * 88) { tooClose = true; break; }
    }
    if (tooClose) continue;

    const roll = rand();
    if (roll < 0.36) {
      // Препятствие декора/ландшафта
      const kindByBiome = {
        meadow: rand() < 0.65 ? 'rock' : 'bush_statue',
        ruins: 'ruin_pillar',
        mire: 'twisted_root',
        frost: 'ice_pillar',
        rift: 'obsidian_spire'
      };
      obstacles.push({
        id: `obs_${nextId++}`,
        kind: kindByBiome[biome],
        x,
        y,
        radius: 21
      });
    } else if (roll < 0.86) {
      // Добываемый ресурс по биому
      let nodeKind = 'tree';
      const r2 = rand();
      if (biome === 'meadow') {
        nodeKind = r2 < 0.42 ? 'tree' : r2 < 0.72 ? 'herb' : r2 < 0.90 ? 'iron_vein' : 'crate';
      } else if (biome === 'ruins') {
        nodeKind = r2 < 0.45 ? 'iron_vein' : r2 < 0.72 ? 'crate' : r2 < 0.88 ? 'herb' : 'mithril_vein';
      } else if (biome === 'mire') {
        nodeKind = r2 < 0.45 ? 'herb' : r2 < 0.78 ? 'mithril_vein' : 'tree';
      } else if (biome === 'frost') {
        nodeKind = r2 < 0.48 ? 'mithril_vein' : r2 < 0.78 ? 'pine_tree' : 'crystal_vein';
      } else {
        nodeKind = r2 < 0.58 ? 'crystal_vein' : r2 < 0.85 ? 'mithril_vein' : 'crate';
      }
      nodes.push(makeNode(nextId++, nodeKind, x, y));
    } else if (roll < 0.95) {
      // Опасности мира (шипы, кислота, лава — перепрыгиваются!)
      if (biome === 'ruins') {
        hazards.push({ id: `haz_${nextId++}`, kind: 'spikes', x, y, radius: 28, phase: rand() * 6 });
      } else if (biome === 'mire') {
        hazards.push({ id: `haz_${nextId++}`, kind: 'acid', x, y, radius: 36 });
      } else if (biome === 'rift') {
        hazards.push({ id: `haz_${nextId++}`, kind: 'lava', x, y, radius: 36 });
      }
    } else {
      // Сундук сокровищ в открытом мире
      chests.push({
        id: `chest_${nextId++}`,
        kind: biome === 'rift' || biome === 'frost' ? 'gold' : 'wood',
        biome,
        x,
        y,
        opened: false
      });
    }
  }

  // Пространственная сетка для быстрого поиска препятствий (O(1) на слабых телефонах)
  const CELL = 240;
  const cols = Math.ceil(W / CELL);
  const rows = Math.ceil(H / CELL);
  const grid = Array.from({ length: cols * rows }, () => []);

  for (const obs of obstacles) {
    const cx = Math.max(0, Math.min(cols - 1, Math.floor(obs.x / CELL)));
    const cy = Math.max(0, Math.min(rows - 1, Math.floor(obs.y / CELL)));
    grid[cy * cols + cx].push(obs);
  }

  function queryObstaclesNear(x, y) {
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    const out = [];
    for (let dy = -1; dy <= 1; dy++) {
      const ny = cy + dy;
      if (ny < 0 || ny >= rows) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx;
        if (nx < 0 || nx >= cols) continue;
        const cell = grid[ny * cols + nx];
        for (let k = 0; k < cell.length; k++) out.push(cell[k]);
      }
    }
    return out;
  }

  return {
    width: W,
    height: H,
    obstacles,
    nodes,
    hazards,
    steppingStones,
    chests,
    braziers,
    roads,
    biomes: BIOMES,
    queryObstaclesNear
  };
}

function makeNode(numId, kind, x, y) {
  const defs = {
    tree:         { name: 'Древний дуб',       hp: 45,  radius: 22, dropResource: 'wood',    dropAmount: [2, 4] },
    pine_tree:    { name: 'Морозная ель',      hp: 65,  radius: 22, dropResource: 'wood',    dropAmount: [3, 5] },
    herb:         { name: 'Куст алой травы',   hp: 20,  radius: 16, dropResource: 'herb',    dropAmount: [2, 3] },
    iron_vein:    { name: 'Железная жила',     hp: 60,  radius: 21, dropResource: 'iron',    dropAmount: [2, 3] },
    mithril_vein: { name: 'Мифриловая жила',   hp: 95,  radius: 22, dropResource: 'mithril', dropAmount: [2, 3] },
    crystal_vein: { name: 'Кристалл Разлома',  hp: 135, radius: 23, dropResource: 'crystal', dropAmount: [1, 3] },
    crate:        { name: 'Походный ящик',     hp: 25,  radius: 18, dropResource: 'crate',   dropAmount: [1, 2] }
  };
  const d = defs[kind] || defs.tree;
  return {
    id: `node_${numId}`,
    kind,
    name: d.name,
    x,
    y,
    radius: d.radius,
    hp: d.hp,
    maxHp: d.hp,
    hitFlash: 0,
    respawnTimer: 0,
    dropResource: d.dropResource,
    dropAmount: d.dropAmount
  };
}
