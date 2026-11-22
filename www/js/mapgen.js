// VEXMORA — GLOBAL MAP: процедурная генерация мира в духе WorldBox.
// Континент с океаном, островами, реками, озёрами, ущельями и биомами:
// леса, равнины, пустыни, снежные земли, болота, горы, мегаполис.
// Генерация полностью детерминирована по seed — карта сохраняется и восстанавливается 1:1.

import { CAMPFIRES, BOSSES, RESCUE_MISSIONS, LOCATIONS } from './data.js';

export const MAP_VERSION = 3;
export const MAP_CONFIG = {
  width: 6400,
  height: 6400,
  grid: 160,            // 40 world-единиц на клетку
  seaLevel: 0.375,
  atlasStep: 10         // 1 пиксель атласа = 10 world-единиц (640x640)
};

// ── Детерминированный генератор шума ──────────────────────────────────────
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2i(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 144665);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smoothstep = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function valueNoise(x, y, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = smoothstep(x - x0), fy = smoothstep(y - y0);
  const a = hash2i(x0, y0, seed);
  const b = hash2i(x0 + 1, y0, seed);
  const c = hash2i(x0, y0 + 1, seed);
  const d = hash2i(x0 + 1, y0 + 1, seed);
  const top = a + (b - a) * fx;
  const bot = c + (d - c) * fx;
  return top + (bot - top) * fy;
}

export function fbm(x, y, seed, octaves = 4, persistence = 0.5) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, y * freq, seed + i * 1013) * amp;
    norm += amp;
    amp *= persistence;
    freq *= 2;
  }
  return sum / norm;
}

// Хребты: острые горные гребни (ridged multifractal)
export function ridgedNoise(x, y, seed, octaves = 4) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(valueNoise(x * freq, y * freq, seed + i * 7919) * 2 - 1);
    sum += n * n * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

// ── Карта биомов (расширяет BIOMES из data.js) ────────────────────────────
export const MAP_BIOMES = {
  water:    { id: 'water',    name: 'Открытое море',        tile: 'water',    groundBase: '#1e4f78', groundAlt: '#173f61' },
  coast:    { id: 'coast',    name: 'Песчаный берег',       tile: 'sand',     groundBase: '#d8c08a', groundAlt: '#c8ab74' },
  plains:   { id: 'plains',   name: 'Зелёные Равнины',      tile: 'meadow',   groundBase: '#4e7c3c', groundAlt: '#446f35' },
  forest:   { id: 'forest',   name: 'Древние Леса',         tile: 'grass',    groundBase: '#38632f', groundAlt: '#2e5429' },
  swamp:    { id: 'swamp',    name: 'Гнилые Болота',        tile: 'swamp',    groundBase: '#3a4a35', groundAlt: '#2f3d2c' },
  desert:   { id: 'desert',   name: 'Раскалённые Пустыни',  tile: 'sand',     groundBase: '#c9a066', groundAlt: '#b98f55' },
  snow:     { id: 'snow',     name: 'Снежные Земли',        tile: 'snow',     groundBase: '#dbe6f0', groundAlt: '#c3d3e2' },
  mountains:{ id: 'mountains',name: 'Каменные Хребты',      tile: 'rock',     groundBase: '#7d7f84', groundAlt: '#686a70' },
  city:     { id: 'city',     name: 'Заброшенный Мегаполис',tile: 'asphalt',  groundBase: '#333945', groundAlt: '#2b303b' }
};

const BIOME_CODES = ['water', 'coast', 'plains', 'forest', 'swamp', 'desert', 'snow', 'mountains', 'city'];
const CODE_OF = Object.fromEntries(BIOME_CODES.map((id, i) => [id, i]));

