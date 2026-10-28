// Пиксель-арт 2.5D рендерер (imageSmoothingEnabled = false, единый масштаб пикселя, Y-сортировка)
// Отрисовывает каждую модель из независимого прозрачного PNG / спрайт-листа в assets/sprites/**

import { BIOMES, CAMPFIRES, NPCS, WEAPONS, ITEMS, RESOURCES, BOSSES, SECRETS, WEAPON_MODS } from './data.js';
import { getBiomeIdAt, getLocationAt, dist2 } from './world.js';

const ASSET_MANIFEST = {
  // Текстуры тайлов локаций
  tile_grass:   'assets/sprites/tiles/grass.png',
  tile_asphalt: 'assets/sprites/tiles/asphalt.png',
  tile_sand:    'assets/sprites/tiles/sand.png',
  tile_snow:    'assets/sprites/tiles/snow.png',
  tile_water:   'assets/sprites/tiles/water.png',
  // RISE OF THE ABYSS: тайлы трёх новых локаций
  tile_ruins:   'assets/sprites/tiles/ruins.png',
  tile_cursed:  'assets/sprites/tiles/cursed.png',
  tile_abyss:   'assets/sprites/tiles/abyss.png',
  // AGE OF THE FALLEN GODS: тайлы 7 новых регионов
  tile_ash:        'assets/sprites/tiles/ash.png',
  tile_lostforest: 'assets/sprites/tiles/lostforest.png',
  tile_frost:      'assets/sprites/tiles/frost.png',
  tile_dead:       'assets/sprites/tiles/dead.png',
  tile_sky:        'assets/sprites/tiles/sky.png',
  tile_under:      'assets/sprites/tiles/under.png',
  tile_gods:       'assets/sprites/tiles/gods.png',
  // ПАДЕНИЕ ДРЕВНИХ: тайлы катакомб, пещер и цитадели
  tile_catacombs:  'assets/sprites/tiles/catacombs.png',
  tile_crystal:    'assets/sprites/tiles/crystal.png',
  tile_citadel:    'assets/sprites/tiles/citadel.png',

  // Спрайт-листы персонажей, врагов, босса и NPC
  hero_sheet:    'assets/sprites/characters/hero_sheet.png',
  zombie_sheet:  'assets/sprites/characters/zombie_sheet.png',
  bandit_sheet:  'assets/sprites/characters/bandit_sheet.png',
  soldier_sheet: 'assets/sprites/characters/soldier_sheet.png',
  monster_sheet: 'assets/sprites/characters/monster_sheet.png',
  boss_sheet:    'assets/sprites/characters/boss_sheet.png',
  npc_trader:    'assets/sprites/characters/npc_trader.png',
  npc_quest:     'assets/sprites/characters/npc_quest.png',
  npc_medic:     'assets/sprites/characters/npc_medic.png',
  npc_farmer:    'assets/sprites/characters/npc_farmer.png',
  npc_engineer:  'assets/sprites/characters/npc_engineer.png',
  npc_mechanic:  'assets/sprites/characters/npc_mechanic.png',
  npc_fighter:   'assets/sprites/characters/npc_fighter.png',
  npc_prisoner:  'assets/sprites/characters/npc_prisoner.png',
  npc_smith:     'assets/sprites/characters/npc_smith.png',

  // VEXMORA 2.0: 12 новых типов врагов (6-кадровые спрайт-листы)
  runner_sheet:         'assets/sprites/characters/runner_sheet.png',
  gunner_sheet:         'assets/sprites/characters/gunner_sheet.png',
  sniper_enemy_sheet:   'assets/sprites/characters/sniper_enemy_sheet.png',
  heavy_armor_sheet:    'assets/sprites/characters/heavy_armor_sheet.png',
  grenadier_sheet:      'assets/sprites/characters/grenadier_sheet.png',
  pyro_sheet:           'assets/sprites/characters/pyro_sheet.png',
  stealth_hunter_sheet: 'assets/sprites/characters/stealth_hunter_sheet.png',
  spitter_sheet:        'assets/sprites/characters/spitter_sheet.png',
  drone_sheet:          'assets/sprites/characters/drone_sheet.png',
  medic_enemy_sheet:    'assets/sprites/characters/medic_enemy_sheet.png',
  miniboss_warden_sheet:   'assets/sprites/characters/miniboss_warden_sheet.png',
  miniboss_punisher_sheet: 'assets/sprites/characters/miniboss_punisher_sheet.png',

  // RISE OF THE ABYSS: 10 новых врагов (6-кадровые спрайт-листы)
  skeleton_warrior_sheet: 'assets/sprites/characters/skeleton_warrior_sheet.png',
  dark_archer_sheet:      'assets/sprites/characters/dark_archer_sheet.png',
  abyss_mage_sheet:       'assets/sprites/characters/abyss_mage_sheet.png',
  stone_golem_sheet:      'assets/sprites/characters/stone_golem_sheet.png',
  cursed_wraith_sheet:    'assets/sprites/characters/cursed_wraith_sheet.png',
  thorn_hunter_sheet:     'assets/sprites/characters/thorn_hunter_sheet.png',
  plague_bearer_sheet:    'assets/sprites/characters/plague_bearer_sheet.png',
  frost_revenant_sheet:   'assets/sprites/characters/frost_revenant_sheet.png',
  bone_hound_sheet:       'assets/sprites/characters/bone_hound_sheet.png',
  void_cultist_sheet:     'assets/sprites/characters/void_cultist_sheet.png',

  // AGE OF THE FALLEN GODS: 14 новых врагов (6-кадровые спрайт-листы)
  ash_imp_sheet:        'assets/sprites/characters/ash_imp_sheet.png',
  goblin_shaman_sheet:  'assets/sprites/characters/goblin_shaman_sheet.png',
  wolf_mutant_sheet:    'assets/sprites/characters/wolf_mutant_sheet.png',
  cave_troll_sheet:     'assets/sprites/characters/cave_troll_sheet.png',
  harpy_sheet:          'assets/sprites/characters/harpy_sheet.png',
  cursed_knight_sheet:  'assets/sprites/characters/cursed_knight_sheet.png',
  fire_elemental_sheet: 'assets/sprites/characters/fire_elemental_sheet.png',
  ice_archer_sheet:     'assets/sprites/characters/ice_archer_sheet.png',
  shadow_killer_sheet:  'assets/sprites/characters/shadow_killer_sheet.png',
  ancient_guard_sheet:  'assets/sprites/characters/ancient_guard_sheet.png',
  root_druid_sheet:     'assets/sprites/characters/root_druid_sheet.png',
  magma_golem_sheet:    'assets/sprites/characters/magma_golem_sheet.png',
  frost_giant_sheet:    'assets/sprites/characters/frost_giant_sheet.png',
  soul_wraith_sheet:    'assets/sprites/characters/soul_wraith_sheet.png',

  // ПАДЕНИЕ ДРЕВНИХ: 8 новых врагов
  crypt_skeleton_sheet:  'assets/sprites/characters/crypt_skeleton_sheet.png',
  tomb_knight_sheet:     'assets/sprites/characters/tomb_knight_sheet.png',
  crystal_mage_sheet:    'assets/sprites/characters/crystal_mage_sheet.png',
  crystal_harpy_sheet:   'assets/sprites/characters/crystal_harpy_sheet.png',
  crystal_golem_sheet:   'assets/sprites/characters/crystal_golem_sheet.png',
  abyss_duelist_sheet:   'assets/sprites/characters/abyss_duelist_sheet.png',
  crypt_archer_sheet:    'assets/sprites/characters/crypt_archer_sheet.png',
  citadel_warlock_sheet: 'assets/sprites/characters/citadel_warlock_sheet.png',

  // VEXMORA 2.0: 10 уникальных боссов (64x64 x 6 кадров)
  boss_mutant_king:    'assets/sprites/bosses/boss_mutant_king.png',
  boss_commander:      'assets/sprites/bosses/boss_commander.png',
  boss_destroyer:      'assets/sprites/bosses/boss_destroyer.png',
  boss_sniper:         'assets/sprites/bosses/boss_sniper.png',
  boss_giant_beast:    'assets/sprites/bosses/boss_giant_beast.png',
  boss_mad_scientist:  'assets/sprites/bosses/boss_mad_scientist.png',
  boss_shadow_assassin:'assets/sprites/bosses/boss_shadow_assassin.png',
  boss_war_robot:      'assets/sprites/bosses/boss_war_robot.png',
  boss_general:        'assets/sprites/bosses/boss_general.png',
  boss_vexmora:        'assets/sprites/bosses/boss_vexmora.png',

  // RISE OF THE ABYSS: 5 новых боссов (64x64 x 6 кадров)
  boss_rune_golem:   'assets/sprites/bosses/boss_rune_golem.png',
  boss_necromancer:  'assets/sprites/bosses/boss_necromancer.png',
  boss_cursed_queen: 'assets/sprites/bosses/boss_cursed_queen.png',
  boss_abyss_warlord:'assets/sprites/bosses/boss_abyss_warlord.png',
  boss_abyss_heart:  'assets/sprites/bosses/boss_abyss_heart.png',

  // AGE OF THE FALLEN GODS: 5 новых боссов (64x64 x 6 кадров)
  boss_ash_king:     'assets/sprites/bosses/boss_ash_king.png',
  boss_root_queen:   'assets/sprites/bosses/boss_root_queen.png',
  boss_ice_colossus: 'assets/sprites/bosses/boss_ice_colossus.png',
  boss_soul_eater:   'assets/sprites/bosses/boss_soul_eater.png',
  boss_fallen_god:   'assets/sprites/bosses/boss_fallen_god.png',

  // ПАДЕНИЕ ДРЕВНИХ: 3 новых босса
  boss_catacomb_king:      'assets/sprites/bosses/boss_catacomb_king.png',
  boss_crystal_leviathan:  'assets/sprites/bosses/boss_crystal_leviathan.png',
  boss_citadel_lord:       'assets/sprites/bosses/boss_citadel_lord.png',

  // Все 8 видов оружия
  wpn_pistol:      'assets/sprites/weapons/pistol.png',
  wpn_shotgun:     'assets/sprites/weapons/shotgun.png',
  wpn_rifle:       'assets/sprites/weapons/rifle.png',
  wpn_sniper:      'assets/sprites/weapons/sniper.png',
  wpn_knife:       'assets/sprites/weapons/knife.png',
  wpn_sword:       'assets/sprites/weapons/sword.png',
  wpn_bow:         'assets/sprites/weapons/bow.png',
  wpn_magic_staff: 'assets/sprites/weapons/magic_staff.png',

  // VEXMORA 2.0: ещё 16 видов оружия (итого арсенал 24)
  wpn_revolver:         'assets/sprites/weapons/revolver.png',
  wpn_autopistol:       'assets/sprites/weapons/autopistol.png',
  wpn_smg_compact:      'assets/sprites/weapons/smg_compact.png',
  wpn_smg_storm:        'assets/sprites/weapons/smg_storm.png',
  wpn_smg_plasma:       'assets/sprites/weapons/smg_plasma.png',
  wpn_auto_shotgun:     'assets/sprites/weapons/auto_shotgun.png',
  wpn_burst_rifle:      'assets/sprites/weapons/burst_rifle.png',
  wpn_laser_rifle:      'assets/sprites/weapons/laser_rifle.png',
  wpn_railgun:          'assets/sprites/weapons/railgun.png',
  wpn_lmg:              'assets/sprites/weapons/lmg.png',
  wpn_minigun:          'assets/sprites/weapons/minigun.png',
  wpn_katana:           'assets/sprites/weapons/katana.png',
  wpn_crossbow:         'assets/sprites/weapons/crossbow.png',
  wpn_grenade_launcher: 'assets/sprites/weapons/grenade_launcher.png',
  wpn_rocket_launcher:  'assets/sprites/weapons/rocket_launcher.png',
  wpn_tesla_cannon:     'assets/sprites/weapons/tesla_cannon.png',

  // RISE OF THE ABYSS: 6 новых видов оружия (итого арсенал 30)
  wpn_shadow_dagger: 'assets/sprites/weapons/shadow_dagger.png',
  wpn_war_axe:       'assets/sprites/weapons/war_axe.png',
  wpn_abyss_staff:   'assets/sprites/weapons/abyss_staff.png',
  wpn_thorn_bow:     'assets/sprites/weapons/thorn_bow.png',
  wpn_vex_blade:     'assets/sprites/weapons/vex_blade.png',
  wpn_phoenix_rifle: 'assets/sprites/weapons/phoenix_rifle.png',

  // AGE OF THE FALLEN GODS: 18 новых видов оружия (итого арсенал 48)
  wpn_ash_greatsword: 'assets/sprites/weapons/ash_greatsword.png',
  wpn_king_slayer:    'assets/sprites/weapons/king_slayer.png',
  wpn_frost_spear:    'assets/sprites/weapons/frost_spear.png',
  wpn_ice_bow:        'assets/sprites/weapons/ice_bow.png',
  wpn_dead_scythe:    'assets/sprites/weapons/dead_scythe.png',
  wpn_soul_staff:     'assets/sprites/weapons/soul_staff.png',
  wpn_root_bow:       'assets/sprites/weapons/root_bow.png',
  wpn_vine_blade:     'assets/sprites/weapons/vine_blade.png',
  wpn_sky_lance:      'assets/sprites/weapons/sky_lance.png',
  wpn_storm_hammer:   'assets/sprites/weapons/storm_hammer.png',
  wpn_under_rail:     'assets/sprites/weapons/under_rail.png',
  wpn_magma_rifle:    'assets/sprites/weapons/magma_rifle.png',
  wpn_god_blade:      'assets/sprites/weapons/god_blade.png',
  wpn_dragon_fang:    'assets/sprites/weapons/dragon_fang.png',
  wpn_queen_thorn:    'assets/sprites/weapons/queen_thorn.png',
  wpn_colossus_maul:  'assets/sprites/weapons/colossus_maul.png',
  wpn_soul_reaper:    'assets/sprites/weapons/soul_reaper.png',
  wpn_rune_crossbow:  'assets/sprites/weapons/rune_crossbow.png',

  // ПАДЕНИЕ ДРЕВНИХ: 4 новых клинка
  wpn_flame_sword:    'assets/sprites/weapons/flame_sword.png',
  wpn_void_blade:     'assets/sprites/weapons/void_blade.png',
  wpn_twin_daggers:   'assets/sprites/weapons/twin_daggers.png',
  wpn_ancients_blade: 'assets/sprites/weapons/ancients_blade.png',

  // Все 8 предметов
  itm_medkit:   'assets/sprites/items/medkit.png',
  itm_ammo:     'assets/sprites/items/ammo.png',
  itm_grenade:  'assets/sprites/items/grenade.png',
  itm_food:     'assets/sprites/items/food.png',
  itm_potion:   'assets/sprites/items/potion.png',
  itm_key:      'assets/sprites/items/key.png',
  itm_coin:     'assets/sprites/items/coin.png',
  itm_backpack: 'assets/sprites/items/backpack.png',

  // Все 6 видов транспорта
  veh_car:  'assets/sprites/vehicles/car.png',
  veh_moto: 'assets/sprites/vehicles/moto.png',
  veh_jeep: 'assets/sprites/vehicles/jeep.png',
  veh_bus:  'assets/sprites/vehicles/bus.png',
  veh_heli: 'assets/sprites/vehicles/heli.png',
  veh_boat: 'assets/sprites/vehicles/boat.png',

  // Все объекты окружения
  prp_barrel:     'assets/sprites/props/barrel.png',
  prp_barrel_red: 'assets/sprites/props/barrel_red.png',
  prp_crates:     'assets/sprites/props/crates.png',
  prp_campfire:   'assets/sprites/props/campfire_sheet.png',
  prp_tree:       'assets/sprites/props/tree.png',
  prp_pine_tree:  'assets/sprites/props/pine_tree.png',
  prp_rock:       'assets/sprites/props/rock.png',
  prp_bush:       'assets/sprites/props/bush.png',
  prp_tent:       'assets/sprites/props/tent.png',
  prp_fence:      'assets/sprites/props/fence.png',
  prp_cage:       'assets/sprites/props/cage.png',
  prp_cage_open:  'assets/sprites/props/cage_open.png',
  prp_alarm_terminal: 'assets/sprites/props/alarm_terminal.png',
  prp_mod_crate:  'assets/sprites/props/mod_crate.png',
  // RISE OF THE ABYSS: сундуки, ловушки, кристаллы и руины
  prp_chest:        'assets/sprites/props/chest.png',
  prp_cursed_chest: 'assets/sprites/props/cursed_chest.png',
  prp_trap_spikes:  'assets/sprites/props/trap_spikes.png',
  prp_trap_fire:    'assets/sprites/props/trap_fire.png',
  prp_trap_poison:  'assets/sprites/props/trap_poison.png',
  prp_crystal_node: 'assets/sprites/props/crystal_node.png',
  prp_ruins_pillar: 'assets/sprites/props/ruins_pillar.png',

  // Все 9 зданий
  bld_house:      'assets/sprites/buildings/house.png',
  bld_shop:       'assets/sprites/buildings/shop.png',
  bld_warehouse:  'assets/sprites/buildings/warehouse.png',
  bld_bunker:     'assets/sprites/buildings/bunker.png',
  bld_watchtower: 'assets/sprites/buildings/watchtower.png',
  bld_factory:    'assets/sprites/buildings/factory.png',
  bld_hospital:   'assets/sprites/buildings/hospital.png',
  bld_police:     'assets/sprites/buildings/police.png',
  bld_base:       'assets/sprites/buildings/base.png',

  // Все 6 пиксельных эффектов (спрайт-листы)
  fx_explosion: 'assets/sprites/effects/explosion_sheet.png',
  fx_muzzle:    'assets/sprites/effects/muzzle_sheet.png',
  fx_magic:     'assets/sprites/effects/magic_sheet.png',
  fx_hit:       'assets/sprites/effects/hit_sheet.png',
  fx_smoke:     'assets/sprites/effects/smoke_sheet.png',
  fx_water:     'assets/sprites/effects/water_sheet.png'
};

