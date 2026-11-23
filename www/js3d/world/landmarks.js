// VEXMORA 3D — OPEN WORLD: модели достопримечательностей и территорий.
// Здесь только геометрия: руины, обелиски, статуи, врата, обсерватории,
// лагеря, святилища, обломки, порталы пещер, алтари и трава полей.
//
// Принципы производительности (Android):
//   • каждый объект — 2–5 склеенных мешей (по материалу), а не десятки деталей;
//   • дальние достопримечательности не строятся вовсе — их видно только
//     с близкого расстояния, зато их много;
//   • трава полей — InstancedMesh, один материал на поле.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createMaterial, colorMaterial, emissiveMaterial } from '../core/materials.js';

const TAU = Math.PI * 2;
const matCache = new Map();
function stone(tint = 0x8a8272, rough = 0.92) {
  const key = `stone:${tint}:${rough}`;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color: tint, roughness: rough, metalness: 0.04, flatShading: true }));
  return matCache.get(key);
}

function mergeByMaterial(root) {
  if (typeof mergeGeometries !== 'function') return root;
  const buckets = new Map();
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.material) return;
    if (o.material.transparent) return;
    const key = `${o.parent?.uuid}|${o.material.uuid}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(o);
  });
  for (const [, list] of buckets) {
    if (list.length < 2) continue;
    const parent = list[0].parent;
    const geos = [];
    for (const m of list) { m.updateMatrix(); const g = m.geometry.clone(); g.applyMatrix4(m.matrix); geos.push(g); }
    const merged = mergeGeometries(geos, false);
    geos.forEach(g => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, list[0].material);
    mesh.castShadow = true; mesh.receiveShadow = true;
    for (const old of list) parent.remove(old);
    parent.add(mesh);
  }
  return root;
}

const rnd = (seed, n = 1) => {
  const v = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * Строит модель достопримечательности по её данным.
 * Возвращает THREE.Group с началом координат на земле.
 */
export function buildLandmarkModel(lm) {
  const g = new THREE.Group();
  g.name = `landmark_${lm.id}`;
  const s = (lm.seed || 1) + (lm.radius || 90) * 0.01;

  switch (lm.kind || lm.type) {
    case 'ruin': buildRuin(g, lm, s); break;
    case 'obelisk': buildObelisk(g, lm, s); break;
    case 'statue': buildStatue(g, lm, s); break;
    case 'gate': buildGate(g, lm, s); break;
    case 'observatory': buildObservatory(g, lm, s); break;
    case 'shrine': buildShrine(g, lm, s); break;
    case 'camp': buildCamp(g, lm, s); break;
    case 'wreck': buildWreck(g, lm, s); break;
    case 'cave': buildCaveMouth(g, lm, s); break;
    default: buildHiddenCache(g, lm, s); break;
  }
  return mergeByMaterial(g);
}

// ── Руины ────────────────────────────────────────────────────────────────
function buildRuin(g, lm, s) {
  const stoneMat = stone(lm.biome === 'canyon' ? 0x9a6242 : lm.biome === 'snow' ? 0xa8b2b8 : 0x8a8272);
  const mossMat = stone(0x4a6b3a, 0.95);
  const R = 60;
  if (lm.kind === 'arch') {
    // Арка из двух опор и перекладины
    for (const sx of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.1, 11, 8), stoneMat);
      pillar.position.set(sx * 6.2, 5.5, 0);
      pillar.castShadow = true;
      g.add(pillar);
      // База колонны
      const base = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.2, 4.4), stoneMat);
      base.position.set(sx * 6.2, 0.6, 0);
      g.add(base);
      // Обломки у подножия
      for (let i = 0; i < 3; i++) {
        const chunk = new THREE.Mesh(new THREE.BoxGeometry(1.6 + rnd(s + i) * 1.2, 0.9, 1.4), stoneMat);
        chunk.position.set(sx * (8 + rnd(s + i, 3) * 5), 0.45, (rnd(s + i, 7) - 0.5) * 9);
        chunk.rotation.set(rnd(s + i, 2) * 0.4, rnd(s + i, 4) * TAU, rnd(s + i, 6) * 0.3);
        g.add(chunk);
      }
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(17, 2.2, 4), stoneMat);
    lintel.position.y = 11.6;
    lintel.rotation.z = 0.03;
    lintel.castShadow = true;
    g.add(lintel);
    // Рунная надпись
    const runes = new THREE.Mesh(new THREE.BoxGeometry(9, 0.7, 0.3), emissiveMaterial(0x60a5fa, 1.6));
    runes.position.set(0, 11.2, 2.1);
    g.add(runes);
  } else if (lm.kind === 'colonnade') {
    // Ряд колонн с частично обрушенным фронтоном
    for (let i = 0; i < 6; i++) {
      const h = i === 3 ? 4.5 : 8 + rnd(s + i) * 2;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, h, 8), stoneMat);
      col.position.set(-15 + i * 6, h / 2, 0);
      col.castShadow = true;
      g.add(col);
      if (i !== 3) {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.8, 3.4), stoneMat);
        cap.position.set(-15 + i * 6, h + 0.4, 0);
        g.add(cap);
      }
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(30, 1.4, 3), stoneMat);
    beam.position.set(-3, 9.2, 0);
    beam.rotation.z = -0.045;
    g.add(beam);
    // Мох и трава у основания
    for (let i = 0; i < 5; i++) {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.6, 5), mossMat);
      tuft.position.set((rnd(s + i, 9) - 0.5) * 26, 0.8, (rnd(s + i, 11) - 0.5) * 8);
      g.add(tuft);
    }
  } else if (lm.kind === 'altar') {
    // Алтарь с жертвенным камнем и свечением
    const base = new THREE.Mesh(new THREE.CylinderGeometry(7, 8.4, 1.4, 10), stoneMat);
    base.position.y = 0.7;
    base.receiveShadow = true;
    g.add(base);
    const step = new THREE.Mesh(new THREE.CylinderGeometry(5, 6, 1.1, 10), stoneMat);
    step.position.y = 1.85;
    g.add(step);
    const table = new THREE.Mesh(new THREE.BoxGeometry(6, 1.6, 3.4), stoneMat);
    table.position.y = 3.2;
    table.castShadow = true;
    g.add(table);
    // Четыре столбика вокруг
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.4;
      const px = Math.cos(a) * 15, pz = Math.sin(a) * 15;
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 6.5, 6), stoneMat);
      pil.position.set(px, 3.25, pz);
      g.add(pil);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 5), emissiveMaterial(0xfbbf24, 2.2));
      glow.position.set(px, 6.9, pz);
      g.add(glow);
    }
    const aura = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.18, 5, 18), emissiveMaterial(0xfbbf24, 1.8));
    aura.rotation.x = Math.PI / 2;
    aura.position.y = 4.2;
    g.add(aura);
  } else {
    // Круг камней с центральным монолитом
    const count = 8;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU;
      const px = Math.cos(a) * 22, pz = Math.sin(a) * 22;
      const h = 2.2 + rnd(s + i) * 3.4;
      const monolith = new THREE.Mesh(new THREE.BoxGeometry(2.2, h, 1.3), stoneMat);
      monolith.position.set(px, h / 2, pz);
      monolith.rotation.y = a + 0.2;
      monolith.rotation.z = (rnd(s + i, 5) - 0.5) * 0.16;
      monolith.castShadow = true;
      g.add(monolith);
    }
    const centerStone = new THREE.Mesh(new THREE.BoxGeometry(3.2, 7, 2.6), stoneMat);
    centerStone.position.y = 3.5;
    centerStone.rotation.y = 0.4;
    centerStone.castShadow = true;
    g.add(centerStone);
    const glyph = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.4, 0.2), emissiveMaterial(0x60a5fa, 1.7));
    glyph.position.set(0, 4.4, 1.35);
    g.add(glyph);
  }
  // Плитка пола
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.34, R * 0.36, 0.25, 14), stone(0x6a6459));
  floor.position.y = 0.12;
  floor.receiveShadow = true;
  g.add(floor);
}

// ── Достопримечательности ────────────────────────────────────────────────
function buildObelisk(g, lm, s) {
  const m = stone(0x6a6a72, 0.88);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.4, 1.6, 6), m);
  base.position.y = 0.8;
  base.castShadow = true;
  g.add(base);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 2.2, 17, 4), m);
  shaft.position.y = 9.6;
  shaft.rotation.y = Math.PI / 4;
  shaft.castShadow = true;
  g.add(shaft);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(1.15, 2.6, 4), emissiveMaterial(lm.biome === 'snow' ? 0x93c5fd : 0xfbbf24, 1.8));
  tip.position.y = 19.4;
  tip.rotation.y = Math.PI / 4;
  g.add(tip);
  for (let i = 0; i < 4; i++) {
    const glyph = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.4, 0.15), emissiveMaterial(0x60a5fa, 1.4, { transparent: true, opacity: 0.9 }));
    const a = (i / 4) * TAU;
    glyph.position.set(Math.cos(a) * 1.35, 6 + i * 2.2, Math.sin(a) * 1.35);
    glyph.lookAt(0, 6 + i * 2.2, 0);
    g.add(glyph);
  }
}

function buildStatue(g, lm, s) {
  const m = stone(lm.biome === 'city' ? 0x9aa0aa : 0x8a8272, 0.85);
  const ped = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 7), m);
  ped.position.y = 2;
  ped.castShadow = true;
  g.add(ped);
  const step = new THREE.Mesh(new THREE.BoxGeometry(9, 1, 9), m);
  step.position.y = 0.5;
  g.add(step);
  // Фигура: торс, голова, руки, меч
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.1, 5.2, 7), m);
  torso.position.y = 6.6;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.25, 8, 7), m);
  head.position.y = 10;
  g.add(head);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.5, 0.9, 6), emissiveMaterial(0xfbbf24, 1.2));
  crown.position.y = 10.9;
  g.add(crown);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.45, 4.2, 6), m);
  arm.position.set(1.9, 7.4, 0.4);
  arm.rotation.z = -0.9;
  g.add(arm);
  const sword = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7.2, 0.22), stone(0xb0b6bd, 0.45));
  sword.position.set(3.4, 7.6, 0.5);
  sword.rotation.z = -0.24;
  g.add(sword);
  // Разрушения: отбитые куски у подножия
  for (let i = 0; i < 4; i++) {
    const chunk = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1), m);
    chunk.position.set((rnd(s + i, 3) - 0.5) * 12, 0.4, (rnd(s + i, 5) - 0.5) * 12);
    chunk.rotation.y = rnd(s + i, 7) * TAU;
    g.add(chunk);
  }
}

function buildGate(g, lm, s) {
  const m = stone(0x7a7a86, 0.9);
  for (const sx of [-1, 1]) {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.4, 13, 8), m);
    tower.position.set(sx * 8, 6.5, 0);
    tower.castShadow = true;
    g.add(tower);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(3.6, 3, 6), stone(0x4a4a55, 0.9));
    cap.position.set(sx * 8, 14.5, 0);
    g.add(cap);
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(7.6, 1.1, 6, 14, Math.PI), m);
  arch.position.y = 12.6;
  arch.castShadow = true;
  g.add(arch);
  // Светящийся портал внутри арки
  const portal = new THREE.Mesh(new THREE.CircleGeometry(6.6, 18), emissiveMaterial(0xa78bfa, 1.4, { transparent: true, opacity: 0.42, side: THREE.DoubleSide }));
  portal.position.set(0, 6.6, 0);
  g.add(portal);
  g.userData.portal = portal;
  // Дорожка к вратам
  const path = new THREE.Mesh(new THREE.BoxGeometry(9, 0.2, 16), stone(0x6a6459));
  path.position.set(0, 0.1, 8);
  path.receiveShadow = true;
  g.add(path);
}

function buildObservatory(g, lm, s) {
  const m = stone(0x9aa4ae, 0.85);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(9, 10.5, 3, 12), m);
  base.position.y = 1.5;
  base.castShadow = true;
  g.add(base);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 7.4, 11, 12), m);
  tower.position.y = 8.5;
  tower.castShadow = true;
  g.add(tower);
  // Купол с прорезью
  const dome = new THREE.Mesh(new THREE.SphereGeometry(6.6, 14, 8, 0, TAU, 0, Math.PI * 0.55), stone(0x7a8490, 0.7));
  dome.position.y = 14;
  g.add(dome);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, 7, 8), emissiveMaterial(0x60d0ff, 1.6));
  lens.position.set(2.4, 17.4, 0.6);
  lens.rotation.z = -0.8;
  lens.rotation.x = 0.35;
  g.add(lens);
  // Колонны по кругу
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, 5.5, 6), m);
    col.position.set(Math.cos(a) * 11, 2.6, Math.sin(a) * 11);
    g.add(col);
  }
}

function buildShrine(g, lm, s) {
  const m = stone(0x8a8a92, 0.9);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(9, 9.6, 0.6, 12), m);
  ring.position.y = 0.3;
  ring.receiveShadow = true;
  g.add(ring);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 5, 6), m);
    col.position.set(Math.cos(a) * 7.4, 2.5, Math.sin(a) * 7.4);
    g.add(col);
  }
  const altar = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 2), m);
  altar.position.y = 1.4;
  g.add(altar);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.2, 6), emissiveMaterial(0x93c5fd, 2.4, { transparent: true, opacity: 0.85 }));
  flame.position.y = 3.2;
  g.add(flame);
  g.userData.flame = flame;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(8.4, 3.4, 8), stone(0x4a5a6a, 0.9));
  roof.position.y = 7.6;
  g.add(roof);
}

function buildCamp(g, lm, s) {
  const tentMat = colorMaterial(0x6b5a3a, { roughness: 0.95 });
  const woodMat = colorMaterial(0x5a4028, { roughness: 0.9 });
  // Палатка
  const tent = new THREE.Mesh(new THREE.ConeGeometry(4.4, 5.2, 4), tentMat);
  tent.position.set(-6, 2.6, 0);
  tent.rotation.y = 0.4;
  tent.castShadow = true;
  g.add(tent);
  // Костровище
  const stoneMat = stone(0x6a6459);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), stoneMat);
    st.position.set(6 + Math.cos(a) * 1.9, 0.4, Math.sin(a) * 1.9);
    g.add(st);
  }
  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.4, 6), emissiveMaterial(0xff8a3a, 2.2, { transparent: true, opacity: 0.9 }));
  fire.position.set(6, 1.3, 0);
  g.add(fire);
  g.userData.flames = [fire];
  // Брёвна вокруг
  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 3.4, 5), woodMat);
    log.position.set(6 + Math.cos(i * 2.1) * 4.6, 0.4, Math.sin(i * 2.1) * 4.6);
    log.rotation.set(Math.PI / 2, i * 1.2, 0);
    g.add(log);
  }
  // Флагшток
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 5), woodMat);
  pole.position.set(-6, 3.5, 4);
  g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), colorMaterial(0xb03a3a, { side: THREE.DoubleSide }));
  flag.position.set(-4.7, 5.6, 4);
  g.add(flag);
}

function buildWreck(g, lm, s) {
  const metal = new THREE.MeshStandardMaterial({ color: 0x5a626c, roughness: 0.7, metalness: 0.6, flatShading: true });
  const rust = new THREE.MeshStandardMaterial({ color: 0x7a4a32, roughness: 0.9, metalness: 0.3, flatShading: true });
  // Корпус
  const hull = new THREE.Mesh(new THREE.BoxGeometry(11, 3.2, 6), metal);
  hull.position.y = 2.2;
  hull.rotation.z = 0.16;
  hull.rotation.y = 0.3;
  hull.castShadow = true;
  g.add(hull);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(3.1, 4.4, 6), metal);
  nose.position.set(7, 2.6, 0);
  nose.rotation.z = -Math.PI / 2 + 0.16;
  nose.rotation.y = 0.3;
  g.add(nose);
  // Крылья
  for (const sz of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.35, 9), rust);
    wing.position.set(-2, 2.1, sz * 6);
    wing.rotation.x = sz * 0.12;
    g.add(wing);
  }
  // Следы крушения: обломки и выжженная земля
  const scorch = new THREE.Mesh(new THREE.CircleGeometry(11, 14), new THREE.MeshBasicMaterial({ color: 0x1a1410, transparent: true, opacity: 0.55 }));
  scorch.rotation.x = -Math.PI / 2;
  scorch.position.y = 0.06;
  g.add(scorch);
  for (let i = 0; i < 6; i++) {
    const deb = new THREE.Mesh(new THREE.BoxGeometry(1 + rnd(s + i) * 2, 0.5, 1 + rnd(s + i, 3) * 1.6), i % 2 ? rust : metal);
    deb.position.set((rnd(s + i, 5) - 0.5) * 26, 0.25, (rnd(s + i, 7) - 0.5) * 22);
    deb.rotation.set(rnd(s + i, 9) * 0.4, rnd(s + i, 11) * TAU, 0);
    g.add(deb);
  }
}

function buildCaveMouth(g, lm, s) {
  const rockMat = stone(lm.kind === 'ice' ? 0xb8d2e0 : lm.kind === 'red_rock' ? 0x9a6242 : 0x6a6a6a, 0.95);
  // Скальная арка портала
  for (let i = 0; i < 7; i++) {
    const a = -0.6 + (i / 6) * (Math.PI + 1.2);
    const r = 9 + rnd(s + i) * 3;
    const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(3.4 + rnd(s + i, 3) * 2.2, 0), rockMat);
    chunk.position.set(Math.cos(a) * r, 2.4 + Math.sin(a) * r * 0.5, Math.sin(a) * 2.2);
    chunk.rotation.set(rnd(s + i, 5) * TAU, rnd(s + i, 7) * TAU, 0);
    chunk.scale.set(1, 1.25, 1);
    chunk.castShadow = true;
    g.add(chunk);
  }
  // Тёмный проём
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(6.4, 16), new THREE.MeshBasicMaterial({ color: 0x05070a }));
  mouth.position.set(0, 4.2, 2.4);
  g.add(mouth);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(4.2, 14), new THREE.MeshBasicMaterial({ color: 0x0a1018 }));
  inner.position.set(0, 3.6, 2.45);
  g.add(inner);
  // Кристаллы у входа
  for (let i = 0; i < 3; i++) {
    const cr = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3.4, 5), emissiveMaterial(lm.kind === 'ice' ? 0x93e0ff : 0x7dd3fc, 1.7, { transparent: true, opacity: 0.9 }));
    cr.position.set(-6 + i * 6, 1.5, 4.2);
    cr.rotation.z = (i - 1) * 0.3;
    g.add(cr);
  }
}

function buildHiddenCache(g, lm, s) {
  const m = stone(0x6a6459);
  // Небольшой тайник: плита, сундук, светящийся маркер
  const slab = new THREE.Mesh(new THREE.BoxGeometry(5, 0.4, 5), m);
  slab.position.y = 0.2;
  slab.receiveShadow = true;
  g.add(slab);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 1.8), colorMaterial(0x6b4a2a, { roughness: 0.85 }));
  chest.position.y = 1.2;
  chest.castShadow = true;
  g.add(chest);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.4, 8, 1, false, 0, Math.PI), colorMaterial(0x7a5a34));
  lid.rotation.z = Math.PI / 2;
  lid.position.y = 2;
  g.add(lid);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.4, 6, 5), emissiveMaterial(0xfbbf24, 2.4));
  glow.position.y = 2.6;
  g.add(glow);
}

// ── Поле: инстансная трава одного поля ───────────────────────────────────
// Вызывается из worldbuilder для каждого поля; трава — один InstancedMesh,
// поэтому поле из 1500 стеблей стоит 1 draw call.
export function buildFieldGrass(field, terrain, quality = 'high') {
  const density = quality === 'low' ? 220 : quality === 'medium' ? 420 : 700;
  const geo = new THREE.ConeGeometry(0.06, 0.85, 3);
  geo.translate(0, 0.42, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: field.kind === 'wheat' ? 0xb8a04a : 0x5a8a3a,
    roughness: 0.95, metalness: 0, flatShading: true
  });
  const inst = new THREE.InstancedMesh(geo, mat, density);
  inst.castShadow = false;
  inst.receiveShadow = false;
  inst.name = `field_grass_${field.id}`;
  const tmp = new THREE.Object3D();
  let n = 0;
  for (let i = 0; i < density; i++) {
    const a = rnd(field.seed || 1, i) * TAU;
    const r = Math.sqrt(rnd(field.seed || 1, i + 1)) * field.radius * 0.95;
    const x = field.x * 0.1 + Math.cos(a) * r * 0.1;
    const z = field.y * 0.1 + Math.sin(a) * r * 0.1;
    const y = terrain.heightAt3D(x, z);
    // Пропускаем стебли в воде
    if (y < 0.05) continue;
    tmp.position.set(x, y, z);
    tmp.scale.setScalar(0.7 + rnd(field.seed || 1, i + 2) * 0.9);
    tmp.rotation.y = rnd(field.seed || 1, i + 3) * TAU;
    tmp.updateMatrix();
    inst.setMatrixAt(n++, tmp.matrix);
  }
  inst.count = n;
  inst.instanceMatrix.needsUpdate = true;
  inst.frustumCulled = true;
  return inst;
}
