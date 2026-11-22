// VEXMORA 3D — библиотека моделей: растительность, здания, руины, лагерь, транспорт.
// Модели состоят из нескольких мешей с PBR-материалами (не примитивные кубы):
// стволы с корой и нормалями, многослойные кроны, черепица крыш, каменная кладка,
// окна с эмиссией и т.д. Всё построено процедурно, кэшируется и переиспользуется.

import * as THREE from 'three';
import { createMaterial, colorMaterial, emissiveMaterial, fbm, vnoise } from '../core/materials.js';

const geoCache = new Map();
const disposed = [];

// ── Утилиты геометрии ────────────────────────────────────────────────────
function cachedGeo(key, build) {
  if (geoCache.has(key)) return geoCache.get(key);
  const g = build();
  geoCache.set(key, g);
  return g;
}

// Икосаэдр с шумом — органичная крона дерева
function blobGeometry(radius, detail, seed, squash = 1) {
  return cachedGeo(`blob:${radius}:${detail}:${seed}:${squash}`, () => {
    const g = new THREE.IcosahedronGeometry(radius, detail);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const n = fbm(x * 1.6 + seed, z * 1.6 + y, seed, 3);
      const k = 1 + (n - 0.5) * 0.55;
      pos.setXYZ(i, x * k, y * k * squash, z * k);
    }
    g.computeVertexNormals();
    return g;
  });
}