// ── Генерация ─────────────────────────────────────────────────────────────
export function createMap(seed = 20261025) {
  const G = MAP_CONFIG.grid;
  const W = MAP_CONFIG.width;
  const H = MAP_CONFIG.height;
  const cell = W / G;
  const sea = MAP_CONFIG.seaLevel;
  const rand = mulberry32(seed);

  const elevation = new Float32Array(G * G);
  const moisture = new Float32Array(G * G);
  const temperature = new Float32Array(G * G);
  const water = new Uint8Array(G * G);     // 0 — суша, 1 — мелководье, 2 — глубина
  const river = new Uint8Array(G * G);     // река
  const bridge = new Uint8Array(G * G);    // мост через воду
  const forced = new Uint8Array(G * G);    // 255 — нет принудительного биома
  forced.fill(255);
  const biomeCode = new Uint8Array(G * G);

  const idx = (gx, gy) => gy * G + gx;
  const gxOf = (x) => Math.max(0, Math.min(G - 1, Math.floor(x / cell)));
  const gyOf = (y) => Math.max(0, Math.min(G - 1, Math.floor(y / cell)));

  // 1. Континент: радиальное затухание + fbm + горные гребни.
  //    Мир — большой материк с заливами, внутренним морем и архипелагом на юге.
  const bendSeed = seed % 9973;
  for (let gy = 0; gy < G; gy++) {
    for (let gx = 0; gx < G; gx++) {
      const nx = gx / (G - 1);
      const ny = gy / (G - 1);
      const cx = nx * 2 - 1;
      const cy = ny * 2 - 1;

      // Земная масса: суперэллипс + шум континента
      const radial = Math.pow(Math.pow(Math.abs(cx), 2.4) + Math.pow(Math.abs(cy), 2.4), 1 / 2.4);
      const continental = fbm(nx * 2.1 + 13.7, ny * 2.1 + 7.3, seed + 11, 5, 0.52);
      const coastline = fbm(nx * 5.4, ny * 5.4, seed + 53, 4, 0.5);

      // Береговые заливы (WorldBox-подобные изрезанные берега)
      const bays = (fbm(nx * 3.4 + 41, ny * 3.4 + 17, seed + 97, 3, 0.55) - 0.5) * 0.22;

      let e = 0.62 - radial * 0.34 + (continental - 0.5) * 0.30 + (coastline - 0.5) * 0.13 + bays;

      // Внутреннее море на юго-востоке + пролив
      const seaDx = nx - 0.70, seaDy = ny - 0.72;
      const innerSea = Math.exp(-((seaDx * seaDx) / 0.028 + (seaDy * seaDy) / 0.020));
      e -= innerSea * 0.30;

      // Архипелаг на юго-западе
      const islDx = nx - 0.20, islDy = ny - 0.84;
      const islandZone = Math.exp(-((islDx * islDx) / 0.012 + (islDy * islDy) / 0.008));
      const islands = fbm(nx * 16 + 3, ny * 16 + 9, seed + 313, 3, 0.5);
      e += islandZone * (islands - 0.46) * 0.55;

      // Горные хребты (север и центр)
      const ridges = ridgedNoise(nx * 3.6 + 5, ny * 3.6 + 21, seed + 131, 5);
      const mountainMask = clamp01((fbm(nx * 2.0 + 71, ny * 2.0 + 33, seed + 211, 3, 0.5) - 0.48) * 3.8);
      const northBias = clamp01((0.42 - ny) * 2.4);
      e += ridges * mountainMask * (0.13 + northBias * 0.20);

      // Ущелья: узкие глубокие разломы
      const canyon = Math.abs(fbm(nx * 4.6 + 61, ny * 4.6 + 77, seed + 401, 3, 0.5) - 0.5);
      if (canyon < 0.016 && e > sea + 0.09) e -= 0.12 + (0.016 - canyon) * 6.0;

      // Сжатие высот: основной массив суши — пологие равнины и леса,
      // горы остаются только на выраженных хребтах (иначе центр континента — сплошная скала)
      const eC = e > sea ? sea + (e - sea) * 0.60 : sea + (e - sea) * 0.82;
      elevation[idx(gx, gy)] = eC;

      // Влажность и температура (север — холод, юг — тепло)
      const m = fbm(nx * 3.1 + 7, ny * 3.1 + 29, seed + 503, 4, 0.55);
      const mWet = fbm(nx * 1.55 + 91, ny * 1.55 + 5, seed + 601, 3, 0.6);
      moisture[idx(gx, gy)] = clamp01((m * 0.55 + mWet * 0.45) * 1.18 - 0.09);
      temperature[idx(gx, gy)] = clamp01(0.10 + ny * 0.86 + (fbm(nx * 2.6, ny * 2.6, seed + 709, 3, 0.5) - 0.5) * 0.26);
    }
  }

  // 2. Океан, моря, озёра
  for (let i = 0; i < G * G; i++) {
    const e = elevation[i];
    if (e < sea) {
      water[i] = (sea - e) > 0.05 ? 2 : 1;
    }
  }
  // Озёра во впадинах суши (замкнутые низины)
  for (let gy = 2; gy < G - 2; gy++) {
    for (let gx = 2; gx < G - 2; gx++) {
      const i = idx(gx, gy);
      if (water[i]) continue;
      const e = elevation[i];
      if (e > sea + 0.05) continue;
      let lower = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        if (elevation[idx(gx + dx, gy + dy)] < e) lower++;
      }
      const wet = moisture[i];
      if (lower === 0 && wet > 0.46) water[i] = 1;
    }
  }

  // Защищённые зоны: реки не должны прорезать лагеря, арены боссов и магистрали
  const protectedCells = new Uint8Array(G * G);
  function protect(cx, cy, radius) {
    const gx0 = gxOf(cx - radius), gx1 = gxOf(cx + radius);
    const gy0 = gyOf(cy - radius), gy1 = gyOf(cy + radius);
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
      if (gx < 0 || gy < 0 || gx >= G || gy >= G) continue;
      const wx = gx * cell + cell * 0.5, wy = gy * cell + cell * 0.5;
      if (Math.hypot(wx - cx, wy - cy) <= radius) protectedCells[idx(gx, gy)] = 1;
    }
  }

  // ── 4. Якоря контента: гарантируем сушу и нужный биом вокруг ключевых точек
  function stampLand(cx, cy, radius, biome, pad = 0) {
    const r = radius + pad;
    const gx0 = gxOf(cx - r), gx1 = gxOf(cx + r);
    const gy0 = gyOf(cy - r), gy1 = gyOf(cy + r);
    const code = biome ? CODE_OF[biome] : 255;
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const wx = gx * cell + cell * 0.5;
        const wy = gy * cell + cell * 0.5;
        const d = Math.hypot(wx - cx, wy - cy);
        if (d > r) continue;
        const i = idx(gx, gy);
        const t = clamp01(1 - d / r);
        // Мягкое поднятие суши к краям зоны, полное — в центре
        elevation[i] = Math.max(elevation[i], sea + 0.045 + t * 0.09);
        water[i] = 0;
        river[i] = 0;
        if (code !== 255) {
          if (t > 0.18) forced[i] = code;
        }
      }
    }
  }

  const roadCells = new Uint8Array(G * G);
  function stampRoad(x1, y1, x2, y2, width) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.ceil(len / (cell * 0.5));
    const halfW = Math.max(1, Math.ceil(width * 0.5 / cell) + 1);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t;
      const cgx = gxOf(x), cgy = gyOf(y);
      for (let dy = -halfW; dy <= halfW; dy++) {
        for (let dx = -halfW; dx <= halfW; dx++) {
          const gx = cgx + dx, gy = cgy + dy;
          if (gx < 0 || gy < 0 || gx >= G || gy >= G) continue;
          const i = idx(gx, gy);
          roadCells[i] = 1;
          if (water[i]) {
            water[i] = 0;                     // мост/насыпь: дорога всегда проходима
            bridge[i] = 1;
            river[i] = 0;
          }
          elevation[i] = Math.max(elevation[i], sea + 0.05);
        }
      }
    }
  }

  // Биом для ключевых точек по их «родному» биому из data.js
  const anchorBiome = (campBiome) => {
    if (campBiome === 'city') return 'city';
    if (campBiome === 'desert') return 'desert';
    if (campBiome === 'mountains') return Math.random() < 0 ? 'snow' : 'mountains';
    return 'forest';
  };

  // Убежище VEXMORA — сердце мира, большая безопасная поляна
  stampLand(W * 0.494, H * 0.497, 520, 'plains', 90);

  // Урбанистические зоны: органичные пятна (шум + затухание), а не ровные круги
  function stampUrban(cx, cy, radius) {
    const gx0 = gxOf(cx - radius), gx1 = gxOf(cx + radius);
    const gy0 = gyOf(cy - radius), gy1 = gyOf(cy + radius);
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const wx = gx * cell + cell * 0.5;
        const wy = gy * cell + cell * 0.5;
        const d = Math.hypot(wx - cx, wy - cy) / radius;
        if (d > 1) continue;
        const i = idx(gx, gy);
        if (water[i]) continue;
        const n = fbm(wx * 0.0016, wy * 0.0016, seed + 887, 3, 0.5);
        const t = clamp01(1.15 - d);
        if (n * 0.55 + t * 0.75 > 0.62) forced[i] = CODE_OF.city;
      }
    }
  }
  stampUrban(W * 0.735, H * 0.50, 1180);
  stampUrban(W * 0.70, H * 0.785, 820);

  for (const camp of CAMPFIRES) stampLand(camp.x, camp.y, 230, anchorBiome(camp.biome));
  for (const b of Object.values(BOSSES)) stampLand(b.x, b.y, (b.arenaRadius || 320) * 0.85, anchorBiome(b.biome), 40);
  for (const rm of RESCUE_MISSIONS) stampLand(rm.x, rm.y, 200, null);
  for (const loc of Object.values(LOCATIONS)) {
    // У каждой локации свой тайл — просто гарантируем сушу
    stampLand(loc.x, loc.y, loc.radius, null, 60);
  }
  // Здания мегаполиса и промышленных районов — только гарантия суши под застройкой
  stampLand(W * 0.74, H * 0.50, 1250, null);
  stampLand(W * 0.70, H * 0.78, 850, null);
  stampLand(W * 0.83, H * 0.17, 650, 'snow');    // северный хребет
  stampLand(W * 0.27, H * 0.76, 850, 'desert');  // пустынный каньон

  // Дороги: сухопутные магистрали + мосты через реки и проливы
  // Суша под всеми застройками: здания, арены, спецсклады не стоят в воде
  for (const [bx, by, br] of [
    [4680, 3040, 150], [5120, 3040, 150], [4680, 3420, 150], [5140, 3420, 150],
    [4720, 2260, 150], [5420, 4340, 200], [4980, 2400, 180], [1540, 4880, 200],
    [1760, 4880, 180], [2040, 4720, 160], [2520, 5660, 200], [2820, 5840, 180],
    [1380, 1360, 180], [1540, 1370, 160], [4680, 920, 200], [5420, 620, 200],
    [4880, 1120, 170], [5180, 960, 190], [4080, 4845, 250], [2560, 3180, 320]
  ]) stampLand(bx, by, br, null);

  stampRoad(3160, 3180, 5650, 3180, 96);
  stampRoad(4920, 1880, 4920, 4660, 88);
  stampRoad(3160, 3180, 1580, 2180, 80);
  stampRoad(3160, 3180, 1860, 4680, 84);
  stampRoad(1860, 4680, 3480, 5360, 76);
  stampRoad(1580, 2180, 4460, 1280, 72);
  stampRoad(4460, 1280, 4920, 1880, 72);

  for (const camp of CAMPFIRES) protect(camp.x, camp.y, 170);
  for (const b of Object.values(BOSSES)) protect(b.x, b.y, (b.arenaRadius || 320) * 0.55);
  for (const rm of RESCUE_MISSIONS) protect(rm.x, rm.y, 130);
  for (const [bx, by] of [[4680, 3040], [5120, 3040], [4680, 3420], [5140, 3420], [4720, 2260],
                          [5420, 4340], [4980, 2400], [1540, 4880], [1760, 4880], [2040, 4720],
                          [2520, 5660], [2820, 5840], [1380, 1360], [1540, 1370], [4680, 920],
                          [5420, 620], [4880, 1120], [5180, 960], [4080, 4845], [2560, 3180]]) {
    protect(bx, by, 140);
  }
  for (const road of [[3160, 3180, 5650, 3180], [4920, 1880, 4920, 4660], [3160, 3180, 1580, 2180],
                      [3160, 3180, 1860, 4680], [1860, 4680, 3480, 5360], [1580, 2180, 4460, 1280],
                      [4460, 1280, 4920, 1880]]) {
    const [x1, y1, x2, y2] = road;
    const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / (cell * 0.5));
    for (let s2 = 0; s2 <= steps; s2++) {
      const t = s2 / steps;
      protect(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 46);
    }
  }

  // 5. Реки: истоки на возвышенностях, спуск по уклону до моря
  // Истоки рек: берём действительно высокие точки суши, разнесённые друг от друга
  const sources = [];
  const candidates = [];
  for (let gy = 6; gy < G - 6; gy += 2) {
    for (let gx = 6; gx < G - 6; gx += 2) {
      const i = idx(gx, gy);
      if (water[i]) continue;
      const e = elevation[i];
      if (e > sea + 0.06) candidates.push([e, gx, gy]);
    }
  }
  candidates.sort((a, b) => b[0] - a[0]);
  for (const [, gx, gy] of candidates) {
    if (sources.length >= 16) break;
    let tooClose = false;
    for (const [sx2, sy2] of sources) {
      if (Math.abs(sx2 - gx) + Math.abs(sy2 - gy) < 14) { tooClose = true; break; }
    }
    if (!tooClose) sources.push([gx, gy]);
  }

  for (const [sx, sy] of sources) {
    let cx = sx, cy = sy, dirX = 0, dirY = 0;
    for (let step = 0; step < 700; step++) {
      const i = idx(cx, cy);
      if (water[i]) break;
      if (protectedCells[i] || roadCells[i]) {
        // Река уходит под мост/насыпь или обходит лагерь
        if (roadCells[i] && !protectedCells[i]) { bridge[i] = 1; water[i] = 1; river[i] = 1; }
        break;
      }
      river[i] = 1;
      // Инерция русла + поиск минимальной высоты среди соседей
      let best = elevation[i], bx = cx, by = cy;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 1 || ny < 1 || nx >= G - 1 || ny >= G - 1) continue;
        const ne = elevation[idx(nx, ny)] + (dx === dirX && dy === dirY ? -0.012 : 0);
        if (ne < best) { best = ne; bx = nx; by = ny; }
      }
      if (bx === cx && by === cy) {
        // Тупик во впадине: прокладываем русло силой, ищем ближайшую низину к морю
        let found = false;
        for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 1 || ny < 1 || nx >= G - 1 || ny >= G - 1) continue;
          const j = idx(nx, ny);
          if (water[j]) { found = true; break; }
          if (elevation[j] < sea + 0.30) {
            elevation[j] -= 0.01;
            cx = nx; cy = ny; found = true; break;
          }
        }
        if (!found) break;
      } else {
        dirX = bx - cx; dirY = by - cy;
        cx = bx; cy = by;
      }
      // Река расширяется к устью
      if (step > 120) {
        const w = step > 320 ? 2 : 1;
        for (let dy = -w; dy <= w; dy++) for (let dx = -w; dx <= w; dx++) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 1 || ny < 1 || nx >= G - 1 || ny >= G - 1) continue;
          if (!water[idx(nx, ny)]) river[idx(nx, ny)] = 1;
        }
      }
    }
  }
  for (let i = 0; i < G * G; i++) {
    if (river[i] && !water[i]) {
      water[i] = 1;                            // реки проходимы вброд
      river[i] = 1;
    }
  }


  // ── 6. Классификация биомов ────────────────────────────────────────────

  for (let gy = 0; gy < G; gy++) {
    for (let gx = 0; gx < G; gx++) {
      const i = idx(gx, gy);
      const e = elevation[i];
      const m = moisture[i];
      const t = temperature[i];

      let code;
      if (forced[i] !== 255) {
        code = forced[i];
      } else if (water[i]) {
        code = water[i] === 2 ? CODE_OF.water : (e > sea - 0.03 ? CODE_OF.coast : CODE_OF.water);
      } else if (e > sea + 0.170) {
        code = t < 0.34 ? CODE_OF.snow : CODE_OF.mountains;        // горные хребты
      } else if (e > sea + 0.115 && m < 0.30) {
        code = CODE_OF.mountains;                                  // каменные плато
      } else if (t < 0.22) {
        code = CODE_OF.snow;
      } else if (e < sea + 0.062 && m > 0.50) {
        code = CODE_OF.swamp;                                      // заболоченные низины и дельты
      } else if (m < 0.36 && t > 0.55) {
        code = CODE_OF.desert;
      } else if (m > 0.495) {
        code = CODE_OF.forest;
      } else if (m > 0.40) {
        code = CODE_OF.plains;
      } else {
        code = t > 0.62 ? CODE_OF.desert : CODE_OF.plains;
      }

      // Прибрежная полоса — песок
      if (!water[i] && e < sea + 0.035 && code !== CODE_OF.city && code !== CODE_OF.swamp) {
        code = CODE_OF.coast;
      }
      biomeCode[i] = code;
    }
  }

  // Сглаживание одиночных клеток (убирает «шахматку» на стыках биомов)
  const smoothed = new Uint8Array(biomeCode);
  for (let gy = 1; gy < G - 1; gy++) {
    for (let gx = 1; gx < G - 1; gx++) {
      const i = idx(gx, gy);
      if (forced[i] !== 255) continue;
      const counts = new Map();
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const c = biomeCode[idx(gx + dx, gy + dy)];
        counts.set(c, (counts.get(c) || 0) + 1);
      }
      const own = biomeCode[i];
      let bestC = own, bestN = counts.get(own) || 0;
      for (const [c, n] of counts) if (n > bestN && c !== CODE_OF.water) { bestC = c; bestN = n; }
      if (bestN >= 6 && bestC !== own) smoothed[i] = bestC;
    }
  }

  // ── 6. Публичный API карты ─────────────────────────────────────────────
  const map = {
    version: MAP_VERSION,
    seed,
    width: W,
    height: H,
    grid: G,
    cell,
    seaLevel: sea,
    elevation,
    moisture,
    temperature,
    water,
    river,
    bridge,
    biomeCode: smoothed,
    BIOME_CODES,
    biomeAt(x, y) {
      const gx = gxOf(x), gy = gyOf(y);
      return BIOME_CODES[smoothed[gy * G + gx]] || 'plains';
    },
    cellAt(x, y) {
      const gx = gxOf(x), gy = gyOf(y);
      const i = gy * G + gx;
      return {
        gx, gy, index: i,
        biome: BIOME_CODES[smoothed[i]],
        elevation: elevation[i],
        moisture: moisture[i],
        temperature: temperature[i],
        water: water[i],
        river: !!river[i],
        bridge: !!bridge[i]
      };
    },
    // Тип поверхности и проходимость для геймплея
    terrainAt(x, y) {
      const gx = gxOf(x), gy = gyOf(y);
      const i = gy * G + gx;
      const w = water[i];
      const biome = BIOME_CODES[smoothed[i]];
      let type = 'land';
      let walkSpeed = 1;
      let swim = false;
      let deep = false;
      if (w && !bridge[i]) {
        if (river[i]) { type = 'river'; walkSpeed = 0.58; }
        else if (w === 1) { type = 'shallow'; walkSpeed = 0.52; swim = true; }
        else { type = 'deep'; walkSpeed = 0.34; swim = true; deep = true; }
      } else if (bridge[i]) {
        type = 'bridge';
        walkSpeed = 1.02;
      }
      if (biome === 'mountains') walkSpeed *= 0.90;
      if (biome === 'snow') walkSpeed *= 0.94;
      if (biome === 'swamp') walkSpeed *= 0.86;
      if (biome === 'city') walkSpeed *= 1.02;
      return {
        biome, type, water: w > 0 && !bridge[i], river: !!river[i], bridge: !!bridge[i],
        deep, swim, walkSpeed, elevation: elevation[i],
        blocked: false   // мир полностью исследуем: вода преодолевается вплавь
      };
    },
    // Ближайшая суша (для расстановки объектов и спасений при генерации)
    nearestLand(x, y, radius = 900) {
      for (let r = 0; r <= radius; r += cell) {
        for (let a = 0; a < 12; a++) {
          const ang = (a / 12) * Math.PI * 2;
          const nx = x + Math.cos(ang) * r;
          const ny = y + Math.sin(ang) * r;
          if (nx < 40 || ny < 40 || nx > W - 40 || ny > H - 40) continue;
          if (!water[idx(gxOf(nx), gyOf(ny))]) return { x: nx, y: ny };
        }
      }
      return { x, y };
    },
    // Статистика биомов для экрана карты
    stats() {
      const counts = {};
      for (let i = 0; i < smoothed.length; i++) {
        const id = BIOME_CODES[smoothed[i]];
        counts[id] = (counts[id] || 0) + 1;
      }
      const total = smoothed.length;
      let landCells = 0;
      for (let i = 0; i < smoothed.length; i++) if (!water[i]) landCells++;
      return { counts, total, landPercent: Math.round((landCells / total) * 100) };
    }
  };

  return map;
}

