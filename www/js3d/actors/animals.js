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

// ── REMASTER: анатомические профили животных ──────────────────────────
// До ремастера волк и лиса строились одной ветвью `build:'wolf'` и имели
// одинаковые габариты, а олень/козёл были вытянуты вверх узким «столбом».
// Теперь каждое существо описывается числами: длина корпуса, высота в холке,
// длина ног, объём груди/крупа, форма морды и постановка ушей. Силуэты
// различаются не цветом, а пропорциями скелета.
const BODY_PROFILES = {
  wolf: {
    len: 1.10, withers: 0.80, girth: 0.21, rumpR: 0.20,
    neckLen: 0.30, neckTilt: -0.62, headLen: 0.28, headW: 0.155,
    snoutLen: 0.30, snoutDrop: 0.05, earType: 'point', earLen: 0.15, earSpread: 0.08,
    tail: 'bushy', tailLen: 0.40, tailDrop: 0.55, hump: 0.0,
    mane: true, chestDepth: 1.06
  },
  fox: {
    len: 0.72, withers: 0.42, girth: 0.132, rumpR: 0.128,
    neckLen: 0.16, neckTilt: -0.52, headLen: 0.17, headW: 0.095,
    snoutLen: 0.20, snoutDrop: 0.02, earType: 'fox', earLen: 0.115, earSpread: 0.055,
    tail: 'bushy', tailLen: 0.50, tailDrop: 0.30, hump: 0.0,
    mane: false, chestDepth: 0.9
  },
  bear: {
    len: 1.52, withers: 1.02, girth: 0.33, rumpR: 0.34,
    neckLen: 0.22, neckTilt: -0.34, headLen: 0.34, headW: 0.245,
    snoutLen: 0.26, snoutDrop: 0.06, earType: 'round', earLen: 0.085, earSpread: 0.155,
    tail: 'stub', tailLen: 0.10, tailDrop: 0.2, hump: 0.14,
    mane: false, chestDepth: 1.14
  },
  deer: {
    len: 1.14, withers: 1.20, girth: 0.195, rumpR: 0.20,
    neckLen: 0.46, neckTilt: -0.46, headLen: 0.24, headW: 0.125,
    snoutLen: 0.26, snoutDrop: 0.06, earType: 'leaf', earLen: 0.18, earSpread: 0.095,
    tail: 'deer', tailLen: 0.18, tailDrop: 0.1, hump: 0.0,
    mane: false, chestDepth: 0.94, horns: 'antler'
  },
  goat: {
    len: 0.86, withers: 0.76, girth: 0.165, rumpR: 0.165,
    neckLen: 0.24, neckTilt: -0.90, headLen: 0.20, headW: 0.11,
    snoutLen: 0.20, snoutDrop: 0.07, earType: 'drop', earLen: 0.12, earSpread: 0.09,
    tail: 'stub', tailLen: 0.14, tailDrop: 0.3, hump: 0.04,
    mane: true, beard: true, chestDepth: 0.92, horns: 'curve'
  },
  boar: {
    len: 1.02, withers: 0.74, girth: 0.24, rumpR: 0.235,
    neckLen: 0.16, neckTilt: -0.22, headLen: 0.26, headW: 0.18,
    snoutLen: 0.24, snoutDrop: 0.09, earType: 'point', earLen: 0.12, earSpread: 0.10,
    tail: 'curl', tailLen: 0.22, tailDrop: 0.5, hump: 0.16,
    mane: true, tusks: true, chestDepth: 1.02
  }
};

// Плавный органический объём: сфера, растянутая по осям. Дешевле бокса по
// силуэту при том же числе граней, поэтому корпус больше не «коробка».
function blob(r, seg = 10, squash = null) {
  const geo = new THREE.SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.72)));
  if (squash) geo.scale(squash[0], squash[1], squash[2]);
  return geo;
}

// Каплевидная голова: сфера + сужение к морде. Даёт узнаваемый профиль
// хищника без отдельных «боксов-черепа».
function skullGeo(headLen, headW) {
  const geo = new THREE.SphereGeometry(headW, 12, 9);
  geo.scale(1, 0.94, (headLen / headW) * 0.5);
  return geo;
}

