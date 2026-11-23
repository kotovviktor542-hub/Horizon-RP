// VEXMORA 3D — OPEN WORLD: модели животных и нейтральных путников.
// Отдельный модуль, чтобы не раздувать creatures.js: животные — это
// «четвероногие/птицы» с собственными силуэтами (рога, хвост, крылья),
// путники — упрощённые гуманоиды с дорожной экипировкой.
// Все модели собраны процедурно из примитивов и склеены по материалам,
// поэтому один зверь — это 2–4 draw call.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createMaterial } from '../core/materials.js';

const TAU = Math.PI * 2;

const matCache = new Map();
function mat(color, opts = {}) {
  const key = `${color}:${opts.rough ?? 0.85}:${opts.metal ?? 0.05}:${opts.flat ? 1 : 0}`;
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    color, roughness: opts.rough ?? 0.85, metalness: opts.metal ?? 0.05,
    flatShading: !!opts.flat
  });
  matCache.set(key, m);
  return m;
}

// Склейка статических мешей по материалу
function mergeByMaterial(root) {
  if (typeof mergeGeometries !== 'function') return;
  const buckets = new Map();
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.material) return;
    if (o.userData.animated) return;
    const key = `${o.parent?.uuid}|${o.material.uuid}`;
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
      g.applyMatrix4(mesh.matrix);
      geos.push(g);
    }
    const merged = mergeGeometries(geos, false);
    geos.forEach(g => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, list[0].material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    for (const old of list) parent.remove(old);
    parent.add(mesh);
  }
}

/**
 * Animal3D — животное: тело на четырёх лапах, голова на шее, хвост.
 * Анимация процедурная: шаг, бег, пастьба, испуг, атака хищника.
 */
export class Animal3D {
  constructor(scene, def) {
    this.scene = scene;
    this.def = def;
    this.kind = def.build || 'small';
    this.baseScale = (def.build === 'bear' ? 1.05
      : def.build === 'deer' ? 0.95
      : def.build === 'boar' ? 0.7
      : def.build === 'goat' ? 0.8
      : def.build === 'wolf' ? 0.75
      : def.build === 'bird' ? 0.55
      : 0.45);
    this.root = new THREE.Group();
    this.root.name = `animal_${def.id}`;
    this.root.scale.setScalar(this.baseScale);
    scene.add(this.root);
    this.parts = {};
    this.time = Math.random() * 10;
    this.hitFlash = 0;
    this._build();
    mergeByMaterial(this.root);
  }

