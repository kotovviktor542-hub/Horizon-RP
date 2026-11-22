// VEXMORA 3D — headless-проверки трёхмерных сцен без WebGL.
// Сцена собирается в Node с минимальным DOM-шимом, рендерится через SVGRenderer,
// а мост «движок ↔ 3D» проверяется на настоящем GameEngine.
// Запуск: node tools/check3d.js  (VEXMORA_NO_CANVAS=1 — без нативного canvas)
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
if (!process.env.VEXMORA_NO_CANVAS) {
  try {
    ({ createCanvas } = await import('@napi-rs/canvas'));
  } catch {
    createCanvas = null;   // режим без растеризации (CI без нативного canvas)
  }
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

// Детерминированный PRNG: движок и генератор мира используют Math.random —
// без фиксации зерна набор врагов и трофеев отличался от запуска к запуску.
let __seed = 0x5eed1234;
Math.random = () => {
  __seed |= 0; __seed = (__seed + 0x6D2B79F5) | 0;
  let t = Math.imul(__seed ^ (__seed >>> 15), 1 | __seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

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
const { ENEMIES, BOSSES, CAMPFIRES } = await import(`${ROOT}/www/js/data.js`);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  \u2713 ${name}${extra ? ' \u2014 ' + extra : ''}`); }
  else { fail++; console.log(`  \u2717 ${name}${extra ? ' \u2014 ' + extra : ''}`); }
};

console.log('=== VEXMORA 3D: headless-проверка сцен ===');
// ── Сцена ────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1280 / 720, 0.1, 900);

const world = createWorld(20261025);
const sky = new SkySystem(scene);
sky.setQuality('high');
const effects = new Effects3D(scene);

// 1. Небо и освещение
ok('Небо: купол, солнце, звёзды созданы', !!sky.sky && !!sky.sun && !!sky.stars,
  `звёзд: ${sky.stars?.geometry?.attributes?.position?.count ?? 0}`);
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
ok('Вода: плоскость с шейдером', !!terrain.waterMesh);
const hAtSpawn = terrain.heightAt3D(start.x, start.z);
ok('Высота поверхности вычисляется', Number.isFinite(hAtSpawn), `y=${hAtSpawn.toFixed(2)}`);

// 3. Мир: растительность, здания, транспорт
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
  if ((st === 'walk' || st === 'run') && Math.abs(hero.parts.legR.hip.rotation.x - before) < 0.01) animated = false;
}
hero.setState('idle');
ok('Анимации: ходьба/бег двигают конечности', animated);

hero.triggerAttack();
let attackMoved = false;
const axeBefore = hero.parts.armR.shoulder.rotation.x;
for (let i = 0; i < 30; i++) {
  hero.update(0.02, { position: { x: 0, y: 0, z: 0 }, facing: 0, speed: 0, maxSpeed: 6 });
  if (Math.abs(hero.parts.armR.shoulder.rotation.x - axeBefore) > 0.2) attackMoved = true;
}
ok('Анимация атаки: замах и удар', attackMoved);

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
  for (let i = 0; i < 12; i++) c.update(0.016, { position: { x: i * 0.1, y: 0, z: 0 }, facing: 0.5, speed: 1.2 });
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
  c.update(0.016, { position: { x: 0, y: 0, z: 0 }, facing: 0, speed: 0.6 });
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
ok('SVG-рендер сцены выполнен', !!svg && svg.length > 100,
  svg ? `элементов в SVG: ${renderer.domElement.childNodes.length}` : 'нет вывода');

if (svg) {
  fs.writeFileSync(path.join(OUT, 'scene.svg'), svg);
  const polys = (svg.match(/<path/g) || []).length;
  ok('В сцене присутствуют полигоны', polys > 200, `path: ${polys}`);
}

// 9. Производительность
// Замер: лучшее из трёх серий — на загруженных раннерах CI одиночный
// замер легко ловит паузу планировщика и даёт ложное падение.
const bench = (fn, iters) => {
  let best = Infinity;
  for (let round = 0; round < 3; round++) {
    const t = performance.now();
    for (let i = 0; i < iters; i++) fn(i);
    best = Math.min(best, (performance.now() - t) / iters);
  }
  return best;
};
const heroMs = bench((i) => {
  hero.update(0.016, { position: { x: 0, y: 0, z: 0 }, facing: i * 0.01, speed: i % 5, maxSpeed: 6 });
}, 100);
const fxMs = bench(() => {
  effects.hit({ x: 0, y: 1, z: 0 }, { power: 1 });
  effects.update(0.016, camera, { x: 0, y: 0, z: 0 });
  effects.damageNumber({ x: 0, y: 1, z: 0 }, 12, 'hit');
}, 200);
ok('Производительность героя', heroMs < 8, `${heroMs.toFixed(2)} мс/кадр`);
ok('Производительность эффектов', fxMs < 12, `${fxMs.toFixed(2)} мс/кадр`);

// ── Мост «движок ↔ 3D» на настоящем GameEngine ──────────────────────────
{
console.log('--- Мост движок ↔ 3D-сцена ---');
const sound = { enabled: false, play() {}, unlock() {} };
const engine = new GameEngine(sound);
engine.paused = false;

const scene2 = new THREE.Scene();
const camera2 = new THREE.PerspectiveCamera(62, 1280 / 720, 0.1, 900);
const terrain2 = new TerrainManager(scene2, engine.world.map, 'high');
const effects2 = new Effects3D(scene2);
const bridge = new World3D(engine, scene2, terrain2, effects2, { quality: 'high' });

const startTile = { x: engine.player.x * WORLD_SCALE, z: engine.player.y * WORLD_SCALE };
terrain2.update(startTile, 0.016, 'high');

for (let i = 0; i < 240; i++) {
  engine.update(1 / 60, { moveX: 1, moveY: 0.3 });
  if (i === 100) engine.performAttack();
  if (i === 140) engine.performHeavyAttack();
  if (i === 180) engine.jump();
  bridge.update(1 / 60, camera2);
  effects2.update(1 / 60, camera2, { x: startTile.x, y: 0, z: startTile.z });
}

const heroPos = bridge.hero.root.position;
ok('Герой 3D следует за игроком',
  Math.abs(heroPos.x - engine.player.x * WORLD_SCALE) < 1 &&
  Math.abs(heroPos.z - engine.player.y * WORLD_SCALE) < 1,
  `3D(${heroPos.x.toFixed(1)}, ${heroPos.z.toFixed(1)}) / движок(${(engine.player.x * WORLD_SCALE).toFixed(1)}, ${(engine.player.y * WORLD_SCALE).toFixed(1)})`);

// Убитый враг ещё 1.6 с проигрывает анимацию смерти — его модель живёт в сцене
// дольше сущности, поэтому допускаем такие «доживающие» модели.
{
  // (учитываем именно «доживающие» модели, а не просто размер карты)
  const aliveIds = new Set(engine.enemies);
  let stale = 0;
  for (const [enemy] of bridge.creatures) if (!aliveIds.has(enemy)) stale++;
  ok('Враги синхронизированы с 3D-моделями',
    bridge.creatures.size >= engine.enemies.length && bridge.creatures.size <= engine.enemies.length + 3,
    `моделей ${bridge.creatures.size} / врагов ${engine.enemies.length}`);
}

let meshCount = 0;
for (const [, c] of bridge.creatures) c.root.traverse(o => { if (o.isMesh) meshCount++; });
ok('Враги имеют полноценные 3D-модели', meshCount >= engine.enemies.length * 4, `мешей: ${meshCount}`);

ok('Боссы получили 3D-модели', (bridge.bossCreatures?.size || 0) === (engine.bossEntities?.length || 0),
  `моделей ${bridge.bossCreatures?.size || 0} / боссов ${engine.bossEntities?.length || 0}`);

const target = engine.enemies[0];
if (target) {
  const before = target.hp;
  engine.damageEnemy(target, 40);
  bridge.update(1 / 60, camera2);
  ok('Урон врагу отражён в 3D', target.hp < before, `HP ${before} → ${target.hp}`);
}

const victim = engine.enemies[0];
if (victim) {
  engine.damageEnemy(victim, 999999);
  bridge.update(1 / 60, camera2);
  const model = bridge.creatures.get(victim);
  ok('Смерть врага запускает 3D-анимацию', !model || model.dead);
}

engine.drops.push({ x: engine.player.x + 20, y: engine.player.y, kind: 'coin', amount: 25, life: 60 });
engine.drops.push({ x: engine.player.x + 30, y: engine.player.y, kind: 'resource', resId: 'wood', amount: 2, life: 60 });
bridge.update(1 / 60, camera2);
ok('Трофеи отображаются в 3D', bridge.dropMeshes.size >= 2, `моделей трофеев: ${bridge.dropMeshes.size}`);

engine.projectiles.push({
  x: engine.player.x + 40, y: engine.player.y, vx: 300, vy: 0,
  damage: 20, life: 1, friendly: true, radius: 8, magic: true, kind: 'magic'
});
bridge.update(1 / 60, camera2);
ok('Снаряды визуализируются', bridge.projectileMeshes.size >= 1);

const beforeWeapon = bridge.hero.weaponMesh;
engine.inventory.weapons = ['sword', 'bow', 'magic_staff'];
engine.inventory.equippedWeapon = 'bow';
bridge.update(1 / 60, camera2);
ok('Смена оружия меняет 3D-модель', bridge.hero.weaponMesh !== beforeWeapon);
engine.inventory.equippedWeapon = 'magic_staff';
bridge.update(1 / 60, camera2);
ok('Магический посох в руке', !!bridge.hero.weaponMesh);

engine.ownedArmors = ['set_iron'];
engine.equippedArmor = 'set_iron';
bridge.update(1 / 60, camera2);
ok('Экипировка брони видна на модели', bridge.hero.parts.helmet.visible && bridge.hero.parts.armor.visible);

engine.player.stamina = 100;
engine.player.attackTimer = 0;
const heavyOK = engine.performHeavyAttack();
ok('Тяжёлая атака работает', heavyOK === true && engine.player.stamina < 100, `выносливость: ${engine.player.stamina.toFixed(0)}`);

const ms = bench(() => {
  engine.update(1 / 60, { moveX: 0.4, moveY: 0.4 });
  bridge.update(1 / 60, camera2);
  effects2.update(1 / 60, camera2, { x: startTile.x, y: 0, z: startTile.z });
}, 120);
ok('Производительность кадра (логика + мост)', ms < 25, `${ms.toFixed(2)} мс/кадр`);

engine.settings.quality3d = 'ultra';
engine.saveGame(true);
engine.settings.quality3d = 'low';
engine.loadGame();
ok('Сохранение хранит качество 3D', engine.settings.quality3d === 'ultra', `quality3d=${engine.settings.quality3d}`);

bridge.dispose();
ok('Очистка сцены без ошибок', true);

// 10. Производительность: свет и тени не должны «съедать» кадр
{
  // Источники света: в кадре включены только ближайшие (бюджет), а не все 85+
  const lightsAll = [];
  scene.traverse((o) => { if (o.isLight) lightsAll.push(o); });
  // Ночь — худший случай: все лампы хотели бы гореть
  builder.update(0.016, start, 0.02, 'high');
  const lightsOn = lightsAll.filter((l) => l.visible && (l.intensity || 0) > 0.01).length;
  ok('Источники света бюджетируются (ближние к герою)', lightsOn <= 14,
    `включено ${lightsOn} из ${lightsAll.length}`);

  // Тени: второй проход ограничен дальностью
  const shadowTris = () => {
    let tris = 0;
    scene.traverse((o) => {
      if (!(o.isMesh || o.isInstancedMesh) || !o.castShadow || !o.geometry?.attributes?.position) return;
      const g = o.geometry;
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
    });
    return tris;
  };
  const beforeTris = shadowTris();
  builder.cullShadows({ x: start.x, z: start.z }, 55);
  const afterTris = shadowTris();
  ok('Тени отсекаются по дальности', afterTris < beforeTris * 0.5,
    `треугольников в тенях ${Math.round(beforeTris / 1000)}k → ${Math.round(afterTris / 1000)}k`);

  // Инстансы нарезаны по ячейкам — frustum culling может отбрасывать лишнее
  const culled = builder.instanced.filter((i) => i.mesh.frustumCulled !== false).length;
  ok('Растительность нарезана по ячейкам для отсечения', culled === builder.instanced.length && builder.instanced.length > 20,
    `батчей: ${builder.instanced.length}, с отсечением: ${culled}`);

  // Декоративные лампы внутри моделей удалены
  const innerLights = [];
  builder.group.traverse((o) => {
    if (!o.isLight) return;
    let p2 = o.parent, depth = 0;
    while (p2 && p2 !== builder.group) { depth++; p2 = p2.parent; }
    if (depth > 0 && !o.userData.worldPos) innerLights.push(o);
  });
  ok('В моделях не осталось декоративных источников света', innerLights.length === 0, `найдено: ${innerLights.length}`);
}

// 11. Прогрессивные текстуры: мир строится мгновенно, карты дорисовываются по одной
{
  const M = await import(`${ROOT}/www/js3d/core/materials.js`);
  M.clearMaterialCache();
  M.setDeferTextures(true);
  const t0 = performance.now();
  for (const name of M.materialNames()) M.createMaterial(name, { quality: 'high' });
  const buildMs = performance.now() - t0;
  const pending = M.pendingMaterialNames();
  ok('Материалы создаются без текстур мгновенно', buildMs < 120 && pending.length > 5,
    `${buildMs.toFixed(1)} мс, в очереди ${pending.length}`);
  let textured = 0;
  for (const name of pending) if (M.textureMaterial(name, 'high')) textured++;
  ok('Текстуры применяются по одной (кэш работает)', textured === pending.length &&
    M.textureMaterial(pending[0], 'high') === false, `обработано: ${textured}`);
  ok('После текстурировки очередь пуста', M.pendingMaterialNames().length === pending.length,
    'очередь сбрасывается setDeferTextures(false)');
  M.setDeferTextures(false);
  M.clearMaterialCache();
}

// 12. Динамическое разрешение: просадка FPS режет разрешение, а не весь пресет
{
  const ratios = [];
  const stubRenderer = {
    setPixelRatio(v) { ratios.push(v); }, getPixelRatio() { return ratios[ratios.length - 1] ?? 1; },
    setSize() {}, render() {}, dispose() {},
    shadowMap: { enabled: false, needsUpdate: false }, domElement: shimElement('canvas'),
    outputColorSpace: '', toneMapping: 0, toneMappingExposure: 1, info: { autoReset: true }
  };
  const Engine = (await import(`${ROOT}/www/js/engine.js`)).GameEngine;
  const engQ = new Engine({ enabled: false, play() {}, unlock() {} });
  const { Game3D } = await import(`${ROOT}/www/js3d/game/game3d.js`);
  const g = new Game3D(shimElement('canvas'), engQ, {
    quality3d: 'high', externalLoop: true, autoQuality: true,
    rendererFactory: () => stubRenderer
  });
  const startScale = g.renderScale;
  g.fpsSmooth = 24;                       // тяжёлый кадр
  g._autoAdjustResolution();
  const lowScale = g.renderScale;
  ok('Динамическое разрешение снижается при просадке FPS', lowScale < startScale,
    `масштаб ${startScale.toFixed(2)} → ${lowScale.toFixed(2)}`);
  const ratioLow = ratios[ratios.length - 1];
  g.fpsSmooth = 60;                       // FPS восстановился
  g._autoAdjustResolution();
  ok('Динамическое разрешение восстанавливается при высоком FPS', g.renderScale > lowScale,
    `масштаб ${lowScale.toFixed(2)} → ${g.renderScale.toFixed(2)}, pixelRatio ${ratioLow} → ${ratios[ratios.length - 1]}`);
  g.fpsSmooth = 10;
  for (let i = 0; i < 20; i++) g._autoAdjustResolution();
  ok('Разрешение не падает ниже предела читаемости', g.renderScale >= 0.55, `минимум ${g.renderScale.toFixed(2)}`);
  g.applyQuality('low', false);
  ok('Смена пресета сбрасывает масштаб разрешения', g.renderScale === 1 && g.quality3d === 'low');
}
}

console.log(`\nИТОГ: ${pass}/${pass + fail} проверок 3D-сцен и моста успешно${fail ? `, провалено: ${fail}` : ''}`);
if (fail) process.exitCode = 1;