// Осветление/затемнение цвета для брюха и тёмных окончаний.
function shade(color, k) {
  const c = new THREE.Color(color);
  return c.multiplyScalar(k).getHex();
}

/**
 * Animal3D — животное: тело на четырёх лапах, голова на шее, хвост.
 * Анимация процедурная: шаг, бег, пастьба, испуг, атака хищника.
 */
export class Animal3D {
  constructor(scene, def) {
    this.scene = scene;
    this.def = def;
    // Вид определяется `build`, но живые экземпляры приходят с полем `kind`
    // (defId) — поддерживаем оба источника, чтобы не терять силуэт.
    this.kind = def.build || def.kind || 'small';
    if (def.tint == null && def.color != null) def = { ...def, tint: def.color };
    // Масштаб задаётся профилем: у каждого зверя свои реальные пропорции,
    // поэтому общий коэффициент только доводит модель до игрового размера.
    const PROFILE_SCALE = {
      bear: 1.02, deer: 1.0, boar: 0.95, goat: 0.95,
      wolf: 0.98, fox: 1.0,
      // Мелкие звери строятся в масштабе 1:1 (кролик ~0.3 м, ящерица ~0.5 м).
      // Птицу рисуем чуть крупнее — иначе ворона не разглядеть с камеры.
      bird: 0.62, small: 1.0
    };
    this.baseScale = PROFILE_SCALE[def.build] ?? 0.55;
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
    const tint = def.tint ?? 0x9a7a52;
    // Три тона шкуры: спина/бока, брюхо и тёмные окончания (морда, копыта).
    const bodyMat = mat(tint, { rough: 0.92 });
    const bellyMat = mat(shade(tint, 1.32), { rough: 0.94 });
    const darkMat = mat(shade(tint, 0.35), { rough: 0.9 });
    const lightMat = mat(0xd8cbb4);
    const root = this.root;
    const g = new THREE.Group();
    root.add(g);
    this.parts.group = g;

    if (this.kind === 'bird') { this._buildBird(g, bodyMat, darkMat); return; }
    if (this.kind === 'small') { this._buildSmall(g, bodyMat, darkMat, lightMat); return; }

    const P = BODY_PROFILES[this.kind] || BODY_PROFILES.wolf;
    const len = P.len;
    // Высота в холке — главный размер; ось корпуса и длина ног выводятся
    // из неё, поэтому пропорции взрослой особи не «плывут» при смене вида.
    const bodyY = P.withers - P.girth * 0.86;
    const legH = Math.max(0.16, bodyY - P.girth * 0.74);

    // ── Грудная клетка и брюхо ───────────────────────────────────────────
    // Тело — два пересекающихся эллипсоида (грудь глубже и шире крупа),
    // а не единый бокс: на силуэте появляется «талия» и провис спины.
    const chest = new THREE.Mesh(blob(P.girth, 12, [P.chestDepth, 0.94, 1.5]), bodyMat);
    chest.position.set(0, bodyY - P.girth * 0.06, len * 0.20);
    chest.castShadow = true;
    chest.receiveShadow = true;
    g.add(chest);
    this.parts.torso = chest;

    const rump = new THREE.Mesh(blob(P.rumpR, 12, [1.0, 0.96, 1.28]), bodyMat);
    rump.position.set(0, bodyY, -len * 0.26);
    rump.castShadow = true;
    g.add(rump);

    // Провис/горб спины — у кабана и медведя характерная «горка» над лопатками.
    if (P.hump > 0.01) {
      const hump = new THREE.Mesh(blob(P.rumpR * 0.92, 10, [0.95, 0.65, 1.1]), bodyMat);
      hump.position.set(0, bodyY + P.girth * 0.52, len * 0.10);
      hump.scale.y += P.hump;
      g.add(hump);
    }

    // Светлое брюхо — узкая полоса снизу, видна в профиль и снизу.
    const belly = new THREE.Mesh(blob(P.girth * 0.82, 10, [0.86, 0.5, 1.35]), bellyMat);
    belly.position.set(0, bodyY - P.girth * 0.52, len * 0.02);
    g.add(belly);

    // Лопатки: два сглаженных выступа по бокам груди — «мышцы», не декор.
    for (const sx of [-1, 1]) {
      const scap = new THREE.Mesh(blob(P.girth * 0.46, 8, [0.75, 1.15, 1.0]), bodyMat);
      scap.position.set(sx * P.girth * 0.56, bodyY + P.girth * 0.12, len * 0.20);
      g.add(scap);
    }
    // Бёдра: объём над задними лапами, иначе зверь выглядит «на палках».
    for (const sx of [-1, 1]) {
      const thigh = new THREE.Mesh(blob(P.rumpR * 0.62, 8, [0.72, 1.0, 1.0]), bodyMat);
      thigh.position.set(sx * P.rumpR * 0.68, bodyY - P.rumpR * 0.12, -len * 0.26);
      g.add(thigh);
    }

    // ── Шея ──────────────────────────────────────────────────────────────
    // Шея — сужающийся конус с изгибом: у оленя вертикальная, у волка
    // наклонена вперёд, у кабана почти горизонтальна.
    const neckR = P.girth * 0.62;
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(neckR * 0.74, neckR, P.neckLen, 9, 2, true), bodyMat);
    const neckBaseY = bodyY + P.girth * 0.30;
    const headY = neckBaseY + Math.sin(-P.neckTilt) * P.neckLen * 0.62;
    const headZ = len * 0.30 + Math.cos(-P.neckTilt) * P.neckLen * 0.72;
    neck.position.set(0, (neckBaseY + headY) * 0.5 - P.girth * 0.06,
      (len * 0.30 + headZ) * 0.5);
    neck.rotation.x = P.neckTilt;
    neck.castShadow = true;
    g.add(neck);

