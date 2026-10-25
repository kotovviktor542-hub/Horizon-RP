// Игровое ядро VEXMORA — БОЛЬШОЕ ОБНОВЛЕНИЕ 2.0 (Пиксель-арт 2D Action-Survival RPG)
// 24 оружия с магазинами/перезарядкой/модификациями, 16 типов врагов с особым ИИ,
// 10 многофазных боссов с телеграфами атак, спасение 10 выживших (клетки, тревога, волны,
// сопровождение, таймеры), развитие Убежища (5 отсеков), боец-напарник и спецоперации.
// Сохранения совместимы с прежним ключом — прогресс игрока не теряется.

import {
  WORLD_CONFIG, RARITIES, BIOMES, CAMPFIRES, NPCS, WEAPONS, WEAPON_MODS, BASE_ROOMS,
  ITEMS, RESOURCES, RECIPES, SKILLS, SKILL_TREE, ENEMIES, BOSSES, SECRETS, QUESTS, ACHIEVEMENTS,
  RESCUE_MISSIONS, MISSION_TEMPLATES, LOCATIONS, ARTIFACTS
} from './data.js';
import { createWorld, dist2, getBiomeIdAt, getLocationIdAt } from './world.js';

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
        luck: 1,
        magic: 1
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
      slowTimer: 0,
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

    // ── VEXMORA 2.0: магазины/перезарядка, модификации, перки, база, спасение, напарник, контракты ──
    this.weaponMag = { pistol: WEAPONS.pistol.magSize, knife: 0 };
    this.reloadTimer = 0;
    this.reloadWeaponId = null;
    this.weaponMods = {};            // weaponId -> [modId, ...]
    this.unlockedMods = [];          // моды, полученные бесплатно (секреты/контейнеры) — установка без монет
    this.skillTree = {};             // perkId -> rank
    this.baseLevels = { medbay: 1, market: 1, workshop: 0, garage: 0, barracks: 1 };
    this.rescuedIds = [];
    this.rescueSites = RESCUE_MISSIONS.map(def => ({
      id: def.id, def, x: def.x, y: def.y,
      npcX: def.x, npcY: def.y, npcHp: 130, maxNpcHp: 130,
      state: 'idle', alarmDisabled: !def.hasAlarm, activated: false,
      wave: 0, timer: 0, failTimer: 0, ambushTimer: 8, animTime: Math.random() * 4
    }));
    this.companionActive = false;
    this.companion = null;           // {x,y,hp,maxHp,attackCd,animTime,respawnTimer}
    this.activeContract = null;
    this.contractSeq = 0;
    this.contractNpc = null;         // сопровождаемый/пленный персонаж спецоперации
    this.telegraphs = [];            // красные зоны предупреждения боссов/артиллерии
    this.manualObjective = null;     // ручная метка цели из вкладок «Спасение»/«Квесты»
    this.baseJeepSpawned = false;

    this.skills = {
      slash_wave: { level: 1, cd: 0 },
      magic_nova: { level: 0, cd: 0 },
      adrenaline: { level: 0, cd: 0 },
      fire_strike: { level: 0, cd: 0 },
      ice_blast: { level: 0, cd: 0 },
      shadow_teleport: { level: 0, cd: 0 }
    };

    // RISE OF THE ABYSS: локации, артефакты, кинематография, события
    this.discoveredLocations = [];
    this.artifacts = [];
    this.lootedChests = [];
    this.currentLocationId = null;
    this.bossIntro = null;
    this.locationBanner = null;
    this.eventTimer = 110;
    this.musicTheme = null;

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
      contractsDone: 0,
      baseUpgrades: 0,
      modsInstalled: 0,
      rescuesDone: 0,
      eliteKills: 0,
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
    return 120 + (this.inventory.backpackLevel || 0) * 65 + (this.baseLevels.barracks || 0) * 35;
  }

  getLootMultiplier() {
    const scav = this.getPerkRank('perk_scavenger');
    return (1 + (this.inventory.backpackLevel || 0) * 0.15 + this.player.stats.luck * 0.04) * (1 + scav * 0.15);
  }

  getPerkRank(perkId) {
    return this.skillTree[perkId] || 0;
  }

  hasMod(weaponId, modId) {
    return (this.weaponMods[weaponId] || []).includes(modId);
  }

  getMagSize(weaponId = this.inventory.equippedWeapon) {
    const w = WEAPONS[weaponId];
    if (!w || !w.magSize) return 0;
    return Math.round(w.magSize * (this.hasMod(weaponId, 'mod_mag') ? 1.5 : 1));
  }

  getMag(weaponId = this.inventory.equippedWeapon) {
    const w = WEAPONS[weaponId];
    if (!w || !w.magSize) return 0;
    if (this.weaponMag[weaponId] === undefined) this.weaponMag[weaponId] = this.getMagSize(weaponId);
    return this.weaponMag[weaponId];
  }

  getReloadTime(weaponId = this.inventory.equippedWeapon) {
    const w = WEAPONS[weaponId];
    if (!w || !w.reloadTime) return 0;
    let t = w.reloadTime * (this.hasMod(weaponId, 'mod_mag') ? 0.7 : 1);
    t *= Math.max(0.5, 1 - this.getPerkRank('perk_fast_hands') * 0.15);
    return Math.max(0.3, t);
  }

  getWeaponRange(weaponId = this.inventory.equippedWeapon) {
    const w = WEAPONS[weaponId] || WEAPONS.knife;
    return Math.round(w.range * (this.hasMod(weaponId, 'mod_scope') ? 1.18 : 1));
  }

  isReloading() {
    return this.reloadTimer > 0;
  }

  startReload() {
    const p = this.player;
    if (p.dead || this.reloadTimer > 0) return false;
    const wId = this.inventory.equippedWeapon;
    const w = WEAPONS[wId];
    if (!w || !w.magSize) return false;
    if (this.getMag(wId) >= this.getMagSize(wId)) return false;
    if (w.ammoCost > 0 && this.inventory.ammo <= 0 && this.getMag(wId) <= 0) return false;
    this.reloadWeaponId = wId;
    this.reloadTimer = this.getReloadTime(wId);
    this.sound.play('ui');
    return true;
  }

  finishReload() {
    const wId = this.reloadWeaponId;
    this.reloadTimer = 0;
    this.reloadWeaponId = null;
    if (!wId || !WEAPONS[wId]) return;
    const need = this.getMagSize(wId) - this.getMag(wId);
    if (need <= 0) return;
    if (WEAPONS[wId].ammoCost > 0) {
      const take = Math.min(need, this.inventory.ammo);
      this.inventory.ammo -= take;
      this.weaponMag[wId] = this.getMag(wId) + take;
    } else {
      this.weaponMag[wId] = this.getMagSize(wId);
    }
    this.sound.play('pickup');
  }

  reloadWeapon() {
    return this.startReload();
  }

  recalcDerivedStats(refill = false) {
    const p = this.player;
    const vit = p.stats.vitality;
    const agi = p.stats.agility;
    const bp = this.inventory.backpackLevel || 0;
    const prevMaxHp = p.maxHp || 130;
    p.maxHp = Math.round(112 + p.level * 16 + vit * 22 + bp * 25 + this.getPerkRank('perk_kevlar') * 30);
    p.maxStamina = Math.round(96 + agi * 8 + p.level * 2 + bp * 6 + this.getPerkRank('perk_second_wind') * 15);
    if (refill) {
      p.hp = p.maxHp;
      p.stamina = p.maxStamina;
    } else if (p.maxHp > prevMaxHp) {
      p.hp = Math.min(p.maxHp, p.hp + (p.maxHp - prevMaxHp));
    }
  }

  getVehicleSpeed(v) {
    if (!v) return 320;
    return Math.round((v.baseSpeed || v.maxSpeed || 330) * (1 + (this.baseLevels.garage || 0) * 0.10));
  }

  getMoveSpeed() {
    const p = this.player;
    if (p.vehicleId) {
      const v = this.world.vehicles.find(vh => vh.id === p.vehicleId);
      if (v) return this.getVehicleSpeed(v);
    }
    let spd = 205 + p.stats.agility * 7;
    if (this.hasArtifact('art_moon')) spd *= 1.08;
    if (p.slowTimer > 0) spd *= 0.62;
    if (p.sprinting && p.stamina > 4) spd *= 1.28;
    if (p.shieldBuffTimer > 0) spd *= 1.20;
    if (p.hunger <= 5) spd *= 0.86;
    return spd;
  }

  getWeaponDamage(weaponId = this.inventory.equippedWeapon) {
    const w = WEAPONS[weaponId] || WEAPONS.knife;
    const upg = this.weaponUpgrades[weaponId] || 0;
    const p = this.player;
    let mult = (1 + upg * 0.18) * (1 + p.stats.power * 0.11 + (p.level - 1) * 0.05);
    if (this.hasArtifact('art_sun')) mult *= 1.10;                            // Солнечная Руна: +10% урона
    if (w.category === 'magic') {
      mult *= 1 + ((p.stats.magic || 1) - 1) * 0.09;                          // Характеристика «Магия»
      if (this.hasArtifact('art_abyss')) mult *= 1.12;                        // Ядро Бездны усиливает магию
    }
    mult *= 1 + (this.baseLevels.workshop || 0) * 0.06;                       // Инженерный Цех Базы
    if (w.category === 'gun' || w.category === 'explosive') {
      mult *= 1 + this.getPerkRank('perk_hollow_point') * 0.08;               // перк «Экспансивный калибр»
    }
    if (this.hasMod(weaponId, 'mod_barrel')) mult *= 1.22;                    // Бронебойный Ствол
    if (this.hasMod(weaponId, 'mod_cryo')) mult *= 1.12;                      // Крио-Импульс
    return Math.round(w.baseDamage * mult);
  }

  getCritChance(weaponId = this.inventory.equippedWeapon) {
    const w = WEAPONS[weaponId] || WEAPONS.knife;
    let c = 0.07 + this.player.stats.luck * 0.03 + (w.critBonus || 0) + this.getPerkRank('perk_exec_crit') * 0.05;
    if (this.hasArtifact('art_storm')) c += 0.06;                             // Грозовой Глаз: +6% крита
    if (this.hasMod(weaponId, 'mod_scope')) c += 0.15;                        // Лазерный Коллиматор
    return Math.min(0.72, c);
  }

  // Постепенное открытие арсенала: тир оружия, уровень героя, победы над боссами и Торговый Отсек
  getWeaponUnlockStatus(weaponId) {
    const w = WEAPONS[weaponId];
    if (!w) return { unlocked: false, reason: 'Неизвестное оружие' };
    if (this.inventory.weapons.includes(weaponId)) return { unlocked: true, reason: 'В арсенале' };
    const lvl = this.player.level;
    const bosses = this.defeatedBosses.length;
    const market = this.baseLevels.market || 0;
    switch (w.tier || 1) {
      case 1: return { unlocked: true, reason: 'Доступно у Торговца' };
      case 2: return (lvl >= 2 || market >= 1)
        ? { unlocked: true, reason: 'Доступно у Торговца' }
        : { unlocked: false, reason: 'Нужен уровень 2 героя' };
      case 3: return (bosses >= 1 && lvl >= 4)
        ? { unlocked: true, reason: 'Открыто после 1-го босса' }
        : { unlocked: false, reason: 'Нужны: уровень 4 и победа над 1 боссом' };
      case 4: return (bosses >= 3 && lvl >= 6)
        ? { unlocked: true, reason: 'Открыто после 3 боссов' }
        : { unlocked: false, reason: 'Нужны: уровень 6 и победы над 3 боссами' };
      default: return (bosses >= 5 && lvl >= 8)
        ? { unlocked: true, reason: 'Открыто после 5 боссов' }
        : { unlocked: false, reason: 'Нужны: уровень 8 и победы над 5 боссами' };
    }
  }

  getShopPrice(kind, def) {
    if (kind === 'weapon') {
      const disc = 1 - Math.max(0, (this.baseLevels.market || 1) - 1) * 0.05;
      return Math.round((def.price || 0) * disc);
    }
    return def.price || 0;
  }

  hasArtifact(artifactId) {
    return (this.artifacts || []).includes(artifactId);
  }

  collectArtifact(artifactId) {
    const def = ARTIFACTS[artifactId];
    if (!def) return false;
    if (this.artifacts.includes(artifactId)) {
      this.pushToast(`✨ Артефакт «${def.name}» уже в коллекции`, '#94a3b8');
      return false;
    }
    this.artifacts.push(artifactId);
    this.sound.play('levelup');
    this.spawnSpriteEffect('magic', this.player.x, this.player.y, 1.7, 14);
    this.pushToast(`${def.icon} АРТЕФАКТ: ${def.name}! ${def.desc}`, '#f0abfc');
    this.checkAchievements();
    this.saveGame(true);
    return true;
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
        weaponMag: this.weaponMag,
        weaponMods: this.weaponMods,
        unlockedMods: this.unlockedMods,
        skillTree: this.skillTree,
        baseLevels: this.baseLevels,
        rescuedIds: this.rescuedIds,
        companionActive: this.companionActive,
        skills: Object.fromEntries(Object.entries(this.skills).map(([k, v]) => [k, { level: v.level }])),
        discoveredLocations: this.discoveredLocations,
        artifacts: this.artifacts,
        lootedChests: this.lootedChests,
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
      if (data.weaponMag) Object.assign(this.weaponMag, data.weaponMag);
      if (data.weaponMods) this.weaponMods = data.weaponMods;
      if (Array.isArray(data.unlockedMods)) this.unlockedMods = data.unlockedMods.filter(m => WEAPON_MODS[m]);
      if (data.skillTree) this.skillTree = data.skillTree;
      if (data.baseLevels) Object.assign(this.baseLevels, data.baseLevels);
      this.rescuedIds = Array.isArray(data.rescuedIds) ? data.rescuedIds : [];
      for (const site of this.rescueSites) {
        if (this.rescuedIds.includes(site.id)) { site.state = 'done'; site.activated = true; }
      }
      this.companionActive = !!data.companionActive && this.rescuedIds.includes('res_fighter_1');
      if (this.companionActive) this.spawnCompanion(true);
      if (data.skills) {
        for (const k of Object.keys(this.skills)) {
          if (data.skills[k]) this.skills[k].level = data.skills[k].level || 0;
        }
      }
      // RISE OF THE ABYSS: старые сохранения продолжают работать — новые поля получают значения по умолчанию
      this.player.stats.magic = this.player.stats.magic ?? 1;
      this.player.slowTimer = this.player.slowTimer || 0;
      this.discoveredLocations = Array.isArray(data.discoveredLocations) ? data.discoveredLocations.filter(id => LOCATIONS[id]) : [];
      this.artifacts = Array.isArray(data.artifacts) ? data.artifacts.filter(id => ARTIFACTS[id]) : [];
      this.lootedChests = Array.isArray(data.lootedChests) ? data.lootedChests : [];
      for (const ch of this.world.chests || []) {
        if (this.lootedChests.includes(ch.id)) ch.looted = true;
      }
      if (data.stats) this.stats.eliteKills = this.stats.eliteKills || 0;
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
      if (data.stats) {
        const fresh = this.stats;
        Object.assign(this.stats, data.stats);
        this.stats.contractsDone = this.stats.contractsDone || 0;
        this.stats.baseUpgrades = this.stats.baseUpgrades || fresh.baseUpgrades || 0;
        this.stats.modsInstalled = this.stats.modsInstalled || 0;
        this.stats.rescuesDone = this.stats.rescuesDone || this.rescuedIds.length || 0;
      }

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
        sprite: b.sprite,
        desc: b.desc,
        unlocksZone: b.unlocksZone,
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
        rewardArtifact: b.rewardArtifact || null,
        intro: b.intro || b.desc || '',
        introShown: false,
        rewardItems: b.rewardItems || [],
        actionTimer: 2.2,
        phase: 1,
        shieldTimer: 0,
        aimTimer: 0,
        aiming: false,
        burstLeft: 0,
        burstTimer: 0,
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

  spawnEnemyAt(x, y, forcedKind = null, ignoreSafeZone = false, elite = false) {
    if (!ignoreSafeZone) {
      for (const c of CAMPFIRES) {
        if (dist2(x, y, c.x, c.y) < 250 * 250) return null;
      }
    }
    const biomeId = getBiomeIdAt(x, y);
    const locId = getLocationIdAt(x, y);
    const pool = (locId && LOCATIONS[locId]?.enemies?.length) ? LOCATIONS[locId].enemies : BIOMES[biomeId].enemies;
    const isNight = this.isNightTime();
    let kind = forcedKind || pool[Math.floor(Math.random() * pool.length)];
    if (!forcedKind && isNight && biomeId === 'forest' && Math.random() < 0.35) {
      kind = 'infected_runner';
    }
    let tpl = ENEMIES[kind] || ENEMIES.zombie;
    const nightBoost = isNight ? 1.15 : 1.0;
    // Мини-боссы и элита не должны случайно появляться из обычного спавнера биомов
    if (!forcedKind && tpl.isMiniBoss) { kind = 'soldier'; tpl = ENEMIES.soldier; }

    const e = {
      id: `en_${Math.random().toString(36).slice(2, 9)}`,
      kind,
      sprite: tpl.sprite,
      name: tpl.name,
      biome: biomeId,
      x,
      y,
      z: tpl.flying ? 26 : 0,
      vz: 0,
      vx: 0,
      vy: 0,
      radius: tpl.radius,
      hp: Math.round(tpl.hp * nightBoost),
      maxHp: Math.round(tpl.hp * nightBoost),
      damage: Math.round(tpl.damage * nightBoost),
      speed: tpl.speed,
      behavior: tpl.behavior,
      role: tpl.role || '',
      attackRange: tpl.attackRange || 44,
      projSpeed: tpl.projSpeed || 420,
      armorMult: tpl.armorMult || 1,
      isMiniBoss: !!tpl.isMiniBoss,
      stealth: !!tpl.stealth,
      flying: !!tpl.flying,
      explodeOnDeath: !!tpl.explodeOnDeath,
      xp: Math.round(tpl.xp * (isNight ? 1.25 : 1)),
      coins: tpl.coins,
      drops: tpl.drops || [],
      slowTimer: 0,
      burnTimer: 0,
      burnDps: 0,
      slamWindup: 0,
      elite: !!elite,
      stealthTimer: randRange(1, 3),
      isStealthed: false,
      aimTimer: 0,
      aiming: false,
      specialTimer: randRange(2.5, 4.5),
      healTimer: randRange(1.5, 2.5),
      rescueId: null,
      modCacheId: null,
      contractId: null,
      aggroTarget: 'player',
      attackCd: randRange(0.4, 1.3),
      burstLeft: 0,
      burstTimer: 0,
      wanderAngle: Math.random() * Math.PI * 2,
      wanderTimer: randRange(1, 3),
      stunTimer: 0,
      hitFlash: 0,
      animTime: Math.random() * 5
    };
    if (elite) {
      e.hp = e.maxHp = Math.round(e.hp * 2.3);
      e.damage = Math.round(e.damage * 1.35);
      e.speed = Math.round(e.speed * 1.06);
      e.xp = Math.round(e.xp * 3);
      e.coins = [Math.round(e.coins[0] * 3), Math.round(e.coins[1] * 3.2)];
      e.radius = Math.round(e.radius * 1.18);
      e.name = `ЭЛИТА · ${e.name}`;
      e.drops = [...e.drops, { res: 'crystal', chance: 0.55 }, { id: 'potion', chance: 0.4 }];
    }
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
      // Медблок Убежища: пассивная полевая регенерация
      const medLvl = this.baseLevels.medbay || 0;
      if (medLvl > 0 && p.hp < p.maxHp) {
        p.hp = Math.min(p.maxHp, p.hp + dt * medLvl * 1.2);
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
    this.updateRescues(dt);
    this.updateCompanion(dt);
    this.updateContract(dt);
    this.updateTelegraphs(dt);
    this.updateRiseSystems(dt);
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
        const eliteRoll = p.level >= 5 && Math.random() < 0.055;
        const spawned = this.spawnEnemyAt(sx, sy, null, false, eliteRoll);
        if (eliteRoll && spawned) this.pushToast(`💜 Элитный враг поблизости: ${spawned.name}! Редкая добыча`, '#c084fc');
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

    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.finishReload();
    }
    p.attackTimer = Math.max(0, p.attackTimer - dt);
    p.attackAnimTimer = Math.max(0, p.attackAnimTimer - dt);
    p.hurtAnimTimer = Math.max(0, p.hurtAnimTimer - dt);
    p.grenadeTimer = Math.max(0, p.grenadeTimer - dt);
    p.dashTimer = Math.max(0, p.dashTimer - dt);
    p.invulnTimer = Math.max(0, p.invulnTimer - dt);
    p.shieldBuffTimer = Math.max(0, p.shieldBuffTimer - dt);
    p.slowTimer = Math.max(0, (p.slowTimer || 0) - dt);

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
          const vSpeed = this.getVehicleSpeed(veh);
          veh.vx = nx * vSpeed;
          veh.vy = ny * vSpeed;
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
              const ramDmg = Math.round((34 + p.level * 4) * (1 + (this.baseLevels.garage || 0) * 0.25));
              this.damageEnemy(e, ramDmg, true, '#fbbf24');
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
      if (e.isStealthed && dist2(p.x, p.y, e.x, e.y) > 150 * 150) continue;
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
    if (this.reloadTimer > 0) return false;

    let weapon = WEAPONS[this.inventory.equippedWeapon] || WEAPONS.knife;

    // ── Магазин и перезарядка ──
    if (weapon.magSize > 0) {
      const perShot = weapon.ammoCost > 0 ? weapon.ammoCost : 1;
      if (this.getMag(weapon.id) < perShot) {
        if (weapon.ammoCost > 0 && this.inventory.ammo <= 0) {
          const fallback = this.inventory.weapons.find(id => (WEAPONS[id]?.ammoCost || 0) === 0 && WEAPONS[id]?.id !== weapon.id);
          if (fallback) {
            this.inventory.equippedWeapon = fallback;
            weapon = WEAPONS[fallback];
            this.pushToast(`⚠️ Патроны кончились! В руках: ${weapon.name}`, '#f59e0b');
          } else {
            p.attackTimer = 0.35;
            this.pushToast('⚠️ Нет патронов! Подбери ящики или купи в SHOP', '#ef4444');
            return false;
          }
        } else {
          this.startReload();
          return false;
        }
      }
    }

    const speedMult = (1 + p.stats.agility * 0.025) * (p.shieldBuffTimer > 0 ? 1.25 : 1)
      * (1 + this.getPerkRank('perk_fast_hands') * 0.10);
    p.attackTimer = weapon.cooldown / speedMult;
    p.attackAnimTimer = Math.min(0.24, p.attackTimer * 0.85);

    const range = this.getWeaponRange(weapon.id);
    const aim = this.findAimAngle(range);
    this.updateFacingFromAngle(aim);

    const baseDmg = this.getWeaponDamage(weapon.id);
    const critChance = this.getCritChance(weapon.id);
    const pierceBonus = this.hasMod(weapon.id, 'mod_barrel') ? 1 : 0;

    if (weapon.magSize > 0) {
      const perShot = weapon.ammoCost > 0 ? weapon.ammoCost : 1;
      this.weaponMag[weapon.id] = Math.max(0, this.getMag(weapon.id) - perShot);
      if (this.getMag(weapon.id) <= 0 && weapon.ammoCost >= 0) {
        // Автоперезарядка начнётся при следующем нажатии, если есть резерв патронов
        if (weapon.ammoCost === 0 || this.inventory.ammo > 0) this.startReload();
      }
    }

    const muzzleX = p.x + Math.cos(aim) * 24;
    const muzzleY = p.y - 6 + Math.sin(aim) * 24;

    if (weapon.category === 'melee') {
      this.sound.play('swing');
      this.slashes.push({
        x: p.x, y: p.y - p.z * 0.5, angle: aim, arc: weapon.arc,
        range: weapon.range, color: RARITIES[weapon.rarity].color, life: 0.16, maxLife: 0.16
      });
      this.applyMeleeHit(aim, weapon.range, weapon.arc, baseDmg, critChance, weapon.knockback, weapon.id);
    } else if (weapon.category === 'tesla') {
      // Тесла-Излучатель: мгновенная цепная молния по нескольким целям
      this.sound.play('skill');
      this.spawnSpriteEffect('magic', muzzleX, muzzleY, 0.9, 18);
      let targets = [];
      let fromX = p.x, fromY = p.y;
      const pool = [...this.bossEntities, ...this.enemies].filter(t => !t.isStealthed || dist2(fromX, fromY, t.x, t.y) < 160 * 160);
      for (let c = 0; c < (weapon.chainCount || 4); c++) {
        let bestT = null, bestD2 = (c === 0 ? range : 190) ** 2;
        for (const t of pool) {
          if (targets.includes(t)) continue;
          const d2 = dist2(fromX, fromY, t.x, t.y);
          if (d2 < bestD2) { bestD2 = d2; bestT = t; }
        }
        if (!bestT) break;
        targets.push(bestT);
        fromX = bestT.x; fromY = bestT.y;
      }
      if (!targets.length) {
        this.addFloatingText(p.x, p.y - 30, 'Нет целей в радиусе Теслы', '#38bdf8');
        return true;
      }
      targets.forEach((t, idx) => {
        const isCrit = Math.random() < critChance;
        const dmg = Math.round(baseDmg * (isCrit ? 1.75 : 1) * Math.pow(0.78, idx));
        this.spawnSpriteEffect('magic', t.x, t.y - 8, 0.8, 16);
        if (t.isBoss) this.damageBoss(t, dmg, isCrit, weapon.id);
        else this.damageEnemy(t, dmg, isCrit, '#38bdf8', { weaponId: weapon.id });
      });
      this.bumpCombo();
    } else if (weapon.category === 'explosive') {
      this.sound.play('shotgun');
      this.spawnSpriteEffect('muzzle', muzzleX, muzzleY, 1.3, 22);
      const isCrit = Math.random() < critChance;
      const dmg = Math.round(baseDmg * (isCrit ? 1.6 : 1));
      this.projectiles.push({
        fromPlayer: true, kind: weapon.id === 'rocket_launcher' ? 'rocket' : 'grenade_shell',
        weaponId: weapon.id,
        x: muzzleX, y: muzzleY,
        vx: Math.cos(aim) * weapon.projSpeed, vy: Math.sin(aim) * weapon.projSpeed,
        radius: 7, damage: dmg, isCrit, pierce: 0,
        splashRadius: weapon.splashRadius || 90,
        knockback: weapon.knockback || 220,
        color: weapon.id === 'rocket_launcher' ? '#fb923c' : '#f97316',
        life: range / weapon.projSpeed
      });
    } else if (weapon.category === 'gun') {
      this.sound.play(weapon.id === 'shotgun' || weapon.id === 'auto_shotgun' ? 'shotgun' : 'gun');
      this.spawnSpriteEffect('muzzle', muzzleX, muzzleY, weapon.id === 'shotgun' || weapon.id === 'auto_shotgun' ? 1.25 : 0.95, 22);
      const pellets = weapon.pellets || 1;
      // Карабин «Сокол-3»: залп из 3 пуль расходует время одного выстрела, пули летят очередью
      for (let i = 0; i < pellets; i++) {
        const offset = pellets > 1
          ? ((i / (pellets - 1)) - 0.5) * (weapon.spread || 0.1) + randRange(-0.03, 0.03)
          : randRange(-(weapon.spread || 0.02), weapon.spread || 0.02);
        const shotAngle = aim + offset;
        const isCrit = Math.random() < critChance;
        const dmg = Math.round(baseDmg * (isCrit ? 1.75 : 1) * randRange(0.92, 1.08));
        this.projectiles.push({
          fromPlayer: true, kind: 'bullet', weaponId: weapon.id,
          x: muzzleX, y: muzzleY,
          vx: Math.cos(shotAngle) * weapon.projSpeed, vy: Math.sin(shotAngle) * weapon.projSpeed,
          radius: weapon.id === 'sniper' || weapon.id === 'railgun' ? 5 : 4,
          damage: dmg, isCrit,
          pierce: (weapon.pierce || 0) + pierceBonus,
          splashRadius: 0, knockback: weapon.knockback || 100,
          color: weapon.projColor || (weapon.id === 'sniper' ? '#fde047' : '#fbbf24'),
          life: range / weapon.projSpeed
        });
      }
      this.damageNodesInCone(aim, 44, 1.1, baseDmg);
    } else if (weapon.category === 'bow') {
      this.sound.play('swing');
      const isCrit = Math.random() < critChance;
      const dmg = Math.round(baseDmg * (isCrit ? 1.75 : 1));
      this.projectiles.push({
        fromPlayer: true, kind: 'arrow', weaponId: weapon.id,
        x: p.x + Math.cos(aim) * 18, y: p.y - 6 + Math.sin(aim) * 18,
        vx: Math.cos(aim) * weapon.projSpeed, vy: Math.sin(aim) * weapon.projSpeed,
        radius: 5, damage: dmg, isCrit,
        pierce: (weapon.pierce || 1) + pierceBonus,
        splashRadius: 0, knockback: weapon.knockback || 120,
        color: '#a3e635', life: range / weapon.projSpeed
      });
    } else if (weapon.category === 'magic') {
      this.sound.play('skill');
      const isCrit = Math.random() < critChance;
      const dmg = Math.round(baseDmg * (isCrit ? 1.75 : 1));
      this.spawnSpriteEffect('magic', muzzleX, muzzleY, 0.85, 18);
      this.projectiles.push({
        fromPlayer: true, kind: 'magic', homing: true, weaponId: weapon.id,
        x: p.x + Math.cos(aim) * 18, y: p.y - 6 + Math.sin(aim) * 18,
        vx: Math.cos(aim) * weapon.projSpeed, vy: Math.sin(aim) * weapon.projSpeed,
        radius: 8, damage: dmg, isCrit, pierce: 0,
        splashRadius: weapon.splashRadius || 72,
        knockback: weapon.knockback || 160,
        color: '#38bdf8', life: range / weapon.projSpeed
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

  applyMeleeHit(angle, range, arc, baseDmg, critChance, knockback, weaponId = null) {
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
        this.damageEnemy(e, dmg, isCrit, null, { weaponId });
        hitAny = true;
      }
    }

    for (let i = this.bossEntities.length - 1; i >= 0; i--) {
      const b = this.bossEntities[i];
      if (inCone(b.x, b.y, b.radius)) {
        const isCrit = Math.random() < critChance;
        const dmg = Math.round(baseDmg * (isCrit ? 1.8 : 1) * randRange(0.92, 1.08));
        this.damageBoss(b, dmg, isCrit, weaponId);
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
    const abyssUnlocked = skillId === 'shadow_teleport' && this.hasArtifact('art_abyss');
    if (skState.level <= 0 && !abyssUnlocked) {
      this.pushToast(`🔒 Изучи «${skDef.name}» во вкладке Герой`, '#94a3b8');
      return false;
    }
    const effLevel = Math.max(1, skState.level);
    if (skState.cd > 0) return false;
    if (p.stamina < skDef.staminaCost) {
      this.pushToast('⚡ Недостаточно энергии!', '#f59e0b');
      return false;
    }

    p.stamina -= skDef.staminaCost;
    let cdMult = Math.max(0.65, 1 - (effLevel - 1) * 0.08);
    if ((skillId === 'ice_blast' || skillId === 'magic_nova') && this.hasArtifact('art_frost')) cdMult *= 0.8;
    skState.cd = skDef.baseCooldown * cdMult;
    this.sound.play('skill');

    const baseDmg = this.getWeaponDamage();
    const skillMult = (skDef.baseDamageMult || 2) * (1 + (effLevel - 1) * 0.25) * (1 + ((p.stats.magic || 1) - 1) * 0.07);

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
    } else if (skillId === 'fire_strike') {
      // Огненный Удар: веер пламени перед героем + поджог врагов
      const r = skDef.radius || 140;
      const aim = p.facing;
      this.slashes.push({ x: p.x, y: p.y, angle: aim, arc: 1.9, range: r, color: '#f97316', life: 0.22, maxLife: 0.22 });
      this.spawnSpriteEffect('magic', p.x + Math.cos(aim) * 46, p.y - 6 + Math.sin(aim) * 46, 1.3, 16);
      const dmg = Math.round(baseDmg * skillMult);
      const hitCone = (t) => {
        const d = Math.hypot(t.x - p.x, t.y - p.y);
        if (d > r + t.radius) return false;
        const diff = Math.abs(Math.atan2(Math.sin(Math.atan2(t.y - p.y, t.x - p.x) - aim), Math.cos(Math.atan2(t.y - p.y, t.x - p.x) - aim)));
        return diff <= 1.05 || d < 42;
      };
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (hitCone(e)) { e.burnTimer = 3; e.burnDps = Math.max(e.burnDps || 0, Math.round(dmg * 0.22)); this.damageEnemy(e, dmg, false, '#fb923c'); }
      }
      for (const b of [...this.bossEntities]) if (hitCone(b)) this.damageBoss(b, dmg, false);
      this.sound.play('explosion');
      this.camera.shake = 6;
    } else if (skillId === 'ice_blast') {
      // Ледяной Взрыв: урон + сильное замедление всех врагов вокруг
      const r = skDef.radius || 165;
      const slowDur = this.hasArtifact('art_frost') ? 4.2 : 3.0;
      this.spawnSpriteEffect('magic', p.x, p.y, 2.1, 15);
      this.shockwaves.push({ x: p.x, y: p.y, radius: 16, maxRadius: r, color: '#7dd3fc', friendly: true, damage: 0 });
      const dmg = Math.round(baseDmg * skillMult);
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (dist2(p.x, p.y, e.x, e.y) <= (r + e.radius) ** 2) { e.slowTimer = Math.max(e.slowTimer || 0, slowDur); this.damageEnemy(e, dmg, false, '#7dd3fc'); }
      }
      for (const b of [...this.bossEntities]) {
        if (dist2(p.x, p.y, b.x, b.y) <= (r + b.radius) ** 2) { b.stunTimer = Math.max(b.stunTimer || 0, 0.7); this.damageBoss(b, dmg, false); }
      }
      this.camera.shake = 7;
    } else if (skillId === 'shadow_teleport') {
      // Теневой Телепорт: мгновенный рывок сквозь тьму по направлению взгляда
      const distTp = 250 + effLevel * 22;
      const nx2 = clamp(p.x + Math.cos(p.facing) * distTp, 60, this.world.width - 60);
      const ny2 = clamp(p.y + Math.sin(p.facing) * distTp, 60, this.world.height - 60);
      this.spawnSpriteEffect('magic', p.x, p.y, 1.2, 14);
      p.x = nx2; p.y = ny2;
      p.invulnTimer = Math.max(p.invulnTimer, 0.55);
      this.spawnSpriteEffect('magic', p.x, p.y, 1.4, 14);
      this.spawnDust(p.x, p.y, '#a855f7', 10);
      this.camera.shake = 3;
    } else if (skillId === 'adrenaline') {
      // Мгновенная перезарядка текущего оружия из резерва патронов
      const wid = this.inventory.equippedWeapon;
      if (WEAPONS[wid]?.magSize && this.getMag(wid) < this.getMagSize(wid)) {
        this.reloadWeaponId = wid;
        this.reloadTimer = 0;
        this.finishReload();
        this.addFloatingText(p.x, p.y - 34, '🔄 ПЕРЕЗАРЯДКА!', '#fde047');
      }
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
      const healMult = (1 + (this.baseLevels.medbay || 0) * 0.10) * (1 + this.getPerkRank('perk_field_medic') * 0.15)
        * (this.rescuedIds.includes('res_cursed_healer') ? 1.15 : 1);
      const heal = Math.round(p.maxHp * 0.55 * healMult);
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

  // ── ИИ 16 типов врагов: снайперы с лазером, гренадёры, невидимки, дроны, медики, мини-боссы ──
  updateEnemies(dt) {
    const p = this.player;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.animTime += dt * 7;
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);
      if (e.slowTimer > 0) e.slowTimer = Math.max(0, e.slowTimer - dt);
      const slowMult = e.slowTimer > 0 ? 0.65 : 1;

      // RISE: горение от огненного оружия и Огненного Удара
      if (e.burnTimer > 0) {
        e.burnTimer = Math.max(0, e.burnTimer - dt);
        e.hp -= (e.burnDps || 8) * dt;
        if (Math.random() < dt * 6) this.spawnSpriteEffect('magic', e.x, e.y - 12, 0.55, 16);
        if (e.hp <= 0) {
          this.enemies.splice(i, 1);
          this.onEnemyKilled(e);
          continue;
        }
      }

      if (e.flying) e.z = 26;
      else if (e.z > 0 || e.vz !== 0) {
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

      // Безопасная зона Убежища (кроме штурма Базы по спецоперации!)
      if (e.contractId !== 'base_defense_event' && !(this.activeContract && this.activeContract.type === 'base_defense' && e.contractId === this.activeContract.id)) {
        if (dist2(e.x, e.y, 3160, 3180) < 205 * 205) {
          const ang = Math.atan2(e.y - 3180, e.x - 3160);
          e.x += Math.cos(ang) * 150 * dt;
          e.y += Math.sin(ang) * 150 * dt;
          continue;
        }
      }

      // ── Выбор цели: игрок, напарник, охраняемый NPC спасения или каравана ──
      let tx = p.x, ty = p.y, targetKind = 'player', targetSite = null;
      if (e.rescueId) {
        const site = this.rescueSites.find(rs => rs.id === e.rescueId);
        if (site && (site.state === 'defending' || site.state === 'escorting')) {
          tx = site.npcX; ty = site.npcY; targetKind = 'rescueNpc'; targetSite = site;
        }
      } else if (e.contractId && this.contractNpc && this.contractNpc.active && e.aggroTarget === 'contractNpc') {
        tx = this.contractNpc.x; ty = this.contractNpc.y; targetKind = 'contractNpc';
      } else if (this.companionActive && this.companion && this.companion.hp > 0 && e.targetPref === 'companion') {
        if (dist2(e.x, e.y, this.companion.x, this.companion.y) < 260 * 260) {
          tx = this.companion.x; ty = this.companion.y; targetKind = 'companion';
        }
      }
      if (e.targetPref === undefined) e.targetPref = Math.random() < 0.22 ? 'companion' : 'player';

      const dx = tx - e.x;
      const dy = ty - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = dx / d, ny = dy / d;
      const dPlayer = Math.hypot(p.x - e.x, p.y - e.y);
      e.attackCd = Math.max(0, e.attackCd - dt);
      e.specialTimer -= dt;
      e.healTimer -= dt;

      // Невидимость охотника: виден только вблизи и в момент атаки
      if (e.behavior === 'stealth_stalker') {
        if (dPlayer < 150) e.isStealthed = false;
        else {
          e.stealthTimer -= dt;
          if (e.stealthTimer <= 0) {
            e.isStealthed = !e.isStealthed;
            e.stealthTimer = e.isStealthed ? 3.2 : 1.4;
          }
        }
      }

      const hurtTarget = (dmg) => {
        if (targetKind === 'rescueNpc' && targetSite) this.damageRescueNpc(targetSite, dmg);
        else if (targetKind === 'contractNpc') this.damageContractNpc(dmg);
        else if (targetKind === 'companion') this.damageCompanion(dmg);
        else this.damagePlayer(dmg);
      };

      // Очереди штурмовиков и мини-боссов
      if (e.burstLeft > 0) {
        e.burstTimer -= dt;
        if (e.burstTimer <= 0 && !p.dead) {
          e.burstLeft--;
          e.burstTimer = 0.15;
          const aim = Math.atan2(ty - e.y, tx - e.x) + randRange(-0.08, 0.08);
          this.spawnSpriteEffect('muzzle', e.x + Math.cos(aim) * 16, e.y - 6 + Math.sin(aim) * 16, 0.75, 22);
          this.projectiles.push({
            fromPlayer: false, kind: 'bullet',
            x: e.x + Math.cos(aim) * 16, y: e.y - 6 + Math.sin(aim) * 16,
            vx: Math.cos(aim) * e.projSpeed, vy: Math.sin(aim) * e.projSpeed,
            radius: 5, damage: Math.round(e.damage * 0.72), color: '#ef4444', life: 1.35
          });
        }
      }

      // Снайпер: наведение лазера 0.85 сек (видно красную линию!) -> мощный выстрел
      if (e.behavior === 'sniper') {
        if (e.aiming) {
          e.aimTimer -= dt;
          e.vx *= 0.8; e.vy *= 0.8;
          if (e.aimTimer <= 0) {
            e.aiming = false;
            e.attackCd = 2.7;
            const aim = Math.atan2(p.y - e.y, p.x - e.x);
            this.spawnSpriteEffect('muzzle', e.x + Math.cos(aim) * 18, e.y - 6 + Math.sin(aim) * 18, 1.0, 22);
            this.sound.play('gun');
            this.projectiles.push({
              fromPlayer: false, kind: 'bullet',
              x: e.x + Math.cos(aim) * 18, y: e.y - 6 + Math.sin(aim) * 18,
              vx: Math.cos(aim) * e.projSpeed, vy: Math.sin(aim) * e.projSpeed,
              radius: 5, damage: e.damage, color: '#f43f5e', life: 1.5
            });
          }
        } else if (!p.dead && dPlayer <= e.attackRange && e.attackCd <= 0) {
          e.aiming = true;
          e.aimTimer = 0.85;
          this.sound.play('ui');
        }
      }

      const inAggro = !p.dead && (dPlayer < 500 || targetKind !== 'player');

      if (inAggro && e.behavior !== 'sniper') {
        const spd = e.speed * slowMult * (e.isStealthed ? 1.12 : 1);
        const moveTo = (distWanted) => {
          if (d > distWanted) { e.vx += (nx * spd - e.vx) * Math.min(1, dt * 6); e.vy += (ny * spd - e.vy) * Math.min(1, dt * 6); }
          else if (d < distWanted * 0.55) { e.vx += (-nx * spd * 0.7 - e.vx) * Math.min(1, dt * 6); e.vy += (-ny * spd * 0.7 - e.vy) * Math.min(1, dt * 6); }
          else { e.vx *= 0.86; e.vy *= 0.86; }
        };
        const shoot = (cd, dmgMult = 1, color = '#f97316', kind = 'bullet', splash = 0) => {
          if (e.attackCd > 0) return;
          e.attackCd = cd;
          this.spawnSpriteEffect('muzzle', e.x + nx * 16, e.y - 6 + ny * 16, 0.8, 22);
          this.projectiles.push({
            fromPlayer: false, kind,
            x: e.x + nx * 16, y: e.y - 6 + ny * 16,
            vx: nx * e.projSpeed, vy: ny * e.projSpeed,
            radius: kind === 'bullet' ? 5 : 8,
            damage: Math.round(e.damage * dmgMult), splashRadius: splash,
            color, life: (e.attackRange + 80) / e.projSpeed
          });
        };

        switch (e.behavior) {
          case 'shooter':
          case 'shield_march':
            moveTo(e.attackRange * 0.8);
            shoot(e.behavior === 'shield_march' ? 2.0 : 1.65);
            break;
          case 'burst_shooter':
          case 'miniboss_warden':
          case 'miniboss_punisher':
            moveTo(e.attackRange * 0.78);
            if (e.attackCd <= 0 && d <= e.attackRange) {
              e.attackCd = e.isMiniBoss ? 1.9 : 2.1;
              e.burstLeft = e.isMiniBoss ? 4 : 3;
              e.burstTimer = 0;
            }
            if (e.behavior === 'miniboss_punisher' && e.specialTimer <= 0 && d < 340) {
              e.specialTimer = 5.5;
              this.spawnTelegraph(p.x, p.y, 78, 0.85, Math.round(e.damage * 1.1));
            }
            if (e.behavior === 'miniboss_warden' && e.specialTimer <= 0) {
              e.specialTimer = 7;
              e.stunTimer = 0.01;
              this.pushToast('⚠️ Надзиратель вызывает подкрепление!', '#f59e0b');
              const g = this.spawnEnemyAt(e.x + 70, e.y + 30, 'bandit_gunner', true);
              if (g) { g.rescueId = e.rescueId; g.contractId = e.contractId; }
            }
            break;
          case 'grenadier':
            moveTo(e.attackRange * 0.85);
            if (e.attackCd <= 0 && d <= e.attackRange) {
              e.attackCd = 2.4;
              this.sound.play('swing');
              this.projectiles.push({
                fromPlayer: false, kind: 'enemy_grenade',
                x: e.x, y: e.y - 8,
                vx: nx * 330, vy: ny * 330,
                radius: 7, damage: e.damage, splashRadius: 86,
                color: '#f97316', life: Math.min(1.15, d / 330)
              });
            }
            break;
          case 'pyro':
            moveTo(150);
            if (d <= e.attackRange) shoot(0.34, 0.55, '#fb923c', 'magic', 0);
            break;
          case 'acid_shooter':
            moveTo(e.attackRange * 0.82);
            shoot(1.7, 1, '#a3e635', 'acid', 52);
            break;
          case 'drone_strafe': {
            const tangent = Math.sin(e.animTime * 0.7) > 0 ? 1 : -1;
            const wantX = nx * (d > 245 ? spd : d < 175 ? -spd * 0.7 : 0) + (-ny) * spd * 0.65 * tangent;
            const wantY = ny * (d > 245 ? spd : d < 175 ? -spd * 0.7 : 0) + (nx) * spd * 0.65 * tangent;
            e.vx += (wantX - e.vx) * Math.min(1, dt * 5);
            e.vy += (wantY - e.vy) * Math.min(1, dt * 5);
            shoot(1.35, 0.9, '#facc15');
            break;
          }
          case 'healer_support': {
            moveTo(e.attackRange * 0.85);
            // Сначала лечит раненых союзников рядом!
            if (e.healTimer <= 0) {
              let ally = null, allyD2 = 270 * 270;
              for (const o of this.enemies) {
                if (o === e || o.hp >= o.maxHp) continue;
                const dd = dist2(e.x, e.y, o.x, o.y);
                if (dd < allyD2) { allyD2 = dd; ally = o; }
              }
              if (ally) {
                e.healTimer = 2.4;
                ally.hp = Math.min(ally.maxHp, ally.hp + 34);
                this.spawnSpriteEffect('magic', ally.x, ally.y - 8, 0.8, 14);
                this.addFloatingText(ally.x, ally.y - 26, '+34 HP', '#4ade80');
              } else e.healTimer = 0.7;
            }
            shoot(1.8, 0.9, '#fda4af');
            break;
          }
          case 'pouncer':
            if (d < 215 && d > 78 && e.attackCd <= 0) {
              e.attackCd = 2.3; e.vz = 285; e.z = 2; e.vx = nx * 365; e.vy = ny * 365;
            } else { e.vx += (nx * spd - e.vx) * Math.min(1, dt * 6); e.vy += (ny * spd - e.vy) * Math.min(1, dt * 6); }
            break;
          case 'dasher':
          case 'stealth_stalker':
            if (d < 195 && d > 68 && e.attackCd <= 0) {
              e.attackCd = e.behavior === 'stealth_stalker' ? 1.9 : 2.4;
              e.isStealthed = false;
              e.vx = nx * (e.behavior === 'stealth_stalker' ? 390 : 345);
              e.vy = ny * (e.behavior === 'stealth_stalker' ? 390 : 345);
            } else { e.vx += (nx * spd - e.vx) * Math.min(1, dt * 6); e.vy += (ny * spd - e.vy) * Math.min(1, dt * 6); }
            break;
          case 'mage_shooter': { // Маг Бездны: веер из 3 сфер
            moveTo(e.attackRange * 0.8);
            if (e.attackCd <= 0 && d <= e.attackRange) {
              e.attackCd = 2.3;
              const baseA = Math.atan2(ty - e.y, tx - e.x);
              for (let k = -1; k <= 1; k++) {
                const ang = baseA + k * 0.26;
                this.projectiles.push({
                  fromPlayer: false, kind: 'magic',
                  x: e.x + Math.cos(ang) * 16, y: e.y - 6 + Math.sin(ang) * 16,
                  vx: Math.cos(ang) * e.projSpeed, vy: Math.sin(ang) * e.projSpeed,
                  radius: 8, damage: Math.round(e.damage * 0.8), splashRadius: 40,
                  color: '#c084fc', life: (e.attackRange + 80) / e.projSpeed
                });
              }
              this.spawnSpriteEffect('magic', e.x, e.y - 8, 0.9, 16);
            }
            break;
          }
          case 'frost_shooter': { // Ледяной Ревенант: замедляет героя
            moveTo(e.attackRange * 0.82);
            if (e.attackCd <= 0 && d <= e.attackRange) {
              e.attackCd = 1.9;
              this.projectiles.push({
                fromPlayer: false, kind: 'magic', slowPlayer: true,
                x: e.x + nx * 16, y: e.y - 6 + ny * 16,
                vx: nx * e.projSpeed, vy: ny * e.projSpeed,
                radius: 7, damage: e.damage, color: '#7dd3fc', life: (e.attackRange + 80) / e.projSpeed
              });
            }
            break;
          }
          case 'golem': { // Каменный Голем: честный телеграф удара по земле
            e.vx += (nx * spd - e.vx) * Math.min(1, dt * 6);
            e.vy += (ny * spd - e.vy) * Math.min(1, dt * 6);
            if (e.specialTimer <= 0 && d < 210) {
              e.specialTimer = 4.4;
              this.spawnTelegraph(p.x, p.y, 92, 0.8, Math.round(e.damage * 1.4));
              this.pushToast('⚠️ Голем замахивается — выйди из красной зоны!', '#f59e0b');
            }
            break;
          }
          default: // melee и прочие
            e.vx += (nx * spd - e.vx) * Math.min(1, dt * 6);
            e.vy += (ny * spd - e.vy) * Math.min(1, dt * 6);
        }

        // Контактный урон по выбранной цели
        const targetRadius = targetKind === 'player' ? p.radius : 14;
        const targetZ = targetKind === 'player' ? p.z : 0;
        if (d < e.radius + targetRadius + 7 && e.attackCd <= 0 && targetZ < 18 && !(targetKind === 'player' && p.vehicleId)) {
          e.attackCd = e.behavior === 'pyro' ? 0.5 : 1.0;
          e.isStealthed = false;
          hurtTarget(e.damage);
        }
      } else if (e.behavior !== 'sniper') {
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
      this.resolveEntityObstacles(e, e.z > 10 || e.flying);
    }
  }

  // Красная зона предупреждения об опасной атаке (успей выйти или ПРЫГНУТЬ!)
  spawnTelegraph(x, y, radius, delay = 0.9, damage = 30) {
    if (this.telegraphs.length > 14) this.telegraphs.shift();
    this.telegraphs.push({ x, y, radius, timer: delay, maxTimer: delay, damage });
    this.sound.play('ui');
  }

  updateTelegraphs(dt) {
    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const t = this.telegraphs[i];
      t.timer -= dt;
      if (t.timer <= 0) {
        this.telegraphs.splice(i, 1);
        this.spawnSpriteEffect('explosion', t.x, t.y, Math.max(0.8, t.radius / 62), 15);
        this.shockwaves.push({ x: t.x, y: t.y, radius: 12, maxRadius: t.radius, color: '#ef4444', friendly: true, damage: 0 });
        this.camera.shake = Math.max(this.camera.shake, 7);
        this.sound.play('explosion');
        if (!this.player.dead && this.player.z < 14 && dist2(t.x, t.y, this.player.x, this.player.y) <= t.radius * t.radius) {
          this.damagePlayer(t.damage);
        }
        if (this.companion && this.companion.hp > 0 && dist2(t.x, t.y, this.companion.x, this.companion.y) <= t.radius * t.radius) {
          this.damageCompanion(Math.round(t.damage * 0.7));
        }
      }
    }
  }

  triggerEnemyExplosion(x, y, radius, damage) {
    this.spawnSpriteEffect('explosion', x, y, 1.25, 15);
    this.sound.play('explosion');
    this.camera.shake = Math.max(this.camera.shake, 8);
    if (!this.player.dead && this.player.z < 14 && dist2(x, y, this.player.x, this.player.y) <= (radius * 0.88) ** 2) {
      this.damagePlayer(damage);
    }
  }

  // ── 10 уникальных боссов: 3 фазы, телеграфы, щиты, телепорты, призыв и особые атаки ──
  updateBosses(dt) {
    const p = this.player;
    for (let i = this.bossEntities.length - 1; i >= 0; i--) {
      const b = this.bossEntities[i];
      b.animTime += dt * 6.5;
      if (b.hitFlash > 0) b.hitFlash = Math.max(0, b.hitFlash - dt);
      if (b.shieldTimer > 0) b.shieldTimer = Math.max(0, b.shieldTimer - dt);

      if (b.z > 0 || b.vz !== 0) {
        b.z = Math.max(0, b.z + b.vz * dt);
        b.vz -= 880 * dt;
        if (b.z <= 0) {
          b.z = 0; b.vz = 0;
          this.shockwaves.push({
            x: b.x, y: b.y, radius: 22, maxRadius: 215,
            color: '#ef4444', friendly: false, damage: Math.round(b.damage * 1.15), hitPlayer: false
          });
          this.camera.shake = 10;
          this.sound.play('explosion');
        }
      }

      if (b.stunTimer > 0) { b.stunTimer -= dt; continue; }

      const dHome = Math.hypot(p.x - b.homeX, p.y - b.homeY);
      // RISE: короткое кинематографичное интро при первом входе на арену босса
      if (!b.introShown && !p.dead && dHome < b.arenaRadius) {
        b.introShown = true;
        this.bossIntro = { name: b.name, text: b.intro, until: performance.now() / 1000 + 3.4 };
        this.sound.play('skill');
        this.pushToast(`💀 ${b.name} пробудился!`, '#f43f5e');
      }
      if (p.dead || dHome > b.arenaRadius + 260) {
        b.x += (b.homeX - b.x) * Math.min(1, dt * 2);
        b.y += (b.homeY - b.y) * Math.min(1, dt * 2);
        b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.04 * dt);
        b.aiming = false;
        continue;
      }

      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = dx / d;
      const ny = dy / d;

      // Очереди Боевого Робота и Генерала
      if (b.burstLeft > 0) {
        b.burstTimer -= dt;
        if (b.burstTimer <= 0) {
          b.burstLeft--;
          b.burstTimer = 0.13;
          const aim = Math.atan2(dy, dx) + randRange(-0.09, 0.09);
          this.projectiles.push({
            fromPlayer: false, kind: 'bullet',
            x: b.x + Math.cos(aim) * 22, y: b.y - 10 + Math.sin(aim) * 22,
            vx: Math.cos(aim) * 540, vy: Math.sin(aim) * 540,
            radius: 5, damage: Math.round(b.damage * 0.62), color: '#facc15', life: 1.4
          });
        }
      }

      // Снайпер-Охотник и Архонт: прицеливание с видимым лучом
      if (b.aiming) {
        b.aimTimer -= dt;
        if (b.aimTimer <= 0) {
          b.aiming = false;
          const aim = Math.atan2(dy, dx);
          this.projectiles.push({
            fromPlayer: false, kind: 'bullet',
            x: b.x, y: b.y - 10,
            vx: Math.cos(aim) * 900, vy: Math.sin(aim) * 900,
            radius: 6, damage: Math.round(b.damage * 1.25), color: '#f43f5e', life: 1.3
          });
          this.sound.play('gun');
        }
        continue;
      }

      if (b.dashActive > 0) {
        b.dashActive -= dt;
        b.x += b.dashVx * dt;
        b.y += b.dashVy * dt;
        this.resolveEntityObstacles(b, false);
        if (d < b.radius + p.radius + 10 && p.z < 18) this.damagePlayer(Math.round(b.damage * 1.2));
        continue;
      }

      const spd = b.speed * (b.phase === 2 ? 1.18 : b.phase === 3 ? 1.34 : 1.0);
      const keepDist = b.bossId === 'boss_sniper' || b.bossId === 'boss_mad_scientist' ? 235 : 0;
      if (d > keepDist + 10) { b.x += nx * spd * dt; b.y += ny * spd * dt; }
      else if (keepDist && d < keepDist * 0.6) { b.x -= nx * spd * 0.7 * dt; b.y -= ny * spd * 0.7 * dt; }
      this.resolveEntityObstacles(b, b.z > 10);

      if (d < b.radius + p.radius + 8 && p.z < 18 && !p.vehicleId && b.z < 10) {
        this.damagePlayer(b.damage);
      }

      b.actionTimer -= dt * (b.phase === 2 ? 1.25 : b.phase === 3 ? 1.5 : 1.0);
      if (b.actionTimer <= 0) {
        b.actionTimer = b.phase === 3 ? 2.35 : 3.0;
        this.executeBossSkill(b, nx, ny, d);
      }
    }
  }

  executeBossSkill(b, nx, ny, distToPlayer = 300) {
    const p = this.player;
    this.sound.play('skill');
    const fan = (count, spreadBase, speed, dmgMult, color = '#f97316', kind = 'magic') => {
      const base = Math.atan2(ny, nx);
      for (let k = 0; k < count; k++) {
        const ang = base + (count === 1 ? 0 : (k / (count - 1) - 0.5) * spreadBase);
        this.projectiles.push({
          fromPlayer: false, kind,
          x: b.x, y: b.y - 8,
          vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
          radius: 8, damage: Math.round(b.damage * dmgMult), splashRadius: kind === 'magic' ? 48 : 0,
          color, life: 1.7
        });
      }
    };
    const ring = (count, speed, color) => {
      for (let k = 0; k < count; k++) {
        const ang = (k / count) * Math.PI * 2 + b.animTime;
        this.projectiles.push({
          fromPlayer: false, kind: 'bullet', x: b.x, y: b.y - 8,
          vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
          radius: 6, damage: Math.round(b.damage * 0.85), color, life: 1.7
        });
      }
    };
    const summon = (kind, n = 2) => {
      for (let k = 0; k < n; k++) {
        if (this.enemies.length > 34) break;
        this.spawnEnemyAt(b.x + randRange(-95, 95), b.y + randRange(-80, 80), kind, true);
      }
    };

    switch (b.bossId) {
      case 'boss_mutant_king': // прыжок + приземление с волной + стая гончих
        b.vz = 395; b.z = 4; b.dashActive = 0.42; b.dashVx = nx * 385; b.dashVy = ny * 385;
        if (b.phase >= 2) summon('monster', 2);
        break;
      case 'boss_commander': // силовой щит + кассетные гранаты-телеграфы + штурмовики
        b.shieldTimer = 3.2;
        this.pushToast('🛡️ Командир включил силовой щит (-70% урона)!', '#38bdf8');
        for (let k = 0; k < (b.phase >= 2 ? 3 : 2); k++) {
          this.spawnTelegraph(p.x + randRange(-90, 90), p.y + randRange(-90, 90), 76, 0.95, Math.round(b.damage * 1.1));
        }
        if (b.phase >= 2) summon('soldier', 2);
        break;
      case 'boss_destroyer': // телеграф у игрока -> рывок пилой + веер снарядов
        this.spawnTelegraph(p.x, p.y, 92, 0.8, Math.round(b.damage * 1.15));
        b.dashActive = 0.38; b.dashVx = nx * 455; b.dashVy = ny * 455;
        fan(3, 0.7, 370, 0.9);
        break;
      case 'boss_sniper': // лазерное прицеливание, дым и отход на дистанцию
        b.aiming = true; b.aimTimer = 1.0;
        if (b.phase >= 2) {
          this.spawnSpriteEffect('smoke', b.x, b.y, 1.6, 10);
          b.x = clamp(b.x - nx * 190 + randRange(-70, 70), 90, this.world.width - 90);
          b.y = clamp(b.y - ny * 190 + randRange(-70, 70), 90, this.world.height - 90);
        }
        break;
      case 'boss_giant_beast': // сокрушительный прыжок и огненная волна
        b.vz = 430; b.z = 4; b.dashActive = 0.46; b.dashVx = nx * 430; b.dashVy = ny * 430;
        this.shockwaves.push({ x: b.x, y: b.y, radius: 24, maxRadius: 245, color: '#fb923c', friendly: false, damage: b.damage, hitPlayer: false });
        break;
      case 'boss_mad_scientist': // колбы кислоты/плазмы, энергокупол и дроны
        fan(b.phase >= 2 ? 7 : 5, 1.15, 355, 1.0, '#a3e635');
        if (b.phase >= 2) { b.shieldTimer = 2.4; summon('combat_drone', 2); }
        break;
      case 'boss_shadow_assassin': // телепорт за спину + веер энергоклинков
        b.x = clamp(p.x - nx * 74, 70, this.world.width - 70);
        b.y = clamp(p.y - ny * 74, 70, this.world.height - 70);
        this.spawnSpriteEffect('magic', b.x, b.y, 1.2, 14);
        fan(b.phase >= 2 ? 7 : 5, 1.3, 430, 0.95, '#e879f9', 'bullet');
        if (b.phase >= 3) this.spawnTelegraph(p.x, p.y, 84, 0.75, Math.round(b.damage * 1.2));
        break;
      case 'boss_war_robot': // сдвоенные пулемёты очередями + ракетные телеграфы
        b.burstLeft = b.phase >= 2 ? 12 : 8; b.burstTimer = 0;
        if (b.phase >= 2) {
          for (let k = 0; k < 3; k++) this.spawnTelegraph(p.x + randRange(-110, 110), p.y + randRange(-110, 110), 82, 1.0, Math.round(b.damage * 1.1));
        }
        break;
      case 'boss_general': // арт-подготовка по квадратам + элитная гвардия
        for (let k = 0; k < (b.phase >= 2 ? 4 : 3); k++) {
          this.spawnTelegraph(p.x + randRange(-130, 130), p.y + randRange(-130, 130), 80, 1.0, Math.round(b.damage * 1.05));
        }
        if (b.phase >= 2) summon(b.phase >= 3 ? 'heavy_trooper' : 'soldier', 2);
        else { b.burstLeft = 6; b.burstTimer = 0; }
        break;
      case 'boss_rune_golem': // РУННЫЙ ГОЛЕМ: рунный удар по земле (телеграф) + веер осколков
        this.spawnTelegraph(p.x, p.y, 104, 0.9, Math.round(b.damage * 1.25));
        fan(b.phase >= 2 ? 7 : 5, 1.2, 360, 0.9, '#fbbf24', 'bullet');
        if (b.phase >= 3) ring(12, 330, '#f59e0b');
        break;
      case 'boss_necromancer': // НЕКРОМАНТ ЗАБЫТЫХ: призыв скелетов + веер тьмы
        summon(b.phase >= 2 ? 'skeleton_warrior' : 'zombie', b.phase >= 3 ? 3 : 2);
        fan(b.phase >= 2 ? 7 : 5, 1.25, 380, 0.95, '#a855f7');
        if (b.phase >= 2) b.shieldTimer = 2.2;
        break;
      case 'boss_cursed_queen': // ЭЛЬВИРА: призыв призраков, ледяные веера и замедление
        if (b.phase >= 2) summon('cursed_wraith', 2);
        fan(b.phase >= 2 ? 9 : 6, 1.5, 360, 0.9, '#4ade80');
        if (b.phase >= 3) { ring(14, 340, '#22c55e'); p.slowTimer = Math.max(p.slowTimer || 0, 1.2); }
        break;
      case 'boss_abyss_warlord': // КЗАРГОТ: рывки, веера Бездны и элитный эскорт
        b.dashActive = 0.4; b.dashVx = nx * 470; b.dashVy = ny * 470;
        fan(b.phase >= 2 ? 7 : 5, 1.1, 430, 1.0, '#e879f9', 'bullet');
        if (b.phase >= 2) summon(b.phase >= 3 ? 'void_cultist' : 'abyss_mage', 2);
        if (b.phase >= 3) this.spawnTelegraph(p.x, p.y, 96, 0.8, Math.round(b.damage * 1.3));
        break;
      case 'boss_abyss_heart': // СЕРДЦЕ БЕЗДНЫ (секрет): кольца хаоса, телепорты, сверхновая
        ring(b.phase === 1 ? 14 : b.phase === 2 ? 18 : 24, 380 + b.phase * 18, '#f0abfc');
        if (b.phase >= 2) {
          b.x = clamp(p.x - nx * 120 + randRange(-60, 60), 70, this.world.width - 70);
          b.y = clamp(p.y - ny * 120 + randRange(-60, 60), 70, this.world.height - 70);
          this.spawnSpriteEffect('magic', b.x, b.y, 1.6, 14);
          fan(7, 1.4, 430, 1.0, '#e879f9');
        }
        if (b.phase >= 3) {
          this.shockwaves.push({ x: b.x, y: b.y, radius: 26, maxRadius: 300, color: '#f0abfc', friendly: false, damage: b.damage, hitPlayer: false });
          summon('void_cultist', 2);
        }
        break;
      default: // АРХОНТ VEXMORA: спирали, прицельные лучи, порталы и сверхновая по фазам
        if (b.phase === 1) { ring(12, 365, '#ef4444'); b.aiming = true; b.aimTimer = 1.05; }
        else if (b.phase === 2) {
          ring(16, 385, '#c084fc');
          for (let k = 0; k < 3; k++) this.spawnTelegraph(p.x + randRange(-100, 100), p.y + randRange(-100, 100), 84, 0.9, Math.round(b.damage * 1.15));
          summon('stealth_hunter', 2);
        } else {
          ring(20, 410, '#22d3ee');
          this.shockwaves.push({ x: b.x, y: b.y, radius: 26, maxRadius: 285, color: '#22d3ee', friendly: false, damage: b.damage, hitPlayer: false });
          b.dashActive = 0.36; b.dashVx = nx * 470; b.dashVy = ny * 470;
          summon('combat_drone', 2);
        }
    }
  }

  // ── Урон, опыт, уровни и трофеи ──────────────────────────────────────
  damageEnemy(e, dmg, isCrit = false, customColor = null, opts = {}) {
    if (e.armorMult && e.armorMult < 1) dmg = Math.max(1, Math.round(dmg * e.armorMult));
    e.hp -= dmg;
    // Крио-Импульс и Вампирский Реактор (только для попаданий оружием игрока)
    if (opts.weaponId) {
      if (this.hasMod(opts.weaponId, 'mod_cryo')) e.slowTimer = Math.max(e.slowTimer || 0, 2.5);
      if (this.hasMod(opts.weaponId, 'mod_vamp') && !this.player.dead) {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.max(1, Math.round(dmg * 0.06)));
      }
    }
    if (opts.weaponId) {
      const wDef = WEAPONS[opts.weaponId];
      if (wDef?.effect === 'burn') { e.burnTimer = 3; e.burnDps = Math.max(e.burnDps || 0, Math.round(dmg * 0.20)); }
      if (wDef?.effect === 'abyss') e.slowTimer = Math.max(e.slowTimer || 0, 1.6);
      if (wDef?.effect === 'fire') { e.burnTimer = Math.max(e.burnTimer || 0, 2); e.burnDps = Math.max(e.burnDps || 0, Math.round(dmg * 0.15)); }
      if (!this.player.dead && (wDef?.effect === 'lifesteal' || this.hasArtifact('art_blood'))) {
        const ls = wDef?.effect === 'lifesteal' ? 0.05 : 0.03;
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.max(1, Math.round(dmg * ls)));
      }
    }
    if (e.isStealthed) { e.isStealthed = false; e.stealthTimer = 2.5; }
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
    // Огнемётчик взрывается при гибели (осторожно, не стойте вплотную!)
    if (e.explodeOnDeath) {
      this.triggerExplosion(e.x, e.y, 92, 46 + this.player.level * 3, false);
    }
    // Прогресс спецоперации и охраны спасения
    if (e.contractId && this.activeContract && e.contractId === this.activeContract.id) {
      this.activeContract.progress = Math.min(this.activeContract.target, (this.activeContract.progress || 0) + 1);
    }
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

    if (e.isMiniBoss) {
      this.pushToast(`💀 Мини-босс повержен: ${e.name}! Забери добычу и Ключ-карту`, '#fbbf24');
      this.sound.play('levelup');
    }
    this.stats.totalKills++;
    if (e.elite) {
      this.stats.eliteKills = (this.stats.eliteKills || 0) + 1;
      this.pushToast(`💜 Элита повержена: ${e.name}!`, '#c084fc');
    }
    this.stats.biomeKills[e.biome] = (this.stats.biomeKills[e.biome] || 0) + 1;
    this.advanceQuest('kills', 1);
    this.advanceQuest('biome_kills', 1, { biome: e.biome });
    this.gainXp(e.xp);
    this.checkAchievements();
  }

  damageBoss(b, dmg, isCrit = false, weaponId = null) {
    if (b.shieldTimer > 0) {
      dmg = Math.max(1, Math.round(dmg * 0.30));
      this.addFloatingText(b.x, b.y - 44, '🛡️ ЩИТ', '#38bdf8');
    }
    if (weaponId) {
      if (this.hasMod(weaponId, 'mod_vamp') && !this.player.dead) {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.max(1, Math.round(dmg * 0.05)));
      }
    }
    b.hp -= dmg;
    // Пересчёт фазы при уроне (пороги 66% / 33%)
    const newPhase = b.hp <= 0 ? b.phase : (b.hp < b.maxHp * 0.34 ? 3 : b.hp < b.maxHp * 0.67 ? 2 : 1);
    if (newPhase !== b.phase) {
      b.phase = newPhase;
      this.pushToast(`⚠️ ${b.name}: ФАЗА ${newPhase}! Новые атаки!`, '#f43f5e');
      this.sound.play('skill');
      this.camera.shake = Math.max(this.camera.shake, 9);
      this.spawnSpriteEffect('magic', b.x, b.y, 1.8, 14);
    }
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
      if (b.rewardArtifact) this.collectArtifact(b.rewardArtifact);
      for (const it of b.rewardItems) {
        this.grantItem(it.id, it.count);
      }
      this.camera.shake = 14;
      this.sound.play('levelup');
      this.pushToast(`🏆 БОСС ПОВЕРЖЕН: ${b.name}! Получено: ${WEAPONS[b.rewardWeapon]?.name}`, '#fbbf24');
      if (b.unlocksZone) this.pushToast(`🗺️ Открыта территория: ${b.unlocksZone}`, '#4ade80');
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
    mult *= Math.max(0.6, 1 - this.getPerkRank('perk_kevlar') * 0.08);
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
      if (WEAPONS[weaponId].magSize) this.weaponMag[weaponId] = this.getMagSize(weaponId);
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
        if (pr.fromPlayer && pr.splashRadius > 0 && (pr.kind === 'grenade_shell' || pr.kind === 'rocket' || pr.kind === 'magic')) {
          this.triggerExplosion(pr.x, pr.y, pr.splashRadius, pr.damage, true);
        } else if (!pr.fromPlayer && pr.splashRadius > 0) {
          this.triggerEnemyExplosion(pr.x, pr.y, pr.splashRadius, pr.damage);
        }
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
        if (pr.fromPlayer && pr.splashRadius > 0) this.triggerExplosion(pr.x, pr.y, pr.splashRadius, pr.damage, true);
        else if (!pr.fromPlayer && pr.splashRadius > 0) this.triggerEnemyExplosion(pr.x, pr.y, pr.splashRadius, pr.damage);
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
          if (pr.splashRadius && pr.kind !== 'acid') {
            this.triggerEnemyExplosion(pr.x, pr.y, pr.splashRadius, pr.damage);
          } else {
            this.damagePlayer(pr.damage);
            if (pr.slowPlayer) { p.slowTimer = 1.7; this.addFloatingText(p.x, p.y - 30, '❄️ ЗАМЕДЛЕНИЕ!', '#7dd3fc'); }
          }
          this.projectiles.splice(i, 1);
        } else if (this.companion && this.companion.hp > 0 && dist2(pr.x, pr.y, this.companion.x, this.companion.y) <= (pr.radius + 13) ** 2) {
          this.damageCompanion(pr.damage);
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
    if (isBoss) this.damageBoss(target, pr.damage, pr.isCrit, pr.weaponId || null);
    else this.damageEnemy(target, pr.damage, pr.isCrit, null, { weaponId: pr.weaponId || null });
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
  // RISE OF THE ABYSS: ловушки локаций, случайные события, темы музыки
  updateRiseSystems(dt) {
    const p = this.player;
    if (p.dead) return;

    // Ловушки: шипы / огонь / яд (честно видны на земле, урон с перезарядкой)
    for (const trap of this.world.traps || []) {
      trap.hitCd = Math.max(0, (trap.hitCd || 0) - dt);
      if (trap.hitCd <= 0 && p.z < 10 && dist2(p.x, p.y, trap.x, trap.y) < (trap.radius + p.radius) ** 2) {
        trap.hitCd = 0.9;
        this.damagePlayer(trap.damage);
        if (trap.kind === 'trap_poison') { p.slowTimer = Math.max(p.slowTimer || 0, 1.6); this.addFloatingText(p.x, p.y - 30, '☠️ ЯД!', '#a3e635'); }
        else if (trap.kind === 'trap_fire') this.addFloatingText(p.x, p.y - 30, '🔥 ОГОНЬ!', '#fb923c');
        else this.addFloatingText(p.x, p.y - 30, '🗡️ ШИПЫ!', '#e2e8f0');
      }
    }

    // Случайные события мира: засады, элита, дары странников
    this.eventTimer -= dt;
    if (this.eventTimer <= 0) {
      this.eventTimer = randRange(105, 170);
      const roll = Math.random();
      const locId = getLocationIdAt(p.x, p.y);
      if (roll < 0.42) {
        const pool = locId ? LOCATIONS[locId].enemies : null;
        let spawned = 0;
        for (let k = 0; k < 3; k++) {
          const ang = Math.random() * Math.PI * 2;
          const e = this.spawnEnemyAt(p.x + Math.cos(ang) * 190, p.y + Math.sin(ang) * 190, pool ? pool[k % pool.length] : null, true);
          if (e) spawned++;
        }
        if (spawned) this.pushToast('⚔️ ЗАСАДА! Твари Бездны окружили героя!', '#f43f5e');
      } else if (roll < 0.72 && p.level >= 4) {
        const e = this.spawnEnemyAt(p.x + randRange(-260, 260), p.y + randRange(-260, 260), null, true, true);
        if (e) this.pushToast(`💜 СОБЫТИЕ: элитный враг «${e.name}» вышел на охоту!`, '#c084fc');
      } else {
        this.drops.push({ x: p.x + 40, y: p.y, kind: 'item', itemId: 'medkit', amount: 1, life: 60 });
        this.drops.push({ x: p.x - 40, y: p.y, kind: 'ammo', amount: 24, life: 60 });
        this.pushToast('🎁 Странник оставил припасы рядом с вами!', '#4ade80');
      }
    }
  }

  getCurrentLocationName() {
    const locId = getLocationIdAt(this.player.x, this.player.y);
    if (locId) return LOCATIONS[locId].name;
    const b = BIOMES[getBiomeIdAt(this.player.x, this.player.y)];
    return b ? b.name : 'Дикие земли';
  }

  checkWorldInteractions() {
    const p = this.player;

    // RISE: открытие особых локаций + баннер + смена музыкальной темы
    const locId = getLocationIdAt(p.x, p.y);
    if (locId !== this.currentLocationId) {
      this.currentLocationId = locId;
      if (locId && !this.discoveredLocations.includes(locId)) {
        this.discoveredLocations.push(locId);
        const loc = LOCATIONS[locId];
        this.locationBanner = { name: loc.name, desc: loc.desc, until: performance.now() / 1000 + 4.2 };
        this.sound.play('levelup');
        this.pushToast(`🗺️ Открыта локация: ${loc.name}!`, '#fde047');
        this.gainXp(60);
        this.checkAchievements();
        this.saveGame(true);
      }
    }
    const bossNear = this.bossEntities.some(b => dist2(p.x, p.y, b.x, b.y) < 560 * 560);
    const theme = bossNear ? 'boss' : (locId ? LOCATIONS[locId].music : 'field');
    if (theme !== this.musicTheme) {
      this.musicTheme = theme;
      this.sound.setMusicTheme?.(theme);
    }

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

    // Спасение: терминал сигнализации, клетка, раненый/ожидающий выживший
    for (const site of this.rescueSites) {
      if (site.state === 'done' || site.state === 'idle' || site.state === 'failed') continue;
      const alarmX = site.x + 58, alarmY = site.y - 12;
      if (site.def.hasAlarm && !site.alarmDisabled && dist2(p.x, p.y, alarmX, alarmY) < 92 * 92) {
        return { type: 'rescue_alarm', target: site, label: `🔌 Отключить сигнализацию (${site.def.name})` };
      }
      if (dist2(p.x, p.y, site.npcX, site.npcY) < 92 * 92) {
        if (site.state === 'guarding' || site.state === 'timed_active') {
          return { type: 'rescue_cage', target: site, label: `🗝️ Открыть клетку: ${site.def.name}` };
        }
        if (site.state === 'defending') {
          return { type: 'rescue_npc', target: site, label: `🩹 Перевязать и защитить: ${site.def.name} (${Math.max(0, Math.ceil(site.npcHp))} HP)` };
        }
        if (site.state === 'ready_claim') {
          return { type: 'rescue_npc', target: site, label: `🎉 Завершить спасение: ${site.def.name}` };
        }
        if (site.state === 'escort_ready') {
          return { type: 'rescue_npc', target: site, label: `🛡️ Сопровождать: ${site.def.name} до Убежища` };
        }
        if (site.state === 'escorting') {
          return { type: 'rescue_npc', target: site, label: `🛡️ ${site.def.name} следует за тобой — веди к Убежищу!` };
        }
      }
    }

    // Спецконтейнеры модификаций
    for (const cache of this.world.modCaches) {
      if (!cache.looted && dist2(p.x, p.y, cache.x, cache.y) < 88 * 88) {
        return { type: 'mod_cache', target: cache, label: `📦 Вскрыть спецконтейнер (модуль + оружие)` };
      }
    }

    // RISE: сундуки локаций (проклятые — с засадой и двойной добычей!)
    for (const chest of this.world.chests || []) {
      if (!chest.looted && dist2(p.x, p.y, chest.x, chest.y) < 84 * 84) {
        return { type: 'chest', target: chest, label: chest.cursed ? '💀 Открыть ПРОКЛЯТЫЙ сундук (двойная добыча!)' : '🧰 Открыть сундук' };
      }
    }

    // Пленный спецоперации
    if (this.contractNpc && this.contractNpc.active && this.activeContract?.type === 'free_captive') {
      if (dist2(p.x, p.y, this.contractNpc.x, this.contractNpc.y) < 92 * 92) {
        return { type: 'contract_captive', target: this.contractNpc, label: `🗝️ Освободить пленного (сначала зачисти охрану!)` };
      }
    }

    for (const npc of NPCS) {
      if (!this.isNpcUnlocked(npc)) continue;
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
        if (bld.interactType === 'base_hub') {
          return { type: 'open_base', target: bld, label: `🏰 Убежище: Инженерия, Гараж и Модули` };
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

    if (inter.type === 'rescue_alarm') {
      const site = inter.target;
      site.alarmDisabled = true;
      this.sound.play('unlock');
      this.spawnSpriteEffect('magic', site.x + 58, site.y - 12, 1.0, 14);
      this.pushToast(`🔌 Сигнализация отключена! Теперь зачисти охрану и открой клетку: ${site.def.name}`, '#4ade80');
      return inter;
    }

    if (inter.type === 'rescue_cage') {
      const site = inter.target;
      if (site.def.hasAlarm && !site.alarmDisabled) {
        this.pushToast('🚨 Сначала отключи терминал сигнализации справа от клетки!', '#f59e0b');
        return null;
      }
      if (this.rescueGuardsAlive(site) > 0) {
        this.pushToast(`⚔️ Клетка под охраной! Осталось врагов: ${this.rescueGuardsAlive(site)}`, '#f59e0b');
        return null;
      }
      if (site.def.requiresKey) {
        const hasKey = (this.inventory.consumables.key || 0) > 0;
        const freeOpen = hasKey && Math.random() < this.getPerkRank('perk_keymaster') * 0.15;
        if (!hasKey) {
          this.pushToast('🔒 Нужна Ключ-карта! Ищи у мини-боссов, в Полиции, крафти или купи в SHOP', '#f59e0b');
          return null;
        }
        if (!freeOpen) this.inventory.consumables.key--;
        else this.pushToast('🗝️ Дешифратор VEXMORA: Ключ-карта не потрачена!', '#c084fc');
      }
      this.completeRescue(site);
      return inter;
    }

    if (inter.type === 'rescue_npc') {
      const site = inter.target;
      if (site.state === 'ready_claim') { this.completeRescue(site); return inter; }
      if (site.state === 'escort_ready') {
        site.state = 'escorting';
        site.ambushTimer = 14;
        this.sound.play('unlock');
        this.pushToast(`🛡️ ${site.def.name} следует за тобой! Доведи выжившего до Убежища (жёлтая стрелка)`, '#4ade80');
        return inter;
      }
      if (site.state === 'defending') {
        if ((site.healCd || 0) > 0) { this.pushToast('🩹 Повязка ещё держится — защищай выжившего!', '#94a3b8'); return null; }
        site.healCd = 12;
        site.npcHp = Math.min(site.maxNpcHp, site.npcHp + 42);
        this.sound.play('heal');
        this.spawnSpriteEffect('magic', site.npcX, site.npcY, 1.0, 14);
        this.pushToast(`🩹 Ты перевязал ${site.def.name} (+42 HP). Защищай от волн!`, '#4ade80');
        return inter;
      }
      return inter;
    }

    if (inter.type === 'mod_cache') {
      this.lootModCache(inter.target);
      return inter;
    }

    if (inter.type === 'contract_captive') {
      const guards = this.enemies.filter(e => e.contractId === this.activeContract?.id).length;
      if (guards > 0) { this.pushToast(`⚔️ Сначала уничтожь охрану пленного! Осталось: ${guards}`, '#f59e0b'); return null; }
      this.pushToast('🗝️ Пленный освобождён и ушёл в Убежище!', '#4ade80');
      this.completeContract();
      return inter;
    }

    if (inter.type === 'chest') {
      const chest = inter.target;
      chest.looted = true;
      if (!this.lootedChests.includes(chest.id)) this.lootedChests.push(chest.id);
      const mult = chest.cursed ? 2 : 1;
      const coins = randInt(60, 130) * mult;
      const ammo = randInt(16, 34) * mult;
      this.inventory.coins += coins;
      this.grantItem('ammo', ammo);
      if (Math.random() < 0.75) this.grantItem('medkit', 1);
      if (Math.random() < 0.4) this.inventory.resources.crystal = (this.inventory.resources.crystal || 0) + 1;
      this.sound.play('unlock');
      this.spawnSpriteEffect('magic', chest.x, chest.y, 1.3, 14);
      if (chest.cursed) {
        this.pushToast(`💀 ПРОКЛЯТЫЙ СУНДУК: +${coins}🪙, +${ammo} патронов... но это ЗАСАДА!`, '#c084fc');
        for (let k = 0; k < 3; k++) {
          this.spawnEnemyAt(chest.x + randRange(-120, 120), chest.y + randRange(-120, 120), null, true);
        }
      } else {
        this.pushToast(`🧰 Сундук: +${coins}🪙 и +${ammo} патронов!`, '#4ade80');
      }
      this.saveGame(true);
      return inter;
    }

    if (inter.type === 'open_base') {
      this.sound.play('ui');
      return { type: 'open_base', target: inter.target };
    }

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
        const freeOpen = Math.random() < this.getPerkRank('perk_keymaster') * 0.15;
        if (!freeOpen) this.inventory.consumables.key--;
        else this.pushToast('🗝️ Дешифратор VEXMORA: Ключ-карта не потрачена!', '#c084fc');
      }
      this.discoveredSecrets.push(sec.id);
      bld.looted = true;
      this.inventory.coins += sec.coins;
      this.grantWeapon(sec.rewardWeapon);
      if (sec.rewardArtifact) this.collectArtifact(sec.rewardArtifact);
      if (sec.rewardMod && !this.unlockedMods.includes(sec.rewardMod)) {
        this.unlockedMods.push(sec.rewardMod);
        this.pushToast(`🔧 Найден модуль «${WEAPON_MODS[sec.rewardMod]?.name}»! Установи у Инженера (вкладка 🏰 База)`, '#c084fc');
      }
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

  // ── VEXMORA 2.0: Спасение NPC, Развитие Убежища, Напарник, Модификации, Перки, Спецоперации ──
  isNpcUnlocked(npc) {
    if (!npc.unlockedByRescue) return true;
    return this.rescuedIds.includes(npc.unlockedByRescue);
  }

  setObjective(x, y, label) {
    this.manualObjective = { x, y, label };
    this.pushToast(`📍 Цель отмечена: ${label}`, '#fde047');
  }

  getObjectiveTarget() {
    const p = this.player;
    if (this.manualObjective) {
      if (dist2(p.x, p.y, this.manualObjective.x, this.manualObjective.y) < 110 * 110) {
        const done = this.manualObjective;
        this.manualObjective = null;
        return null;
      }
      return this.manualObjective;
    }
    if (this.activeContract) {
      const c = this.activeContract;
      if (this.contractNpc && this.contractNpc.active && (c.type === 'escort_survivor')) {
        return { x: c.destX, y: c.destY, label: `🛡️ Довести выжившего до: ${c.title}` };
      }
      return { x: c.x, y: c.y, label: `${c.icon} ${c.title}` };
    }
    const q = this.getActiveQuest();
    if (q) {
      if (q.id === 'q_rescue_first') {
        const site = this.rescueSites.find(s2 => s2.state !== 'done');
        if (site) return { x: site.x, y: site.y, label: `🆘 Спасти: ${site.def.name}` };
      }
      if (q.targetPos) return { x: q.targetPos.x, y: q.targetPos.y, label: `📜 ${q.title}` };
    }
    return null;
  }

  // ── Спасение выживших ────────────────────────────────────────────────
  getRescueSite(id) {
    return this.rescueSites.find(s2 => s2.id === id) || null;
  }

  rescueGuardsAlive(site) {
    return this.enemies.filter(e => e.rescueId === site.id).length;
  }

  spawnRescueGuards(site, kinds) {
    const offsets = [[-78, -30], [72, -38], [0, 82], [-95, 55], [95, 60]];
    kinds.forEach((kind, idx) => {
      const [ox, oy] = offsets[idx % offsets.length];
      const e = this.spawnEnemyAt(site.x + ox, site.y + oy, kind, true);
      if (e) { e.rescueId = site.id; e.aggroTarget = 'player'; }
    });
  }

  activateRescue(site) {
    if (site.activated || site.state === 'done') return;
    site.activated = true;
    const def = site.def;
    if (def.type === 'cage') {
      site.state = 'guarding';
      const elite = (site.id === 'res_cage_scout' || site.id === 'res_cage_veteran') ? 'mini_warden' : 'soldier';
      this.spawnRescueGuards(site, ['bandit_gunner', elite, 'bandit']);
      this.pushToast(`🆘 Пленник: ${def.name}! ${def.hasAlarm ? 'Сначала отключи терминал сигнализации рядом с клеткой!' : 'Перебей охрану клетки!'}`, '#fbbf24');
    } else if (def.type === 'defend') {
      site.state = 'defending';
      site.wave = 1;
      this.spawnRescueGuards(site, ['zombie', 'infected_runner', 'bandit']);
      this.pushToast(`🆘 Защити раненого: ${def.name}! Волна 1/${def.waves || 2} уже атакует!`, '#f87171');
    } else if (def.type === 'escort') {
      site.state = 'escort_ready';
      this.pushToast(`🆘 Выживший ${def.name} ждёт сопровождения! Подойди и нажми ВЗАИМОДЕЙСТВИЕ`, '#4ade80');
    } else if (def.type === 'timed') {
      site.state = 'timed_active';
      site.timer = def.timeLimit || 45;
      this.spawnRescueGuards(site, ['grenadier', 'bandit_gunner', 'infected_runner']);
      this.pushToast(`⏱️ СРОЧНО! У тебя ${def.timeLimit} сек., чтобы спасти: ${def.name}!`, '#f43f5e');
      this.sound.play('skill');
    }
  }

  failRescue(site, reason) {
    site.state = 'failed';
    site.failTimer = 18;
    site.activated = true;
    this.enemies = this.enemies.filter(e => e.rescueId !== site.id);
    this.pushToast(`❌ ${reason} Миссия «${site.def.name}» будет доступна снова через 18 сек.`, '#ef4444');
    this.sound.play('playerHit');
  }

  completeRescue(site) {
    if (site.state === 'done') return false;
    site.state = 'done';
    if (!this.rescuedIds.includes(site.id)) this.rescuedIds.push(site.id);
    this.stats.rescuesDone = this.rescuedIds.length;
    const def = site.def;
    this.inventory.coins += def.rewardCoins || 100;
    this.gainXp(def.rewardXp || 150);
    if (def.rewardWeapon) this.grantWeapon(def.rewardWeapon);
    if (def.rewardItem) this.grantItem(def.rewardItem, 1);
    this.sound.play('levelup');
    this.spawnSpriteEffect('magic', site.x, site.y, 1.6, 14);
    this.pushToast(`🎉 СПАСЁН: ${def.name}! ${def.role}`, '#4ade80');
    this.pushToast(`🏰 ${def.name} перебрался в Убежище VEXMORA (+${def.rewardCoins}🪙)`, '#fbbf24');
    if (site.id === 'res_fighter_1') this.pushToast('🤝 Сержант Шрам теперь может ходить с тобой в рейды! Говори с ним на Базе', '#38bdf8');
    this.advanceQuest('rescue', 1);
    this.advanceQuest('rescue_total', 0);
    this.checkAchievements();
    this.saveGame(true);
    return true;
  }

  damageRescueNpc(site, dmg) {
    if (!site || site.state === 'done') return;
    site.npcHp -= dmg;
    this.addFloatingText(site.npcX, site.npcY - 24, `-${Math.round(dmg)}`, '#f87171');
    if (site.npcHp <= 0 && (site.state === 'defending' || site.state === 'escorting')) {
      this.failRescue(site, `Выживший ${site.def.name} тяжело ранен и эвакуирован медиками!`);
    }
  }

  updateRescues(dt) {
    const p = this.player;
    // Активация спецконтейнеров модификаций под охраной Кибер-Карателя
    for (const cache of this.world.modCaches) {
      if (cache.looted || cache.activated) continue;
      if (dist2(p.x, p.y, cache.x, cache.y) < 560 * 560) {
        cache.activated = true;
        const g = this.spawnEnemyAt(cache.x + 65, cache.y - 40, 'mini_punisher', true);
        if (g) g.modCacheId = cache.id;
        const g2 = this.spawnEnemyAt(cache.x - 70, cache.y + 25, 'bandit_gunner', true);
        if (g2) g2.modCacheId = cache.id;
        this.pushToast('📦 Спецконтейнер охраняет Кибер-Каратель! Победи охрану, чтобы забрать модуль и оружие', '#c084fc');
      }
    }

    for (const site of this.rescueSites) {
      site.animTime += dt * 3;
      if (site.healCd > 0) site.healCd = Math.max(0, site.healCd - dt);
      if (site.state === 'done') continue;
      if (site.state === 'failed') {
        site.failTimer -= dt;
        if (site.failTimer <= 0) {
          site.state = 'idle'; site.activated = false; site.npcHp = site.maxNpcHp;
          site.npcX = site.x; site.npcY = site.y; site.alarmDisabled = !site.def.hasAlarm; site.wave = 0;
        }
        continue;
      }
      if (!site.activated) {
        if (dist2(p.x, p.y, site.x, site.y) < 620 * 620) this.activateRescue(site);
        continue;
      }

      if (site.state === 'defending') {
        if (this.rescueGuardsAlive(site) === 0) {
          const totalWaves = site.def.waves || 2;
          if (site.wave < totalWaves) {
            site.wave++;
            const kinds = site.wave >= 2 ? ['soldier', 'bandit_gunner', 'monster', 'infected_runner'] : ['zombie', 'bandit'];
            this.spawnRescueGuards(site, kinds);
            this.pushToast(`🌊 Волна ${site.wave}/${totalWaves} атакует ${site.def.name}!`, '#f87171');
          } else {
            site.state = 'ready_claim';
            this.pushToast(`✅ ${site.def.name} в безопасности! Подойди и заверши спасение`, '#4ade80');
            this.sound.play('levelup');
          }
        }
      } else if (site.state === 'escorting') {
        // Выживший следует за героем к Убежищу/лагерю
        const destX = site.def.destX || 3160, destY = site.def.destY || 3240;
        const dP = Math.hypot(p.x - site.npcX, p.y - site.npcY);
        if (dP > 58) {
          const sp = 196;
          site.npcX += ((p.x - site.npcX) / (dP || 1)) * sp * dt;
          site.npcY += ((p.y - site.npcY) / (dP || 1)) * sp * dt;
        }
        site.ambushTimer -= dt;
        if (site.ambushTimer <= 0) {
          site.ambushTimer = randRange(16, 24);
          const e = this.spawnEnemyAt(site.npcX + randRange(-210, 210), site.npcY + randRange(-210, 210), Math.random() < 0.5 ? 'bandit' : 'infected_runner', true);
          if (e) e.rescueId = site.id;
          this.pushToast('⚠️ Засада на караван! Защити выжившего!', '#f59e0b');
        }
        if (dist2(site.npcX, site.npcY, destX, destY) < 125 * 125) {
          this.completeRescue(site);
        }
      } else if (site.state === 'timed_active') {
        site.timer -= dt;
        if (this.rescueGuardsAlive(site) === 0) {
          site.state = 'ready_claim';
          this.pushToast(`✅ Охрана уничтожена вовремя! Освободи: ${site.def.name}`, '#4ade80');
        } else if (site.timer <= 0) {
          this.failRescue(site, 'Время вышло! Пленника увезли в другой сектор.');
        }
      }
    }
  }

  lootModCache(cache) {
    if (cache.looted) return false;
    if (this.enemies.some(e => e.modCacheId === cache.id)) {
      this.pushToast('🔒 Контейнер охраняется! Сначала победи Кибер-Карателя и охрану', '#f59e0b');
      return false;
    }
    cache.looted = true;
    if (cache.weaponId) this.grantWeapon(cache.weaponId);
    if (cache.modId && !this.unlockedMods.includes(cache.modId)) this.unlockedMods.push(cache.modId);
    this.inventory.coins += 120;
    this.sound.play('unlock');
    this.spawnSpriteEffect('magic', cache.x, cache.y, 1.5, 14);
    this.pushToast(`📦 Спецконтейнер вскрыт! Модуль «${WEAPON_MODS[cache.modId]?.name}» доступен у Инженера (вкладка 🏰 База)`, '#c084fc');
    if (this.activeContract && this.activeContract.type === 'weapon_cache' && this.activeContract.cacheId === cache.id) {
      this.completeContract();
    }
    this.saveGame(true);
    return true;
  }

  // ── Развитие Убежища и Модификации ───────────────────────────────────
  getBaseRoomCost(roomId) {
    const room = BASE_ROOMS[roomId];
    const lvl = this.baseLevels[roomId] || 0;
    return {
      coins: room.baseCostCoins + lvl * 85,
      wood: room.baseCostWood + lvl,
      scrap: room.baseCostScrap + lvl
    };
  }

  getBaseSpecialistLock(roomId) {
    if (roomId === 'workshop' && !this.rescuedIds.includes('res_engineer')) return 'Сначала спаси Инженера Кая (клетка на востоке Леса)';
    if (roomId === 'garage' && !this.rescuedIds.includes('res_mechanic')) return 'Сначала спаси Механика Рокко (защита раненого на дороге)';
    if (roomId === 'barracks' && !this.rescuedIds.includes('res_fighter_1')) return 'Сначала спаси Сержанта Шрама (клетка в Городе)';
    return null;
  }

  upgradeBaseRoom(roomId) {
    const room = BASE_ROOMS[roomId];
    if (!room) return false;
    const lvl = this.baseLevels[roomId] || 0;
    if (lvl >= 5) { this.pushToast('Отсек уже максимального 5 уровня!', '#94a3b8'); return false; }
    const lock = this.getBaseSpecialistLock(roomId);
    if (lock) { this.pushToast(`🔒 ${lock}`, '#f59e0b'); return false; }
    const cost = this.getBaseRoomCost(roomId);
    if (this.inventory.coins < cost.coins || (this.inventory.resources.wood || 0) < cost.wood || (this.inventory.resources.scrap || 0) < cost.scrap) {
      this.pushToast(`Нужно: ${cost.coins}🪙 · ${cost.wood}🪵 · ${cost.scrap}⚙️`, '#f59e0b');
      return false;
    }
    this.inventory.coins -= cost.coins;
    this.inventory.resources.wood -= cost.wood;
    this.inventory.resources.scrap -= cost.scrap;
    this.baseLevels[roomId] = lvl + 1;
    this.stats.baseUpgrades = (this.stats.baseUpgrades || 0) + 1;
    this.recalcDerivedStats(false);
    // Гараж 1 уровня припарковывает бронеджип прямо у Базы!
    if (roomId === 'garage' && !this.baseJeepSpawned) {
      this.baseJeepSpawned = true;
      this.world.vehicles.push({ id: 'veh_base_jeep', kind: 'jeep', name: 'Бронеджип Убежища VEXMORA', x: 3520, y: 3260, vx: 0, vy: 0, angle: 0, radius: 26, drivable: true, baseSpeed: 345 });
      this.pushToast('🚙 Механик пригнал Бронеджип Убежища к восточным воротам Базы!', '#38bdf8');
    }
    this.sound.play('levelup');
    this.pushToast(`🏰 ${room.name} улучшен до уровня ${lvl + 1}!`, '#4ade80');
    this.advanceQuest('base_upgrade', 1);
    this.checkAchievements();
    this.saveGame(true);
    return true;
  }

  installMod(weaponId, modId) {
    const mod = WEAPON_MODS[modId];
    if (!mod || !WEAPONS[weaponId] || !this.inventory.weapons.includes(weaponId)) return false;
    if ((this.baseLevels.workshop || 0) < 1) {
      this.pushToast('🔒 Нужен Инженерный Цех 1 ур. (спаси Инженера и улучши отсек во вкладке База)', '#f59e0b');
      return false;
    }
    this.weaponMods[weaponId] = this.weaponMods[weaponId] || [];
    if (this.weaponMods[weaponId].includes(modId)) { this.pushToast('Модуль уже установлен на этом оружии', '#94a3b8'); return false; }
    const freeIdx = this.unlockedMods.indexOf(modId);
    if (freeIdx === -1) {
      if (this.inventory.coins < mod.costCoins || (this.inventory.resources.scrap || 0) < mod.costScrap) {
        this.pushToast(`Нужно: ${mod.costCoins}🪙 и ${mod.costScrap}⚙️ техно-деталей`, '#f59e0b');
        return false;
      }
      this.inventory.coins -= mod.costCoins;
      this.inventory.resources.scrap -= mod.costScrap;
    } else {
      this.unlockedMods.splice(freeIdx, 1);
      this.pushToast('🎁 Модуль из секретного контейнера установлен бесплатно!', '#c084fc');
    }
    this.weaponMods[weaponId].push(modId);
    this.stats.modsInstalled = (this.stats.modsInstalled || 0) + 1;
    this.sound.play('levelup');
    this.pushToast(`🔧 Установлен модуль «${mod.name}» на ${WEAPONS[weaponId].name}!`, '#4ade80');
    this.checkAchievements();
    this.saveGame(true);
    return true;
  }

  uninstallMod(weaponId, modId) {
    const list = this.weaponMods[weaponId] || [];
    const idx = list.indexOf(modId);
    if (idx === -1) return false;
    list.splice(idx, 1);
    if (!this.unlockedMods.includes(modId)) this.unlockedMods.push(modId);
    this.sound.play('ui');
    this.pushToast(`🔧 Модуль снят и возвращён на склад Базы`, '#38bdf8');
    return true;
  }

  buyPerk(perkId) {
    const perk = SKILL_TREE.find(pk => pk.id === perkId);
    if (!perk) return false;
    const rank = this.getPerkRank(perkId);
    if (rank >= perk.maxRank) return false;
    if (this.player.skillPoints <= 0) { this.pushToast('Нет очков навыков! Повышай уровень героя', '#f59e0b'); return false; }
    this.player.skillPoints--;
    this.skillTree[perkId] = rank + 1;
    this.recalcDerivedStats(false);
    this.sound.play('levelup');
    this.pushToast(`🌟 Перк «${perk.name}» — ранг ${rank + 1}!`, '#c084fc');
    return true;
  }

  // ── Боец-напарник (спасённый Сержант Шрам) ───────────────────────────
  spawnCompanion(silent = false) {
    const p = this.player;
    const maxHp = 130 + p.level * 16 + (this.baseLevels.barracks || 0) * 20;
    this.companion = {
      x: p.x + 34, y: p.y + 22, hp: maxHp, maxHp,
      attackCd: 0, animTime: 0, respawnTimer: 0, radius: 13
    };
    if (!silent) this.pushToast('🤝 Сержант Шрам прикрывает тебя в рейде!', '#4ade80');
  }

  toggleCompanion() {
    if (!this.rescuedIds.includes('res_fighter_1')) {
      this.pushToast('🔒 Сначала спаси Сержанта Шрама из клетки в Городе!', '#f59e0b');
      return false;
    }
    this.companionActive = !this.companionActive;
    if (this.companionActive) this.spawnCompanion();
    else { this.companion = null; this.pushToast('🤝 Напарник вернулся на Базу', '#94a3b8'); }
    this.sound.play('ui');
    this.saveGame(true);
    return true;
  }

  damageCompanion(dmg) {
    const c = this.companion;
    if (!c || c.hp <= 0) return;
    c.hp -= dmg;
    this.addFloatingText(c.x, c.y - 24, `-${Math.round(dmg)}`, '#fda4af');
    if (c.hp <= 0) {
      c.hp = 0;
      c.respawnTimer = 25;
      this.pushToast('🚑 Напарник тяжело ранен! Медики Базы вернут его в строй через 25 сек.', '#f59e0b');
      this.sound.play('playerHit');
    }
  }

  updateCompanion(dt) {
    if (!this.companionActive) return;
    const p = this.player;
    if (!this.companion) this.spawnCompanion(true);
    const c = this.companion;
    c.animTime += dt * 8;
    if (c.hp <= 0) {
      c.respawnTimer -= dt;
      if (c.respawnTimer <= 0 && !p.dead) {
        c.hp = Math.round(c.maxHp * 0.65);
        c.x = p.x + 30; c.y = p.y + 18;
        this.pushToast('🤝 Напарник вернулся в строй!', '#4ade80');
        this.sound.play('heal');
      }
      return;
    }
    const dP = Math.hypot(p.x - c.x, p.y - c.y);
    if (dP > 880) { c.x = p.x + 30; c.y = p.y + 18; }
    else if (dP > 78 && !p.vehicleId) {
      const sp = 252;
      c.x += ((p.x - c.x) / (dP || 1)) * sp * dt;
      c.y += ((p.y - c.y) / (dP || 1)) * sp * dt;
    }
    c.attackCd = Math.max(0, c.attackCd - dt);
    if (c.attackCd <= 0 && !p.dead) {
      let target = null, bestD2 = 400 * 400;
      for (const b of this.bossEntities) { const dd = dist2(c.x, c.y, b.x, b.y); if (dd < bestD2) { bestD2 = dd; target = b; } }
      for (const e of this.enemies) { if (e.isStealthed) continue; const dd = dist2(c.x, c.y, e.x, e.y); if (dd < bestD2) { bestD2 = dd; target = e; } }
      if (target) {
        c.attackCd = Math.max(0.28, 0.55 / (1 + this.getPerkRank('perk_commander') * 0.25));
        const dmgMult = (0.5 + (this.baseLevels.barracks || 0) * 0.25) * (1 + this.getPerkRank('perk_commander') * 0.25);
        const dmg = Math.max(6, Math.round(this.getWeaponDamage('rifle') * dmgMult * 0.55));
        const ang = Math.atan2(target.y - c.y, target.x - c.x);
        this.projectiles.push({
          fromPlayer: true, kind: 'bullet', companionShot: true,
          x: c.x + Math.cos(ang) * 16, y: c.y - 6 + Math.sin(ang) * 16,
          vx: Math.cos(ang) * 820, vy: Math.sin(ang) * 820,
          radius: 4, damage: dmg, isCrit: false, pierce: 0, splashRadius: 0,
          knockback: 70, color: '#4ade80', life: 0.55
        });
        this.sound.play('gun');
      }
    }
  }

  // ── Повторяемые спецоперации и Оборона Базы ──────────────────────────
  generateContract(forceType = null) {
    if (this.activeContract) { this.pushToast('Сначала завершите текущую спецоперацию!', '#f59e0b'); return null; }
    const tpl = forceType
      ? MISSION_TEMPLATES.find(t => t.type === forceType)
      : MISSION_TEMPLATES[Math.floor(Math.random() * MISSION_TEMPLATES.length)];
    if (!tpl) return null;
    const p = this.player;
    this.contractSeq++;
    const id = `contract_${this.contractSeq}_${Date.now().toString(36)}`;
    // Точка операции: здание подальше от Базы и костров
    const farBuildings = this.world.buildings.filter(b => dist2(b.x, b.y, 3160, 3180) > 700 * 700);
    const anchor = farBuildings[Math.floor(Math.random() * farBuildings.length)] || { x: 4500, y: 3200 };
    let cx = clamp(anchor.x + randRange(-220, 220), 220, this.world.width - 220);
    let cy = clamp(anchor.y + randRange(-220, 220), 220, this.world.height - 220);
    const rewardCoins = 170 + this.player.level * 28;
    const rewardXp = 180 + this.player.level * 30;
    const contract = {
      id, type: tpl.type, icon: tpl.icon, title: tpl.title, desc: tpl.desc,
      x: cx, y: cy, progress: 0, target: 1, rewardCoins, rewardXp,
      destX: 3160, destY: 3240, cacheId: null, ambushTimer: 14
    };
    const tag = (e, target = 'player') => { if (e) { e.contractId = id; e.aggroTarget = target; } return e; };

    if (tpl.type === 'clear_outpost') {
      contract.target = 6;
      ['zombie', 'bandit', 'bandit_gunner', 'soldier', 'infected_runner', 'monster'].forEach((k, i2) => {
        tag(this.spawnEnemyAt(cx + Math.cos(i2) * 85, cy + Math.sin(i2) * 85, k, true));
      });
    } else if (tpl.type === 'hunt_commander') {
      contract.target = 3;
      tag(this.spawnEnemyAt(cx, cy, 'mini_punisher', true));
      tag(this.spawnEnemyAt(cx + 80, cy, 'soldier', true));
      tag(this.spawnEnemyAt(cx - 80, cy, 'bandit_gunner', true));
    } else if (tpl.type === 'free_captive') {
      contract.target = 0; // завершается взаимодействием после зачистки охраны
      this.contractNpc = { kind: 'captive', name: 'Пленный выживший', x: cx, y: cy, hp: 100, maxHp: 100, active: true, animTime: 0 };
      ['bandit', 'bandit_gunner', 'soldier', 'infected_runner'].forEach((k, i2) => {
        tag(this.spawnEnemyAt(cx + Math.cos(i2 * 1.7) * 95, cy + Math.sin(i2 * 1.7) * 95, k, true));
      });
    } else if (tpl.type === 'escort_survivor') {
      contract.target = 0;
      contract.x = p.x + 120; contract.y = p.y + 60;
      this.contractNpc = { kind: 'survivor', name: 'Выживший каравана', x: contract.x, y: contract.y, hp: 110, maxHp: 110, active: true, animTime: 0 };
    } else if (tpl.type === 'weapon_cache') {
      const cache = this.world.modCaches.find(m => !m.looted);
      if (!cache) { this.pushToast('Все спецконтейнеры уже вскрыты! Выбери другую операцию позже', '#94a3b8'); return null; }
      contract.target = 0;
      contract.cacheId = cache.id;
      contract.x = cache.x; contract.y = cache.y;
    } else if (tpl.type === 'base_defense') {
      contract.target = 8;
      contract.x = 3160; contract.y = 3180;
      for (let i2 = 0; i2 < 8; i2++) {
        const ang = (i2 / 8) * Math.PI * 2;
        const kinds = ['zombie', 'bandit', 'infected_runner', 'bandit_gunner', 'monster', 'soldier', 'acid_spitter', 'grenadier'];
        const e = this.spawnEnemyAt(3160 + Math.cos(ang) * 470, 3180 + Math.sin(ang) * 470, kinds[i2], true);
        if (e) { e.contractId = id; }
      }
      this.pushToast('🚨 ШТУРМ УБЕЖИЩА! Враги атакуют Базу со всех сторон — защищай периметр!', '#f43f5e');
      this.sound.play('skill');
    }

    this.activeContract = contract;
    this.manualObjective = null;
    this.pushToast(`${tpl.icon} СПЕЦОПЕРАЦИЯ: ${tpl.title} (+${rewardCoins}🪙)`, '#fbbf24');
    this.sound.play('unlock');
    return contract;
  }

  completeContract() {
    const c = this.activeContract;
    if (!c) return false;
    this.activeContract = null;
    this.contractNpc = null;
    this.inventory.coins += c.rewardCoins;
    this.gainXp(c.rewardXp);
    this.stats.contractsDone = (this.stats.contractsDone || 0) + 1;
    this.sound.play('levelup');
    this.pushToast(`🎯 Спецоперация выполнена: «${c.title}»! +${c.rewardCoins}🪙 +${c.rewardXp} XP`, '#4ade80');
    this.checkAchievements();
    this.saveGame(true);
    return true;
  }

  damageContractNpc(dmg) {
    const n = this.contractNpc;
    if (!n || !n.active) return;
    n.hp -= dmg;
    this.addFloatingText(n.x, n.y - 24, `-${Math.round(dmg)}`, '#fda4af');
    if (n.hp <= 0) {
      this.pushToast(`❌ ${n.name} тяжело ранен и эвакуирован! Спецоперация провалена`, '#ef4444');
      this.activeContract = null;
      this.contractNpc = null;
    }
  }

  updateContract(dt) {
    const c = this.activeContract;
    if (!c) return;
    const p = this.player;
    if ((c.type === 'clear_outpost' || c.type === 'hunt_commander' || c.type === 'base_defense') && c.progress >= c.target) {
      this.completeContract();
      return;
    }
    if (this.contractNpc && this.contractNpc.active) {
      const n = this.contractNpc;
      n.animTime += dt * 4;
      if (c.type === 'escort_survivor') {
        const dP = Math.hypot(p.x - n.x, p.y - n.y);
        if (dP > 60) {
          n.x += ((p.x - n.x) / (dP || 1)) * 198 * dt;
          n.y += ((p.y - n.y) / (dP || 1)) * 198 * dt;
        }
        c.ambushTimer -= dt;
        if (c.ambushTimer <= 0) {
          c.ambushTimer = randRange(18, 26);
          const e = this.spawnEnemyAt(n.x + randRange(-230, 230), n.y + randRange(-230, 230), 'bandit', true);
          if (e) { e.contractId = c.id; e.aggroTarget = 'contractNpc'; }
          this.pushToast('⚠️ Налёт на караван! Защити выжившего!', '#f59e0b');
        }
        if (dist2(n.x, n.y, c.destX, c.destY) < 130 * 130) {
          this.pushToast('🏰 Караван благополучно прибыл в Убежище!', '#4ade80');
          this.completeContract();
        }
      }
    }
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
      const unlock = this.getWeaponUnlockStatus(id);
      if (!unlock.unlocked) {
        this.pushToast(`🔒 ${w.name}: ${unlock.reason}`, '#f59e0b');
        return false;
      }
      const price = this.getShopPrice('weapon', w);
      if (this.inventory.coins < price) {
        this.pushToast('Недостаточно монет!', '#ef4444');
        return false;
      }
      this.inventory.coins -= price;
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
    this.reloadTimer = 0;
    this.reloadWeaponId = null;
    this.sound.play('ui');
    return true;
  }

  upgradeWeapon(weaponId) {
    if (!this.inventory.weapons.includes(weaponId)) return false;
    const cur = this.weaponUpgrades[weaponId] || 0;
    if (cur >= 10) return false;
    const smithDisc = this.rescuedIds.includes('res_abyss_smith') ? 0.75 : 1;
    const costCoins = Math.round((45 + cur * 40) * smithDisc);
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
    const craftCost = Math.round(rec.costCoins * (this.rescuedIds.includes('res_abyss_smith') ? 0.75 : 1));
    if (this.inventory.coins < craftCost) {
      this.pushToast('Недостаточно монет!', '#ef4444');
      return false;
    }
    for (const [resId, need] of Object.entries(rec.ingredients)) {
      if ((this.inventory.resources[resId] || 0) < need) {
        this.pushToast(`Не хватает ресурса: ${RESOURCES[resId].name}`, '#f59e0b');
        return false;
      }
    }

    this.inventory.coins -= craftCost;
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
      // Синхронизация уже открытых лагерей/бункеров/боссов, спасённых и базы
      if (g.kind === 'campfire' && this.unlockedCamps.includes(g.campId)) {
        this.questProgress[key] = 1;
      }
      if (g.kind === 'rescue' || g.kind === 'rescue_total') {
        this.questProgress[key] = Math.min(g.target, this.rescuedIds.length);
      }
      if (g.kind === 'base_upgrade') {
        this.questProgress[key] = Math.min(g.target, this.stats.baseUpgrades || 0);
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