  _build() {
    const def = this.def;
    const bodyMat = mat(def.tint ?? 0x9a7a52);
    const darkMat = mat(0x2a2118, { rough: 0.9 });
    const lightMat = mat(0xd8cbb4);
    const root = this.root;
    const g = new THREE.Group();
    root.add(g);
    this.parts.group = g;

    if (this.kind === 'bird') { this._buildBird(g, bodyMat, darkMat); return; }
    if (this.kind === 'small') { this._buildSmall(g, bodyMat, darkMat, lightMat); return; }

    const isDeer = this.kind === 'deer' || this.kind === 'goat';
    const isBear = this.kind === 'bear';
    const len = isBear ? 1.5 : isDeer ? 1.35 : this.kind === 'boar' ? 1.25 : 1.2;
    const h = isBear ? 1.05 : isDeer ? 1.0 : 0.78;
    const legH = isBear ? 0.62 : isDeer ? 0.85 : 0.5;

    // Корпус
    const torso = new THREE.Mesh(new THREE.BoxGeometry(len * 0.62, h * 0.52, len), bodyMat);
    torso.position.y = legH + h * 0.24;
    torso.castShadow = true;
    g.add(torso);
    this.parts.torso = torso;

    // Круп и грудь — объёмнее, чем «коробка»
    const rump = new THREE.Mesh(new THREE.SphereGeometry(len * 0.3, 8, 6), bodyMat);
    rump.scale.set(1, 0.9, 1.15);
    rump.position.set(0, legH + h * 0.24, -len * 0.32);
    g.add(rump);
    const chest = new THREE.Mesh(new THREE.SphereGeometry(len * 0.27, 8, 6), bodyMat);
    chest.position.set(0, legH + h * 0.26, len * 0.30);
    g.add(chest);

    // Шея и голова
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(len * 0.13, len * 0.17, len * 0.34, 7), bodyMat);
    neck.position.set(0, legH + h * 0.52, len * 0.42);
    neck.rotation.x = -0.55;
    g.add(neck);
    const head = new THREE.Group();
    head.position.set(0, legH + h * 0.70, len * 0.56);
    g.add(head);
    this.parts.head = head;
    const skull = new THREE.Mesh(new THREE.BoxGeometry(len * 0.17, len * 0.17, len * 0.3), bodyMat);
    head.add(skull);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(len * 0.11, len * 0.1, len * 0.16), bodyMat);
    snout.position.set(0, -len * 0.03, len * 0.2);
    head.add(snout);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(len * 0.06, len * 0.05, len * 0.04), darkMat);
    nose.position.set(0, -len * 0.02, len * 0.29);
    head.add(nose);
    // Глаза
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(len * 0.026, 6, 5), darkMat);
      eye.position.set(sx * len * 0.075, len * 0.03, len * 0.12);
      head.add(eye);
    }
    // Уши
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(len * 0.05, len * 0.11, 5), bodyMat);
      ear.position.set(sx * len * 0.075, len * 0.1, -len * 0.02);
      ear.rotation.z = sx * 0.25;
      head.add(ear);
    }

    // Рога у оленя и козла
    if (isDeer) {
      for (const sx of [-1, 1]) {
        const hornBase = new THREE.Mesh(new THREE.CylinderGeometry(len * 0.018, len * 0.024, len * 0.22, 5), lightMat);
        hornBase.position.set(sx * len * 0.06, len * 0.14, 0);
        hornBase.rotation.z = sx * 0.4;
        hornBase.rotation.x = -0.2;
        head.add(hornBase);
        if (this.kind === 'deer') {
          for (const k of [0, 1]) {
            const tine = new THREE.Mesh(new THREE.CylinderGeometry(len * 0.012, len * 0.016, len * 0.16, 4), lightMat);
            tine.position.set(sx * (len * 0.1 + k * len * 0.03), len * 0.24 + k * len * 0.1, -k * len * 0.02);
            tine.rotation.z = sx * (0.6 + k * 0.5);
            head.add(tine);
          }
        }
      }
    }
    // Хвост
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(len * 0.03, len * 0.012, len * 0.3, 5), bodyMat);
    tail.position.set(0, legH + h * 0.4, -len * 0.52);
    tail.rotation.x = 0.9;
    g.add(tail);
    this.parts.tail = tail;

    // Лапы (анимируются)
    this.parts.legs = [];
    const legGeo = new THREE.CylinderGeometry(len * 0.045, len * 0.035, legH, 5);
    const hoofGeo = new THREE.BoxGeometry(len * 0.07, len * 0.05, len * 0.09);
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const hip = new THREE.Group();
      hip.position.set(sx * len * 0.22, legH, sz * len * 0.34);
      const leg = new THREE.Mesh(legGeo, bodyMat);
      leg.position.y = -legH * 0.5;
      leg.castShadow = true;
      leg.userData.animated = true;
      hip.add(leg);
      const hoof = new THREE.Mesh(hoofGeo, darkMat);
      hoof.position.y = -legH + len * 0.03;
      hip.add(hoof);
      g.add(hip);
      this.parts.legs.push({ hip, front: sz > 0, side: sx });
    }

    // Горб и клыки у кабана
    if (this.kind === 'boar') {
      const hump = new THREE.Mesh(new THREE.SphereGeometry(len * 0.2, 7, 5), bodyMat);
      hump.scale.set(1, 0.7, 1.2);
      hump.position.set(0, legH + h * 0.5, len * 0.12);
      g.add(hump);
      for (const sx of [-1, 1]) {
        const tusk = new THREE.Mesh(new THREE.ConeGeometry(len * 0.02, len * 0.12, 4), lightMat);
        tusk.position.set(sx * len * 0.05, -len * 0.04, len * 0.28);
        tusk.rotation.x = 0.5;
        head.add(tusk);
      }
    }
  }

  _buildSmall(g, bodyMat, darkMat, lightMat) {
    // Кролик / ящерица: компактное тело с длинными ушами или хвостом
    const isLizard = this.def.id.includes('lizard');
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 9, 7), bodyMat);
    body.scale.set(1, isLizard ? 0.55 : 0.85, 1.3);
    body.position.y = 0.3;
    body.castShadow = true;
    g.add(body);
    this.parts.torso = body;
    const head = new THREE.Group();
    head.position.set(0, 0.38, 0.36);
    g.add(head);
    this.parts.head = head;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), bodyMat);
    skull.scale.set(1, 0.9, 1.15);
    head.add(skull);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), darkMat);
      eye.position.set(sx * 0.09, 0.03, 0.1);
      head.add(eye);
      if (!isLizard) {
        const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.22, 3, 6), bodyMat);
        ear.position.set(sx * 0.07, 0.2, -0.02);
        ear.rotation.z = sx * 0.18;
        head.add(ear);
      }
    }
    // Хвост: у ящерицы длинный, у кролика — пушистый шарик
    if (isLizard) {
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.02, 0.75, 5), bodyMat);
      tail.position.set(0, 0.26, -0.55);
      tail.rotation.x = 1.35;
      g.add(tail);
      this.parts.tail = tail;
      // Лапки по бокам
      this.parts.legs = [];
      for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.22, 4), bodyMat);
        leg.position.set(sx * 0.24, 0.12, sz * 0.22);
        leg.rotation.z = sx * 0.5;
        g.add(leg);
      }
    } else {
      const tail = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), lightMat);
      tail.position.set(0, 0.36, -0.4);
      g.add(tail);
      this.parts.tail = tail;
    }
  }

  _buildBird(g, bodyMat, darkMat) {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 9, 7), bodyMat);
    body.scale.set(0.85, 1, 0.85);
    body.position.y = 0.85;
    body.castShadow = true;
    g.add(body);
    this.parts.torso = body;
    const head = new THREE.Group();
    head.position.set(0, 1.12, 0.14);
    g.add(head);
    this.parts.head = head;
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), bodyMat));
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 4), mat(0xd8a032));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, -0.01, 0.17);
    head.add(beak);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 4), darkMat);
      eye.position.set(sx * 0.09, 0.03, 0.1);
      head.add(eye);
    }
    // Крылья анимируются
    this.parts.wings = [];
    for (const sx of [-1, 1]) {
      const wing = new THREE.Group();
      wing.position.set(sx * 0.28, 0.9, 0);
      const feather = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.3), bodyMat);
      feather.position.x = sx * 0.2;
      feather.userData.animated = true;
      wing.add(feather);
      g.add(wing);
      this.parts.wings.push(wing);
    }
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.32), bodyMat);
    tail.position.set(0, 0.82, -0.34);
    tail.rotation.x = 0.25;
    g.add(tail);
    this.parts.tail = tail;
    this.parts.legs = [];
  }

  /**
   * @param {number} dt
   * @param {{position:{x,y,z}, facing:number, speed:number, state:string, airborne?:boolean}} s
   */
  update(dt, s) {
    this.time += dt;
    const t = this.time;
    const p = this.parts;
    if (s.position) this.root.position.set(s.position.x, s.position.y, s.position.z);
    if (typeof s.facing === 'number') {
      let d = s.facing - this.root.rotation.y;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      this.root.rotation.y += d * Math.min(1, dt * 7);
    }
    const speedNorm = Math.min(1, (s.speed || 0) / 2.5);
    const run = s.state === 'flee' || s.state === 'chase';

    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt * 4);

    // Ноги: шаг или галоп
    if (p.legs && p.legs.length) {
      const freq = run ? 13 : 6.5;
      const amp = run ? 0.85 : 0.42;
      p.legs.forEach((leg, i) => {
        const phase = (i % 2 === 0 ? 0 : Math.PI) + (leg.front ? 0 : Math.PI * 0.5);
        leg.hip.rotation.x = Math.sin(t * freq + phase) * amp * (0.25 + speedNorm);
      });
      // Корпус покачивается в такт
      if (p.group) p.group.position.y = Math.abs(Math.sin(t * freq)) * (run ? 0.09 : 0.03) * (0.3 + speedNorm);
    }
    // Хвост и голова
    if (p.tail) p.tail.rotation.z = Math.sin(t * (run ? 9 : 3.4)) * 0.22;
    if (p.head) {
      const graze = s.state === 'idle' || s.state === 'graze';
      p.head.rotation.x = graze ? Math.max(0, Math.sin(t * 1.4)) * 0.55 : Math.sin(t * 2.2) * 0.06;
      p.head.rotation.y = Math.sin(t * 0.9) * 0.18;
    }
    // Крылья ворона
    if (p.wings) {
      const flap = s.airborne ? 1 : 0.35;
      p.wings.forEach((w, i) => {
        w.rotation.z = (i === 0 ? 1 : -1) * Math.sin(t * 9) * 0.55 * flap;
      });
    }
    // Испуг: подпрыгивание
    if (run && p.group) p.group.rotation.x = Math.sin(t * 12) * 0.03;
  }

  dispose() {
    this.scene.remove(this.root);
    this.root.traverse(o => {
      if (o.isMesh) {
        o.geometry?.dispose?.();
      }
    });
  }
}

