// VEXMORA 3D — герой: полноценная 3D-модель с иерархией костей,
// плавными процедурными анимациями (idle/walk/run/jump/attack/block/hurt/death)
// и сменной экипировкой: оружие в руке, шлем, нагрудник, плащ.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createMaterial, colorMaterial, emissiveMaterial } from '../core/materials.js';

const TAU = Math.PI * 2;
const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));

// ── Оружие в 3D ──────────────────────────────────────────────────────────
export const Weapon3D = {
  build(category = 'melee', rarity = 'common', seed = 1) {
    const group = new THREE.Group();
    const rarityColors = {
      common: 0xb9c2cf, uncommon: 0x6ee7a0, rare: 0x60b8f0,
      epic: 0xc084fc, legendary: 0xffc247, mythic: 0xff6b6b
    };
    const glow = rarityColors[rarity] || 0xb9c2cf;
    const steel = new THREE.MeshStandardMaterial({ color: 0xd8e0ea, metalness: 0.95, roughness: 0.18 });
    const darkSteel = new THREE.MeshStandardMaterial({ color: 0x6b7480, metalness: 0.9, roughness: 0.32 });
    const grip = createMaterial('leather', { repeat: 1 });
    const gold = createMaterial('gold', { repeat: 1 });
    const wood = createMaterial('wood', { repeat: 1 });
    // Обмотка рукояти: кольца из тёмной кожи — деталь, которая читается в руке.
    const wrapMat = colorMaterial(0x2c2218, { roughness: 0.92 });

    const isMagic = category === 'magic';
    const isBow = category === 'bow';
    const isAxe = category === 'axe';
    const isDagger = category === 'dagger';
    const isSpear = category === 'spear';

    if (isBow) {
      // Лук: рекурсивные плечи (двойной изгиб), рожки на концах, обмотка
      // рукояти и тетива с гнёздами. Раньше это была одна трубка-дуга.
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.0, 0.62, -0.06),
        new THREE.Vector3(0.10, 0.44, 0.10),
        new THREE.Vector3(0.16, 0.22, 0.22),
        new THREE.Vector3(0.17, 0.0, 0.26),
        new THREE.Vector3(0.16, -0.22, 0.22),
        new THREE.Vector3(0.10, -0.44, 0.10),
        new THREE.Vector3(0.0, -0.62, -0.06)
      ]);
      const limb = new THREE.Mesh(new THREE.TubeGeometry(curve, 26, 0.03, 8, false), wood);
      limb.castShadow = true;
      group.add(limb);
      // Рожки и гнёзда тетивы.
      for (const sy of [-1, 1]) {
        const nock = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.07, 6), gold);
        nock.position.set(0, sy * 0.645, -0.07);
        nock.rotation.x = -sy * 0.25;
        group.add(nock);
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 5), gold);
        tip.position.set(0, sy * 0.685, -0.075);
        group.add(tip);
      }
      // Рукоять: утолщение и кожаная обмотка кольцами.
      const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.20, 8), wood);
      riser.position.set(0.155, 0, 0.255);
      riser.rotation.x = Math.PI / 2;
      group.add(riser);
      for (let i = 0; i < 4; i++) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.007, 5, 10), wrapMat);
        band.position.set(0.155, -0.075 + i * 0.05, 0.255);
        band.rotation.y = Math.PI / 2;
        group.add(band);
      }
      // Тетива и «гнездо» стрелы.
      const stringGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.645, -0.07), new THREE.Vector3(0, 0, 0.10),
        new THREE.Vector3(0, -0.645, -0.07)
      ]);
      group.add(new THREE.Line(stringGeo, new THREE.LineBasicMaterial({ color: 0xe8e8ee })));
      const arrowRest = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.012, 0.02), gold);
      arrowRest.position.set(0.16, 0.0, 0.15);
      group.add(arrowRest);
    } else if (isMagic) {
      // Посох: витое древко с обмоткой, кованые кольца, кристалл в оправе.
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.034, 1.25, 8), wood);
      shaft.position.y = 0.1;
      shaft.castShadow = true;
      group.add(shaft);
      for (let i = 0; i < 5; i++) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.007, 5, 10), i % 2 ? gold : wrapMat);
        band.position.y = -0.28 + i * 0.16;
        band.rotation.x = Math.PI / 2;
        group.add(band);
      }
      // Оправа: три «когтя», удерживающие кристалл.
      for (let i = 0; i < 3; i++) {
        const ang = (i / 3) * TAU;
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.16, 5), gold);
        claw.position.set(Math.cos(ang) * 0.075, 0.80, Math.sin(ang) * 0.075);
        claw.rotation.x = Math.sin(ang) * 0.42;
        claw.rotation.z = -Math.cos(ang) * 0.42;
        group.add(claw);
      }
      const cradle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 6, 14), gold);
      cradle.position.y = 0.72;
      cradle.rotation.x = Math.PI / 2;
      group.add(cradle);
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), emissiveMaterial(glow, 2.4, { transparent: true, opacity: 0.9 }));
      crystal.position.y = 0.82;
      group.add(crystal);
      const light = new THREE.PointLight(glow, 1.4, 4, 2);
      light.position.y = 0.82;
      group.add(light);
      group.userData.crystal = crystal;
    } else {
      // Рукоять
      const handleLen = isDagger ? 0.16 : isAxe ? 0.55 : 0.26;
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, handleLen, 8), grip);
      handle.position.y = handleLen / 2;
      handle.castShadow = true;
      group.add(handle);
      // Обмотка рукояти: 3–5 колец тёмной кожи (у топора и копья — длиннее).
      const rings = isAxe || isSpear ? 5 : isDagger ? 2 : 3;
      for (let i = 0; i < rings; i++) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.006, 4, 10), wrapMat);
        band.position.y = handleLen * (0.12 + (i / Math.max(1, rings - 1)) * 0.72);
        band.rotation.x = Math.PI / 2;
        group.add(band);
      }
      // Навершие
      const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), gold);
      pommel.position.y = -0.01;
      group.add(pommel);
      // Гарда
      const guard = new THREE.Mesh(new THREE.BoxGeometry(isDagger ? 0.16 : 0.26, 0.045, 0.06), gold);
      guard.position.y = handleLen;
      group.add(guard);

      if (isAxe) {
        // Топор: обух и лезвие
        const bladeShape = new THREE.Shape();
        bladeShape.moveTo(0, 0);
        bladeShape.lineTo(0.34, -0.12);
        bladeShape.quadraticCurveTo(0.42, 0.12, 0.30, 0.42);
        bladeShape.lineTo(0, 0.44);
        bladeShape.closePath();
        const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.05, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.01, bevelSegments: 2 });
        const blade = new THREE.Mesh(bladeGeo, steel);
        blade.position.set(0, handleLen + 0.05, -0.025);
        blade.castShadow = true;
        group.add(blade);
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 6), darkSteel);
        spike.position.set(-0.06, handleLen + 0.25, 0);
        spike.rotation.z = Math.PI / 2;
        group.add(spike);
      } else {
        // Клинок: сужающаяся полоса с долом и бликом
        const bladeLen = isDagger ? 0.38 : isSpear ? 1.5 : 1.05;
        const bladeW = isDagger ? 0.075 : isSpear ? 0.09 : 0.12;
        const shape = new THREE.Shape();
        shape.moveTo(-bladeW / 2, 0);
        shape.lineTo(bladeW / 2, 0);
        shape.lineTo(bladeW * 0.44, bladeLen * 0.86);
        shape.lineTo(0, bladeLen);
        shape.lineTo(-bladeW * 0.44, bladeLen * 0.86);
        shape.closePath();
        const bladeGeo = new THREE.ExtrudeGeometry(shape, {
          depth: 0.028, bevelEnabled: true, bevelSize: 0.014, bevelThickness: 0.012, bevelSegments: 2
        });
        const blade = new THREE.Mesh(bladeGeo, steel);
        blade.position.set(0, handleLen + (isSpear ? 0.0 : 0.01), -0.014);
        blade.castShadow = true;
        group.add(blade);
        // Дол (кровосток) — тёмная канавка по центру
        if (!isDagger) {
          const fuller = new THREE.Mesh(new THREE.BoxGeometry(bladeW * 0.22, bladeLen * 0.7, 0.032), darkSteel);
          fuller.position.set(0, handleLen + bladeLen * 0.42, 0);
          group.add(fuller);
          // Фаски вдоль кромок: две узкие полосы светлее клинка — «заточенное»
          // лезвие ловит блик иначе, чем плоскость.
          for (const side of [-1, 1]) {
            const bevel = new THREE.Mesh(new THREE.BoxGeometry(bladeW * 0.16, bladeLen * 0.82, 0.034), steel);
            bevel.position.set(side * bladeW * 0.3, handleLen + bladeLen * 0.45, 0);
            group.add(bevel);
          }
          // Пятка клинка: утолщение у гарды.
          const ricasso = new THREE.Mesh(new THREE.BoxGeometry(bladeW * 1.08, 0.05, 0.036), darkSteel);
          ricasso.position.set(0, handleLen + 0.03, 0);
          group.add(ricasso);
        }
        // Магическое свечение для редкого оружия
        if (rarity === 'legendary' || rarity === 'epic' || rarity === 'mythic') {
          const aura = new THREE.Mesh(
            new THREE.PlaneGeometry(bladeW * 1.9, bladeLen * 0.92),
            new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
          );
          aura.position.set(0, handleLen + bladeLen * 0.5, 0);
          group.add(aura);
          const l = new THREE.PointLight(glow, 0.9, 3.2, 2);
          l.position.set(0, handleLen + bladeLen * 0.5, 0);
          group.add(l);
        }
      }
    }
    group.userData.category = category;
    group.userData.length = group.userData.length || 1.1;
    return group;
  }
};

