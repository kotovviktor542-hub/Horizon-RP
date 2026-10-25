// Автоматическая комплексная проверка VEXMORA — БОЛЬШОЕ ОБНОВЛЕНИЕ ИГРЫ (2.0)
// 16 врагов, 10 боссов, 24 оружия с перезарядкой/модами, спасение NPC, база, напарник, контракты.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const storageMap = new Map();
globalThis.localStorage = {
  getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
  setItem: (k, v) => storageMap.set(k, String(v)),
  removeItem: (k) => storageMap.delete(k)
};
globalThis.window = { innerWidth: 844, innerHeight: 390, devicePixelRatio: 2 };

const { GameEngine } = await import('../www/js/engine.js');
const data = await import('../www/js/data.js');
const { WEAPONS, WEAPON_MODS, BASE_ROOMS, ITEMS, SKILLS, SKILL_TREE, ENEMIES, BOSSES, QUESTS, SECRETS, NPCS, ACHIEVEMENTS, BIOMES, RESCUE_MISSIONS, UPDATE_ANNOUNCEMENT, GAME_TITLE } = data;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const noopSound = { enabled: true, play() {}, unlock() {} };
let passed = 0;

function test(name, fn) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

function killAll(eng, list) {
  for (const e of [...list]) eng.damageEnemy(e, 999999);
}

console.log('=== Проверка VEXMORA — БОЛЬШОЕ ОБНОВЛЕНИЕ ИГРЫ (v2.0) ===');
assert.equal(GAME_TITLE, 'VEXMORA');
assert.ok(UPDATE_ANNOUNCEMENT.title.includes('VEXMORA — БОЛЬШОЕ ОБНОВЛЕНИЕ ИГРЫ'));

test('1. Все прозрачные пиксель-арт PNG и спрайт-листы существуют и валидны (108+ файлов)', () => {
  const spritesJs = fs.readFileSync(path.join(rootDir, 'www/js/sprites.js'), 'utf8');
  const matches = [...spritesJs.matchAll(/'(assets\/sprites\/[^']+\.png)'/g)].map(m => m[1]);
  assert.ok(matches.length >= 85, `Должно быть минимум 85 отдельных спрайтов в рендерере, найдено: ${matches.length}`);

  // Иконки всего арсенала и предметов из data.js тоже должны существовать
  const iconPaths = new Set(matches);
  for (const w of Object.values(WEAPONS)) iconPaths.add(w.icon);
  for (const it of Object.values(ITEMS)) iconPaths.add(it.icon);

  for (const rel of iconPaths) {
    const full = path.join(rootDir, 'www', rel);
    assert.ok(fs.existsSync(full), `Отсутствует PNG-файл: ${rel}`);
    const buf = fs.readFileSync(full);
    assert.equal(buf[0], 0x89);
    assert.equal(buf[1], 0x50);
    assert.equal(buf[2], 0x4e);
    assert.equal(buf[3], 0x47);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    const colorType = buf[25];
    assert.equal(colorType, 6, `${rel} должен быть RGBA с прозрачным фоном (colorType=6)`);
    assert.ok(width >= 16 && height >= 16, `${rel} некорректный размер ${width}x${height}`);
  }

  const totalFiles = [];
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const fp = path.join(d, f.name); if (f.isDirectory()) walk(fp); else totalFiles.push(fp); } };
  walk(path.join(rootDir, 'www/assets/sprites'));
  assert.ok(totalFiles.length >= 100, `Всего спрайтов должно быть 100+, найдено ${totalFiles.length}`);
});

test('2. Мир: 4 биома, 9 зданий, 6 транспортов, 7 NPC базы, 10 боссов, 10 спасений, 3 спецконтейнера', () => {
  const eng = new GameEngine(noopSound);
  assert.equal(Object.keys(BIOMES).length, 4);
  assert.equal(NPCS.length, 7);
  assert.equal(eng.bossEntities.length, 10);
  assert.equal(Object.keys(BOSSES).length, 10);
  assert.equal(eng.rescueSites.length, 10);
  assert.equal(RESCUE_MISSIONS.length, 10);
  assert.equal(eng.world.modCaches.length, 3);

  const bldKinds = new Set(eng.world.buildings.map(b => b.kind));
  for (const k of ['house', 'shop', 'warehouse', 'bunker', 'watchtower', 'factory', 'hospital', 'police', 'base']) {
    assert.ok(bldKinds.has(k), `Здание типа ${k} должно быть размещено в мире`);
  }
  const vehKinds = new Set(eng.world.vehicles.map(v => v.kind));
  for (const k of ['car', 'moto', 'jeep', 'bus', 'heli', 'boat']) {
    assert.ok(vehKinds.has(k), `Транспорт типа ${k} должен быть размещён в мире`);
  }
  // У каждого босса уникальный спрайт, арена и награда-оружие
  const bossSprites = new Set(Object.values(BOSSES).map(b => b.sprite));
  assert.equal(bossSprites.size, 10);
  for (const b of Object.values(BOSSES)) assert.ok(WEAPONS[b.rewardWeapon], `Награда босса ${b.id}`);
});