// ── Растительность ───────────────────────────────────────────────────────
export const Foliage = {
  // Лиственное дерево: ствол с корой, ветви, 3-5 слоёв кроны
  deciduous(scale = 1, seed = 1, variant = 0) {
    const group = new THREE.Group();
    const bark = createMaterial('bark', { quality: 'high', repeat: 2 });
    const leaves = createMaterial('leaves', { quality: 'high', repeat: 2 });
    const leafDark = colorMaterial(0x1d3a12, { roughness: 0.95 });
    const rnd = (n) => { const v = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453; return v - Math.floor(v); };

    const trunkH = (3.2 + rnd(1) * 1.6) * scale;
    const trunkR = (0.17 + rnd(2) * 0.06) * scale;
    const trunk = new THREE.Mesh(
      cachedGeo(`trunk:${trunkR.toFixed(2)}:${trunkH.toFixed(2)}`, () => {
        const g = new THREE.CylinderGeometry(trunkR * 0.72, trunkR, trunkH, 9, 3);
        const pos = g.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const y = pos.getY(i);
          const bend = Math.pow((y + trunkH / 2) / trunkH, 2) * 0.16 * scale;
          pos.setX(i, pos.getX(i) + bend);
        }
        g.computeVertexNormals();
        return g;
      }),
      bark
    );
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    // Корни у основания
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2 + rnd(3) * 0.8;
      const root = new THREE.Mesh(
        cachedGeo(`root:${trunkR.toFixed(2)}`, () => new THREE.CylinderGeometry(trunkR * 0.26, trunkR * 0.42, trunkR * 2.6, 6)),
        bark
      );
      root.position.set(Math.cos(ang) * trunkR * 1.4, trunkR * 0.5, Math.sin(ang) * trunkR * 1.4);
      root.rotation.z = Math.cos(ang) * 1.15;
      root.rotation.x = -Math.sin(ang) * 1.15;
      root.castShadow = true;
      group.add(root);
    }

    // Ветви
    const branchCount = 3 + Math.floor(rnd(4) * 2);
    for (let i = 0; i < branchCount; i++) {
      const ang = (i / branchCount) * Math.PI * 2 + rnd(5 + i) * 0.9;
      const len = (0.9 + rnd(6 + i) * 0.7) * scale;
      const br = new THREE.Mesh(
        cachedGeo(`branch:${len.toFixed(2)}:${trunkR.toFixed(2)}`, () => new THREE.CylinderGeometry(trunkR * 0.16, trunkR * 0.34, len, 5)),
        bark
      );
      const hy = trunkH * (0.55 + rnd(7 + i) * 0.32);
      br.position.set(Math.cos(ang) * len * 0.42, hy, Math.sin(ang) * len * 0.42);
      br.rotation.z = Math.cos(ang) * 0.95;
      br.rotation.x = -Math.sin(ang) * 0.95;
      br.castShadow = true;
      group.add(br);
    }

    // Крона: слои «комков» с тёмной нижней частью и светлой верхней
    const crownLayers = 3;
    for (let layer = 0; layer < crownLayers; layer++) {
      const t = layer / (crownLayers - 1);
      const r = (1.45 - t * 0.5) * scale;
      const count = 2 + layer;
      for (let k = 0; k < count; k++) {
        const ang = (k / count) * Math.PI * 2 + layer * 1.1 + rnd(8 + layer) * 0.6;
        const dist = (0.42 - t * 0.18) * scale;
        const blob = new THREE.Mesh(blobGeometry(r * (0.8 + rnd(9 + k) * 0.4), variant > 0 ? 1 : 2, seed + layer * 7 + k, 0.82), leaves);
        blob.position.set(
          Math.cos(ang) * dist + Math.cos(ang) * 0.12,
          trunkH * (0.78 + t * 0.28),
          Math.sin(ang) * dist + Math.sin(ang) * 0.12
        );
        blob.castShadow = true;
        blob.receiveShadow = true;
        group.add(blob);
      }
    }
    // Внутренняя тёмная масса, чтобы крона не просвечивала
    const core = new THREE.Mesh(blobGeometry(1.05 * scale, 1, seed + 99, 0.95), leafDark);
    core.position.y = trunkH * 0.92;
    group.add(core);

    group.userData.crownRadius = 1.5 * scale;
    return group;
  },

  // Ель: конусные ярусы, колючая фактура
  pine(scale = 1, seed = 2) {
    const group = new THREE.Group();
    const bark = createMaterial('bark', { repeat: 2 });
    const needles = createMaterial('pine', { repeat: 2 });
    const rnd = (n) => { const v = Math.sin(seed * 7.31 + n * 41.7) * 43758.5453; return v - Math.floor(v); };
    const h = (5.5 + rnd(1) * 2.5) * scale;
    const r = (0.16 + rnd(2) * 0.05) * scale;

    const trunk = new THREE.Mesh(
      cachedGeo(`ptrunk:${r.toFixed(2)}:${h.toFixed(2)}`, () => new THREE.CylinderGeometry(r * 0.6, r, h, 8)),
      bark
    );
    trunk.position.y = h / 2;
    trunk.castShadow = true;
    group.add(trunk);

    const tiers = 5;
    for (let i = 0; i < tiers; i++) {
      const t = i / (tiers - 1);
      const cr = (1.9 - t * 1.25) * scale;
      const ch = (1.9 - t * 0.7) * scale;
      const cone = new THREE.Mesh(
        cachedGeo(`cone:${cr.toFixed(2)}:${ch.toFixed(2)}`, () => {
          const g = new THREE.ConeGeometry(cr, ch, 10, 2);
          const pos = g.attributes.position;
          for (let v = 0; v < pos.count; v++) {
            const y = pos.getY(v);
            const jitter = (vnoise(pos.getX(v) * 3, pos.getZ(v) * 3, 21) - 0.5) * 0.22;
            pos.setX(v, pos.getX(v) * (1 + jitter));
            pos.setZ(v, pos.getZ(v) * (1 + jitter));
            pos.setY(v, y + jitter * 0.4);
          }
          g.computeVertexNormals();
          return g;
        }),
        needles
      );
      cone.position.y = h * (0.42 + t * 0.5);
      cone.rotation.y = rnd(3 + i) * Math.PI;
      cone.castShadow = true;
      cone.receiveShadow = true;
      group.add(cone);
    }
    return group;
  },

  // Засохшее дерево (для болот и пустошей)
  dead(scale = 1, seed = 3) {
    const group = new THREE.Group();
    const bark = colorMaterial(0x3b3026, { roughness: 0.95 });
    const rnd = (n) => { const v = Math.sin(seed * 3.7 + n * 29.1) * 43758.5453; return v - Math.floor(v); };
    const h = (3.5 + rnd(1) * 2) * scale;
    const trunk = new THREE.Mesh(
      cachedGeo(`dead:${h.toFixed(1)}`, () => new THREE.CylinderGeometry(0.10, 0.26, h, 7, 2)),
      bark
    );
    trunk.position.y = h / 2;
    trunk.rotation.z = (rnd(2) - 0.5) * 0.22;
    trunk.castShadow = true;
    group.add(trunk);
    for (let i = 0; i < 5; i++) {
      const len = (0.8 + rnd(4 + i) * 1.1) * scale;
      const br = new THREE.Mesh(cachedGeo(`deadbr:${len.toFixed(1)}`, () => new THREE.CylinderGeometry(0.03, 0.09, len, 5)), bark);
      const ang = rnd(6 + i) * Math.PI * 2;
      br.position.set(Math.cos(ang) * len * 0.35, h * (0.45 + rnd(7 + i) * 0.45), Math.sin(ang) * len * 0.35);
      br.rotation.z = Math.cos(ang) * (0.7 + rnd(8 + i) * 0.5);
      br.rotation.x = -Math.sin(ang) * (0.7 + rnd(9 + i) * 0.5);
      br.castShadow = true;
      group.add(br);
    }
    return group;
  },

  // Куст
  bush(scale = 1, seed = 4, dry = false) {
    const group = new THREE.Group();
    const mat = dry ? colorMaterial(0x6b6338, { roughness: 0.95 }) : createMaterial('leaves', { repeat: 3 });
    const rnd = (n) => { const v = Math.sin(seed * 5.1 + n * 13.7) * 43758.5453; return v - Math.floor(v); };
    for (let i = 0; i < 3; i++) {
      const r = (0.42 + rnd(i) * 0.3) * scale;
      const b = new THREE.Mesh(blobGeometry(r, 1, seed + i * 3, 0.8), mat);
      b.position.set((rnd(i + 5) - 0.5) * 0.7 * scale, r * 0.65, (rnd(i + 9) - 0.5) * 0.7 * scale);
      b.castShadow = true;
      group.add(b);
    }
    return group;
  },

  // Камень / валун с гранями
  rock(scale = 1, seed = 5) {
    const mat = createMaterial('rock', { repeat: 1 });
    const active = Math.random() < 0.5;
    const geo = cachedGeo(`rockgeo:${seed % 6}:${scale.toFixed(1)}`, () => {
      const g = new THREE.IcosahedronGeometry(1, 1);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const n = fbm(x * 2.2 + seed, z * 2.2 + y * 1.5, seed, 3);
        const k = 1 + (n - 0.5) * 0.75;
        pos.setXYZ(i, x * k, y * k * 0.72, z * k);
      }
      g.computeVertexNormals();
      return g;
    });
    const m = new THREE.Mesh(geo, mat);
    m.scale.setScalar(scale * 0.85);
    m.position.y = scale * 0.32;
    m.castShadow = true;
    m.receiveShadow = true;
    const group = new THREE.Group();
    group.add(m);
    if (active && scale > 0.8) {
      const small = new THREE.Mesh(geo, mat);
      small.scale.setScalar(scale * 0.35);
      small.position.set(scale * 0.7, scale * 0.14, scale * 0.35);
      group.add(small);
    }
    return group;
  },

  // Кристалл (эмиссия + прозрачность) — руды и магические жилы
  crystal(scale = 1, color = 0x7dd3fc) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.9,
      roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.88,
      flatShading: true
    });
    for (let i = 0; i < 4; i++) {
      const h = (0.55 + Math.random() * 0.75) * scale;
      const shard = new THREE.Mesh(cachedGeo(`shard:${i}`, () => new THREE.ConeGeometry(0.12, 1, 5)), mat);
      shard.scale.set(1, h, 1);
      shard.position.set((Math.random() - 0.5) * 0.4 * scale, h * 0.5, (Math.random() - 0.5) * 0.4 * scale);
      shard.rotation.z = (Math.random() - 0.5) * 0.5;
      shard.rotation.x = (Math.random() - 0.5) * 0.5;
      shard.castShadow = true;
      group.add(shard);
    }
    const light = new THREE.PointLight(color, 0.8, 4.5, 2);
    light.position.y = 0.5;
    group.add(light);
    return group;
  },

  // Трава/камыш (инстансированные пучки)
  grassTuft(scale = 1) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x4a6b2a, roughness: 0.95, side: THREE.DoubleSide });
    const g = new THREE.Group();
    const geo = cachedGeo('blade', () => {
      const plane = new THREE.PlaneGeometry(0.16, 0.55, 1, 2);
      const pos = plane.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        pos.setX(i, pos.getX(i) + Math.pow(y + 0.275, 2) * 0.7);
      }
      plane.translate(0, 0.275, 0);
      plane.computeVertexNormals();
      return plane;
    });
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(geo, mat);
      blade.rotation.y = (i / 3) * Math.PI * 2;
      blade.scale.setScalar(scale * (0.8 + Math.random() * 0.5));
      g.add(blade);
    }
    return g;
  }
};

