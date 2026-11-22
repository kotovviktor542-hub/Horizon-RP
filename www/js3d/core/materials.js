// VEXMORA 3D — библиотека материалов и процедурных текстур.
// Текстуры генерируются на canvas в высоком разрешении (512–1024) с альбедо,
// нормалями (из карты высот карты) и шероховатостью — без внешних файлов,
// поэтому игра работает офлайн, а качество не зависит от загрузки по сети.

import * as THREE from 'three';

const cache = new Map();

// ── Утилиты шума ─────────────────────────────────────────────────────────
export function hash2(x, y, s = 1) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 144665);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function vnoise(x, y, s = 1) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, s), b = hash2(x0 + 1, y0, s);
  const c = hash2(x0, y0 + 1, s), d = hash2(x0 + 1, y0 + 1, s);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}
export function fbm(x, y, s = 1, oct = 4) {
  let v = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += vnoise(x * f, y * f, s + i * 31) * amp; amp *= 0.5; f *= 2; }
  return v;
}

// ── Генерация текстур на canvas ──────────────────────────────────────────
function makeCanvas(size) {
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  return cv;
}

function toTexture(canvas, repeat = 1, anisotropy = 4) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = anisotropy;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// Альбедо-текстура материала (цвет + фактура)
function albedoTexture(size, paint) {
  const cv = makeCanvas(size);
  const ctx = cv.getContext('2d');
  const img = ctx?.createImageData ? ctx.createImageData(size, size) : null;
  if (!img || !img.data) return cv;          // нет 2D-контекста: останется базовый цвет
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const c = paint(x / size, y / size, x, y);
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = c[3] ?? 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

// Нормаль-карта из карты высот (для рельефных поверхностей: камень, кора, черепица)
function normalTexture(size, heightFn, strength = 2.2) {
  const cv = makeCanvas(size);
  const ctx = cv.getContext('2d');
  const img = ctx?.createImageData ? ctx.createImageData(size, size) : null;
  if (!img || !img.data) return null;        // нормали необязательны
  const d = img.data;
  const h = (x, y) => heightFn(x / size, y / size, x, y);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = h(x + 1, y) - h(x - 1, y);
      const dy = h(x, y + 1) - h(x, y - 1);
      const nx = -dx * strength, ny = -dy * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      d[i] = ((nx / len) * 0.5 + 0.5) * 255;
      d[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      d[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;        // нормали — не цветовые данные
  tex.needsUpdate = true;
  return tex;
}

// Шероховатость (однокомпонентная, зелёный канал)
function roughTexture(size, fn) {
  const cv = makeCanvas(size);
  const ctx = cv.getContext('2d');
  const img = ctx?.createImageData ? ctx.createImageData(size, size) : null;
  if (!img || !img.data) return null;        // карта шероховатости необязательна
  const d = img.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    const v = Math.max(0, Math.min(255, fn(x / size, y / size) * 255));
    d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;        // шероховатость — линейные данные
  tex.needsUpdate = true;
  return tex;
}

const clamp255 = (v) => v < 0 ? 0 : v > 255 ? 255 : v;
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ── Описания поверхностей ────────────────────────────────────────────────
export const MATERIAL_SPECS = {
  grass: {
    color: [0.30, 0.44, 0.16], roughness: 0.92, metalness: 0,
    albedo: (u, v, x, y) => {
      const n = fbm(u * 22, v * 22, 3, 5);
      const blade = vnoise(u * 150, v * 150, 9);
      const dry = fbm(u * 6, v * 6, 17, 3);
      const base = mixc([46, 78, 30], [86, 118, 44], n);
      const mixed = mixc(base, [120, 122, 62], Math.max(0, dry - 0.55) * 1.8);
      const g = mixed.map((c, i) => clamp255(c + (blade - 0.5) * 26 + (i === 1 ? 6 : 0)));
      return [g[0], g[1], g[2], 255];
    }
  },
  dirt: {
    color: [0.30, 0.23, 0.15], roughness: 0.96,
    albedo: (u, v) => {
      const n = fbm(u * 14, v * 14, 5, 5);
      const pebble = vnoise(u * 90, v * 90, 11);
      const base = mixc([74, 56, 38], [112, 88, 62], n);
      const c = base.map(k => clamp255(k + (pebble - 0.5) * 30));
      return [c[0], c[1], c[2], 255];
    }
  },
  rock: {
    color: [0.42, 0.42, 0.45], roughness: 0.85,
    albedo: (u, v) => {
      const n = fbm(u * 10, v * 10, 7, 5);
      const crack = Math.abs(fbm(u * 16, v * 16, 21, 4) - 0.5);
      const base = mixc([92, 92, 98], [148, 148, 156], n);
      const dark = crack < 0.03 ? 0.45 : 1;
      const c = base.map(k => clamp255(k * dark));
      return [c[0], c[1], c[2], 255];
    },
    height: (u, v) => fbm(u * 12, v * 12, 7, 5) * 0.6 + Math.abs(fbm(u * 20, v * 20, 21, 3) - 0.5) * -0.5
  },
  sand: {
    color: [0.78, 0.68, 0.46], roughness: 0.93,
    albedo: (u, v) => {
      const dune = fbm(u * 8, v * 8, 13, 4);
      const grain = vnoise(u * 190, v * 190, 23);
      const base = mixc([196, 168, 112], [224, 200, 150], dune);
      const c = base.map(k => clamp255(k + (grain - 0.5) * 22));
      return [c[0], c[1], c[2], 255];
    }
  },
  snow: {
    color: [0.90, 0.93, 0.97], roughness: 0.72,
    albedo: (u, v) => {
      const n = fbm(u * 12, v * 12, 31, 4);
      const sparkle = vnoise(u * 220, v * 220, 37);
      const base = mixc([222, 232, 244], [252, 254, 255], n);
      const c = base.map(k => clamp255(k + (sparkle - 0.5) * 14));
      return [c[0], c[1], c[2], 255];
    }
  },
  swamp: {
    color: [0.24, 0.28, 0.18], roughness: 0.55, metalness: 0.05,
    albedo: (u, v) => {
      const n = fbm(u * 9, v * 9, 41, 5);
      const moss = vnoise(u * 60, v * 60, 43);
      const base = mixc([38, 46, 30], [70, 84, 48], n);
      const c = base.map(k => clamp255(k + (moss - 0.5) * 24));
      return [c[0], c[1], c[2], 255];
    }
  },
  asphalt: {
    color: [0.19, 0.20, 0.23], roughness: 0.78,
    albedo: (u, v) => {
      const n = fbm(u * 40, v * 40, 47, 4);
      const pebble = vnoise(u * 170, v * 170, 53);
      const base = mixc([42, 44, 50], [72, 74, 82], n);
      const c = base.map(k => clamp255(k + (pebble - 0.5) * 22));
      return [c[0], c[1], c[2], 255];
    }
  },
  bark: {
    color: [0.24, 0.16, 0.10], roughness: 0.95,
    albedo: (u, v) => {
      const line = Math.sin(v * 120 + fbm(u * 8, v * 8, 61, 3) * 9);
      const n = fbm(u * 26, v * 26, 63, 4);
      const base = mixc([52, 36, 22], [96, 70, 44], n);
      const c = base.map(k => clamp255(k + line * 14));
      return [c[0], c[1], c[2], 255];
    },
    height: (u, v) => Math.sin(v * 120 + fbm(u * 8, v * 8, 61, 3) * 9) * 0.5 + vnoise(u * 40, v * 40, 67) * 0.4
  },
  leaves: {
    color: [0.20, 0.34, 0.14], roughness: 0.88, transparent: false,
    albedo: (u, v) => {
      const clump = fbm(u * 18, v * 18, 71, 5);
      const leaf = vnoise(u * 110, v * 110, 73);
      const base = mixc([30, 56, 22], [78, 112, 42], clump);
      const c = base.map((k, i) => clamp255(k + (leaf - 0.5) * 34 + (i === 1 ? 8 : 0)));
      return [c[0], c[1], c[2], 255];
    }
  },
  pine: {
    color: [0.13, 0.26, 0.16], roughness: 0.9,
    albedo: (u, v) => {
      const clump = fbm(u * 22, v * 22, 79, 5);
      const needle = vnoise(u * 140, v * 140, 83);
      const base = mixc([20, 42, 26], [54, 84, 48], clump);
      const c = base.map(k => clamp255(k + (needle - 0.5) * 26));
      return [c[0], c[1], c[2], 255];
    }
  },
  stone: {
    color: [0.48, 0.47, 0.44], roughness: 0.82,
    albedo: (u, v) => {
      const block = (Math.floor(u * 8) + Math.floor(v * 16)) % 2;
      const n = fbm(u * 30, v * 30, 89, 4);
      const base = mixc([132, 128, 120], [176, 170, 158], n);
      const c = base.map(k => clamp255(k * (block ? 0.93 : 1.02)));
      return [c[0], c[1], c[2], 255];
    },
    height: (u, v) => {
      const bx = Math.abs((u * 8) % 1 - 0.5), by = Math.abs((v * 16) % 1 - 0.5);
      return Math.min(bx, by) * 1.6 + fbm(u * 30, v * 30, 89, 3) * 0.3;
    }
  },
  metal: {
    color: [0.58, 0.60, 0.64], roughness: 0.35, metalness: 0.85,
    albedo: (u, v) => {
      const n = fbm(u * 25, v * 25, 97, 4);
      const scratch = Math.abs(Math.sin(v * 220 + fbm(u * 12, v * 12, 101, 3) * 6));
      const base = mixc([96, 100, 108], [168, 172, 180], n);
      const c = base.map(k => clamp255(k + (scratch > 0.96 ? 30 : 0)));
      return [c[0], c[1], c[2], 255];
    }
  },
  cloth: {
    color: [0.36, 0.20, 0.18], roughness: 0.94,
    albedo: (u, v) => {
      const weave = (Math.sin(u * 320) * Math.sin(v * 320)) * 0.5 + 0.5;
      const n = fbm(u * 20, v * 20, 103, 4);
      const base = mixc([76, 44, 38], [132, 82, 68], n);
      const c = base.map(k => clamp255(k + (weave - 0.5) * 18));
      return [c[0], c[1], c[2], 255];
    }
  },
  leather: {
    color: [0.28, 0.19, 0.12], roughness: 0.72,
    albedo: (u, v) => {
      const grain = vnoise(u * 90, v * 90, 107);
      const n = fbm(u * 16, v * 16, 109, 4);
      const base = mixc([62, 42, 26], [104, 74, 46], n);
      const c = base.map(k => clamp255(k + (grain - 0.5) * 20));
      return [c[0], c[1], c[2], 255];
    }
  },
  bone: {
    color: [0.86, 0.83, 0.72], roughness: 0.65,
    albedo: (u, v) => {
      const n = fbm(u * 18, v * 18, 113, 4);
      const base = mixc([198, 192, 172], [236, 232, 214], n);
      return [base[0], base[1], base[2], 255];
    }
  }
};

// ── Публичный API ────────────────────────────────────────────────────────
export function createMaterial(name, opts = {}) {
  const quality = opts.quality || 'high';
  const sizeMap = { low: 128, medium: 256, high: 512, ultra: 1024 };
  const size = sizeMap[quality] || 512;
  const key = `${name}:${quality}:${opts.repeat || 1}`;
  if (cache.has(key)) return cache.get(key);

  const spec = MATERIAL_SPECS[name] || MATERIAL_SPECS.rock;
  const params = {
    color: new THREE.Color(spec.color[0], spec.color[1], spec.color[2]),
    roughness: spec.roughness ?? 0.9,
    metalness: spec.metalness ?? 0,
    ...(opts.params || {})
  };

  let canvasReady = false;
  try {
    canvasReady = typeof document !== 'undefined' && !!document.createElement &&
      !!document.createElement('canvas')?.getContext?.('2d');
  } catch { canvasReady = false; }

  if (canvasReady) {
   try {
    if (spec.albedo && quality !== 'low') {
      const cv = albedoTexture(size, spec.albedo);
      if (cv) {
        params.map = toTexture(cv, opts.repeat || 1, quality === 'ultra' ? 8 : 4);
        params.color = new THREE.Color(0xffffff);
      }
    }
    if (spec.height && (quality === 'high' || quality === 'ultra')) {
      const nrm = normalTexture(size, spec.height, 3.2);
      if (nrm) {
        params.normalMap = nrm;
        params.normalMap.repeat.set(opts.repeat || 1, opts.repeat || 1);
        params.normalScale = new THREE.Vector2(0.85, 0.85);
      }
    }
    if (quality !== 'low') {
      const rough = roughTexture(size, (u, v) => {
        const n = fbm(u * 12, v * 12, 131, 3);
        return Math.min(1, Math.max(0.25, (spec.roughness ?? 0.9) + (n - 0.5) * 0.28));
      });
      if (rough) {
        params.roughnessMap = rough;
        params.roughnessMap.repeat.set(opts.repeat || 1, opts.repeat || 1);
      }
    }
   } catch (err) {
     console.warn('[VEXMORA 3D] текстуры недоступны, используется базовый цвет:', err?.message);
   }
  } else {
    params.color = new THREE.Color(spec.color[0], spec.color[1], spec.color[2]);
  }

  const mat = new THREE.MeshStandardMaterial(params);
  mat.name = name;
  cache.set(key, mat);
  return mat;
}

// Простой цветной материал (для деталей, без текстур — экономия на мелких объектах)
const colorCache = new Map();
export function colorMaterial(hex, opts = {}) {
  const key = `${hex}:${JSON.stringify(opts)}`;
  if (colorCache.has(key)) return colorCache.get(key);
  const mat = new THREE.MeshStandardMaterial({ color: hex, ...opts });
  colorCache.set(key, mat);
  return mat;
}

// Эмиссивный материал (кристаллы, лава, магия, окна)
const emissiveCache = new Map();
export function emissiveMaterial(hex, intensity = 1.6, opts = {}) {
  const key = `${hex}:${intensity}:${JSON.stringify(opts)}`;
  if (emissiveCache.has(key)) return emissiveCache.get(key);
  const mat = new THREE.MeshStandardMaterial({
    color: hex, emissive: hex, emissiveIntensity: intensity,
    roughness: 0.35, metalness: 0.1, ...opts
  });
  emissiveCache.set(key, mat);
  return mat;
}

export function clearMaterialCache() {
  cache.clear();
  for (const m of colorCache.values()) m.dispose?.();
  colorCache.clear();
  for (const m of emissiveCache.values()) m.dispose?.();
  emissiveCache.clear();
}