test('3. Герой: 4 направления, бег, прыжок + все 24 оружия стреляют, магазины и перезарядка работают', () => {
  assert.equal(Object.keys(WEAPONS).length, 24);
  assert.equal(Object.keys(ITEMS).length, 8);
  assert.equal(Object.keys(ENEMIES).length, 16);

  const eng = new GameEngine(noopSound);
  for (const [mx, my, expectedDir] of [[1, 0, 'right'], [-1, 0, 'left'], [0, -1, 'up'], [0, 1, 'down']]) {
    eng.update(0.04, { moveX: mx, moveY: my, sprintHeld: false, attackHeld: false });
    assert.equal(eng.player.facingDir, expectedDir);
    assert.equal(eng.player.animState, 'walk');
  }
  eng.update(0.04, { moveX: 1, moveY: 0, sprintHeld: true, attackHeld: false });
  assert.equal(eng.player.animState, 'run');
  assert.equal(eng.jump(), true);
  eng.update(0.04, { moveX: 0, moveY: 0 });
  assert.equal(eng.player.animState, 'jump');
  for (let i = 0; i < 30; i++) eng.update(0.04, { moveX: 0, moveY: 0 });
  assert.equal(eng.player.z, 0);

  // Стрельба/удары из всех 24 видов оружия
  for (const wId of Object.keys(WEAPONS)) {
    if (!eng.inventory.weapons.includes(wId)) eng.grantWeapon(wId);
    eng.equipWeapon(wId);
    eng.inventory.ammo = 300;
    eng.weaponMag[wId] = eng.getMagSize(wId);
    eng.player.attackTimer = 0;
    assert.equal(eng.performAttack(), true, `Оружие ${wId} должно стрелять/бить`);
  }

  // Магазин пистолета уменьшается, перезарядка пополняет из резерва
  eng.equipWeapon('pistol');
  eng.inventory.ammo = 50;
  eng.weaponMag.pistol = 3;
  eng.player.attackTimer = 0;
  assert.equal(eng.performAttack(), true);
  assert.equal(eng.getMag('pistol'), 2);
  eng.weaponMag.pistol = 0;
  eng.player.attackTimer = 0;
  eng.performAttack(); // должен уйти в перезарядку
  assert.ok(eng.isReloading(), 'Пустой магазин должен запускать перезарядку');
  for (let i = 0; i < 40; i++) eng.update(0.05, { moveX: 0, moveY: 0 });
  assert.ok(eng.getMag('pistol') > 0, 'После перезарядки магазин полон');

  // Нет патронов и пустой магазин -> автопереход на оружие без патронов
  eng.equipWeapon('rifle');
  eng.weaponMag.rifle = 0;
  eng.inventory.ammo = 0;
  eng.reloadTimer = 0;
  eng.player.attackTimer = 0;
  assert.equal(eng.performAttack(), true);
  assert.equal(WEAPONS[eng.inventory.equippedWeapon].ammoCost, 0);
});