// ── Здания и руины ───────────────────────────────────────────────────────
export const Structures = {
  // Жилой дом: цоколь, стены, окна со рамами, двускатная крыша-черепица, труба
  house(w = 7, h = 4.2, d = 6, seed = 1) {
    const group = new THREE.Group();
    const wallMat = createMaterial('stone', { repeat: 2 });
    const roofMat = colorMaterial(0x6b2f24, { roughness: 0.86 });
    const woodMat = createMaterial('bark', { repeat: 2 });
    const winMat = emissiveMaterial(0xffc46b, 0.55, { transparent: true, opacity: 0.92 });

    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    walls.position.y = h / 2;
    walls.castShadow = true;
    walls.receiveShadow = true;
    group.add(walls);

    // Фундамент
    const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.45, d + 0.3), createMaterial('stone', { repeat: 3 }));
    base.position.y = 0.22;
    base.receiveShadow = true;
    group.add(base);

    // Крыша: две наклонные плоскости + фронтоны
    const roofH = 2.1;
    for (const side of [-1, 1]) {
      const slope = new THREE.Mesh(new THREE.BoxGeometry(w + 0.7, 0.18, Math.hypot(d / 2, roofH) + 0.2), roofMat);
      slope.position.set(0, h + roofH / 2, side * d / 4);
      slope.rotation.x = side * Math.atan2(roofH, d / 2);
      slope.castShadow = true;
      group.add(slope);
    }
    // Черепица полосами
    for (let i = 0; i < 5; i++) {
      const t = i / 5;
      for (const side of [-1, 1]) {
        const tile = new THREE.Mesh(new THREE.BoxGeometry(w + 0.75, 0.06, 0.22), colorMaterial(0x54241c, { roughness: 0.9 }));
        tile.position.set(0, h + roofH * (0.12 + t * 0.86), side * (d / 2 - t * d * 0.42));
        tile.rotation.x = side * Math.atan2(roofH, d / 2);
        group.add(tile);
      }
    }
    const gableGeo = new THREE.BufferGeometry();
    gableGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      -w / 2, 0, 0, w / 2, 0, 0, 0, roofH, 0
    ]), 3));
    gableGeo.computeVertexNormals();
    for (const side of [-1, 1]) {
      const gable = new THREE.Mesh(gableGeo, wallMat);
      gable.position.set(0, h, side * d / 2);
      if (side < 0) gable.rotation.y = Math.PI;
      group.add(gable);
    }

    // Окна с рамами и светом
    const winRows = h > 3.6 ? 2 : 1;
    for (let r = 0; r < winRows; r++) {
      for (let c = -1; c <= 1; c += 2) {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.25, 0.12), woodMat);
        frame.position.set(c * w * 0.26, h * (0.35 + r * 0.34), d / 2 + 0.02);
        group.add(frame);
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.02, 0.1), winMat);
        win.position.set(c * w * 0.26, h * (0.35 + r * 0.34), d / 2 + 0.08);
        group.add(win);
        // Переплёт
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.02, 0.04), woodMat);
        bar.position.set(c * w * 0.26, h * (0.35 + r * 0.34), d / 2 + 0.14);
        group.add(bar);
      }
    }

    // Дверь
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.05, 2.1, 0.16), woodMat);
    door.position.set(0, 1.05, d / 2 + 0.02);
    group.add(door);
    const knob = new THREE.Mesh(cachedGeo('knob', () => new THREE.SphereGeometry(0.055, 8, 6)), colorMaterial(0xc9a227, { metalness: 0.9, roughness: 0.35 }));
    knob.position.set(0.35, 1.05, d / 2 + 0.12);
    group.add(knob);

    // Труба
    const chim = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.5, 0.55), createMaterial('stone', { repeat: 2 }));
    chim.position.set(w * 0.28, h + roofH * 0.72, -d * 0.18);
    chim.castShadow = true;
    group.add(chim);

    const light = new THREE.PointLight(0xffb45a, 0.7, 7, 2);
    light.position.set(0, h * 0.55, d / 2 + 0.7);
    group.add(light);
    return group;
  },

  // Магазин/павильон: витрина, навес, вывеска, ящики
  shop(w = 8, h = 4.6, d = 6) {
    const group = Structures.house(w, h, d, 3);
    const awningMat = colorMaterial(0xb03030, { roughness: 0.8, side: THREE.DoubleSide });
    const awning = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.12, 1.9), awningMat);
    awning.position.set(0, h * 0.68, d / 2 + 0.9);
    awning.rotation.x = 0.24;
    awning.castShadow = true;
    group.add(awning);
    for (let i = 0; i < 5; i++) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry((w + 0.6) / 5, 0.14, 1.92), colorMaterial(0xf0e6d2, { roughness: 0.85 }));
      stripe.position.set(-(w + 0.6) / 2 + (i + 0.5) * (w + 0.6) / 5, h * 0.68 + 0.01, d / 2 + 0.9);
      stripe.rotation.x = 0.24;
      group.add(stripe);
    }
    const sign = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.75, 0.14), emissiveMaterial(0xffd27a, 0.6));
    sign.position.set(0, h * 0.92, d / 2 + 0.1);
    group.add(sign);
    return group;
  },

  // Сторожевая вышка: четыре опоры, площадка, перила, навес
  watchtower(w = 2.6, h = 8) {
    const group = new THREE.Group();
    const wood = createMaterial('bark', { repeat: 2 });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, h, 6), wood);
        leg.position.set(sx * w / 2, h / 2, sz * w / 2);
        leg.rotation.z = -sx * 0.045;
        leg.rotation.x = sz * 0.045;
        leg.castShadow = true;
        group.add(leg);
      }
    }
    // Раскосы
    for (let i = 1; i <= 2; i++) {
      const y = (h / 3) * i;
      for (const [a, b] of [[[-1, -1], [1, 1]], [[-1, 1], [1, -1]]]) {
        const dx = (b[0] - a[0]) * w / 2, dz = (b[1] - a[1]) * w / 2;
        const len = Math.hypot(dx, dz, h / 3);
        const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, len, 5), wood);
        brace.position.set(0, y - h / 6, 0);
        brace.rotation.z = Math.atan2(dx, h / 3);
        brace.rotation.x = -Math.atan2(dz, h / 3);
        group.add(brace);
      }
    }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 0.18, w + 1.2), wood);
    deck.position.y = h;
    deck.castShadow = true;
    deck.receiveShadow = true;
    group.add(deck);
    // Перила
    for (const [rx, rz, rw, rd] of [[0, (w + 1.2) / 2, w + 1.2, 0.1], [0, -(w + 1.2) / 2, w + 1.2, 0.1],
                                    [(w + 1.2) / 2, 0, 0.1, w + 1.2], [-(w + 1.2) / 2, 0, 0.1, w + 1.2]]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.12, rd), wood);
      rail.position.set(rx, h + 1.0, rz);
      group.add(rail);
    }
    // Навес
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.95, 1.5, 4), createMaterial('bark', { repeat: 2 }));
    roof.position.y = h + 2.4;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);
    return group;
  },

  // Крепость/руины: зубчатые стены, башни, арки
  fortress(w = 14, h = 7, d = 12, ruined = false) {
    const group = new THREE.Group();
    const stone = createMaterial('stone', { repeat: 3 });
    const wallMat = createMaterial('rock', { repeat: 4 });

    // Стены по периметру с бойницами
    const wallThick = 1.1;
    const walls = [
      { x: 0, z: -d / 2, w: w, d: wallThick },
      { x: 0, z: d / 2, w: w, d: wallThick },
      { x: -w / 2, z: 0, w: wallThick, d: d },
      { x: w / 2, z: 0, w: wallThick, d: d }
    ];
    for (const wl of walls) {
      const height = ruined ? h * (0.35 + Math.random() * 0.45) : h;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(wl.w, height, wl.d), stone);
      mesh.position.set(wl.x, height / 2, wl.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      if (!ruined) {
        // Зубцы
        const count = Math.floor(Math.max(wl.w, wl.d) / 1.6);
        for (let i = 0; i < count; i++) {
          const t = (i + 0.5) / count - 0.5;
          const merlon = new THREE.Mesh(new THREE.BoxGeometry(
            wl.w > wl.d ? 0.85 : wallThick, 0.85, wl.w > wl.d ? wallThick : 0.85
          ), stone);
          merlon.position.set(
            wl.x + (wl.w > wl.d ? t * wl.w : 0),
            height + 0.42,
            wl.z + (wl.d > wl.w ? t * wl.d : 0)
          );
          merlon.castShadow = true;
          group.add(merlon);
        }
      }
    }

    // Угловые башни
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const th = ruined ? h * 0.6 : h + 2.2;
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, th, 12), wallMat);
        tower.position.set(sx * w / 2, th / 2, sz * d / 2);
        tower.castShadow = true;
        tower.receiveShadow = true;
        group.add(tower);
        if (!ruined) {
          const roof = new THREE.Mesh(new THREE.ConeGeometry(2.15, 2.2, 12), colorMaterial(0x3a2a33, { roughness: 0.8 }));
          roof.position.set(sx * w / 2, th + 1.1, sz * d / 2);
          roof.castShadow = true;
          group.add(roof);
        }
      }
    }

    // Внутренний двор: плиты
    const floor = new THREE.Mesh(new THREE.BoxGeometry(w - 2.4, 0.2, d - 2.4), createMaterial('stone', { repeat: 4 }));
    floor.position.y = 0.1;
    floor.receiveShadow = true;
    group.add(floor);

    // Ворота
    const gate = new THREE.Mesh(new THREE.BoxGeometry(3.2, 4.2, 0.4), colorMaterial(0x4a3220, { roughness: 0.9 }));
    gate.position.set(0, 2.1, d / 2 + 0.4);
    group.add(gate);
    for (let i = 0; i < 4; i++) {
      const iron = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.12, 0.45), colorMaterial(0x2b2b30, { metalness: 0.85, roughness: 0.4 }));
      iron.position.set(0, 0.8 + i * 0.9, d / 2 + 0.42);
      group.add(iron);
    }
    return group;
  },

  // Костёр: камни, брёвна, пламя с частицами
  campfire() {
    const group = new THREE.Group();
    const stoneMat = createMaterial('rock', { repeat: 1 });
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const s = new THREE.Mesh(cachedGeo('fstone', () => new THREE.DodecahedronGeometry(0.17, 0)), stoneMat);
      s.position.set(Math.cos(ang) * 0.52, 0.1, Math.sin(ang) * 0.52);
      s.scale.set(1, 0.8, 1);
      s.castShadow = true;
      group.add(s);
    }
    const logMat = createMaterial('bark', { repeat: 1 });
    for (let i = 0; i < 4; i++) {
      const log = new THREE.Mesh(cachedGeo('flog', () => new THREE.CylinderGeometry(0.09, 0.11, 0.9, 6)), logMat);
      const ang = (i / 4) * Math.PI * 2 + 0.3;
      log.position.set(Math.cos(ang) * 0.18, 0.2, Math.sin(ang) * 0.18);
      log.rotation.z = Math.PI / 2 - 0.35;
      log.rotation.y = -ang;
      group.add(log);
    }
    // Пламя: конусы с эмиссией
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff8c2a, transparent: true, opacity: 0.85 });
    const flameCore = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 });
    const flames = [];
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(cachedGeo('flame', () => new THREE.ConeGeometry(0.24, 0.9, 7)), i === 0 ? flameCore : flameMat);
      f.position.y = 0.55 + i * 0.08;
      f.scale.setScalar(1 - i * 0.22);
      group.add(f);
      flames.push(f);
    }
    const light = new THREE.PointLight(0xff8c3a, 3.2, 14, 2);
    light.position.y = 0.9;
    light.castShadow = false;
    group.add(light);
    group.userData.flames = flames;
    group.userData.light = light;
    group.userData.isCampfire = true;
    return group;
  },

  // Палатка
  tent() {
    const group = new THREE.Group();
    const tentMat = new THREE.MeshStandardMaterial({ color: 0x3f4a34, roughness: 0.92, side: THREE.DoubleSide });
    const geo = new THREE.ConeGeometry(1.5, 1.8, 4, 1, false);
    const tent = new THREE.Mesh(geo, tentMat);
    tent.position.y = 0.9;
    tent.rotation.y = Math.PI / 4;
    tent.castShadow = true;
    group.add(tent);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), createMaterial('bark', { repeat: 1 }));
    pole.position.y = 1.2;
    group.add(pole);
    return group;
  },

  // Ящики/бочки (разрушаемые объекты)
  crate() {
    const group = new THREE.Group();
    const wood = createMaterial('bark', { repeat: 2 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.85), wood);
    box.position.y = 0.42;
    box.castShadow = true;
    box.receiveShadow = true;
    group.add(box);
    const metal = colorMaterial(0x4a4a52, { metalness: 0.8, roughness: 0.45 });
    for (const y of [0.18, 0.66]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.07, 0.88), metal);
      band.position.y = y;
      group.add(band);
    }
    return group;
  },

  barrel(explosive = false) {
    const group = new THREE.Group();
    const mat = explosive ? colorMaterial(0xb03030, { metalness: 0.5, roughness: 0.5 }) : colorMaterial(0x6b5a3a, { metalness: 0.6, roughness: 0.55 });
    const body = new THREE.Mesh(cachedGeo('barrel', () => new THREE.CylinderGeometry(0.34, 0.34, 0.95, 14)), mat);
    body.position.y = 0.48;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    const rimMat = colorMaterial(0x2e2e34, { metalness: 0.85, roughness: 0.4 });
    for (const y of [0.2, 0.48, 0.76]) {
      const rim = new THREE.Mesh(cachedGeo('rim', () => new THREE.TorusGeometry(0.345, 0.035, 6, 16)), rimMat);
      rim.position.y = y;
      rim.rotation.x = Math.PI / 2;
      group.add(rim);
    }
    if (explosive) {
      const stripe = new THREE.Mesh(cachedGeo('bstripe', () => new THREE.CylinderGeometry(0.345, 0.345, 0.16, 14, 1, true)), emissiveMaterial(0xffd23a, 0.5, { side: THREE.DoubleSide }));
      stripe.position.y = 0.48;
      group.add(stripe);
    }
    return group;
  },

  // Фонарный столб с тёплым светом (город)
  streetLamp() {
    const group = new THREE.Group();
    const metal = colorMaterial(0x24262c, { metalness: 0.8, roughness: 0.45 });
    const pole = new THREE.Mesh(cachedGeo('lampPole', () => new THREE.CylinderGeometry(0.07, 0.1, 4.6, 8)), metal);
    pole.position.y = 2.3;
    pole.castShadow = true;
    group.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.08), metal);
    arm.position.set(0.42, 4.55, 0);
    group.add(arm);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.32, 8), metal);
    head.position.set(0.85, 4.42, 0);
    group.add(head);
    const bulb = new THREE.Mesh(cachedGeo('bulb', () => new THREE.SphereGeometry(0.14, 10, 8)), emissiveMaterial(0xffd9a0, 2.2));
    bulb.position.set(0.85, 4.28, 0);
    group.add(bulb);
    const light = new THREE.PointLight(0xffc98a, 2.0, 12, 2);
    light.position.set(0.85, 4.2, 0);
    group.add(light);
    return group;
  },

  // Разбитая дорога/плита
  roadSegment(w = 6, d = 12) {
    const mat = createMaterial('asphalt', { repeat: 3 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), mat);
    mesh.receiveShadow = true;
    mesh.position.y = 0.02;
    return mesh;
  }
};