    // ── Голова ───────────────────────────────────────────────────────────
    const head = new THREE.Group();
    head.position.set(0, headY, headZ);
    head.rotation.x = P.neckTilt * 0.35;
    g.add(head);
    this.parts.head = head;

    // Черепная коробка: сплюснутая сфера, сужается к морде.
    const skull = new THREE.Mesh(skullGeo(P.headLen, P.headW), bodyMat);
    skull.scale.set(1, 1, 1.18);
    skull.castShadow = true;
    head.add(skull);

    // Морда: конус от скул к носу — у лисы узкая и длинная, у медведя короткая.
    const snout = new THREE.Mesh(
      new THREE.CylinderGeometry(P.headW * 0.34, P.headW * 0.5, P.snoutLen, 8, 1),
      this.kind === 'fox' ? bodyMat : bodyMat);
    snout.rotation.x = Math.PI / 2 - 0.06;
    snout.position.set(0, -P.snoutDrop, P.headLen * 0.42 + P.snoutLen * 0.34);
    head.add(snout);

    // Нос — мочка, тёмная и блестящая.
    const nose = new THREE.Mesh(blob(P.headW * 0.26, 7, [1.15, 0.9, 0.8]), darkMat);
    nose.position.set(0, -P.snoutDrop - P.headW * 0.06,
      P.headLen * 0.42 + P.snoutLen * 0.72);
    head.add(nose);

    // Нижняя челюсть — линия подбородка, читается в профиль.
    const jaw = new THREE.Mesh(blob(P.headW * 0.42, 8, [0.9, 0.62, 1.6]), bodyMat);
    jaw.position.set(0, -P.snoutDrop - P.headW * 0.26, P.headLen * 0.5 + P.snoutLen * 0.3);
    head.add(jaw);