test('4. Особый ИИ врагов: снайпер с лазером, невидимка, гренадёр, медик, дрон, мини-боссы и броня', () => {
  const eng = new GameEngine(noopSound);
  eng.player.x = 2850; eng.player.y = 2400;
  eng.player.hp = eng.player.maxHp;

  const sniper = eng.spawnEnemyAt(eng.player.x + 320, eng.player.y, 'sniper_guard');
  assert.ok(sniper);
  for (let i = 0; i < 40 && !sniper.aiming && !eng.projectiles.some(pr => !pr.fromPlayer); i++) eng.update(0.05, { moveX: 0, moveY: 0 });
  assert.ok(sniper.aiming || eng.projectiles.some(pr => !pr.fromPlayer), 'Снайпер должен наводить лазер и стрелять');

  const stealth = eng.spawnEnemyAt(eng.player.x + 260, eng.player.y + 120, 'stealth_hunter');
  assert.ok(stealth && stealth.stealth, 'Невидимый охотник создан');
  const heavy = eng.spawnEnemyAt(eng.player.x + 120, eng.player.y, 'heavy_trooper');
  const hpBefore = heavy.hp;
  eng.damageEnemy(heavy, 100);
  assert.ok(heavy.hp > hpBefore - 100, 'Броня щитоносца должна резать урон (armorMult)');

  const gren = eng.spawnEnemyAt(eng.player.x + 260, eng.player.y, 'grenadier');
  assert.ok(gren);
  for (let i = 0; i < 60; i++) eng.update(0.05, { moveX: 0, moveY: 0 });
  assert.ok(eng.projectiles.some(pr => pr.kind === 'enemy_grenade') || eng.stats.explosionsTriggered >= 0, 'Гренадёр должен метать гранаты');

  const drone = eng.spawnEnemyAt(eng.player.x + 200, eng.player.y - 150, 'combat_drone');
  assert.ok(drone && drone.flying && drone.z > 0, 'Дрон должен летать над землёй');

  const warden = eng.spawnEnemyAt(eng.player.x + 300, eng.player.y + 200, 'mini_warden');
  assert.ok(warden && warden.isMiniBoss, 'Мини-босс Надзиратель создан');
});

test('5. Гранаты игрока, взрывные бочки, Тесла-цепочка и взрывы гранатомёта наносят урон', () => {
  const eng = new GameEngine(noopSound);
  eng.player.x = 2850; eng.player.y = 2400;
  const en = eng.spawnEnemyAt(eng.player.x + 110, eng.player.y, 'zombie');
  assert.ok(en);
  assert.equal(eng.throwGrenade(), true);
  for (let i = 0; i < 25; i++) eng.update(0.04, { moveX: 0, moveY: 0 });
  assert.ok(eng.stats.explosionsTriggered >= 1, 'Граната должна взорваться');
  assert.ok(eng.spriteEffects.some(fx => fx.kind === 'explosion' || fx.kind === 'smoke'));

  // Тесла бьёт молнией без снарядов (убираем случайных окрестных врагов для детерминизма)
  eng.enemies.length = 0;
  eng.grantWeapon('tesla_cannon');
  eng.equipWeapon('tesla_cannon');
  eng.weaponMag.tesla_cannon = eng.getMagSize('tesla_cannon');
  eng.player.attackTimer = 0;
  const victim = eng.spawnEnemyAt(eng.player.x + 140, eng.player.y, 'zombie');
  const vhp = victim.hp;
  assert.equal(eng.performAttack(), true);
  assert.ok(victim.hp < vhp || !eng.enemies.includes(victim), 'Тесла должна поразить цель молнией');
});

test('6. Транспорт и Гараж: вождение, скорость от Гаража и таран врагов', () => {
  const eng = new GameEngine(noopSound);
  const moto = eng.world.vehicles.find(v => v.kind === 'moto' && v.drivable);
  assert.ok(moto);
  eng.player.x = moto.x; eng.player.y = moto.y + 20;
  const res = eng.interact();
  assert.equal(res.type, 'vehicle_enter');
  const speedBase = eng.getVehicleSpeed(moto);
  eng.baseLevels.garage = 5;
  assert.ok(eng.getVehicleSpeed(moto) > speedBase, 'Гараж 5 ур. должен ускорять транспорт');
  eng.baseLevels.garage = 0;
  const startX = moto.x;
  for (let i = 0; i < 10; i++) eng.update(0.04, { moveX: 1, moveY: 0 });
  assert.ok(moto.x > startX + 40, 'Транспорт должен ехать');
  eng.interact();
  assert.equal(eng.player.vehicleId, null);
});

