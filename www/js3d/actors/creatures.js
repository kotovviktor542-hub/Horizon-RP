// VEXMORA 3D — существа: враги и боссы как полноценные 3D-модели.
// Типы моделей подбираются по данным врага (behavior/sprite):
// гуманоид, зверь, конструкт, призрак, элементаль, босс. Скелет общий,
// материалы и пропорции задают облик конкретного врага.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createMaterial, colorMaterial, emissiveMaterial } from '../core/materials.js';

const TAU = Math.PI * 2;

// Глобальный бюджет динамических источников света. Каждый PointLight в three.js
// удорожает шейдинг ВСЕХ материалов сцены; на мобильных GPU их должно быть мало.
export const LightBudget = { dynamicLights: false, maxDynamic: 0 };
// Совместимость: модуль может быть загружен в разных условиях
function allowDynamicLights(owner) {
  return !!(owner && owner.isBoss) && !!LightBudget.dynamicLights;
}
const damp = (c, t, l, dt) => c + (t - c) * (1 - Math.exp(-l * dt));

// Палитры облика по семействам врагов (соответствуют пиксель-арту 2D-версии)
const LOOKS = {
  undead:   { skin: 0x8a9a72, cloth: 0x3a3a2c, accent: 0x7f1d1d, eye: 0xd9f99d, scale: 1.0 },
  bandit:   { skin: 0xc79a72, cloth: 0x4a3a2a, accent: 0x8a4b2a, eye: 0xfde68a, scale: 1.0 },
  soldier:  { skin: 0xc0967a, cloth: 0x33414f, accent: 0x1e293b, eye: 0xff6b6b, scale: 1.02 },
  mutant:   { skin: 0x6b8f4a, cloth: 0x2b2b22, accent: 0x7f1d1d, eye: 0xa3e635, scale: 1.18 },
  beast:    { skin: 0x4a3a2a, cloth: 0x2a2118, accent: 0x6b2f24, eye: 0xffd166, scale: 1.05 },
  construct:{ skin: 0x8a9099, cloth: 0x4a5058, accent: 0x2b2f36, eye: 0x60d0ff, scale: 1.15 },
  wraith:   { skin: 0x9ac8d8, cloth: 0x2a3a4a, accent: 0x3a5a6a, eye: 0x9ff0ff, scale: 1.0, ghost: true },
  elemental:{ skin: 0xff8a3a, cloth: 0x8a2a1a, accent: 0xffd166, eye: 0xffffff, scale: 1.1, glow: true },
  frost:    { skin: 0x9fd8f0, cloth: 0x2a4a60, accent: 0x60c8f0, eye: 0xffffff, scale: 1.05 },
  abyss:    { skin: 0x5a3a7a, cloth: 0x1e1428, accent: 0x9a4ad8, eye: 0xf0a0ff, scale: 1.06 },
  crystal:  { skin: 0x7ac8e8, cloth: 0x2a4a6a, accent: 0x40a0d0, eye: 0xffffff, scale: 1.0, glow: true },
  boss:     { skin: 0x5a2a2a, cloth: 0x1a1218, accent: 0x8a2a3a, eye: 0xff4d4d, scale: 2.6 }
};

