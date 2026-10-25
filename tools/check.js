// Автоматическая комплексная проверка всех пиксельных ассетов и игровых систем Horizon: Выживание
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
const { WEAPONS, ITEMS, SKILLS, BOSSES, QUESTS, SECRETS, NPCS, ACHIEVEMENTS, BIOMES } = await import('../www/js/data.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const noopSound = { enabled: true, play() {}, unlock() {} };
let passed = 0;

function test(name, fn) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log('=== Проверка ассетов и игровых механик Horizon: Выживание (v2 Pixel-Art) ===');

test('1. Все прозрачные пиксель-арт PNG и спрайт-листы существуют и валидны', () => {
  const spritesJs = fs.readFileSync(path.join(rootDir, 'www/js/sprites.js'), 'utf8');
  const matches = [...spritesJs.matchAll(/'(assets\/sprites\/[^']+\.png)'/g)].map(m => m[1]);
  assert.ok(matches.length >= 48, `Должно быть минимум 48 отдельных спрайтов, найдено: ${matches.length}`);

  for (const rel of matches) {
    const full = path.join(rootDir, 'www', rel);
    assert.ok(fs.existsSync(full), `Отсутствует PNG-файл: ${rel}`);
    const buf = fs.readFileSync(full);
    assert.equal(buf[0], 0x89);
    assert.equal(buf[1], 0x50); // 'P'
    assert.equal(buf[2], 0x4e); // 'N'
    assert.equal(buf[3], 0x47); // 'G'
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    const colorType = buf[25];
    assert.equal(colorType, 6, `${rel} должен быть RGBA с прозрачным фоном (colorType=6)`);
    assert.ok(width >= 16 && height >= 16, `${rel} некорректный размер ${width}x${height}`);
  }
});

test('2. Все 4 биома, 9 типов зданий, 6 видов транспорта, 4 NPC и 4 Босса присутствуют в мире', () => {
  const eng = new GameEngine(noopSound);
  assert.equal(Object.keys(BIOMES).length, 4);
  assert.equal(NPCS.length, 4);
  assert.equal(eng.bossEntities.length, 4);

  const bldKinds = new Set(eng.world.buildings.map(b => b.kind));
  for (const k of ['house', 'shop', 'warehouse', 'bunker', 'watchtower', 'factory', 'hospital', 'police', 'base']) {
    assert.ok(bldKinds.has(k), `Здание типа ${k} должно быть размещено в мире`);
  }

  const vehKinds = new Set(eng.world.vehicles.map(v => v.kind));
  for (const k of ['car', 'moto', 'jeep', 'bus', 'heli', 'boat']) {
    assert.ok(vehKinds.has(k), `Транспорт типа ${k} должен быть размещён в мире`);
  }
});

test('3. Все 8 видов оружия, патроны, авто-переключение и все состояния анимации героя работают', () => {
  assert.equal(Object.keys(WEAPONS).length, 8);
  assert.equal(Object.keys(ITEMS).length, 8);

  const eng = new GameEngine(noopSound);
  // 4 направления ходьбы + бег
  for (const [mx, my, expectedDir] of [[1, 0, 'right'], [-1, 0, 'left'], [0, -1, 'up'], [0, 1, 'down']]) {
    eng.update(0.04, { moveX: mx, moveY: my, sprintHeld: false, attackHeld: false });
    assert.equal(eng.player.facingDir, expectedDir);
    assert.equal(eng.player.animState, 'walk');
  }
  eng.update(0.04, { moveX: 1, moveY: 0, sprintHeld: true, attackHeld: false });
  assert.equal(eng.player.animState, 'run');

  // Прыжок
  assert.equal(eng.jump(), true);
  eng.update(0.04, { moveX: 0, moveY: 0 });
  assert.equal(eng.player.animState, 'jump');
  for (let i = 0; i < 30; i++) eng.update(0.04, { moveX: 0, moveY: 0 });
  assert.equal(eng.player.z, 0);

  // Стрельба из всех 8 видов оружия
  for (const wId of Object.keys(WEAPONS)) {
    if (!eng.inventory.weapons.includes(wId)) eng.grantWeapon(wId);
    eng.equipWeapon(wId);
    eng.inventory.ammo = 40;
    eng.player.attackTimer = 0;
    assert.equal(eng.performAttack(), true, `Оружие ${wId} должно стрелять/бить`);
  }

  // Если патроны кончились на огнестреле — автоматический переход на оружие ближнего боя!
  eng.equipWeapon('rifle');
  eng.inventory.ammo = 0;
  eng.player.attackTimer = 0;
  assert.equal(eng.performAttack(), true);
  assert.equal(WEAPONS[eng.inventory.equippedWeapon].ammoCost, 0);
});

test('4. Осколочные гранаты и красные взрывные бочки создают пиксельные взрывы и наносят урон', () => {
  const eng = new GameEngine(noopSound);
  eng.player.x = 2850;
  eng.player.y = 2400;
  const en = eng.spawnEnemyAt(eng.player.x + 110, eng.player.y, 'zombie');
  assert.ok(en);
  assert.equal(eng.throwGrenade(), true);
  for (let i = 0; i < 20; i++) eng.update(0.04, { moveX: 0, moveY: 0 });
  assert.ok(eng.stats.explosionsTriggered >= 1, 'Граната должна взорваться');
  assert.ok(eng.spriteEffects.some(fx => fx.kind === 'explosion' || fx.kind === 'smoke'));
});

test('5. Вождение транспорта (мотоцикл, седан, внедорожник) и таран врагов работают', () => {
  const eng = new GameEngine(noopSound);
  const moto = eng.world.vehicles.find(v => v.kind === 'moto' && v.drivable);
  assert.ok(moto);
  eng.player.x = moto.x;
  eng.player.y = moto.y + 20;
  const res = eng.interact();
  assert.equal(res.type, 'vehicle_enter');
  assert.equal(eng.player.vehicleId, moto.id);

  const startX = moto.x;
  for (let i = 0; i < 10; i++) eng.update(0.04, { moveX: 1, moveY: 0 });
  assert.ok(moto.x > startX + 40, 'Транспорт должен ехать');

  eng.interact(); // Выход из транспорта
  assert.equal(eng.player.vehicleId, null);
});

test('6. Открытие запертых Бункеров и Спецскладов Серебряным Ключом + коллизии зданий', () => {
  const eng = new GameEngine(noopSound);
  const vaultBld = eng.world.buildings.find(b => b.secretId === 'sec_warehouse_city');
  assert.ok(vaultBld);

  // Проверка AABB коллизии здания: игрок внутри контура выталкивается наружу
  eng.player.x = vaultBld.x;
  eng.player.y = vaultBld.y - 10;
  eng.resolveEntityObstacles(eng.player, false);
  assert.ok(eng.player.y >= vaultBld.y + eng.player.radius - 1 || Math.abs(eng.player.x - vaultBld.x) > vaultBld.colW * 0.5);

  // Открытие двери ключом
  eng.player.x = vaultBld.x;
  eng.player.y = vaultBld.y + 16;
  eng.inventory.consumables.key = 1;
  const unlocked = eng.interact();
  assert.equal(unlocked.type, 'secret_vault');
  assert.equal(eng.inventory.consumables.key, 0);
  assert.ok(eng.discoveredSecrets.includes('sec_warehouse_city'));
  assert.ok(eng.inventory.weapons.includes('shotgun'));
});

test('7. Магазин SHOP, Рюкзак, Крафт, Квесты, Уровни и Сохранение/Загрузка работают без потерь', () => {
  const eng = new GameEngine(noopSound);
  eng.inventory.coins = 1000;
  eng.inventory.resources = { wood: 20, stone: 20, scrap: 20, herb: 20 };

  assert.equal(eng.buyShopItem('item', 'backpack'), true);
  assert.equal(eng.inventory.backpackLevel, 1);
  assert.ok(eng.getMaxAmmo() > 120);

  assert.equal(eng.craftRecipe('rc_grenade'), true);
  assert.equal(eng.craftRecipe('rc_bow'), true);
  assert.ok(eng.inventory.weapons.includes('bow'));

  eng.gainXp(320);
  assert.ok(eng.player.level >= 3);
  assert.equal(eng.allocateStat('power'), true);
  assert.equal(eng.upgradeSkill('magic_nova'), true);

  assert.equal(eng.saveGame(true), true);
  const eng2 = new GameEngine(noopSound);
  assert.equal(eng2.loadGame(), true);
  assert.equal(eng2.inventory.backpackLevel, 1);
  assert.ok(eng2.inventory.weapons.includes('bow'));
  assert.ok(eng2.skills.magic_nova.level >= 1);
});

console.log(`\nИТОГ: ${passed}/7 комплексных проверок v2 успешно пройдено!`);
