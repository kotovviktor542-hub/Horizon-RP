// Основной игровой движок Horizon: Пепел Рубежа
// Полный цикл: физика 2.5D + прыжки по оси Z, боёвка, 6 видов оружия, 3 способности,
// 14 видов врагов, 4 уникальных босса, выживание, квесты, достижения, туман войны и сохранения.

import {
  WORLD_CONFIG, RARITIES, BIOMES, CAMPFIRES, NPCS, SECRETS,
  RESOURCES, CONSUMABLES, WEAPONS, ARMORS, RELICS,
  SKILLS, RECIPES, ENEMIES, BOSSES, QUESTS, ACHIEVEMENTS
} from './data.js';
import { createWorld, getBiomeIdAt, dist2 } from './world.js';
import { sound } from './audio.js';

export const SAVE_KEY = 'horizon_rp_save_v1';
const FOG_GRID = 48; // 48x48 ячеек тумана войны (по 100px)

export function createGameEngine(options = {}) {
  const world = createWorld(options.seed || 20261025);

  // Пул частиц и всплывающего текста (без аллокаций в кадре для слабых Android)
  const MAX_PARTICLES = 220;
  const particles = Array.from({ length: MAX_PARTICLES }, () => ({ active: false }));
  const floatingTexts = [];
  const toasts = [];

  const state = createInitialState();

  function createInitialState() {
    return {
      version: 1,
      playTime: 0,
      dayTime: 0.28, // 0..1 (0.25 утро, 0.5 полдень, 0.78 закат, 0.0 полночь)
      currentBiome: 'meadow',
      paused: false,
      gameOver: false,
      victoryShown: false,

      settings: {
        quality: 'medium', // 'low' | 'medium' | 'high'
        sfxVolume: 0.7,
        musicVolume: 0.35,
        muted: false,
        screenShake: true,
        joystickMode: 'dynamic'
      },

      player: {
        x: WORLD_CONFIG.spawnX,
        y: WORLD_CONFIG.spawnY,
        z: 0,
        vz: 0,
        vx: 0,
        vy: 0,
        facingX: 0,
        facingY: 1,
        facingAngle: Math.PI * 0.5,
        radius: 16,

        level: 1,
        xp: 0,
        xpNext: 100,
        statPoints: 0,
        skillPoints: 1,
        gold: 60,

        // Вложенные очки характеристик
        attributes: {
          power: 0,    // +урон оружия
          vitality: 0, // +макс HP и защита
          agility: 0,  // +скорость, стамина и крит
          arcane: 0    // +урон умений и ускорение КД
        },
        permanentBonusHp: 0,

        hp: 120,
        maxHp: 120,
        stamina: 100,
        maxStamina: 100,
        satiety: 100, // 0..100 тонус/сытость

        equippedWeapon: 'sword_iron',
        equippedArmor: 'armor_tunic',
        equippedRelics: [null, null],
        quickConsumable: 'potion_hp',

        // Боевые таймеры и анимации
        attackCooldown: 0,
        swingTimer: 0,
        swingDuration: 0.22,
        swingAngle: 0,
        swingStyle: 'sword',
        comboStep: 0,
        comboResetTimer: 0,
        shotCounter: 0,

        invulnTimer: 0,
        hitFlash: 0,
        consumableCooldown: 0,
        phoenixCooldown: 0,

        // Активные баффы
        regenTimer: 0,
        rageTimer: 0,
        aegisTimer: 0,
        thunderLeap: null, // { timer, duration, targetX, targetY }
        walkCycle: 0
      },

      skillRanks: {
        whirlwind: 1,
        thunder_slam: 0,
        aegis_pulse: 0
      },
      skillCooldowns: {
        whirlwind: 0,
        thunder_slam: 0,
        aegis_pulse: 0
      },

      inventory: {
        weapons: ['sword_iron'],
        armors: ['armor_tunic'],
        relics: [],
        resources: {
          wood: 2,
          herb: 3,
          meat: 1,
          iron: 1,
          soul: 0,
          mithril: 0,
          crystal: 0
        },
        consumables: {
          potion_hp: 3,
          ration_roast: 2,
          elixir_power: 0,
          potion_greater: 0
        }
      },

      weaponUpgrades: {
        sword_iron: 0
      },

      unlockedCampfires: ['camp_haven'],
      respawnCampId: 'camp_haven',
      discoveredSecrets: [],
      openedChests: [],
      brokenPermanentNodes: [],
      litBraziers: [],
      defeatedBosses: [],

      // Прогресс квестов
      activeQuestIndex: 0,
      completedQuests: [],
      questProgress: {
        kills: 0,
        gather: 0,
        craft_or_upgrade: 0,
        biomeKills: { meadow: 0, ruins: 0, mire: 0, frost: 0, rift: 0 }
      },
      // Бесконечный контракт охотника после или параллельно сюжету
      bounty: {
        level: 1,
        biome: 'meadow',
        kills: 0,
        target: 8,
        rewardGold: 110,
        rewardXp: 120
      },

      unlockedAchievements: [],

      stats: {
        totalKills: 0,
        totalGathered: 0,
        totalCrafted: 0,
        totalDamageDealt: 0,
        bossesSlain: 0,
        deaths: 0
      },

      // Туман войны: массив 48*48 (0 или 1)
      fog: new Array(FOG_GRID * FOG_GRID).fill(0),

      // Динамические сущности мира
      enemies: [],
      activeBoss: null,
      projectiles: [],
      shockwaves: [],
      telegraphs: [],
      lootDrops: [],

      camera: {
        x: WORLD_CONFIG.spawnX,
        y: WORLD_CONFIG.spawnY,
        shake: 0
      },

      nearbyInteractable: null
    };
  }

  // ── Расчёт производных характеристик игрока ──────────────────────────
  function getComputedStats() {
    const p = state.player;
    const w = WEAPONS[p.equippedWeapon] || WEAPONS.sword_iron;
    const a = ARMORS[p.equippedArmor] || ARMORS.armor_tunic;
    const upg = state.weaponUpgrades[w.id] || 0;

    let maxHp = 100 + (p.level - 1) * 16 + p.attributes.vitality * 22 + a.hpBonus + p.permanentBonusHp;
    let defense = 2 + p.attributes.vitality * 2 + a.defense;
    let atkMult = 1 + (p.level - 1) * 0.06 + p.attributes.power * 0.09;
    let speedMult = 1 + a.speedBonus + p.attributes.agility * 0.035;
    let maxStamina = 100 + p.attributes.agility * 10;
    let staminaRegen = 22 + p.attributes.agility * 2.2;
    let critChance = 0.06 + w.critBonus + p.attributes.agility * 0.025;
    let skillMult = 1 + p.attributes.arcane * 0.12 + (p.level - 1) * 0.05;
    let cdrMult = Math.min(0.45, p.attributes.arcane * 0.035);
    let lifesteal = w.lifesteal || 0;
    let magnetRadius = 82;
    let goldMult = 1;
    let hpRegen = 0;
    let hasPhoenix = false;

    for (const rId of p.equippedRelics) {
      if (!rId || !RELICS[rId]) continue;
      const st = RELICS[rId].stats;
      if (st.maxHp) maxHp += st.maxHp;
      if (st.defense) defense += st.defense;
      if (st.atkPct) atkMult += st.atkPct;
      if (st.speedPct) speedMult += st.speedPct;
      if (st.staminaRegen) staminaRegen += st.staminaRegen;
      if (st.critChance) critChance += st.critChance;
      if (st.skillPct) skillMult += st.skillPct;
      if (st.cdrPct) cdrMult = Math.min(0.55, cdrMult + st.cdrPct);
      if (st.lifesteal) lifesteal += st.lifesteal;
      if (st.magnetBonus) magnetRadius += st.magnetBonus;
      if (st.goldPct) goldMult += st.goldPct;
      if (st.hpRegen) hpRegen += st.hpRegen;
      if (st.phoenixRevive) hasPhoenix = true;
    }

    if (p.rageTimer > 0) {
      atkMult += 0.30;
      speedMult += 0.20;
    }
    if (p.satiety >= 65) {
      hpRegen += 1.4;
      staminaRegen += 5;
    } else if (p.satiety <= 15) {
      speedMult *= 0.90;
    }
    if (p.regenTimer > 0) {
      hpRegen += 5.5;
    }

    const weaponDamage = Math.round((w.baseDamage + upg * 5.5) * atkMult);
    const moveSpeed = Math.round(215 * speedMult);

    return {
      maxHp: Math.round(maxHp),
      defense: Math.round(defense),
      weaponDamage,
      atkMult,
      moveSpeed,
      maxStamina: Math.round(maxStamina),
      staminaRegen,
      critChance: Math.min(0.75, critChance),
      skillMult,
      cdrMult,
      lifesteal,
      magnetRadius,
      goldMult,
      hpRegen,
      hasPhoenix
    };
  }

  function syncPlayerVitals(healFull = false) {
    const cs = getComputedStats();
    state.player.maxHp = cs.maxHp;
    state.player.maxStamina = cs.maxStamina;
    if (healFull) {
      state.player.hp = cs.maxHp;
      state.player.stamina = cs.maxStamina;
    } else {
      state.player.hp = Math.min(state.player.hp, cs.maxHp);
      state.player.stamina = Math.min(state.player.stamina, cs.maxStamina);
    }
  }

  // ── Уведомления, всплывающие цифры и частицы ─────────────────────────
  function pushToast(title, subtitle = '', color = '#fbbf24', icon = '✨') {
    toasts.push({ id: Math.random().toString(36).slice(2), title, subtitle, color, icon, timer: 3.6 });
    if (toasts.length > 4) toasts.shift();
  }

  function addFloatingText(x, y, text, color = '#ffffff', size = 15) {
    if (floatingTexts.length > 36) floatingTexts.shift();
    floatingTexts.push({
      x: x + (Math.random() - 0.5) * 16,
      y,
      vy: -48 - Math.random() * 18,
      text,
      color,
      size,
      life: 0.85,
      maxLife: 0.85
    });
  }

  function spawnParticles(x, y, count, color, speed = 130, life = 0.45, size = 4, z = 8) {
    const qMult = state.settings.quality === 'low' ? 0.45 : state.settings.quality === 'high' ? 1.25 : 0.85;
    const total = Math.max(1, Math.round(count * qMult));
    let spawned = 0;
    for (let i = 0; i < particles.length && spawned < total; i++) {
      const pt = particles[i];
      if (pt.active) continue;
      const ang = Math.random() * Math.PI * 2;
      const spd = speed * (0.35 + Math.random() * 0.85);
      pt.active = true;
      pt.x = x;
      pt.y = y;
      pt.z = z;
      pt.vx = Math.cos(ang) * spd;
      pt.vy = Math.sin(ang) * spd;
      pt.vz = 40 + Math.random() * 90;
      pt.color = color;
      pt.size = size * (0.7 + Math.random() * 0.6);
      pt.life = life * (0.75 + Math.random() * 0.45);
      pt.maxLife = pt.life;
      spawned++;
    }
  }

  function addScreenShake(amount) {
    if (!state.settings.screenShake) return;
    state.camera.shake = Math.min(18, Math.max(state.camera.shake, amount));
  }

  // ── Туман войны ──────────────────────────────────────────────────────
  function revealFogAround(x, y, radiusCells = 3) {
    const cellW = WORLD_CONFIG.width / FOG_GRID;
    const cx = Math.floor(x / cellW);
    const cy = Math.floor(y / cellW);
    for (let dy = -radiusCells; dy <= radiusCells; dy++) {
      const ny = cy + dy;
      if (ny < 0 || ny >= FOG_GRID) continue;
      for (let dx = -radiusCells; dx <= radiusCells; dx++) {
        const nx = cx + dx;
        if (nx < 0 || nx >= FOG_GRID) continue;
        if (dx * dx + dy * dy <= radiusCells * radiusCells + 1) {
          state.fog[ny * FOG_GRID + nx] = 1;
        }
      }
    }
  }

  // Первичное открытие лагеря
  revealFogAround(WORLD_CONFIG.spawnX, WORLD_CONFIG.spawnY, 4);

  // ── Добавление предметов и наград ────────────────────────────────────
  function grantRewardItem(item, silent = false) {
    if (!item) return;
    if (item.type === 'gold') {
      const amt = Math.round(item.amount * getComputedStats().goldMult);
      state.player.gold += amt;
      if (!silent) addFloatingText(state.player.x, state.player.y - 26, `+${amt} зол.`, '#fbbf24', 15);
    } else if (item.type === 'resource') {
      const cnt = item.count || 1;
      state.inventory.resources[item.id] = (state.inventory.resources[item.id] || 0) + cnt;
      if (!silent && RESOURCES[item.id]) {
        addFloatingText(state.player.x, state.player.y - 24, `+${cnt} ${RESOURCES[item.id].name}`, RESOURCES[item.id].color, 13);
      }
    } else if (item.type === 'consumable') {
      const cnt = item.count || 1;
      state.inventory.consumables[item.id] = (state.inventory.consumables[item.id] || 0) + cnt;
      if (!silent && CONSUMABLES[item.id]) {
        pushToast('Получен предмет', `${CONSUMABLES[item.id].name} ×${cnt}`, '#34d399', CONSUMABLES[item.id].icon);
      }
    } else if (item.type === 'weapon' && WEAPONS[item.id]) {
      if (!state.inventory.weapons.includes(item.id)) {
        state.inventory.weapons.push(item.id);
        state.weaponUpgrades[item.id] = state.weaponUpgrades[item.id] || 0;
        if (!silent) pushToast('Новое оружие!', WEAPONS[item.id].name, RARITIES[WEAPONS[item.id].rarity].color, WEAPONS[item.id].icon);
      } else {
        state.weaponUpgrades[item.id] = Math.min(10, (state.weaponUpgrades[item.id] || 0) + 1);
        if (!silent) pushToast('Оружие усилено!', `${WEAPONS[item.id].name} +${state.weaponUpgrades[item.id]}`, '#fbbf24', WEAPONS[item.id].icon);
      }
    } else if (item.type === 'armor' && ARMORS[item.id]) {
      if (!state.inventory.armors.includes(item.id)) {
        state.inventory.armors.push(item.id);
        if (!silent) pushToast('Новая броня!', ARMORS[item.id].name, RARITIES[ARMORS[item.id].rarity].color, ARMORS[item.id].icon);
      } else {
        state.player.gold += 120;
      }
    } else if (item.type === 'relic' && RELICS[item.id]) {
      if (!state.inventory.relics.includes(item.id)) {
        state.inventory.relics.push(item.id);
        // Автоэкипировка в свободный слот реликвии!
        const emptyIdx = state.player.equippedRelics.indexOf(null);
        if (emptyIdx !== -1) state.player.equippedRelics[emptyIdx] = item.id;
        syncPlayerVitals(false);
        if (!silent) pushToast('Найдена реликвия!', RELICS[item.id].name, RARITIES[RELICS[item.id].rarity].color, RELICS[item.id].icon);
      } else {
        state.player.gold += 150;
      }
    }
  }

  function grantXp(amount) {
    const p = state.player;
    const nightBonus = isNightTime() ? 1.30 : 1.0;
    p.xp += Math.round(amount * nightBonus);
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level += 1;
      p.xpNext = Math.round(100 * Math.pow(1.28, p.level - 1));
      p.statPoints += 2;
      p.skillPoints += 1;
      // Автооткрытие способностей 2 и 3 на 2 и 3 уровнях!
      if (p.level >= 2 && state.skillRanks.thunder_slam === 0) {
        state.skillRanks.thunder_slam = 1;
        pushToast('Открыта способность!', '⚡ Громовой Прыжок (Кнопка 2)', '#38bdf8', '⚡');
      }
      if (p.level >= 3 && state.skillRanks.aegis_pulse === 0) {
        state.skillRanks.aegis_pulse = 1;
        pushToast('Открыта способность!', '🛡️ Эфирный Бастион (Кнопка 3)', '#c084fc', '🛡️');
      }
      syncPlayerVitals(true);
      sound.play('levelup');
      spawnParticles(p.x, p.y, 28, '#fbbf24', 210, 0.75, 5, 12);
      state.shockwaves.push({
        x: p.x, y: p.y, radius: 12, maxRadius: 125, speed: 320,
        color: '#fbbf24', friendly: true, damage: 0
      });
      pushToast(`Уровень ${p.level}!`, '+2 очка характеристик · +1 очко умений', '#fbbf24', '⭐');
      addFloatingText(p.x, p.y - 36, `УРОВЕНЬ ${p.level}!`, '#fbbf24', 18);
    }
    checkAchievements();
  }

  function isNightTime() {
    return state.dayTime >= 0.80 || state.dayTime <= 0.18;
  }

  // ── Проверка квестов и достижений ────────────────────────────────────
  function getCurrentQuest() {
    if (state.activeQuestIndex >= QUESTS.length) return null;
    return QUESTS[state.activeQuestIndex];
  }

  function getQuestStatus(quest) {
    if (!quest) return null;
    const goals = quest.goals.map(g => {
      let current = 0;
      if (g.kind === 'kills') current = state.questProgress.kills;
      else if (g.kind === 'gather') current = state.questProgress.gather;
      else if (g.kind === 'craft_or_upgrade') current = state.questProgress.craft_or_upgrade;
      else if (g.kind === 'campfire') current = state.unlockedCampfires.includes(g.campId) ? 1 : 0;
      else if (g.kind === 'biome_kills') current = state.questProgress.biomeKills[g.biome] || 0;
      else if (g.kind === 'boss') current = state.defeatedBosses.includes(g.bossId) ? 1 : 0;
      return { ...g, current: Math.min(g.target, current), done: current >= g.target };
    });
    return {
      quest,
      goals,
      allDone: goals.every(g => g.done)
    };
  }

  function checkQuests() {
    let q = getCurrentQuest();
    while (q) {
      const st = getQuestStatus(q);
      if (!st.allDone) break;
      state.completedQuests.push(q.id);
      state.activeQuestIndex += 1;
      state.player.gold += q.rewards.gold || 0;
      if (q.rewards.items) {
        for (const it of q.rewards.items) grantRewardItem(it, false);
      }
      if (q.rewards.xp) grantXp(q.rewards.xp);
      sound.play('chest');
      pushToast(`Задание выполнено!`, `${q.title} (+${q.rewards.gold} зол.)`, '#4ade80', '📜');
      q = getCurrentQuest();
    }
  }

  function checkAchievements() {
    for (const ach of ACHIEVEMENTS) {
      if (state.unlockedAchievements.includes(ach.id)) continue;
      if (ach.check(state)) {
        state.unlockedAchievements.push(ach.id);
        state.player.gold += ach.goldReward;
        sound.play('chest');
        pushToast(`Достижение: ${ach.name}`, `+${ach.goldReward} золота`, '#fbbf24', ach.icon);
      }
    }
  }

  // ── Прыжок (ось Z), Атака, Способности, Зелья, Взаимодействие ────────
  function triggerJump(moveX = 0, moveY = 0) {
    const p = state.player;
    if (state.gameOver || state.paused) return false;
    if (p.z > 2 || p.thunderLeap) return false;
    if (p.stamina < 14) {
      addFloatingText(p.x, p.y - 24, 'Мало сил!', '#94a3b8', 12);
      return false;
    }
    p.stamina -= 14;
    p.vz = 335;
    p.z = 3;
    p.invulnTimer = Math.max(p.invulnTimer, 0.24);
    // Небольшой импульс в сторону движения при прыжке
    const len = Math.hypot(moveX, moveY);
    if (len > 0.15) {
      p.vx += (moveX / len) * 145;
      p.vy += (moveY / len) * 145;
    }
    sound.play('jump');
    spawnParticles(p.x, p.y, 8, '#cbd5e1', 85, 0.32, 3.5, 2);
    return true;
  }

  function findAutoAimAngle() {
    const p = state.player;
    const w = WEAPONS[p.equippedWeapon] || WEAPONS.sword_iron;
    const maxDist = Math.max(155, w.range + 65);
    let bestAng = p.facingAngle;
    let bestScore = Infinity;

    const candidates = state.activeBoss ? [state.activeBoss, ...state.enemies] : state.enemies;
    for (const e of candidates) {
      if (!e || e.hp <= 0) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d > maxDist) continue;
      const ang = Math.atan2(e.y - p.y, e.x - p.x);
      let diff = Math.abs(((ang - p.facingAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      const score = d + diff * 45;
      if (score < bestScore) {
        bestScore = score;
        bestAng = ang;
      }
    }
    if (bestScore < Infinity) return bestAng;

    // Если врагов рядом нет — автонаведение на ближайший ресурс/ящик вплотную
    for (const n of world.nodes) {
      if (n.respawnTimer > 0 || n.hp <= 0) continue;
      const d = Math.hypot(n.x - p.x, n.y - p.y);
      if (d <= 95 && d < bestScore) {
        bestScore = d;
        bestAng = Math.atan2(n.y - p.y, n.x - p.x);
      }
    }
    return bestAng;
  }

  function triggerAttack() {
    const p = state.player;
    if (state.gameOver || state.paused || p.thunderLeap) return false;
    if (p.attackCooldown > 0) return false;

    const w = WEAPONS[p.equippedWeapon] || WEAPONS.sword_iron;
    const cs = getComputedStats();
    const aimAngle = findAutoAimAngle();
    p.facingAngle = aimAngle;
    p.facingX = Math.cos(aimAngle);
    p.facingY = Math.sin(aimAngle);

    p.attackCooldown = w.cooldown;
    p.swingStyle = w.style;
    p.swingDuration = Math.min(0.28, w.cooldown * 0.82);
    p.swingTimer = p.swingDuration;
    p.swingAngle = aimAngle;
    p.comboStep = (p.comboStep + 1) % 3;
    p.comboResetTimer = 1.1;

    const isFinisher = p.comboStep === 0;
    const dmgMult = isFinisher ? 1.28 : 1.0;

    if (w.style === 'bow') {
      sound.play('bow');
      p.shotCounter += 1;
      const triple = p.shotCounter % 3 === 0;
      const angles = triple ? [aimAngle - 0.18, aimAngle, aimAngle + 0.18] : [aimAngle];
      for (const ang of angles) {
        state.projectiles.push({
          x: p.x + Math.cos(ang) * 18,
          y: p.y + Math.sin(ang) * 18,
          vx: Math.cos(ang) * w.projectileSpeed,
          vy: Math.sin(ang) * w.projectileSpeed,
          radius: 7,
          damage: Math.round(cs.weaponDamage * (triple ? 0.85 : 1.05)),
          critChance: cs.critChance,
          knockback: w.knockback,
          color: w.trailColor,
          friendly: true,
          pierce: 1,
          life: w.range / w.projectileSpeed,
          kind: 'arrow'
        });
      }
    } else if (w.style === 'staff') {
      sound.play('magic');
      state.projectiles.push({
        x: p.x + Math.cos(aimAngle) * 20,
        y: p.y + Math.sin(aimAngle) * 20,
        vx: Math.cos(aimAngle) * w.projectileSpeed,
        vy: Math.sin(aimAngle) * w.projectileSpeed,
        radius: 10,
        damage: Math.round(cs.weaponDamage * dmgMult),
        critChance: cs.critChance,
        knockback: w.knockback,
        color: w.trailColor,
        friendly: true,
        homing: true,
        splashRadius: 68,
        pierce: 0,
        life: w.range / w.projectileSpeed + 0.15,
        kind: 'orb'
      });
    } else {
      // Ближний бой: меч, кинжалы, молот, коса
      sound.play(w.style === 'daggers' ? 'daggers' : w.style === 'hammer' ? 'hammer' : w.style === 'scythe' ? 'scythe' : 'swing');

      if (w.style === 'daggers') {
        p.vx += Math.cos(aimAngle) * 95;
        p.vy += Math.sin(aimAngle) * 95;
      }

      const range = w.range * (isFinisher ? 1.12 : 1.0);
      const halfArc = w.arc * 0.5;
      const baseDmg = Math.round(cs.weaponDamage * dmgMult);

      applyMeleeArcDamage(p.x, p.y, range, aimAngle, halfArc, baseDmg, cs.critChance, w.knockback, w.style === 'hammer' ? 0.55 : 0);

      if (w.style === 'hammer' && isFinisher) {
        addScreenShake(6);
        state.shockwaves.push({
          x: p.x + Math.cos(aimAngle) * 32,
          y: p.y + Math.sin(aimAngle) * 32,
          radius: 12,
          maxRadius: 96,
          speed: 360,
          color: '#fb923c',
          friendly: true,
          damage: Math.round(cs.weaponDamage * 0.65),
          hitIds: new Set()
        });
      }

      if (w.style === 'scythe') {
        state.projectiles.push({
          x: p.x + Math.cos(aimAngle) * 24,
          y: p.y + Math.sin(aimAngle) * 24,
          vx: Math.cos(aimAngle) * 460,
          vy: Math.sin(aimAngle) * 460,
          radius: 16,
          damage: Math.round(cs.weaponDamage * 0.62),
          critChance: cs.critChance,
          knockback: 110,
          color: '#c084fc',
          friendly: true,
          pierce: 3,
          life: 0.48,
          kind: 'crescent'
        });
      }
    }
    return true;
  }

  function applyMeleeArcDamage(ox, oy, range, aimAngle, halfArc, baseDmg, critChance, knockback, stunDur = 0) {
    const targets = state.activeBoss ? [state.activeBoss, ...state.enemies] : state.enemies;
    for (let i = targets.length - 1; i >= 0; i--) {
      const e = targets[i];
      if (!e || e.hp <= 0) continue;
      const dx = e.x - ox;
      const dy = e.y - oy;
      const d = Math.hypot(dx, dy);
      if (d > range + e.radius) continue;
      if (d > 18) {
        const ang = Math.atan2(dy, dx);
        const diff = Math.abs(((ang - aimAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (diff > halfArc) continue;
      }
      damageEnemy(e, baseDmg, critChance, Math.atan2(dy, dx), knockback, stunDur);
    }

    // Добыча ресурсов и разрушаемых стен ударом
    for (const node of world.nodes) {
      if (node.respawnTimer > 0 || node.hp <= 0) continue;
      const dx = node.x - ox;
      const dy = node.y - oy;
      const d = Math.hypot(dx, dy);
      if (d > range + node.radius) continue;
      const ang = Math.atan2(dy, dx);
      const diff = Math.abs(((ang - aimAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (d > 22 && diff > halfArc + 0.25) continue;
      hitResourceNode(node, Math.max(12, Math.round(baseDmg * 0.75)));
    }
  }

  function triggerSkill(skillId) {
    const p = state.player;
    if (state.gameOver || state.paused) return false;
    const def = SKILLS[skillId];
    if (!def) return false;
    const rank = state.skillRanks[skillId] || 0;
    if (rank <= 0) {
      pushToast('Способность закрыта', `Откроется на уровне ${def.unlockLevel} или в меню «Умения»`, '#94a3b8', '🔒');
      return false;
    }
    if (state.skillCooldowns[skillId] > 0) return false;
    if (p.stamina < def.staminaCost) {
      addFloatingText(p.x, p.y - 26, 'Не хватает выносливости!', '#94a3b8', 12);
      return false;
    }

    const cs = getComputedStats();
    p.stamina -= def.staminaCost;
    state.skillCooldowns[skillId] = Math.max(1.8, def.baseCooldown * (1 - cs.cdrMult));
    const rankScale = 1 + (rank - 1) * 0.22;
    const skillDmg = Math.round(cs.weaponDamage * def.baseDamageMult * cs.skillMult * rankScale);

    if (skillId === 'whirlwind') {
      sound.play('skill_fire');
      addScreenShake(7);
      p.swingTimer = 0.34;
      p.swingDuration = 0.34;
      p.swingStyle = 'whirlwind';
      spawnParticles(p.x, p.y, 26, '#f97316', 210, 0.55, 5, 10);
      state.shockwaves.push({
        x: p.x, y: p.y, radius: 18, maxRadius: def.radius + rank * 8,
        speed: 440, color: '#f97316', friendly: true, damage: 0
      });

      const targets = state.activeBoss ? [state.activeBoss, ...state.enemies] : state.enemies;
      for (const e of targets) {
        if (!e || e.hp <= 0) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d <= def.radius + rank * 8 + e.radius) {
          damageEnemy(e, skillDmg, cs.critChance + 0.1, Math.atan2(e.y - p.y, e.x - p.x), 260, 0.25);
          e.burnTimer = 4.0;
          e.burnDps = Math.max(6, Math.round(skillDmg * 0.18));
        }
      }
      for (const node of world.nodes) {
        if (node.respawnTimer <= 0 && node.hp > 0 && Math.hypot(node.x - p.x, node.y - p.y) <= def.radius + node.radius) {
          hitResourceNode(node, skillDmg);
        }
      }
    } else if (skillId === 'thunder_slam') {
      sound.play('jump');
      const aim = findAutoAimAngle();
      const leapDist = 115;
      p.thunderLeap = {
        timer: 0,
        duration: 0.34,
        startX: p.x,
        startY: p.y,
        targetX: Math.max(80, Math.min(world.width - 80, p.x + Math.cos(aim) * leapDist)),
        targetY: Math.max(80, Math.min(world.height - 80, p.y + Math.sin(aim) * leapDist)),
        damage: skillDmg,
        radius: def.radius + rank * 10
      };
      p.invulnTimer = 0.45;
      p.z = 10;
    } else if (skillId === 'aegis_pulse') {
      sound.play('skill_shield');
      const healAmt = Math.round(cs.maxHp * (0.22 + (rank - 1) * 0.04));
      p.hp = Math.min(cs.maxHp, p.hp + healAmt);
      p.aegisTimer = def.duration + (rank - 1) * 1.0;
      addFloatingText(p.x, p.y - 28, `+${healAmt} HP`, '#4ade80', 16);
      spawnParticles(p.x, p.y, 22, '#c084fc', 165, 0.6, 4.5, 14);
    }
    return true;
  }

  function useQuickConsumable(customId = null) {
    const p = state.player;
    if (state.gameOver) return false;
    const itemId = customId || p.quickConsumable;
    const def = CONSUMABLES[itemId];
    if (!def) return false;
    const count = state.inventory.consumables[itemId] || 0;
    if (count <= 0) {
      // Попробуем найти любое другое доступное зелье/еду
      const fallback = Object.keys(CONSUMABLES).find(k => (state.inventory.consumables[k] || 0) > 0);
      if (fallback && !customId) {
        p.quickConsumable = fallback;
        return useQuickConsumable(fallback);
      }
      addFloatingText(p.x, p.y - 26, 'Зелья закончились!', '#f87171', 13);
      return false;
    }
    if (p.consumableCooldown > 0 && !customId) return false;

    state.inventory.consumables[itemId] -= 1;
    p.consumableCooldown = def.cooldown;
    const cs = getComputedStats();
    const heal = Math.round(cs.maxHp * def.healPct);
    p.hp = Math.min(cs.maxHp, p.hp + heal);
    p.satiety = Math.min(100, p.satiety + (def.satiety || 0));
    if (def.regenBuff) p.regenTimer = Math.max(p.regenTimer, def.regenBuff);
    if (def.rageBuff) p.rageTimer = Math.max(p.rageTimer, def.rageBuff);

    sound.play('potion');
    spawnParticles(p.x, p.y, 16, '#4ade80', 120, 0.5, 4, 12);
    addFloatingText(p.x, p.y - 28, `+${heal} HP`, '#4ade80', 15);
    return true;
  }

  // ── Урон по врагам и добыча ресурсов ─────────────────────────────────
  function damageEnemy(enemy, rawDamage, critChance, knockAngle, knockForce = 140, stunDur = 0) {
    if (!enemy || enemy.hp <= 0) return;
    const isCrit = Math.random() < critChance;
    const dmg = Math.max(1, Math.round(rawDamage * (isCrit ? 1.65 : 1.0) * (0.92 + Math.random() * 0.16)));
    enemy.hp -= dmg;
    enemy.hitFlash = 0.14;
    state.stats.totalDamageDealt += dmg;

    const kbMult = enemy.isBoss ? 0.12 : 1.0;
    enemy.vx = (enemy.vx || 0) + Math.cos(knockAngle) * knockForce * kbMult;
    enemy.vy = (enemy.vy || 0) + Math.sin(knockAngle) * knockForce * kbMult;
    if (stunDur > 0 && !enemy.isBoss) {
      enemy.stunTimer = Math.max(enemy.stunTimer || 0, stunDur);
    }

    // Вампиризм оружия и реликвий
    const cs = getComputedStats();
    if (cs.lifesteal > 0) {
      const vamp = Math.max(1, Math.round(dmg * cs.lifesteal));
      state.player.hp = Math.min(cs.maxHp, state.player.hp + vamp);
    }

    sound.play(isCrit ? 'crit' : 'hit');
    addFloatingText(enemy.x, enemy.y - enemy.radius - 8, isCrit ? `${dmg}!` : `${dmg}`, isCrit ? '#fbbf24' : '#f8fafc', isCrit ? 18 : 14);
    spawnParticles(enemy.x, enemy.y, isCrit ? 12 : 6, enemy.color || '#f87171', 150, 0.35, 3.8, 10);

    if (enemy.hp <= 0) {
      handleEnemyDeath(enemy);
    }
  }

  function handleEnemyDeath(enemy) {
    spawnParticles(enemy.x, enemy.y, enemy.isBoss ? 42 : 16, enemy.color || '#ef4444', enemy.isBoss ? 250 : 165, 0.65, 4.8, 12);

    if (enemy.isBoss) {
      const def = BOSSES[enemy.id];
      state.stats.bossesSlain += 1;
      state.stats.totalKills += 1;
      if (!state.defeatedBosses.includes(enemy.id)) {
        state.defeatedBosses.push(enemy.id);
      }
      addScreenShake(14);
      sound.play('levelup');
      state.activeBoss = null;
      sound.setBossMode(false);

      // Щедрая награда босса
      grantRewardItem({ type: 'gold', amount: def.gold }, false);
      if (def.rewardWeapon) grantRewardItem({ type: 'weapon', id: def.rewardWeapon }, false);
      if (def.rewardRelic) grantRewardItem({ type: 'relic', id: def.rewardRelic }, false);
      if (def.rewardArmor) grantRewardItem({ type: 'armor', id: def.rewardArmor }, false);
      if (def.rewardResource) {
        for (const [resId, cnt] of Object.entries(def.rewardResource)) {
          grantRewardItem({ type: 'resource', id: resId, count: cnt }, false);
        }
      }
      grantXp(def.xp);
      pushToast(`БОСС ПОВЕРЖЕН!`, def.name, '#fbbf24', '👑');

      if (enemy.id === 'azariel' && !state.victoryShown) {
        state.victoryShown = true;
      }
      checkQuests();
      checkAchievements();
      saveGame();
      return;
    }

    // Обычный монстр
    state.stats.totalKills += 1;
    state.questProgress.kills += 1;
    if (enemy.biome) {
      state.questProgress.biomeKills[enemy.biome] = (state.questProgress.biomeKills[enemy.biome] || 0) + 1;
    }

    // Прогресс контракта охотника
    if (enemy.biome === state.bounty.biome || state.bounty.biome === 'any') {
      state.bounty.kills += 1;
      if (state.bounty.kills >= state.bounty.target) {
        completeBounty();
      }
    }

    const [gMin, gMax] = enemy.gold || [5, 10];
    const goldAmt = gMin + Math.floor(Math.random() * (gMax - gMin + 1));
    state.lootDrops.push({
      id: Math.random().toString(36).slice(2),
      x: enemy.x + (Math.random() - 0.5) * 18,
      y: enemy.y + (Math.random() - 0.5) * 18,
      type: 'gold',
      amount: goldAmt,
      life: 45
    });

    if (enemy.drops) {
      for (const dr of enemy.drops) {
        if (Math.random() < dr.chance) {
          state.lootDrops.push({
            id: Math.random().toString(36).slice(2),
            x: enemy.x + (Math.random() - 0.5) * 24,
            y: enemy.y + (Math.random() - 0.5) * 24,
            type: dr.type,
            itemId: dr.id,
            count: 1,
            life: 60
          });
        }
      }
    }

    grantXp(enemy.xp || 20);
    const idx = state.enemies.indexOf(enemy);
    if (idx !== -1) state.enemies.splice(idx, 1);
    checkQuests();
    checkAchievements();
  }

  function completeBounty() {
    const b = state.bounty;
    state.player.gold += b.rewardGold;
    grantXp(b.rewardXp);
    pushToast(`Контракт охотника закрыт!`, `+${b.rewardGold} золота · +${b.rewardXp} опыта`, '#a78bfa', '🎯');
    const biomeOrder = ['meadow', 'ruins', 'mire', 'frost', 'rift'];
    const nextLvl = b.level + 1;
    const nextBiome = biomeOrder[Math.min(biomeOrder.length - 1, Math.floor((state.player.level - 1) / 2))];
    state.bounty = {
      level: nextLvl,
      biome: nextBiome,
      kills: 0,
      target: 8 + Math.min(12, nextLvl * 2),
      rewardGold: 110 + nextLvl * 45,
      rewardXp: 120 + nextLvl * 50
    };
  }

  function hitResourceNode(node, dmg) {
    node.hp -= dmg;
    node.hitFlash = 0.14;
    sound.play('hit');
    spawnParticles(node.x, node.y, 7, node.kind === 'tree' ? '#84cc16' : '#38bdf8', 110, 0.35, 3.5, 10);

    if (node.hp <= 0) {
      node.hp = 0;
      if (node.permanentBreak) {
        node.respawnTimer = 999999;
        if (!state.brokenPermanentNodes.includes(node.id)) {
          state.brokenPermanentNodes.push(node.id);
        }
        sound.play('slam');
        addScreenShake(8);
        pushToast('Древняя печать разрушена!', 'Проход в Забытый Склеп открыт!', '#c084fc', '🗝️');
      } else {
        node.respawnTimer = 65; // респавн ресурса через 65 сек
      }

      if (node.dropResource === 'crate') {
        state.lootDrops.push({
          id: Math.random().toString(36).slice(2),
          x: node.x, y: node.y, type: 'gold', amount: 14 + Math.floor(Math.random() * 18), life: 50
        });
        if (Math.random() < 0.45) {
          state.lootDrops.push({
            id: Math.random().toString(36).slice(2),
            x: node.x + 10, y: node.y, type: 'consumable', itemId: 'potion_hp', count: 1, life: 50
          });
        }
      } else {
        const [mn, mx] = node.dropAmount;
        const cnt = mn + Math.floor(Math.random() * (mx - mn + 1));
        state.stats.totalGathered += cnt;
        state.questProgress.gather += cnt;
        for (let k = 0; k < cnt; k++) {
          state.lootDrops.push({
            id: Math.random().toString(36).slice(2),
            x: node.x + (Math.random() - 0.5) * 24,
            y: node.y + (Math.random() - 0.5) * 24,
            type: 'resource',
            itemId: node.dropResource,
            count: 1,
            life: 60
          });
        }
      }
      checkQuests();
      checkAchievements();
    }
  }

  // ── Взаимодействие с объектами мира (костры, сундуки, жаровни, NPC, алтари боссов) ──
  function findNearbyInteractable() {
    const p = state.player;
    const range = 68;

    for (const ch of world.chests) {
      if (ch.opened) continue;
      if (Math.hypot(ch.x - p.x, ch.y - p.y) <= range) {
        if (ch.lockedUntilBraziers && state.litBraziers.length < 3) {
          return { type: 'locked_monolith', target: ch, label: '🔒 Зажгите 3 жаровни вокруг Монолита' };
        }
        return { type: 'chest', target: ch, label: ch.secretId ? '✨ Открыть тайный сундук' : '📦 Открыть сундук' };
      }
    }

    for (const br of world.braziers) {
      if (!br.lit && Math.hypot(br.x - p.x, br.y - p.y) <= range) {
        return { type: 'brazier', target: br, label: '🔥 Зажечь древнюю жаровню' };
      }
    }

    for (const camp of CAMPFIRES) {
      if (Math.hypot(camp.x - p.x, camp.y - p.y) <= range + 10) {
        const unlocked = state.unlockedCampfires.includes(camp.id);
        return {
          type: 'campfire',
          target: camp,
          label: unlocked ? `🔥 Отдохнуть у костра (${camp.name})` : `🔥 Зажечь костёр: ${camp.name}`
        };
      }
    }

    for (const npc of NPCS) {
      if (Math.hypot(npc.x - p.x, npc.y - p.y) <= range + 8) {
        return { type: 'npc', target: npc, label: `💬 Поговорить: ${npc.name}` };
      }
    }

    // Повторный призыв побеждённого босса в центре его арены
    if (!state.activeBoss) {
      for (const b of Object.values(BOSSES)) {
        if (state.defeatedBosses.includes(b.id) && Math.hypot(b.x - p.x, b.y - p.y) <= 72) {
          return { type: 'resummon_boss', target: b, label: `💀 Призвать вновь: ${b.name}` };
        }
      }
    }

    return null;
  }

  function interact() {
    const inter = findNearbyInteractable();
    if (!inter) return null;

    if (inter.type === 'chest') {
      const ch = inter.target;
      ch.opened = true;
      if (!state.openedChests.includes(ch.id)) state.openedChests.push(ch.id);
      sound.play('chest');
      spawnParticles(ch.x, ch.y, 26, '#fbbf24', 180, 0.7, 4.5, 14);

      if (ch.secretId) {
        const sec = SECRETS.find(s => s.id === ch.secretId);
        if (sec && !state.discoveredSecrets.includes(sec.id)) {
          state.discoveredSecrets.push(sec.id);
          state.player.permanentBonusHp += sec.bonusHp || 15;
          syncPlayerVitals(false);
          state.player.hp = Math.min(state.player.maxHp, state.player.hp + (sec.bonusHp || 15));
          for (const rw of sec.rewardItems) grantRewardItem(rw, false);
          pushToast(`СЕКРЕТ ОТКРЫТ: ${sec.name}!`, `Постоянный бонус +${sec.bonusHp} к макс. здоровью!`, '#fbbf24', '🗝️');
        }
      } else {
        const gold = ch.kind === 'gold' ? 75 + Math.floor(Math.random() * 55) : 32 + Math.floor(Math.random() * 30);
        grantRewardItem({ type: 'gold', amount: gold }, false);
        const resPool = ch.kind === 'gold' ? ['mithril', 'soul', 'crystal'] : ['iron', 'herb', 'wood'];
        const rId = resPool[Math.floor(Math.random() * resPool.length)];
        grantRewardItem({ type: 'resource', id: rId, count: 3 }, false);
        grantRewardItem({ type: 'consumable', id: ch.kind === 'gold' ? 'potion_greater' : 'potion_hp', count: 1 }, false);
      }
      checkAchievements();
      saveGame();
      return { action: 'chest_opened' };
    }

    if (inter.type === 'brazier') {
      const br = inter.target;
      br.lit = true;
      if (!state.litBraziers.includes(br.id)) state.litBraziers.push(br.id);
      sound.play('skill_fire');
      spawnParticles(br.x, br.y, 20, '#38bdf8', 150, 0.6, 4.5, 16);
      pushToast('Жаровня Предтеч зажжена', `Зажжено ${state.litBraziers.length} из 3`, '#38bdf8', '🔥');
      if (state.litBraziers.length >= 3) {
        sound.play('levelup');
        pushToast('Монолит пробудился!', 'Тайный сундук у подножия Монолита открыт!', '#fbbf24', '🌙');
      }
      return { action: 'brazier_lit' };
    }

    if (inter.type === 'locked_monolith') {
      pushToast('Сундук запечатан', `Зажгите все 3 древние жаровни рядом с Монолитом (${state.litBraziers.length}/3)`, '#38bdf8', '🔒');
      return { action: 'locked' };
    }

    if (inter.type === 'campfire') {
      const camp = inter.target;
      if (!state.unlockedCampfires.includes(camp.id)) {
        state.unlockedCampfires.push(camp.id);
        pushToast('Костёр открыт!', `${camp.name} доступен для быстрого перемещения`, '#fb923c', '🔥');
      }
      state.respawnCampId = camp.id;
      syncPlayerVitals(true);
      state.player.satiety = Math.max(state.player.satiety, 85);
      sound.play('potion');
      spawnParticles(camp.x, camp.y, 22, '#fb923c', 140, 0.65, 4.5, 14);
      addFloatingText(state.player.x, state.player.y - 30, 'Силы восстановлены!', '#4ade80', 15);
      checkQuests();
      checkAchievements();
      saveGame();
      return { action: 'campfire_rest', camp };
    }

    if (inter.type === 'npc') {
      const npc = inter.target;
      sound.play('ui');
      if (npc.action === 'quest_heal') {
        syncPlayerVitals(true);
      }
      return { action: 'npc_talk', npc };
    }

    if (inter.type === 'resummon_boss') {
      spawnBoss(inter.target.id);
      return { action: 'boss_spawned' };
    }

    return null;
  }

  // ── Прокачка, Ремесло, Заточка, Экипировка, Перемещение ──────────────
  function allocateStat(attr) {
    const p = state.player;
    if (p.statPoints <= 0 || !(attr in p.attributes)) return false;
    p.statPoints -= 1;
    p.attributes[attr] += 1;
    syncPlayerVitals(false);
    if (attr === 'vitality') p.hp = Math.min(p.maxHp, p.hp + 22);
    sound.play('ui');
    saveGame();
    return true;
  }

  function upgradeSkill(skillId) {
    if (!(skillId in SKILLS)) return false;
    const cur = state.skillRanks[skillId] || 0;
    if (cur >= 5) return false;
    const soulCost = cur === 0 ? 1 : cur * 2;
    if (state.player.skillPoints <= 0 && (state.inventory.resources.soul || 0) < soulCost) {
      return false;
    }
    if (state.player.skillPoints > 0) {
      state.player.skillPoints -= 1;
    } else {
      state.inventory.resources.soul -= soulCost;
    }
    state.skillRanks[skillId] = cur + 1;
    sound.play('levelup');
    saveGame();
    return true;
  }

  function upgradeWeapon(weaponId) {
    if (!state.inventory.weapons.includes(weaponId)) return false;
    const cur = state.weaponUpgrades[weaponId] || 0;
    if (cur >= 10) return false;
    const goldCost = 45 + cur * 45;
    const resKey = cur < 4 ? 'iron' : cur < 7 ? 'mithril' : 'crystal';
    const resCost = 2 + Math.floor(cur / 2);

    if (state.player.gold < goldCost || (state.inventory.resources[resKey] || 0) < resCost) {
      return false;
    }
    state.player.gold -= goldCost;
    state.inventory.resources[resKey] -= resCost;
    state.weaponUpgrades[weaponId] = cur + 1;
    state.questProgress.craft_or_upgrade += 1;
    sound.play('chest');
    checkQuests();
    checkAchievements();
    saveGame();
    return true;
  }

  function craftRecipe(recipeId) {
    const rec = RECIPES.find(r => r.id === recipeId);
    if (!rec) return false;
    if (state.player.gold < rec.costGold) return false;
    for (const [resId, need] of Object.entries(rec.ingredients)) {
      if ((state.inventory.resources[resId] || 0) < need) return false;
    }
    // Если оружие/броня/реликвия уже созданы — не тратим ресурсы впустую
    if (rec.resultType === 'weapon' && state.inventory.weapons.includes(rec.resultId)) return false;
    if (rec.resultType === 'armor' && state.inventory.armors.includes(rec.resultId)) return false;
    if (rec.resultType === 'relic' && state.inventory.relics.includes(rec.resultId)) return false;

    state.player.gold -= rec.costGold;
    for (const [resId, need] of Object.entries(rec.ingredients)) {
      state.inventory.resources[resId] -= need;
    }
    grantRewardItem({ type: rec.resultType, id: rec.resultId, count: rec.resultCount || 1 }, false);
    state.stats.totalCrafted += 1;
    state.questProgress.craft_or_upgrade += 1;
    sound.play('chest');
    checkQuests();
    checkAchievements();
    saveGame();
    return true;
  }

  function equipItem(slotType, itemId, relicSlot = 0) {
    const p = state.player;
    if (slotType === 'weapon' && state.inventory.weapons.includes(itemId)) {
      p.equippedWeapon = itemId;
    } else if (slotType === 'armor' && state.inventory.armors.includes(itemId)) {
      p.equippedArmor = itemId;
    } else if (slotType === 'relic' && state.inventory.relics.includes(itemId)) {
      const otherSlot = relicSlot === 0 ? 1 : 0;
      if (p.equippedRelics[otherSlot] === itemId) p.equippedRelics[otherSlot] = null;
      p.equippedRelics[relicSlot] = itemId;
    } else if (slotType === 'consumable' && CONSUMABLES[itemId]) {
      p.quickConsumable = itemId;
    } else {
      return false;
    }
    syncPlayerVitals(false);
    sound.play('ui');
    saveGame();
    return true;
  }

  function fastTravel(campId) {
    if (!state.unlockedCampfires.includes(campId)) return false;
    const camp = CAMPFIRES.find(c => c.id === campId);
    if (!camp) return false;
    state.player.x = camp.x;
    state.player.y = camp.y + 42;
    state.player.z = 0;
    state.player.vz = 0;
    state.activeBoss = null;
    sound.setBossMode(false);
    revealFogAround(camp.x, camp.y, 4);
    sound.play('skill_shield');
    spawnParticles(state.player.x, state.player.y, 24, '#38bdf8', 160, 0.6, 4.5, 14);
    pushToast('Быстрое перемещение', camp.name, '#38bdf8', '🧭');
    return true;
  }

  // ── Спавн врагов и боссов + ИИ ───────────────────────────────────────
  function spawnBoss(bossId) {
    const def = BOSSES[bossId];
    if (!def) return;
    state.activeBoss = {
      ...def,
      isBoss: true,
      maxHp: def.hp,
      hp: def.hp,
      x: def.x,
      y: def.y,
      z: 0,
      vz: 0,
      vx: 0,
      vy: 0,
      phase: 1,
      actionTimer: 1.6,
      patternStep: 0,
      dashTimer: 0,
      dashVx: 0,
      dashVy: 0,
      hitFlash: 0,
      burnTimer: 0,
      burnDps: 0
    };
    sound.setBossMode(true);
    sound.play('boss_roar');
    addScreenShake(10);
    pushToast(`БОСС: ${def.name}`, def.title, '#f87171', '💀');
  }

  function updateSpawning() {
    const p = state.player;
    // Проверка входа на арену живого босса
    if (!state.activeBoss) {
      for (const b of Object.values(BOSSES)) {
        if (state.defeatedBosses.includes(b.id)) continue;
        if (Math.hypot(p.x - b.x, p.y - b.y) < b.arenaRadius + 95) {
          spawnBoss(b.id);
          break;
        }
      }
    } else {
      // Если игрок убежал очень далеко от арены — босс возвращается на пост
      const b = state.activeBoss;
      if (Math.hypot(p.x - b.x, p.y - b.y) > 950) {
        state.activeBoss = null;
        sound.setBossMode(false);
      }
    }

    // Удаляем слишком далёких обычных врагов
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      if (dist2(e.x, e.y, p.x, p.y) > 1180 * 1180) {
        state.enemies.splice(i, 1);
      }
    }

    const maxEnemies = state.settings.quality === 'low' ? 14 : state.settings.quality === 'high' ? 24 : 18;
    if (state.enemies.length >= maxEnemies) return;

    const ang = Math.random() * Math.PI * 2;
    const dist = 480 + Math.random() * 340;
    const sx = p.x + Math.cos(ang) * dist;
    const sy = p.y + Math.sin(ang) * dist;
    if (sx < 120 || sx > world.width - 120 || sy < 120 || sy > world.height - 120) return;

    // Не спавнить в мирном Лагере Рубежа и у костров
    if (dist2(sx, sy, 2400, 2380) < 420 * 420) return;
    for (const c of CAMPFIRES) {
      if (dist2(sx, sy, c.x, c.y) < 190 * 190) return;
    }

    const biomeId = getBiomeIdAt(sx, sy);
    const pool = BIOMES[biomeId].enemies;
    const enemyKey = pool[Math.floor(Math.random() * pool.length)];
    const def = ENEMIES[enemyKey];
    if (!def) return;

    const nightBuff = isNightTime() ? 1.18 : 1.0;
    state.enemies.push({
      uid: Math.random().toString(36).slice(2),
      ...def,
      maxHp: Math.round(def.hp * nightBuff),
      hp: Math.round(def.hp * nightBuff),
      damage: Math.round(def.damage * nightBuff),
      x: sx,
      y: sy,
      z: 0,
      vz: 0,
      vx: 0,
      vy: 0,
      attackTimer: 0.7 + Math.random() * 0.9,
      specialTimer: 2.2 + Math.random() * 1.8,
      stunTimer: 0,
      hitFlash: 0,
      burnTimer: 0,
      burnDps: 0
    });
  }

  // ── Главный цикл обновления физики и логики (dt в секундах) ──────────
  let spawnAccum = 0;
  let fogAccum = 0;
  let autosaveAccum = 0;

  function update(dt, inputState = { moveX: 0, moveY: 0, attackHeld: false }) {
    if (state.paused || state.gameOver) return;
    const clampedDt = Math.min(0.05, Math.max(0.001, dt));
    const p = state.player;
    const cs = getComputedStats();

    state.playTime += clampedDt;
    // Полный цикл суток ~ 4.5 минуты
    state.dayTime = (state.dayTime + clampedDt / 270) % 1;
    state.currentBiome = getBiomeIdAt(p.x, p.y);

    // Таймеры кулдаунов игрока
    if (p.attackCooldown > 0) p.attackCooldown = Math.max(0, p.attackCooldown - clampedDt);
    if (p.swingTimer > 0) p.swingTimer = Math.max(0, p.swingTimer - clampedDt);
    if (p.invulnTimer > 0) p.invulnTimer = Math.max(0, p.invulnTimer - clampedDt);
    if (p.hitFlash > 0) p.hitFlash = Math.max(0, p.hitFlash - clampedDt);
    if (p.consumableCooldown > 0) p.consumableCooldown = Math.max(0, p.consumableCooldown - clampedDt);
    if (p.phoenixCooldown > 0) p.phoenixCooldown = Math.max(0, p.phoenixCooldown - clampedDt);
    if (p.regenTimer > 0) p.regenTimer = Math.max(0, p.regenTimer - clampedDt);
    if (p.rageTimer > 0) p.rageTimer = Math.max(0, p.rageTimer - clampedDt);
    if (p.aegisTimer > 0) p.aegisTimer = Math.max(0, p.aegisTimer - clampedDt);
    if (p.comboResetTimer > 0) {
      p.comboResetTimer -= clampedDt;
      if (p.comboResetTimer <= 0) p.comboStep = 0;
    }

    for (const sk of Object.keys(state.skillCooldowns)) {
      if (state.skillCooldowns[sk] > 0) {
        state.skillCooldowns[sk] = Math.max(0, state.skillCooldowns[sk] - clampedDt);
      }
    }

    // Регенерация выносливости, сытости и здоровья
    p.stamina = Math.min(cs.maxStamina, p.stamina + cs.staminaRegen * clampedDt);
    p.satiety = Math.max(0, p.satiety - clampedDt * 0.22);
    // У костра в Лагере Рубежа здоровье плавно восстанавливается
    const nearHaven = dist2(p.x, p.y, 2400, 2350) < 260 * 260;
    const totalRegen = cs.hpRegen + (nearHaven ? 8 : 0);
    if (totalRegen > 0 && p.hp < cs.maxHp) {
      p.hp = Math.min(cs.maxHp, p.hp + totalRegen * clampedDt);
    }

    // ── Передвижение и Громовой Прыжок ─────────────────────────────────
    if (p.thunderLeap) {
      const tl = p.thunderLeap;
      tl.timer += clampedDt;
      const t = Math.min(1, tl.timer / tl.duration);
      p.x = tl.startX + (tl.targetX - tl.startX) * t;
      p.y = tl.startY + (tl.targetY - tl.startY) * t;
      p.z = Math.sin(t * Math.PI) * 92;
      if (t >= 1) {
        p.z = 0;
        p.vz = 0;
        p.thunderLeap = null;
        sound.play('slam');
        addScreenShake(11);
        spawnParticles(p.x, p.y, 32, '#38bdf8', 240, 0.65, 5, 10);
        state.shockwaves.push({
          x: p.x, y: p.y, radius: 16, maxRadius: tl.radius,
          speed: 480, color: '#38bdf8', friendly: true, damage: 0
        });
        const targets = state.activeBoss ? [state.activeBoss, ...state.enemies] : state.enemies;
        for (const e of targets) {
          if (!e || e.hp <= 0) continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) <= tl.radius + e.radius) {
            damageEnemy(e, tl.damage, cs.critChance + 0.15, Math.atan2(e.y - p.y, e.x - p.x), 300, 1.8);
          }
        }
        for (const node of world.nodes) {
          if (node.respawnTimer <= 0 && node.hp > 0 && Math.hypot(node.x - p.x, node.y - p.y) <= tl.radius + node.radius) {
            hitResourceNode(node, tl.damage);
          }
        }
      }
    } else {
      let mx = inputState.moveX || 0;
      let my = inputState.moveY || 0;
      const mLen = Math.hypot(mx, my);
      if (mLen > 1) {
        mx /= mLen;
        my /= mLen;
      }
      if (mLen > 0.08) {
        p.facingX = mx / (mLen || 1);
        p.facingY = my / (mLen || 1);
        if (p.swingTimer <= 0) {
          p.facingAngle = Math.atan2(p.facingY, p.facingX);
        }
        p.walkCycle += clampedDt * 11 * Math.min(1, mLen);
      }

      const targetVx = mx * cs.moveSpeed;
      const targetVy = my * cs.moveSpeed;
      const accel = 14;
      p.vx += (targetVx - p.vx) * Math.min(1, accel * clampedDt);
      p.vy += (targetVy - p.vy) * Math.min(1, accel * clampedDt);

      p.x += p.vx * clampedDt;
      p.y += p.vy * clampedDt;

      // Физика вертикального прыжка по оси Z
      if (p.z > 0 || p.vz !== 0) {
        p.z += p.vz * clampedDt;
        p.vz -= 940 * clampedDt;
        if (p.z <= 0) {
          p.z = 0;
          p.vz = 0;
        }
      }

      resolveEntityWorldCollisions(p, true);
    }

    // Удержание кнопки атаки для непрерывного боя на сенсоре
    if (inputState.attackHeld && p.attackCooldown <= 0) {
      triggerAttack();
    }

    // Вращающиеся эфирные клинки (способность 3)
    if (p.aegisTimer > 0) {
      updateOrbitingBlades(clampedDt, cs);
    }

    // ── Обновление ресурсов мира ───────────────────────────────────────
    for (const node of world.nodes) {
      if (node.hitFlash > 0) node.hitFlash = Math.max(0, node.hitFlash - clampedDt);
      if (node.respawnTimer > 0 && !node.permanentBreak) {
        node.respawnTimer -= clampedDt;
        if (node.respawnTimer <= 0) {
          node.respawnTimer = 0;
          node.hp = node.maxHp;
        }
      }
    }

    // ── Опасности мира (шипы, кислота, лава, водная преграда острова) ──
    updateHazards(clampedDt);

    // ── Снаряды, ударные волны, телеграфы ──────────────────────────────
    updateProjectiles(clampedDt);
    updateShockwaves(clampedDt);
    updateTelegraphs(clampedDt);

    // ── Враги и Босс ───────────────────────────────────────────────────
    updateEnemies(clampedDt);
    if (state.activeBoss) updateBoss(clampedDt);

    // ── Сбор трофеев с магнитом ────────────────────────────────────────
    updateLoot(clampedDt, cs);

    // ── Всплывающие тексты, частицы, уведомления ───────────────────────
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y += ft.vy * clampedDt;
      ft.vy *= 0.92;
      ft.life -= clampedDt;
      if (ft.life <= 0) floatingTexts.splice(i, 1);
    }
    for (let i = 0; i < particles.length; i++) {
      const pt = particles[i];
      if (!pt.active) continue;
      pt.x += pt.vx * clampedDt;
      pt.y += pt.vy * clampedDt;
      pt.z = Math.max(0, pt.z + pt.vz * clampedDt);
      pt.vz -= 260 * clampedDt;
      pt.life -= clampedDt;
      if (pt.life <= 0) pt.active = false;
    }
    for (let i = toasts.length - 1; i >= 0; i--) {
      toasts[i].timer -= clampedDt;
      if (toasts[i].timer <= 0) toasts.splice(i, 1);
    }

    // Камера плавно следует за героем
    state.camera.x += (p.x - state.camera.x) * Math.min(1, 10 * clampedDt);
    state.camera.y += (p.y - state.camera.y) * Math.min(1, 10 * clampedDt);
    if (state.camera.shake > 0) {
      state.camera.shake = Math.max(0, state.camera.shake - clampedDt * 28);
    }

    state.nearbyInteractable = findNearbyInteractable();

    spawnAccum += clampedDt;
    if (spawnAccum >= 0.9) {
      spawnAccum = 0;
      updateSpawning();
    }

    fogAccum += clampedDt;
    if (fogAccum >= 0.4) {
      fogAccum = 0;
      revealFogAround(p.x, p.y, 3);
    }

    autosaveAccum += clampedDt;
    if (autosaveAccum >= 15) {
      autosaveAccum = 0;
      saveGame();
    }
  }

  let aegisHitTick = 0;
  function updateOrbitingBlades(dt, cs) {
    aegisHitTick -= dt;
    if (aegisHitTick > 0) return;
    aegisHitTick = 0.28;
    const p = state.player;
    const rank = state.skillRanks.aegis_pulse || 1;
    const bladeDmg = Math.max(6, Math.round(cs.weaponDamage * (0.48 + rank * 0.08) * cs.skillMult));
    const orbitR = 72;
    for (let b = 0; b < 3; b++) {
      const ang = state.playTime * 4.5 + (b * Math.PI * 2) / 3;
      const bx = p.x + Math.cos(ang) * orbitR;
      const by = p.y + Math.sin(ang) * orbitR;
      const targets = state.activeBoss ? [state.activeBoss, ...state.enemies] : state.enemies;
      for (const e of targets) {
        if (!e || e.hp <= 0) continue;
        if (Math.hypot(e.x - bx, e.y - by) <= e.radius + 22) {
          damageEnemy(e, bladeDmg, cs.critChance, ang, 70, 0);
        }
      }
    }
  }

  function resolveEntityWorldCollisions(ent, isPlayer = false) {
    ent.x = Math.max(48, Math.min(world.width - 48, ent.x));
    ent.y = Math.max(48, Math.min(world.height - 48, ent.y));

    const nearObs = world.queryObstaclesNear(ent.x, ent.y);
    for (let i = 0; i < nearObs.length; i++) {
      const o = nearObs[i];
      const dx = ent.x - o.x;
      const dy = ent.y - o.y;
      const minD = ent.radius + o.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 < minD * minD && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = minD - d;
        ent.x += (dx / d) * push;
        ent.y += (dy / d) * push;
      }
    }

    // Столкновение с неразрушенными жилами/деревьями/рунной стеной
    for (let i = 0; i < world.nodes.length; i++) {
      const n = world.nodes[i];
      if (n.respawnTimer > 0 || n.hp <= 0 || n.kind === 'herb') continue;
      const dx = ent.x - n.x;
      const dy = ent.y - n.y;
      const minD = ent.radius + n.radius * 0.85;
      const d2 = dx * dx + dy * dy;
      if (d2 < minD * minD && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = minD - d;
        ent.x += (dx / d) * push;
        ent.y += (dy / d) * push;
      }
    }

    if (!isPlayer) {
      // Враги не заходят внутрь мирного святилища Лагеря Рубежа
      const dx = ent.x - 2400;
      const dy = ent.y - 2380;
      const d = Math.hypot(dx, dy);
      if (d < 340 && d > 0.01) {
        ent.x = 2400 + (dx / d) * 340;
        ent.y = 2380 + (dy / d) * 340;
      }
    }
  }

  function updateHazards(dt) {
    const p = state.player;
    for (const h of world.hazards) {
      if (h.kind === 'water_moat') {
        const dx = p.x - h.x;
        const dy = p.y - h.y;
        const d = Math.hypot(dx, dy);
        if (d > h.innerRadius && d < h.outerRadius && p.z <= 6) {
          // Проверяем, стоит ли игрок на каменной плите-островке
          let onStone = false;
          for (const st of world.steppingStones) {
            if (Math.hypot(p.x - st.x, p.y - st.y) <= st.radius + 8) {
              onStone = true;
              break;
            }
          }
          if (!onStone) {
            // Мягко выталкиваем на ближайший берег или плиту с брызгами (без застревания!)
            const targetR = d < (h.innerRadius + h.outerRadius) * 0.5 ? h.innerRadius - 8 : h.outerRadius + 8;
            const ang = Math.atan2(dy, dx);
            p.x = h.x + Math.cos(ang) * targetR;
            p.y = h.y + Math.sin(ang) * targetR;
            spawnParticles(p.x, p.y, 10, '#38bdf8', 110, 0.4, 4, 8);
            addFloatingText(p.x, p.y - 24, 'Прыгай по плитам!', '#38bdf8', 13);
          }
        }
        continue;
      }

      if (p.z > 10) continue; // В прыжке игрок перелетает ловушки!
      const d = Math.hypot(p.x - h.x, p.y - h.y);
      if (d > h.radius + p.radius * 0.5) continue;

      if (h.kind === 'spikes') {
        const cycle = (state.playTime + (h.phase || 0)) % 3.2;
        if (cycle > 1.9 && cycle < 2.9) {
          damagePlayer(16, h.x, h.y);
        }
      } else if (h.kind === 'acid') {
        damagePlayer(14, h.x, h.y);
      } else if (h.kind === 'lava') {
        damagePlayer(24, h.x, h.y);
      }
    }
    void dt;
  }

  function damagePlayer(rawAmount, srcX = null, srcY = null) {
    const p = state.player;
    if (p.invulnTimer > 0 || state.gameOver) return;
    const cs = getComputedStats();
    let dmg = Math.max(2, Math.round(rawAmount - cs.defense * 0.55));
    if (p.aegisTimer > 0) dmg = Math.max(1, Math.round(dmg * 0.60));

    p.hp -= dmg;
    p.invulnTimer = 0.52;
    p.hitFlash = 0.22;
    sound.play('hurt');
    addScreenShake(6);
    addFloatingText(p.x, p.y - 26, `-${dmg}`, '#fb7185', 16);
    spawnParticles(p.x, p.y, 10, '#fb7185', 140, 0.4, 4, 10);

    if (srcX !== null && srcY !== null) {
      const ang = Math.atan2(p.y - srcY, p.x - srcX);
      p.vx += Math.cos(ang) * 165;
      p.vy += Math.sin(ang) * 165;
    }

    if (p.hp <= 0) {
      if (cs.hasPhoenix && p.phoenixCooldown <= 0) {
        p.phoenixCooldown = 90;
        p.hp = Math.round(cs.maxHp * 0.55);
        p.invulnTimer = 2.0;
        sound.play('levelup');
        spawnParticles(p.x, p.y, 34, '#fb923c', 220, 0.8, 5, 14);
        pushToast('Перо Феникса!', 'Вы воскрешены пламенем феникса!', '#fb923c', '🔥');
        return;
      }
      p.hp = 0;
      state.gameOver = true;
      state.stats.deaths += 1;
      sound.setBossMode(false);
      saveGame();
    }
  }

  function respawnPlayer() {
    const camp = CAMPFIRES.find(c => c.id === state.respawnCampId) || CAMPFIRES[0];
    state.gameOver = false;
    state.activeBoss = null;
    state.projectiles.length = 0;
    state.shockwaves.length = 0;
    state.telegraphs.length = 0;
    state.player.x = camp.x;
    state.player.y = camp.y + 42;
    state.player.z = 0;
    state.player.vz = 0;
    state.player.satiety = Math.max(70, state.player.satiety);
    syncPlayerVitals(true);
    state.player.invulnTimer = 1.5;
    sound.setBossMode(false);
    sound.play('skill_shield');
    saveGame();
  }

  // ── ИИ обычных врагов ────────────────────────────────────────────────
  function updateEnemies(dt) {
    const p = state.player;
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      if (!e || e.hp <= 0) continue;

      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);
      if (e.burnTimer > 0) {
        e.burnTimer -= dt;
        e.hp -= e.burnDps * dt;
        if (Math.random() < 0.25) spawnParticles(e.x, e.y, 1, '#f97316', 50, 0.25, 3, 10);
        if (e.hp <= 0) {
          handleEnemyDeath(e);
          continue;
        }
      }

      if (e.stunTimer > 0) {
        e.stunTimer -= dt;
        e.vx *= 0.85;
        e.vy *= 0.85;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        continue;
      }

      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const ang = Math.atan2(dy, dx);

      e.attackTimer -= dt;
      e.specialTimer -= dt;

      if (e.z > 0 || e.vz !== 0) {
        e.z += e.vz * dt;
        e.vz -= 780 * dt;
        if (e.z <= 0) {
          e.z = 0;
          e.vz = 0;
          if (e.behavior === 'jumper' && d < 95 && p.z < 12) {
            damagePlayer(e.damage, e.x, e.y);
          }
          spawnParticles(e.x, e.y, 8, e.color, 110, 0.35, 3.5, 4);
        }
      }

      if (e.behavior === 'ranged' || e.behavior === 'ranged_acid' || e.behavior === 'ranged_spread') {
        const pref = e.attackRange || 280;
        let moveFactor = 0;
        if (d > pref) moveFactor = 1;
        else if (d < pref * 0.55) moveFactor = -0.7;

        e.vx += (Math.cos(ang) * e.speed * moveFactor - e.vx) * Math.min(1, 6 * dt);
        e.vy += (Math.sin(ang) * e.speed * moveFactor - e.vy) * Math.min(1, 6 * dt);

        if (e.attackTimer <= 0 && d < pref + 75) {
          e.attackTimer = 1.9 + Math.random() * 0.6;
          const angles = e.behavior === 'ranged_spread' ? [ang - 0.22, ang, ang + 0.22] : [ang];
          for (const a of angles) {
            state.projectiles.push({
              x: e.x + Math.cos(a) * 16,
              y: e.y + Math.sin(a) * 16,
              vx: Math.cos(a) * (e.projSpeed || 340),
              vy: Math.sin(a) * (e.projSpeed || 340),
              radius: 7,
              damage: e.damage,
              color: e.projColor || '#fb7185',
              friendly: false,
              life: 1.6
            });
          }
        }
      } else if (e.behavior === 'jumper') {
        if (e.specialTimer <= 0 && d < 280 && e.z === 0) {
          e.specialTimer = 2.6;
          e.vz = 290;
          e.z = 2;
          e.vx = Math.cos(ang) * (e.speed * 1.95);
          e.vy = Math.sin(ang) * (e.speed * 1.95);
        } else if (e.z === 0) {
          e.vx += (Math.cos(ang) * e.speed - e.vx) * Math.min(1, 6 * dt);
          e.vy += (Math.sin(ang) * e.speed - e.vy) * Math.min(1, 6 * dt);
        }
      } else if (e.behavior === 'blinker') {
        if (e.specialTimer <= 0 && d < 320 && d > 85) {
          e.specialTimer = 3.4;
          spawnParticles(e.x, e.y, 10, '#a855f7', 110, 0.3, 3.5, 10);
          e.x = p.x - Math.cos(ang) * 58;
          e.y = p.y - Math.sin(ang) * 58;
          spawnParticles(e.x, e.y, 10, '#34d399', 110, 0.3, 3.5, 10);
        }
        e.vx += (Math.cos(ang) * e.speed - e.vx) * Math.min(1, 8 * dt);
        e.vy += (Math.sin(ang) * e.speed - e.vy) * Math.min(1, 8 * dt);
      } else if (e.behavior === 'dasher') {
        if (e.specialTimer <= 0 && d < 230) {
          e.specialTimer = 2.8;
          e.vx = Math.cos(ang) * e.speed * 2.25;
          e.vy = Math.sin(ang) * e.speed * 2.25;
        } else {
          e.vx += (Math.cos(ang) * e.speed - e.vx) * Math.min(1, 5.5 * dt);
          e.vy += (Math.sin(ang) * e.speed - e.vy) * Math.min(1, 5.5 * dt);
        }
      } else if (e.behavior === 'heavy_slam') {
        if (e.specialTimer <= 0 && d < 120) {
          e.specialTimer = 3.5;
          state.telegraphs.push({
            x: e.x, y: e.y, radius: 92, timer: 0.75, maxTimer: 0.75,
            damage: Math.round(e.damage * 1.25), color: '#38bdf8'
          });
        }
        e.vx += (Math.cos(ang) * e.speed - e.vx) * Math.min(1, 5 * dt);
        e.vy += (Math.sin(ang) * e.speed - e.vy) * Math.min(1, 5 * dt);
      } else {
        e.vx += (Math.cos(ang) * e.speed - e.vx) * Math.min(1, 7 * dt);
        e.vy += (Math.sin(ang) * e.speed - e.vy) * Math.min(1, 7 * dt);
      }

      e.x += e.vx * dt;
      e.y += e.vy * dt;
      resolveEntityWorldCollisions(e, false);

      // Контактный урон вблизи (если игрок не высоко в прыжке)
      if (d < e.radius + p.radius + 4 && p.z < 16 && e.attackTimer <= 0) {
        e.attackTimer = 0.85;
        damagePlayer(e.damage, e.x, e.y);
      }
    }
  }

  // ── Уникальные паттерны 4 Боссов ─────────────────────────────────────
  function updateBoss(dt) {
    const b = state.activeBoss;
    if (!b || b.hp <= 0) return;
    const p = state.player;

    if (b.hitFlash > 0) b.hitFlash = Math.max(0, b.hitFlash - dt);
    if (b.burnTimer > 0) {
      b.burnTimer -= dt;
      b.hp -= b.burnDps * dt;
      if (b.hp <= 0) {
        handleEnemyDeath(b);
        return;
      }
    }

    const enraged = b.hp < b.maxHp * 0.5;
    b.phase = enraged ? 2 : 1;

    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    const ang = Math.atan2(dy, dx);

    if (b.z > 0 || b.vz !== 0) {
      b.z += b.vz * dt;
      b.vz -= 820 * dt;
      if (b.z <= 0) {
        b.z = 0;
        b.vz = 0;
        sound.play('slam');
        addScreenShake(9);
        state.shockwaves.push({
          x: b.x, y: b.y, radius: 22, maxRadius: 250, speed: 290,
          color: b.color, friendly: false, damage: b.damage, jumpable: true
        });
      }
    }

    if (b.dashTimer > 0) {
      b.dashTimer -= dt;
      b.x += b.dashVx * dt;
      b.y += b.dashVy * dt;
      if (Math.random() < 0.5) spawnParticles(b.x, b.y, 2, b.accent, 60, 0.3, 4, 8);
    } else if (b.z === 0) {
      const spd = b.speed * (enraged ? 1.18 : 1.0);
      b.vx += (Math.cos(ang) * spd - b.vx) * Math.min(1, 5 * dt);
      b.vy += (Math.sin(ang) * spd - b.vy) * Math.min(1, 5 * dt);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }

    resolveEntityWorldCollisions(b, false);

    if (d < b.radius + p.radius + 4 && p.z < 18) {
      damagePlayer(b.damage, b.x, b.y);
    }

    b.actionTimer -= dt * (enraged ? 1.25 : 1.0);
    if (b.actionTimer > 0) return;

    b.patternStep = (b.patternStep + 1) % 3;
    b.actionTimer = 2.4;

    if (b.id === 'morgrath') {
      if (b.patternStep === 0) {
        // Огненный рывок
        b.dashTimer = 0.42;
        b.dashVx = Math.cos(ang) * 440;
        b.dashVy = Math.sin(ang) * 440;
        sound.play('skill_fire');
      } else if (b.patternStep === 1) {
        // Взрывное кольцо по земле (перепрыгивается!)
        sound.play('slam');
        state.shockwaves.push({
          x: b.x, y: b.y, radius: 24, maxRadius: 290, speed: 270,
          color: '#fb923c', friendly: false, damage: b.damage, jumpable: true
        });
      } else {
        // Огненные столбы под игроком с предупреждением
        const pillars = enraged ? 4 : 2;
        for (let k = 0; k < pillars; k++) {
          const ox = k === 0 ? 0 : (Math.random() - 0.5) * 210;
          const oy = k === 0 ? 0 : (Math.random() - 0.5) * 210;
          state.telegraphs.push({
            x: p.x + ox, y: p.y + oy, radius: 66, timer: 0.95, maxTimer: 0.95,
            damage: Math.round(b.damage * 1.15), color: '#ef4444'
          });
        }
      }
    } else if (b.id === 'xylla') {
      if (b.patternStep === 0) {
        // Веер кислотных плевков
        const count = enraged ? 7 : 5;
        for (let k = 0; k < count; k++) {
          const a = ang + (k - (count - 1) / 2) * 0.22;
          state.projectiles.push({
            x: b.x, y: b.y, vx: Math.cos(a) * 350, vy: Math.sin(a) * 350,
            radius: 9, damage: b.damage, color: '#a3e635', friendly: false, life: 1.7
          });
        }
      } else if (b.patternStep === 1) {
        // Прыжок хищницы с ядовитым кольцом при приземлении
        b.vz = 350;
        b.z = 4;
        b.vx = Math.cos(ang) * 320;
        b.vy = Math.sin(ang) * 320;
      } else {
        // Призыв 2 миньонов роя (если их мало рядом)
        if (state.enemies.length < 16) {
          for (let s = 0; s < 2; s++) {
            const sa = ang + (s === 0 ? -0.9 : 0.9);
            const slimeDef = ENEMIES.slime;
            state.enemies.push({
              uid: Math.random().toString(36).slice(2),
              ...slimeDef,
              name: 'Личинка Роя',
              hp: 95, maxHp: 95, damage: 22, speed: 150,
              color: '#84cc16',
              x: b.x + Math.cos(sa) * 65,
              y: b.y + Math.sin(sa) * 65,
              z: 0, vz: 0, vx: 0, vy: 0,
              attackTimer: 0.6, specialTimer: 2, stunTimer: 0, hitFlash: 0
            });
          }
        }
      }
    } else if (b.id === 'valkor') {
      if (b.patternStep === 0) {
        // Круговая ледяная нова из 10 осколков
        const count = enraged ? 12 : 8;
        for (let k = 0; k < count; k++) {
          const a = (k / count) * Math.PI * 2 + state.playTime;
          state.projectiles.push({
            x: b.x, y: b.y, vx: Math.cos(a) * 330, vy: Math.sin(a) * 330,
            radius: 9, damage: b.damage, color: '#38bdf8', friendly: false, life: 1.8
          });
        }
      } else if (b.patternStep === 1) {
        // Ледяной буран (зоны обрушения сосулек)
        const count = enraged ? 5 : 3;
        for (let k = 0; k < count; k++) {
          state.telegraphs.push({
            x: p.x + (Math.random() - 0.5) * 230,
            y: p.y + (Math.random() - 0.5) * 230,
            radius: 74, timer: 1.0, maxTimer: 1.0,
            damage: Math.round(b.damage * 1.2), color: '#38bdf8'
          });
        }
      } else {
        b.dashTimer = 0.38;
        b.dashVx = Math.cos(ang) * 460;
        b.dashVy = Math.sin(ang) * 460;
      }
    } else if (b.id === 'azariel') {
      if (b.patternStep === 0) {
        // Телепорт Бездны + спираль сфер Разлома
        spawnParticles(b.x, b.y, 18, '#c084fc', 160, 0.4, 4, 12);
        b.x = Math.max(200, Math.min(world.width - 200, p.x - Math.cos(ang) * 185));
        b.y = Math.max(200, Math.min(world.height - 200, p.y - Math.sin(ang) * 185));
        const count = enraged ? 12 : 9;
        for (let k = 0; k < count; k++) {
          const a = (k / count) * Math.PI * 2;
          state.projectiles.push({
            x: b.x, y: b.y, vx: Math.cos(a) * 370, vy: Math.sin(a) * 370,
            radius: 10, damage: b.damage, color: '#e879f9', friendly: false, life: 1.9
          });
        }
      } else if (b.patternStep === 1) {
        // Метеоритный шторм Горизонта
        const count = enraged ? 6 : 4;
        for (let k = 0; k < count; k++) {
          state.telegraphs.push({
            x: p.x + (Math.random() - 0.5) * 260,
            y: p.y + (Math.random() - 0.5) * 260,
            radius: 78, timer: 0.92, maxTimer: 0.92,
            damage: Math.round(b.damage * 1.25), color: '#fb7185'
          });
        }
      } else {
        // Волна Бездны (перепрыгивается!)
        sound.play('slam');
        state.shockwaves.push({
          x: b.x, y: b.y, radius: 24, maxRadius: 340, speed: 300,
          color: '#c084fc', friendly: false, damage: b.damage, jumpable: true
        });
      }
    }
  }

  // ── Снаряды, Волны и Зоны Телеграфов ─────────────────────────────────
  function updateProjectiles(dt) {
    const p = state.player;
    const cs = getComputedStats();

    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const pr = state.projectiles[i];
      pr.life -= dt;
      if (pr.life <= 0) {
        state.projectiles.splice(i, 1);
        continue;
      }

      // Мягкое самонаведение для посоха Звёздного Пламени
      if (pr.friendly && pr.homing) {
        const targets = state.activeBoss ? [state.activeBoss, ...state.enemies] : state.enemies;
        let nearest = null;
        let bestD = 260;
        for (const e of targets) {
          if (!e || e.hp <= 0) continue;
          const d = Math.hypot(e.x - pr.x, e.y - pr.y);
          if (d < bestD) { bestD = d; nearest = e; }
        }
        if (nearest) {
          const desired = Math.atan2(nearest.y - pr.y, nearest.x - pr.x);
          const spd = Math.hypot(pr.vx, pr.vy);
          const cur = Math.atan2(pr.vy, pr.vx);
          let diff = ((desired - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          const nextAng = cur + Math.max(-5 * dt, Math.min(5 * dt, diff));
          pr.vx = Math.cos(nextAng) * spd;
          pr.vy = Math.sin(nextAng) * spd;
        }
      }

      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;

      if (pr.friendly) {
        let consumed = false;
        const targets = state.activeBoss ? [state.activeBoss, ...state.enemies] : state.enemies;
        for (const e of targets) {
          if (!e || e.hp <= 0) continue;
          if (pr.hitSet && pr.hitSet.has(e)) continue;
          if (Math.hypot(e.x - pr.x, e.y - pr.y) <= e.radius + pr.radius) {
            if (!pr.hitSet) pr.hitSet = new Set();
            pr.hitSet.add(e);

            if (pr.splashRadius) {
              spawnParticles(pr.x, pr.y, 16, pr.color, 175, 0.45, 4.2, 10);
              for (const sub of targets) {
                if (sub && sub.hp > 0 && Math.hypot(sub.x - pr.x, sub.y - pr.y) <= pr.splashRadius + sub.radius) {
                  damageEnemy(sub, pr.damage, cs.critChance, Math.atan2(sub.y - pr.y, sub.x - pr.x), pr.knockback || 120);
                }
              }
            } else {
              damageEnemy(e, pr.damage, cs.critChance, Math.atan2(pr.vy, pr.vx), pr.knockback || 110);
            }

            if ((pr.pierce || 0) > 0) {
              pr.pierce -= 1;
            } else {
              consumed = true;
              break;
            }
          }
        }
        // Попадание по ресурсным узлам/ящикам
        if (!consumed) {
          for (const node of world.nodes) {
            if (node.respawnTimer <= 0 && node.hp > 0 && Math.hypot(node.x - pr.x, node.y - pr.y) <= node.radius + pr.radius) {
              hitResourceNode(node, pr.damage);
              consumed = true;
              break;
            }
          }
        }
        if (consumed) state.projectiles.splice(i, 1);
      } else {
        // Вражеский снаряд (можно перепрыгнуть при высоком прыжке!)
        if (p.z < 18 && Math.hypot(p.x - pr.x, p.y - pr.y) <= p.radius + pr.radius) {
          damagePlayer(pr.damage, pr.x, pr.y);
          state.projectiles.splice(i, 1);
        }
      }
    }
  }

  function updateShockwaves(dt) {
    const p = state.player;
    for (let i = state.shockwaves.length - 1; i >= 0; i--) {
      const sw = state.shockwaves[i];
      sw.radius += sw.speed * dt;
      if (sw.friendly && sw.damage > 0) {
        const targets = state.activeBoss ? [state.activeBoss, ...state.enemies] : state.enemies;
        for (const e of targets) {
          if (!e || e.hp <= 0 || (sw.hitIds && sw.hitIds.has(e))) continue;
          const d = Math.hypot(e.x - sw.x, e.y - sw.y);
          if (Math.abs(d - sw.radius) <= 22 + e.radius) {
            if (sw.hitIds) sw.hitIds.add(e);
            damageEnemy(e, sw.damage, 0.1, Math.atan2(e.y - sw.y, e.x - sw.x), 200, 0.35);
          }
        }
      } else if (!sw.friendly && sw.damage > 0 && !sw.hitPlayer) {
        const d = Math.hypot(p.x - sw.x, p.y - sw.y);
        if (Math.abs(d - sw.radius) <= 18 + p.radius) {
          // Если игрок подпрыгнул (z > 14), он перепрыгивает ударную волну без урона!
          if (sw.jumpable && p.z > 14) {
            sw.hitPlayer = true;
            addFloatingText(p.x, p.y - 30, 'ПРЫЖОК!', '#38bdf8', 13);
          } else {
            sw.hitPlayer = true;
            damagePlayer(sw.damage, sw.x, sw.y);
          }
        }
      }
      if (sw.radius >= sw.maxRadius) state.shockwaves.splice(i, 1);
    }
  }

  function updateTelegraphs(dt) {
    const p = state.player;
    for (let i = state.telegraphs.length - 1; i >= 0; i--) {
      const tg = state.telegraphs[i];
      tg.timer -= dt;
      if (tg.timer <= 0) {
        sound.play('slam');
        spawnParticles(tg.x, tg.y, 18, tg.color, 185, 0.5, 4.5, 10);
        if (Math.hypot(p.x - tg.x, p.y - tg.y) <= tg.radius + p.radius * 0.5) {
          damagePlayer(tg.damage, tg.x, tg.y);
        }
        state.telegraphs.splice(i, 1);
      }
    }
  }

  function updateLoot(dt, cs) {
    const p = state.player;
    for (let i = state.lootDrops.length - 1; i >= 0; i--) {
      const lt = state.lootDrops[i];
      lt.life -= dt;
      if (lt.life <= 0) {
        state.lootDrops.splice(i, 1);
        continue;
      }
      const dx = p.x - lt.x;
      const dy = p.y - lt.y;
      const d = Math.hypot(dx, dy);
      if (d < cs.magnetRadius && d > 1) {
        const pull = 360 * dt;
        lt.x += (dx / d) * pull;
        lt.y += (dy / d) * pull;
      }
      if (d <= 24) {
        if (lt.type === 'gold') {
          sound.play('gold');
          grantRewardItem({ type: 'gold', amount: lt.amount }, false);
        } else {
          sound.play('pickup');
          grantRewardItem({ type: lt.type, id: lt.itemId, count: lt.count || 1 }, false);
        }
        state.lootDrops.splice(i, 1);
      }
    }
  }

  // ── Сохранение и Загрузка прогресса ──────────────────────────────────
  function serializeSave() {
    return {
      version: 1,
      savedAt: Date.now(),
      playTime: state.playTime,
      dayTime: state.dayTime,
      settings: state.settings,
      player: {
        x: Math.round(state.player.x),
        y: Math.round(state.player.y),
        level: state.player.level,
        xp: state.player.xp,
        xpNext: state.player.xpNext,
        statPoints: state.player.statPoints,
        skillPoints: state.player.skillPoints,
        gold: state.player.gold,
        attributes: state.player.attributes,
        permanentBonusHp: state.player.permanentBonusHp,
        hp: Math.round(state.player.hp),
        stamina: Math.round(state.player.stamina),
        satiety: Math.round(state.player.satiety),
        equippedWeapon: state.player.equippedWeapon,
        equippedArmor: state.player.equippedArmor,
        equippedRelics: state.player.equippedRelics,
        quickConsumable: state.player.quickConsumable
      },
      skillRanks: state.skillRanks,
      inventory: state.inventory,
      weaponUpgrades: state.weaponUpgrades,
      unlockedCampfires: state.unlockedCampfires,
      respawnCampId: state.respawnCampId,
      discoveredSecrets: state.discoveredSecrets,
      openedChests: state.openedChests,
      brokenPermanentNodes: state.brokenPermanentNodes,
      litBraziers: state.litBraziers,
      defeatedBosses: state.defeatedBosses,
      activeQuestIndex: state.activeQuestIndex,
      completedQuests: state.completedQuests,
      questProgress: state.questProgress,
      bounty: state.bounty,
      unlockedAchievements: state.unlockedAchievements,
      stats: state.stats,
      fog: state.fog
    };
  }

  function saveGame() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SAVE_KEY, JSON.stringify(serializeSave()));
      }
      return true;
    } catch (_e) {
      return false;
    }
  }

  function loadGame(rawObj = null) {
    try {
      let data = rawObj;
      if (!data && typeof localStorage !== 'undefined') {
        const str = localStorage.getItem(SAVE_KEY);
        if (!str) return false;
        data = JSON.parse(str);
      }
      if (!data || !data.player) return false;

      state.playTime = data.playTime || 0;
      state.dayTime = typeof data.dayTime === 'number' ? data.dayTime : 0.28;
      if (data.settings) Object.assign(state.settings, data.settings);
      Object.assign(state.player, data.player);
      state.player.z = 0;
      state.player.vz = 0;
      state.player.thunderLeap = null;

      if (data.skillRanks) Object.assign(state.skillRanks, data.skillRanks);
      if (data.inventory) {
        state.inventory.weapons = data.inventory.weapons || ['sword_iron'];
        state.inventory.armors = data.inventory.armors || ['armor_tunic'];
        state.inventory.relics = data.inventory.relics || [];
        Object.assign(state.inventory.resources, data.inventory.resources || {});
        Object.assign(state.inventory.consumables, data.inventory.consumables || {});
      }
      if (data.weaponUpgrades) Object.assign(state.weaponUpgrades, data.weaponUpgrades);
      state.unlockedCampfires = data.unlockedCampfires || ['camp_haven'];
      state.respawnCampId = data.respawnCampId || 'camp_haven';
      state.discoveredSecrets = data.discoveredSecrets || [];
      state.openedChests = data.openedChests || [];
      state.brokenPermanentNodes = data.brokenPermanentNodes || [];
      state.litBraziers = data.litBraziers || [];
      state.defeatedBosses = data.defeatedBosses || [];
      state.activeQuestIndex = data.activeQuestIndex || 0;
      state.completedQuests = data.completedQuests || [];
      if (data.questProgress) {
        Object.assign(state.questProgress, data.questProgress);
        state.questProgress.biomeKills = Object.assign(
          { meadow: 0, ruins: 0, mire: 0, frost: 0, rift: 0 },
          data.questProgress.biomeKills || {}
        );
      }
      if (data.bounty) Object.assign(state.bounty, data.bounty);
      state.unlockedAchievements = data.unlockedAchievements || [];
      if (data.stats) Object.assign(state.stats, data.stats);
      if (Array.isArray(data.fog) && data.fog.length === FOG_GRID * FOG_GRID) {
        state.fog = data.fog;
      }

      // Применяем открытые сундуки, разрушенные печати и жаровни к миру
      for (const ch of world.chests) {
        ch.opened = state.openedChests.includes(ch.id);
      }
      for (const nd of world.nodes) {
        if (state.brokenPermanentNodes.includes(nd.id)) {
          nd.hp = 0;
          nd.respawnTimer = 999999;
        }
      }
      for (const br of world.braziers) {
        br.lit = state.litBraziers.includes(br.id);
      }

      state.camera.x = state.player.x;
      state.camera.y = state.player.y;
      state.gameOver = false;
      syncPlayerVitals(false);
      sound.setSettings(state.settings);
      return true;
    } catch (_e) {
      return false;
    }
  }

  function resetNewGame() {
    const keptSettings = { ...state.settings };
    const fresh = createInitialState();
    Object.assign(state, fresh);
    state.settings = keptSettings;
    for (const ch of world.chests) ch.opened = false;
    for (const nd of world.nodes) {
      nd.hp = nd.maxHp;
      nd.respawnTimer = 0;
    }
    for (const br of world.braziers) br.lit = false;
    revealFogAround(WORLD_CONFIG.spawnX, WORLD_CONFIG.spawnY, 4);
    syncPlayerVitals(true);
    sound.setBossMode(false);
    saveGame();
  }

  function hasSavedGame() {
    try {
      return typeof localStorage !== 'undefined' && !!localStorage.getItem(SAVE_KEY);
    } catch (_e) {
      return false;
    }
  }

  function getSavedPreview() {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      const bId = getBiomeIdAt(d.player?.x || 2400, d.player?.y || 2400);
      return {
        level: d.player?.level || 1,
        gold: d.player?.gold || 0,
        biomeName: BIOMES[bId]?.name || 'Изумрудная Пустошь',
        playTime: d.playTime || 0
      };
    } catch (_e) {
      return null;
    }
  }

  syncPlayerVitals(true);

  return {
    world,
    state,
    particles,
    floatingTexts,
    toasts,
    FOG_GRID,
    getComputedStats,
    getCurrentQuest,
    getQuestStatus,
    isNightTime,
    update,
    triggerAttack,
    triggerJump,
    triggerSkill,
    useQuickConsumable,
    interact,
    allocateStat,
    upgradeSkill,
    upgradeWeapon,
    craftRecipe,
    equipItem,
    fastTravel,
    respawnPlayer,
    saveGame,
    loadGame,
    serializeSave,
    resetNewGame,
    hasSavedGame,
    getSavedPreview,
    pushToast
  };
}