// ── Герой ────────────────────────────────────────────────────────────────
export class Hero3D {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();          // позиция в мире (ноги на земле)
    this.root.name = 'hero';
    scene.add(this.root);

    this.parts = {};
    this.state = 'idle';
    this.stateTime = 0;
    this.speed = 0;
    this.speedNorm = 0;
    this.attackPhase = 0;   // 0..1 во время удара
    this.attacking = false;
    this.blocking = false;
    this.airborne = false;
    this.hurtFlash = 0;

    this._build();
  }

  _build() {
    // Материалы берём из общей библиотеки: у кожи лица и ткани есть карты
    // нормалей, поэтому при движении камеры читаются поры и плетение, а не
    // «залитая» поверхность.
    const skin = createMaterial('skin', { repeat: 2 });
    const cloth = createMaterial('cloth', { repeat: 2 });
    const leather = createMaterial('leather', { repeat: 1 });
    const chain = new THREE.MeshStandardMaterial({ color: 0x6d727c, metalness: 0.85, roughness: 0.42 });
    const hairMat = createMaterial('fur', { repeat: 2 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xb08b3a, metalness: 0.95, roughness: 0.28 });
    this.materials = { skin, cloth, leather, chain, hairMat, gold: goldMat };

    // Тазобедренный узел — корень анимации
    const hips = new THREE.Group();
    hips.position.y = 0.92;
    this.root.add(hips);
    this.parts.hips = hips;

    const torso = new THREE.Group();
    torso.position.y = 0.04;
    hips.add(torso);
    this.parts.torso = torso;

    // Таз: мягкая ткань + широкий кожаный ремень с пряжкой
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.23), cloth);
    pelvis.position.y = 0.02;
    pelvis.castShadow = true;
    torso.add(pelvis);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.345, 0.075, 0.25), leather);
    belt.position.y = 0.105;
    belt.castShadow = true;
    torso.add(belt);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.03), new THREE.MeshStandardMaterial({ color: 0xb08b3a, metalness: 0.95, roughness: 0.28 }));
    buckle.position.set(0, 0.105, 0.13);
    torso.add(buckle);
    // Подсумок на бедре и петля — снаряжение, а не «голый» ремень.
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.07), leather);
    pouch.position.set(-0.17, 0.02, 0.09);
    pouch.rotation.y = 0.25;
    torso.add(pouch);
    const pouchFlap = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.05, 0.075), leather);
    pouchFlap.position.set(-0.17, 0.075, 0.09);
    pouchFlap.rotation.y = 0.25;
    torso.add(pouchFlap);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.007, 5, 10), goldMat);
    ring.position.set(0.185, 0.06, 0.06);
    ring.rotation.y = Math.PI / 2;
    torso.add(ring);

    // Грудная клетка (сужение к талии — анатомия, а не куб)
    const chestGeo = new THREE.CylinderGeometry(0.255, 0.195, 0.52, 12, 2);
    chestGeo.scale(1, 1, 0.7);
    const chest = new THREE.Mesh(chestGeo, this.materials.chain);
    chest.position.y = 0.34;
    chest.castShadow = true;
    chest.receiveShadow = true;
    torso.add(chest);
    this.parts.chest = chest;

    // Нагрудник (сменная экипировка)
    const plateGeo = new THREE.CylinderGeometry(0.285, 0.235, 0.46, 10, 1, true, -1.2, 2.4);
    const armorPlate = new THREE.Mesh(plateGeo, new THREE.MeshStandardMaterial({ color: 0x8a9099, metalness: 0.92, roughness: 0.3 }));
    armorPlate.position.y = 0.34;
    armorPlate.scale.z = 0.78;
    torso.add(armorPlate);
    this.parts.armor = armorPlate;

    // Клёпки по краю нагрудника: мелкая деталь, но именно она читается как
    // «сделанная вещь» на близкой дистанции.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 5), goldMat);
        rivet.position.set(side * (0.20 - i * 0.012), 0.14 + i * 0.11, 0.185 - i * 0.012);
        torso.add(rivet);
      }
    }
    // Центральное ребро жёсткости и кожаный ремень через грудь.
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.44, 0.02), chain);
    ridge.position.set(0, 0.34, 0.196);
    torso.add(ridge);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.5, 0.02), leather);
    strap.position.set(0.10, 0.32, 0.185);
    strap.rotation.z = 0.42;
    torso.add(strap);

    // Плечи
    for (const side of [-1, 1]) {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 9, 0, TAU, 0, Math.PI / 1.75), chain);
      pad.position.set(side * 0.255, 0.545, 0);
      pad.scale.set(1.05, 0.8, 0.95);
      pad.castShadow = true;
      torso.add(pad);
      // Вторая, меньшая пластина поверх — «доспех из сегментов».
      const pad2 = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8, 0, TAU, 0, Math.PI / 2), chain);
      pad2.position.set(side * 0.285, 0.575, 0);
      pad2.scale.set(1, 0.7, 1);
      pad2.rotation.z = side * -0.3;
      torso.add(pad2);
      if (side === 1) this.parts.shoulderR = pad;
      else this.parts.shoulderL = pad;
    }

    // Шея и голова
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.11, 8), skin);
    neck.position.y = 0.64;
    torso.add(neck);

    const head = new THREE.Group();
    head.position.y = 0.76;
    torso.add(head);
    this.parts.head = head;

    const skullGeo = new THREE.SphereGeometry(0.155, 18, 14);
    skullGeo.scale(0.92, 1.05, 0.95);
    const skull = new THREE.Mesh(skullGeo, skin);
    skull.castShadow = true;
    head.add(skull);

    // Глаза (тёмные, с лёгким бликом)
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1f2a, roughness: 0.25 });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), eyeMat);
      eye.position.set(side * 0.058, 0.018, 0.132);
      head.add(eye);
    }
    // Лицо: нос, надбровные дуги, губы, уши и скулы — чтобы в портретном
    // ракурсе (камера от третьего лица близко) силуэт был человеческим.
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.075, 6), skin);
    nose.position.set(0, -0.006, 0.152);
    nose.rotation.x = Math.PI / 2.15;
    head.add(nose);
    const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.021, 7, 6), skin);
    noseTip.position.set(0, -0.012, 0.183);
    head.add(noseTip);
    for (const side of [-1, 1]) {
      // Надбровная дуга
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.012, 0.02), hairMat);
      brow.position.set(side * 0.058, 0.052, 0.138);
      brow.rotation.z = side * 0.16;
      head.add(brow);
      // Скула
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.043, 8, 6), skin);
      cheek.position.set(side * 0.088, -0.018, 0.108);
      cheek.scale.set(1, 0.8, 0.62);
      head.add(cheek);
      // Ухо: раковина и мочка
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), skin);
      ear.position.set(side * 0.145, 0.004, 0.006);
      ear.scale.set(0.42, 1.15, 0.78);
      head.add(ear);
      const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 5), skin);
      lobe.position.set(side * 0.145, -0.03, 0.008);
      head.add(lobe);
    }
    // Губы: верхняя и нижняя, слегка приоткрыты
    const lipMat = new THREE.MeshStandardMaterial({ color: 0x9c5c4e, roughness: 0.6 });
    const lipU = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.012, 0.014), lipMat);
    lipU.position.set(0, -0.062, 0.146);
    head.add(lipU);
    const lipL = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.014, 0.014), lipMat);
    lipL.position.set(0, -0.078, 0.144);
    head.add(lipL);
    // Подбородок
    const chin = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 6), skin);
    chin.position.set(0, -0.106, 0.118);
    chin.scale.set(1, 0.72, 0.7);
    head.add(chin);

    // Волосы: купол + пряди по бокам и сзади (силуэт не «шлем»)
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.162, 16, 12, 0, TAU, 0, Math.PI / 1.9), hairMat);
    hair.position.y = 0.012;
    hair.scale.set(0.96, 1.0, 0.98);
    head.add(hair);
    for (let i = 0; i < 7; i++) {
      const ang = Math.PI * (0.18 + (i / 6) * 0.64);
      const strand = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.10 + (i % 3) * 0.03, 5), hairMat);
      strand.position.set(Math.cos(ang) * 0.145, -0.02 - (i % 2) * 0.02, -Math.sin(ang) * 0.145);
      strand.rotation.x = 0.25;
      strand.rotation.z = Math.cos(ang) * 0.3;
      head.add(strand);
    }

    // Шлем (сменная экипировка, скрыт по умолчанию)
    const helmGeo = new THREE.SphereGeometry(0.178, 16, 12, 0, TAU, 0, Math.PI / 1.75);
    const helm = new THREE.Mesh(helmGeo, new THREE.MeshStandardMaterial({ color: 0x9aa2ad, metalness: 0.95, roughness: 0.28 }));
    helm.position.y = 0.02;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.1), new THREE.MeshStandardMaterial({ color: 0x6d757f, metalness: 0.95, roughness: 0.3 }));
    visor.position.set(0, 0.06, 0.12);
    helm.add(visor);
    helm.visible = false;
    head.add(helm);
    this.parts.helmet = helm;

    // Плащ (сзади, с сегментами — колышется при беге)
    const capeGeo = new THREE.PlaneGeometry(0.52, 0.95, 3, 6);
    const cape = new THREE.Mesh(capeGeo, new THREE.MeshStandardMaterial({ color: 0x5a1f24, roughness: 0.9, side: THREE.DoubleSide }));
    cape.position.set(0, -0.2, -0.17);
    cape.rotation.x = -0.06;
    cape.castShadow = true;
    torso.add(cape);
    this.parts.cape = cape;
    this.capeBase = cape.geometry.attributes.position.array.slice();

    // Руки (плечо → локоть → кисть)
    const armParts = {};
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.255, 0.5, 0);
      torso.add(shoulder);

      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.062, 0.34, 8), skin);
      upper.position.y = -0.17;
      upper.castShadow = true;
      shoulder.add(upper);

      const elbow = new THREE.Group();
      elbow.position.y = -0.34;
      shoulder.add(elbow);
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.05, 0.32, 8), skin);
      fore.position.y = -0.16;
      fore.castShadow = true;
      elbow.add(fore);
      // Наруч
      const bracer = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.058, 0.2, 8), leather);
      bracer.position.y = -0.22;
      elbow.add(bracer);

      const hand = new THREE.Group();
      hand.position.y = -0.33;
      elbow.add(hand);
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.1, 0.055), skin);
      hand.add(palm);
      // Пальцы: четыре фаланги + большой палец. При замахе кисть читается
      // как рука, а не как «бочонок».
      for (let f = 0; f < 4; f++) {
        const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.0115, 0.010, 0.062, 5), skin);
        finger.position.set((f - 1.5) * 0.021, -0.078, 0.004);
        finger.rotation.x = 0.12 + f * 0.02;
        hand.add(finger);
        const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.0125, 6, 5), skin);
        knuckle.position.set((f - 1.5) * 0.021, -0.05, 0.012);
        hand.add(knuckle);
      }
      const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.011, 0.055, 5), skin);
      thumb.position.set(side * 0.045, -0.028, 0.024);
      thumb.rotation.set(0.5, 0, side * -0.7);
      hand.add(thumb);

      armParts[side === 1 ? 'R' : 'L'] = { shoulder, elbow, hand };
    }
    this.parts.armR = armParts.R;
    this.parts.armL = armParts.L;

    // Ноги (бедро → колено → стопа)
    const legParts = {};
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.12, -0.06, 0);
      hips.add(hip);
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.072, 0.44, 10), cloth);
      thigh.position.y = -0.22;
      thigh.castShadow = true;
      hip.add(thigh);

      const knee = new THREE.Group();
      knee.position.y = -0.44;
      hip.add(knee);
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.056, 0.42, 10), cloth);
      shin.position.y = -0.21;
      shin.castShadow = true;
      knee.add(shin);
      // Поножи
      const greave = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.066, 0.3, 8), chain);
      greave.position.y = -0.2;
      knee.add(greave);

      const foot = new THREE.Group();
      foot.position.y = -0.42;
      knee.add(foot);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.26), leather);
      boot.position.set(0, -0.05, 0.05);
      boot.castShadow = true;
      foot.add(boot);
      // Подошва и каблук — обувь перестаёт быть «кирпичом».
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.028, 0.275), colorMaterial(0x1e1a16, { roughness: 0.95 }));
      sole.position.set(0, -0.104, 0.052);
      foot.add(sole);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.072, 0.06, 8), leather);
      cuff.position.set(0, 0.015, 0.01);
      foot.add(cuff);

      legParts[side === 1 ? 'R' : 'L'] = { hip, knee, foot };
    }
    this.parts.legR = legParts.R;
    this.parts.legL = legParts.L;

    // Точка крепления оружия в правой руке
    this.weaponAnchor = new THREE.Group();
    // Клинок направлен вперёд и вверх, чуть в сторону от бедра
    this.weaponAnchor.rotation.set(-Math.PI / 2.05, 0, -0.12);
    this.weaponAnchor.position.set(0.035, 0.01, 0.015);
    this.parts.armR.hand.add(this.weaponAnchor);
    this.weaponMesh = null;

    // Точка ауры (для эффектов ударов)
    this.hitPoint = new THREE.Object3D();
    this.hitPoint.position.set(0, 1.1, 0.6);
    this.root.add(this.hitPoint);

    // Фонарь героя (мягкий свет вокруг — видно ночью)
    this.lantern = new THREE.PointLight(0xffd9a8, 0.0, 9, 2);
    this.lantern.position.set(0, 1.5, 0.3);
    this.root.add(this.lantern);

    this.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    // Тень-пятно под героем (для читаемости на любом фоне). Без canvas
    // (headless-тесты) просто не создаём — остальная модель строится всегда.
    const shadowTex = this._makeBlobShadow();
    if (!shadowTex) { this.blobShadow = null; }
    else {
      const shadowPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 1.2),
        new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.45, depthWrite: false })
      );
      shadowPlane.rotation.x = -Math.PI / 2;
      shadowPlane.position.y = 0.02;
      this.root.add(shadowPlane);
      this.blobShadow = shadowPlane;
    }
    // Детализация добавила ~50 мелких мешей. Склеиваем статику по материалам:
    // 4–5 draw call на группу вместо десятков, вершины при этом остаются.
    this._mergeStaticParts();
  }

  // Склейка статических мешей внутри одного родителя с общим материалом.
  // Всё, что лежит в this.parts (анимируемые узлы и сменная экипировка),
  // не трогаем: к нему обращаются анимации и equipArmor/equipWeapon.
  _mergeStaticParts() {
    if (typeof mergeGeometries !== 'function') return;
    const animated = new Set();
    const collect = (v) => {
      if (!v) return;
      if (Array.isArray(v)) { v.forEach(collect); return; }
      if (v.isObject3D) animated.add(v);
    };
    Object.values(this.parts).forEach(collect);

    const buckets = new Map();
    this.root.traverse((o) => {
      if (!o.isMesh || !o.geometry || !o.material) return;
      if (animated.has(o) || o.userData.animated) return;
      if (o.material.transparent) return;
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

  _makeBlobShadow() {
    if (typeof document === 'undefined' || !document.createElement) return null;
    const size = 64;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    const grad = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(0,0,0,0.85)');
    grad.addColorStop(0.55, 'rgba(0,0,0,0.35)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(cv);
    return tex;
  }

  // ── Экипировка ─────────────────────────────────────────────────────────
  equipWeapon(weapon) {
    if (this.weaponMesh) {
      this.weaponAnchor.remove(this.weaponMesh);
      this.weaponMesh.traverse(o => { if (o.isMesh && o.material && o.material.dispose && o.material.userData?.disposable) o.material.dispose(); });
    }
    if (!weapon) { this.weaponMesh = null; return; }
    const mesh = Weapon3D.build(weapon.category || 'melee', weapon.rarity || 'common', 1);
    mesh.scale.setScalar(weapon.category === 'spear' ? 1.0 : 1.05);
    this.weaponAnchor.add(mesh);
    this.weaponMesh = mesh;
  }

  setHelmet(on, color = 0x9aa2ad) {
    this.parts.helmet.visible = !!on;
    if (on) this.parts.helmet.material.color.setHex(color);
  }

  setArmor(on, color = 0x8a9099) {
    this.parts.armor.visible = !!on;
    if (on) this.parts.armor.material.color.setHex(color);
  }

  setCapeGone(gone) { this.parts.cape.visible = !gone; }

  // ── Анимации ───────────────────────────────────────────────────────────
  // state: idle | walk | run | jump | attack | block | hurt | death
  setState(state) {
    if (this.state === state) return;
    const wasDeath = this.state === 'death';
    this.state = state;
    this.stateTime = 0;
    if (state === 'attack') { this.attacking = true; this.attackPhase = 0; }
    // Возрождение после смерти: убираем «лежачую» позу и возвращаем стойку
    if (wasDeath && state !== 'death') {
      this.root.rotation.x = 0;
      this.root.rotation.z = 0;
      this.deathTime = 0;
      if (typeof this.baseY === 'number') this.root.position.y = this.baseY;
    }
  }

  triggerAttack() {
    this.attacking = true;
    this.attackPhase = 0;
    this.state = 'attack';
    this.comboIndex = ((this.comboIndex || 0) + 1) % 3;
  }

  update(dt, opts = {}) {
    const { position, facing, speed = 0, maxSpeed = 6, airborne = false, blocking = false, dead = false } = opts;
    this.stateTime += dt;

    // Позиция: feet-on-ground. baseY — земля под героем (heightAt3D), сверху
    // добавляется высота прыжка. Раньше смерть «заваливала» root по X, и после
    // возрождения модель оставалась лежать — теперь наклон гасится, как только
    // состояние перестаёт быть death.
    if (position) {
      this.baseY = position.y;
      this.root.position.set(position.x, position.y, position.z);
      this.root.position.y += airborne ? (opts.jumpOffset || 0) : 0;
    }
    if (!dead && this.root.rotation.x !== 0) {
      this.root.rotation.x = damp(this.root.rotation.x, 0, 10, dt);
      if (Math.abs(this.root.rotation.x) < 0.002) this.root.rotation.x = 0;
    }
    if (typeof facing === 'number') {
      const target = facing;
      let cur = this.root.rotation.y;
      let d = target - cur;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      this.root.rotation.y = cur + d * Math.min(1, dt * 14);
    }

    this.speed = speed;
    this.speedNorm = Math.min(1, speed / Math.max(1, maxSpeed));
    this.blocking = blocking;
    this.airborne = airborne;

    if (dead) {
      this.setState('death');
    } else if (this.attacking) {
      this.setState('attack');
    } else if (airborne) {
      this.setState('jump');
    } else if (this.hurtFlash > 0) {
      this.setState('hurt');
    } else if (blocking) {
      this.setState('block');
    } else if (this.speedNorm > 0.62) {
      this.setState('run');
    } else if (this.speedNorm > 0.05) {
      this.setState('walk');
    } else {
      this.setState('idle');
    }

    this._animate(dt, airborne);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
  }

  _animate(dt, airborne) {
    const p = this.parts;
    const t = this.stateTime;
    const run = this.speedNorm;
    const walkCycle = t * (6.5 + run * 5.5);
    const swing = Math.sin(walkCycle) * (0.28 + run * 0.55);
    const swingCos = Math.cos(walkCycle) * (0.28 + run * 0.55);

    // Базовые позы
    let hipY = 0, hipTilt = 0, torsoTilt = 0, headTilt = 0;
    let legRSwing = 0, legLSwing = 0, kneeR = 0, kneeL = 0;
    let armRSwing = 0, armLSwing = 0, elbowR = -0.25, elbowL = -0.25;
    let shoulderLift = 0;

    if (this.state === 'walk' || this.state === 'run') {
      legRSwing = swing * 1.1;
      legLSwing = -swing * 1.1;
      kneeR = Math.max(0, -swingCos) * 1.1 + run * 0.22;
      kneeL = Math.max(0, swingCos) * 1.1 + run * 0.22;
      armRSwing = -swing * 0.85;
      armLSwing = swing * 0.85;
      elbowR = -0.35 - run * 0.55;
      elbowL = -0.35 - run * 0.55;
      hipY = Math.abs(Math.sin(walkCycle)) * (0.02 + run * 0.05) - run * 0.02;
      hipTilt = Math.sin(walkCycle * 2) * 0.03 * run;
      torsoTilt = 0.06 + run * 0.16;
      headTilt = -torsoTilt * 0.6;
    } else if (this.state === 'idle') {
      const breathe = Math.sin(t * 1.8) * 0.5 + 0.5;
      hipY = breathe * 0.012;
      torsoTilt = 0.02 + breathe * 0.015;
      armRSwing = Math.sin(t * 1.4) * 0.03;
      armLSwing = -Math.sin(t * 1.4) * 0.03;
      elbowR = -0.28;
      elbowL = -0.28;
      kneeR = kneeL = 0.06;
    } else if (this.state === 'jump') {
      legRSwing = -0.55;
      legLSwing = 0.35;
      kneeR = 0.95;
      kneeL = 0.55;
      armRSwing = -0.7;
      armLSwing = 0.5;
      elbowR = -0.9;
      elbowL = -0.6;
      torsoTilt = 0.18;
    } else if (this.state === 'block') {
      armRSwing = -0.5;
      armLSwing = -0.75;
      elbowR = -1.75;
      elbowL = -1.85;
      shoulderLift = 0.28;
      torsoTilt = 0.05;
      legRSwing = 0.16;
      legLSwing = -0.22;
      kneeR = 0.3;
      kneeL = 0.24;
      hipY = -0.05;
    } else if (this.state === 'hurt') {
      const k = Math.min(1, this.stateTime * 7);
      torsoTilt = -0.22 * (1 - k);
      headTilt = -0.3 * (1 - k);
      armRSwing = 0.3 * (1 - k);
      armLSwing = 0.3 * (1 - k);
      hipY = -0.04 * (1 - k);
    } else if (this.state === 'death') {
      const k = Math.min(1, this.stateTime * 2.2);
      this.root.rotation.x = -k * Math.PI * 0.48;
      if (typeof this.baseY === 'number') this.root.position.y = this.baseY - k * 0.1;
      hipY = -k * 0.25;
      torsoTilt = 0.3 * k;
      legRSwing = 0.5 * k;
      legLSwing = -0.3 * k;
      kneeR = 0.9 * k;
      kneeL = 0.7 * k;
      armRSwing = 0.5 * k;
      armLSwing = 0.6 * k;
    }

    // ── Атака: трёхударная комбинация (сверху, сбоку, выпад) ──
    if (this.state === 'attack') {
      this.attackPhase += dt * 2.9;
      if (this.attackPhase >= 1) {
        this.attackPhase = 1;
        this.attacking = false;
      }
      const ph = this.attackPhase;
      const combo = this.comboIndex || 0;
      // Кривая: замах (0-0.35), резкий удар (0.35-0.55), возврат (0.55-1)
      const windup = Math.min(1, ph / 0.35);
      const strike = ph < 0.35 ? 0 : Math.min(1, (ph - 0.35) / 0.2);
      const recover = ph < 0.55 ? 0 : Math.min(1, (ph - 0.55) / 0.45);
      const swingK = strike * (1 - recover);

      if (combo === 0) {
        // Вертикальный удар сверху
        armRSwing = -1.5 + windup * -0.5 + swingK * 3.2;
        elbowR = -1.2 + swingK * 0.7;
        torsoTilt = 0.05 + windup * 0.12 - swingK * 0.22;
        this.root.rotation.y += 0;
      } else if (combo === 1) {
        // Диагональный удар слева направо
        armRSwing = -1.7 + windup * -0.4 + swingK * 2.6;
        armRSwing *= 1.0;
        elbowR = -1.3 + swingK * 0.9;
        this.parts.torso.rotation.y = -0.5 * windup + swingK * 1.0;
        torsoTilt = 0.12 - swingK * 0.15;
      } else {
        // Колющий выпад
        armRSwing = -2.0 + windup * -0.3 + swingK * 2.4;
        elbowR = -1.5 + swingK * 1.4;
        torsoTilt = 0.1 + swingK * 0.25;
        hipY = -0.06 + swingK * 0.08;
      }
      // Левая рука балансирует
      armLSwing = 0.4 - swingK * 0.5;
      elbowL = -0.7;
      legRSwing = -0.28 + swingK * 0.36;
      legLSwing = 0.2 - swingK * 0.3;
      kneeR = 0.34;
      kneeL = 0.26;
    } else {
      // Плавный возврат торса после атаки
      this.parts.torso.rotation.y = damp(this.parts.torso.rotation.y, 0, 9, dt);
    }

    // ── Применение позы с плавным сглаживанием (нет дёрганья) ──
    const L = 16;
    p.hips.position.y = damp(p.hips.position.y, 0.92 + hipY, L, dt);
    p.hips.rotation.z = damp(p.hips.rotation.z, hipTilt, L, dt);
    p.torso.rotation.x = damp(p.torso.rotation.x, torsoTilt, L, dt);
    p.head.rotation.x = damp(p.head.rotation.x, headTilt, L, dt);
    p.head.rotation.y = damp(p.head.rotation.y, this.state === 'idle' ? Math.sin(t * 0.5) * 0.12 : 0, 6, dt);

    p.legR.hip.rotation.x = damp(p.legR.hip.rotation.x, legRSwing, L, dt);
    p.legL.hip.rotation.x = damp(p.legL.hip.rotation.x, legLSwing, L, dt);
    p.legR.knee.rotation.x = damp(p.legR.knee.rotation.x, -kneeR, L, dt);
    p.legL.knee.rotation.x = damp(p.legL.knee.rotation.x, -kneeL, L, dt);

    p.armR.shoulder.rotation.x = damp(p.armR.shoulder.rotation.x, armRSwing, L, dt);
    p.armL.shoulder.rotation.x = damp(p.armL.shoulder.rotation.x, armLSwing, L, dt);
    p.armR.shoulder.rotation.z = damp(p.armR.shoulder.rotation.z, -0.12 - shoulderLift, L, dt);
    p.armL.shoulder.rotation.z = damp(p.armL.shoulder.rotation.z, 0.12 + shoulderLift, L, dt);
    p.armR.elbow.rotation.x = damp(p.armR.elbow.rotation.x, elbowR, L, dt);
    p.armL.elbow.rotation.x = damp(p.armL.elbow.rotation.x, elbowL, L, dt);

    // Плащ колышется от скорости и ветра
    if (p.cape && this.capeBase) {
      const arr = p.cape.geometry.attributes.position.array;
      const wind = Math.sin(t * 3.1) * 0.035 + this.speedNorm * 0.09;
      for (let i = 0; i < arr.length; i += 3) {
        const baseY = this.capeBase[i + 1];
        const depth = (0.475 - baseY) / 0.95;          // 0 сверху, 1 снизу
        arr[i + 2] = this.capeBase[i + 2] - depth * (0.18 + wind * 3.2) - Math.sin(t * 7 + baseY * 9) * 0.02 * depth;
        arr[i] = this.capeBase[i] + Math.sin(t * 5 + baseY * 11) * 0.02 * depth;
      }
      p.cape.geometry.attributes.position.needsUpdate = true;
      p.cape.geometry.computeVertexNormals();
    }

    // Фонарь: включается ночью (движок ставит intensity)
    if (this.blobShadow) {
      this.blobShadow.position.y = airborne ? -this.root.position.y + 0.02 : 0.02;
      const s = airborne ? 0.7 : 1;
      this.blobShadow.scale.setScalar(s);
      this.blobShadow.material.opacity = airborne ? 0.22 : 0.42;
    }
  }

  setNightLight(intensity) {
    this.lantern.intensity = intensity;
  }

  dispose() {
    this.scene.remove(this.root);
  }
}
