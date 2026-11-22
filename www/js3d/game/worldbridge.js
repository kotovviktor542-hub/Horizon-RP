// VEXMORA 3D — мост «движок ↔ 3D». Единственное место, где 2D-состояние игры
// превращается в 3D-сцену: синхронизация героя, врагов, боссов, снарядов,
// трофеев и эффектов; коллизии с рельефом; события ударов.

import * as THREE from 'three';
import { WORLD_SCALE, CHUNK_SIZE } from '../core/sky.js';
import { Hero3D } from '../actors/hero.js';
import { Creature3D } from '../actors/creatures.js';
import { WEAPONS, ENEMIES, BOSSES } from '../../js/data.js';
import { colorMaterial, emissiveMaterial } from '../core/materials.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const damp = (c, t, l, dt) => c + (t - c) * (1 - Math.exp(-l * dt));

// 2D-координаты движка → 3D (world units)
const to3 = (x, y, h = 0) => ({ x: x * WORLD_SCALE, z: y * WORLD_SCALE });

// Дальность отрисовки боссов (3D-метры). Боссы далеко за ней не рисуются,
// но логика движка продолжает их обрабатывать.
const BOSS_DRAW_RADIUS = 90;
// Дальность отрисовки обычных врагов (3D-метры)
const ENEMY_DRAW_RADIUS = 70;

export class World3D {
  constructor(engine, scene, terrain, effects, options = {}) {
    this.engine = engine;
    this.scene = scene;
    this.terrain = terrain;
    this.effects = effects;
    this.quality = options.quality || 'high';

    this.hero = new Hero3D(scene);
    this.heroRootY = 0;

    this.creatures = new Map();       // entity -> Creature3D
    this.projectileMeshes = new Map();
    this.dropMeshes = new Map();
    this.pickupGroup = new THREE.Group();
    this.pickupGroup.name = 'pickups';
    scene.add(this.pickupGroup);

    this.time = 0;
    this.heroFacing = 0;
    this.lastHeroPos = new THREE.Vector3();
    this.footstepTimer = 0;
    this.lastWeaponId = null;
    this.lastArmorId = null;
    this.lastHelmetKey = null;
    this.attackFlashTime = 0;
    this.hitMarkers = [];
    this._lastEnemyHp = new Map();
    this._lastBossHp = new Map();
    this._lastPlayerHp = engine.player.hp;

    // Источники света боссов
    this.bossLights = new Map();

    // Стрелы/снаряды: пул геометрий
    this.projGeo = {
      arrow: new THREE.CylinderGeometry(0.02, 0.02, 0.6, 5),
      bullet: new THREE.SphereGeometry(0.07, 7, 6),
      magic: new THREE.IcosahedronGeometry(0.13, 0),
      fire: new THREE.IcosahedronGeometry(0.16, 0)
    };
    this.projMat = {
      arrow: new THREE.MeshStandardMaterial({ color: 0xd8c9a8, roughness: 0.8 }),
      bullet: new THREE.MeshBasicMaterial({ color: 0xff6b6b }),
      magic: emissiveMaterial(0xa78bfa, 2.4, { transparent: true, opacity: 0.95 }),
      fire: emissiveMaterial(0xff8a3a, 2.6, { transparent: true, opacity: 0.95 })
    };

    this.syncWeapon(true);
    this.syncArmor(true);
  }

  // ── Экипировка героя ───────────────────────────────────────────────────
  syncWeapon(force = false) {
    const id = this.engine.inventory.equippedWeapon;
    if (!force && id === this.lastWeaponId) return;
    this.lastWeaponId = id;
    const def = WEAPONS[id];
    if (!def) return;
    // Категория оружия из данных игры: melee | bow | magic.
    // Внутри ближнего боя уточняем форму клинка по названию.
    let category = def.category || 'melee';
    const title = `${def.name} ${id}`.toLowerCase();
    if (category === 'melee') {
      if (/axe|топор|maul|крушитель|hammer|молот/.test(title)) category = 'axe';
      else if (/dagger|knife|кинжал|нож|scythe|коса/.test(title)) category = 'dagger';
      else if (/spear|копь|lance|пика/.test(title)) category = 'spear';
    }
    this.hero.equipWeapon({ category, rarity: def.rarity });
  }