// ── Транспорт ────────────────────────────────────────────────────────────
export const Vehicles3D = {
  car(kind, colors = {}) {
    const group = new THREE.Group();
    const bodyColor = colors.body ?? 0xa01820;
    const paint = new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.65, roughness: 0.28 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x8fc4dd, metalness: 0.3, roughness: 0.08, transparent: true, opacity: 0.72 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x14151a, roughness: 0.92 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xcfd6de, metalness: 1.0, roughness: 0.16 });
    const lamp = emissiveMaterial(0xfff2c0, 1.4);
    const tail = emissiveMaterial(0xff2a2a, 1.1);

    const L = 4.2, W = 1.85, H = 0.62;
    // Основной корпус с сужением к капоту (используем экструзию скруглённого профиля)
    const bodyShape = new THREE.Shape();
    bodyShape.moveTo(-L / 2, 0);
    bodyShape.lineTo(L / 2, 0);
    bodyShape.lineTo(L / 2 - 0.18, 0.22);
    bodyShape.lineTo(L / 2 - 0.6, 0.30);
    bodyShape.lineTo(-L / 2 + 0.35, 0.34);
    bodyShape.lineTo(-L / 2, 0.26);
    bodyShape.closePath();
    const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: W, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.05, bevelSegments: 2 });
    bodyGeo.rotateY(Math.PI / 2);
    bodyGeo.translate(0, 0.18, 0);
    const body = new THREE.Mesh(bodyGeo, paint);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Кабина (стеклянный объём с крышей)
    const cabinLen = kind === 'truck' ? 1.7 : 2.0;
    const cabinOffset = kind === 'truck' ? -L / 2 + cabinLen / 2 + 0.15 : -0.15;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(cabinLen, 0.72, W - 0.22), glassMat);
    cabin.position.set(-cabinOffset, 0.86, 0);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(cabinLen + 0.05, 0.12, W - 0.16), paint);
    roof.position.set(-cabinOffset, 1.24, 0);
    roof.castShadow = true;
    group.add(cabin, roof);

    // Детали: решётка, бамперы, фары, стопы, выхлоп
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, W - 0.5), chrome);
    grille.position.set(L / 2 - 0.05, 0.42, 0);
    group.add(grille);
    for (const z of [-1, 1]) {
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.34), lamp);
      head.position.set(L / 2 - 0.06, 0.48, z * (W / 2 - 0.32));
      group.add(head);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.3), tail);
      tl.position.set(-L / 2 + 0.04, 0.48, z * (W / 2 - 0.32));
      group.add(tl);
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.22), paint);
      mirror.position.set(-cabinOffset + cabinLen / 2, 0.92, z * (W / 2 + 0.08));
      group.add(mirror);
    }
    // Колёса с протектором
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.28, 18);
    wheelGeo.rotateX(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.30, 12);
    hubGeo.rotateX(Math.PI / 2);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const wheel = new THREE.Mesh(wheelGeo, rubber);
        wheel.position.set(sx * (L / 2 - 0.85), 0.4, sz * (W / 2 - 0.05));
        wheel.castShadow = true;
        const hub = new THREE.Mesh(hubGeo, chrome);
        hub.position.copy(wheel.position);
        group.add(wheel, hub);
      }
    }
    if (kind === 'truck') {
      const bed = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.3, W - 0.1), new THREE.MeshStandardMaterial({ color: 0x8b93a1, metalness: 0.5, roughness: 0.5 }));
      bed.position.set(L / 2 - 1.35, 0.95, 0);
      bed.castShadow = true;
      group.add(bed);
    }
    if (kind === 'apc') {
      body.scale.set(1, 1.5, 1.25);
      const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 0.55, 12), paint);
      turret.position.set(-0.2, 1.75, 0);
      turret.castShadow = true;
      group.add(turret);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.5, 8), chrome);
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(0.55, 1.78, 0);
      group.add(barrel);
    }
    group.userData.wheels = [];
    group.traverse(o => { if (o.isMesh && o.geometry === wheelGeo) group.userData.wheels.push(o); });
    return group;
  },

  bike() {
    const group = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color: 0xc02020, metalness: 0.7, roughness: 0.3 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x121317, roughness: 0.9 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xcfd6de, metalness: 1, roughness: 0.15 });
    const wheelGeo = new THREE.TorusGeometry(0.36, 0.1, 8, 18);
    for (const x of [-0.72, 0.72]) {
      const w = new THREE.Mesh(wheelGeo, rubber);
      w.position.set(x, 0.4, 0);
      w.rotation.y = Math.PI / 2;
      w.castShadow = true;
      group.add(w);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.03, 6, 16), chrome);
      rim.position.copy(w.position);
      rim.rotation.y = Math.PI / 2;
      group.add(rim);
    }
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.14), chrome);
    frame.position.set(0, 0.55, 0);
    group.add(frame);
    const tank = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), paint);
    tank.scale.set(1.4, 0.75, 0.8);
    tank.position.set(0.05, 0.72, 0);
    tank.castShadow = true;
    group.add(tank);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.28), colorMaterial(0x1b1b20, { roughness: 0.8 }));
    seat.position.set(-0.45, 0.78, 0);
    group.add(seat);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.62, 6), chrome);
    bar.rotation.x = Math.PI / 2;
    bar.position.set(0.62, 0.92, 0);
    group.add(bar);
    return group;
  }
};

export function clearGeometryCache() {
  for (const g of geoCache.values()) g.dispose();
  geoCache.clear();
}
