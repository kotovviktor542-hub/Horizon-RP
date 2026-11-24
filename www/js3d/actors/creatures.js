// VEXMORA 3D — существа: враги и боссы как полноценные 3D-модели.
// Типы моделей подбираются по данным врага (behavior/sprite):
// гуманоид, зверь, конструкт, призрак, элементаль, босс. Скелет общий,
// материалы и пропорции задают облик конкретного врага.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createMaterial, colorMaterial, emissiveMaterial } from '../core/materials.js';
import { mergeStaticMeshes } from '../core/merge.js';
import { humanoidVariation, variantTint } from './variants.js';

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
    // Уникальность внутри класса: детали (шлем, капюшон, плащ, наплечники,
    // рюкзак, маска) и оттенок кожи зависят от id, а не от порядка спавна.
    this.variation = humanoidVariation(enemyDef);
    if (!this.isBoss && this.look && this.look.skin != null) {
      this.look = { ...this.look, skin: variantTint(this.look.skin, enemyDef.id || 'enemy', 0.1) };
    }
    // WORLD_SCALE = 0.1: 1 метр 3D = 10 единиц игрового мира. Модели строятся
    // в метрах, поэтому обычный враг ~1.8 м, босс — от 2.6 до 4.5 м.
    this.scale = (options.scale || 1) * (this.look.scale || 1) * (this.isBoss ? 1 : 0.92) *
      (this.isBoss ? 1 : (this.variation.height || 1));
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

  // Объединяет статические меши с одним родителем и материалом в один draw call.
  // Анимируемые части (по this.parts) и прозрачные материалы не трогаем —
  // иначе сломаются и анимация, и сортировка прозрачности.
  _mergeStaticParts() {
    const animated = new Set();
    const collect = (v) => {
      if (!v) return;
      if (Array.isArray(v)) { v.forEach(collect); return; }
      if (v.isObject3D) animated.add(v);
    };
    for (const v of Object.values(this.parts)) collect(v);
    mergeStaticMeshes(this.root, {
      protectedSet: animated,
      skip: (o) => !!o.userData.shield || !!o.userData.noMerge
    });
  }

  _classifyKind(def) {
    const id = (def.id || '').toLowerCase();
    if (this.isBoss) {
      // Уникальные силуэты новых боссов: колосс из камня, зверь каньона, элементаль пепла
      if (/warden_of_gates/.test(id)) return 'colossus';
      if (/canyon_devourer/.test(id)) return 'quadruped';
      // Владыка пепла — не «большой имп»: своя ветка с короной, плащом и
      // двуручным мечом. Раньше он попадал в `elemental` и отличался от
      // рядового импа одним мешем.
      if (/ash_sovereign/.test(id)) return 'sovereign';
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
    const mats = {
      skin: new THREE.MeshStandardMaterial({ color: L.skin, ...base }),
      cloth: new THREE.MeshStandardMaterial({ color: L.cloth, ...base }),
      accent: new THREE.MeshStandardMaterial({ color: L.accent, ...base }),
      eye: new THREE.MeshBasicMaterial({ color: L.eye }),
      glow: glow ? emissiveMaterial(L.skin, 1.4, { transparent: true, opacity: 0.9 }) : null
    };
    // Боссам — благородные металлы: доспех и оружие должны отличаться от кожи.
    if (this.isBoss) {
      mats.metal = new THREE.MeshStandardMaterial({
        color: 0x8a7c62, metalness: 0.92, roughness: 0.32
      });
      mats.ember = new THREE.MeshStandardMaterial({
        color: 0xffa040, emissive: 0xff5a10, emissiveIntensity: 1.6, roughness: 0.5
      });
    }
    return mats;
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
    if (kind === 'sovereign') return this._buildSovereign(body, m);
    return this._buildHumanoid(body, m);
  }

  // ── Гуманоид (зомби, бандиты, солдаты, скелеты, маги, боссы-гуманоиды) ──
  _buildHumanoid(body, m) {
    const isBoss = this.isBoss;
    const V = this.variation || {};
    const bulk = V.bulk || 1;
    const torsoW = (isBoss ? 0.5 : 0.34) * bulk;
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

    // Тяжёлые наплечники у элиты: накладки поверх плеч.
    if (V.pauldrons && !isBoss) {
      for (const side of [-1, 1]) {
        const shell = new THREE.Mesh(
          new THREE.SphereGeometry(torsoW * 0.46, 10, 7, 0, TAU, 0, Math.PI / 1.9), m.accent);
        shell.position.set(side * torsoW * 0.66, torsoH * 0.9, 0);
        shell.scale.set(1.15, 0.9, 1.05);
        shell.castShadow = true;
        body.add(shell);
        // Заклёпки по краю наплечника.
        for (let k = 0; k < 3; k++) {
          const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.013, 5, 4), m.skin);
          rivet.position.set(side * torsoW * (0.62 + k * 0.04), torsoH * (0.86 - k * 0.04), -0.06 + k * 0.06);
          body.add(rivet);
        }
      }
    }

    // Рюкзак/ранец: коробка со скаткой и ремнями.
    if (V.backpack) {
      const pack = new THREE.Mesh(new THREE.BoxGeometry(torsoW * 0.8, torsoH * 0.62, torsoW * 0.42), m.accent);
      pack.position.set(0, torsoH * 0.5, -torsoW * 0.52);
      pack.castShadow = true;
      body.add(pack);
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(torsoW * 0.22, torsoW * 0.22, torsoW * 0.86, 8), m.cloth);
      roll.rotation.z = Math.PI / 2;
      roll.position.set(0, torsoH * 0.84, -torsoW * 0.5);
      body.add(roll);
      for (const side of [-1, 1]) {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.035, torsoH * 0.7, 0.02), m.cloth);
        strap.position.set(side * torsoW * 0.3, torsoH * 0.5, -torsoW * 0.3);
        strap.rotation.z = side * 0.12;
        body.add(strap);
      }
      if (/medic/.test(this.def.id || '')) {
        // Красный крест медика: две перекладины прямо на ранце.
        const crossMat = new THREE.MeshStandardMaterial({ color: 0xc03030, roughness: 0.7 });
        for (const rot of [0, Math.PI / 2]) {
          const bar = new THREE.Mesh(new THREE.BoxGeometry(torsoW * 0.44, torsoW * 0.12, 0.01), crossMat);
          bar.position.set(0, torsoH * 0.5, -torsoW * 0.74);
          bar.rotation.z = rot;
          body.add(bar);
        }
      }
    }

    // Патронташ через грудь: ремень + отделения с «гильзами».
    if (V.bandolier) {
      const belt = new THREE.Mesh(new THREE.BoxGeometry(torsoW * 1.05, 0.055, 0.02), m.accent);
      belt.position.set(0, torsoH * 0.56, torsoW * 0.55);
      belt.rotation.z = 0.72;
      body.add(belt);
      for (let i = 0; i < 5; i++) {
        const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.045, 5), m.skin);
        shell.position.set(-torsoW * 0.42 + i * torsoW * 0.21, torsoH * (0.36 + i * 0.08), torsoW * 0.58);
        body.add(shell);
      }
    }

    // Плащ у командиров и культистов: два полотнища сзади.
    if (V.cloak && !isBoss) {
      for (const side of [-1, 1]) {
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(torsoW * 0.6, torsoH * 1.7, 2, 3), m.cloth);
        panel.material.side = THREE.DoubleSide;
        panel.position.set(side * torsoW * 0.28, torsoH * 0.1, -torsoW * 0.42);
        panel.rotation.y = side * 0.18;
        body.add(panel);
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
    }

    // ── Индивидуальность вида ────────────────────────────────────────────
    // До ремастера зомби, тролль и гоблин были одной моделью. Теперь набор
    // деталей считается из id (см. actors/variants.js): шлем, капюшон,
    // борода, волосы, шрам, маска, наплечники, рюкзак, патронташ.
    const hairMat = m.cloth;
    if (V.helmet) {
      const helm = new THREE.Mesh(
        new THREE.SphereGeometry(skullR * 1.18, 12, 9, 0, TAU, 0, Math.PI / 1.75), m.accent);
      helm.position.y = 0.015;
      head.add(helm);
      // Гребень и «щёчки» шлема: каска, а не полусфера.
      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.03, skullR * 0.8, skullR * 1.4), m.accent);
      crest.position.y = skullR * 0.92;
      head.add(crest);
      for (const side of [-1, 1]) {
        const cheek = new THREE.Mesh(new THREE.SphereGeometry(skullR * 0.42, 8, 6), m.accent);
        cheek.scale.set(0.5, 1.1, 0.8);
        cheek.position.set(side * skullR * 0.86, -skullR * 0.12, 0);
        head.add(cheek);
      }
      // Прорезь для глаз — тёмная полоса под козырьком.
      const visor = new THREE.Mesh(new THREE.BoxGeometry(skullR * 1.5, skullR * 0.2, 0.02), m.cloth);
      visor.position.set(0, skullR * 0.34, skullR * 0.86);
      head.add(visor);
    } else if (V.hood) {
      const hood = new THREE.Mesh(
        new THREE.SphereGeometry(skullR * 1.3, 12, 10, 0, TAU, 0, Math.PI * 0.68), m.cloth);
      hood.scale.set(1, 1.12, 1.05);
      hood.position.y = 0.012;
      head.add(hood);
      const peak = new THREE.Mesh(new THREE.ConeGeometry(skullR * 0.7, skullR * 1.5, 8), m.cloth);
      peak.position.set(0, skullR * 1.0, -skullR * 0.3);
      peak.rotation.x = -0.3;
      head.add(peak);
    }
    // Волосы/борода только у тех, у кого открыта голова.
    if (V.hair && !V.helmet && !V.hood) {
      const hair = new THREE.Mesh(
        new THREE.SphereGeometry(skullR * 1.06, 12, 9, 0, TAU, 0, Math.PI * 0.55), hairMat);
      hair.position.y = skullR * 0.12;
      hair.scale.set(1, 0.9, 1);
      head.add(hair);
    }
    if (V.beard && !V.helmet) {
      const beard = new THREE.Mesh(new THREE.ConeGeometry(skullR * 0.62, skullR * 1.5, 6), hairMat);
      beard.position.set(0, -skullR * 0.85, skullR * 0.5);
      beard.rotation.x = 0.18;
      head.add(beard);
    }
    if (V.scar) {
      const scar = new THREE.Mesh(new THREE.BoxGeometry(0.012, skullR * 0.9, 0.012), m.accent);
      scar.position.set(skullR * 0.42, skullR * 0.18, skullR * 0.8);
      scar.rotation.z = 0.4;
      head.add(scar);
    }
    if (V.mask) {
      // Респиратор/маска: полусфера на нижней половине лица + фильтр.
      const maskGeo = new THREE.SphereGeometry(skullR * 0.86, 10, 8, 0, TAU, Math.PI * 0.42, Math.PI * 0.42);
      const mask = new THREE.Mesh(maskGeo, m.accent);
      mask.position.set(0, -skullR * 0.1, skullR * 0.42);
      head.add(mask);
      const filter = new THREE.Mesh(new THREE.CylinderGeometry(skullR * 0.26, skullR * 0.3, skullR * 0.4, 8), m.accent);
      filter.position.set(0, -skullR * 0.42, skullR * 0.9);
      filter.rotation.x = Math.PI / 2;
      head.add(filter);
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
      // Кисть: ладонь + 3 пальца + большой. На дистанции боя рука читается.
      const fist = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.09, 0.075), m.skin);
      hand.add(fist);
      const fLen = isBoss ? 0.055 : 0.042;
      for (let f = 0; f < 3; f++) {
        const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.009, fLen, 4), m.skin);
        finger.position.set((f - 1) * 0.022, -0.062, 0.012);
        finger.rotation.x = 0.18;
        hand.add(finger);
      }
      const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.01, fLen * 0.9, 4), m.skin);
      thumb.position.set(side * 0.045, -0.03, 0.022);
      thumb.rotation.set(0.5, 0, side * -0.7);
      hand.add(thumb);
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
      // Оружие — отдельный меш: по нему видно замах, склейка его не трогает.
      weapon.traverse(o => { if (o.isMesh) o.userData.animated = true; });
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
      // Наколенник: сустав больше не «шарнир из двух трубок».
      const kneePad = new THREE.Mesh(new THREE.SphereGeometry(0.062, 8, 6, 0, TAU, 0, Math.PI / 2), m.accent);
      kneePad.position.y = 0.005;
      knee.add(kneePad);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.075, 0.2), m.accent);
      foot.position.set(0, -legLen * 0.95, 0.05);
      knee.add(foot);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.108, 0.026, 0.212), m.accent);
      sole.position.set(0, -legLen * 0.95 - 0.045, 0.05);
      knee.add(sole);
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

  // ── Четвероногое (волки, гончие, зверь каньона) ──
  // Тело из двух эллипсоидов (грудь + круп), шея-конус, череп с мордой,
  // лапы с двумя суставами. Ориентация: зверь смотрит по +X.
  _buildQuadruped(body, m) {
    const big = this.isBoss;
    const S = big ? 1.5 : 1;
    const bodyLen = 0.62 * S;
    const shoulderY = 0.0;

    // Грудная клетка и круп.
    const chestGeo = new THREE.SphereGeometry(0.26 * S, 11, 8);
    chestGeo.scale(1.25, 0.94, 1.0);
    const torso = new THREE.Mesh(chestGeo, m.skin);
    torso.position.set(0.16 * S, shoulderY, 0);
    torso.castShadow = true;
    body.add(torso);
    this.parts.torso = torso;

    const rump = new THREE.Mesh(new THREE.SphereGeometry(0.24 * S, 10, 8), m.skin);
    rump.scale.set(1.1, 0.92, 0.95);
    rump.position.set(-0.34 * S, shoulderY - 0.01, 0);
    body.add(rump);

    // Провис спины + холка: характерная линия хищника.
    const mane = new THREE.Mesh(new THREE.SphereGeometry(0.16 * S, 8, 6), m.cloth);
    mane.scale.set(2.1, 0.62, 0.7);
    mane.position.set(-0.02 * S, shoulderY + 0.20 * S, 0);
    body.add(mane);

    // Шея (конус) и голова.
    const head = new THREE.Group();
    head.position.set(0.52 * S, 0.17 * S, 0);
    body.add(head);
    this.parts.head = head;
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10 * S, 0.15 * S, 0.24 * S, 8), m.skin);
    neck.rotation.z = Math.PI / 2 - 0.42;
    neck.position.set(-0.10 * S, -0.05 * S, 0);
    head.add(neck);

    // Череп: сужается к морде, с надбровными буграми.
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.13 * S, 11, 9), m.skin);
    skull.scale.set(1.25, 1.0, 0.92);
    skull.castShadow = true;
    head.add(skull);
    const snout = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055 * S, 0.085 * S, 0.24 * S, 8), m.skin);
    snout.rotation.z = Math.PI / 2;
    snout.position.set(0.19 * S, -0.035 * S, 0);
    head.add(snout);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035 * S, 7, 6), m.cloth);
    nose.position.set(0.31 * S, -0.03 * S, 0);
    head.add(nose);
    // Пасть: тёмная линия и клыки — читается при атаке.
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.17 * S, 0.03 * S, 0.085 * S), m.cloth);
    jaw.position.set(0.21 * S, -0.075 * S, 0);
    head.add(jaw);
    if (big) {
      for (const side of [-1, 1]) {
        const fang = new THREE.Mesh(new THREE.ConeGeometry(0.018 * S, 0.075 * S, 5), m.eye);
        fang.position.set(0.25 * S, -0.055 * S, side * 0.045 * S);
        fang.rotation.z = Math.PI;
        head.add(fang);
      }
    }
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.038 * S, 7, 6), m.eye);
      eye.position.set(0.09 * S, 0.045 * S, side * 0.085 * S);
      head.add(eye);
      const brow = new THREE.Mesh(new THREE.SphereGeometry(0.045 * S, 7, 5), m.skin);
      brow.scale.set(1.1, 0.6, 0.9);
      brow.position.set(0.085 * S, 0.075 * S, side * 0.085 * S);
      head.add(brow);
      // Уши: наклонены вперёд — зверь «нацелен» на цель.
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.055 * S, 0.17 * S, 5), m.cloth);
      ear.position.set(-0.06 * S, 0.15 * S, side * 0.075 * S);
      ear.rotation.set(side * 0.24, 0, 0.22);
      head.add(ear);
    }

    // Хвост: три сегмента, на конце кисть.
    const tail = new THREE.Group();
    tail.position.set(-0.56 * S, 0.10 * S, 0);
    body.add(tail);
    this.parts.tail = tail;
    const t1 = new THREE.Mesh(new THREE.CylinderGeometry(0.045 * S, 0.06 * S, 0.22 * S, 6), m.skin);
    t1.rotation.z = 0.9;
    t1.position.set(-0.06 * S, 0.04 * S, 0);
    tail.add(t1);
    const t2 = new THREE.Mesh(new THREE.SphereGeometry(0.075 * S, 8, 6), m.skin);
    t2.scale.set(1.9, 0.85, 0.85);
    t2.position.set(-0.24 * S, -0.02 * S, 0);
    tail.add(t2);

    // Лапы: бедро + голень + лапа, с выраженными суставами.
    const legs = {};
    for (const [key, x, z] of [['FL', 0.30, 0.17], ['FR', 0.30, -0.17], ['BL', -0.32, 0.17], ['BR', -0.32, -0.17]]) {
      const hip = new THREE.Group();
      hip.position.set(x * S, -0.10, z * S);
      body.add(hip);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * S, 0.075 * S, 0.28 * S, 7), m.skin);
      upper.position.y = -0.14 * S;
      upper.castShadow = true;
      hip.add(upper);
      const knee = new THREE.Group();
      knee.position.y = -0.28 * S;
      hip.add(knee);
      const joint = new THREE.Mesh(new THREE.SphereGeometry(0.062 * S, 7, 6), m.skin);
      knee.add(joint);
      const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.042 * S, 0.05 * S, 0.26 * S, 7), m.skin);
      lower.position.y = -0.13 * S;
      knee.add(lower);
      // Плюсна и лапа с когтями.
      const pastern = new THREE.Mesh(new THREE.CylinderGeometry(0.042 * S, 0.038 * S, 0.1 * S, 6), m.skin);
      pastern.position.set(0.02 * S, -0.29 * S, 0);
      pastern.rotation.z = -0.35;
      knee.add(pastern);
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.07 * S, 8, 6), m.cloth);
      paw.scale.set(1.5, 0.62, 1.05);
      paw.position.set(0.055 * S, -0.345 * S, 0);
      knee.add(paw);
      if (big) {
        for (let c = 0; c < 3; c++) {
          const claw = new THREE.Mesh(new THREE.ConeGeometry(0.014 * S, 0.055 * S, 4), m.accent);
          claw.position.set(0.11 * S, -0.35 * S, (c - 1) * 0.033 * S);
          claw.rotation.z = -Math.PI / 2;
          knee.add(claw);
        }
      }
      legs[key] = { hip, knee };
    }
    this.parts.legs = legs;

    // Шипы по хребту у босса каньона.
    if (big) {
      for (let i = 0; i < 6; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2 + (i % 2) * 0.08, 5), m.accent);
        spike.position.set((0.32 - i * 0.13) * S, 0.24 * S - i * 0.006, 0);
        spike.rotation.z = -0.2 - i * 0.05;
        body.add(spike);
      }
    }
  }

  // ── Летающее (гарпии) ──
  // Птичье-человеческий гибрид: торс с грудью, перьевые крылья из отдельных
  // маховых перьев (а не плоский полигон), хвост, лапы с когтями.
  _buildFlyer(body, m) {
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.36, 5, 10), m.skin);
    torso.rotation.x = 0.34;
    torso.castShadow = true;
    body.add(torso);
    this.parts.torso = torso;

    // Грудина птицы — характерный выступ.
    const keel = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), m.skin);
    keel.scale.set(0.8, 1.35, 0.65);
    keel.position.set(0, -0.02, 0.13);
    keel.rotation.x = 0.34;
    body.add(keel);

    const head = new THREE.Group();
    head.position.set(0, 0.34, 0.20);
    body.add(head);
    this.parts.head = head;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 9), m.skin);
    skull.scale.set(0.95, 1.0, 1.05);
    head.add(skull);
    // Клюв: две половины с крючком.
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.19, 6), m.accent);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, -0.012, 0.15);
    head.add(beak);
    const hook = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.055, 5), m.accent);
    hook.rotation.x = Math.PI * 0.92;
    hook.position.set(0, -0.045, 0.22);
    head.add(hook);
    const lowerBeak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 5), m.cloth);
    lowerBeak.rotation.x = Math.PI / 2;
    lowerBeak.position.set(0, -0.055, 0.13);
    head.add(lowerBeak);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 7, 6), m.eye);
      eye.position.set(side * 0.06, 0.035, 0.085);
      head.add(eye);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.014, 0.03), m.cloth);
      brow.position.set(side * 0.062, 0.062, 0.088);
      brow.rotation.z = side * 0.35;
      head.add(brow);
    }
    // Хохолок из перьев.
    for (let i = 0; i < 4; i++) {
      const crest = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.11 - i * 0.012, 4), m.accent);
      crest.position.set((i - 1.5) * 0.028, 0.12, -0.02 - i * 0.012);
      crest.rotation.set(-0.5 - i * 0.12, 0, (i - 1.5) * 0.16);
      head.add(crest);
    }

    // Крылья: каркас из «костей» + 6 маховых перьев в каждом.
    const wings = {};
    for (const side of [-1, 1]) {
      const wing = new THREE.Group();
      wing.position.set(side * 0.16, 0.17, -0.02);
      body.add(wing);
      // Плечевая кость.
      const humerus = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.032, 0.34, 6), m.skin);
      humerus.rotation.z = side * Math.PI / 2.5;
      humerus.position.set(side * 0.11, 0.07, 0);
      wing.add(humerus);
      // Маховые перья: длина убывает к концу крыла.
      for (let i = 0; i < 6; i++) {
        const t = i / 5;
        const featherLen = 0.62 - t * 0.18;
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.quadraticCurveTo(featherLen * 0.5, 0.075, featherLen, 0.01);
        shape.quadraticCurveTo(featherLen * 0.55, -0.055, 0, -0.022);
        shape.closePath();
        const geo = new THREE.ShapeGeometry(shape, 4);
        const feather = new THREE.Mesh(geo, i % 2 ? m.accent : m.cloth);
        feather.material.side = THREE.DoubleSide;
        feather.position.set(side * (0.06 + i * 0.055), 0.16 - i * 0.028, -0.10 + i * 0.045);
        feather.rotation.set(-0.18 + i * 0.05, side * (0.25 + i * 0.14), side * -0.1);
        feather.scale.x = side;
        feather.castShadow = true;
        wing.add(feather);
      }
      // Кроющие перья у плеча.
      for (let i = 0; i < 3; i++) {
        const covert = new THREE.Mesh(new THREE.SphereGeometry(0.055 - i * 0.008, 7, 5), m.skin);
        covert.scale.set(1.5, 0.5, 0.9);
        covert.position.set(side * (0.10 + i * 0.05), 0.13 + i * 0.012, -0.02 + i * 0.01);
        wing.add(covert);
      }
      wings[side === 1 ? 'R' : 'L'] = wing;
    }
    this.parts.wings = wings;

    // Хвост: веер из 3 перьев.
    for (let i = 0; i < 3; i++) {
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.34 - Math.abs(i - 1) * 0.06, 4), m.cloth);
      tail.position.set((i - 1) * 0.05, -0.12, -0.26);
      tail.rotation.set(-1.1, 0, (i - 1) * 0.28);
      body.add(tail);
    }

    // Лапы: бедро, цевка, три пальца с когтями — можно «схватить» добычу.
    for (const side of [-1, 1]) {
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.032, 0.22, 6), m.skin);
      thigh.position.set(side * 0.075, -0.24, 0.03);
      thigh.rotation.x = 0.34;
      body.add(thigh);
      const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.02, 0.2, 5), m.accent);
      shank.position.set(side * 0.075, -0.4, 0.09);
      shank.rotation.x = -0.2;
      body.add(shank);
      for (let c = 0; c < 3; c++) {
        const toe = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.008, 0.1, 4), m.accent);
        toe.position.set(side * 0.075 + (c - 1) * 0.028, -0.49, 0.12);
        toe.rotation.set(1.15, 0, (c - 1) * 0.3);
        body.add(toe);
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.045, 4), m.eye);
        claw.position.set(side * 0.075 + (c - 1) * 0.032, -0.5, 0.18);
        claw.rotation.x = 2.1;
        body.add(claw);
      }
    }
  }

  // ── Призрак ──
  // Полупрозрачный саван из нескольких слоёв с рваной кромкой, капюшон,
  // «пустое» лицо с парой огней и костяные кисти. Дешёвый, но силуэт
  // принципиально другой, чем у гуманоида: снизу фигура распадается.
  _buildWraith(body, m) {
    const cloth = new THREE.MeshStandardMaterial({
      color: m.cloth.color, roughness: 0.85, transparent: true, opacity: 0.82,
      side: THREE.DoubleSide, depthWrite: false
    });
    this.mats.wraithCloth = cloth;
    const ghostSkin = new THREE.MeshStandardMaterial({
      color: m.skin.color, roughness: 0.4, transparent: true, opacity: 0.55,
      emissive: m.skin.color, emissiveIntensity: 0.35, depthWrite: false
    });

    // Торс-саван: усечённый конус, расширяющийся книзу.
    const torso = new THREE.Mesh(new THREE.ConeGeometry(0.30, 1.0, 12, 2, true), cloth);
    torso.position.y = 0.08;
    torso.rotation.y = Math.PI / 12;
    body.add(torso);
    this.parts.torso = torso;

    // Второй слой савана — короче и шире, создаёт «объём» и глубину.
    const innerSkirt = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.76, 10, 1, true), cloth);
    innerSkirt.position.y = -0.02;
    innerSkirt.rotation.y = 0.4;
    body.add(innerSkirt);

    // Рваная кромка: 8 «лохмотьев» разной длины по низу савана.
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * TAU;
      const rag = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.34 + (i % 3) * 0.1, 4), cloth);
      rag.position.set(Math.cos(ang) * 0.29, -0.48 - (i % 3) * 0.04, Math.sin(ang) * 0.29);
      rag.rotation.set(Math.sin(ang) * 0.22, 0, -Math.cos(ang) * 0.22);
      body.add(rag);
    }

    // Плечи и «воротник» из складок.
    for (const side of [-1, 1]) {
      const drape = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.42, 6, 1, true), cloth);
      drape.position.set(side * 0.2, 0.24, 0);
      drape.rotation.z = side * 0.34;
      body.add(drape);
    }

    // Голова: капюшон + пустота внутри + два огня.
    const head = new THREE.Group();
    head.position.y = 0.62;
    body.add(head);
    this.parts.head = head;
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10, 0, TAU, 0, Math.PI * 0.72), cloth);
    hood.scale.set(0.95, 1.15, 1.0);
    head.add(hood);
    const hoodPeak = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.26, 8), cloth);
    hoodPeak.position.y = 0.14;
    hoodPeak.rotation.x = -0.22;
    head.add(hoodPeak);
    const voidFace = new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0x05080d }));
    voidFace.position.z = 0.05;
    voidFace.scale.set(0.95, 1.05, 0.7);
    head.add(voidFace);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 5), m.eye);
      eye.position.set(side * 0.042, 0.018, 0.128);
      head.add(eye);
    }

    // Руки: рукав-конус и костяная кисть с пальцами.
    for (const side of [-1, 1]) {
      const sleeve = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.5, 7, 1, true), cloth);
      sleeve.position.set(side * 0.26, -0.04, 0.05);
      sleeve.rotation.set(-0.35, 0, side * 0.42);
      body.add(sleeve);
      const palm = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), m.skin);
      palm.scale.set(1, 1.2, 0.6);
      palm.position.set(side * 0.35, -0.32, 0.14);
      body.add(palm);
      for (let f = 0; f < 3; f++) {
        const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.14, 4), m.skin);
        finger.position.set(side * (0.33 + f * 0.022), -0.42, 0.16 + (f - 1) * 0.02);
        finger.rotation.set(0.2, 0, side * (0.1 + f * 0.08));
        body.add(finger);
      }
    }

    // Шлейф-«хвост» из двух полупрозрачных лепестков, тянется за призраком.
    const trail = new THREE.Group();
    trail.position.y = -0.5;
    body.add(trail);
    for (let i = 0; i < 2; i++) {
      const wisp = new THREE.Mesh(new THREE.ConeGeometry(0.16 - i * 0.05, 0.5 + i * 0.2, 6, 1, true), ghostSkin);
      wisp.position.set((i - 0.5) * 0.12, -0.18 - i * 0.12, -0.06);
      wisp.rotation.x = 0.25;
      trail.add(wisp);
    }
    this.parts.trail = trail;
    // Глаза призрака светятся материалом, без PointLight (декоративный свет не нужен)
  }

  // ── Голем/колосс ──
  // Каменный конструкт: тело из гранёных валунов, шарниры-сферы, светящиеся
  // «жилы» в трещинах и рунные пластины. Скелет совместим с анимацией.
  _buildGolem(body, m) {
    const isBoss = this.isBoss;
    const s = isBoss ? 1.35 : 1;
    const stone = m.skin;
    const rune = m.eye;

    // Корпус: два валуна (грудь + пояс) — силуэт массивный, но не «куб».
    const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42 * s, 1), stone);
    torso.scale.set(1, 1.22, 0.86);
    torso.position.y = 0.38 * s;
    torso.castShadow = true;
    torso.receiveShadow = true;
    body.add(torso);
    this.parts.torso = torso;
    const pelvis = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 * s, 0), stone);
    pelvis.scale.set(1.1, 0.7, 0.9);
    pelvis.position.y = 0.02 * s;
    body.add(pelvis);

    // Трещины со свечением: несколько тонких «жил» по корпусу.
    for (let i = 0; i < 5; i++) {
      const vein = new THREE.Mesh(new THREE.BoxGeometry(0.022 * s, 0.18 * s, 0.02 * s), rune);
      const ang = (i / 5) * TAU;
      vein.position.set(Math.cos(ang) * 0.22 * s, 0.22 * s + i * 0.1 * s, Math.sin(ang) * 0.24 * s);
      vein.rotation.set(Math.sin(ang) * 0.4, ang, Math.cos(ang) * 0.5);
      body.add(vein);
    }
    // Пластины-накладки: неровные каменные плиты на груди.
    for (let i = 0; i < 4; i++) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.24 * s, 0.13 * s, 0.07 * s), m.accent);
      plate.position.set((i % 2 ? 0.13 : -0.13) * s, 0.18 * s + i * 0.14 * s, 0.31 * s);
      plate.rotation.z = (i % 2 ? -1 : 1) * 0.16;
      body.add(plate);
    }

    const head = new THREE.Group();
    head.position.y = 0.92 * s;
    body.add(head);
    this.parts.head = head;
    // Голова — монолит с «забралом»-щелью и рогами-обломками.
    const skull = new THREE.Mesh(new THREE.DodecahedronGeometry(0.19 * s, 0), stone);
    skull.scale.set(1.15, 1.0, 1.05);
    skull.castShadow = true;
    head.add(skull);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.26 * s, 0.075 * s, 0.05 * s), rune);
    visor.position.set(0, 0.01 * s, 0.16 * s);
    head.add(visor);
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.045 * s, 0.2 * s, 5), m.accent);
      horn.position.set(side * 0.13 * s, 0.14 * s, -0.02 * s);
      horn.rotation.set(-0.3, 0, side * 0.5);
      head.add(horn);
    }

    // Руки: сегменты-валуны с шарнирами и тяжёлыми кулаками.
    const arms = {};
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.46 * s, 0.60 * s, 0);
      body.add(shoulder);
      // Плечевой наплечник — крупный камень, «нависающий» над рукой.
      const pad = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 * s, 0), m.accent);
      pad.scale.set(1, 0.85, 1);
      shoulder.add(pad);
      const upper = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15 * s, 0), stone);
      upper.scale.set(0.9, 1.5, 0.9);
      upper.position.y = -0.24 * s;
      upper.castShadow = true;
      shoulder.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = -0.44 * s;
      shoulder.add(elbow);
      const joint = new THREE.Mesh(new THREE.SphereGeometry(0.115 * s, 8, 6), m.accent);
      elbow.add(joint);
      const fore = new THREE.Mesh(new THREE.DodecahedronGeometry(0.17 * s, 0), stone);
      fore.scale.set(0.95, 1.35, 0.95);
      fore.position.y = -0.24 * s;
      fore.castShadow = true;
      elbow.add(fore);
      const fist = new THREE.Mesh(new THREE.DodecahedronGeometry(0.19 * s, 0), m.accent);
      fist.position.y = -0.52 * s;
      fist.castShadow = true;
      elbow.add(fist);
      // Каменные «костяшки».
      for (let k = 0; k < 3; k++) {
        const knuckle = new THREE.Mesh(new THREE.DodecahedronGeometry(0.055 * s, 0), stone);
        knuckle.position.set((k - 1) * 0.07 * s, -0.58 * s, 0.1 * s);
        elbow.add(knuckle);
      }
      arms[side === 1 ? 'R' : 'L'] = { shoulder, elbow };
    }
    this.parts.armR = arms.R;
    this.parts.armL = arms.L;

    // Ноги: массивные, с выраженными коленями и ступнями-плитами.
    const legs = {};
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.2 * s, -0.02, 0);
      body.add(hip);
      const thigh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 * s, 0), stone);
      thigh.scale.set(1, 1.5, 1);
      thigh.position.y = -0.2 * s;
      thigh.castShadow = true;
      hip.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = -0.4 * s;
      hip.add(knee);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12 * s, 8, 6), m.accent);
      knee.add(cap);
      const shin = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15 * s, 0), stone);
      shin.scale.set(0.95, 1.4, 0.95);
      shin.position.y = -0.19 * s;
      knee.add(shin);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.24 * s, 0.1 * s, 0.34 * s), m.accent);
      foot.position.set(0, -0.4 * s, 0.05 * s);
      knee.add(foot);
      legs[side === 1 ? 'R' : 'L'] = { hip, knee };
    }
    this.parts.legR = legs.R;
    this.parts.legL = legs.L;

    // «Кристаллы» на плечах/спине: колосс несёт рунную энергию.
    for (let i = 0; i < (isBoss ? 5 : 3); i++) {
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.06 * s, 0), rune);
      const ang = (i / 5) * TAU;
      crystal.position.set(Math.cos(ang) * 0.26 * s, 0.5 * s + (i % 2) * 0.14 * s,
        -0.2 * s + Math.sin(ang) * 0.1 * s);
      crystal.rotation.set(ang, ang * 0.7, 0);
      body.add(crystal);
    }

    if (m.glow && allowDynamicLights(this)) {
      const l = new THREE.PointLight(this.look.eye, 1.2, 6, 2);
      l.position.y = 0.8;
      body.add(l);
    }
  }

  // ── Владыка пепла: уникальный силуэт босса ──
  // Броня из обсидиановых пластин, корона-солнце, плащ из пепла, двуручный
  // меч с раскалённой кромкой. Скелет совместим с гуманоидной анимацией:
  // parts.body/torso/head/armR/armL/legR/legL + weaponMesh.
  _buildSovereign(body, m) {
    const metal = m.metal || m.accent;
    const ember = m.ember || m.glow || m.skin;
    const torsoW = 0.54;
    const torsoH = 0.92;

    const torso = new THREE.Group();
    torso.position.y = torsoH * 0.5;
    body.add(torso);
    this.parts.torso = torso;

    const coreGeo = new THREE.CylinderGeometry(torsoW * 0.56, torsoW * 0.40, torsoH, 12, 3);
    coreGeo.scale(1, 1, 0.66);
    const core = new THREE.Mesh(coreGeo, m.cloth);
    core.castShadow = true;
    torso.add(core);

    // Три горизонтальные пластины: читается как латная кираса.
    for (let i = 0; i < 3; i++) {
      const k = i / 2;
      const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(torsoW * (0.60 - k * 0.06), torsoW * (0.54 - k * 0.06),
          torsoH * 0.24, 12, 1, true, -1.15, 2.3), metal);
      plate.position.y = torsoH * (0.22 - k * 0.26);
      plate.scale.z = 0.72;
      plate.castShadow = true;
      torso.add(plate);
    }
    // Раскалённая трещина по центру груди — источник свечения.
    const crack = new THREE.Mesh(new THREE.BoxGeometry(0.035, torsoH * 0.5, 0.02), ember);
    crack.position.set(0, torsoH * 0.06, torsoW * 0.44);
    torso.add(crack);
    for (let i = 0; i < 3; i++) {
      const branch = new THREE.Mesh(new THREE.BoxGeometry(0.018, torsoH * 0.16, 0.015), ember);
      branch.position.set((i - 1) * 0.05, torsoH * (0.18 - i * 0.12), torsoW * 0.44);
      branch.rotation.z = (i - 1) * 0.5;
      torso.add(branch);
    }
    // Наплечники-«крылья» из трёх перьев металла.
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const pauldron = new THREE.Mesh(
          new THREE.SphereGeometry(0.19 - k * 0.035, 9, 6, 0, TAU, 0, Math.PI / 2.1), metal);
        pauldron.position.set(side * (torsoW * (0.5 + k * 0.10)), torsoH * (0.42 - k * 0.05), -k * 0.02);
        pauldron.scale.set(1, 0.72, 1.15);
        pauldron.rotation.z = side * (0.18 + k * 0.22);
        pauldron.castShadow = true;
        body.add(pauldron);
      }
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.30, 6), metal);
      spike.position.set(side * torsoW * 0.62, torsoH * 0.56, 0);
      spike.rotation.z = side * -0.55;
      body.add(spike);
      const emberTip = new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 5), ember);
      emberTip.position.set(side * (torsoW * 0.62 + 0.13), torsoH * 0.70, 0);
      body.add(emberTip);
    }

    // Голова: череп-маска, три глаза, корона из шести зубцов.
    const head = new THREE.Group();
    head.position.y = torsoH + 0.22;
    body.add(head);
    this.parts.head = head;
    const skullR = 0.21;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(skullR, 14, 11), m.skin);
    skull.scale.set(0.9, 1.05, 0.92);
    skull.castShadow = true;
    head.add(skull);
    const mask = new THREE.Mesh(new THREE.SphereGeometry(skullR * 1.02, 12, 9,
      -1.9, 3.8, Math.PI * 0.18, Math.PI * 0.52), metal);
    mask.position.z = 0.015;
    head.add(mask);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), m.eye);
      eye.position.set(side * skullR * 0.34, skullR * 0.10, skullR * 0.84);
      head.add(eye);
      const socket = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.012, 5, 10), metal);
      socket.position.copy(eye.position);
      socket.position.z -= 0.006;
      head.add(socket);
    }
    const third = new THREE.Mesh(new THREE.SphereGeometry(0.024, 7, 6), ember);
    third.position.set(0, skullR * 0.52, skullR * 0.78);
    head.add(third);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(skullR * 0.86, 0.022, 6, 16), metal);
    ring.position.y = skullR * 0.62;
    ring.rotation.x = Math.PI / 2;
    head.add(ring);
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * TAU;
      const hgt = i % 2 === 0 ? 0.20 : 0.13;
      const prong = new THREE.Mesh(new THREE.ConeGeometry(0.028, hgt, 5), metal);
      prong.position.set(Math.cos(ang) * skullR * 0.82, skullR * 0.72 + hgt * 0.4,
        Math.sin(ang) * skullR * 0.82);
      prong.rotation.z = -Math.cos(ang) * 0.22;
      prong.rotation.x = Math.sin(ang) * 0.22;
      head.add(prong);
      if (i % 2 === 0) {
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.017, 6, 5), ember);
        tip.position.set(prong.position.x, prong.position.y + hgt * 0.5, prong.position.z);
        head.add(tip);
      }
    }

    // Плащ из пепла: два слоя с рваной нижней кромкой, крепится к плечам.
    const cape = new THREE.Group();
    cape.position.set(0, torsoH * 0.5, -0.10);
    body.add(cape);
    for (let layer = 0; layer < 2; layer++) {
      const geo = new THREE.CylinderGeometry(torsoW * (0.58 - layer * 0.06), torsoW * (1.02 - layer * 0.10),
        torsoH * (1.5 - layer * 0.25), 10, 2, true, Math.PI * 0.15, Math.PI * 1.7);
      const cloth = new THREE.Mesh(geo, layer === 0 ? m.cloth : m.accent);
      cloth.material.side = THREE.DoubleSide;
      cloth.position.y = -torsoH * (0.62 - layer * 0.1);
      cloth.rotation.y = Math.PI;
      cape.add(cloth);
    }
    this.parts.cape = cape;

    // Руки: металлические латы поверх кожи, кисти с пальцами-пластинами.
    const armLen = 0.56;
    const arms = {};
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * torsoW * 0.56, torsoH * 0.40, 0);
      body.add(shoulder);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.062, armLen, 8), metal);
      upper.position.y = -armLen / 2;
      upper.castShadow = true;
      shoulder.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = -armLen;
      shoulder.add(elbow);
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.052, armLen * 0.9, 8), metal);
      fore.position.y = -armLen * 0.45;
      fore.castShadow = true;
      elbow.add(fore);
      const vambrace = new THREE.Mesh(new THREE.BoxGeometry(0.10, armLen * 0.42, 0.11), m.accent);
      vambrace.position.set(0, -armLen * 0.55, 0.012);
      elbow.add(vambrace);
      const hand = new THREE.Group();
      hand.position.y = -armLen * 0.92;
      elbow.add(hand);
      const fist = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.11, 0.09), metal);
      hand.add(fist);
      for (let f = 0; f < 3; f++) {
        const finger = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.06, 0.022), metal);
        finger.position.set((f - 1) * 0.028, -0.075, 0.02);
        hand.add(finger);
      }
      arms[side === 1 ? 'R' : 'L'] = { shoulder, elbow, hand };
    }
    this.parts.armR = arms.R;
    this.parts.armL = arms.L;

    // Двуручный меч: гарда-«рога», дол с раскалённой линией, противовес.
    const weapon = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.038, 0.34, 7), m.accent);
    weapon.add(handle);
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), ember);
    pommel.position.y = -0.19;
    weapon.add(pommel);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.07), metal);
    guard.position.y = 0.19;
    weapon.add(guard);
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.16, 5), metal);
      horn.position.set(side * 0.21, 0.26, 0);
      horn.rotation.z = side * -0.35;
      weapon.add(horn);
    }
    const bladeLen = 1.45;
    const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.012, bladeLen, 4), metal);
    blade.rotation.y = Math.PI / 4;
    blade.scale.z = 0.34;
    blade.position.y = 0.19 + bladeLen / 2;
    blade.castShadow = true;
    weapon.add(blade);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.012, bladeLen * 0.96, 0.012), ember);
    edge.position.set(0.03, 0.19 + bladeLen / 2, 0);
    weapon.add(edge);
    weapon.rotation.x = -Math.PI / 2.6;
    weapon.position.y = 0.02;
    weapon.traverse(o => { if (o.isMesh) o.userData.animated = true; });
    arms.R.hand.add(weapon);
    this.weaponMesh = weapon;

    // Ноги: латные поножи, наколенники, тяжёлые сапоги.
    const legLen = 0.54;
    const legs = {};
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(side * torsoW * 0.28, 0.0, 0);
      body.add(hip);
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.070, legLen, 8), m.cloth);
      thigh.position.y = -legLen / 2;
      thigh.castShadow = true;
      hip.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = -legLen;
      hip.add(knee);
      const kneeCap = new THREE.Mesh(new THREE.SphereGeometry(0.082, 8, 6, 0, TAU, 0, Math.PI / 2), metal);
      kneeCap.position.y = 0.01;
      knee.add(kneeCap);
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.052, legLen * 0.92, 8), metal);
      shin.position.y = -legLen * 0.46;
      shin.castShadow = true;
      knee.add(shin);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.26), m.accent);
      boot.position.set(0, -legLen * 0.94, 0.05);
      knee.add(boot);
      legs[side === 1 ? 'R' : 'L'] = { hip, knee };
    }
    this.parts.legR = legs.R;
    this.parts.legL = legs.L;

    // Аура пепла: медленно кружащиеся угольки вокруг корпуса.
    const embers = [];
    for (let i = 0; i < 7; i++) {
      const ang = (i / 7) * TAU;
      const mote = new THREE.Mesh(new THREE.SphereGeometry(0.022 + Math.random() * 0.016, 5, 4), ember);
      mote.position.set(Math.cos(ang) * (0.5 + Math.random() * 0.2), 0.3 + Math.random() * 1.1,
        Math.sin(ang) * (0.5 + Math.random() * 0.2));
      body.add(mote);
      embers.push(mote);
    }
    this.parts.embers = embers;

    if (allowDynamicLights(this)) {
      const aura = new THREE.PointLight(0xff7a30, 2.6, 14, 2);
      aura.position.y = 1.0;
      body.add(aura);
      this.parts.light = aura;
    }
  }

  // ── Элементаль (огонь/лёд/пепел) ──
  // Существо из пламени: ядро-уголёк, «рёбра» из языков, руки-хлысты,
  // голова-череп с рогами. Отдельный силуэт, а не «шар с конусами».
  _buildElemental(body, m) {
    const flameMat = m.glow || m.skin;
    const coreMat = m.eye || flameMat;

    // Ядро: раскалённый уголёк, вокруг — оболочка из языков.
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.19, 1), coreMat);
    core.position.y = 0.36;
    body.add(core);
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.30, 1), flameMat);
    shell.position.y = 0.36;
    body.add(shell);
    this.parts.torso = shell;
    this.parts.core = core;

    // «Рёбра»: шесть языков, поднимающихся вокруг ядра (анимируются).
    const flames = [];
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * TAU;
      const h = 0.36 + (i % 3) * 0.14;
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.075, h, 6), flameMat);
      f.position.set(Math.cos(ang) * 0.26, 0.34 + h * 0.35, Math.sin(ang) * 0.26);
      f.rotation.set(Math.sin(ang) * 0.22, 0, -Math.cos(ang) * 0.22);
      body.add(f);
      flames.push(f);
    }
    this.parts.flames = flames;

    // Руки-хлысты: два сегмента пламени, утончающихся к «кисти».
    const arms = {};
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.24, 0.46, 0);
      body.add(shoulder);
      const upper = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 6), flameMat);
      upper.position.y = -0.16;
      upper.rotation.z = side * 0.6;
      shoulder.add(upper);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.26, 5), flameMat);
      tip.position.set(side * 0.14, -0.34, 0.02);
      tip.rotation.z = side * 0.35;
      shoulder.add(tip);
      const ember = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), coreMat);
      ember.position.set(side * 0.2, -0.46, 0.02);
      shoulder.add(ember);
      arms[side === 1 ? 'R' : 'L'] = { shoulder };
    }
    this.parts.armR = arms.R;
    this.parts.armL = arms.L;

    // Голова: череп-уголёк с рогами и «тлеющими» глазами.
    const head = new THREE.Group();
    head.position.y = 0.78;
    body.add(head);
    this.parts.head = head;
    const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 1), flameMat);
    skull.scale.set(1, 1.1, 0.95);
    head.add(skull);
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.2, 5), flameMat);
      horn.position.set(side * 0.09, 0.12, -0.02);
      horn.rotation.set(-0.25, 0, side * 0.6);
      head.add(horn);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 7, 6), m.eye);
      eye.position.set(side * 0.05, 0.01, 0.11);
      head.add(eye);
    }
    // Пасть — тёмная щель с искрами.
    const maw = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.03), m.cloth || flameMat);
    maw.position.set(0, -0.055, 0.115);
    head.add(maw);

    // Искры, поднимающиеся от тела (анимируются в update).
    const sparks = [];
    for (let i = 0; i < 6; i++) {
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.022 + (i % 2) * 0.008, 5, 4), coreMat);
      const ang = (i / 6) * TAU;
      spark.position.set(Math.cos(ang) * 0.2, 0.3 + (i / 6) * 0.6, Math.sin(ang) * 0.2);
      body.add(spark);
      sparks.push(spark);
    }
    this.parts.sparks = sparks;

    if (allowDynamicLights(this)) {
      const light = new THREE.PointLight(this.look.skin, 2.0, 8, 2);
      light.position.y = 0.6;
      body.add(light);
      this.parts.light = light;
    }
  }

  // ── Дрон ──
  // Боевой квадрокоптер: фюзеляж с «килем», сенсорный блок (объектив в
  // оправе), четыре луча с моторами и винтами, подвес-пушка снизу.
  _buildDrone(body, m) {
    const hull = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), m.skin);
    hull.scale.set(1, 0.62, 1.15);
    body.add(hull);
    this.parts.torso = hull;
    // Верхний обтекатель и нижний «киль» — фюзеляж перестаёт быть диском.
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8, 0, TAU, 0, Math.PI / 2), m.accent);
    canopy.position.y = 0.05;
    canopy.scale.set(1, 0.7, 1.25);
    body.add(canopy);
    const keel = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.2, 8), m.accent);
    keel.position.y = -0.16;
    keel.rotation.x = Math.PI;
    body.add(keel);

    // Сенсорный блок: оправа, линза, два «глаза» по бокам.
    const sensorRing = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.022, 6, 14), m.accent);
    sensorRing.position.set(0, -0.015, 0.235);
    body.add(sensorRing);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.078, 12, 9), m.eye);
    eye.position.set(0, -0.015, 0.24);
    body.add(eye);
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x0b1015, metalness: 0.7, roughness: 0.12 }));
    lens.position.set(0, -0.015, 0.30);
    body.add(lens);
    for (const side of [-1, 1]) {
      const pod = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), m.eye);
      pod.position.set(side * 0.15, -0.03, 0.15);
      pod.scale.set(1, 0.8, 1);
      body.add(pod);
    }
    this.parts.head = body;

    // Лучи и моторы: цилиндрические гондолы с вентиляционными рёбрами.
    const rotors = [];
    const props = [];
    for (const [x, z] of [[0.30, 0.30], [-0.30, 0.30], [0.30, -0.30], [-0.30, -0.30]]) {
      const ang = Math.atan2(z, x);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.038, 0.055), m.accent);
      arm.position.set(x * 0.62, 0.03, z * 0.62);
      arm.rotation.y = ang;
      body.add(arm);
      // Гондола мотора.
      const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.1, 10), m.skin);
      nacelle.position.set(x, 0.08, z);
      body.add(nacelle);
      const fins = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.008, 4, 12), m.accent);
      fins.position.set(x, 0.05, z);
      fins.rotation.x = Math.PI / 2;
      body.add(fins);
      // Диск винта (полупрозрачный) + две лопасти.
      const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.01, 14),
        new THREE.MeshStandardMaterial({ color: 0x30363f, metalness: 0.6, roughness: 0.4, transparent: true, opacity: 0.55 }));
      rotor.position.set(x, 0.135, z);
      body.add(rotor);
      rotors.push(rotor);
      const blades = new THREE.Group();
      blades.position.set(x, 0.145, z);
      for (let b = 0; b < 2; b++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.006, 0.03), m.accent);
        blade.rotation.y = b * Math.PI / 2;
        blades.add(blade);
      }
      body.add(blades);
      props.push(blades);
    }
    this.parts.rotors = rotors;
    this.parts.props = props;

    // Подвес-пушка: ствол и короб боеприпасов.
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.22, 8), m.accent);
    gun.position.set(0, -0.22, 0.10);
    gun.rotation.x = Math.PI / 2.4;
    body.add(gun);
    const ammo = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.16), m.skin);
    ammo.position.set(0, -0.2, -0.02);
    body.add(ammo);
    // Антенна и навигационный огонь.
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 4), m.accent);
    antenna.position.set(0.08, 0.2, -0.06);
    antenna.rotation.z = -0.2;
    body.add(antenna);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), m.eye);
    beacon.position.set(0.08, 0.28, -0.06);
    body.add(beacon);

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
      // Шлейф отстаёт от корпуса и «дышит».
      if (p.trail) {
        p.trail.rotation.x = Math.sin(t * 1.4) * 0.18 - speedNorm * 0.3;
        p.trail.rotation.z = Math.sin(t * 0.9) * 0.12;
      }
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
      // Искры поднимаются вверх и гаснут, руки-хлысты колышутся.
      if (p.sparks) p.sparks.forEach((sp, i) => {
        const k = (t * 0.5 + i / p.sparks.length) % 1;
        sp.position.y = 0.25 + k * 0.9;
        sp.scale.setScalar(1 - k * 0.6);
      });
      if (p.armR && p.armR.shoulder) p.armR.shoulder.rotation.x = Math.sin(t * 3.1) * 0.1;
      if (p.armL && p.armL.shoulder) p.armL.shoulder.rotation.x = Math.sin(t * 3.1 + 1.6) * 0.1;
      if (p.light) p.light.intensity = 1.6 + Math.sin(t * 9) * 0.5;
    } else if (kind === 'drone') {
      p.body.position.y = 1.5 + Math.sin(t * 2.6) * 0.1;
      if (p.rotors) p.rotors.forEach(r => { r.rotation.y += dt * 42; });
      if (p.props) p.props.forEach(b => { b.rotation.y += dt * 58; });
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

    // Владыка пепла: плащ колышется, угольки кружат вокруг корпуса.
    if (kind === 'sovereign') {
      if (p.cape) {
        p.cape.rotation.z = Math.sin(t * 1.2) * 0.05;
        p.cape.rotation.x = 0.04 + Math.sin(t * 0.9) * 0.03 + speedNorm * 0.12;
      }
      if (p.embers) {
        p.embers.forEach((mote, i) => {
          const ang = t * 0.8 + (i / p.embers.length) * TAU;
          const rad = 0.5 + Math.sin(t * 1.6 + i) * 0.12;
          mote.position.x = Math.cos(ang) * rad;
          mote.position.z = Math.sin(ang) * rad;
          mote.position.y = 0.3 + ((t * 0.35 + i * 0.17) % 1) * 1.25;
          const s2 = 0.7 + Math.sin(t * 6 + i) * 0.3;
          mote.scale.setScalar(s2);
        });
      }
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