// Единый пиксельный множитель для мобильного экрана (чёткий пиксель-арт без мыла)
const PIXEL_SCALE = 1.5;

export class Renderer {
  constructor(canvas, minimapCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.minimapCanvas = minimapCanvas;
    this.mmCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;

    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = 1;
    this.minimapTick = 0;

    this.images = {};
    this.patterns = {};
    this.preloadAssets();
    this.resize('medium');
  }

  preloadAssets() {
    if (typeof Image === 'undefined') return;
    for (const [key, src] of Object.entries(ASSET_MANIFEST)) {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        if (key.startsWith('tile_') && this.ctx) {
          // Увеличиваем 32x32 пиксельный тайл до 48x48 с отключённым сглаживанием для чёткого паттерна земли
          const off = document.createElement('canvas');
          off.width = 48;
          off.height = 48;
          const octx = off.getContext('2d');
          octx.imageSmoothingEnabled = false;
          octx.drawImage(img, 0, 0, 48, 48);
          this.patterns[key] = this.ctx.createPattern(off, 'repeat');
        }
      };
      img.src = src;
      this.images[key] = img;
    }
  }

  imgReady(key) {
    const img = this.images[key];
    return !!(img && img.complete && img.naturalWidth > 0);
  }

  resize(quality = 'medium') {
    const rawDpr = window.devicePixelRatio || 1;
    const maxDpr = quality === 'low' ? 1.0 : quality === 'medium' ? 1.5 : 2.0;
    this.dpr = Math.min(rawDpr, maxDpr);
    this.width = Math.max(320, window.innerWidth);
    this.height = Math.max(240, window.innerHeight);
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx.imageSmoothingEnabled = false;
  }

  render(engine) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.imageSmoothingEnabled = false;

    const shakeX = engine.camera.shake > 0 ? Math.round((Math.random() - 0.5) * engine.camera.shake) : 0;
    const shakeY = engine.camera.shake > 0 ? Math.round((Math.random() - 0.5) * engine.camera.shake) : 0;
    const camX = Math.round(engine.camera.x - w * 0.5 + shakeX);
    const camY = Math.round(engine.camera.y - h * 0.5 + shakeY);

    // 1. Пиксельная земля локаций, дороги и водные преграды
    this.drawGround(ctx, engine, camX, camY, w, h);
    this.drawRoads(ctx, engine.world.roads, camX, camY, w, h);
    this.drawHazardsAndBossArenas(ctx, engine, camX, camY, w, h);

    // 2. Трофеи на земле (отдельные PNG предметов) и ударные волны
    this.drawDrops(ctx, engine.drops, camX, camY, w, h);
    this.drawShockwaves(ctx, engine.shockwaves, camX, camY);
    this.drawTelegraphs(ctx, engine.telegraphs || [], camX, camY);

    // 3. Сбор всех видимых объектов мира и Y-сортировка (2.5D глубина)
    const drawables = [];
    const pad = 160;

    for (const bld of engine.world.buildings) {
      if (bld.x < camX - pad || bld.x > camX + w + pad || bld.y < camY - pad || bld.y > camY + h + pad) continue;
      drawables.push({ kind: 'building', y: bld.y, obj: bld });
    }

    for (const veh of engine.world.vehicles) {
      if (veh.x < camX - pad || veh.x > camX + w + pad || veh.y < camY - pad || veh.y > camY + h + pad) continue;
      drawables.push({ kind: 'vehicle', y: veh.y, obj: veh });
    }

    const nearProps = engine.world.queryPropsNear(engine.camera.x, engine.camera.y);
    for (const pr of nearProps) {
      if (pr.x < camX - pad || pr.x > camX + w + pad || pr.y < camY - pad || pr.y > camY + h + pad) continue;
      drawables.push({ kind: 'prop', y: pr.y, obj: pr });
    }
    if (w > 480) {
      for (const sideX of [engine.camera.x - 360, engine.camera.x + 360]) {
        for (const pr of engine.world.queryPropsNear(sideX, engine.camera.y)) {
          if (pr.x < camX - pad || pr.x > camX + w + pad || pr.y < camY - pad || pr.y > camY + h + pad) continue;
          if (!drawables.some(d => d.obj === pr)) drawables.push({ kind: 'prop', y: pr.y, obj: pr });
        }
      }
    }

    for (const nd of engine.world.nodes) {
      if (nd.respawnTimer > 0) continue;
      if (nd.x < camX - pad || nd.x > camX + w + pad || nd.y < camY - pad || nd.y > camY + h + pad) continue;
      drawables.push({ kind: 'node', y: nd.y, obj: nd });
    }
    // RISE: ловушки и сундуки новых локаций
    for (const t of (engine.world.traps || [])) {
      if (t.x < camX - pad || t.x > camX + w + pad || t.y < camY - pad || t.y > camY + h + pad) continue;
      drawables.push({ kind: 'trap', y: t.y - 20, obj: t });
    }
    for (const c of (engine.world.chests || [])) {
      if (c.looted) continue;
      if (c.x < camX - pad || c.x > camX + w + pad || c.y < camY - pad || c.y > camY + h + pad) continue;
      drawables.push({ kind: 'chest', y: c.y, obj: c });
    }

    for (const c of CAMPFIRES) {
      if (c.x < camX - pad || c.x > camX + w + pad || c.y < camY - pad || c.y > camY + h + pad) continue;
      drawables.push({ kind: 'campfire', y: c.y, obj: c });
    }

    for (const npc of NPCS) {
      if (engine.isNpcUnlocked && !engine.isNpcUnlocked(npc)) continue;
      if (npc.x < camX - pad || npc.x > camX + w + pad || npc.y < camY - pad || npc.y > camY + h + pad) continue;
      drawables.push({ kind: 'npc', y: npc.y, obj: npc });
    }

    for (const site of engine.rescueSites || []) {
      if (site.state === 'done') continue;
      if (site.x < camX - pad || site.x > camX + w + pad || site.y < camY - pad || site.y > camY + h + pad) continue;
      drawables.push({ kind: 'rescue', y: site.npcY, obj: site });
    }

    for (const cache of engine.world.modCaches || []) {
      if (cache.looted) continue;
      if (cache.x < camX - pad || cache.x > camX + w + pad || cache.y < camY - pad || cache.y > camY + h + pad) continue;
      drawables.push({ kind: 'modcache', y: cache.y, obj: cache });
    }

    if (engine.companionActive && engine.companion && engine.companion.hp > 0) {
      drawables.push({ kind: 'companion', y: engine.companion.y, obj: engine.companion });
    }

    if (engine.contractNpc && engine.contractNpc.active) {
      drawables.push({ kind: 'contractNpc', y: engine.contractNpc.y, obj: engine.contractNpc });
    }

    for (const e of engine.enemies) {
      if (e.x < camX - pad || e.x > camX + w + pad || e.y < camY - pad || e.y > camY + h + pad) continue;
      drawables.push({ kind: 'enemy', y: e.y, obj: e });
    }

    for (const b of engine.bossEntities) {
      if (b.x < camX - 220 || b.x > camX + w + 220 || b.y < camY - 220 || b.y > camY + h + 220) continue;
      drawables.push({ kind: 'boss', y: b.y, obj: b });
    }

    if (!engine.player.dead && !engine.player.vehicleId) {
      drawables.push({ kind: 'player', y: engine.player.y, obj: engine.player });
    }

    drawables.sort((a, b) => a.y - b.y);

    for (let i = 0; i < drawables.length; i++) {
      const item = drawables[i];
      switch (item.kind) {
        case 'building': this.drawBuilding(ctx, item.obj, engine, camX, camY); break;
        case 'vehicle':  this.drawVehicle(ctx, item.obj, engine, camX, camY); break;
        case 'prop':     this.drawProp(ctx, item.obj, camX, camY); break;
        case 'node':     this.drawNode(ctx, item.obj, camX, camY); break;
        case 'trap':     this.drawTrap(ctx, item.obj, engine, camX, camY); break;
        case 'chest':    this.drawChest(ctx, item.obj, engine, camX, camY); break;
        case 'campfire': this.drawCampfire(ctx, item.obj, engine, camX, camY); break;
        case 'npc':      this.drawNpc(ctx, item.obj, engine, camX, camY); break;
        case 'rescue':   this.drawRescueSite(ctx, item.obj, engine, camX, camY); break;
        case 'modcache': this.drawModCache(ctx, item.obj, engine, camX, camY); break;
        case 'companion': this.drawCompanion(ctx, item.obj, engine, camX, camY); break;
        case 'contractNpc': this.drawContractNpc(ctx, item.obj, engine, camX, camY); break;
        case 'enemy':    this.drawEnemy(ctx, item.obj, engine, camX, camY); break;
        case 'boss':     this.drawBoss(ctx, item.obj, engine, camX, camY); break;
        case 'player':   this.drawPlayer(ctx, item.obj, engine, camX, camY); break;
      }
    }

    // 4. Взмахи клинков, пули, летящие гранаты, пиксельные спрайт-эффекты и всплывающий урон
    this.drawSlashes(ctx, engine.slashes, camX, camY);
    this.drawProjectiles(ctx, engine.projectiles, camX, camY);
    this.drawThrownGrenades(ctx, engine.thrownGrenades, camX, camY);
    this.drawParticles(ctx, engine.particles, camX, camY);
    this.drawSpriteEffects(ctx, engine.spriteEffects, camX, camY);
    this.drawFloatingTexts(ctx, engine.floatingTexts, camX, camY);

    // 5. Атмосферная Ночь (с тёплым светом вокруг костров, зданий, фар и героя)
    this.drawDayNightLighting(ctx, engine, camX, camY, w, h);

    // 6. Стрелка-компас к активному квесту
    this.drawQuestPointer(ctx, engine, w, h);

    // 6b. RISE: телеграфные круги боссов (честное предупреждение перед атакой)
    this.drawBossTelegraphCircles(ctx, engine, camX, camY);

    // 7. RISE: кинематографичное интро босса / баннер новой локации
    this.drawCinematicOverlay(ctx, engine, w, h);

    ctx.restore();

    this.minimapTick++;
    if (this.mmCtx && this.minimapTick % 4 === 0) {
      this.renderMinimap(engine);
    }
  }

  // ── Отрисовка пиксельной земли по биомам ─────────────────────────────
  drawGround(ctx, engine, camX, camY, w, h) {
    const patch = 192; // кратно 48px тайлу!
    const startX = Math.floor(camX / patch) * patch;
    const startY = Math.floor(camY / patch) * patch;

    ctx.save();
    ctx.translate(-camX, -camY);
    for (let gy = startY; gy < camY + h + patch; gy += patch) {
      for (let gx = startX; gx < camX + w + patch; gx += patch) {
        const locAt = getLocationAt(gx + patch * 0.5, gy + patch * 0.5);
        const biomeId = getBiomeIdAt(gx + patch * 0.5, gy + patch * 0.5);
        const biome = BIOMES[biomeId];
        const patKey = locAt ? `tile_${locAt.tile}` : `tile_${biome.tile}`;
        if (this.patterns[patKey]) {
          ctx.fillStyle = this.patterns[patKey];
        } else {
          ctx.fillStyle = biome.groundBase;
        }
        ctx.fillRect(gx, gy, patch, patch);
      }
    }
    ctx.restore();

    // Чёткая пиксельная рамка границы зоны
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 4;
    ctx.strokeRect(44 - camX, 44 - camY, engine.world.width - 88, engine.world.height - 88);
  }

  drawRoads(ctx, roads, camX, camY, w, h) {
    ctx.save();
    ctx.lineCap = 'square';
    for (const r of roads) {
      const sx1 = r.x1 - camX, sy1 = r.y1 - camY;
      const sx2 = r.x2 - camX, sy2 = r.y2 - camY;
      if (Math.max(sx1, sx2) < -100 || Math.min(sx1, sx2) > w + 100 ||
          Math.max(sy1, sy2) < -100 || Math.min(sy1, sy2) > h + 100) continue;

      if (r.kind === 'asphalt') {
        ctx.strokeStyle = '#181c24';
        ctx.lineWidth = r.width + 6;
        ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(sx2, sy2); ctx.stroke();

        ctx.strokeStyle = '#333945';
        ctx.lineWidth = r.width;
        ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(sx2, sy2); ctx.stroke();

        // Жёлтая дорожная разметка
        ctx.strokeStyle = '#e5a93c';
        ctx.lineWidth = 3;
        ctx.setLineDash([14, 14]);
        ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(sx2, sy2); ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = '#5c4328';
        ctx.lineWidth = r.width + 4;
        ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(sx2, sy2); ctx.stroke();

        ctx.strokeStyle = '#8b6843';
        ctx.lineWidth = r.width - 6;
        ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(sx2, sy2); ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawHazardsAndBossArenas(ctx, engine, camX, camY, w, h) {
    for (const hz of engine.world.hazards) {
      const sx = Math.round(hz.x - camX);
      const sy = Math.round(hz.y - camY);
      if (sx < -300 || sx > w + 300 || sy < -300 || sy > h + 300) continue;

      // Кольцевая река с пиксельной водой
      ctx.save();
      ctx.beginPath();
      ctx.arc(sx, sy, hz.outerRadius, 0, Math.PI * 2);
      ctx.arc(sx, sy, hz.innerRadius, 0, Math.PI * 2, true);
      ctx.fillStyle = '#2563eb';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#181c24';
      ctx.stroke();
      ctx.restore();

      for (const st of engine.world.steppingStones) {
        const px = Math.round(st.x - camX);
        const py = Math.round(st.y - camY);
        ctx.fillStyle = '#181c24';
        ctx.fillRect(px - 22, py - 15, 44, 30);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(px - 20, py - 13, 40, 26);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(px - 17, py - 10, 34, 8);
      }
    }

    // Контуры арен Боссов
    for (const b of engine.bossEntities) {
      const sx = Math.round(b.homeX - camX);
      const sy = Math.round(b.homeY - camY);
      if (sx < -420 || sx > w + 420 || sy < -420 || sy > h + 420) continue;
      ctx.save();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 10]);
      ctx.beginPath();
      ctx.arc(sx, sy, b.arenaRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── Здания (все 9 типов с вывесками и индикаторами входа) ────────────
  drawBuilding(ctx, bld, engine, camX, camY) {
    const sx = Math.round(bld.x - camX);
    const sy = Math.round(bld.y - camY);
    const key = `bld_${bld.kind}`;
    const dw = Math.round(bld.spriteW * PIXEL_SCALE);
    const dh = Math.round(bld.spriteH * PIXEL_SCALE);

    // Пиксельная тень под основанием здания
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(Math.round(sx - dw * 0.46), sy - 6, Math.round(dw * 0.92), 12);

    if (this.imgReady(key)) {
      ctx.drawImage(this.images[key], Math.round(sx - dw * 0.5), sy - dh, dw, dh);
    } else {
      ctx.fillStyle = '#475569';
      ctx.fillRect(Math.round(sx - dw * 0.45), sy - dh, Math.round(dw * 0.9), dh);
    }

    // Пиксельный маркер активного входа перед дверью
    if (bld.interactType) {
      const isDone = (bld.interactType === 'loot_once' && bld.looted) ||
                     (bld.interactType === 'secret_vault' && engine.discoveredSecrets.includes(bld.secretId));
      if (!isDone) {
        const bob = Math.round(Math.sin(engine.stats.playTime * 4.5) * 3);
        let badge = '📦';
        let col = '#fbbf24';
        if (bld.interactType === 'shop') { badge = '🏪 SHOP'; col = '#4ade80'; }
        else if (bld.interactType === 'heal') { badge = '🏥 +HP'; col = '#38bdf8'; }
        else if (bld.interactType === 'base_hub') { badge = '🏰 БАЗА'; col = '#fbbf24'; }
        else if (bld.interactType === 'secret_vault') { badge = '🗝️ ЗАМОК'; col = '#c084fc'; }

        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        const tw = ctx.measureText(badge).width + 10;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(Math.round(sx - tw * 0.5), sy + 6 + bob, Math.round(tw), 16);
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.round(sx - tw * 0.5), sy + 6 + bob, Math.round(tw), 16);
        ctx.fillStyle = col;
        ctx.fillText(badge, sx, sy + 18 + bob);
      }
    }
  }

  // ── Транспорт (6 видов: машина, мотоцикл, внедорожник, автобус, вертолёт, лодка) ──
  drawVehicle(ctx, veh, engine, camX, camY) {
    const sx = Math.round(veh.x - camX);
    const sy = Math.round(veh.y - camY);
    const key = `veh_${veh.kind}`;
    const img = this.images[key];
    const driven = engine.player.vehicleId === veh.id;

    if (this.imgReady(key)) {
      const dw = Math.round(img.naturalWidth * PIXEL_SCALE);
      const dh = Math.round(img.naturalHeight * PIXEL_SCALE);
      ctx.save();
      ctx.translate(sx, sy);
      if (Math.cos(veh.angle) < -0.15) ctx.scale(-1, 1);
      ctx.drawImage(img, Math.round(-dw * 0.5), Math.round(-dh * 0.72), dw, dh);
      ctx.restore();
    }

    if (driven) {
      // Полоска HP игрока над управляемым транспортом
      this.drawMiniBar(ctx, sx, sy - 38, 42, engine.player.hp / engine.player.maxHp, '#22c55e');
    } else if (veh.drivable && dist2(engine.player.x, engine.player.y, veh.x, veh.y) < 160 * 160) {
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('🚗 РУЛЬ', sx, sy - 30);
    }
  }

  // ── Пропы и разрушаемые объекты (деревья, кусты, камни, ящики, бочки, палатки, заборы) ──
  drawProp(ctx, pr, camX, camY) {
    const sx = Math.round(pr.x - camX);
    const sy = Math.round(pr.y - camY);
    const key = `prp_${pr.kind}`;
    if (this.imgReady(key)) {
      const img = this.images[key];
      const dw = Math.round(img.naturalWidth * PIXEL_SCALE);
      const dh = Math.round(img.naturalHeight * PIXEL_SCALE);
      ctx.drawImage(img, Math.round(sx - dw * 0.5), Math.round(sy - dh * 0.82), dw, dh);
    }
  }

  drawNode(ctx, nd, camX, camY) {
    const sx = Math.round(nd.x - camX);
    const sy = Math.round(nd.y - camY);
    const shake = nd.hitFlash > 0 ? Math.round((Math.random() - 0.5) * 5) : 0;
    const key = `prp_${nd.kind}`;

    if (this.imgReady(key)) {
      const img = this.images[key];
      const dw = Math.round(img.naturalWidth * PIXEL_SCALE);
      const dh = Math.round(img.naturalHeight * PIXEL_SCALE);
      ctx.drawImage(img, Math.round(sx + shake - dw * 0.5), Math.round(sy - dh * 0.85), dw, dh);
    }

    if (nd.hp < nd.maxHp) {
      this.drawMiniBar(ctx, sx, sy - 38, 32, nd.hp / nd.maxHp, nd.explosive ? '#ef4444' : '#f59e0b');
    }
  }

  // ── Анимированный пиксельный Костёр (4 кадра campfire_sheet.png) ──────
  drawCampfire(ctx, c, engine, camX, camY) {
    const sx = Math.round(c.x - camX);
    const sy = Math.round(c.y - camY);
    const unlocked = engine.unlockedCamps.includes(c.id);

    if (this.imgReady('prp_campfire')) {
      const frame = unlocked ? (Math.floor(engine.stats.playTime * 8) % 4) : 0;
      const dw = Math.round(32 * PIXEL_SCALE);
      const dh = Math.round(32 * PIXEL_SCALE);
      ctx.save();
      if (!unlocked) ctx.globalAlpha = 0.65;
      ctx.drawImage(this.images.prp_campfire, frame * 32, 0, 32, 32, Math.round(sx - dw * 0.5), Math.round(sy - dh * 0.78), dw, dh);
      ctx.restore();
    }

    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = unlocked ? '#fde68a' : '#94a3b8';
    ctx.fillText(unlocked ? `🔥 ${c.name}` : `🔒 ${c.name}`, sx, sy - 36);
  }

  // ── 4 NPC (Торговец, Квестовый, Лекарь, Фермер — 2 кадра анимации) ────
  drawNpc(ctx, npc, engine, camX, camY) {
    const sx = Math.round(npc.x - camX);
    const sy = Math.round(npc.y - camY);
    const key = npc.sprite;
    if (this.imgReady(key)) {
      const frame = Math.floor(engine.stats.playTime * 2.5) % 2;
      const dw = Math.round(32 * PIXEL_SCALE);
      const dh = Math.round(32 * PIXEL_SCALE);
      ctx.drawImage(this.images[key], frame * 32, 0, 32, 32, Math.round(sx - dw * 0.5), Math.round(sy - dh * 0.88), dw, dh);
    }

    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(npc.name, sx + 1, sy - 41);
    ctx.fillStyle = '#fde047';
    ctx.fillText(npc.name, sx, sy - 42);
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(npc.role, sx, sy - 54);
  }

  // ── Враги (Зомби, Бандит, Солдат, Монстр — 6-кадровые спрайт-листы) ──
  drawEnemy(ctx, e, engine, camX, camY) {
    const sx = Math.round(e.x - camX);
    const sy = Math.round(e.y - camY);
    const sz = Math.round(e.z || 0);
    const sheetKey = `${e.sprite}_sheet`;

    const moving = Math.hypot(e.vx, e.vy) > 10;
    let frame = 0;
    if (e.hitFlash > 0) frame = 5;
    else if (e.attackCd > 1.35) frame = 4;
    else if (moving) frame = Math.floor(e.animTime) % 4;

    // Лазерный прицел снайпера: красная линия предупреждения перед выстрелом!
    if (e.aiming && engine && engine.player) {
      ctx.save();
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.75)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(sx, sy - 14);
      ctx.lineTo(Math.round(engine.player.x - camX), Math.round(engine.player.y - camY - 10));
      ctx.stroke();
      ctx.restore();
    }

    // RISE/3.0: фиолетовая аура элитных врагов
    if (e.elite) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(sx, sy - 14, 24 + Math.sin(engine.elapsed * 5) * 3, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.65)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    if (this.imgReady(sheetKey)) {
      const img = this.images[sheetKey];
      const fw = Math.floor(img.naturalWidth / 6);
      const fh = img.naturalHeight;
      const scale = e.isMiniBoss ? PIXEL_SCALE * 1.12 : e.kind === 'infected_runner' ? PIXEL_SCALE * 1.06 : PIXEL_SCALE;
      const dw = Math.round(fw * scale);
      const dh = Math.round(fh * scale);

      ctx.save();
      if (e.isStealthed) ctx.globalAlpha = 0.22;
      if (e.slowTimer > 0) ctx.globalAlpha = Math.min(ctx.globalAlpha, 0.9);
      ctx.translate(sx, sy - sz);
      if (e.vx < -8) ctx.scale(-1, 1);
      ctx.drawImage(img, frame * fw, 0, fw, fh, Math.round(-dw * 0.5), Math.round(-dh * 0.88), dw, dh);
      ctx.restore();
    }

    if (e.stunTimer > 0) {
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ОГЛУШЁН', sx, sy - sz - 44);
    }
    if (e.slowTimer > 0) {
      ctx.fillStyle = '#7dd3fc';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('❄️ ЗАМЕДЛЕН', sx, sy - sz - 52);
    }
    if (e.isMiniBoss) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`💀 ${e.name}`, sx, sy - sz - 48);
    }

    this.drawMiniBar(ctx, sx, sy - sz - 38, e.isMiniBoss ? 44 : 30, Math.max(0, e.hp / e.maxHp), e.isMiniBoss ? '#f59e0b' : '#ef4444');
  }

  // ── Боссы VEXMORA: индивидуальные спрайты, фазовая аура, щит и луч прицеливания ──
  drawBoss(ctx, b, engine, camX, camY) {
    const sx = Math.round(b.x - camX);
    const sy = Math.round(b.y - camY);
    const sz = Math.round(b.z || 0);

    if (b.aiming && engine && engine.player) {
      ctx.save();
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.moveTo(sx, sy - 26);
      ctx.lineTo(Math.round(engine.player.x - camX), Math.round(engine.player.y - camY - 10));
      ctx.stroke();
      ctx.restore();
    }

    if (b.phase >= 2) {
      ctx.strokeStyle = b.phase === 3 ? 'rgba(239, 68, 68, 0.85)' : 'rgba(249, 115, 22, 0.6)';
      ctx.lineWidth = b.phase === 3 ? 4 : 3;
      ctx.beginPath();
      ctx.arc(sx, sy - 20, b.radius + 12 + Math.sin(b.animTime * 2) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (b.shieldTimer > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy - 26, b.radius + 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('🛡️ СИЛОВОЙ ЩИТ', sx, sy - sz - 92);
      ctx.restore();
    }

    let frame = Math.floor(b.animTime) % 4;
    if (b.hitFlash > 0) frame = 5;
    else if (b.actionTimer < 0.6 || b.dashActive > 0 || b.aiming) frame = 4;

    const key = b.sprite;
    if (this.imgReady(key)) {
      const img = this.images[key];
      const fw = Math.floor(img.naturalWidth / 6);
      const fh = img.naturalHeight;
      const dw = Math.round(fw * PIXEL_SCALE * 1.08);
      const dh = Math.round(fh * PIXEL_SCALE * 1.08);
      ctx.save();
      ctx.translate(sx, sy - sz);
      ctx.drawImage(img, frame * fw, 0, fw, fh, Math.round(-dw * 0.5), Math.round(-dh * 0.86), dw, dh);
      ctx.restore();
    } else if (this.imgReady('boss_sheet')) {
      const img = this.images.boss_sheet;
      ctx.drawImage(img, frame * 48, 0, 48, 48, Math.round(sx - 48), Math.round(sy - sz - 84), 97, 97);
    }

    this.drawMiniBar(ctx, sx, sy - sz - 76, 68, Math.max(0, b.hp / b.maxHp), '#f43f5e');
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fda4af';
    ctx.fillText(`☠️ ${b.name} · Фаза ${b.phase}`, sx, sy - sz - 84);
  }

  // Красные зоны предупреждения боссов/артиллерии: успей выйти или прыгнуть!
  drawTelegraphs(ctx, telegraphs, camX, camY) {
    for (const t of telegraphs) {
      const sx = Math.round(t.x - camX);
      const sy = Math.round(t.y - camY);
      const pulse = 0.55 + Math.sin(performance.now() * 0.02) * 0.2;
      const remain = Math.max(0, t.timer / (t.maxTimer || 1));
      ctx.save();
      ctx.fillStyle = `rgba(239, 68, 68, ${0.20 + pulse * 0.14})`;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(sx, sy, t.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(254, 226, 226, 0.9)';
      ctx.beginPath(); ctx.arc(sx, sy, t.radius * remain, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#fecaca';
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚠', sx, sy + 5);
      ctx.restore();
    }
  }

  // Клетка пленника, терминал сигнализации и сам выживший
  drawRescueSite(ctx, site, engine, camX, camY) {
    const p = engine.player;
    const cageX = Math.round(site.x - camX);
    const cageY = Math.round(site.y - camY);
    const isCageType = site.def.type === 'cage' || site.def.type === 'timed';
    if (isCageType) {
      const cageKey = site.state === 'ready_claim' ? 'prp_cage_open' : 'prp_cage';
      if (this.imgReady(cageKey)) {
        const img = this.images[cageKey];
        const dw = Math.round(img.naturalWidth * PIXEL_SCALE);
        const dh = Math.round(img.naturalHeight * PIXEL_SCALE);
        ctx.drawImage(img, Math.round(cageX - dw * 0.5), Math.round(cageY - dh * 0.8), dw, dh);
      }
      if (site.def.hasAlarm) {
        const ax = Math.round(site.x + 58 - camX);
        const ay = Math.round(site.y - 12 - camY);
        if (this.imgReady('prp_alarm_terminal')) {
          const img = this.images.prp_alarm_terminal;
          const dw = Math.round(img.naturalWidth * PIXEL_SCALE * 0.9);
          const dh = Math.round(img.naturalHeight * PIXEL_SCALE * 0.9);
          ctx.drawImage(img, Math.round(ax - dw * 0.5), Math.round(ay - dh * 0.8), dw, dh);
        }
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = site.alarmDisabled ? '#4ade80' : '#f87171';
        ctx.fillText(site.alarmDisabled ? '🔌 ТРЕВОГА ВЫКЛ' : '🚨 СИГНАЛИЗАЦИЯ', ax, ay - 34);
      }
    }

    // Сам выживший (спрайт NPC, покачивание)
    const nx = Math.round(site.npcX - camX);
    const ny = Math.round(site.npcY - camY);
    const key = site.def.sprite;
    if (this.imgReady(key)) {
      const frame = Math.floor(site.animTime * 2) % 2;
      const dw = Math.round(32 * PIXEL_SCALE);
      const dh = Math.round(32 * PIXEL_SCALE);
      ctx.drawImage(this.images[key], frame * 32, 0, 32, 32, Math.round(nx - dw * 0.5), Math.round(ny - dh * 0.88), dw, dh);
    }
    const near = dist2(p.x, p.y, site.x, site.y) < 640 * 640;
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fde047';
    let label = `🆘 ${site.def.name}`;
    if (site.state === 'timed_active') label = `⏱️ ${Math.max(0, Math.ceil(site.timer))}с · ${site.def.name}`;
    else if (site.state === 'defending') label = `🩹 Волна ${site.wave}/${site.def.waves || 2} · ${site.def.name}`;
    else if (site.state === 'ready_claim') label = `🎉 СПАСТИ: ${site.def.name}`;
    else if (site.state === 'escorting') label = `🛡️ Веди в Убежище: ${site.def.name}`;
    if (near || site.activated) ctx.fillText(label, nx, ny - 44);
    if (site.state === 'defending' || site.state === 'escorting') {
      this.drawMiniBar(ctx, nx, ny - 40, 36, Math.max(0, site.npcHp / site.maxNpcHp), '#4ade80');
    }
  }

  drawModCache(ctx, cache, engine, camX, camY) {
    const sx = Math.round(cache.x - camX);
    const sy = Math.round(cache.y - camY);
    if (this.imgReady('prp_mod_crate')) {
      const img = this.images.prp_mod_crate;
      const dw = Math.round(img.naturalWidth * PIXEL_SCALE * 1.25);
      const dh = Math.round(img.naturalHeight * PIXEL_SCALE * 1.25);
      ctx.drawImage(img, Math.round(sx - dw * 0.5), Math.round(sy - dh * 0.8), dw, dh);
    }
    const bob = Math.round(Math.sin(engine.stats.playTime * 4) * 3);
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#c084fc';
    ctx.fillText(`📦 МОДУЛЬ: ${WEAPON_MODS[cache.modId]?.name || 'Спецконтейнер'}`, sx, sy - 38 + bob);
  }

  drawCompanion(ctx, c, engine, camX, camY) {
    const sx = Math.round(c.x - camX);
    const sy = Math.round(c.y - camY);
    if (this.imgReady('npc_fighter')) {
      const frame = Math.floor(c.animTime) % 2;
      const dw = Math.round(32 * PIXEL_SCALE);
      const dh = Math.round(32 * PIXEL_SCALE);
      ctx.drawImage(this.images.npc_fighter, frame * 32, 0, 32, 32, Math.round(sx - dw * 0.5), Math.round(sy - dh * 0.88), dw, dh);
    }
    this.drawMiniBar(ctx, sx, sy - 40, 34, Math.max(0, c.hp / c.maxHp), '#4ade80');
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#86efac';
    ctx.fillText('🤝 Сержант Шрам', sx, sy - 48);
  }

  drawContractNpc(ctx, n, engine, camX, camY) {
    const sx = Math.round(n.x - camX);
    const sy = Math.round(n.y - camY);
    const key = n.kind === 'captive' ? 'npc_prisoner' : 'npc_fighter';
    if (n.kind === 'captive' && this.imgReady('prp_cage')) {
      const img = this.images.prp_cage;
      const dw = Math.round(img.naturalWidth * PIXEL_SCALE);
      const dh = Math.round(img.naturalHeight * PIXEL_SCALE);
      ctx.drawImage(img, Math.round(sx - dw * 0.5), Math.round(sy - dh * 0.8), dw, dh);
    }
    if (this.imgReady(key)) {
      const frame = Math.floor((n.animTime || 0) * 2) % 2;
      const dw = Math.round(32 * PIXEL_SCALE);
      const dh = Math.round(32 * PIXEL_SCALE);
      ctx.drawImage(this.images[key], frame * 32, 0, 32, 32, Math.round(sx - dw * 0.5), Math.round(sy - dh * 0.88), dw, dh);
    }
    this.drawMiniBar(ctx, sx, sy - 40, 34, Math.max(0, (n.hp || 100) / (n.maxHp || 100)), '#4ade80');
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fde047';
    ctx.fillText(n.kind === 'captive' ? `🗝️ ${n.name}` : `🛡️ ${n.name} — веди в Убежище`, sx, sy - 48);
  }

  // ── Главный герой (hero_sheet.png: 4 направления ходьбы, бег, прыжок, атака, урон + оружие в руках!) ──
  drawPlayer(ctx, p, engine, camX, camY) {
    const sx = Math.round(p.x - camX);
    const sy = Math.round(p.y - camY);
    const sz = Math.round(p.z || 0);

    // Динамическая тень при прыжке
    if (sz > 2) {
      const shScale = Math.max(0.45, 1 - sz / 130);
      ctx.fillStyle = 'rgba(0,0,0,0.34)';
      ctx.beginPath();
      ctx.ellipse(sx, sy, Math.round(13 * shScale), Math.round(6 * shScale), 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Аура энергощита от зелья или навыка Спецзаряд
    if (p.shieldBuffTimer > 0) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy - sz - 18, 24, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Определяем строку и кадр в hero_sheet.png (4 колонки × 6 строк по 32x32)
    let row = 0;
    let col = 0;
    let flipLeft = false;

    const dirRowMap = { down: 0, up: 1, right: 2, left: 3 };
    if (p.animState === 'hurt') {
      row = 5; col = 3;
      flipLeft = p.facingDir === 'left';
    } else if (p.animState === 'jump') {
      row = 5; col = p.vz > 0 ? 0 : 1;
      flipLeft = p.facingDir === 'left';
    } else if (p.animState === 'attack') {
      row = 5; col = 2;
      flipLeft = Math.cos(p.facing) < 0;
    } else if (p.animState === 'run') {
      row = 4; col = Math.floor(p.animTime) % 4;
      flipLeft = p.facingDir === 'left' || (p.facingDir !== 'right' && p.vx < -5);
    } else if (p.animState === 'walk') {
      row = dirRowMap[p.facingDir] ?? 0;
      col = Math.floor(p.animTime) % 4;
    } else {
      row = dirRowMap[p.facingDir] ?? 0;
      col = 0;
    }

    // Если смотрим вверх, рисуем оружие за персонажем; иначе перед ним
    const drawWeaponBehind = p.facingDir === 'up' && p.animState !== 'attack';
    if (drawWeaponBehind) {
      this.drawEquippedWeapon(ctx, p, engine, sx, sy - sz - 16);
    }

    // Рюкзак за спиной при виде сбоку/вверх, если улучшен Рюкзак
    if ((engine.inventory.backpackLevel || 0) > 0 && p.facingDir === 'up' && this.imgReady('itm_backpack')) {
      ctx.drawImage(this.images.itm_backpack, sx - 10, sy - sz - 28, 20, 20);
    }

    if (this.imgReady('hero_sheet')) {
      const dw = Math.round(32 * PIXEL_SCALE);
      const dh = Math.round(32 * PIXEL_SCALE);
      ctx.save();
      ctx.translate(sx, sy - sz);
      if (flipLeft) ctx.scale(-1, 1);
      ctx.drawImage(this.images.hero_sheet, col * 32, row * 32, 32, 32, Math.round(-dw * 0.5), Math.round(-dh * 0.88), dw, dh);
      ctx.restore();
    }

    if (!drawWeaponBehind) {
      this.drawEquippedWeapon(ctx, p, engine, sx, sy - sz - 15);
    }
  }

  // Отдельный прозрачный PNG текущего оружия прямо в руках героя!
  drawEquippedWeapon(ctx, p, engine, wx, wy) {
    const wId = engine.inventory.equippedWeapon;
    const key = `wpn_${wId}`;
    if (!this.imgReady(key)) return;
    const img = this.images[key];
    const angle = p.facing;
    const facingLeft = Math.cos(angle) < 0;

    ctx.save();
    ctx.translate(Math.round(wx + Math.cos(angle) * 10), Math.round(wy + Math.sin(angle) * 6));
    if (facingLeft) {
      ctx.scale(1, -1);
      ctx.rotate(-angle);
    } else {
      ctx.rotate(angle);
    }
    const scale = 1.05;
    const dw = Math.round(img.naturalWidth * scale);
    const dh = Math.round(img.naturalHeight * scale);
    ctx.drawImage(img, -4, Math.round(-dh * 0.5), dw, dh);
    ctx.restore();
  }

  drawMiniBar(ctx, cx, cy, w, ratio, color) {
    const x = Math.round(cx - w * 0.5);
    const y = Math.round(cy);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x - 1, y - 1, w + 2, 6);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, ratio))), 4);
  }

  // ── Трофеи на земле (отдельные PNG предметов!) ───────────────────────
  drawDrops(ctx, drops, camX, camY, w, h) {
    const now = performance.now() * 0.005;
    for (const d of drops) {
      const sx = Math.round(d.x - camX);
      const sy = Math.round(d.y - camY + Math.sin(now + d.x) * 3);
      if (sx < -24 || sx > w + 24 || sy < -24 || sy > h + 24) continue;

      let key = null;
      if (d.kind === 'coin') key = 'itm_coin';
      else if (d.kind === 'ammo') key = 'itm_ammo';
      else if (d.kind === 'item') key = `itm_${d.itemId}`;

      if (key && this.imgReady(key)) {
        ctx.drawImage(this.images[key], sx - 12, sy - 12, 24, 24);
      } else {
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(sx - 6, sy - 6, 12, 12);
        const res = RESOURCES[d.resId];
        if (res) {
          ctx.font = '13px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(res.emoji, sx, sy + 5);
        }
      }
    }
  }

  drawThrownGrenades(ctx, grenades, camX, camY) {
    for (const g of grenades) {
      const sx = Math.round(g.x - camX);
      const sy = Math.round(g.y - camY);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(sx - 5, sy - 2, 10, 4);
      if (this.imgReady('itm_grenade')) {
        ctx.save();
        ctx.translate(sx, Math.round(sy - g.z));
        ctx.rotate(g.life * 16);
        ctx.drawImage(this.images.itm_grenade, -11, -11, 22, 22);
        ctx.restore();
      }
    }
  }

  drawSlashes(ctx, slashes, camX, camY) {
    for (const sl of slashes) {
      const alpha = sl.life / sl.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha * 0.8;
      ctx.strokeStyle = sl.color;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(Math.round(sl.x - camX), Math.round(sl.y - camY - 12), sl.range * 0.82, sl.angle - sl.arc * 0.45, sl.angle + sl.arc * 0.45);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawShockwaves(ctx, waves, camX, camY) {
    for (const sw of waves) {
      const alpha = 1 - sw.radius / sw.maxRadius;
      ctx.save();
      ctx.globalAlpha = Math.max(0.15, alpha);
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = sw.friendly ? 4 : 6;
      ctx.beginPath();
      ctx.arc(Math.round(sw.x - camX), Math.round(sw.y - camY), Math.round(sw.radius), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawProjectiles(ctx, projectiles, camX, camY) {
    for (const pr of projectiles) {
      const sx = Math.round(pr.x - camX);
      const sy = Math.round(pr.y - camY);
      if (pr.kind === 'bullet') {
        const ang = Math.atan2(pr.vy, pr.vx);
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(ang);
        ctx.fillStyle = '#181c24';
        ctx.fillRect(-7, -3, 14, 6);
        ctx.fillStyle = pr.color;
        ctx.fillRect(-6, -2, 12, 4);
        ctx.restore();
      } else if (pr.kind === 'arrow') {
        const ang = Math.atan2(pr.vy, pr.vx);
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(ang);
        ctx.fillStyle = '#d6a15c';
        ctx.fillRect(-9, -1, 16, 3);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(5, -3, 5, 6);
        ctx.restore();
      } else if (pr.kind === 'rocket' || pr.kind === 'grenade_shell' || pr.kind === 'enemy_grenade' || pr.kind === 'acid') {
        // Ракета / граната гранатомёта / вражеская граната / кислотный плевок
        ctx.fillStyle = '#181c24';
        ctx.fillRect(sx - 8, sy - 8, 16, 16);
        ctx.fillStyle = pr.color || '#f97316';
        ctx.fillRect(sx - 6, sy - 6, 12, 12);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx - 2, sy - 2, 4, 4);
        if (pr.kind === 'rocket') {
          ctx.fillStyle = '#fb923c';
          ctx.fillRect(sx - 13, sy - 3, 6, 6);
        }
      } else {
        // Сфера синей магии
        ctx.fillStyle = '#181c24';
        ctx.fillRect(sx - 7, sy - 7, 14, 14);
        ctx.fillStyle = pr.color;
        ctx.fillRect(sx - 5, sy - 5, 10, 10);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx - 2, sy - 2, 4, 4);
      }
    }
  }

  // ── Отрисовка 6 пиксельных спрайт-листов эффектов ────────────────────
  drawSpriteEffects(ctx, spriteEffects, camX, camY) {
    for (const fx of spriteEffects) {
      const key = `fx_${fx.kind}`;
      if (!this.imgReady(key)) continue;
      const img = this.images[key];
      const fw = Math.floor(img.naturalWidth / fx.totalFrames);
      const fh = img.naturalHeight;
      const dw = Math.round(fw * PIXEL_SCALE * fx.scale);
      const dh = Math.round(fh * PIXEL_SCALE * fx.scale);
      const sx = Math.round(fx.x - camX - dw * 0.5);
      const sy = Math.round(fx.y - camY - dh * 0.5);
      ctx.drawImage(img, fx.frame * fw, 0, fw, fh, sx, sy, dw, dh);
    }
  }

  drawParticles(ctx, particles, camX, camY) {
    for (const pt of particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      const s = Math.max(2, Math.round(pt.size));
      ctx.fillRect(Math.round(pt.x - camX), Math.round(pt.y - camY), s, s);
    }
    ctx.globalAlpha = 1;
  }

  drawFloatingTexts(ctx, texts, camX, camY) {
    ctx.textAlign = 'center';
    for (const ft of texts) {
      const sx = Math.round(ft.x - camX);
      const sy = Math.round(ft.y - camY);
      ctx.font = ft.big ? 'bold 15px monospace' : 'bold 12px monospace';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(ft.text, sx + 1, sy + 1);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, sx, sy);
    }
  }

  // ── Атмосферная Ночь (с освещением вокруг героя и костров) ───────────
  drawDayNightLighting(ctx, engine, camX, camY, w, h) {
    const t = engine.timeOfDay;
    const darkness = Math.max(0, (Math.cos(t * Math.PI * 2) + 0.18) * 0.42);
    if (darkness <= 0.03) return;

    ctx.save();
    const px = Math.round(engine.player.x - camX);
    const py = Math.round(engine.player.y - camY - 12);
    const grad = ctx.createRadialGradient(px, py, 65, px, py, Math.max(w, h) * 0.62);
    grad.addColorStop(0, `rgba(12, 20, 44, ${darkness * 0.16})`);
    grad.addColorStop(1, `rgba(7, 11, 26, ${darkness})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    if (engine.settings.quality !== 'low') {
      for (const c of CAMPFIRES) {
        if (!engine.unlockedCamps.includes(c.id)) continue;
        const cx = Math.round(c.x - camX);
        const cy = Math.round(c.y - camY);
        if (cx < -160 || cx > w + 160 || cy < -160 || cy > h + 160) continue;
        const cg = ctx.createRadialGradient(cx, cy, 8, cx, cy, 130);
        cg.addColorStop(0, 'rgba(251, 146, 60, 0.26)');
        cg.addColorStop(1, 'rgba(251, 146, 60, 0)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(cx, cy, 130, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawQuestPointer(ctx, engine, w, h) {
    const target = engine.getObjectiveTarget ? engine.getObjectiveTarget() : null;
    const q = target ? null : engine.getActiveQuest();
    const targetPos = target || q?.targetPos;
    if (!targetPos) return;
    const dx = targetPos.x - engine.player.x;
    const dy = targetPos.y - engine.player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 220) return;

    const ang = Math.atan2(dy, dx);
    const r = Math.min(w, h) * 0.34;
    const cx = Math.round(w * 0.5 + Math.cos(ang) * r);
    const cy = Math.round(h * 0.5 + Math.sin(ang) * r);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.fillStyle = '#fbbf24';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.lineTo(-8, -7);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-8, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fde68a';
    ctx.fillText(`${Math.round(dist / 10)} м`, cx, cy + 18);
  }

  // ── Мини-карта и Полноэкранная Карта Зоны ────────────────────────────
  // ── RISE OF THE ABYSS: ловушки, сундуки, телеграфы, кинематография ────
  drawTrap(ctx, trap, engine, camX, camY) {
    const key = `prp_${trap.kind}`;
    const sx = Math.round(trap.x - camX);
    const sy = Math.round(trap.y - camY);
    if (this.imgReady(key)) {
      const img = this.images[key];
      const flicker = trap.kind === 'trap_fire' ? 1 + 0.08 * Math.sin(engine.elapsed * 12 + trap.x) : 1;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(flicker, flicker);
      ctx.drawImage(img, -28, -28, 56, 56);
      ctx.restore();
    } else {
      ctx.fillStyle = trap.kind === 'trap_fire' ? '#f97316' : trap.kind === 'trap_poison' ? '#84cc16' : '#9ca3af';
      ctx.fillRect(sx - 24, sy - 8, 48, 16);
    }
  }

  drawChest(ctx, chest, engine, camX, camY) {
    const sx = Math.round(chest.x - camX);
    const sy = Math.round(chest.y - camY);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 14, 22, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    const key = chest.cursed ? 'prp_cursed_chest' : 'prp_chest';
    if (this.imgReady(key)) {
      const img = this.images[key];
      ctx.drawImage(img, sx - 23, sy - 30, 46, 40);
    } else {
      ctx.fillStyle = chest.cursed ? '#7c3aed' : '#b45309';
      ctx.fillRect(sx - 18, sy - 24, 36, 26);
    }
    ctx.save();
    ctx.font = 'bold 15px Arial';
    ctx.textAlign = 'center';
    if (chest.cursed) {
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 8 + 4 * Math.sin(engine.elapsed * 5);
      ctx.fillText('💀', sx, sy - 38);
    } else if (Math.sin(engine.elapsed * 3 + chest.x) > 0.75) {
      ctx.fillText('✨', sx, sy - 36);
    }
    ctx.restore();
  }

  drawBossTelegraphCircles(ctx, engine, camX, camY) {
    const now = engine.elapsed;
    for (const b of engine.bossEntities) {
      if (b.telegraphCircle && now < b.telegraphCircle.until) {
        const tc = b.telegraphCircle;
        const blink = 0.35 + 0.3 * Math.sin(now * 18);
        ctx.beginPath();
        ctx.arc(Math.round(tc.x - camX), Math.round(tc.y - camY), tc.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(239, 68, 68, ${blink * 0.35})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(239, 68, 68, ${Math.min(1, blink + 0.25)})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      if (b.slamTarget) {
        const blink = 0.4 + 0.3 * Math.sin(now * 20);
        ctx.beginPath();
        ctx.arc(Math.round(b.slamTarget.x - camX), Math.round(b.slamTarget.y - camY), 60, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245, 158, 11, ${blink * 0.3})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(245, 158, 11, ${Math.min(1, blink + 0.2)})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
  }

  // Кинематографичное интро босса (леттербокс + имя + атмосферная фраза) и баннер локации
  drawCinematicOverlay(ctx, engine, w, h) {
    const now = performance.now() / 1000;
    if (engine.bossIntro && now < engine.bossIntro.until) {
      const bi = engine.bossIntro;
      const remain = bi.until - now;
      const alpha = Math.max(0, Math.min(1, remain / 0.6));
      ctx.save();
      ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
      ctx.fillRect(0, 0, w, Math.round(h * 0.16));
      ctx.fillRect(0, Math.round(h * 0.84), w, Math.round(h * 0.16));
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#dc2626';
      ctx.fillStyle = '#fca5a5';
      ctx.font = `bold ${Math.max(22, Math.round(w * 0.038))}px "Segoe UI", Arial, sans-serif`;
      ctx.fillText(`💀 ${bi.name}`, w / 2, h * 0.5 - 12);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#e2e8f0';
      ctx.font = `italic ${Math.max(13, Math.round(w * 0.02))}px "Segoe UI", Arial, sans-serif`;
      ctx.fillText(`«${bi.text}»`, w / 2, h * 0.5 + 22);
      ctx.restore();
    } else if (engine.locationBanner && now < engine.locationBanner.until) {
      const lb = engine.locationBanner;
      const alpha = Math.max(0, Math.min(1, (lb.until - now) / 0.8));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#fde68a';
      ctx.font = `bold ${Math.max(20, Math.round(w * 0.032))}px "Segoe UI", Arial, sans-serif`;
      ctx.fillText(`🗺️ ${lb.name}`, w / 2, Math.round(h * 0.22));
      ctx.fillStyle = '#e2e8f0';
      ctx.font = `${Math.max(12, Math.round(w * 0.018))}px "Segoe UI", Arial, sans-serif`;
      ctx.fillText(lb.desc, w / 2, Math.round(h * 0.22) + 26);
      ctx.restore();
    }
  }

  renderMinimap(engine) {
    const ctx = this.mmCtx;
    const mw = this.minimapCanvas.width;
    const mh = this.minimapCanvas.height;
    const sx = mw / engine.world.width;
    const sy = mh / engine.world.height;

    ctx.fillStyle = '#3a6636';
    ctx.fillRect(0, 0, mw, mh);

    ctx.fillStyle = '#cfdbe8'; // Снежные Горы (СВ)
    ctx.fillRect(mw * 0.5, 0, mw * 0.5, mh * 0.32);

    ctx.fillStyle = '#333945'; // Город (Восток)
    ctx.fillRect(mw * 0.61, mh * 0.32, mw * 0.39, mh * 0.38);

    ctx.fillStyle = '#cfa26b'; // Пустыня и Завод (ЮЗ)
    ctx.fillRect(0, mh * 0.65, mw * 0.54, mh * 0.35);

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    for (const r of engine.world.roads) {
      ctx.beginPath();
      ctx.moveTo(r.x1 * sx, r.y1 * sy);
      ctx.lineTo(r.x2 * sx, r.y2 * sy);
      ctx.stroke();
    }

    // Здания на мини-карте
    ctx.fillStyle = '#cbd5e1';
    for (const bld of engine.world.buildings) {
      ctx.fillRect(bld.x * sx - 1.5, bld.y * sy - 1.5, 3, 3);
    }

    // Костры
    for (const c of CAMPFIRES) {
      ctx.fillStyle = engine.unlockedCamps.includes(c.id) ? '#fb923c' : '#64748b';
      ctx.fillRect(c.x * sx - 2, c.y * sy - 2, 4, 4);
    }

    // Боссы
    ctx.fillStyle = '#ef4444';
    for (const b of engine.bossEntities) {
      ctx.fillRect(b.x * sx - 2.5, b.y * sy - 2.5, 5, 5);
    }

    // Точки спасения (зелёные) и спецконтейнеры (фиолетовые)
    ctx.fillStyle = '#4ade80';
    for (const site of engine.rescueSites || []) {
      if (site.state === 'done') continue;
      ctx.fillRect(site.x * sx - 2, site.y * sy - 2, 4, 4);
    }
    ctx.fillStyle = '#c084fc';
    for (const cache of engine.world.modCaches || []) {
      if (cache.looted) continue;
      ctx.fillRect(cache.x * sx - 2, cache.y * sy - 2, 4, 4);
    }
    // Цель спецоперации
    if (engine.activeContract) {
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(engine.activeContract.x * sx - 3.5, engine.activeContract.y * sy - 3.5, 7, 7);
    }

    // Цель квеста / спасения / спецоперации
    const objT = engine.getObjectiveTarget ? engine.getObjectiveTarget() : null;
    const q = objT ? null : engine.getActiveQuest();
    const targetP = objT || q?.targetPos;
    if (targetP) {
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(targetP.x * sx - 3, targetP.y * sy - 3, 6, 6);
    }

    // Герой
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(engine.player.x * sx - 2.5, engine.player.y * sy - 2.5, 5, 5);
  }
}
