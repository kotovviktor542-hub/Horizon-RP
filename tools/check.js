// Полный набор логических и интеграционных тестов игрового движка Horizon RP
import assert from 'node:assert/strict';
import { createGameEngine } from '../www/js/engine.js';
import {
  BIOMES, WEAPONS, ARMORS, RELICS, SKILLS, RECIPES,
  ENEMIES, BOSSES, SECRETS, QUESTS, ACHIEVEMENTS
} from '../www/js/data.js';
import { getBiomeIdAt } from '../www/js/world.js';

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log('=== Horizon RP: Проверка игрового движка и контента ===');

test('Целостность всех таблиц контента (биомы, оружие, враги, боссы, рецепты, квесты)', () => {
  assert.equal(Object.keys(BIOMES).length, 5);
  assert.ok(Object.keys(WEAPONS).length >= 6);
  assert.ok(Object.keys(ARMORS).length >= 5);
  assert.ok(Object.keys(RELICS).length >= 8);
  assert.equal(Object.keys(SKILLS).length, 3);
  assert.ok(RECIPES.length >= 14);
  assert.ok(Object.keys(ENEMIES).length >= 12);
  assert.equal(Object.keys(BOSSES).length, 4);
  assert.equal(SECRETS.length, 4);
  assert.ok(QUESTS.length >= 7);
  assert.equal(ACHIEVEMENTS.length, 16);
});

test('Генерация мира 4800x4800, 5 биомов, сундуков и секретных объектов', () => {
  const g = createGameEngine();
  assert.equal(g.world.width, 4800);
  assert.equal(g.world.height, 4800);
  assert.ok(g.world.nodes.length > 100, 'Должно быть сгенерировано >100 ресурсных узлов');
  assert.ok(g.world.chests.length >= 8, 'Должны быть секретные и мировые сундуки');
  assert.equal(g.world.braziers.length, 3, 'Три жаровни Монолита');
  assert.equal(getBiomeIdAt(2400, 2400), 'meadow');
  assert.equal(getBiomeIdAt(4150, 2350), 'ruins');
  assert.equal(getBiomeIdAt(820, 820), 'mire');
  assert.equal(getBiomeIdAt(3960, 720), 'frost');
  assert.equal(getBiomeIdAt(4120, 4120), 'rift');
});

test('Передвижение, физика прыжка (ось Z) и уклонение от ударной волны в прыжке', () => {
  const g = createGameEngine();
  const startX = g.state.player.x;
  for (let i = 0; i < 15; i++) g.update(0.03, { moveX: 1, moveY: 0, attackHeld: false });
  assert.ok(g.state.player.x > startX + 30, 'Игрок должен сдвинуться вправо');

  assert.equal(g.triggerJump(1, 0), true);
  g.update(0.08, { moveX: 0, moveY: 0, attackHeld: false });
  assert.ok(g.state.player.z > 14, 'В прыжке координата Z должна подняться > 14');

  // Пускаем вражескую ударную волну прямо через игрока, пока он в воздухе
  const hpBefore = g.state.player.hp;
  g.state.player.invulnTimer = 0;
  g.state.shockwaves.push({
    x: g.state.player.x - 10,
    y: g.state.player.y,
    radius: 8,
    maxRadius: 60,
    speed: 200,
    color: '#ef4444',
    friendly: false,
    damage: 45,
    jumpable: true
  });
  g.update(0.02, { moveX: 0, moveY: 0, attackHeld: false });
  assert.equal(g.state.player.hp, hpBefore, 'Прыжок должен позволять перепрыгивать ударные волны боссов без урона');
});