/**
 * Traveler3D — нейтральный NPC: путник с посохом/рюкзаком, стоит или идёт.
 */
export class Traveler3D {
  constructor(scene, def) {
    this.scene = scene;
    this.def = def;
    this.root = new THREE.Group();
    this.root.name = `traveler_${def.id}`;
    scene.add(this.root);
    this.parts = {};
    this.time = Math.random() * 6;
    this._build();
    mergeByMaterial(this.root);
  }

  _build() {
    const cloth = mat(0x4a5a6a, { rough: 0.9 });
    const cloak = mat(0x2f3a46, { rough: 0.92 });
    const skin = mat(0xc79a72);
    const leather = mat(0x6b4a2a, { rough: 0.85 });
    const g = new THREE.Group();
    this.root.add(g);
    this.parts.group = g;

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.72, 8), cloth);
    torso.position.y = 1.08;
    torso.castShadow = true;
    g.add(torso);
    this.parts.torso = torso;

    // Плащ-накидка
    const cape = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.05, 8, 1, true), cloak);
    cape.position.y = 1.0;
    cape.material.side = THREE.DoubleSide;
    g.add(cape);

    const head = new THREE.Group();
    head.position.y = 1.56;
    g.add(head);
    this.parts.head = head;
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), skin));
    // Капюшон
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.23, 9, 7, 0, TAU, 0, Math.PI * 0.62), cloak);
    hood.position.y = 0.03;
    head.add(hood);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 5, 4), mat(0x1a1a1a));
      eye.position.set(sx * 0.07, 0, 0.16);
      head.add(eye);
    }

    // Руки
    this.parts.arms = [];
    for (const sx of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(sx * 0.29, 1.32, 0);
      const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.62, 6), cloth);
      limb.position.y = -0.31;
      limb.castShadow = true;
      limb.userData.animated = true;
      arm.add(limb);
      g.add(arm);
      this.parts.arms.push(arm);
    }

    // Ноги
    this.parts.legs = [];
    for (const sx of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(sx * 0.13, 0.72, 0);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.72, 6), leather);
      leg.position.y = -0.36;
      leg.castShadow = true;
      leg.userData.animated = true;
      hip.add(leg);
      g.add(hip);
      this.parts.legs.push(hip);
    }

    // Рюкзак и посох — узнаваемый силуэт путника
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.2), leather);
    pack.position.set(0, 1.12, -0.24);
    g.add(pack);
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.75, 5), mat(0x7a5a3a));
    staff.position.set(0.42, 0.88, 0.06);
    staff.rotation.z = 0.06;
    g.add(staff);
  }

  update(dt, s) {
    this.time += dt;
    const t = this.time;
    const p = this.parts;
    if (s.position) this.root.position.set(s.position.x, s.position.y, s.position.z);
    if (typeof s.facing === 'number') {
      let d = s.facing - this.root.rotation.y;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      this.root.rotation.y += d * Math.min(1, dt * 6);
    }
    const moving = (s.speed || 0) > 0.2;
    const walk = t * 5.5;
    if (p.legs) p.legs.forEach((leg, i) => { leg.rotation.x = moving ? Math.sin(walk + i * Math.PI) * 0.55 : 0; });
    if (p.arms) p.arms.forEach((arm, i) => {
      arm.rotation.x = moving ? Math.sin(walk + (i ? 0 : Math.PI)) * 0.4 : Math.sin(t * 1.2) * 0.05;
    });
    if (p.head) p.head.rotation.y = Math.sin(t * 0.7) * 0.3;
    if (p.group) p.group.position.y = moving ? Math.abs(Math.sin(walk)) * 0.05 : 0;
  }

  dispose() {
    this.scene.remove(this.root);
    this.root.traverse(o => { if (o.isMesh) o.geometry?.dispose?.(); });
  }
}