// ── Глобальная активная карта (движок, рендер и UI читают её без рефакторинга)
let ACTIVE_MAP = null;
export function setActiveMap(map) { ACTIVE_MAP = map; return map; }
export function getActiveMap() { return ACTIVE_MAP; }
export function getBiomeIdAt(x, y) {
  if (!ACTIVE_MAP) return 'plains';
  return ACTIVE_MAP.biomeAt(x, y);
}
export function getTerrainAt(x, y) {
  if (!ACTIVE_MAP) return { biome: 'plains', type: 'land', water: false, deep: false, swim: false, walkSpeed: 1, blocked: false };
  return ACTIVE_MAP.terrainAt(x, y);
}

// ── Компактное сохранение сгенерированной карты (RLE биомов) ──────────────
export function encodeMapGrid(map) {
  const codes = map.biomeCode;
  const parts = [];
  let prev = codes[0], run = 1;
  for (let i = 1; i < codes.length; i++) {
    if (codes[i] === prev && run < 9999) { run++; continue; }
    parts.push(`${prev}:${run}`);
    prev = codes[i];
    run = 1;
  }
  parts.push(`${prev}:${run}`);
  return parts.join(',');
}

export function decodeMapGrid(str) {
  if (typeof str !== 'string' || !str.length) return null;
  const out = [];
  for (const part of str.split(',')) {
    const [c, n] = part.split(':');
    const code = Number(c), count = Number(n);
    if (!Number.isFinite(code) || !Number.isFinite(count)) return null;
    for (let i = 0; i < count; i++) out.push(code);
  }
  return out;
}

// Мир под конкретный seed: применяем сохранённую сетку биомов, если она валидна.
export function createMapFromSave(seed, encodedGrid) {
  const map = createMap(seed);
  if (encodedGrid) {
    const codes = decodeMapGrid(encodedGrid);
    if (codes && codes.length === map.biomeCode.length) {
      map.biomeCode.set(codes);
      map.restored = true;
    }
  }
  return map;
}

export function randomMapSeed() {
  return (Math.floor(Math.random() * 0xfffffff0) + 8) >>> 0;
}