test('Все 6 видов оружия (ближний бой + стрелы + самонаводящиеся сферы + коса)', () => {
  const g = createGameEngine();
  for (const wId of Object.keys(WEAPONS)) {
    if (!g.state.inventory.weapons.includes(wId)) g.state.inventory.weapons.push(wId);
    g.equipItem('weapon', wId);
    g.state.player.attackCooldown = 0;

    // Ставим тестового врага прямо перед героем
    g.state.enemies.push({
      uid: `test_${wId}`,
      ...ENEMIES.goblin,
      hp: 200, maxHp: 200,
      x: g.state.player.x + 48,
      y: g.state.player.y,
      z: 0, vz: 0, vx: 0, vy: 0,
      attackTimer: 5, specialTimer: 5, stunTimer: 0, hitFlash: 0
    });

    assert.equal(g.triggerAttack(), true, `Атака оружием ${wId} должна сработать`);
    for (let k = 0; k < 10; k++) g.update(0.03, { moveX: 0, moveY: 0, attackHeld: false });

    const target = g.state.enemies.find(e => e.uid === `test_${wId}`);
    assert.ok(!target || target.hp < 200, `Оружие ${wId} должно нанести урон врагу`);
    g.state.enemies.length = 0;
  }
});

test('Все 3 боевые способности (Вихрь Пламени, Громовой Прыжок, Эфирный Бастион)', () => {
  const g = createGameEngine();
  g.state.skillRanks.whirlwind = 2;
  g.state.skillRanks.thunder_slam = 2;
  g.state.skillRanks.aegis_pulse = 2;
  g.state.player.stamina = 100;

  assert.equal(g.triggerSkill('whirlwind'), true);
  g.state.player.stamina = 100;
  assert.equal(g.triggerSkill('thunder_slam'), true);
  for (let i = 0; i < 16; i++) g.update(0.03, { moveX: 0, moveY: 0 });
  assert.equal(g.state.player.thunderLeap, null, 'Громовой прыжок должен успешно завершиться приземлением');

  g.state.player.stamina = 100;
  g.state.player.hp = 40;
  assert.equal(g.triggerSkill('aegis_pulse'), true);
  assert.ok(g.state.player.hp > 40, 'Эфирный Бастион должен исцелить игрока');
  assert.ok(g.state.player.aegisTimer > 0, 'Эфирный Бастион должен активировать щит и клинки');
});

test('Ремесло, заточка оружия, прокачка характеристик и сохранение/загрузка', () => {
  const g = createGameEngine();
  g.state.player.gold = 2000;
  g.state.inventory.resources = { wood: 30, herb: 30, meat: 20, iron: 30, soul: 30, mithril: 30, crystal: 30 };

  assert.equal(g.craftRecipe('craft_bow'), true);
  assert.ok(g.state.inventory.weapons.includes('bow_storm'));

  assert.equal(g.upgradeWeapon('bow_storm'), true);
  assert.equal(g.state.weaponUpgrades.bow_storm, 1);

  g.state.player.statPoints = 3;
  assert.equal(g.allocateStat('power'), true);
  assert.equal(g.state.player.attributes.power, 1);

  const saved = g.serializeSave();
  const g2 = createGameEngine();
  assert.equal(g2.loadGame(saved), true);
  assert.equal(g2.state.weaponUpgrades.bow_storm, 1);
  assert.equal(g2.state.player.attributes.power, 1);
  assert.ok(g2.state.inventory.weapons.includes('bow_storm'));
});

test('Сражение с 4 боссами и прогресс квестов/достижений', () => {
  const g = createGameEngine();
  for (const bossId of ['morgrath', 'xylla', 'valkor', 'azariel']) {
    const bDef = BOSSES[bossId];
    g.state.player.x = bDef.x + 120;
    g.state.player.y = bDef.y;
    for (let i = 0; i < 40; i++) g.update(0.03, { moveX: 0, moveY: 0 });
    assert.ok(g.state.activeBoss && g.state.activeBoss.id === bossId, `Босс ${bossId} должен вступить в бой`);

    // Добиваем босса атакой и проверяем получение трофеев и достижений
    g.state.activeBoss.hp = 5;
    g.state.activeBoss.x = g.state.player.x + 35;
    g.state.activeBoss.y = g.state.player.y;
    g.state.player.attackCooldown = 0;
    g.triggerAttack();
    g.update(0.03, { moveX: 0, moveY: 0 });
    assert.ok(g.state.defeatedBosses.includes(bossId), `Босс ${bossId} должен засчитаться побеждённым`);
  }
  assert.ok(g.state.unlockedAchievements.includes('ach_azariel'));
});

console.log(`\nВсе проверки пройдены успешно: ${passed}/${passed}`);