// Определение облика по id/данным врага
export function looksFor(enemy) {
  const id = (enemy.id || '').toLowerCase();
  if (enemy.isBoss) {
    // OPEN WORLD: у новых огромных боссов свой облик, а не общий «босс-человек»
    if (id.includes('warden_of_gates')) return { ...LOOKS.boss, ...LOOKS.construct, scale: 3.1 };
    if (id.includes('canyon_devourer')) return { ...LOOKS.boss, ...LOOKS.beast, scale: 3.3 };
    if (id.includes('ash_sovereign')) return { ...LOOKS.boss, ...LOOKS.elemental, scale: 3.2 };
    if (id.includes('frost') || id.includes('ice')) return { ...LOOKS.boss, ...LOOKS.frost, scale: 2.7 };
    if (id.includes('crystal')) return { ...LOOKS.boss, ...LOOKS.crystal, scale: 2.8 };
    if (id.includes('abyss') || id.includes('void') || id.includes('warlock') || id.includes('necromancer')) return { ...LOOKS.boss, ...LOOKS.abyss, scale: 2.7 };
    if (id.includes('ash') || id.includes('magma') || id.includes('flame')) return { ...LOOKS.boss, ...LOOKS.elemental, scale: 2.7 };
    if (id.includes('robot') || id.includes('golem') || id.includes('construct')) return { ...LOOKS.boss, ...LOOKS.construct, scale: 2.9 };
    return LOOKS.boss;
  }
  if (/skeleton|crypt|bone|tomb|revenant|litch/.test(id)) return { ...LOOKS.undead, ...(id.includes('frost') || id.includes('ice') ? LOOKS.frost : {}) };
  if (/wraith|ghost|soul|spirit|shade|shadow/.test(id)) return LOOKS.wraith;
  if (/mage|warlock|cultist|shaman|druid|necro/.test(id)) return { ...LOOKS.abyss, scale: 1.0 };
  if (/golem|robot|drone|construct|stone/.test(id)) return LOOKS.construct;
  if (/elemental|imp|magma|pyro|fire/.test(id)) return LOOKS.elemental;
  if (/frost|ice|winter/.test(id)) return LOOKS.frost;
  if (/wolf|hound|beast|harpy|spitter|mutant|root|thorn|troll|giant/.test(id)) return LOOKS.beast;
  if (/soldier|trooper|sniper|gunner|grenadier|medic|warden|punisher|heavy|commander|guard/.test(id)) return LOOKS.soldier;
  if (/bandit|duelist|archer|hunter|killer|assassin/.test(id)) return LOOKS.bandit;
  if (/crystal/.test(id)) return LOOKS.crystal;
  return LOOKS.undead;
}

export class Creature3D {
  constructor(scene, enemyDef, options = {}) {
    this.scene = scene;
    this.def = enemyDef;
    this.isBoss = !!options.isBoss;
    this.look = looksFor({ ...enemyDef, isBoss: this.isBoss });
    // WORLD_SCALE = 0.1: 1 метр 3D = 10 единиц игрового мира. Модели строятся
    // в метрах, поэтому обычный враг ~1.8 м, босс — от 2.6 до 4.5 м.
    this.scale = (options.scale || 1) * (this.look.scale || 1) * (this.isBoss ? 1 : 0.92);
    this.kind = this._classifyKind(enemyDef);

    this.root = new THREE.Group();
    this.root.name = `creature_${enemyDef.id}`;
    scene.add(this.root);
    this.parts = {};
    this.time = Math.random() * 10;
    this.attackPhase = 0;
    this.hitFlash = 0;
    this.dead = false;
    this.deathTime = 0;

    this._build();
    // Мелкие детали (глаза, заклёпки, шипы) склеиваем по материалу: вместо ~19
    // отдельных draw call на врага получаем 4–5. Анимируемые части сохраняются.
    this._mergeStaticParts();
    this.root.scale.setScalar(this.scale);
  }

