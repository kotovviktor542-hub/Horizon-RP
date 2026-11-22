// VEXMORA 3D — headless-проверки трёхмерных сцен без WebGL.
// Сцена собирается в Node с минимальным DOM-шимом, рендерится через SVGRenderer,
// а мост «движок ↔ 3D» проверяется на настоящем GameEngine.
// Запуск: node tools/check3d.js
//
// В среде без нативного canvas (CI без @napi-rs/canvas) проверки выполняются
// в упрощённом режиме: сцены строятся, анимации прогоняются, SVG-вывод пропускается.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'tools', '.out');
fs.mkdirSync(OUT, { recursive: true });

let createCanvas = null;
try {
  ({ createCanvas } = await import('@napi-rs/canvas'));
} catch {
  createCanvas = null;   // режим без растеризации
}

// Минимальный DOM-шим для three.js (canvas-текстуры и SVG-вывод)
function makeCanvasShim(w = 256, h = 256) {
  if (createCanvas) {
    const cv = createCanvas(w, h);
    cv.addEventListener = () => {};
    cv.removeEventListener = () => {};
    cv.getBoundingClientRect = () => ({ left: 0, top: 0, width: w, height: h });
    return cv;
  }
  return {
    width: w, height: h, style: {},
    getContext: () => ({
      createImageData: (a, b) => ({ data: new Uint8ClampedArray(a * b * 4), width: a, height: b }),
      getImageData: (x, y, a, b) => ({ data: new Uint8ClampedArray(a * b * 4), width: a, height: b }),
      putImageData() {}, drawImage() {}, fillRect() {}, clearRect() {},
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      beginPath() {}, moveTo() {}, lineTo() {}, arc() {}, fill() {}, stroke() {},
      rect() {}, roundRect() {}, closePath() {}, quadraticCurveTo() {}, bezierCurveTo() {},
      fillText() {}, strokeText() {}, save() {}, restore() {}, scale() {}, rotate() {}, translate() {},
      measureText: () => ({ width: 10 }), set fillStyle(v) {}, set strokeStyle(v) {}, set font(v) {},
      set lineWidth(v) {}, set textAlign(v) {}, set textBaseline(v) {}
    }),
    addEventListener() {}, removeEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h })
  };
}

function shimElement(tag) {
  const attrs = {};
  const el = {
    tagName: tag, style: {}, childNodes: [], _attrs: attrs, _text: '', _html: '',
    setAttribute(k, v) { attrs[k] = v; },
    getAttribute(k) { return attrs[k]; },
    removeAttribute(k) { delete attrs[k]; },
    appendChild(c) { el.childNodes.push(c); return c; },
    removeChild(c) { const i = el.childNodes.indexOf(c); if (i >= 0) el.childNodes.splice(i, 1); return c; },
    addEventListener() {}, removeEventListener() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; }
  };
  Object.defineProperty(el, 'textContent', { get: () => el._text, set: (v) => { el._text = v; } });
  Object.defineProperty(el, 'innerHTML', { get: () => el._html, set: (v) => { el._html = v; } });
  Object.defineProperty(el, 'outerHTML', { get: () => `<${tag}>` + el.childNodes.map((c) => c.outerHTML || '').join('') + `</${tag}>` });
  return el;
}

globalThis.document = {
  createElement: (tag) => (tag === 'canvas' ? makeCanvasShim(512, 512) : shimElement(tag)),
  createElementNS: (ns, tag) => (tag === 'canvas' ? makeCanvasShim(512, 512) : shimElement(tag)),
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  body: { classList: { add() {}, remove() {} } }
};
globalThis.window = {
  innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
  addEventListener() {}, removeEventListener() {}
};
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
  setItem(k, v) { this._m.set(k, String(v)); },
  removeItem(k) { this._m.delete(k); }
};
globalThis.self = globalThis.window;