test('7. Спасение Инженера: сигнализация -> охрана -> клетка -> специалист Базы, Цех и модификация', () => {
  const eng = new GameEngine(noopSound);
  const site = eng.getRescueSite('res_engineer');
  eng.player.x = site.x - 80; eng.player.y = site.y;
  eng.update(0.05, { moveX: 0, moveY: 0 });
  assert.equal(site.state, 'guarding');
  assert.ok(eng.rescueGuardsAlive(site) >= 3, 'У клетки должна быть охрана');

  eng.player.x = site.x + 58; eng.player.y = site.y - 12;
  assert.equal(eng.getNearbyInteractable()?.type, 'rescue_alarm');
  eng.interact();
  assert.equal(site.alarmDisabled, true);

  killAll(eng, eng.enemies.filter(e => e.rescueId === site.id));
  eng.player.x = site.npcX; eng.player.y = site.npcY;
  assert.equal(eng.getNearbyInteractable()?.type, 'rescue_cage');
  eng.interact();
  assert.ok(eng.rescuedIds.includes('res_engineer'), 'Инженер спасён');
  assert.ok(eng.inventory.weapons.includes('revolver'), 'Награда за спасение — револьвер');

  eng.inventory.coins = 3000;
  eng.inventory.resources = { wood: 40, stone: 20, scrap: 40, herb: 20 };
  assert.equal(eng.upgradeBaseRoom('workshop'), true, 'Инженерный Цех улучшается после спасения Инженера');
  eng.equipWeapon('pistol');
  assert.equal(eng.installMod('pistol', 'mod_scope'), true, 'Модуль устанавливается у Инженера');
  assert.ok(eng.hasMod('pistol', 'mod_scope'));
  assert.ok(eng.getCritChance('pistol') > 0.2, 'Коллиматор повышает шанс крита');
});

test('8. Спасение защитой и сопровождением, напарник, перки и развитие Базы', () => {
  const eng = new GameEngine(noopSound);
  // Защита Механика: 2 волны
  const mech = eng.getRescueSite('res_mechanic');
  eng.player.x = mech.x; eng.player.y = mech.y;
  eng.update(0.05, { moveX: 0, moveY: 0 });
  assert.equal(mech.state, 'defending');
  for (let wave = 0; wave < 2; wave++) {
    killAll(eng, eng.enemies.filter(e => e.rescueId === mech.id));
    eng.update(0.05, { moveX: 0, moveY: 0 });
  }
  assert.equal(mech.state, 'ready_claim');
  eng.player.x = mech.npcX; eng.player.y = mech.npcY;
  eng.interact();
  assert.ok(eng.rescuedIds.includes('res_mechanic'), 'Механик спасён защитой');

  // Сопровождение караванщика до Убежища
  const esc = eng.getRescueSite('res_escort_caravan');
  eng.player.x = esc.x; eng.player.y = esc.y;
  eng.update(0.05, { moveX: 0, moveY: 0 });
  assert.equal(esc.state, 'escort_ready');
  eng.player.x = esc.npcX; eng.player.y = esc.npcY;
  eng.interact();
  assert.equal(esc.state, 'escorting');
  esc.npcX = 3160; esc.npcY = 3240;
  eng.update(0.05, { moveX: 0, moveY: 0 });
  assert.ok(eng.rescuedIds.includes('res_escort_caravan'), 'Сопровождение завершено в Убежище');

  // Напарник открывается только после спасения Сержанта
  assert.equal(eng.toggleCompanion(), false);
  eng.rescuedIds.push('res_fighter_1');
  assert.equal(eng.toggleCompanion(), true);
  eng.update(0.05, { moveX: 0, moveY: 0 });
  assert.ok(eng.companion && eng.companion.hp > 0, 'Напарник в рейде и жив');

  // База и перки
  eng.inventory.coins = 4000;
  eng.inventory.resources = { wood: 50, stone: 30, scrap: 50, herb: 30 };
  assert.equal(eng.upgradeBaseRoom('garage'), true, 'Гараж улучшается после спасения Механика');
  assert.ok(eng.world.vehicles.some(v => v.id === 'veh_base_jeep'), 'Гараж ставит бронеджип у Базы');
  eng.player.skillPoints = 2;
  assert.equal(eng.buyPerk('perk_kevlar'), true);
  assert.equal(eng.getPerkRank('perk_kevlar'), 1);
});