  // Объединяет статические меши с ОДНИМ родителем и материалом в один draw call.
  // Анимируемые части (кости, глаза-цели) остаются отдельными объектами.
  _mergeStaticParts() {
    if (typeof mergeGeometries !== 'function') return;
    const animated = new Set();
    const collect = (v) => {
      if (!v) return;
      if (Array.isArray(v)) { v.forEach(collect); return; }
      if (v.isObject3D) animated.add(v);
    };
    for (const v of Object.values(this.parts)) collect(v);

    const buckets = new Map();
    this.root.traverse((o) => {
      if (!o.isMesh || o.isSkinnedMesh || !o.geometry || !o.material) return;
      if (o.material.transparent) return;          // прозрачные склеивать нельзя (сортировка)
      if (animated.has(o)) return;                 // сама деталь анимируется
      if (o.userData.animated) return;
      if (!o.parent) return;
      const key = `${o.parent.uuid}|${o.material.uuid}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(o);
    });

    for (const [, list] of buckets) {
      if (list.length < 2) continue;
      const parent = list[0].parent;
      const geos = [];
      for (const mesh of list) {
        mesh.updateMatrix();
        const g = mesh.geometry.clone();
        g.applyMatrix4(mesh.matrix);               // общий родитель → локальные матрицы
        geos.push(g);
      }
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, list[0].material);
      mesh.castShadow = list.some((m) => m.castShadow);
      mesh.userData.merged = true;
      for (const old of list) parent.remove(old);
      parent.add(mesh);
    }
  }

  _classifyKind(def) {
    const id = (def.id || '').toLowerCase();
    if (this.isBoss) {
      // Уникальные силуэты новых боссов: колосс из камня, зверь каньона, элементаль пепла
      if (/warden_of_gates/.test(id)) return 'colossus';
      if (/canyon_devourer/.test(id)) return 'quadruped';
      if (/ash_sovereign/.test(id)) return 'elemental';
      return /golem|robot|construct/.test(id) ? 'colossus' : 'boss_humanoid';
    }
    if (/drone/.test(id)) return 'drone';
    if (/wraith|ghost|soul|spirit/.test(id)) return 'wraith';
    if (/wolf|hound/.test(id)) return 'quadruped';
    if (/harpy/.test(id)) return 'flyer';
    if (/golem|construct|stone/.test(id)) return 'golem';
    if (/elemental|imp/.test(id)) return 'elemental';
    return 'humanoid';
  }

  _materials() {
    const L = this.look;
    const ghost = !!L.ghost;
    const glow = !!L.glow;
    const base = {
      transparent: ghost || glow,
      opacity: ghost ? 0.72 : 1,
      roughness: ghost ? 0.4 : 0.82,
      metalness: /golem|construct|robot|stone/.test(this.kind) ? 0.7 : 0.08
    };
    return {
      skin: new THREE.MeshStandardMaterial({ color: L.skin, ...base }),
      cloth: new THREE.MeshStandardMaterial({ color: L.cloth, ...base }),
      accent: new THREE.MeshStandardMaterial({ color: L.accent, ...base }),
      eye: new THREE.MeshBasicMaterial({ color: L.eye }),
      glow: glow ? emissiveMaterial(L.skin, 1.4, { transparent: true, opacity: 0.9 }) : null
    };
  }

  _build() {
    const m = this._materials();
    this.mats = m;
    const kind = this.kind;

    // Общая корневая иерархия
    const body = new THREE.Group();
    // Высота корпуса над землёй (в метрах модели; масштаб применится к корню)
    body.position.y = kind === 'quadruped' ? 0.68 : 1.02;
    this.root.add(body);
    this.parts.body = body;

    if (kind === 'quadruped') return this._buildQuadruped(body, m);
    if (kind === 'flyer') return this._buildFlyer(body, m);
    if (kind === 'wraith') return this._buildWraith(body, m);
    if (kind === 'golem' || kind === 'colossus') return this._buildGolem(body, m);
    if (kind === 'elemental') return this._buildElemental(body, m);
    if (kind === 'drone') return this._buildDrone(body, m);
    return this._buildHumanoid(body, m);
  }

  // ── Гуманоид (зомби, бандиты, солдаты, скелеты, маги, боссы-гуманоиды) ──
  _buildHumanoid(body, m) {
    const isBoss = this.isBoss;
    const torsoW = isBoss ? 0.5 : 0.34;
    const torsoH = isBoss ? 0.86 : 0.55;

    const torsoGeo = new THREE.CylinderGeometry(torsoW * 0.62, torsoW * 0.5, torsoH, 9, 2);
    torsoGeo.scale(1, 1, 0.7);
    const torso = new THREE.Mesh(torsoGeo, m.cloth);
    torso.position.y = torsoH / 2;
    torso.castShadow = true;
    torso.receiveShadow = true;
    body.add(torso);
    this.parts.torso = torso;

    // Броня/рёбра
    if (/skeleton|crypt|bone/.test(this.def.id)) {
      for (let i = 0; i < 4; i++) {
        const rib = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.32, 0.022, 5, 10, Math.PI * 1.2), m.accent);
        rib.position.y = 0.14 + i * 0.11;
        rib.rotation.x = Math.PI / 2;
        rib.rotation.z = Math.PI / 2;
        torso.add(rib);
      }
    } else {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(torsoW * 0.66, torsoW * 0.54, torsoH * 0.7, 9, 1, true, -1.1, 2.2), m.accent);
      plate.position.y = torsoH * 0.52;
      plate.scale.z = 0.76;
      torso.add(plate);
    }

    // Плечи
    for (const side of [-1, 1]) {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(isBoss ? 0.2 : 0.115, 9, 7, 0, TAU, 0, Math.PI / 1.7), m.accent);
      pad.position.set(side * torsoW * 0.62, torsoH * 0.92, 0);
      pad.scale.y = 0.85;
      pad.castShadow = true;
      body.add(pad);
      if (isBoss) {
        // Шипы на плечах босса
        for (let k = 0; k < 3; k++) {
          const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.24, 5), m.accent);
          spike.position.set(side * (torsoW * 0.62 + 0.04), torsoH * 0.95, -0.1 + k * 0.1);
          spike.rotation.z = side * -0.5;
          body.add(spike);
        }
      }
    }

    // Голова
    const head = new THREE.Group();
    head.position.y = torsoH + (isBoss ? 0.24 : 0.14);
    body.add(head);
    this.parts.head = head;

    const skullR = isBoss ? 0.24 : 0.135;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(skullR, 14, 11), m.skin);
    skull.scale.set(0.94, 1.06, 0.96);
    skull.castShadow = true;
    head.add(skull);

    // Глаза (светящиеся)
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(skullR * 0.22, 7, 6), m.eye);
      eye.position.set(side * skullR * 0.36, skullR * 0.12, skullR * 0.86);
      head.add(eye);
    }
    // Рога у босса
    if (isBoss) {
      for (const side of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.5, 7), m.accent);
        horn.position.set(side * skullR * 0.62, skullR * 0.85, -0.02);
        horn.rotation.z = side * -0.45;
        horn.rotation.x = -0.25;
        horn.castShadow = true;
        head.add(horn);
      }
    } else if (/soldier|warden|guard|heavy/.test(this.def.id)) {
      const helm = new THREE.Mesh(new THREE.SphereGeometry(skullR * 1.16, 12, 9, 0, TAU, 0, Math.PI / 1.9), m.accent);
      helm.position.y = 0.02;
      head.add(helm);
    }

    // Руки
    const armLen = isBoss ? 0.52 : 0.34;
    const arms = {};
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * torsoW * 0.62, torsoH * 0.88, 0);
      body.add(shoulder);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.052, armLen, 7), m.skin);
      upper.position.y = -armLen / 2;
      upper.castShadow = true;
      shoulder.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = -armLen;
      shoulder.add(elbow);
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.042, armLen * 0.92, 7), m.skin);
      fore.position.y = -armLen * 0.46;
      fore.castShadow = true;
      elbow.add(fore);
      const hand = new THREE.Group();
      hand.position.y = -armLen * 0.95;
      elbow.add(hand);
      // Когти/кулак
      const fist = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.09, 0.075), m.skin);
      hand.add(fist);
      arms[side === 1 ? 'R' : 'L'] = { shoulder, elbow, hand };
    }
    this.parts.armR = arms.R;
    this.parts.armL = arms.L;

    // Оружие врага (меч/топор/копьё у боссов и воинов)
    if (isBoss || /knight|warrior|duelist|guard|warden|punisher|commander|heavy/.test(this.def.id)) {
      const weapon = new THREE.Group();
      const bladeMat = new THREE.MeshStandardMaterial({ color: 0xb0b8c4, metalness: 0.9, roughness: 0.25 });
      const handleMat = colorMaterial(0x2a2018, { roughness: 0.9 });
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.22, 6), handleMat);
      weapon.add(handle);
      const bladeLen = isBoss ? 1.3 : 0.75;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.075, bladeLen, 0.028), bladeMat);
      blade.position.y = 0.22 + bladeLen / 2;
      blade.castShadow = true;
      weapon.add(blade);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 4), bladeMat);
      tip.position.y = 0.22 + bladeLen + 0.06;
      weapon.add(tip);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.06), m.accent);
      guard.position.y = 0.24;
      weapon.add(guard);
      weapon.rotation.x = -Math.PI / 2.2;
      weapon.position.y = -0.02;
      arms.R.hand.add(weapon);
      this.weaponMesh = weapon;
    }

    // Ноги
    const legLen = isBoss ? 0.5 : 0.38;
    const legs = {};
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(side * torsoW * 0.32, 0.02, 0);
      body.add(hip);
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.06, legLen, 8), m.cloth);
      thigh.position.y = -legLen / 2;
      thigh.castShadow = true;
      hip.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = -legLen;
      hip.add(knee);
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.046, legLen * 0.95, 8), m.cloth);
      shin.position.y = -legLen * 0.475;
      shin.castShadow = true;
      knee.add(shin);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.2), m.accent);
      foot.position.set(0, -legLen * 0.95, 0.05);
      knee.add(foot);
      legs[side === 1 ? 'R' : 'L'] = { hip, knee };
    }
    this.parts.legR = legs.R;
    this.parts.legL = legs.L;

    // Свечение вокруг (элементали, кристаллы)
    // Свет — только у боссов: каждый PointLight заставляет WebGL пересчитывать
    // освещение всех материалов в кадре, десятки таких ламп роняли FPS до 10.
    if (m.glow && this.isBoss && allowDynamicLights(this)) {
      const aura = new THREE.PointLight(this.look.skin, 2.4, 12, 2);
      aura.position.y = 0.8;
      body.add(aura);
    }
  }

  // ── Четвероногое (волки, гончие) ──
  _buildQuadruped(body, m) {
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.62, 5, 9), m.skin);
    torso.rotation.z = Math.PI / 2;
    torso.castShadow = true;
    body.add(torso);
    this.parts.torso = torso;

    const head = new THREE.Group();
    head.position.set(0.52, 0.16, 0);
    body.add(head);
    this.parts.head = head;
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.24), m.skin);
    skull.castShadow = true;
    head.add(skull);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.15), m.skin);
    snout.position.set(0.22, -0.05, 0);
    head.add(snout);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), m.eye);
      eye.position.set(0.1, 0.06, side * 0.1);
      head.add(eye);
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 5), m.cloth);
      ear.position.set(-0.04, 0.2, side * 0.09);
      ear.rotation.z = side * 0.15;
      head.add(ear);
    }
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 0.5, 6), m.skin);
    tail.position.set(-0.55, 0.12, 0);
    tail.rotation.z = 0.6;
    body.add(tail);
    this.parts.tail = tail;

    const legs = {};
    for (const [key, x, z] of [['FL', 0.32, 0.18], ['FR', 0.32, -0.18], ['BL', -0.32, 0.18], ['BR', -0.32, -0.18]]) {
      const hip = new THREE.Group();
      hip.position.set(x, -0.12, z);
      body.add(hip);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.34, 6), m.skin);
      upper.position.y = -0.17;
      upper.castShadow = true;
      hip.add(upper);
      const knee = new THREE.Group();
      knee.position.y = -0.34;
      hip.add(knee);
      const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.3, 6), m.skin);
      lower.position.y = -0.15;
      knee.add(lower);
      const paw = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.14), m.cloth);
      paw.position.set(0.03, -0.3, 0);
      knee.add(paw);
      legs[key] = { hip, knee };
    }
    this.parts.legs = legs;
  }

  // ── Летающее (гарпии) ──
  _buildFlyer(body, m) {
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.4, 5, 9), m.skin);
    torso.rotation.x = 0.4;
    torso.castShadow = true;
    body.add(torso);
    this.parts.torso = torso;

    const head = new THREE.Group();
    head.position.set(0, 0.34, 0.22);
    body.add(head);
    this.parts.head = head;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 9), m.skin);
    head.add(skull);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 6), m.accent);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, -0.01, 0.16);
    head.add(beak);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 5), m.eye);
      eye.position.set(side * 0.06, 0.035, 0.09);
      head.add(eye);
    }
    // Крылья
    const wings = {};
    for (const side of [-1, 1]) {
      const wing = new THREE.Group();
      wing.position.set(side * 0.18, 0.15, 0);
      body.add(wing);
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(0.85, 0.16);
      shape.lineTo(0.95, -0.06);
      shape.lineTo(0.5, -0.22);
      shape.lineTo(0.1, -0.12);
      shape.closePath();
      const geo = new THREE.ShapeGeometry(shape);
      const feather = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: m.cloth.color, roughness: 0.9, side: THREE.DoubleSide }));
      feather.scale.x = side;
      feather.castShadow = true;
      wing.add(feather);
      wings[side === 1 ? 'R' : 'L'] = wing;
    }
    this.parts.wings = wings;
    // Ноги с когтями
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.3, 5), m.accent);
      leg.position.set(side * 0.08, -0.3, 0.05);
      leg.rotation.x = 0.3;
      body.add(leg);
    }
  }

  // ── Призрак ──
  _buildWraith(body, m) {
    const torso = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.95, 10, 1, true), m.cloth);
    torso.position.y = 0.1;
    body.add(torso);
    this.parts.torso = torso;
    const head = new THREE.Group();
    head.position.y = 0.68;
    body.add(head);
    this.parts.head = head;
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.38, 9, 1, true), m.cloth);
    hood.position.y = 0.05;
    head.add(hood);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0x0a0f16 }));
    head.add(face);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 5), m.eye);
      eye.position.set(side * 0.042, 0.02, 0.088);
      head.add(eye);
    }
    // «Руки-тени»
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.5, 6), m.cloth);
      arm.position.set(side * 0.26, -0.1, 0.06);
      arm.rotation.z = side * 0.4;
      arm.rotation.x = -0.3;
      body.add(arm);
    }
    // Глаза призрака светятся материалом, без PointLight (декоративный свет не нужен)
  }

  // ── Голем/колосс ──
  _buildGolem(body, m) {
    const isBoss = this.isBoss;
    const s = isBoss ? 1.35 : 1;
    const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42 * s, 1), m.skin);
    torso.scale.set(1, 1.25, 0.82);
    torso.position.y = 0.35 * s;
    torso.castShadow = true;
    torso.receiveShadow = true;
    body.add(torso);
    this.parts.torso = torso;

    // Пластины на корпусе
    for (let i = 0; i < 5; i++) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.22 * s, 0.16 * s, 0.08 * s), m.accent);
      plate.position.set((Math.random() - 0.5) * 0.5 * s, 0.2 * s + i * 0.13 * s, 0.3 * s);
      plate.rotation.z = (Math.random() - 0.5) * 0.4;
      body.add(plate);
    }
    const head = new THREE.Group();
    head.position.y = 0.92 * s;
    body.add(head);
    this.parts.head = head;
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.3 * s, 0.26 * s, 0.28 * s), m.skin);
    skull.castShadow = true;
    head.add(skull);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045 * s, 7, 6), m.eye);
      eye.position.set(side * 0.08 * s, 0.02 * s, 0.15 * s);
      head.add(eye);
    }
    const arms = {};
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.46 * s, 0.62 * s, 0);
      body.add(shoulder);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.2 * s, 0.42 * s, 0.2 * s), m.skin);
      upper.position.y = -0.2 * s;
      upper.castShadow = true;
      shoulder.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = -0.42 * s;
      shoulder.add(elbow);
      const fore = new THREE.Mesh(new THREE.BoxGeometry(0.24 * s, 0.44 * s, 0.24 * s), m.skin);
      fore.position.y = -0.22 * s;
      fore.castShadow = true;
      elbow.add(fore);
      const fist = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 * s, 0), m.accent);
      fist.position.y = -0.48 * s;
      elbow.add(fist);
      arms[side === 1 ? 'R' : 'L'] = { shoulder, elbow };
    }
    this.parts.armR = arms.R;
    this.parts.armL = arms.L;

    const legs = {};
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.2 * s, -0.02, 0);
      body.add(hip);
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.22 * s, 0.4 * s, 0.22 * s), m.skin);
      thigh.position.y = -0.2 * s;
      thigh.castShadow = true;
      hip.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = -0.4 * s;
      hip.add(knee);
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.2 * s, 0.38 * s, 0.2 * s), m.skin);
      shin.position.y = -0.19 * s;
      knee.add(shin);
      legs[side === 1 ? 'R' : 'L'] = { hip, knee };
    }
    this.parts.legR = legs.R;
    this.parts.legL = legs.L;

    if (m.glow && allowDynamicLights(this)) {
      const l = new THREE.PointLight(this.look.eye, 1.2, 6, 2);
      l.position.y = 0.8;
      body.add(l);
    }
  }

  // ── Элементаль (огонь/лёд) ──
  _buildElemental(body, m) {
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), m.glow || m.skin);
    core.position.y = 0.35;
    body.add(core);
    this.parts.torso = core;
    const head = new THREE.Group();
    head.position.y = 0.78;
    body.add(head);
    this.parts.head = head;
    const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 1), m.glow || m.skin);
    head.add(skull);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), m.eye);
      eye.position.set(side * 0.05, 0.02, 0.12);
      head.add(eye);
    }
    // Языки пламени вокруг
    const flames = [];
    for (let i = 0; i < 6; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.4, 6), m.glow || m.skin);
      const ang = (i / 6) * TAU;
      f.position.set(Math.cos(ang) * 0.28, 0.3 + Math.random() * 0.3, Math.sin(ang) * 0.28);
      f.rotation.z = Math.cos(ang) * 0.3;
      body.add(f);
      flames.push(f);
    }
    this.parts.flames = flames;
    if (allowDynamicLights(this)) {
      const light = new THREE.PointLight(this.look.skin, 2.0, 8, 2);
      light.position.y = 0.6;
      body.add(light);
      this.parts.light = light;
    }
  }

  // ── Дрон ──
  _buildDrone(body, m) {
    const hull = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 9), m.skin);
    hull.scale.set(1, 0.6, 1);
    body.add(hull);
    this.parts.torso = hull;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), m.eye);
    eye.position.set(0, -0.02, 0.22);
    body.add(eye);
    this.parts.head = body;
    const rotors = [];
    for (const [x, z] of [[0.32, 0.32], [-0.32, 0.32], [0.32, -0.32], [-0.32, -0.32]]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.05), m.accent);
      arm.position.set(x * 0.6, 0.06, z * 0.6);
      arm.rotation.y = Math.atan2(z, x);
      body.add(arm);
      const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.012, 12), new THREE.MeshStandardMaterial({ color: 0x30363f, metalness: 0.6, roughness: 0.4, transparent: true, opacity: 0.65 }));
      rotor.position.set(x, 0.1, z);
      body.add(rotor);
      rotors.push(rotor);
    }
    this.parts.rotors = rotors;
    if (allowDynamicLights(this)) {
      const l = new THREE.PointLight(0xff4d4d, 0.6, 4, 2);
      l.position.y = -0.2;
      body.add(l);
    }
  }

  // Тени существ: близкие враги отбрасывают тень, дальние — нет (экономия прохода)
  setShadow(on) {
    if (this._shadowOn === on) return;
    this._shadowOn = on;
    this.root.traverse((o) => {
      if (!o.isMesh) return;
      // Запоминаем исходную настройку один раз: мелкие детали (глаза, когти,
      // шипы) тень не дают никогда, крупные части — по дистанции.
      if (o.userData.shadowCapable === undefined) {
        if (!o.geometry?.boundingSphere) o.geometry?.computeBoundingSphere?.();
        const r = o.geometry?.boundingSphere?.radius || 0;
        o.userData.shadowCapable = o.castShadow && r >= 0.16;
        o.userData.baseCastShadow = o.castShadow;
      }
      o.castShadow = on && o.userData.shadowCapable;
    });
  }

  // ── Анимация ──
  update(dt, opts = {}) {
    this.time += dt;
    const t = this.time;
    const p = this.parts;
    const speedNorm = Math.min(1, (opts.speed || 0) / 2.2);   // 3D-метры/с
    const attacking = !!opts.attacking;

    if (this.dead) {
      this.deathTime += dt;
      const k = Math.min(1, this.deathTime * 1.8);
      this.root.rotation.x = -k * Math.PI * 0.45;
      this.root.position.y = (opts.groundY || 0) + Math.sin(k * Math.PI) * 0.1;
      this.root.scale.setScalar(this.scale * (1 - k * 0.12));
      this.root.traverse(o => {
        if (o.isMesh && o.material && o.material.transparent !== undefined) {
          if (o.material.opacity === undefined) o.material.opacity = 1;
          o.material.transparent = true;
          o.material.opacity = Math.max(0, 1 - k * 1.3);
        }
      });
      return;
    }

    if (opts.position) this.root.position.set(opts.position.x, opts.position.y, opts.position.z);
    if (typeof opts.facing === 'number') {
      let d = opts.facing - this.root.rotation.y;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      this.root.rotation.y += d * Math.min(1, dt * 9);
    }

    this.hitFlash = Math.max(0, this.hitFlash - dt * 4);

    const kind = this.kind;
    const walk = t * (5 + speedNorm * 6);
    const sw = Math.sin(walk);

    if (kind === 'quadruped') {
      const legs = p.legs;
      legs.FL.hip.rotation.x = damp(legs.FL.hip.rotation.x, sw * 0.7, 14, dt);
      legs.BR.hip.rotation.x = damp(legs.BR.hip.rotation.x, sw * 0.7, 14, dt);
      legs.FR.hip.rotation.x = damp(legs.FR.hip.rotation.x, -sw * 0.7, 14, dt);
      legs.BL.hip.rotation.x = damp(legs.BL.hip.rotation.x, -sw * 0.7, 14, dt);
      p.body.position.y = 0.62 + Math.abs(sw) * 0.04 * speedNorm;
      p.tail.rotation.y = Math.sin(t * 4) * 0.35;
      if (p.head) p.head.rotation.x = Math.sin(t * 2) * 0.06;
    } else if (kind === 'flyer') {
      p.body.position.y = 1.05 + Math.sin(t * 2.4) * 0.12;
      if (p.wings) {
        const flap = Math.sin(t * 9) * 0.7;
        p.wings.R.rotation.z = -flap;
        p.wings.L.rotation.z = flap;
      }
    } else if (kind === 'wraith') {
      p.body.position.y = 1.05 + Math.sin(t * 1.6) * 0.14;
      p.body.rotation.y = Math.sin(t * 0.9) * 0.14;
      p.torso.rotation.y = t * 0.6;
    } else if (kind === 'golem' || kind === 'colossus') {
      p.armR.shoulder.rotation.x = damp(p.armR.shoulder.rotation.x, sw * 0.5, 10, dt);
      p.armL.shoulder.rotation.x = damp(p.armL.shoulder.rotation.x, -sw * 0.5, 10, dt);
      p.legR.hip.rotation.x = damp(p.legR.hip.rotation.x, -sw * 0.45, 10, dt);
      p.legL.hip.rotation.x = damp(p.legL.hip.rotation.x, sw * 0.45, 10, dt);
      p.body.position.y = 1.02 + Math.abs(sw) * 0.05 * speedNorm;
      p.head.rotation.y = Math.sin(t * 0.7) * 0.2;
    } else if (kind === 'elemental') {
      p.body.position.y = 1.0 + Math.sin(t * 2.2) * 0.1;
      if (p.flames) p.flames.forEach((f, i) => {
        f.scale.y = 0.8 + Math.sin(t * 6 + i) * 0.25;
        f.position.y = 0.3 + Math.sin(t * 5 + i * 1.3) * 0.08;
      });
      if (p.light) p.light.intensity = 1.6 + Math.sin(t * 9) * 0.5;
    } else if (kind === 'drone') {
      p.body.position.y = 1.5 + Math.sin(t * 2.6) * 0.1;
      if (p.rotors) p.rotors.forEach(r => { r.rotation.y += dt * 42; });
    } else {
      // Гуманоиды
      const attackK = attacking ? 1 : 0;
      if (attacking) this.attackPhase = Math.min(1, this.attackPhase + dt * 3.2);
      else this.attackPhase = Math.max(0, this.attackPhase - dt * 4);
      const ap = this.attackPhase;

      p.legR.hip.rotation.x = damp(p.legR.hip.rotation.x, sw * 0.55 * (0.3 + speedNorm), 12, dt);
      p.legL.hip.rotation.x = damp(p.legL.hip.rotation.x, -sw * 0.55 * (0.3 + speedNorm), 12, dt);
      p.legR.knee.rotation.x = damp(p.legR.knee.rotation.x, -Math.max(0, sw) * 0.6, 12, dt);
      p.legL.knee.rotation.x = damp(p.legL.knee.rotation.x, -Math.max(0, -sw) * 0.6, 12, dt);

      if (this.weaponMesh) {
        // Замах оружием при атаке
        const raise = ap < 0.4 ? ap / 0.4 : 1 - (ap - 0.4) / 0.6;
        p.armR.shoulder.rotation.x = damp(p.armR.shoulder.rotation.x, -2.4 * raise - sw * 0.2, 16, dt);
        p.armR.elbow.rotation.x = damp(p.armR.elbow.rotation.x, -0.9 * raise, 16, dt);
      } else {
        p.armR.shoulder.rotation.x = damp(p.armR.shoulder.rotation.x, -sw * 0.5 - ap * 1.4, 12, dt);
        p.armR.elbow.rotation.x = damp(p.armR.elbow.rotation.x, -0.3 - ap * 0.5, 12, dt);
      }
      p.armL.shoulder.rotation.x = damp(p.armL.shoulder.rotation.x, sw * 0.5, 12, dt);
      p.armL.elbow.rotation.x = damp(p.armL.elbow.rotation.x, -0.3, 12, dt);

      p.body.position.y = (this.isBoss ? 1.02 : 1.02) + Math.abs(sw) * 0.04 * speedNorm;
      p.head.rotation.y = Math.sin(t * 0.8) * 0.18;
      p.torso.rotation.x = damp(p.torso.rotation.x, 0.05 + speedNorm * 0.12 + ap * 0.18, 10, dt);
    }

    // Вспышка при получении урона (эмиссия на всех материалах)
    if (this.hitFlash > 0) {
      const k = this.hitFlash;
      this.mats.skin.emissive?.setRGB(k * 0.9, k * 0.15, k * 0.15);
      this.mats.cloth.emissive?.setRGB(k * 0.7, k * 0.1, k * 0.1);
    } else if (this.mats.skin.emissive) {
      this.mats.skin.emissive.setRGB(0, 0, 0);
      this.mats.cloth.emissive?.setRGB(0, 0, 0);
    }
  }

  flash() { this.hitFlash = 1; }

  startDeath() {
    this.dead = true;
    this.deathTime = 0;
    // Делаем материалы независимыми, чтобы фейд не влиял на других
    this.root.traverse(o => {
      if (o.isMesh) {
        o.material = o.material.clone();
        o.material.transparent = true;
      }
    });
  }

  dispose() {
    this.scene.remove(this.root);
    this.root.traverse(o => {
      if (o.isMesh) {
        o.geometry?.dispose?.();
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose?.());
        else o.material?.dispose?.();
      }
    });
  }
}