  syncArmor(force = false) {
    const armorId = this.engine.equippedArmor;
    if (!force && armorId === this.lastArmorId) return;
    this.lastArmorId = armorId;
    if (armorId) {
      this.hero.setArmor(true, 0x9aa4b2);
      this.hero.setHelmet(true, 0xb0bac8);
      this.lastHelmetKey = armorId;
    } else {
      this.hero.setArmor(false);
      this.hero.setHelmet(false);
      this.lastHelmetKey = null;
    }
  }

  // ── Основное обновление ────────────────────────────────────────────────
  update(dt, camera3d) {
    this.time += dt;
    const e = this.engine;
    const p = e.player;

    this.syncWeapon();
    this.syncArmor();

    // ── Герой ──
    const hp = to3(p.x, p.y);
    const groundY = this.terrain.heightAt3D(hp.x, hp.z);
    const jumpOffset = (p.z || 0) * WORLD_SCALE;
    const speed2D = Math.hypot(p.vx || 0, p.vy || 0);
    const maxSpeed = Math.max(1, e.getMoveSpeed());

    // Направление взгляда: при атаке — на цель, иначе по движению
    let facing = p.facing || 0;
    if (speed2D < 5 && p.attackAnimTimer <= 0 && typeof this.heroFacing === 'number') facing = this.heroFacing;
    // Перевод угла 2D (в плоскости XY) в 3D-поворот вокруг Y
    const facing3D = Math.PI / 2 - facing;

    // Скорость в 3D-метрах в секунду: 2D-скорость * масштаб мира
    // Сглаженная позиция модели: логика игры двигает героя дискретными шагами
    // (2D-мир, 6400/40 единиц на клетку), и без интерполяции это выглядело как
    // рывки. Сглаживаем только визуальную позицию, физика остаётся точной.
    const vis = this._heroVis || (this._heroVis = { x: hp.x, y: groundY, z: hp.z });
    if (p.teleported || Math.hypot(hp.x - vis.x, hp.z - vis.z) > 30) {
      // Рывок (возрождение, телепорт, быстрый переход) — не догоняем плавно
      vis.x = hp.x; vis.y = groundY; vis.z = hp.z;
      p.teleported = false;
      this.heroFacing = undefined;
    } else {
      const k = 1 - Math.exp(-24 * dt);
      vis.x += (hp.x - vis.x) * k;
      vis.z += (hp.z - vis.z) * k;
      // По вертикали сглаживаем ТОЛЬКО землю: высоту прыжка hero.js добавляет сам
      vis.y += (groundY - vis.y) * (1 - Math.exp(-18 * dt));
    }

    this.hero.update(dt, {
      position: { x: vis.x, y: vis.y, z: vis.z },
      facing: facing3D,
      speed: speed2D * WORLD_SCALE,
      maxSpeed: maxSpeed * WORLD_SCALE,
      airborne: (p.z || 0) > 2,
      jumpOffset,
      blocking: !!p.blocking,
      dead: !!p.dead
    });
    this.heroFacing = facing;

    // Ночной фонарь
    const tod = e.timeOfDay;
    const nightFactor = (tod < 0.22 || tod > 0.78) ? 1 : (tod > 0.68 ? (tod - 0.68) / 0.1 : 0);
    this.hero.setNightLight(nightFactor * 1.6);

    // Пыль от шагов
    if (speed2D > 40 && !p.dead) {
      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        this.footstepTimer = p.sprinting ? 0.16 : 0.32;
        const terr = e.terrainAt(p.x, p.y);
        const kind = terr.water ? 'water' : (terr.biome === 'snow' ? 'snow' : 'ground');
        this.effects.footstep({ x: hp.x, y: groundY, z: hp.z }, kind);
      }
    }

    // ── Враги ──
    this._syncEnemies(dt);

    // ── Боссы ──
    this._syncBosses(dt);

    // ── Снаряды ──
    this._syncProjectiles(dt);

    // ── Трофеи ──
    this._syncDrops(dt);

    // ── Эффекты из 2D-движка (вспышки, слэши) ──
    this._syncEngineEffects(dt);