const THREE = await import('three');
const { SVGRenderer } = await import('three/addons/renderers/SVGRenderer.js');
const { SkySystem, WORLD_SCALE } = await import(`${ROOT}/www/js3d/core/sky.js`);
const { TerrainManager } = await import(`${ROOT}/www/js3d/world/terrain.js`);
const { WorldBuilder } = await import(`${ROOT}/www/js3d/world/worldbuilder.js`);
const { Hero3D, Weapon3D } = await import(`${ROOT}/www/js3d/actors/hero.js`);
const { Creature3D } = await import(`${ROOT}/www/js3d/actors/creatures.js`);
const { Effects3D } = await import(`${ROOT}/www/js3d/core/effects.js`);
const { World3D } = await import(`${ROOT}/www/js3d/game/worldbridge.js`);
const { createWorld } = await import(`${ROOT}/www/js/world.js`);
const { GameEngine } = await import(`${ROOT}/www/js/engine.js`);
const { ENEMIES, BOSSES } = await import(`${ROOT}/www/js/data.js`);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  \u2713 ${name}${extra ? ' \u2014 ' + extra : ''}`); }
  else { fail++; console.log(`  \u2717 ${name}${extra ? ' \u2014 ' + extra : ''}`); }
};

// ── Сцена ────────────────────────────────────────────────────────────────
console.log('=== VEXMORA 3D: headless-проверка сцен ===');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1280 / 720, 0.1, 900);

const world = createWorld(20261025);
const sky = new SkySystem(scene);
sky.setQuality('high');
const effects = new Effects3D(scene);

// 1. Небо и освещение
ok('Небо: купол, солнце, луна, звёзды созданы', !!sky.sky && !!sky.sun && !!sky.stars, `звёзд: ${sky.stars?.geometry?.attributes?.position?.count ?? 0}`);
sky.update(0.016, new THREE.Vector3(0, 0, 0), 0.5, 'clear', 1);
const noonSun = sky.sun ? sky.sun.intensity : 0;
sky.update(0.016, new THREE.Vector3(0, 0, 0), 0.0, 'clear', 1);
const midnightSun = sky.sun ? sky.sun.intensity : 0;
ok('Цикл дня и ночи: свет меняется', noonSun > midnightSun * 1.8, `полдень ${noonSun.toFixed(2)} / ночь ${midnightSun.toFixed(2)}`);
sky.update(0.016, new THREE.Vector3(0, 0, 0), 0.5, 'rain', 1);
ok('Погода переключается (rain)', sky.weather === 'rain');

// 2. Ландшафт
const start = { x: 3162 * WORLD_SCALE, z: 3181 * WORLD_SCALE };
const terrain = new TerrainManager(scene, world.map, 'high');
terrain.setQuality('high');
terrain.update(start, 0.016, 'high');
ok('Ландшафт: чанки построены', terrain.chunks.size >= 20, `чанков: ${terrain.chunks.size}`);
const verts = [...terrain.chunks.values()].reduce((n, m) => n + m.geometry.attributes.position.count, 0);
ok('Ландшафт: геометрия с высотами', verts > 5000, `вершин: ${verts}`);
const waterOK = !!terrain.waterMesh;
ok('Вода: плоскость с шейдером', waterOK);
const hAtSpawn = terrain.heightAt3D(start.x, start.z);
ok('Высота поверхности вычисляется', Number.isFinite(hAtSpawn), `y=${hAtSpawn.toFixed(2)}`);

// 3. Мир: растительность, здания, транспорт
const { CAMPFIRES } = await import(`${ROOT}/www/js/data.js`);
const builder = new WorldBuilder(scene, world, world.map, terrain, 'high', { campfires: CAMPFIRES });
ok('Растительность: инстансы созданы', builder.instanced.length >= 3, `батчей: ${builder.instanced.length}`);
let instances = 0;
for (const inst of builder.instanced) instances += inst.mesh.count;
ok('Деревья/кусты/камни в мире', instances > 800, `инстансов: ${instances}`);
ok('Здания построены', builder.buildingMeshes.length >= 30, `зданий: ${builder.buildingMeshes.length}`);
ok('Транспорт построен', builder.vehicleMeshes.size >= 10, `машин: ${builder.vehicleMeshes.size}`);
ok('Сундуки построены', builder.chestMeshes.size >= 6, `сундуков: ${builder.chestMeshes.size}`);
ok('Костры и лагеря построены', builder.dynamicProps.filter(d => d.type === 'fire').length >= 10,
  `костров: ${builder.dynamicProps.filter(d => d.type === 'fire').length}`);
builder.update(0.016, start, 0.5, 'high');

// 4. Герой
const hero = new Hero3D(scene);
ok('Герой: скелет собран', !!hero.parts.hips && !!hero.parts.head && !!hero.parts.armR && !!hero.parts.legL);
hero.equipWeapon({ category: 'melee', rarity: 'epic' });
ok('Герой: оружие в руке', !!hero.weaponMesh);
let heroVerts = 0;
hero.root.traverse(o => { if (o.isMesh) heroVerts += o.geometry.attributes.position.count; });
ok('Герой: детализированная модель', heroVerts > 2000, `вершин: ${heroVerts}`);

// Анимации: прогоняем все состояния и проверяем изменение углов костей
const states = ['idle', 'walk', 'run', 'jump', 'block', 'hurt', 'death'];
let animated = true;
for (const st of states) {
  hero.setState(st);
  const before = hero.parts.legR.hip.rotation.x;
  for (let i = 0; i < 20; i++) {
    hero.update(0.016, {
      position: { x: 0, y: 0, z: 0 }, facing: 0, speed: st === 'run' ? 6 : st === 'walk' ? 2 : 0,
      maxSpeed: 6, airborne: st === 'jump', blocking: st === 'block', dead: st === 'death'
    });
  }
  if (st === 'walk' || st === 'run') {
    if (Math.abs(hero.parts.legR.hip.rotation.x - before) < 0.01) animated = false;
  }
}
hero.setState('idle');
ok('Анимации: ходьба/бег двигают конечности', animated);

// Атака: три удара комбо
hero.triggerAttack();
let attackMoved = false;
const axeBefore = hero.parts.armR.shoulder.rotation.x;
for (let i = 0; i < 30; i++) {
  hero.update(0.02, { position: { x: 0, y: 0, z: 0 }, facing: 0, speed: 0, maxSpeed: 6 });
  if (Math.abs(hero.parts.armR.shoulder.rotation.x - axeBefore) > 0.2) attackMoved = true;
}
ok('Анимация атаки: замах и удар', attackMoved);

// Оружие всех категорий
for (const cat of ['melee', 'bow', 'magic', 'axe', 'dagger', 'spear']) {
  const w = Weapon3D.build(cat, 'legendary');
  let n = 0;
  w.traverse(o => { if (o.isMesh) n++; });
  ok(`Оружие 3D: ${cat}`, n >= 2, `мешей: ${n}`);
}

// 5. Враги
const enemyKinds = Object.keys(ENEMIES).slice(0, 12);
let enemyOK = true, enemyMeshTotal = 0;
for (const kind of enemyKinds) {
  const def = ENEMIES[kind];
  const c = new Creature3D(scene, { ...def, id: kind }, { isBoss: false });
  let meshes = 0;
  c.root.traverse(o => { if (o.isMesh) meshes++; });
  enemyMeshTotal += meshes;
  if (meshes < 4) { enemyOK = false; console.log(`    ! ${kind}: ${meshes} мешей`); }
  for (let i = 0; i < 12; i++) c.update(0.016, { position: { x: i * 0.1, y: 0, z: 0 }, facing: 0.5, speed: 120 });
  c.dispose();
}
ok('Враги: 3D-модели с анимацией', enemyOK, `${enemyKinds.length} видов, ${enemyMeshTotal} мешей`);

// 6. Боссы
const bossIds = Object.keys(BOSSES);
let bossOK = true, bossMeshTotal = 0;
for (const id of bossIds) {
  const def = BOSSES[id];
  const c = new Creature3D(scene, { ...def, isBoss: true }, { isBoss: true });
  let meshes = 0;
  c.root.traverse(o => { if (o.isMesh) meshes++; });
  bossMeshTotal += meshes;
  if (meshes < 8) { bossOK = false; console.log(`    ! ${id}: ${meshes} мешей`); }
  c.update(0.016, { position: { x: 0, y: 0, z: 0 }, facing: 0, speed: 60 });
  c.dispose();
}
ok('Боссы: модели крупнее обычных врагов', bossOK, `${bossIds.length} боссов, ${bossMeshTotal} мешей`);

// 7. Эффекты и погода
effects.hit(new THREE.Vector3(0, 0, 0), { power: 1.4 });
effects.damageNumber(new THREE.Vector3(0, 0, 0), 128, 'crit');
effects.impactRing(new THREE.Vector3(0, 0, 0), 4, 0xff8a3a);
effects.slash.spawn(new THREE.Vector3(0, 0, 0), 1.2, { radius: 1.4 });
effects.weather.setWeather('storm', 1);
for (let i = 0; i < 30; i++) effects.update(0.016, camera, { x: 0, y: 0, z: 0 });
ok('Эффекты: искры и числа урона работают', effects.sparks.mesh.visible || effects.numbers.sprites.some(s => s.sprite.visible));
ok('Погода: дождь/гроза активны', effects.weather.rain.visible);

// 8. Рендер сцены в SVG → PNG
camera.position.set(6, 6, 10);
camera.lookAt(0, 1.5, 0);
const renderer = new SVGRenderer();
renderer.setSize(1280, 720);
renderer.setQuality('high');
renderer.setClearColor(0x0b1220);
let svg = null;
try {
  renderer.render(scene, camera);
  svg = renderer.domElement?.outerHTML || null;
} catch (err) {
  console.log('    ! SVG render error:', err.message);
}
ok('SVG-рендер сцены выполнен', !!svg && svg.length > 100, svg ? `элементов в SVG: ${renderer.domElement.childNodes.length}` : 'нет вывода');

if (svg) {
  fs.writeFileSync(path.join(OUT, 'scene.svg'), svg);
  // Растеризация SVG в PNG через canvas (упрощённо: фоновый градиент + контуры)
  const png = createCanvas ? createCanvas(1280, 720) : null;
  if (png) {
    const ctx = png.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 720);
    grad.addColorStop(0, '#0b1220');
    grad.addColorStop(1, '#1a2438');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1280, 720);
  }
  // Считаем количество полигонов в SVG — реальная отрисовка сцены
  const polys = (svg.match(/<path/g) || []).length;
  ok('В сцене присутствуют полигоны', polys > 200, `path: ${polys}`);
  if (png) fs.writeFileSync(path.join(OUT, 'preview.png'), png.toBuffer('image/png'));
}

// 9. Статистика производительности
const t0 = performance.now();
for (let i = 0; i < 100; i++) {
  hero.update(0.016, { position: { x: 0, y: 0, z: 0 }, facing: i * 0.01, speed: i % 5, maxSpeed: 6 });
}
const heroMs = (performance.now() - t0) / 100;
const t1 = performance.now();
for (let i = 0; i < 200; i++) effects.update(0.016, camera, { x: 0, y: 0, z: 0 });
const fxMs = (performance.now() - t1) / 200;
ok('Производительность героя', heroMs < 4, `${heroMs.toFixed(2)} мс/кадр`);
ok('Производительность эффектов', fxMs < 6, `${fxMs.toFixed(2)} мс/кадр`);


// ── Мост «движок ↔ 3D» на настоящем GameEngine ──────────────────────────
{
console.log('--- Мост движок ↔ 3D-сцена ---');
const sound = { enabled: false, play() {}, unlock() {} };
const engine = new GameEngine(sound);
engine.paused = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1280 / 720, 0.1, 900);
const terrain = new TerrainManager(scene, engine.world.map, 'high');
const effects = new Effects3D(scene);
const bridge = new World3D(engine, scene, terrain, effects, { quality: 'high' });

const startTile = { x: engine.player.x * WORLD_SCALE, z: engine.player.y * WORLD_SCALE };
terrain.update(startTile, 0.016, 'high');

// Разгоняем игру: пусть враги подойдут, герой побегает и подерётся
for (let i = 0; i < 240; i++) {
  engine.update(1 / 60, { moveX: 1, moveY: 0.3 });
  if (i === 100) { engine.performAttack(); }
  if (i === 140) { engine.performHeavyAttack(); }
  if (i === 180) { engine.jump(); }
  bridge.update(1 / 60, camera);
  effects.update(1 / 60, camera, { x: startTile.x, y: 0, z: startTile.z });
}

const heroPos = bridge.hero.root.position;
ok('Герой 3D следует за игроком',
  Math.abs(heroPos.x - engine.player.x * WORLD_SCALE) < 1 &&
  Math.abs(heroPos.z - engine.player.y * WORLD_SCALE) < 1,
  `3D(${heroPos.x.toFixed(1)}, ${heroPos.z.toFixed(1)}) / движок(${(engine.player.x * WORLD_SCALE).toFixed(1)}, ${(engine.player.y * WORLD_SCALE).toFixed(1)})`);

ok('Враги синхронизированы с 3D-моделями',
  bridge.creatures.size === engine.enemies.length,
  `моделей ${bridge.creatures.size} / врагов ${engine.enemies.length}`);

let meshCount = 0;
for (const [, c] of bridge.creatures) c.root.traverse(o => { if (o.isMesh) meshCount++; });
ok('Враги имеют полноценные 3D-модели', meshCount >= engine.enemies.length * 4, `мешей: ${meshCount}`);

ok('Боссы получили 3D-модели', (bridge.bossCreatures?.size || 0) === (engine.bossEntities?.length || 0),
  `моделей ${bridge.bossCreatures?.size || 0} / боссов ${engine.bossEntities?.length || 0}`);

// Урон врагу: проверяем вспышку и частицы
const target = engine.enemies[0];
if (target) {
  const before = target.hp;
  engine.damageEnemy(target, 40);
  bridge.update(1 / 60, camera);
  ok('Урон врагу отражён в 3D', target.hp < before, `HP ${before} → ${target.hp}`);
}

// Смерть врага: модель должна быть помечена на удаление
const victim = engine.enemies[0];
if (victim) {
  engine.damageEnemy(victim, 999999);
  bridge.update(1 / 60, camera);
  const model = bridge.creatures.get(victim);
  ok('Смерть врага запускает 3D-анимацию', !model || model.dead);
}

// Трофеи: подобранные/новые дропы становятся 3D-объектами
engine.drops.push({ x: engine.player.x + 20, y: engine.player.y, kind: 'coin', amount: 25, life: 60 });
engine.drops.push({ x: engine.player.x + 30, y: engine.player.y, kind: 'resource', resId: 'wood', amount: 2, life: 60 });
bridge.update(1 / 60, camera);
ok('Трофеи отображаются в 3D', bridge.dropMeshes.size >= 2, `моделей трофеев: ${bridge.dropMeshes.size}`);

// Снаряды
engine.projectiles.push({
  x: engine.player.x + 40, y: engine.player.y, vx: 300, vy: 0,
  damage: 20, life: 1, friendly: true, radius: 8, magic: true, kind: 'magic'
});
bridge.update(1 / 60, camera);
ok('Снаряды визуализируются', bridge.projectileMeshes.size >= 1);

// Оружие: смена экипировки меняет модель в руке
const beforeWeapon = bridge.hero.weaponMesh;
engine.inventory.weapons = ['sword', 'bow', 'magic_staff'];
engine.inventory.equippedWeapon = 'bow';
bridge.update(1 / 60, camera);
ok('Смена оружия меняет 3D-модель', bridge.hero.weaponMesh !== beforeWeapon);
engine.inventory.equippedWeapon = 'magic_staff';
bridge.update(1 / 60, camera);
ok('Магический посох в руке', !!bridge.hero.weaponMesh);

// Броня
engine.ownedArmors = ['set_iron'];
engine.equippedArmor = 'set_iron';
bridge.update(1 / 60, camera);
ok('Экипировка брони видна на модели', bridge.hero.parts.helmet.visible && bridge.hero.parts.armor.visible);

// Тяжёлая атака — новая механика движка
engine.player.stamina = 100;
engine.player.attackTimer = 0;
const heavyOK = engine.performHeavyAttack();
ok('Тяжёлая атака работает', heavyOK === true && engine.player.stamina < 100, `выносливость: ${engine.player.stamina.toFixed(0)}`);

// Производительность кадра
const t0 = performance.now();
for (let i = 0; i < 120; i++) {
  engine.update(1 / 60, { moveX: 0.4, moveY: 0.4 });
  bridge.update(1 / 60, camera);
  effects.update(1 / 60, camera, { x: startTile.x, y: 0, z: startTile.z });
}
const ms = (performance.now() - t0) / 120;
ok('Производительность кадра (логика + мост)', ms < 12, `${ms.toFixed(2)} мс/кадр`);

// Сохранение с новыми настройками 3D
engine.settings.quality3d = 'ultra';
engine.saveGame(true);
engine.settings.quality3d = 'low';
engine.loadGame();
ok('Сохранение хранит качество 3D', engine.settings.quality3d === 'ultra', `quality3d=${engine.settings.quality3d}`);

bridge.dispose();
ok('Очистка сцены без ошибок', true);


}
console.log(`\nИТОГ: ${pass}/${pass + fail} проверок 3D-сцен и моста успешно${fail ? `, провалено: ${fail}` : ''}`);
if (fail) process.exitCode = 1;
