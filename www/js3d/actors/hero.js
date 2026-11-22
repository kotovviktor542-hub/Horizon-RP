// VEXMORA 3D — герой: полноценная 3D-модель с иерархией костей,
// плавными процедурными анимациями (idle/walk/run/jump/attack/block/hurt/death)
// и сменной экипировкой: оружие в руке, шлем, нагрудник, плащ.

import * as THREE from 'three';
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
    const gold = new THREE.MeshStandardMaterial({ color: 0xd4a63a, metalness: 1, roughness: 0.22 });

    const isMagic = category === 'magic';
    const isBow = category === 'bow';
    const isAxe = category === 'axe';
    const isDagger = category === 'dagger';
    const isSpear = category === 'spear';

    if (isBow) {
      // Лук: дуга из сегментов + тетива
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.55, 0.0), new THREE.Vector3(0.12, 0.28, 0.22),
        new THREE.Vector3(0.16, 0, 0.3), new THREE.Vector3(0.12, -0.28, 0.22),
        new THREE.Vector3(0, -0.55, 0.0)
      ]);
      const limb = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.032, 7, false), createMaterial('bark', { repeat: 1 }));
      limb.castShadow = true;
      group.add(limb);
      const stringGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.55, 0), new THREE.Vector3(0, -0.55, 0)]);
      group.add(new THREE.Line(stringGeo, new THREE.LineBasicMaterial({ color: 0xe8e8ee })));
      group.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), gold));
    } else if (isMagic) {
      // Посох: древко, кристалл в оправе, свечение
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 1.25, 8), createMaterial('bark', { repeat: 1 }));
      shaft.position.y = 0.1;
      shaft.castShadow = true;
      group.add(shaft);
      const cradle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 6, 14), gold);
      cradle.position.y = 0.78;
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
    const skin = new THREE.MeshStandardMaterial({ color: 0xc79a72, roughness: 0.72, metalness: 0.02 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0x2b3340, roughness: 0.88 });
    const leather = createMaterial('leather', { repeat: 1 });
    const chain = new THREE.MeshStandardMaterial({ color: 0x6d727c, metalness: 0.85, roughness: 0.42 });
    this.materials = { skin, cloth, leather, chain };

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

    // Плечи
    for (const side of [-1, 1]) {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 9, 0, TAU, 0, Math.PI / 1.75), chain);
      pad.position.set(side * 0.255, 0.545, 0);
      pad.scale.set(1.05, 0.8, 0.95);
      pad.castShadow = true;
      torso.add(pad);
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
    // Волосы/капюшон
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.162, 16, 12, 0, TAU, 0, Math.PI / 1.9), colorMaterial(0x241a16, { roughness: 0.92 }));
    hair.position.y = 0.012;
    hair.scale.set(0.96, 1.0, 0.98);
    head.add(hair);

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

    // Тень-пятно под героем (для читаемости на любом фоне)
    const shadowTex = this._makeBlobShadow();
    if (!shadowTex) { this.blobShadow = null; return; }
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 1.2),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.45, depthWrite: false })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.02;
    this.root.add(shadowPlane);
    this.blobShadow = shadowPlane;

    this.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
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
    this.state = state;
    this.stateTime = 0;
    if (state === 'attack') { this.attacking = true; this.attackPhase = 0; }
    if (state === 'death') this.root.rotation.z = 0;
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

    // Позиция и поворот
    if (position) {
      this.root.position.set(position.x, position.y, position.z);
      this.root.position.y += airborne ? (opts.jumpOffset || 0) : 0;
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
      this.root.position.y = (this.root.userData.baseY || this.root.position.y) - k * 0.1;
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