    // ── Урон герою ──
    if (p.hp < this._lastPlayerHp - 0.5) {
      this.effects.damageNumber({ x: hp.x, y: groundY, z: hp.z }, this._lastPlayerHp - p.hp, 'hit');
      this.effects.hit({ x: hp.x, y: groundY, z: hp.z }, { power: 0.7 });
    }
    this._lastPlayerHp = p.hp;
  }

  _syncEnemies(dt) {
    const e = this.engine;
    const p = e.player;
    const hp3 = to3(p.x, p.y);
    const alive = new Set();

    for (const enemy of e.enemies) {
      alive.add(enemy);
      let c = this.creatures.get(enemy);
      if (!c) {
        const def = ENEMIES[enemy.kind] || ENEMIES[enemy.sprite] || {
          id: enemy.kind, name: enemy.name, sprite: enemy.sprite
        };
        c = new Creature3D(this.scene, { ...def, id: enemy.kind }, { isBoss: false });
        c.root.userData.enemy = enemy;
        this.creatures.set(enemy, c);
      }

      const pos = to3(enemy.x, enemy.y);
      const gy = this.terrain.heightAt3D(pos.x, pos.z);
      const flying = enemy.flying ? 1.6 : 0;
      const prev = c._prevPos;
      let vel3 = 0;
      if (prev && dt > 0) {
        vel3 = Math.hypot(pos.x - prev.x, pos.z - prev.z) / dt;
      }
      c._prevPos = { x: pos.x, z: pos.z };
      // Дальние враги не рисуются: модель остаётся в сцене, но без draw call
      const radius = (this.drawDistance && (this.drawDistance.enemy ?? ENEMY_DRAW_RADIUS)) || ENEMY_DRAW_RADIUS;
      c.root.visible = (Math.hypot(pos.x - hp3.x, pos.z - hp3.z) < radius);
      const speed = Math.max(Math.hypot(enemy.vx || 0, enemy.vy || 0) * WORLD_SCALE, vel3);
      // 2D-угол (atan2(y, x)) → поворот вокруг оси Y в three.js
      const facing2D = Math.abs(speed) > 0.02
        ? Math.atan2((enemy.vy || 0), (enemy.vx || 0))
        : Math.atan2(p.y - enemy.y, p.x - enemy.x);
      c.update(dt, {
        position: { x: pos.x, y: gy + (enemy.z || 0) * WORLD_SCALE + flying, z: pos.z },
        facing: Math.PI / 2 - facing2D,
        speed,
        groundY: gy,
        attacking: enemy.attackCd > 0.25 && enemy.attackCd < 0.55
      });

      // Урон по врагу — вспышка + частицы
      const prevHp = this._lastEnemyHp.get(enemy);
      if (prevHp !== undefined && enemy.hp < prevHp) {
        c.flash();
        const dmg = prevHp - enemy.hp;
        this.effects.hit({ x: pos.x, y: gy + 1.0, z: pos.z }, { power: clamp(dmg / 40, 0.5, 2) });
        this.effects.damageNumber({ x: pos.x, y: gy, z: pos.z }, dmg, dmg > 60 ? 'crit' : 'hit');
      }
      this._lastEnemyHp.set(enemy, enemy.hp);
    }

    // Удалённые враги
    for (const [enemy, c] of this.creatures) {
      if (!alive.has(enemy)) {
        if (!c.dead) {
          c.startDeath();
          this.effects.hit(
            { x: c.root.position.x, y: c.root.position.y, z: c.root.position.z },
            { power: 1.2 }
          );
        }
        // Через секунду удаляем
        if (!c._removeAt) c._removeAt = this.time + 1.6;
        if (this.time >= c._removeAt) {
          c.dispose();
          this.creatures.delete(enemy);
          this._lastEnemyHp.delete(enemy);
        }
      }
    }
  }

  _syncBosses(dt) {
    const e = this.engine;
    const p = e.player;
    const hp3 = to3(p.x, p.y);
    this.bossCreatures = this.bossCreatures || new Map();
    const alive = new Set();

    for (const boss of e.bossEntities || []) {
      alive.add(boss);
      let c = this.bossCreatures.get(boss);
      if (!c) {
        const def = BOSSES[boss.kind] || BOSSES[boss.id] || {
          id: boss.kind, name: boss.name, isBoss: true
        };
        c = new Creature3D(this.scene, { ...def, id: boss.kind, isBoss: true }, { isBoss: true });
        c.root.userData.boss = boss;
        // Аура босса
        const light = new THREE.PointLight(0xff4d4d, 2.4, 18, 2);
        light.position.y = 3.2;
        c.root.add(light);
        this.bossLights.set(boss, light);
        this.bossCreatures.set(boss, c);
      }

      const pos = to3(boss.x, boss.y);
      const gy = this.terrain.heightAt3D(pos.x, pos.z);
      const prevB = c._prevPos;
      let velB = 0;
      if (prevB && dt > 0) velB = Math.hypot(pos.x - prevB.x, pos.z - prevB.z) / dt;
      c._prevPos = { x: pos.x, z: pos.z };
      const speed = Math.max(Math.hypot(boss.vx || 0, boss.vy || 0) * WORLD_SCALE, velB);
      const facing2D = Math.abs(speed) > 0.02
        ? Math.atan2(boss.vy || 0, boss.vx || 0)
        : Math.atan2(p.y - boss.y, p.x - boss.x);
      c.update(dt, {
        position: { x: pos.x, y: gy, z: pos.z },
        facing: Math.PI / 2 - facing2D,
        speed,
        groundY: gy,
        attacking: boss.attackCd > 0.2 && boss.attackCd < 0.7
      });

      // ── Дальность отрисовки боссов ──────────────────────────────────────
      // В мире 23 босса, и раньше все они висели в сцене постоянно — каждый со
      // своей моделью и PointLight. Ближайший мог быть в 170 м, но GPU честно
      // рисовал все 23. Дальше DRAW_RADIUS прячем модель и гасим ауру.
      const distM = Math.hypot(pos.x - hp3.x, pos.z - hp3.z);
      // Дальность по пресету: эконом экономит и на боссах
      const radius = (this.drawDistance && (this.drawDistance.boss ?? BOSS_DRAW_RADIUS)) || BOSS_DRAW_RADIUS;
      const visible = distM < radius;
      c.root.visible = visible;

      const light = this.bossLights.get(boss);
      if (light) {
        light.visible = visible;
        if (visible) {
          // Цвет ауры зависит от фазы
          const phaseColors = [0xff4d4d, 0xc084fc, 0x22d3ee];
          light.color.setHex(phaseColors[Math.min(2, (boss.phase || 1) - 1)]);
          light.intensity = 2.2 + Math.sin(this.time * 4) * 0.6;
        } else {
          light.intensity = 0;
        }
      }

      const prevHp = this._lastBossHp.get(boss);
      if (prevHp !== undefined && boss.hp < prevHp) {
        c.flash();
        const dmg = prevHp - boss.hp;
        this.effects.hit({ x: pos.x, y: gy + 2.2, z: pos.z }, { power: clamp(dmg / 90, 0.7, 2.4) });
        this.effects.damageNumber({ x: pos.x, y: gy + 1.5, z: pos.z }, dmg, dmg > 120 ? 'crit' : 'hit');
      }
      this._lastBossHp.set(boss, boss.hp);
    }

    for (const [boss, c] of this.bossCreatures) {
      if (!alive.has(boss)) {
        if (!c.dead) {
          c.startDeath();
          this.effects.impactRing(
            { x: c.root.position.x, y: c.root.position.y, z: c.root.position.z },
            6, 0xff8a3a
          );
        }
        if (!c._removeAt) c._removeAt = this.time + 2.4;
        if (this.time >= c._removeAt) {
          c.dispose();
          this.bossCreatures.delete(boss);
          this._lastBossHp.delete(boss);
          const l = this.bossLights.get(boss);
          if (l) { c.root.remove(l); this.bossLights.delete(boss); }
        }
      }
    }
  }

  _syncProjectiles(dt) {
    const alive = new Set();
    for (const pr of this.engine.projectiles || []) {
      alive.add(pr);
      let mesh = this.projectileMeshes.get(pr);
      if (!mesh) {
        let kind = 'arrow';
        if (pr.kind === 'bullet') kind = 'bullet';
        else if (pr.magic || pr.kind === 'magic') kind = 'magic';
        else if (pr.kind === 'fire' || pr.burn) kind = 'fire';
        mesh = new THREE.Mesh(this.projGeo[kind], this.projMat[kind]);
        mesh.castShadow = false;
        this.scene.add(mesh);
        this.projectileMeshes.set(pr, mesh);
      }
      const pos = to3(pr.x, pr.y);
      const gy = this.terrain.heightAt3D(pos.x, pos.z);
      mesh.position.set(pos.x, gy + 1.0, pos.z);
      // Ориентация по вектору скорости
      if (pr.vx !== undefined) {
        const ang = Math.atan2(pr.vy, pr.vx);
        mesh.rotation.set(0, Math.PI / 2 - ang, Math.PI / 2);
      }
      // Магические снаряды светятся
      if (pr.magic && Math.random() < dt * 20) {
        this.effects.magic.spawn(pos.x, gy + 1, pos.z, { life: 0.4, scale: 0.6, gravity: 0, drag: 1 });
      }
    }
    for (const [pr, mesh] of this.projectileMeshes) {
      if (!alive.has(pr)) {
        this.scene.remove(mesh);
        this.projectileMeshes.delete(pr);
      }
    }
  }

  _syncDrops(dt) {
    const alive = new Set();
    const playerPos = this.engine.player;
    for (const drop of this.engine.drops || []) {
      alive.add(drop);
      let mesh = this.dropMeshes.get(drop);
      if (!mesh) {
        mesh = this._makeDropMesh(drop);
        this.pickupGroup.add(mesh);
        this.dropMeshes.set(drop, mesh);
      }
      const pos = to3(drop.x, drop.y);
      const gy = this.terrain.heightAt3D(pos.x, pos.z);
      const bob = Math.sin(this.time * 3 + drop.x * 0.1) * 0.12;
      mesh.position.set(pos.x, gy + 0.5 + bob, pos.z);
      mesh.rotation.y += dt * 1.8;

      // Магнит к герою вблизи
      const dx = playerPos.x - drop.x;
      const dy = playerPos.y - drop.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 90 && dist > 1) {
        const pull = (1 - dist / 90) * 320 * dt;
        drop.x += (dx / dist) * pull;
        drop.y += (dy / dist) * pull;
      }
      // Пропадание
      const fade = drop.life !== undefined && drop.life < 8 ? Math.max(0.25, drop.life / 8) : 1;
      mesh.scale.setScalar(fade);
    }
    for (const [drop, mesh] of this.dropMeshes) {
      if (!alive.has(drop)) {
        this.pickupGroup.remove(mesh);
        mesh.traverse(o => { if (o.isMesh) { o.geometry?.dispose?.(); o.material?.dispose?.(); } });
        this.dropMeshes.delete(drop);
      }
    }
  }

  _makeDropMesh(drop) {
    const g = new THREE.Group();
    if (drop.kind === 'coin') {
      const mat = new THREE.MeshStandardMaterial({ color: 0xffc247, metalness: 1, roughness: 0.22, emissive: 0x6b4a00, emissiveIntensity: 0.5 });
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.035, 14), mat);
      coin.rotation.x = Math.PI / 2;
      g.add(coin);
    } else if (drop.kind === 'ammo') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.22), colorMaterial(0x4a5a3a, { roughness: 0.8 }));
      g.add(box);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.24), colorMaterial(0xc9a227, { metalness: 0.6 }));
      g.add(stripe);
    } else if (drop.kind === 'resource') {
      const colors = { wood: 0x7a5230, stone: 0x8a8f96, scrap: 0x9aa4b0, herb: 0x4a8a3a, crystal: 0x60d0ff };
      const c = colors[drop.resId] || 0x9aa4b0;
      const geo = drop.resId === 'crystal' ? new THREE.OctahedronGeometry(0.18, 0) : new THREE.BoxGeometry(0.24, 0.24, 0.24);
      const m = drop.resId === 'crystal'
        ? emissiveMaterial(c, 1.6, { transparent: true, opacity: 0.92 })
        : colorMaterial(c, { roughness: 0.85 });
      g.add(new THREE.Mesh(geo, m));
    } else {
      // Предмет: светящийся кристалл-контейнер
      const glow = new THREE.Mesh(new THREE.IcosahedronGeometry(0.19, 0), emissiveMaterial(0x8ab4ff, 1.8, { transparent: true, opacity: 0.92 }));
      g.add(glow);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.02, 5, 14), emissiveMaterial(0xffffff, 1.2));
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  // Реакция на 2D-эффекты движка: слэши, ударные волны, взрывы
  _syncEngineEffects(dt) {
    const e = this.engine;
    // Новые слэши
    this._seenSlashes = this._seenSlashes || new WeakSet();
    for (const sl of e.slashes || []) {
      if (this._seenSlashes.has(sl)) continue;
      this._seenSlashes.add(sl);
      const pos = to3(sl.x, sl.y);
      const gy = this.terrain.heightAt3D(pos.x, pos.z);
      const colorHex = this._parseColor(sl.color);
      if (sl.arc > 3) {
        this.effects.impactRing({ x: pos.x, y: gy, z: pos.z }, (sl.range || 100) * WORLD_SCALE, colorHex);
      } else {
        this.effects.slash.spawn(
          { x: pos.x, y: gy - 1.15, z: pos.z },
          Math.PI / 2 - (sl.angle || 0),
          { radius: (sl.range || 90) * WORLD_SCALE * 1.1, color: colorHex }
        );
      }
    }

    // Ударные волны → кольца на земле
    this._seenShock = this._seenShock || new WeakSet();
    for (const sw of e.shockwaves || []) {
      if (this._seenShock.has(sw)) continue;
      this._seenShock.add(sw);
      const pos = to3(sw.x, sw.y);
      const gy = this.terrain.heightAt3D(pos.x, pos.z);
      this.effects.impactRing({ x: pos.x, y: gy, z: pos.z }, (sw.maxRadius || 120) * WORLD_SCALE, this._parseColor(sw.color));
      if (!sw.friendly) this.effects.hit({ x: pos.x, y: gy, z: pos.z }, { power: 1.4, kind: 'magic' });
    }

    // Взрывы бочек/снарядов
    this._seenParticles = this._seenParticles || 0;
    const particles = e.particles || [];
    if (particles.length < this._seenParticles) this._seenParticles = 0;
    for (let i = this._seenParticles; i < particles.length; i++) {
      const pt = particles[i];
      const pos = to3(pt.x, pt.y);
      const gy = this.terrain.heightAt3D(pos.x, pos.z);
      this.effects.dustFX.spawn(pos.x, gy + 0.6, pos.z, {
        vx: (Math.random() - 0.5) * 2, vy: 1.5 + Math.random() * 2, vz: (Math.random() - 0.5) * 2,
        life: 0.7, scale: 0.8, gravity: -4
      });
    }
    this._seenParticles = particles.length;
  }

  _parseColor(str) {
    if (!str) return 0xffffff;
    if (typeof str === 'number') return str;
    const s = String(str).trim();
    if (s.startsWith('#')) return parseInt(s.slice(1), 16);
    return 0xffffff;
  }

  // Публичные события для внешних вызовов
  onPlayerAttack(heavy = false) {
    const p = this.engine.player;
    const pos = to3(p.x, p.y);
    const gy = this.terrain.heightAt3D(pos.x, pos.z);
    const facing3D = Math.PI / 2 - (p.facing || 0);
    const weapon = WEAPONS[this.engine.inventory.equippedWeapon];
    const isMagic = weapon?.category === 'magic' || weapon?.element;
    this.effects.slash.spawn(
      { x: pos.x, y: gy - 1.1, z: pos.z },
      facing3D,
      {
        radius: heavy ? 2.0 : 1.35,
        color: isMagic ? 0xa78bfa : 0xdfefff
      }
    );
    this.hero.triggerAttack();
    if (heavy) this.effects.impactRing({ x: pos.x, y: gy, z: pos.z }, 2.6, 0xffc46b);
  }

  onEnemyKilled(enemy) {
    const c = this.creatures.get(enemy);
    if (c) {
      c.root.position.y += 0.02;
    }
  }

  onPlayerHurt() {
    this.hero.hurtFlash = 1;
  }

  // Поиск ближайшего врага для автонаведения (3D-позиция)
  nearestEnemyDirection() {
    const e = this.engine;
    const p = e.player;
    let best = null, bestD = 620 * 620;
    const consider = (t) => {
      const d = (t.x - p.x) ** 2 + (t.y - p.y) ** 2;
      if (d < bestD) { bestD = d; best = t; }
    };
    (e.enemies || []).forEach(consider);
    (e.bossEntities || []).forEach(consider);
    if (!best) return null;
    return { x: best.x, y: best.y, angle: Math.atan2(best.y - p.y, best.x - p.x) };
  }

  dispose() {
    this.hero.dispose();
    for (const [, c] of this.creatures) c.dispose();
    this.creatures.clear();
    for (const [, c] of (this.bossCreatures || new Map())) c.dispose();
    (this.bossCreatures || new Map()).clear();
    for (const [, m] of this.projectileMeshes) this.scene.remove(m);
    this.projectileMeshes.clear();
    for (const [, m] of this.dropMeshes) this.scene.remove(m);
    this.dropMeshes.clear();
    this.scene.remove(this.pickupGroup);
  }
}
