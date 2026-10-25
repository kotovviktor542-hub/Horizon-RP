// Игровое ядро Horizon: Выживание (Пиксель-арт 2D Action-Survival RPG)
// Боевая система (8 видов оружия, патроны, гранаты, взрывные бочки),
// AABB-коллизии зданий, транспорт, бункеры с ключами, квесты, крафт и сохранения.

import {
  WORLD_CONFIG, RARITIES, BIOMES, CAMPFIRES, NPCS, WEAPONS,
  ITEMS, RESOURCES, RECIPES, SKILLS, ENEMIES, BOSSES, SECRETS, QUESTS, ACHIEVEMENTS
} from './data.js';
import { createWorld, dist2, getBiomeIdAt } from './world.js';

const SAVE_KEY = 'horizon_rp_save_v2';

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function randInt(min, max) {
  return Math.floor(randRange(min, max + 0.999));
}

export class GameEngine {
  constructor(sound) {
    this.sound = sound;
    this.world = createWorld(20261025);
    this.paused = false;

    this.settings = {
      quality: 'medium', // 'low' | 'medium' | 'high'
      sound: true,
      autoAim: true,
      showFps: false
    };

    this.resetState();
  }

  resetState() {
    this.timeOfDay = 0.30; // Солнечное утро на старте
    this.dayCount = 1;
    this.autosaveTimer = 0;
    this.spawnTimer = 1.0;
    this.waterSplashTimer = 0;

    this.player = {
      x: WORLD_CONFIG.spawnX,
      y: WORLD_CONFIG.spawnY,
      z: 0,
      vz: 0,
      vx: 0,
      vy: 0,
      radius: 14,
      facing: 0,
      facingDir: 'down', // 'down' | 'up' | 'left' | 'right'
      animState: 'idle', // 'idle' | 'walk' | 'run' | 'jump' | 'attack' | 'hurt'
      animTime: 0,
      sprinting: false,
      vehicleId: null,

      level: 1,
      xp: 0,
      xpNext: 100,
      statPoints: 0,
      skillPoints: 1,

      stats: {
        power: 1,
        vitality: 1,
        agility: 1,
        luck: 1
      },

      hp: 130,
      maxHp: 130,
      stamina: 100,
      maxStamina: 100,
      hunger: 100,
      maxHunger: 100,

      attackTimer: 0,
      attackAnimTimer: 0,
      hurtAnimTimer: 0,
      grenadeTimer: 0,
      dashTimer: 0,
      dashActive: 0,
      dashDirX: 1,
      dashDirY: 0,
      invulnTimer: 0,
      shieldBuffTimer: 0,
      foodRegenTimer: 0,
      comboCount: 0,
      comboTimer: 0,
      dead: false
    };

    this.inventory = {
      coins: 95,
      ammo: 54,
      backpackLevel: 0, // 0..4 (+вместимость боезапаса, +HP, +добыча)
      equippedWeapon: 'pistol',
      weapons: ['pistol', 'knife'],
      consumables: {
        medkit: 3,
        grenade: 2,
        food: 2,
        potion: 1,
        key: 1
      },
      resources: {
        wood: 2,
        stone: 1,
        scrap: 2,
        herb: 2
      }
    };

    this.weaponUpgrades = { pistol: 0, knife: 0 };

    this.skills = {
      slash_wave: { level: 1, cd: 0 },
      magic_nova: { level: 0, cd: 0 },
      adrenaline: { level: 0, cd: 0 }
    };

    this.unlockedCamps = ['camp_forest'];
    this.discoveredSecrets = [];
    this.lootedBuildings = [];
    this.defeatedBosses = [];
    this.unlockedAchievements = [];

    this.questIndex = 0;
    this.questProgress = {};

    this.stats = {
      totalKills: 0,
      biomeKills: { forest: 0, city: 0, desert: 0, mountains: 0 },
      resourcesGathered: 0,
      totalCrafted: 0,
      explosionsTriggered: 0,
      droveVehicle: 0,
      playTime: 0
    };

    this.enemies = [];
    this.bossEntities = [];
    this.projectiles = [];
    this.thrownGrenades = [];
    this.drops = [];
    this.particles = [];
    this.spriteEffects = []; // пиксельные спрайт-эффекты (explosion, muzzle, magic, hit, smoke, water)
    this.floatingTexts = [];
    this.slashes = [];
    this.shockwaves = [];
    this.toasts = [];

    this.camera = {
      x: this.player.x,
      y: this.player.y,
      shake: 0
    };

    this.recalcDerivedStats(true);
    this.spawnInitialBosses();
    this.populateInitialEnemies();
  }

  getMaxAmmo() {
    return 120 + (this.inventory.backpackLevel || 0) * 65;
  }

  getLootMultiplier() {
    return 1 + (this.inventory.backpackLevel || 0) * 0.15 + this.player.stats.luck * 0.04;
  }

  recalcDerivedStats(refill = false) {
    const p = this.player;
    const vit = p.stats.vitality;
    const agi = p.stats.agility;
    const bp = this.inventory.backpackLevel || 0;
    const prevMaxHp = p.maxHp || 130;
    p.maxHp = Math.round(112 + p.level * 16 + vit * 22 + bp * 25);
    p.maxStamina = Math.round(96 + agi * 8 + p.level * 2 + bp * 6);
    if (refill) {
      p.hp = p.maxHp;
      p.stamina = p.maxStamina;
    } else if (p.maxHp > prevMaxHp) {
      p.hp = Math.min(p.maxHp, p.hp + (p.maxHp - prevMaxHp));
    }
  }

  getMoveSpeed() {
    const p = this.player;
    if (p.vehicleId) {
      const v = this.world.vehicles.find(vh => vh.id === p.vehicleId);
      if (v) return v.maxSpeed;
    }
    let spd = 205 + p.stats.agility * 7;
    if (p.sprinting && p.stamina > 4) spd *= 1.28;
    if (p.shieldBuffTimer > 0) spd *= 1.20;
    if (p.hunger <= 5) spd *= 0.86;
    return spd;
  }

  getWeaponDamage(weaponId = this.inventory.equippedWeapon) {
    const w = WEAPONS[weaponId] || WEAPONS.knife;
    const upg = this.weaponUpgrades[weaponId] || 0;
    const p = this.player;
    const mult = (1 + upg * 0.18) * (1 + p.stats.power * 0.11 + (p.level - 1) * 0.05);
    return Math.round(w.baseDamage * mult);
  }

  getCritChance(weaponId = this.inventory.equippedWeapon) {
    const w = WEAPONS[weaponId] || WEAPONS.knife;
    return Math.min(0.68, 0.07 + this.player.stats.luck * 0.03 + (w.critBonus || 0));
  }

  hasSave() {
    try {
      return !!localStorage.getItem(SAVE_KEY);
    } catch {
      return false;
    }
  }

  saveGame(silent = false) {
    try {
      const payload = {
        v: 2,
        savedAt: Date.now(),
        timeOfDay: this.timeOfDay,
        dayCount: this.dayCount,
        settings: this.settings,
        player: {
          x: Math.round(this.player.x),
          y: Math.round(this.player.y),
          level: this.player.level,
          xp: this.player.xp,
          xpNext: this.player.xpNext,
          statPoints: this.player.statPoints,
          skillPoints: this.player.skillPoints,
          stats: this.player.stats,
          hp: Math.round(this.player.hp),
          stamina: Math.round(this.player.stamina),
          hunger: Math.round(this.player.hunger)
        },
        inventory: this.inventory,
        weaponUpgrades: this.weaponUpgrades,
        skills: {
          slash_wave: { level: this.skills.slash_wave.level },
          magic_nova: { level: this.skills.magic_nova.level },
          adrenaline: { level: this.skills.adrenaline.level }
        },
        unlockedCamps: this.unlockedCamps,
        discoveredSecrets: this.discoveredSecrets,
        lootedBuildings: this.lootedBuildings,
        defeatedBosses: this.defeatedBosses,
        unlockedAchievements: this.unlockedAchievements,
        questIndex: this.questIndex,
        questProgress: this.questProgress,
        stats: this.stats
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
      if (!silent) this.pushToast('💾 Прогресс сохранён', '#4ade80');
      return true;
    } catch {
      return false;
    }
  }

  loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || !data.player) return false;

      this.resetState();
      this.timeOfDay = data.timeOfDay ?? 0.30;
      this.dayCount = data.dayCount ?? 1;
      if (data.settings) Object.assign(this.settings, data.settings);

      Object.assign(this.player, data.player);
      this.player.z = 0;
      this.player.vz = 0;
      this.player.dead = false;
      this.player.vehicleId = null;

      if (data.inventory) {
        this.inventory = {
          coins: data.inventory.coins ?? 95,
          ammo: data.inventory.ammo ?? 54,
          backpackLevel: data.inventory.backpackLevel ?? 0,
          equippedWeapon: WEAPONS[data.inventory.equippedWeapon] ? data.inventory.equippedWeapon : 'pistol',
          weapons: Array.isArray(data.inventory.weapons) && data.inventory.weapons.length
            ? data.inventory.weapons.filter(w => !!WEAPONS[w])
            : ['pistol', 'knife'],
          consumables: Object.assign({ medkit: 2, grenade: 2, food: 2, potion: 1, key: 1 }, data.inventory.consumables || {}),
          resources: Object.assign({ wood: 0, stone: 0, scrap: 0, herb: 0 }, data.inventory.resources || {})
        };
      }
      if (!this.inventory.weapons.includes('knife')) this.inventory.weapons.push('knife');

      if (data.weaponUpgrades) Object.assign(this.weaponUpgrades, data.weaponUpgrades);
      if (data.skills) {
        for (const k of Object.keys(this.skills)) {
          if (data.skills[k]) this.skills[k].level = data.skills[k].level || 0;
        }
      }
      this.unlockedCamps = data.unlockedCamps || ['camp_forest'];
      this.discoveredSecrets = data.discoveredSecrets || [];
      this.lootedBuildings = data.lootedBuildings || [];
      for (const b of this.world.buildings) {
        if (this.lootedBuildings.includes(b.id)) b.looted = true;
      }
      this.defeatedBosses = data.defeatedBosses || [];
      this.unlockedAchievements = data.unlockedAchievements || [];
      this.questIndex = data.questIndex ?? 0;
      this.questProgress = data.questProgress || {};
      if (data.stats) Object.assign(this.stats, data.stats);

      this.recalcDerivedStats(false);
      this.player.hp = clamp(this.player.hp, 25, this.player.maxHp);
      this.camera.x = this.player.x;
      this.camera.y = this.player.y;