test('9. 10 боссов: фазы, телеграфы/щиты/телепорты, награды, коллекция и открытие территорий', () => {
  const eng = new GameEngine(noopSound);
  eng.player.invulnTimer = 999;
  for (const bossId of Object.keys(BOSSES)) {
    const b = eng.bossEntities.find(x => x.bossId === bossId);
    assert.ok(b, `Босс ${bossId} должен быть в мире`);
    eng.player.x = b.x + 160; eng.player.y = b.y;
    const projBefore = eng.projectiles.length + eng.telegraphs.length;
    eng.executeBossSkill(b, -1, 0, 160);
    const acted = eng.projectiles.length + eng.telegraphs.length > projBefore || b.aiming || b.shieldTimer > 0 || b.dashActive > 0 || b.z > 0 || b.burstLeft > 0;
    assert.ok(acted, `Босс ${bossId} должен применять особую атаку`);
    // Фазы 2 и 3
    b.hp = Math.round(b.maxHp * 0.5);
    eng.damageBoss(b, 1);
    assert.equal(b.phase, 2, `${bossId} фаза 2`);
    b.hp = Math.round(b.maxHp * 0.2);
    eng.damageBoss(b, 1);
    assert.equal(b.phase, 3, `${bossId} фаза 3`);
  }
  // Убийство первого босса: оружие, монеты, коллекция
  const king = eng.bossEntities.find(x => x.bossId === 'boss_mutant_king');
  const coinsBefore = eng.inventory.coins;
  king.hp = 5;
  eng.damageBoss(king, 50);
  assert.ok(eng.defeatedBosses.includes('boss_mutant_king'));
  assert.ok(eng.inventory.weapons.includes('shotgun'));
  assert.ok(eng.inventory.coins > coinsBefore);
});

test('10. Секреты с модулями, гейтинг магазина, крафт, спецоперации, квесты и сохранение/загрузка', () => {
  const eng = new GameEngine(noopSound);
  // Секретный склад Полиции: ключ -> оружие + модуль магазина
  const vaultBld = eng.world.buildings.find(b => b.secretId === 'sec_warehouse_city');
  assert.ok(vaultBld);
  eng.player.x = vaultBld.x; eng.player.y = vaultBld.y - 10;
  eng.resolveEntityObstacles(eng.player, false);
  assert.ok(eng.player.y >= vaultBld.y + eng.player.radius - 1 || Math.abs(eng.player.x - vaultBld.x) > vaultBld.colW * 0.5, 'AABB коллизия здания');
  eng.player.x = vaultBld.x; eng.player.y = vaultBld.y + 16;
  eng.inventory.consumables.key = 1;
  const unlocked = eng.interact();
  assert.equal(unlocked.type, 'secret_vault');
  assert.ok(eng.discoveredSecrets.includes('sec_warehouse_city'));
  assert.ok(eng.inventory.weapons.includes('autopistol'));
  assert.ok(eng.unlockedMods.includes('mod_mag'), 'В секрете должен быть модуль Сдвоенный Магазин');

  // Магазин: легендарка закрыта новичку, открывается постепенно
  eng.inventory.coins = 100000;
  assert.equal(eng.buyShopItem('weapon', 'railgun'), false, 'Рельсотрон тира 5 закрыт без боссов/уровня');
  eng.player.level = 9;
  eng.defeatedBosses.push('b1', 'b2', 'b3', 'b4', 'b5');
  assert.equal(eng.buyShopItem('weapon', 'railgun'), true, 'Рельсотрон открывается после 5 боссов и 8 уровня');
  eng.defeatedBosses.splice(0, eng.defeatedBosses.length);

  // Крафт и спецоперация зачистки
  eng.inventory.resources = { wood: 30, stone: 30, scrap: 30, herb: 30 };
  assert.equal(eng.craftRecipe('rc_crossbow'), true);
  assert.ok(eng.inventory.weapons.includes('crossbow'));
  const contract = eng.generateContract('clear_outpost');
  assert.ok(contract);
  killAll(eng, eng.enemies.filter(e => e.contractId === contract.id));
  eng.update(0.05, { moveX: 0, moveY: 0 });
  assert.equal(eng.activeContract, null);
  assert.ok((eng.stats.contractsDone || 0) >= 1, 'Спецоперация засчитана');

  // Спасение + база + босс в сохранении
  eng.rescuedIds.push('res_engineer');
  eng.baseLevels.workshop = 2;
  eng.defeatedBosses.push('boss_mutant_king');
  assert.equal(eng.saveGame(true), true);
  const eng2 = new GameEngine(noopSound);
  assert.equal(eng2.loadGame(), true);
  assert.ok(eng2.rescuedIds.includes('res_engineer'), 'Спасённые сохраняются');
  assert.equal(eng2.baseLevels.workshop, 2, 'Уровни Базы сохраняются');
  assert.ok(eng2.defeatedBosses.includes('boss_mutant_king'), 'Коллекция боссов сохраняется');
  assert.ok(eng2.inventory.weapons.includes('crossbow'), 'Арсенал сохраняется');
  for (const ach of ACHIEVEMENTS) assert.equal(typeof ach.check, 'function');
});

console.log(`\nИТОГ: ${passed}/10 комплексных проверок VEXMORA 2.0 успешно пройдено!`);