    // Глаза с бликом: тёмный зрачок в светлой глазнице.
    for (const sx of [-1, 1]) {
      const socket = new THREE.Mesh(blob(P.headW * 0.3, 8, [1, 1, 0.6]), darkMat);
      socket.position.set(sx * P.headW * 0.58, P.headW * 0.18, P.headLen * 0.30);
      head.add(socket);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(P.headW * 0.17, 8, 6),
        this.kind === 'wolf' || this.kind === 'fox'
          ? mat(0xd8b24a, { rough: 0.25, metal: 0.1 })
          : mat(0x14100c, { rough: 0.18, metal: 0.1 }));
      eye.position.set(sx * P.headW * 0.68, P.headW * 0.18, P.headLen * 0.34);
      head.add(eye);
    }

    // Уши: четыре формы — стоячие (волк/кабан), лисьи (широкие), круглые
    // (медведь), листовидные (олень) и висячие (козёл).
    for (const sx of [-1, 1]) {
      if (P.earType === 'round') {
        const ear = new THREE.Mesh(blob(P.earLen, 8, [1, 1, 0.42]), bodyMat);
        ear.position.set(sx * P.earSpread, P.headW * 0.86, P.headLen * 0.05);
        head.add(ear);
        const inner = new THREE.Mesh(blob(P.earLen * 0.62, 6, [1, 1, 0.3]), darkMat);
        inner.position.set(sx * P.earSpread, P.headW * 0.88, P.headLen * 0.05 + P.earLen * 0.18);
        head.add(inner);
      } else if (P.earType === 'drop') {
        const ear = new THREE.Mesh(blob(P.earLen, 8, [0.42, 1, 0.8]), bodyMat);
        ear.position.set(sx * (P.headW * 0.92 + P.earLen * 0.4), P.headW * 0.12, P.headLen * 0.02);
        ear.rotation.z = sx * 0.9;
        head.add(ear);
      } else {
        // Уши посажены на череп, а не «на макушку поверх» — иначе силуэт
        // вырастает на треть и зверь выглядит выше реального.
        const tall = P.earType === 'leaf' ? 1.15 : P.earType === 'fox' ? 0.8 : 0.85;
        const ear = new THREE.Mesh(
          new THREE.ConeGeometry(P.earLen * (P.earType === 'fox' ? 0.62 : 0.42), P.earLen * 1.15 * tall, 5),
          bodyMat);
        ear.position.set(sx * P.earSpread, P.headW * 0.62 + P.earLen * 0.36 * tall, -P.headLen * 0.02);
        ear.rotation.z = sx * (P.earType === 'fox' ? 0.22 : 0.16);
        ear.rotation.x = -0.16;
        head.add(ear);
        // Внутренняя сторона уха — тёмная впадина, видна сзади.
        const inner = new THREE.Mesh(
          new THREE.ConeGeometry(P.earLen * 0.26, P.earLen * 0.95 * tall, 4), darkMat);
        inner.position.copy(ear.position);
        inner.position.z += P.earLen * 0.1;
        inner.rotation.copy(ear.rotation);
        head.add(inner);
      }
    }

    // Рога: ветвистые у оленя (панты с отростками) и загнутые у козла.
    if (P.horns === 'antler') this._buildAntlers(head, lightMat, darkMat, P);
    else if (P.horns === 'curve') this._buildCurvedHorns(head, lightMat, P);
    // Борода козла.
    if (P.beard) {
      const beard = new THREE.Mesh(new THREE.ConeGeometry(P.headW * 0.3, P.headW * 0.9, 5), darkMat);
      beard.position.set(0, -P.snoutDrop - P.headW * 0.85, P.headLen * 0.5);
      beard.rotation.x = 0.14;
      head.add(beard);
    }
    // Клыки кабана.
    if (P.tusks) {
      for (const sx of [-1, 1]) {
        const tusk = new THREE.Mesh(new THREE.ConeGeometry(P.headW * 0.11, P.headW * 0.7, 5), lightMat);
        tusk.position.set(sx * P.headW * 0.42, -P.snoutDrop - P.headW * 0.22, P.headLen * 0.62);
        tusk.rotation.set(-0.4, 0, sx * 0.32);
        head.add(tusk);
      }
    }

    // ── Хвост ────────────────────────────────────────────────────────────
    this.parts.tail = this._buildTail(g, bodyMat, darkMat, P, bodyY, len);

    // ── Лапы ─────────────────────────────────────────────────────────────
    // Каждая лапа — бедро + голень + плюсна: два сустава читаются при беге.
    this.parts.legs = [];
    const upperLen = legH * 0.52;
    const lowerLen = legH * 0.48;
    const legR = Math.max(0.028, P.girth * 0.15);
    const hoofGeo = this.kind === 'bear'
      ? blob(legR * 1.5, 7, [1, 0.7, 1.35])
      : new THREE.BoxGeometry(legR * 2.1, legR * 1.5, legR * 2.7);
    const hoofMat = this.kind === 'bear' ? bodyMat : darkMat;

    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const hip = new THREE.Group();
      // Задние лапы крепятся под крупом, передние — под грудью.
      hip.position.set(
        sx * (sz > 0 ? P.girth * 0.5 : P.rumpR * 0.56),
        legH,
        sz > 0 ? len * 0.20 : -len * 0.26);
      const upper = new THREE.Mesh(
        new THREE.CylinderGeometry(legR * 1.35, legR * 0.92, upperLen, 7), bodyMat);
      upper.position.y = -upperLen * 0.5;
      upper.castShadow = true;
      upper.userData.animated = true;
      hip.add(upper);
      // Колено
      const knee = new THREE.Mesh(blob(legR * 1.05, 7, [1, 1, 1]), bodyMat);
      knee.position.y = -upperLen;
      hip.add(knee);
      const shank = new THREE.Group();
      shank.position.y = -upperLen;
      hip.add(shank);
      const lower = new THREE.Mesh(
        new THREE.CylinderGeometry(legR * 0.9, legR * 0.72, lowerLen, 7), bodyMat);
      lower.position.y = -lowerLen * 0.5;
      shank.add(lower);
      const hoof = new THREE.Mesh(hoofGeo, hoofMat);
      hoof.position.y = -lowerLen + legR * 0.5;
      hoof.castShadow = true;
      shank.add(hoof);
      g.add(hip);
      // Поля бедро/голень нужны анимации: колено сгибается в противофазе.
      this.parts.legs.push({ hip, front: sz > 0, side: sx, knee, lower: shank, upperLen, lowerLen });
    }

    // Грива/подгрудок волка и кабана — тёмная полоса шерсти по хребту.
    if (P.mane) {
      for (let i = 0; i < 5; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(P.girth * 0.16, P.girth * 0.4, 4), darkMat);
        spike.position.set(0, bodyY + P.girth * (0.7 - i * 0.05), len * (0.30 - i * 0.13));
        spike.rotation.x = -0.5;
        g.add(spike);
      }
    }
  }

  // Ветвистые панты: ствол + 3 отростка на каждой стороне.
  _buildAntlers(head, beamMat, tipMat, P) {
    const len = P.headLen;
    for (const sx of [-1, 1]) {
      const base = new THREE.Vector3(sx * P.headW * 0.34, P.headW * 0.9, -P.headLen * 0.08);
      const main = new THREE.Mesh(
        new THREE.CylinderGeometry(len * 0.055, len * 0.085, len * 0.92, 6), beamMat);
      main.position.set(base.x + sx * len * 0.22, base.y + len * 0.4, base.z - len * 0.12);
      main.rotation.set(-0.2, 0, sx * -0.55);
      head.add(main);
      // Отростки растут вперёд-вверх от ствола.
      for (let k = 0; k < 3; k++) {
        const tine = new THREE.Mesh(
          new THREE.CylinderGeometry(len * 0.03, len * 0.05, len * (0.52 - k * 0.08), 5), beamMat);
        tine.position.set(
          base.x + sx * len * (0.26 + k * 0.06),
          base.y + len * (0.28 + k * 0.26),
          base.z + len * (0.16 - k * 0.04));
        tine.rotation.set(-0.5 - k * 0.18, 0, sx * -(0.75 + k * 0.16));
        head.add(tine);
      }
      // Розетка у основания — тёмное кольцо.
      const burr = new THREE.Mesh(
        new THREE.CylinderGeometry(len * 0.1, len * 0.1, len * 0.07, 7), tipMat);
      burr.position.copy(base);
      head.add(burr);
    }
  }

  // Загнутые назад рога козла: два сегмента с изломом.
  _buildCurvedHorns(head, hornMat, P) {
    const len = P.headLen;
    for (const sx of [-1, 1]) {
      const a = new THREE.Mesh(
        new THREE.CylinderGeometry(len * 0.05, len * 0.075, len * 0.42, 6), hornMat);
      a.position.set(sx * P.headW * 0.4, P.headW * 1.05, -P.headLen * 0.06);
      a.rotation.set(0.35, 0, sx * -0.32);
      head.add(a);
      const b = new THREE.Mesh(
        new THREE.CylinderGeometry(len * 0.03, len * 0.05, len * 0.5, 6), hornMat);
      b.position.set(sx * P.headW * 0.66, P.headW * 1.28, -P.headLen * 0.4);
      b.rotation.set(1.15, 0, sx * -0.55);
      head.add(b);
    }
  }

  // Хвост: пушистый (волк/лиса), короткий (медведь/козёл), крючок (кабан).
  _buildTail(g, bodyMat, darkMat, P, bodyY, len) {
    const rootY = bodyY + P.girth * 0.24;
    const rootZ = -len * 0.46;
    if (P.tail === 'bushy') {
      const tail = new THREE.Group();
      tail.position.set(0, rootY, rootZ);
      g.add(tail);
      // Три сегмента + кисть: силуэт «метёлки» вместо палки.
      const segs = 3;
      for (let i = 0; i < segs; i++) {
        const t = i / segs;
        const r = P.tailLen * (0.16 - t * 0.035);
        const seg = new THREE.Mesh(blob(r, 8, [1, 1, 1.9]), bodyMat);
        seg.position.set(0, -P.tailLen * t * P.tailDrop, -P.tailLen * t * 0.92);
        tail.add(seg);
      }
      const tip = new THREE.Mesh(blob(P.tailLen * 0.11, 7, [0.9, 0.9, 1.5]),
        this.kind === 'fox' ? mat(0xf2ece0, { rough: 0.95 }) : darkMat);
      tip.position.set(0, -P.tailLen * P.tailDrop * 0.96, -P.tailLen * 0.9);
      tail.add(tip);
      return tail;
    }
    if (P.tail === 'curl') {
      const tail = new THREE.Group();
      tail.position.set(0, rootY, rootZ);
      g.add(tail);
      const a = new THREE.Mesh(new THREE.CylinderGeometry(len * 0.026, len * 0.02, len * 0.16, 5), bodyMat);
      a.position.set(0, -len * 0.05, -len * 0.06);
      a.rotation.x = 0.5;
      tail.add(a);
      const curl = new THREE.Mesh(new THREE.TorusGeometry(len * 0.055, len * 0.017, 5, 9, Math.PI * 1.5), bodyMat);
      curl.position.set(0, -len * 0.15, -len * 0.1);
      tail.add(curl);
      return tail;
    }
    if (P.tail === 'stub') {
      const stub = new THREE.Mesh(blob(P.tailLen * 0.5, 7, [1, 1, 1.2]), bodyMat);
      stub.position.set(0, rootY, rootZ - P.tailLen * 0.2);
      stub.userData.animated = true;
      g.add(stub);
      return stub;
    }
    // Олений хвост: короткий, светлый снизу.
    const deerTail = new THREE.Mesh(new THREE.CylinderGeometry(P.tailLen * 0.16, P.tailLen * 0.07,
      P.tailLen * 1.6, 6), bodyMat);
    deerTail.position.set(0, rootY - P.tailLen * 0.3, rootZ - P.tailLen * 0.25);
    deerTail.rotation.x = 0.9;
    deerTail.userData.animated = true;
    g.add(deerTail);
    return deerTail;
  }

  _buildSmall(g, bodyMat, darkMat, lightMat) {
    // Кролик и пустынная ящерица: совершенно разные животные, поэтому и
    // строятся разными ветками, а не «сферой с ушами».
    const isLizard = (this.def.id || '').includes('lizard');
    if (isLizard) this._buildLizard(g, bodyMat, darkMat, lightMat);
    else this._buildRabbit(g, bodyMat, darkMat, lightMat);
  }

  // ── Пустынная ящерица ────────────────────────────────────────────────
  // Приземистое тело, четыре расставленные лапы, гребень по спине,
  // длинный сужающийся хвост и клиновидная голова с челюстью.
  _buildLizard(g, bodyMat, darkMat, lightMat) {
    const scaleMat = mat(shade(this.def.tint ?? 0xa8946a, 1.25), { rough: 0.7 });
    const body = new THREE.Mesh(blob(0.16, 11, [1.25, 0.62, 1.5]), bodyMat);
    body.position.y = 0.11;
    body.castShadow = true;
    g.add(body);
    this.parts.torso = body;
    const belly = new THREE.Mesh(blob(0.13, 9, [1.15, 0.42, 1.35]), lightMat);
    belly.position.y = 0.075;
    g.add(belly);

    // Голова: клин с челюстью и глазами по бокам (у ящериц они не спереди).
    const head = new THREE.Group();
    head.position.set(0, 0.13, 0.24);
    g.add(head);
    this.parts.head = head;
    const skull = new THREE.Mesh(blob(0.085, 10, [1.1, 0.78, 1.25]), bodyMat);
    head.add(skull);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.13, 6), bodyMat);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, -0.012, 0.1);
    head.add(snout);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.12), darkMat);
    jaw.position.set(0, -0.045, 0.07);
    head.add(jaw);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 7, 6), mat(0xd8b24a, { rough: 0.2 }));
      eye.position.set(sx * 0.062, 0.022, 0.035);
      head.add(eye);
      // Чешуйчатый «капюшон» за глазом.
      const plate = new THREE.Mesh(blob(0.032, 6, [0.6, 0.5, 1.1]), scaleMat);
      plate.position.set(sx * 0.055, 0.045, -0.02);
      head.add(plate);
    }

    // Гребень: ряд треугольных чешуй от затылка до хвоста.
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const crest = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.045 - t * 0.012, 4), scaleMat);
      crest.position.set(0, 0.175 - t * 0.03, 0.12 - t * 0.34);
      crest.rotation.x = -0.25;
      g.add(crest);
    }

    // Лапы: расставлены в стороны (характерная поза ящерицы), с коготками.
    this.parts.legs = [];
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const hip = new THREE.Group();
      hip.position.set(sx * 0.11, 0.08, sz * 0.11);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.1, 5), bodyMat);
      upper.rotation.z = sx * 1.1;
      upper.position.set(sx * 0.045, -0.01, 0);
      hip.add(upper);
      const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.09, 5), bodyMat);
      lower.position.set(sx * 0.09, -0.06, 0.01);
      hip.add(lower);
      // Пальцы с когтями.
      for (let f = 0; f < 3; f++) {
        const toe = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.005, 0.05, 4), darkMat);
        toe.position.set(sx * (0.1 + f * 0.014), -0.1, 0.02 + (f - 1) * 0.02);
        toe.rotation.set(0.5, 0, sx * 0.4);
        hip.add(toe);
      }
      g.add(hip);
      this.parts.legs.push({ hip, front: sz > 0, side: sx });
    }

    // Хвост: 4 сегмента, толстый у корня и тонкий на конце.
    const tail = new THREE.Group();
    tail.position.set(0, 0.105, -0.2);
    g.add(tail);
    this.parts.tail = tail;
    for (let i = 0; i < 4; i++) {
      const t = i / 4;
      const r = 0.05 * (1 - t * 0.72);
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, 0.11, 6), bodyMat);
      seg.position.set(0, -t * 0.012, -0.05 - i * 0.1);
      seg.rotation.x = Math.PI / 2 + t * 0.1;
      tail.add(seg);
      if (i % 2 === 0) {
        const ridge = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.03, 4), scaleMat);
        ridge.position.set(0, 0.035, -0.05 - i * 0.1);
        ridge.rotation.x = -0.4;
        tail.add(ridge);
      }
    }
  }

  // ── Кролик ───────────────────────────────────────────────────────────
  // Компактное тело, мощные задние лапы, длинные уши с тёмными кончиками,
  // короткий пушистый хвост и «дрожащий» нос.
  _buildRabbit(g, bodyMat, darkMat, lightMat) {
    const body = new THREE.Mesh(blob(0.15, 11, [1.0, 1.05, 1.35]), bodyMat);
    body.position.y = 0.19;
    body.castShadow = true;
    g.add(body);
    this.parts.torso = body;
    // Светлое брюшко и грудка.
    const bib = new THREE.Mesh(blob(0.12, 9, [0.85, 0.8, 1.1]), lightMat);
    bib.position.set(0, 0.145, 0.06);
    g.add(bib);

    // Задние лапы: крупные, сложены «пружиной» — визитная карточка кролика.
    for (const sx of [-1, 1]) {
      const haunch = new THREE.Mesh(blob(0.075, 8, [0.75, 1.2, 1.25]), bodyMat);
      haunch.position.set(sx * 0.1, 0.16, -0.06);
      g.add(haunch);
      const foot = new THREE.Mesh(blob(0.045, 7, [0.8, 0.5, 2.0]), lightMat);
      foot.position.set(sx * 0.1, 0.045, 0.02);
      g.add(foot);
    }
    // Передние лапки: короткие, поджаты под грудь.
    this.parts.legs = [];
    for (const sx of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(sx * 0.07, 0.13, 0.10);
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.016, 0.1, 5), bodyMat);
      fore.position.y = -0.05;
      hip.add(fore);
      const paw = new THREE.Mesh(blob(0.022, 6, [1, 0.6, 1.4]), lightMat);
      paw.position.y = -0.1;
      hip.add(paw);
      g.add(hip);
      this.parts.legs.push({ hip, front: true, side: sx });
    }

    // Голова: округлая, с щёчками и длинными ушами.
    const head = new THREE.Group();
    head.position.set(0, 0.3, 0.16);
    g.add(head);
    this.parts.head = head;
    const skull = new THREE.Mesh(blob(0.088, 10, [1.0, 0.95, 1.05]), bodyMat);
    head.add(skull);
    for (const sx of [-1, 1]) {
      const cheek = new THREE.Mesh(blob(0.045, 7, [1, 0.9, 0.85]), bodyMat);
      cheek.position.set(sx * 0.05, -0.03, 0.03);
      head.add(cheek);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.021, 7, 6), mat(0x120e0a, { rough: 0.2 }));
      eye.position.set(sx * 0.055, 0.02, 0.06);
      head.add(eye);
      // Ухо: вытянутый эллипсоид с тёмной внутренней частью и кончиком.
      const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.16, 3, 7), bodyMat);
      ear.position.set(sx * 0.045, 0.14, -0.01);
      ear.rotation.set(-0.12, 0, sx * 0.2);
      ear.scale.z = 0.62;
      head.add(ear);
      const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.13, 3, 6), mat(0xd8a0a0, { rough: 0.9 }));
      inner.position.set(sx * 0.045, 0.14, 0.012);
      inner.rotation.copy(ear.rotation);
      inner.scale.z = 0.5;
      head.add(inner);
      const tip = new THREE.Mesh(blob(0.028, 6, [1, 0.9, 0.6]), darkMat);
      tip.position.set(sx * 0.045, 0.23, -0.012);
      head.add(tip);
    }
    // Нос-«пуговка» и усы.
    const nose = new THREE.Mesh(blob(0.016, 6, [1.2, 0.9, 0.8]), mat(0xc07a7a, { rough: 0.5 }));
    nose.position.set(0, -0.012, 0.088);
    head.add(nose);
    for (const sx of [-1, 1]) {
      for (let w = 0; w < 2; w++) {
        const whisker = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0015, 0.09, 3), lightMat);
        whisker.position.set(sx * 0.06, -0.012 + w * 0.012, 0.07);
        whisker.rotation.set(0, 0, sx * (Math.PI / 2 - 0.2 - w * 0.2));
        head.add(whisker);
      }
    }

    // Хвост-помпон.
    const tail = new THREE.Mesh(blob(0.045, 8, [1, 1, 1]), lightMat);
    tail.position.set(0, 0.2, -0.18);
    g.add(tail);
    this.parts.tail = tail;
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
        const swing = Math.sin(t * freq + phase);
        leg.hip.rotation.x = swing * amp * (0.25 + speedNorm);
        // Колено подгибается на обратном ходе — походка перестаёт быть «ходульками».
        if (leg.lower) leg.lower.rotation.x = Math.max(0, -swing) * 0.7 * (0.25 + speedNorm);
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