      this.bossEntities = [];
      this.spawnInitialBosses();
      return true;
    } catch {
      return false;
    }
  }

  spawnInitialBosses() {
    this.bossEntities = [];
    for (const b of Object.values(BOSSES)) {
      if (this.defeatedBosses.includes(b.id)) continue;
      this.bossEntities.push({
        isBoss: true,
        bossId: b.id,
        name: b.name,
        title: b.title,
        biome: b.biome,
        sprite: 'boss',
        x: b.x,
        y: b.y,
        homeX: b.x,
        homeY: b.y,
        z: 0,
        vz: 0,
        vx: 0,
        vy: 0,
        radius: b.radius,
        arenaRadius: b.arenaRadius,
        hp: b.hp,
        maxHp: b.hp,
        damage: b.damage,
        speed: b.speed,
        xp: b.xp,
        coins: b.coins,
        rewardWeapon: b.rewardWeapon,
        rewardItems: b.rewardItems || [],
        actionTimer: 2.2,
        phase: 1,
        stunTimer: 0,
        hitFlash: 0,
        animTime: 0,
        dashActive: 0,
        dashVx: 0,
        dashVy: 0
      });
    }
  }

  populateInitialEnemies() {
    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * Math.PI * 2;
      const dist = randRange(440, 1150);
      const sx = clamp(this.player.x + Math.cos(ang) * dist, 180, this.world.width - 180);
      const sy = clamp(this.player.y + Math.sin(ang) * dist, 180, this.world.height - 180);
      this.spawnEnemyAt(sx, sy);
    }
  }

  spawnEnemyAt(x, y, forcedKind = null) {
    for (const c of CAMPFIRES) {
      if (dist2(x, y, c.x, c.y) < 250 * 250) return null;
    }
    const biomeId = getBiomeIdAt(x, y);
    const pool = BIOMES[biomeId].enemies;
    const isNight = this.isNightTime();
    let kind = forcedKind || pool[Math.floor(Math.random() * pool.length)];
    if (!forcedKind && isNight && biomeId === 'forest' && Math.random() < 0.35) {
      kind = 'infected_runner';
    }
    const tpl = ENEMIES[kind] || ENEMIES.zombie;
    const nightBoost = isNight ? 1.15 : 1.0;

    const e = {
      id: `en_${Math.random().toString(36).slice(2, 9)}`,
      kind,
      sprite: tpl.sprite,
      name: tpl.name,
      biome: biomeId,
      x,
      y,
      z: 0,
      vz: 0,
      vx: 0,
      vy: 0,
      radius: tpl.radius,
      hp: Math.round(tpl.hp * nightBoost),
      maxHp: Math.round(tpl.hp * nightBoost),
      damage: Math.round(tpl.damage * nightBoost),
      speed: tpl.speed,
      behavior: tpl.behavior,
      attackRange: tpl.attackRange || 44,
      projSpeed: tpl.projSpeed || 420,
      xp: Math.round(tpl.xp * (isNight ? 1.25 : 1)),
      coins: tpl.coins,
      drops: tpl.drops || [],
      attackCd: randRange(0.4, 1.3),
      burstLeft: 0,
      burstTimer: 0,
      wanderAngle: Math.random() * Math.PI * 2,
      wanderTimer: randRange(1, 3),
      stunTimer: 0,
      hitFlash: 0,
      animTime: Math.random() * 5
    };
    this.enemies.push(e);
    return e;
  }

  isNightTime() {
    return this.timeOfDay < 0.20 || this.timeOfDay > 0.80;
  }

  spawnSpriteEffect(kind, x, y, scale = 1.0, fps = 16) {
    const cap = this.settings.quality === 'low' ? 18 : 42;
    if (this.spriteEffects.length >= cap) this.spriteEffects.shift();
    const framesMap = { explosion: 6, muzzle: 4, magic: 6, hit: 4, smoke: 5, water: 4 };
    this.spriteEffects.push({
      kind,
      x,
      y,
      scale,
      frame: 0,
      totalFrames: framesMap[kind] || 4,
      fps,
      age: 0
    });
  }

  // ── Главный цикл обновления ──────────────────────────────────────────
  update(dt, inputState) {
    if (this.paused) return;
    dt = Math.min(dt, 0.05);

    this.stats.playTime += dt;
    this.autosaveTimer += dt;
    if (this.autosaveTimer >= 20) {
      this.autosaveTimer = 0;
      this.saveGame(true);
    }

    // Суточный цикл (полные сутки ~ 4 минуты)
    const prevDay = this.timeOfDay;
    this.timeOfDay = (this.timeOfDay + dt / 240) % 1;
    if (this.timeOfDay < prevDay) this.dayCount++;

    // Потребление сытости и пассивная регенерация
    const p = this.player;
    if (!p.dead) {
      p.hunger = Math.max(0, p.hunger - dt * 0.26);
      if (p.hunger > 65 && p.hp < p.maxHp) {
        p.hp = Math.min(p.maxHp, p.hp + dt * (1.6 + p.stats.vitality * 0.35));
      }
      if (p.foodRegenTimer > 0) {
        p.foodRegenTimer -= dt;
        p.hp = Math.min(p.maxHp, p.hp + dt * 7);
      }
    }

    // Дым из трубы Завода в Пустыне
    if (Math.random() < dt * 2.2) {
      for (const bld of this.world.buildings) {
        if (bld.smokes && dist2(p.x, p.y, bld.x, bld.y) < 950 * 950) {
          this.spawnSpriteEffect('smoke', bld.x + 28, bld.y - bld.spriteH + 8, 1.1, 8);
        }
      }
    }

    this.updatePlayer(dt, inputState);
    this.updateVehicles(dt);
    this.updateNodes(dt);
    this.updateEnemies(dt);
    this.updateBosses(dt);
    this.updateProjectiles(dt);
    this.updateThrownGrenades(dt);
    this.updateDrops(dt);
    this.updateEffects(dt);
    this.checkWorldInteractions();

    // Поддержание живой плотности врагов вокруг героя
    this.spawnTimer -= dt;
    const maxEnemies = this.settings.quality === 'low' ? 24 : 36;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 1.9;
      this.enemies = this.enemies.filter(e => dist2(e.x, e.y, p.x, p.y) < 1750 * 1750);
      if (this.enemies.length < maxEnemies) {
        const ang = Math.random() * Math.PI * 2;
        const dist = randRange(540, 960);
        const sx = clamp(p.x + Math.cos(ang) * dist, 150, this.world.width - 150);
        const sy = clamp(p.y + Math.sin(ang) * dist, 150, this.world.height - 150);
        this.spawnEnemyAt(sx, sy);
      }
    }

    // Плавная камера без размытия пикселей
    this.camera.x += (p.x - this.camera.x) * Math.min(1, dt * 11);
    this.camera.y += (p.y - this.camera.y) * Math.min(1, dt * 11);
    if (this.camera.shake > 0) {
      this.camera.shake = Math.max(0, this.camera.shake - dt * 28);
    }
  }

  updateFacingFromAngle(angle) {
    const p = this.player;
    p.facing = angle;
    const ax = Math.cos(angle);
    const ay = Math.sin(angle);
    if (Math.abs(ax) > Math.abs(ay)) {
      p.facingDir = ax >= 0 ? 'right' : 'left';
    } else {
      p.facingDir = ay >= 0 ? 'down' : 'up';
    }
  }

  updatePlayer(dt, input) {
    const p = this.player;
    if (p.dead) return;

    p.attackTimer = Math.max(0, p.attackTimer - dt);
    p.attackAnimTimer = Math.max(0, p.attackAnimTimer - dt);
    p.hurtAnimTimer = Math.max(0, p.hurtAnimTimer - dt);
    p.grenadeTimer = Math.max(0, p.grenadeTimer - dt);
    p.dashTimer = Math.max(0, p.dashTimer - dt);
    p.invulnTimer = Math.max(0, p.invulnTimer - dt);
    p.shieldBuffTimer = Math.max(0, p.shieldBuffTimer - dt);

    if (p.comboTimer > 0) {
      p.comboTimer -= dt;
      if (p.comboTimer <= 0) p.comboCount = 0;
    }

    for (const sk of Object.values(this.skills)) {
      if (sk.cd > 0) sk.cd = Math.max(0, sk.cd - dt);
    }

    // Спринт (Shift или полный наклон мобильного джойстика > 94%)
    const moveX = input?.moveX || 0;
    const moveY = input?.moveY || 0;
    const mag = Math.hypot(moveX, moveY);
    const wantsSprint = !!input?.sprintHeld;
    p.sprinting = wantsSprint && mag > 0.2 && !p.vehicleId && p.stamina > 6;

    if (p.sprinting) {
      p.stamina = Math.max(0, p.stamina - dt * 11);
    } else {
      const stamRegen = (24 + p.stats.agility * 2.5) * (p.hunger > 30 ? 1 : 0.72);
      p.stamina = Math.min(p.maxStamina, p.stamina + stamRegen * dt);
    }

    // Прыжок по оси Z
    if (p.z > 0 || p.vz !== 0) {
      p.z += p.vz * dt;
      p.vz -= 980 * dt;
      if (p.z <= 0) {
        p.z = 0;
        p.vz = 0;
        this.spawnDust(p.x, p.y, '#cbd5e1', 5);
      }
    }

    // Перемещение (пешком, рывок или за рулём транспорта!)
    if (p.vehicleId) {
      const veh = this.world.vehicles.find(v => v.id === p.vehicleId);
      if (!veh) {
        p.vehicleId = null;
      } else {
        if (mag > 0.06) {
          const nx = moveX / mag;
          const ny = moveY / mag;
          veh.vx = nx * veh.maxSpeed;
          veh.vy = ny * veh.maxSpeed;
          veh.angle = Math.atan2(ny, nx);
          this.updateFacingFromAngle(veh.angle);
          if (Math.random() < dt * 9) {
            this.spawnSpriteEffect('smoke', veh.x - nx * 20, veh.y - ny * 12, 0.7, 14);
          }
        } else {
          veh.vx *= 0.84;
          veh.vy *= 0.84;
        }
        veh.x = clamp(veh.x + veh.vx * dt, 64, this.world.width - 64);
        veh.y = clamp(veh.y + veh.vy * dt, 64, this.world.height - 64);
        this.resolveEntityObstacles(veh, false);
        p.x = veh.x;
        p.y = veh.y;

        // Таран врагов на скорости!
        const speedNow = Math.hypot(veh.vx, veh.vy);
        if (speedNow > 180) {
          for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (dist2(veh.x, veh.y, e.x, e.y) < (veh.radius + e.radius + 4) ** 2 && e.stunTimer <= 0) {
              e.stunTimer = 0.7;
              e.vx = (veh.vx / speedNow) * 320;
              e.vy = (veh.vy / speedNow) * 320;
              this.damageEnemy(e, 34 + p.level * 4, true, '#fbbf24');
            }
          }
        }
      }
    } else if (p.dashActive > 0) {
      p.dashActive -= dt;
      const dashSpeed = 540;
      p.vx = p.dashDirX * dashSpeed;
      p.vy = p.dashDirY * dashSpeed;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      this.resolveEntityObstacles(p, p.z > 14);
    } else {
      if (mag > 0.05) {
        const spd = this.getMoveSpeed() * Math.min(1, mag);
        const nx = moveX / mag;
        const ny = moveY / mag;
        p.vx = nx * spd;
        p.vy = ny * spd;
        if (p.attackAnimTimer <= 0) {
          this.updateFacingFromAngle(Math.atan2(ny, nx));
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        this.resolveEntityObstacles(p, p.z > 14);
        if (p.sprinting && p.z === 0 && Math.random() < dt * 8) {
          this.spawnDust(p.x, p.y + 8, '#cbd5e1', 2);
        }
      } else {
        p.vx = 0;
        p.vy = 0;
      }
    }

    p.x = clamp(p.x, 48, this.world.width - 48);
    p.y = clamp(p.y, 48, this.world.height - 48);

    // Водная преграда вокруг Острова Контрабандистов
    if (p.z <= 8 && !p.vehicleId) {
      for (const hz of this.world.hazards) {
        const d2 = dist2(p.x, p.y, hz.x, hz.y);
        if (d2 > hz.innerRadius * hz.innerRadius && d2 < hz.outerRadius * hz.outerRadius) {
          let onStone = false;
          for (const st of this.world.steppingStones) {
            if (dist2(p.x, p.y, st.x, st.y) <= (st.radius + 10) ** 2) {
              onStone = true;
              break;
            }
          }
          if (!onStone) {
            // Глубокая вода отталкивает на берег и показывает анимацию брызг воды!
            const ang = Math.atan2(p.y - hz.y, p.x - hz.x);
            const mid = (hz.innerRadius + hz.outerRadius) * 0.5;
            const d = Math.sqrt(d2);
            const targetR = d < mid ? hz.innerRadius - 6 : hz.outerRadius + 6;
            p.x = hz.x + Math.cos(ang) * targetR;
            p.y = hz.y + Math.sin(ang) * targetR;
            this.waterSplashTimer -= dt;
            if (this.waterSplashTimer <= 0) {
              this.waterSplashTimer = 0.35;
              this.spawnSpriteEffect('water', p.x, p.y, 1.15, 12);
              this.pushToast('💧 Глубокая река! Перепрыгни по каменным плитам (ПРЫЖОК)', '#38bdf8');
            }
          }
        }
      }
    }

    // Состояние анимации героя для hero_sheet.png
    const moving = Math.hypot(p.vx, p.vy) > 12;
    if (p.hurtAnimTimer > 0) {
      p.animState = 'hurt';
    } else if (p.z > 4) {
      p.animState = 'jump';
    } else if (p.attackAnimTimer > 0) {
      p.animState = 'attack';
    } else if (moving && p.sprinting) {
      p.animState = 'run';
    } else if (moving) {
      p.animState = 'walk';
    } else {
      p.animState = 'idle';
    }
    p.animTime += dt * (p.sprinting ? 12 : 8.5);

    if (input?.attackHeld && !p.vehicleId) {
      this.performAttack();
    }
  }

  updateVehicles(dt) {
    for (const v of this.world.vehicles) {
      if (this.player.vehicleId === v.id) continue;
      v.vx *= Math.pow(0.05, dt);
      v.vy *= Math.pow(0.05, dt);
      if (Math.hypot(v.vx, v.vy) > 4) {
        v.x = clamp(v.x + v.vx * dt, 64, this.world.width - 64);
        v.y = clamp(v.y + v.vy * dt, 64, this.world.height - 64);
      }
    }
  }

  // Точные коллизии сущности со зданиями (AABB), пропами и деревьями/ящиками
  resolveEntityObstacles(ent, jumping = false) {
    // 1. Прямоугольные здания (даже в прыжке здания нельзя перелететь насквозь)
    for (const bld of this.world.buildings) {
      const halfW = bld.colW * 0.5;
      const halfH = bld.colH * 0.5;
      const rectCx = bld.x;
      const rectCy = bld.y - halfH;
      const dx = ent.x - rectCx;
      const dy = ent.y - rectCy;
      const nearX = clamp(dx, -halfW, halfW);
      const nearY = clamp(dy, -halfH, halfH);
      const distX = dx - nearX;
      const distY = dy - nearY;
      const d2 = distX * distX + distY * distY;
      if (d2 < ent.radius * ent.radius) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const overlap = ent.radius - d;
          ent.x += (distX / d) * overlap;
          ent.y += (distY / d) * overlap;
        } else {
          ent.y = rectCy + halfH + ent.radius + 1;
        }
      }
    }

    if (jumping) return; // Камни, заборы, бочки и ящики можно перепрыгнуть!

    // 2. Статические пропы по сетке O(1)
    const nearProps = this.world.queryPropsNear(ent.x, ent.y);
    for (let i = 0; i < nearProps.length; i++) {
      const pr = nearProps[i];
      const minD = ent.radius + pr.radius;
      const dx = ent.x - pr.x;
      const dy = ent.y - pr.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0 && d2 < minD * minD) {
        const d = Math.sqrt(d2);
        const push = minD - d;
        ent.x += (dx / d) * push;
        ent.y += (dy / d) * push;
      }
    }

    // 3. Активные деревья, ящики и бочки поблизости
    for (let i = 0; i < this.world.nodes.length; i++) {
      const nd = this.world.nodes[i];
      if (!nd.solid || nd.respawnTimer > 0) continue;
      if (Math.abs(ent.x - nd.x) > 48 || Math.abs(ent.y - nd.y) > 48) continue;
      const minD = ent.radius + nd.radius;
      const dx = ent.x - nd.x;
      const dy = ent.y - nd.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0 && d2 < minD * minD) {
        const d = Math.sqrt(d2);
        const push = minD - d;
        ent.x += (dx / d) * push;
        ent.y += (dy / d) * push;
      }
    }
  }

  // ── Прыжок, Рывок, Граната, Смена оружия, Атака и Навыки ─────────────
  jump() {
    const p = this.player;
    if (p.dead) return false;
    if (p.vehicleId) {
      this.toggleVehicle(null);
      return true;
    }
    if (p.z > 2 || p.stamina < 12) return false;
    p.stamina -= 12;
    p.vz = 385;
    p.z = 1;
    this.sound.play('jump');
    this.spawnDust(p.x, p.y, '#e2e8f0', 6);
    return true;
  }

  dash() {
    const p = this.player;
    if (p.dead || p.vehicleId || p.dashTimer > 0 || p.stamina < 18) return false;
    p.stamina -= 18;
    p.dashTimer = 0.85;
    p.dashActive = 0.19;
    p.invulnTimer = 0.28;
    p.dashDirX = Math.cos(p.facing);
    p.dashDirY = Math.sin(p.facing);
    this.sound.play('dash');
    this.spawnDust(p.x, p.y, '#38bdf8', 8);
    return true;
  }

  cycleWeapon() {
    const list = this.inventory.weapons;
    if (list.length <= 1) return;
    const idx = list.indexOf(this.inventory.equippedWeapon);
    const next = list[(idx + 1) % list.length];
    this.equipWeapon(next);
    const w = WEAPONS[next];
    this.pushToast(`🔫 Экипировано: ${w.name}`, RARITIES[w.rarity].color);
  }

  findAimAngle(maxRange) {
    const p = this.player;
    if (!this.settings.autoAim) return p.facing;
    let best = null;
    let bestD2 = (maxRange + 55) ** 2;
    for (const b of this.bossEntities) {
      const d2 = dist2(p.x, p.y, b.x, b.y);
      if (d2 < bestD2) { bestD2 = d2; best = b; }
    }
    for (const e of this.enemies) {
      const d2 = dist2(p.x, p.y, e.x, e.y);
      if (d2 < bestD2) { bestD2 = d2; best = e; }
    }
    if (!best) {
      // Наводимся также на взрывные бочки и ящики вблизи!
      for (const nd of this.world.nodes) {
        if (nd.respawnTimer > 0) continue;
        const d2 = dist2(p.x, p.y, nd.x, nd.y);
        if (d2 < Math.min(bestD2, 130 * 130)) { bestD2 = d2; best = nd; }
      }
    }
    return best ? Math.atan2(best.y - p.y, best.x - p.x) : p.facing;
  }

  performAttack() {
    const p = this.player;
    if (p.dead || p.vehicleId || p.attackTimer > 0) return false;

    let weapon = WEAPONS[this.inventory.equippedWeapon] || WEAPONS.knife;

    // Проверка патронов для огнестрела
    if (weapon.ammoCost > 0 && this.inventory.ammo < weapon.ammoCost) {
      // Автоматически переключаемся на оружие без патронов, чтобы игрок никогда не остался безоружным!
      const fallback = this.inventory.weapons.find(id => (WEAPONS[id]?.ammoCost || 0) === 0);
      if (fallback) {
        this.inventory.equippedWeapon = fallback;
        weapon = WEAPONS[fallback];
        this.pushToast(`⚠️ Патроны кончились! В руках: ${weapon.name}`, '#f59e0b');
      } else {
        p.attackTimer = 0.35;
        this.pushToast('⚠️ Нет патронов! Подбери ящики или купи в SHOP', '#ef4444');
        return false;
      }
    }

    const speedMult = (1 + p.stats.agility * 0.025) * (p.shieldBuffTimer > 0 ? 1.25 : 1);
    p.attackTimer = weapon.cooldown / speedMult;
    p.attackAnimTimer = Math.min(0.24, p.attackTimer * 0.85);

    const aim = this.findAimAngle(weapon.range);
    this.updateFacingFromAngle(aim);

    const baseDmg = this.getWeaponDamage(weapon.id);
    const critChance = this.getCritChance(weapon.id);

    if (weapon.ammoCost > 0) {
      this.inventory.ammo = Math.max(0, this.inventory.ammo - weapon.ammoCost);
    }

    if (weapon.category === 'melee') {
      this.sound.play('swing');
      this.slashes.push({
        x: p.x,
        y: p.y - p.z * 0.5,
        angle: aim,
        arc: weapon.arc,
        range: weapon.range,
        color: RARITIES[weapon.rarity].color,
        life: 0.16,
        maxLife: 0.16
      });
      this.applyMeleeHit(aim, weapon.range, weapon.arc, baseDmg, critChance, weapon.knockback);
    } else if (weapon.category === 'gun') {
      this.sound.play(weapon.id === 'shotgun' ? 'shotgun' : 'gun');
      // Пиксельная вспышка выстрела у дула оружия
      const muzzleX = p.x + Math.cos(aim) * 24;
      const muzzleY = p.y - 6 + Math.sin(aim) * 24;
      this.spawnSpriteEffect('muzzle', muzzleX, muzzleY, weapon.id === 'shotgun' ? 1.25 : 0.95, 22);

      const pellets = weapon.pellets || 1;
      for (let i = 0; i < pellets; i++) {
        const offset = pellets > 1
          ? ((i / (pellets - 1)) - 0.5) * weapon.spread + randRange(-0.04, 0.04)
          : randRange(-(weapon.spread || 0.02), weapon.spread || 0.02);
        const shotAngle = aim + offset;
        const isCrit = Math.random() < critChance;
        const dmg = Math.round(baseDmg * (isCrit ? 1.75 : 1) * randRange(0.92, 1.08));
        this.projectiles.push({
          fromPlayer: true,
          kind: 'bullet',
          x: muzzleX,
          y: muzzleY,
          vx: Math.cos(shotAngle) * weapon.projSpeed,
          vy: Math.sin(shotAngle) * weapon.projSpeed,
          radius: weapon.id === 'sniper' ? 5 : 4,
          damage: dmg,
          isCrit,
          pierce: weapon.pierce || 0,
          splashRadius: 0,
          knockback: weapon.knockback || 100,
          color: weapon.id === 'sniper' ? '#fde047' : '#fbbf24',
          life: weapon.range / weapon.projSpeed
        });
      }
      // Разрушение ящика/бочки прямо в упор при выстреле
      this.damageNodesInCone(aim, 44, 1.1, baseDmg);
    } else if (weapon.category === 'bow') {
      this.sound.play('swing');
      const isCrit = Math.random() < critChance;
      const dmg = Math.round(baseDmg * (isCrit ? 1.75 : 1));
      this.projectiles.push({
        fromPlayer: true,
        kind: 'arrow',
        x: p.x + Math.cos(aim) * 18,
        y: p.y - 6 + Math.sin(aim) * 18,
        vx: Math.cos(aim) * weapon.projSpeed,
        vy: Math.sin(aim) * weapon.projSpeed,
        radius: 5,
        damage: dmg,
        isCrit,
        pierce: weapon.pierce || 1,
        splashRadius: 0,
        knockback: weapon.knockback || 120,
        color: '#a3e635',
        life: weapon.range / weapon.projSpeed
      });
    } else if (weapon.category === 'magic') {
      this.sound.play('skill');
      const isCrit = Math.random() < critChance;
      const dmg = Math.round(baseDmg * (isCrit ? 1.75 : 1));
      this.spawnSpriteEffect('magic', p.x + Math.cos(aim) * 20, p.y - 8 + Math.sin(aim) * 20, 0.85, 18);
      this.projectiles.push({
        fromPlayer: true,
        kind: 'magic',
        homing: true,
        x: p.x + Math.cos(aim) * 18,
        y: p.y - 6 + Math.sin(aim) * 18,
        vx: Math.cos(aim) * weapon.projSpeed,
        vy: Math.sin(aim) * weapon.projSpeed,
        radius: 8,
        damage: dmg,
        isCrit,
        pierce: 0,
        splashRadius: weapon.splashRadius || 72,
        knockback: weapon.knockback || 160,
        color: '#38bdf8',
        life: weapon.range / weapon.projSpeed
      });
    }
    return true;
  }

  throwGrenade() {
    const p = this.player;
    if (p.dead || p.grenadeTimer > 0) return false;
    if ((this.inventory.consumables.grenade || 0) <= 0) {
      this.pushToast('💣 Гранаты закончились! Скрафти или купи в Магазине', '#f59e0b');
      return false;
    }
    this.inventory.consumables.grenade--;
    p.grenadeTimer = 0.65;
    const aim = this.findAimAngle(300);
    this.updateFacingFromAngle(aim);

    // Находим дистанцию до ближайшего врага (или 210 пикселей вперёд)
    let throwDist = 205;
    for (const e of [...this.bossEntities, ...this.enemies]) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < 290 && d > 50) {
        const angDiff = Math.abs(Math.atan2(Math.sin(Math.atan2(e.y - p.y, e.x - p.x) - aim), Math.cos(Math.atan2(e.y - p.y, e.x - p.x) - aim)));
        if (angDiff < 0.45) { throwDist = d; break; }
      }
    }

    const flightTime = 0.56;
    this.thrownGrenades.push({
      x: p.x,
      y: p.y,
      z: 14,
      vx: (Math.cos(aim) * throwDist) / flightTime,
      vy: (Math.sin(aim) * throwDist) / flightTime,
      vz: 210,
      life: flightTime,
      damage: Math.round(95 + p.level * 18 + p.stats.power * 12)
    });
    this.sound.play('swing');
    return true;
  }

  updateThrownGrenades(dt) {
    for (let i = this.thrownGrenades.length - 1; i >= 0; i--) {
      const g = this.thrownGrenades[i];
      g.life -= dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.z = Math.max(0, g.z + g.vz * dt);
      g.vz -= 740 * dt;
      if (g.life <= 0) {
        this.thrownGrenades.splice(i, 1);
        this.triggerExplosion(g.x, g.y, 118, g.damage, true);
      }
    }
  }

  triggerExplosion(x, y, radius, damage, friendlyFireSafe = true) {
    this.sound.play('explosion');
    this.camera.shake = Math.max(this.camera.shake, 11);
    this.stats.explosionsTriggered = (this.stats.explosionsTriggered || 0) + 1;

    this.spawnSpriteEffect('explosion', x, y, 1.55, 15);
    this.spawnSpriteEffect('smoke', x - 16, y - 12, 1.2, 10);
    this.spawnSpriteEffect('smoke', x + 16, y - 8, 1.1, 10);
    this.shockwaves.push({
      x, y, radius: 14, maxRadius: radius, color: '#fb923c', friendly: true, damage: 0
    });

    // Урон врагам и боссам
    const r2 = radius * radius;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const d2 = dist2(x, y, e.x, e.y);
      if (d2 <= (radius + e.radius) ** 2) {
        const ang = Math.atan2(e.y - y, e.x - x);
        e.vx = Math.cos(ang) * 280;
        e.vy = Math.sin(ang) * 280;
        e.stunTimer = Math.max(e.stunTimer, 0.45);
        this.damageEnemy(e, damage, true, '#fb923c');
      }
    }
    for (let i = this.bossEntities.length - 1; i >= 0; i--) {
      const b = this.bossEntities[i];
      if (dist2(x, y, b.x, b.y) <= (radius + b.radius) ** 2) {
        this.damageBoss(b, damage, true);
      }
    }

    // Урон игроку, если это взрыв босса или красной бочки совсем рядом
    if (!friendlyFireSafe && dist2(x, y, this.player.x, this.player.y) <= (radius * 0.72) ** 2) {
      this.damagePlayer(Math.round(damage * 0.45));
    }

    // Разрушение ящиков и цепная детонация красных бочек!
    for (const nd of this.world.nodes) {
      if (nd.respawnTimer > 0) continue;
      if (dist2(x, y, nd.x, nd.y) <= r2) {
        this.damageNode(nd, 999);
      }
    }

    this.checkAchievements();
  }

  applyMeleeHit(angle, range, arc, baseDmg, critChance, knockback) {
    const p = this.player;
    let hitAny = false;

    const inCone = (tx, ty, tr) => {
      const dx = tx - p.x;
      const dy = ty - p.y;
      const d = Math.hypot(dx, dy);
      if (d > range + tr) return false;
      const a = Math.atan2(dy, dx);
      const diff = Math.atan2(Math.sin(a - angle), Math.cos(a - angle));
      return Math.abs(diff) <= arc * 0.56 || d < 30 + tr;
    };

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (inCone(e.x, e.y, e.radius)) {
        const isCrit = Math.random() < critChance;
        const dmg = Math.round(baseDmg * (isCrit ? 1.8 : 1) * randRange(0.92, 1.08));
        const ka = Math.atan2(e.y - p.y, e.x - p.x);
        e.vx += Math.cos(ka) * knockback;
        e.vy += Math.sin(ka) * knockback;
        this.damageEnemy(e, dmg, isCrit);
        hitAny = true;
      }
    }

    for (let i = this.bossEntities.length - 1; i >= 0; i--) {
      const b = this.bossEntities[i];
      if (inCone(b.x, b.y, b.radius)) {
        const isCrit = Math.random() < critChance;
        const dmg = Math.round(baseDmg * (isCrit ? 1.8 : 1) * randRange(0.92, 1.08));
        this.damageBoss(b, dmg, isCrit);
        hitAny = true;
      }
    }

    this.damageNodesInCone(angle, range, arc, Math.max(18, Math.round(baseDmg * 0.75)));
    if (hitAny) this.bumpCombo();
  }

  damageNodesInCone(angle, range, arc, dmg) {
    const p = this.player;
    for (const nd of this.world.nodes) {
      if (nd.respawnTimer > 0) continue;
      const dx = nd.x - p.x;
      const dy = nd.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > range + nd.radius) continue;
      const a = Math.atan2(dy, dx);
      const diff = Math.abs(Math.atan2(Math.sin(a - angle), Math.cos(a - angle)));
      if (diff <= arc * 0.6 || d < 34) {
        this.damageNode(nd, dmg);
      }
    }
  }

  bumpCombo() {
    this.player.comboCount++;
    this.player.comboTimer = 3.5;
  }

  useSkill(skillId) {
    const p = this.player;
    if (p.dead) return false;
    const skState = this.skills[skillId];
    const skDef = SKILLS[skillId];
    if (!skState || !skDef) return false;
    if (skState.level <= 0) {
      this.pushToast(`🔒 Изучи «${skDef.name}» во вкладке Герой`, '#94a3b8');
      return false;
    }
    if (skState.cd > 0) return false;
    if (p.stamina < skDef.staminaCost) {
      this.pushToast('⚡ Недостаточно энергии!', '#f59e0b');
      return false;
    }

    p.stamina -= skDef.staminaCost;
    const cdMult = Math.max(0.65, 1 - (skState.level - 1) * 0.08);
    skState.cd = skDef.baseCooldown * cdMult;
    this.sound.play('skill');

    const baseDmg = this.getWeaponDamage();
    const skillMult = (skDef.baseDamageMult || 2) * (1 + (skState.level - 1) * 0.25);

    if (skillId === 'slash_wave') {
      const r = skDef.radius;
      this.shockwaves.push({ x: p.x, y: p.y, radius: 18, maxRadius: r, color: '#f97316', friendly: true, damage: 0 });
      this.slashes.push({ x: p.x, y: p.y, angle: 0, arc: Math.PI * 2, range: r, color: '#fb923c', life: 0.24, maxLife: 0.24 });
      const dmg = Math.round(baseDmg * skillMult);
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (dist2(p.x, p.y, e.x, e.y) <= (r + e.radius) ** 2) {
          const ka = Math.atan2(e.y - p.y, e.x - p.x);
          e.vx = Math.cos(ka) * 280;
          e.vy = Math.sin(ka) * 280;
          this.damageEnemy(e, dmg, true, '#fb923c');
        }
      }
      for (let i = this.bossEntities.length - 1; i >= 0; i--) {
        const b = this.bossEntities[i];
        if (dist2(p.x, p.y, b.x, b.y) <= (r + b.radius) ** 2) {
          this.damageBoss(b, dmg, true);
        }
      }
      for (const nd of this.world.nodes) {
        if (nd.respawnTimer <= 0 && dist2(p.x, p.y, nd.x, nd.y) <= r * r) {
          this.damageNode(nd, 45);
        }
      }
      this.camera.shake = 6;
    } else if (skillId === 'magic_nova') {
      const r = skDef.radius;
      this.spawnSpriteEffect('magic', p.x, p.y, 1.9, 15);
      this.shockwaves.push({ x: p.x, y: p.y, radius: 16, maxRadius: r, color: '#38bdf8', friendly: true, damage: 0 });
      const dmg = Math.round(baseDmg * skillMult);
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (dist2(p.x, p.y, e.x, e.y) <= (r + e.radius) ** 2) {
          e.stunTimer = 1.9;
          this.damageEnemy(e, dmg, true, '#38bdf8');
        }
      }
      for (let i = this.bossEntities.length - 1; i >= 0; i--) {
        const b = this.bossEntities[i];
        if (dist2(p.x, p.y, b.x, b.y) <= (r + b.radius) ** 2) {
          b.stunTimer = 1.1;
          this.damageBoss(b, dmg, true);
        }
      }
      this.camera.shake = 8;
    } else if (skillId === 'adrenaline') {
      const healAmt = Math.round(p.maxHp * (0.25 + (skState.level - 1) * 0.05));
      p.hp = Math.min(p.maxHp, p.hp + healAmt);
      p.shieldBuffTimer = skDef.duration + (skState.level - 1) * 1.5;
      this.addFloatingText(p.x, p.y - 28, `+${healAmt} HP · ЩИТ`, '#4ade80', true);
      this.spawnSpriteEffect('magic', p.x, p.y, 1.35, 16);
    }
    return true;
  }

  useConsumable(itemId) {
    const p = this.player;
    if (p.dead) return false;
    if (itemId === 'grenade') return this.throwGrenade();

    const count = this.inventory.consumables[itemId] || 0;
    if (count <= 0) {
      this.pushToast(`Нет предмета «${ITEMS[itemId]?.name || itemId}»`, '#f59e0b');
      return false;
    }

    if (itemId === 'medkit') {
      if (p.hp >= p.maxHp) {
        this.pushToast('Здоровье уже полное!', '#4ade80');
        return false;
      }
      this.inventory.consumables.medkit--;
      const heal = Math.round(p.maxHp * 0.55);
      p.hp = Math.min(p.maxHp, p.hp + heal);
      this.sound.play('heal');
      this.addFloatingText(p.x, p.y - 26, `+${heal} HP`, '#4ade80', true);
      return true;
    }

    if (itemId === 'food') {
      this.inventory.consumables.food--;
      p.hunger = Math.min(p.maxHunger, p.hunger + 60);
      const heal = Math.round(p.maxHp * 0.22);
      p.hp = Math.min(p.maxHp, p.hp + heal);
      p.foodRegenTimer = 10;
      this.sound.play('heal');
      this.addFloatingText(p.x, p.y - 26, `+60 Сытость · +${heal} HP`, '#fbbf24', true);
      return true;
    }

    if (itemId === 'potion') {
      this.inventory.consumables.potion--;
      const heal = Math.round(p.maxHp * 0.35);
      p.hp = Math.min(p.maxHp, p.hp + heal);
      p.stamina = p.maxStamina;
      p.shieldBuffTimer = Math.max(p.shieldBuffTimer, 12);
      this.sound.play('skill');
      this.spawnSpriteEffect('magic', p.x, p.y, 1.3, 16);
      this.addFloatingText(p.x, p.y - 26, `+${heal} HP · Энергощит!`, '#38bdf8', true);
      return true;
    }

    return false;
  }

  grantItem(itemId, count = 1) {
    if (itemId === 'ammo') {
      const added = count > 5 ? count : count * 18;
      this.inventory.ammo = Math.min(this.getMaxAmmo(), this.inventory.ammo + added);
      return added;
    }
    if (itemId === 'coin') {
      this.inventory.coins += count;
      return count;
    }
    if (itemId === 'backpack') {
      if (this.inventory.backpackLevel < 4) {
        this.inventory.backpackLevel++;
        this.recalcDerivedStats(false);
        this.pushToast(`🎒 Рюкзак улучшен (ур. ${this.inventory.backpackLevel})! Макс. патронов: ${this.getMaxAmmo()}`, '#c084fc');
      } else {
        this.inventory.coins += 120;
      }
      return 1;
    }
    this.inventory.consumables[itemId] = (this.inventory.consumables[itemId] || 0) + count;
    return count;
  }

  // ── Разрушаемые объекты (деревья, кусты, ящики, деревянные и красные бочки) ──
  damageNode(nd, dmg) {
    nd.hp -= dmg;
    nd.hitFlash = 0.14;
    this.sound.play('hit');

    if (nd.hp <= 0) {
      nd.respawnTimer = 42;
      this.stats.resourcesGathered++;
      this.advanceQuest('gather', 1);

      if (nd.explosive) {
        // Красная взрывная бочка детонирует!
        this.triggerExplosion(nd.x, nd.y, 128, 125 + this.player.level * 15, false);
        return;
      }

      if (nd.dropType === 'crates' || nd.dropType === 'barrel') {
        // Из ящиков и бочек падают патроны, монеты, аптечки, гранаты, еда и металлолом!
        this.drops.push({ x: nd.x - 10, y: nd.y, kind: 'ammo', amount: randInt(12, 24), life: 60 });
        this.drops.push({ x: nd.x + 10, y: nd.y, kind: 'coin', amount: randInt(8, 18), life: 60 });
        this.drops.push({ x: nd.x, y: nd.y + 8, kind: 'resource', resId: 'scrap', amount: randInt(1, 3), life: 60 });
        const roll = Math.random();
        if (roll < 0.30) this.drops.push({ x: nd.x, y: nd.y - 8, kind: 'item', itemId: 'medkit', amount: 1, life: 60 });
        else if (roll < 0.52) this.drops.push({ x: nd.x, y: nd.y - 8, kind: 'item', itemId: 'grenade', amount: 1, life: 60 });
        else if (roll < 0.72) this.drops.push({ x: nd.x, y: nd.y - 8, kind: 'item', itemId: 'food', amount: 1, life: 60 });
        else if (roll < 0.79) this.drops.push({ x: nd.x, y: nd.y - 8, kind: 'item', itemId: 'key', amount: 1, life: 60 });
      } else {
        const amt = randInt(nd.dropAmount[0], nd.dropAmount[1]);
        this.drops.push({ x: nd.x, y: nd.y, kind: 'resource', resId: nd.dropType, amount: amt, life: 60 });
        if (nd.kind === 'bush' && Math.random() < 0.35) {
          this.drops.push({ x: nd.x + 10, y: nd.y, kind: 'item', itemId: 'food', amount: 1, life: 60 });
        }
      }
      this.spawnDust(nd.x, nd.y, '#d6b27c', 7);
    }
  }

  updateNodes(dt) {
    for (const nd of this.world.nodes) {
      if (nd.hitFlash > 0) nd.hitFlash = Math.max(0, nd.hitFlash - dt);
      if (nd.respawnTimer > 0) {
        nd.respawnTimer -= dt;
        if (nd.respawnTimer <= 0) {
          nd.respawnTimer = 0;
          nd.hp = nd.maxHp;
        }
      }
    }
  }

  // ── ИИ врагов ────────────────────────────────────────────────────────
  updateEnemies(dt) {
    const p = this.player;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.animTime += dt * 7;
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);
      if (e.z > 0 || e.vz !== 0) {
        e.z = Math.max(0, e.z + e.vz * dt);
        e.vz -= 900 * dt;
        if (e.z <= 0) { e.z = 0; e.vz = 0; }
      }

      if (e.stunTimer > 0) {
        e.stunTimer -= dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.vx *= 0.85;
        e.vy *= 0.85;
        continue;
      }

      // Не заходить внутрь безопасной зоны Лагеря Выживших
      const dCamp2 = dist2(e.x, e.y, 2360, 2380);
      if (dCamp2 < 235 * 235) {
        const ang = Math.atan2(e.y - 2380, e.x - 2360);
        e.x += Math.cos(ang) * 140 * dt;
        e.y += Math.sin(ang) * 140 * dt;
        continue;
      }

      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy);
      e.attackCd = Math.max(0, e.attackCd - dt);

      // Очередь выстрелов для солдат спецотряда
      if (e.burstLeft > 0) {
        e.burstTimer -= dt;
        if (e.burstTimer <= 0 && !p.dead) {
          e.burstLeft--;
          e.burstTimer = 0.14;
          const aim = Math.atan2(dy, dx) + randRange(-0.07, 0.07);
          this.spawnSpriteEffect('muzzle', e.x + Math.cos(aim) * 16, e.y - 6 + Math.sin(aim) * 16, 0.75, 22);
          this.projectiles.push({
            fromPlayer: false,
            kind: 'bullet',
            x: e.x + Math.cos(aim) * 16,
            y: e.y - 6 + Math.sin(aim) * 16,
            vx: Math.cos(aim) * e.projSpeed,
            vy: Math.sin(aim) * e.projSpeed,
            radius: 5,
            damage: Math.round(e.damage * 0.72),
            color: '#ef4444',
            life: 1.35
          });
        }
      }

      if (!p.dead && d < 460) {
        const nx = dx / (d || 1);
        const ny = dy / (d || 1);

        if (e.behavior === 'shooter' || e.behavior === 'burst_shooter') {
          if (d > e.attackRange * 0.8) {
            e.vx += (nx * e.speed - e.vx) * Math.min(1, dt * 6);
            e.vy += (ny * e.speed - e.vy) * Math.min(1, dt * 6);
          } else if (d < 135) {
            e.vx += (-nx * e.speed * 0.75 - e.vx) * Math.min(1, dt * 6);
            e.vy += (-ny * e.speed * 0.75 - e.vy) * Math.min(1, dt * 6);
          } else {
            e.vx *= 0.85;
            e.vy *= 0.85;
          }

          if (d <= e.attackRange && e.attackCd <= 0) {
            if (e.behavior === 'burst_shooter') {
              e.attackCd = 2.1;
              e.burstLeft = 3;
              e.burstTimer = 0;
            } else {
              e.attackCd = 1.65;
              this.spawnSpriteEffect('muzzle', e.x + nx * 16, e.y - 6 + ny * 16, 0.8, 22);
              this.projectiles.push({
                fromPlayer: false,
                kind: 'bullet',
                x: e.x + nx * 16,
                y: e.y - 6 + ny * 16,
                vx: nx * e.projSpeed,
                vy: ny * e.projSpeed,
                radius: 5,
                damage: e.damage,
                color: '#f97316',
                life: 1.4
              });
            }
          }
        } else if (e.behavior === 'pouncer' && d < 210 && d > 75 && e.attackCd <= 0) {
          // Мутант-зверь прыгает на игрока!
          e.attackCd = 2.3;
          e.vz = 280;
          e.z = 2;
          e.vx = nx * 360;
          e.vy = ny * 360;
        } else if (e.behavior === 'dasher' && d < 185 && d > 65 && e.attackCd <= 0) {
          e.attackCd = 2.4;
          e.vx = nx * 340;
          e.vy = ny * 340;
        } else {
          e.vx += (nx * e.speed - e.vx) * Math.min(1, dt * 6);
          e.vy += (ny * e.speed - e.vy) * Math.min(1, dt * 6);
        }

        if (d < e.radius + p.radius + 7 && e.attackCd <= 0 && p.z < 18 && !p.vehicleId) {
          e.attackCd = 1.0;
          this.damagePlayer(e.damage);
        }
      } else {
        e.wanderTimer -= dt;
        if (e.wanderTimer <= 0) {
          e.wanderTimer = randRange(1.5, 3.8);
          e.wanderAngle += randRange(-1.4, 1.4);
        }
        e.vx = Math.cos(e.wanderAngle) * e.speed * 0.35;
        e.vy = Math.sin(e.wanderAngle) * e.speed * 0.35;
      }

      e.x = clamp(e.x + e.vx * dt, 60, this.world.width - 60);
      e.y = clamp(e.y + e.vy * dt, 60, this.world.height - 60);
      this.resolveEntityObstacles(e, e.z > 10);
    }
  }

  // ── 4 Босса мира с фазами и спецприёмами ─────────────────────────────
  updateBosses(dt) {
    const p = this.player;
    for (let i = this.bossEntities.length - 1; i >= 0; i--) {
      const b = this.bossEntities[i];
      b.animTime += dt * 6.5;
      if (b.hitFlash > 0) b.hitFlash = Math.max(0, b.hitFlash - dt);

      if (b.z > 0 || b.vz !== 0) {
        b.z = Math.max(0, b.z + b.vz * dt);
        b.vz -= 880 * dt;
        if (b.z <= 0) {
          b.z = 0;
          b.vz = 0;
          // Приземление босса после прыжка рождает ударную волну!
          this.shockwaves.push({
            x: b.x, y: b.y, radius: 22, maxRadius: 210,
            color: '#ef4444', friendly: false, damage: Math.round(b.damage * 1.15), hitPlayer: false
          });
          this.camera.shake = 10;
          this.sound.play('explosion');
        }
      }

      if (b.stunTimer > 0) {
        b.stunTimer -= dt;
        continue;
      }

      const dHome = Math.hypot(p.x - b.homeX, p.y - b.homeY);
      if (p.dead || dHome > b.arenaRadius + 240) {
        b.x += (b.homeX - b.x) * Math.min(1, dt * 2);
        b.y += (b.homeY - b.y) * Math.min(1, dt * 2);
        b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.04 * dt);
        continue;
      }

      b.phase = b.hp < b.maxHp * 0.5 ? 2 : 1;
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = dx / d;
      const ny = dy / d;

      if (b.dashActive > 0) {
        b.dashActive -= dt;
        b.x += b.dashVx * dt;
        b.y += b.dashVy * dt;
        if (d < b.radius + p.radius + 10 && p.z < 18) {
          this.damagePlayer(Math.round(b.damage * 1.2));
        }
        continue;
      }

      const spd = b.speed * (b.phase === 2 ? 1.22 : 1.0);
      b.x += nx * spd * dt;
      b.y += ny * spd * dt;

      if (d < b.radius + p.radius + 8 && p.z < 18 && !p.vehicleId) {
        this.damagePlayer(b.damage);
      }

      b.actionTimer -= dt * (b.phase === 2 ? 1.3 : 1.0);
      if (b.actionTimer <= 0) {
        b.actionTimer = 3.1;
        this.executeBossSkill(b, nx, ny);
      }
    }
  }

  executeBossSkill(b, nx, ny) {
    this.sound.play('skill');
    if (b.bossId === 'boss_city') {
      // Ударная волна (можно перепрыгнуть ПРЫЖКОМ!) + подкрепление зомби
      this.shockwaves.push({
        x: b.x, y: b.y, radius: 24, maxRadius: 235,
        color: '#ef4444', friendly: false, damage: Math.round(b.damage * 1.2), hitPlayer: false
      });
      this.camera.shake = 8;
      if (this.enemies.length < 30) {
        this.spawnEnemyAt(b.x + 85, b.y, 'infected_runner');
      }
    } else if (b.bossId === 'boss_factory') {
      // Веер зажигательных снарядов + рывок
      for (let k = -2; k <= 2; k++) {
        const ang = Math.atan2(ny, nx) + k * 0.24;
        this.projectiles.push({
          fromPlayer: false,
          kind: 'magic',
          x: b.x, y: b.y,
          vx: Math.cos(ang) * 360,
          vy: Math.sin(ang) * 360,
          radius: 9,
          damage: b.damage,
          splashRadius: 55,
          color: '#f97316',
          life: 1.7
        });
      }
      b.dashActive = 0.35;
      b.dashVx = nx * 420;
      b.dashVy = ny * 420;
    } else if (b.bossId === 'boss_bunker') {
      // Гигантский прыжок босса сверху + круговой залп
      b.vz = 390;
      b.z = 4;
      b.dashActive = 0.42;
      b.dashVx = nx * 380;
      b.dashVy = ny * 380;
      for (let k = 0; k < 10; k++) {
        const ang = (k / 10) * Math.PI * 2;
        this.projectiles.push({
          fromPlayer: false,
          kind: 'bullet',
          x: b.x, y: b.y,
          vx: Math.cos(ang) * 350,
          vy: Math.sin(ang) * 350,
          radius: 6,
          damage: Math.round(b.damage * 0.85),
          color: '#a855f7',
          life: 1.5
        });
      }
    } else {
      // Финальный босс Проект «ГОРИЗОНТ»: спиральный обстрел + ударная волна + миномётный взрыв!
      const count = b.phase === 2 ? 14 : 10;
      for (let k = 0; k < count; k++) {
        const ang = (k / count) * Math.PI * 2 + b.animTime;
        this.projectiles.push({
          fromPlayer: false,
          kind: 'bullet',
          x: b.x, y: b.y,
          vx: Math.cos(ang) * 370,
          vy: Math.sin(ang) * 370,
          radius: 7,
          damage: b.damage,
          color: '#ef4444',
          life: 1.8
        });
      }
      this.shockwaves.push({
        x: b.x, y: b.y, radius: 26, maxRadius: 270,
        color: '#f59e0b', friendly: false, damage: b.damage, hitPlayer: false
      });
      b.dashActive = 0.34;
      b.dashVx = nx * 450;
      b.dashVy = ny * 450;
    }
  }

  // ── Урон, опыт, уровни и трофеи ──────────────────────────────────────
  damageEnemy(e, dmg, isCrit = false, customColor = null) {
    e.hp -= dmg;
    e.hitFlash = 0.14;
    this.sound.play(isCrit ? 'crit' : 'hit');
    this.spawnSpriteEffect('hit', e.x, e.y - 10, isCrit ? 1.15 : 0.85, 20);
    this.addFloatingText(
      e.x + randRange(-8, 8),
      e.y - 22,
      isCrit ? `${dmg}!` : `${dmg}`,
      customColor || (isCrit ? '#fbbf24' : '#f8fafc'),
      isCrit
    );

    if (e.hp <= 0) {
      const idx = this.enemies.indexOf(e);
      if (idx !== -1) this.enemies.splice(idx, 1);
      this.onEnemyKilled(e);
    }
  }

  onEnemyKilled(e) {
    const lootMult = this.getLootMultiplier();
    const coins = Math.round(randInt(e.coins[0], e.coins[1]) * lootMult);
    this.drops.push({ x: e.x - 6, y: e.y, kind: 'coin', amount: coins, life: 60 });

    for (const dr of e.drops) {
      if (Math.random() < dr.chance * lootMult) {
        if (dr.id === 'ammo') {
          this.drops.push({ x: e.x + 8, y: e.y, kind: 'ammo', amount: randInt(10, 20), life: 60 });
        } else if (dr.id) {
          this.drops.push({ x: e.x + 8, y: e.y, kind: 'item', itemId: dr.id, amount: 1, life: 60 });
        } else if (dr.res) {
          this.drops.push({ x: e.x + 8, y: e.y, kind: 'resource', resId: dr.res, amount: randInt(1, 2), life: 60 });
        }
      }
    }

    this.stats.totalKills++;
    this.stats.biomeKills[e.biome] = (this.stats.biomeKills[e.biome] || 0) + 1;
    this.advanceQuest('kills', 1);
    this.advanceQuest('biome_kills', 1, { biome: e.biome });
    this.gainXp(e.xp);
    this.checkAchievements();
  }

  damageBoss(b, dmg, isCrit = false) {
    b.hp -= dmg;
    b.hitFlash = 0.12;
    this.sound.play(isCrit ? 'crit' : 'hit');
    this.spawnSpriteEffect('hit', b.x + randRange(-10, 10), b.y - 16, 1.25, 20);
    this.addFloatingText(
      b.x + randRange(-14, 14),
      b.y - 38,
      isCrit ? `${dmg}!` : `${dmg}`,
      isCrit ? '#fbbf24' : '#fda4af',
      isCrit
    );

    if (b.hp <= 0) {
      const idx = this.bossEntities.indexOf(b);
      if (idx !== -1) this.bossEntities.splice(idx, 1);
      if (!this.defeatedBosses.includes(b.bossId)) {
        this.defeatedBosses.push(b.bossId);
      }
      this.spawnSpriteEffect('explosion', b.x, b.y, 2.2, 12);
      this.inventory.coins += b.coins;
      this.gainXp(b.xp);
      this.grantWeapon(b.rewardWeapon);
      for (const it of b.rewardItems) {
        this.grantItem(it.id, it.count);
      }
      this.camera.shake = 14;
      this.sound.play('levelup');
      this.pushToast(`🏆 БОСС ПОВЕРЖЕН: ${b.name}! Получено: ${WEAPONS[b.rewardWeapon]?.name}`, '#fbbf24');
      this.advanceQuest('boss', 1, { bossId: b.bossId });
      this.checkAchievements();
      this.saveGame(true);
    }
  }

  damagePlayer(rawDmg) {
    const p = this.player;
    if (p.dead || p.invulnTimer > 0) return;

    // Если игрок в машине — часть урона гасит кузов
    let mult = p.shieldBuffTimer > 0 ? 0.58 : 1.0;
    if (p.vehicleId) mult *= 0.65;
    const dmg = Math.max(1, Math.round(rawDmg * mult));
    p.hp -= dmg;
    p.invulnTimer = 0.46;
    p.hurtAnimTimer = 0.28;
    this.camera.shake = 7;
    this.sound.play('playerHit');
    this.spawnSpriteEffect('hit', p.x, p.y - 10, 1.0, 20);
    this.addFloatingText(p.x, p.y - 26, `-${dmg}`, '#ef4444', true);

    if (p.hp <= 0) {
      p.hp = 0;
      p.dead = true;
      p.vehicleId = null;
      this.pushToast('💀 Герой пал в бою! Эвакуация в ближайший лагерь...', '#ef4444');
    }
  }

  respawnPlayer() {
    const p = this.player;
    let bestCamp = CAMPFIRES[0];
    let bestD2 = Infinity;
    for (const c of CAMPFIRES) {
      if (!this.unlockedCamps.includes(c.id)) continue;
      const d2 = dist2(p.x, p.y, c.x, c.y);
      if (d2 < bestD2) { bestD2 = d2; bestCamp = c; }
    }
    p.x = bestCamp.x;
    p.y = bestCamp.y + 42;
    p.z = 0;
    p.vz = 0;
    p.hp = p.maxHp;
    p.stamina = p.maxStamina;
    p.hunger = Math.max(70, p.hunger);
    p.dead = false;
    p.vehicleId = null;
    p.invulnTimer = 2.0;
    this.projectiles = [];
    this.sound.play('heal');
    this.pushToast(`🔥 Возрождение: ${bestCamp.name}`, '#4ade80');
  }

  gainXp(amount) {
    const p = this.player;
    p.xp += amount;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level++;
      p.xpNext = Math.round(100 * Math.pow(1.26, p.level - 1));
      p.statPoints += 3;
      p.skillPoints += 1;
      this.recalcDerivedStats(true);
      this.sound.play('levelup');
      this.spawnSpriteEffect('magic', p.x, p.y, 1.6, 14);
      this.addFloatingText(p.x, p.y - 40, `УРОВЕНЬ ${p.level}!`, '#fde047', true);
      this.pushToast(`⭐ Уровень ${p.level}! +3 очка характеристик и +1 очко навыка`, '#fbbf24');
      this.checkAchievements();
    }
  }

  grantWeapon(weaponId) {
    if (!WEAPONS[weaponId]) return;
    if (!this.inventory.weapons.includes(weaponId)) {
      this.inventory.weapons.push(weaponId);
      this.weaponUpgrades[weaponId] = this.weaponUpgrades[weaponId] || 0;
      this.pushToast(`🔫 Новое оружие: ${WEAPONS[weaponId].name}!`, RARITIES[WEAPONS[weaponId].rarity].color);
    } else {
      this.weaponUpgrades[weaponId] = Math.min(10, (this.weaponUpgrades[weaponId] || 0) + 1);
      this.pushToast(`⬆️ ${WEAPONS[weaponId].name} усилено до +${this.weaponUpgrades[weaponId]}!`, '#38bdf8');
    }
    this.checkAchievements();
  }

  // ── Снаряды, трофеи и эффекты ────────────────────────────────────────
  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      if (pr.life <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }

      if (pr.fromPlayer && pr.homing) {
        let target = this.bossEntities[0] || null;
        let bestD2 = target ? dist2(pr.x, pr.y, target.x, target.y) : 260 * 260;
        for (const e of this.enemies) {
          const d2 = dist2(pr.x, pr.y, e.x, e.y);
          if (d2 < bestD2) { bestD2 = d2; target = e; }
        }
        if (target) {
          const spd = Math.hypot(pr.vx, pr.vy) || 520;
          const desired = Math.atan2(target.y - pr.y, target.x - pr.x);
          const cur = Math.atan2(pr.vy, pr.vx);
          const diff = Math.atan2(Math.sin(desired - cur), Math.cos(desired - cur));
          const next = cur + clamp(diff, -dt * 5.5, dt * 5.5);
          pr.vx = Math.cos(next) * spd;
          pr.vy = Math.sin(next) * spd;
        }
      }

      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;

      // Попадание пуль в стены зданий или во взрывные красные бочки!
      let hitObstacle = false;
      for (const bld of this.world.buildings) {
        if (Math.abs(pr.x - bld.x) < bld.colW * 0.5 && Math.abs(pr.y - (bld.y - bld.colH * 0.5)) < bld.colH * 0.5) {
          hitObstacle = true;
          break;
        }
      }
      if (!hitObstacle && pr.fromPlayer) {
        for (const nd of this.world.nodes) {
          if (nd.respawnTimer > 0 || (!nd.explosive && nd.kind !== 'crates' && nd.kind !== 'barrel')) continue;
          if (dist2(pr.x, pr.y, nd.x, nd.y) <= (pr.radius + nd.radius) ** 2) {
            this.damageNode(nd, pr.damage);
            hitObstacle = true;
            break;
          }
        }
      }
      if (hitObstacle) {
        this.projectiles.splice(i, 1);
        continue;
      }

      if (pr.fromPlayer) {
        let consumed = false;
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          if (dist2(pr.x, pr.y, e.x, e.y) <= (pr.radius + e.radius) ** 2) {
            this.onPlayerProjHit(pr, e, false);
            if (pr.pierce > 0) pr.pierce--;
            else { consumed = true; break; }
          }
        }
        if (!consumed) {
          for (let j = this.bossEntities.length - 1; j >= 0; j--) {
            const b = this.bossEntities[j];
            if (dist2(pr.x, pr.y, b.x, b.y) <= (pr.radius + b.radius) ** 2) {
              this.onPlayerProjHit(pr, b, true);
              consumed = true;
              break;
            }
          }
        }
        if (consumed) this.projectiles.splice(i, 1);
      } else {
        const p = this.player;
        if (!p.dead && p.z < 18 && dist2(pr.x, pr.y, p.x, p.y) <= (pr.radius + p.radius) ** 2) {
          if (pr.splashRadius) {
            this.spawnSpriteEffect('explosion', pr.x, pr.y, 1.1, 16);
          }
          this.damagePlayer(pr.damage);
          this.projectiles.splice(i, 1);
        }
      }
    }
  }

  onPlayerProjHit(pr, target, isBoss) {
    this.bumpCombo();
    if (pr.splashRadius > 0) {
      this.spawnSpriteEffect('magic', pr.x, pr.y, 1.35, 16);
      this.shockwaves.push({
        x: pr.x, y: pr.y, radius: 10, maxRadius: pr.splashRadius,
        color: pr.color, friendly: true, damage: 0
      });
      for (let k = this.enemies.length - 1; k >= 0; k--) {
        const other = this.enemies[k];
        if (other !== target && dist2(pr.x, pr.y, other.x, other.y) <= (pr.splashRadius + other.radius) ** 2) {
          this.damageEnemy(other, Math.round(pr.damage * 0.65), false, pr.color);
        }
      }
    }
    if (isBoss) this.damageBoss(target, pr.damage, pr.isCrit);
    else this.damageEnemy(target, pr.damage, pr.isCrit);
  }

  updateDrops(dt) {
    const p = this.player;
    const magnetR2 = 128 * 128;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.life -= dt;
      if (d.life <= 0) {
        this.drops.splice(i, 1);
        continue;
      }
      const d2 = dist2(d.x, d.y, p.x, p.y);
      if (d2 < magnetR2) {
        const dist = Math.sqrt(d2) || 1;
        d.x += ((p.x - d.x) / dist) * 320 * dt;
        d.y += ((p.y - d.y) / dist) * 320 * dt;
        if (dist < 24) {
          this.sound.play('pickup');
          if (d.kind === 'coin') {
            this.inventory.coins += d.amount;
            this.addFloatingText(p.x, p.y - 20, `+${d.amount} 🪙`, '#fbbf24');
          } else if (d.kind === 'ammo') {
            this.inventory.ammo = Math.min(this.getMaxAmmo(), this.inventory.ammo + d.amount);
            this.addFloatingText(p.x, p.y - 20, `+${d.amount} патронов`, '#fde047');
          } else if (d.kind === 'item') {
            this.grantItem(d.itemId, d.amount);
            this.addFloatingText(p.x, p.y - 20, `+${d.amount} ${ITEMS[d.itemId]?.name || ''}`, '#4ade80');
          } else if (d.kind === 'resource') {
            this.inventory.resources[d.resId] = (this.inventory.resources[d.resId] || 0) + d.amount;
            this.addFloatingText(p.x, p.y - 20, `+${d.amount} ${RESOURCES[d.resId].emoji}`, '#38bdf8');
          }
          this.drops.splice(i, 1);
        }
      }
    }
  }

  updateEffects(dt) {
    for (let i = this.spriteEffects.length - 1; i >= 0; i--) {
      const fx = this.spriteEffects[i];
      fx.age += dt;
      fx.frame = Math.floor(fx.age * fx.fps);
      if (fx.frame >= fx.totalFrames) {
        this.spriteEffects.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) { this.particles.splice(i, 1); continue; }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.90;
      pt.vy *= 0.90;
    }

    for (let i = this.slashes.length - 1; i >= 0; i--) {
      this.slashes[i].life -= dt;
      if (this.slashes[i].life <= 0) this.slashes.splice(i, 1);
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += 360 * dt;
      if (!sw.friendly && !sw.hitPlayer && !this.player.dead && this.player.z < 14) {
        const d = Math.hypot(this.player.x - sw.x, this.player.y - sw.y);
        if (Math.abs(d - sw.radius) < 22) {
          sw.hitPlayer = true;
          this.damagePlayer(sw.damage);
        }
      }
      if (sw.radius >= sw.maxRadius) this.shockwaves.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.y -= 32 * dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    for (let i = this.toasts.length - 1; i >= 0; i--) {
      this.toasts[i].life -= dt;
      if (this.toasts[i].life <= 0) this.toasts.splice(i, 1);
    }
  }

  // ── Интерактивные объекты: костры, NPC, транспорт, двери зданий и бункеры ──
  checkWorldInteractions() {
    const p = this.player;
    for (const c of CAMPFIRES) {
      if (!this.unlockedCamps.includes(c.id) && dist2(p.x, p.y, c.x, c.y) < 120 * 120) {
        this.unlockedCamps.push(c.id);
        this.sound.play('levelup');
        this.pushToast(`🔥 Открыта точка перемещения: ${c.name}`, '#fb923c');
        this.advanceQuest('campfire', 1, { campId: c.id });
      }
    }
  }

  getNearbyInteractable() {
    const p = this.player;
    if (p.vehicleId) {
      const v = this.world.vehicles.find(vh => vh.id === p.vehicleId);
      return { type: 'vehicle_exit', target: v, label: `🚗 Выйти из транспорта` };
    }

    for (const npc of NPCS) {
      if (dist2(p.x, p.y, npc.x, npc.y) < 88 * 88) {
        return { type: 'npc', target: npc, label: `Поговорить: ${npc.name}` };
      }
    }

    for (const v of this.world.vehicles) {
      if (v.drivable && dist2(p.x, p.y, v.x, v.y) < 76 * 76) {
        return { type: 'vehicle', target: v, label: `🚗 Сесть за руль: ${v.name}` };
      }
    }

    // Двери зданий (вход расположен по центру фасада `bld.x, bld.y + 12`)
    for (const bld of this.world.buildings) {
      if (!bld.interactType) continue;
      const doorX = bld.x;
      const doorY = bld.y + 14;
      if (dist2(p.x, p.y, doorX, doorY) < 78 * 78) {
        if (bld.interactType === 'shop') {
          return { type: 'building_shop', target: bld, label: `🏪 Войти в ${bld.name}` };
        }
        if (bld.interactType === 'heal') {
          return { type: 'building_heal', target: bld, label: `🏥 Медпомощь: ${bld.name}` };
        }
        if (bld.interactType === 'secret_vault') {
          if (this.discoveredSecrets.includes(bld.secretId)) continue;
          const sec = SECRETS.find(s => s.id === bld.secretId);
          const keyNote = sec?.requiresKey ? ' (нужен Ключ 🗝️)' : '';
          return { type: 'secret_vault', target: { bld, sec }, label: `🗝️ Открыть: ${bld.name}${keyNote}` };
        }
        if (bld.interactType === 'loot_once' && !bld.looted) {
          return { type: 'building_loot', target: bld, label: `📦 Обыскать: ${bld.name}` };
        }
      }
    }

    for (const c of CAMPFIRES) {
      if (dist2(p.x, p.y, c.x, c.y) < 92 * 92) {
        return { type: 'campfire', target: c, label: `🔥 Отдохнуть у костра` };
      }
    }
    return null;
  }

  toggleVehicle(veh) {
    const p = this.player;
    if (p.vehicleId) {
      const cur = this.world.vehicles.find(v => v.id === p.vehicleId);
      p.vehicleId = null;
      if (cur) {
        cur.vx = 0;
        cur.vy = 0;
        p.x = cur.x;
        p.y = cur.y + cur.radius + 18;
      }
      this.sound.play('ui');
      return { type: 'vehicle_exit' };
    }
    if (veh && veh.drivable) {
      p.vehicleId = veh.id;
      p.x = veh.x;
      p.y = veh.y;
      this.stats.droveVehicle = (this.stats.droveVehicle || 0) + 1;
      this.sound.play('vehicle');
      this.pushToast(`🚗 Вы за рулём: ${veh.name}! Тараньте врагов на скорости!`, '#38bdf8');
      this.checkAchievements();
      return { type: 'vehicle_enter', vehicle: veh };
    }
    return null;
  }

  interact() {
    const inter = this.getNearbyInteractable();
    if (!inter) return null;

    if (inter.type === 'vehicle_exit') return this.toggleVehicle(null);
    if (inter.type === 'vehicle') return this.toggleVehicle(inter.target);

    if (inter.type === 'campfire') {
      this.player.hp = this.player.maxHp;
      this.player.stamina = this.player.maxStamina;
      this.sound.play('heal');
      this.saveGame(true);
      this.pushToast(`🔥 Здоровье и силы восстановлены (${inter.target.name})`, '#4ade80');
      return inter;
    }

    if (inter.type === 'building_shop') {
      this.sound.play('ui');
      return { type: 'open_shop', target: inter.target };
    }

    if (inter.type === 'building_heal') {
      this.player.hp = this.player.maxHp;
      this.player.hunger = Math.max(85, this.player.hunger);
      this.sound.play('heal');
      this.spawnSpriteEffect('magic', this.player.x, this.player.y, 1.3, 15);
      this.pushToast('🏥 Врачи Больницы полностью восстановили ваше здоровье!', '#4ade80');
      return inter;
    }

    if (inter.type === 'building_loot') {
      const bld = inter.target;
      bld.looted = true;
      if (!this.lootedBuildings.includes(bld.id)) this.lootedBuildings.push(bld.id);
      const coins = randInt(35, 75);
      const ammo = randInt(18, 36);
      this.inventory.coins += coins;
      this.grantItem('ammo', ammo);
      this.grantItem('medkit', 1);
      if (bld.kind === 'police' || bld.kind === 'base' || Math.random() < 0.35) {
        this.grantItem('key', 1);
        this.grantItem('grenade', 2);
        this.pushToast(`📦 Найдено в «${bld.name}»: +${coins}🪙, +${ammo} патр., Аптечка, 2 Гранаты и Ключ!`, '#fbbf24');
      } else {
        this.pushToast(`📦 Обыскано «${bld.name}»: +${coins}🪙, +${ammo} патронов и Аптечка!`, '#4ade80');
      }
      this.sound.play('unlock');
      return inter;
    }

    if (inter.type === 'secret_vault') {
      const { bld, sec } = inter.target;
      if (!sec) return null;
      if (sec.requiresKey && (this.inventory.consumables.key || 0) <= 0) {
        this.pushToast('🔒 Заперто! Нужен Серебряный Ключ (ищи в Полиции, у боссов или купи в SHOP)', '#f59e0b');
        return null;
      }
      if (sec.requiresKey) {
        this.inventory.consumables.key--;
      }
      this.discoveredSecrets.push(sec.id);
      bld.looted = true;
      this.inventory.coins += sec.coins;
      this.grantWeapon(sec.rewardWeapon);
      for (const it of sec.rewardItems || []) {
        this.grantItem(it.id, it.count);
      }
      this.sound.play('unlock');
      this.spawnSpriteEffect('magic', bld.x, bld.y, 1.6, 14);
      this.pushToast(`🗝️ ОТКРЫТО: ${sec.name}! Получено: ${WEAPONS[sec.rewardWeapon]?.name} и +${sec.coins}🪙!`, '#fbbf24');
      this.advanceQuest('secret', 1);
      this.checkAchievements();
      this.saveGame(true);
      return inter;
    }

    if (inter.type === 'npc') {
      const npc = inter.target;
      if (npc.action === 'heal_medic') {
        this.player.hp = this.player.maxHp;
        this.sound.play('heal');
      } else if (npc.action === 'farmer_food') {
        if ((this.inventory.consumables.food || 0) < 3) {
          this.grantItem('food', 1);
        }
        this.player.hunger = this.player.maxHunger;
        this.sound.play('pickup');
      } else {
        this.sound.play('ui');
      }
      return inter;
    }
    return null;
  }

  fastTravel(campId) {
    if (!this.unlockedCamps.includes(campId)) return false;
    const camp = CAMPFIRES.find(c => c.id === campId);
    if (!camp) return false;
    this.player.vehicleId = null;
    this.player.x = camp.x;
    this.player.y = camp.y + 42;
    this.player.z = 0;
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.sound.play('skill');
    this.pushToast(`🧭 Перемещение: ${camp.name}`, '#38bdf8');
    return true;
  }

  // ── Торговля в SHOP, Ремесло, Прокачка оружия и Характеристик ────────
  buyShopItem(kind, id) {
    if (kind === 'item') {
      const item = ITEMS[id];
      if (!item) return false;
      if (this.inventory.coins < item.price) {
        this.pushToast('Недостаточно монет!', '#ef4444');
        return false;
      }
      if (id === 'ammo' && this.inventory.ammo >= this.getMaxAmmo()) {
        this.pushToast('Подсумки патронов полны! Купи Рюкзак для расширения', '#f59e0b');
        return false;
      }
      if (id === 'backpack' && this.inventory.backpackLevel >= 4) {
        this.pushToast('У вас уже максимальный Рюкзак 4-го уровня!', '#4ade80');
        return false;
      }
      this.inventory.coins -= item.price;
      this.grantItem(id, 1);
      this.sound.play('pickup');
      this.pushToast(`🏪 Куплено: ${item.name}`, '#4ade80');
      return true;
    }

    if (kind === 'weapon') {
      const w = WEAPONS[id];
      if (!w || this.inventory.weapons.includes(id)) return false;
      if (this.inventory.coins < w.price) {
        this.pushToast('Недостаточно монет!', '#ef4444');
        return false;
      }
      this.inventory.coins -= w.price;
      this.grantWeapon(id);
      this.equipWeapon(id);
      this.sound.play('levelup');
      return true;
    }
    return false;
  }

  equipWeapon(weaponId) {
    if (!this.inventory.weapons.includes(weaponId)) return false;
    this.inventory.equippedWeapon = weaponId;
    this.sound.play('ui');
    return true;
  }

  upgradeWeapon(weaponId) {
    if (!this.inventory.weapons.includes(weaponId)) return false;
    const cur = this.weaponUpgrades[weaponId] || 0;
    if (cur >= 10) return false;
    const costCoins = 45 + cur * 40;
    const costScrap = 1 + Math.floor(cur / 2);
    if (this.inventory.coins < costCoins || (this.inventory.resources.scrap || 0) < costScrap) {
      this.pushToast('Нужно больше монет и металлолома (⚙️)!', '#f59e0b');
      return false;
    }
    this.inventory.coins -= costCoins;
    this.inventory.resources.scrap -= costScrap;
    this.weaponUpgrades[weaponId] = cur + 1;
    this.sound.play('levelup');
    this.pushToast(`⚙️ ${WEAPONS[weaponId].name} улучшено до +${cur + 1}!`, '#4ade80');
    this.checkAchievements();
    return true;
  }

  craftRecipe(recipeId) {
    const rec = RECIPES.find(r => r.id === recipeId);
    if (!rec) return false;
    if (rec.weaponId && this.inventory.weapons.includes(rec.weaponId)) {
      this.pushToast('Это оружие уже собрано!', '#94a3b8');
      return false;
    }
    if (this.inventory.coins < rec.costCoins) {
      this.pushToast('Недостаточно монет!', '#ef4444');
      return false;
    }
    for (const [resId, need] of Object.entries(rec.ingredients)) {
      if ((this.inventory.resources[resId] || 0) < need) {
        this.pushToast(`Не хватает ресурса: ${RESOURCES[resId].name}`, '#f59e0b');
        return false;
      }
    }

    this.inventory.coins -= rec.costCoins;
    for (const [resId, need] of Object.entries(rec.ingredients)) {
      this.inventory.resources[resId] -= need;
    }

    if (rec.weaponId) {
      this.grantWeapon(rec.weaponId);
      this.equipWeapon(rec.weaponId);
    } else if (rec.resultId === 'ammo') {
      this.inventory.ammo = Math.min(this.getMaxAmmo(), this.inventory.ammo + rec.amount);
      this.pushToast(`🛠️ Создано: +${rec.amount} патронов`, '#4ade80');
    } else if (rec.resultId) {
      this.grantItem(rec.resultId, rec.amount);
      this.pushToast(`🛠️ Создано: ${ITEMS[rec.resultId]?.name} ×${rec.amount}`, '#4ade80');
    }

    this.stats.totalCrafted++;
    this.sound.play('pickup');
    this.checkAchievements();
    return true;
  }

  allocateStat(statKey) {
    if (this.player.statPoints <= 0) return false;
    if (!(statKey in this.player.stats)) return false;
    this.player.statPoints--;
    this.player.stats[statKey]++;
    this.recalcDerivedStats(false);
    this.sound.play('ui');
    return true;
  }

  upgradeSkill(skillId) {
    const sk = this.skills[skillId];
    const def = SKILLS[skillId];
    if (!sk || !def) return false;
    if (this.player.skillPoints <= 0) return false;
    if (this.player.level < def.unlockLevel) {
      this.pushToast(`Требуется уровень ${def.unlockLevel}`, '#f59e0b');
      return false;
    }
    if (sk.level >= 5) return false;
    this.player.skillPoints--;
    sk.level++;
    this.sound.play('levelup');
    this.pushToast(`✨ Навык «${def.name}» повышен до ур. ${sk.level}`, '#38bdf8');
    return true;
  }

  // ── Квесты и Достижения ──────────────────────────────────────────────
  getActiveQuest() {
    return QUESTS[this.questIndex] || null;
  }

  advanceQuest(kind, amount = 1, meta = {}) {
    const q = this.getActiveQuest();
    if (!q) return;

    let completedAll = true;
    for (let idx = 0; idx < q.goals.length; idx++) {
      const g = q.goals[idx];
      const key = `${q.id}_${idx}`;
      if (g.kind === kind) {
        const matchBiome = !g.biome || g.biome === meta.biome;
        const matchCamp = !g.campId || g.campId === meta.campId;
        const matchBoss = !g.bossId || g.bossId === meta.bossId;
        if (matchBiome && matchCamp && matchBoss) {
          this.questProgress[key] = Math.min(g.target, (this.questProgress[key] || 0) + amount);
        }
      }
      // Синхронизация уже открытых лагерей/бункеров/боссов
      if (g.kind === 'campfire' && this.unlockedCamps.includes(g.campId)) {
        this.questProgress[key] = 1;
      }
      if (g.kind === 'secret' && this.discoveredSecrets.length >= g.target) {
        this.questProgress[key] = g.target;
      }
      if (g.kind === 'boss' && this.defeatedBosses.includes(g.bossId)) {
        this.questProgress[key] = 1;
      }
      if ((this.questProgress[key] || 0) < g.target) completedAll = false;
    }

    if (completedAll) {
      this.inventory.coins += q.rewards.coins || 0;
      if (q.rewards.xp) this.gainXp(q.rewards.xp);
      for (const it of q.rewards.items || []) {
        this.grantItem(it.id, it.count);
      }
      this.sound.play('levelup');
      this.pushToast(`📜 КВЕСТ ВЫПОЛНЕН: «${q.title}» (+${q.rewards.coins}🪙)`, '#4ade80');
      this.questIndex++;
      this.advanceQuest('sync', 0);
    }
  }

  checkAchievements() {
    for (const ach of ACHIEVEMENTS) {
      if (this.unlockedAchievements.includes(ach.id)) continue;
      if (ach.check(this)) {
        this.unlockedAchievements.push(ach.id);
        this.inventory.coins += ach.reward;
        this.pushToast(`🏅 Достижение «${ach.name}»! +${ach.reward}🪙`, '#fbbf24');
      }
    }
  }

  spawnDust(x, y, color, count = 6) {
    const cap = this.settings.quality === 'low' ? 35 : 90;
    if (this.particles.length > cap) return;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = randRange(25, 110);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        size: randRange(2, 4),
        color,
        life: randRange(0.2, 0.42),
        maxLife: 0.42
      });
    }
  }

  addFloatingText(x, y, text, color = '#ffffff', big = false) {
    if (this.floatingTexts.length > 26) this.floatingTexts.shift();
    this.floatingTexts.push({ x, y, text, color, big, life: 0.85 });
  }

  pushToast(text, color = '#f8fafc') {
    this.toasts.unshift({ text, color, life: 3.6 });
    if (this.toasts.length > 4) this.toasts.pop();
  }
}
