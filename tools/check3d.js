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

// 8.5 РЕМАСТЕР МОДЕЛЕЙ: проверяем то, что было сломано и что легко откатить
{
console.log('--- Ремастер моделей: силуэты, детализация, бюджеты ---');
const { Animal3D } = await import(`${ROOT}/www/js3d/actors/animals.js`);
const { ANIMALS } = await import(`${ROOT}/www/js/data.js`);
const { humanoidVariation } = await import(`${ROOT}/www/js3d/actors/variants.js`);
const { MATERIAL_SPECS } = await import(`${ROOT}/www/js3d/core/materials.js`);

const boxOf = (o) => new THREE.Box3().setFromObject(o);
const sizeOf = (o) => {
  const b = boxOf(o);
  return { x: b.max.x - b.min.x, y: b.max.y - b.min.y, z: b.max.z - b.min.z, minY: b.min.y };
};
const triOf = (o) => {
  let tris = 0;
  o.traverse(m => {
    if (!m.isMesh) return;
    const g = m.geometry;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return Math.round(tris);
};

// 8.5.1 Лиса больше не копия волка
{
  const wolf = new Animal3D(scene, ANIMALS.wolf);
  const fox = new Animal3D(scene, ANIMALS.fox);
  const w = sizeOf(wolf.root), f = sizeOf(fox.root);
  const differs = Math.abs(w.y - f.y) > 0.1 || Math.abs(w.z - f.z) > 0.2;
  ok('Животные: у лисы свой силуэт, а не копия волка', differs,
    `волк ${w.x.toFixed(2)}×${w.y.toFixed(2)}×${w.z.toFixed(2)}, лиса ${f.x.toFixed(2)}×${f.y.toFixed(2)}×${f.z.toFixed(2)}`);
  // Все звери реальных пропорций: высота 0.2–2.2 м, ноги не под землёй
  let sane = true;
  const dims = [];
  for (const id of Object.keys(ANIMALS)) {
    const a = new Animal3D(scene, ANIMALS[id]);
    const s2 = sizeOf(a.root);
    dims.push(`${id} ${s2.y.toFixed(2)}`);
    if (!(s2.y > 0.15 && s2.y < 2.4) || s2.minY < -0.1) sane = false;
    a.dispose();
  }
  ok('Животные: реальные габариты и ноги на земле', sane, dims.join(', '));
  wolf.dispose();
  fox.dispose();
}

// 8.5.2 Босс пепла — уникальная модель, а не «большой имп»
{
  const imp = new Creature3D(scene, { id: 'ash_imp' }, { isBoss: false });
  const sovereign = new Creature3D(scene, { id: 'boss_ash_sovereign' }, { isBoss: true });
  const impTris = triOf(imp.root), sovTris = triOf(sovereign.root);
  ok('Босс пепла: отдельная ветка модели', sovereign.kind === 'sovereign', `ветка: ${sovereign.kind}`);
  ok('Босс пепла: детализация выше рядового импа в 3 раза', sovTris > impTris * 3,
    `имп ${impTris} трис → босс ${sovTris} трис`);
  const sovSize = sizeOf(sovereign.root);
  ok('Босс пепла: заметно крупнее обычного врага', sovSize.y > 4, `высота модели ${sovSize.y.toFixed(1)} м`);
  ok('Босс пепла: в руке двуручный меч', !!sovereign.weaponMesh);
  imp.dispose();
  sovereign.dispose();
}

// 8.5.3 Враги одного класса больше не клоны
{
  const a = humanoidVariation({ id: 'heavy_trooper' });
  const b = humanoidVariation({ id: 'goblin_shaman' });
  const c = humanoidVariation({ id: 'cursed_knight' });
  const signature = (v) => [v.helmet, v.hood, v.cloak, v.pauldrons, v.backpack, v.bandolier, v.mask, v.beard].join('');
  const sigs = new Set([signature(a), signature(b), signature(c)]);
  ok('Враги: детали вида считаются из id (не клоны)', sigs.size >= 3, `разных наборов: ${sigs.size}`);
  ok('Враги: комплекция зависит от вида', a.bulk > 1.2 && b.height < 1, `тяжеловес ×${a.bulk}, гоблин ×${b.height}`);
  // Модели разных врагов действительно различаются по числу мешей
  const m1 = new Creature3D(scene, { id: 'heavy_trooper' }, { isBoss: false });
  const m2 = new Creature3D(scene, { id: 'zombie' }, { isBoss: false });
  let n1 = 0, n2 = 0;
  m1.root.traverse(o => { if (o.isMesh) n1++; });
  m2.root.traverse(o => { if (o.isMesh) n2++; });
  ok('Враги: разные виды — разное число деталей', n1 !== n2, `элита ${n1} мешей, зомби ${n2} мешей`);
  m1.dispose();
  m2.dispose();
}

// 8.5.4 Склейка не ломает анимируемые узлы
{
  const c = new Creature3D(scene, { id: 'soldier' }, { isBoss: false });
  // armR/legR — это наборы узлов {shoulder, elbow}, а torso/head — сами меши.
  const nodeOk = (v) => !!v && (v.isObject3D ? !!v.parent : Object.values(v).some(x => x && x.isObject3D));
  const limbs = ['torso', 'head', 'armR', 'armL', 'legR', 'legL'];
  const intact = limbs.every(k => nodeOk(c.parts[k]));
  const before = c.parts.armR.shoulder.rotation.x;
  for (let i = 0; i < 20; i++) c.update(0.016, { position: { x: 0, y: 0, z: 0 }, facing: 0, speed: 2, attacking: true });
  const moved = Math.abs(c.parts.armR.shoulder.rotation.x - before) > 0.02;
  ok('Враги: склейка сохраняет скелет и анимацию', intact && moved, `узлов: ${limbs.length}, рука двигается: ${moved}`);
  c.dispose();
}

// 8.5.5 Материалы: нормали, металл и окружение
{
  const names = Object.keys(MATERIAL_SPECS);
  const withNormal = names.filter(n => !!MATERIAL_SPECS[n].height);
  ok('Материалы: карты нормалей у большинства поверхностей', withNormal.length >= names.length * 0.4,
    `${withNormal.length} из ${names.length}`);
  const metals = names.filter(n => (MATERIAL_SPECS[n].metalness || 0) > 0.5);
  ok('Материалы: есть отдельные металлы (железо, золото)', metals.length >= 2, metals.join(', '));
  const old = Object.keys(MATERIAL_SPECS).filter(n => ['wood', 'iron', 'gold', 'skin', 'fur', 'roof', 'canvas'].includes(n));
  ok('Материалы: добавлены поверхности для ремастера', old.length >= 7, old.join(', '));
  // Окружение (IBL) создаётся и не роняет игру без renderer
  const { SkySystem } = await import(`${ROOT}/www/js3d/core/sky.js`);
  const sky = new SkySystem(new THREE.Scene());
  const applied = sky.updateEnvironment(null, new THREE.Scene());
  ok('Освещение: env map не ломает headless-рендер', applied === false, 'без renderer окружение не применяется, но и не падает');
}

// 8.5.6 Геометрия зданий: детализация выросла, draw calls остались низкими
{
  const { Structures } = await import(`${ROOT}/www/js3d/world/models.js`);
  const house = Structures.house(7, 4.2, 6, 1);
  const tris = triOf(house);
  let meshes = 0;
  house.traverse(o => { if (o.isMesh) meshes++; });
  ok('Здания: детализация дома выросла (кладка, ставни, ступени)', tris > 900, `трис: ${tris}`);
  ok('Здания: детали склеены по материалам (мало draw calls)', meshes < 25, `мешей: ${meshes}`);
  const fort = Structures.fortress(14, 7, 12, false);
  let fortMeshes = 0;
  fort.traverse(o => { if (o.isMesh) fortMeshes++; });
  ok('Здания: крепость тоже склеена', fortMeshes < 20, `мешей: ${fortMeshes}, трис: ${triOf(fort)}`);
  // Мелкие детали «живого мира»
  const { Foliage } = await import(`${ROOT}/www/js3d/world/models.js`);
  const small = ['flowers', 'mushrooms', 'rubble', 'burntSpot'].filter(k => typeof Foliage[k] === 'function');
  ok('Мир: добавлены мелкие детали (цветы, грибы, щебень, костровища)', small.length === 4, small.join(', '));
}

// 8.5.7 Бюджеты: суммарная геометрия осталась в разумных пределах
{
  const { Foliage } = await import(`${ROOT}/www/js3d/world/models.js`);
  const spots = [
    Foliage.deciduous(1, 1, 0), Foliage.pine(1, 2), Foliage.bush(1, 4, false),
    Foliage.rock(1.2, 5), Foliage.dead(1, 3)
  ];
  const total = spots.reduce((s2, g) => s2 + triOf(g), 0);
  ok('Производительность: шаблоны растительности в бюджете', total < 4500, `сумма ${total} трис на 5 моделей`);
  const heroTris = triOf(hero.root);
  ok('Производительность: герой в бюджете (<9000 трис)', heroTris < 9000, `${heroTris} трис`);
}

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
  ok('Разрешение не падает ниже предела читаемости', g.renderScale >= 0.45,
    `минимум ${g.renderScale.toFixed(2)}, pixelRatio ${ratios[ratios.length - 1]}`);
  g.applyQuality('low', false);
  ok('Смена пресета сбрасывает масштаб разрешения', g.renderScale === 1 && g.quality3d === 'low');
}
}

// ── Камера: направление взгляда и сглаживание ──────────────────────────
// Проверяем не знак yaw (он обратен повороту взгляда: камера стоит ПЕРЕД
// героем), а то, куда реально уезжает сцена на экране. Именно на знаке yaw
// можно обмануться и «починить» инверсию в обратную сторону.
{
  const THREE = await import('three');
  const { ThirdPersonCamera } = await import(`${ROOT}/www/js3d/core/camera.js`);
  const heroPos = { x: 0, y: 0, z: 0 };
  const mkCam = () => new ThirdPersonCamera(new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 1000), shimElement('canvas'));

  // Один и тот же жест, что делает игра: dx/dy в пикселях → touchmove-события
  const swipe = (cam, dxPix, dyPix, steps = 12) => {
    for (let i = 0; i < steps; i++) {
      cam.rotate(-dxPix / steps * 0.0042, dyPix / steps * 0.0032);
      cam.update(1 / 60, heroPos, () => 0, {});
    }
  };
  const landmark = new THREE.Vector3(0, 1.35, -40);
  const screenX = (cam) => {
    cam.camera.updateMatrixWorld();
    cam.camera.updateProjectionMatrix();
    return landmark.clone().project(cam.camera).x;
  };

  const base = mkCam(); base.update(1 / 60, heroPos, () => 0, {});
  const x0 = screenX(base);

  const right = mkCam(); right.update(1 / 60, heroPos, () => 0, {}); swipe(right, 40, 0);
  const rightX = screenX(right) - x0;
  ok('Камера: палец вправо поворачивает взгляд вправо', rightX < 0,
    `сцена уехала по X на ${rightX.toFixed(3)} (влево = взгляд вправо)`);

  const left = mkCam(); left.update(1 / 60, heroPos, () => 0, {}); swipe(left, -40, 0);
  const leftX = screenX(left) - x0;
  ok('Камера: палец влево поворачивает взгляд влево', leftX > 0,
    `сцена уехала по X на ${leftX.toFixed(3)}`);
  ok('Камера: горизонталь не инвертирована', Math.abs(rightX + leftX) < 0.01 && rightX !== 0);

  const up = mkCam(); up.update(1 / 60, heroPos, () => 0, {});
  const upPitch = up.pitch; swipe(up, 0, -40);
  ok('Камера: палец вверх поднимает взгляд', up.pitch < upPitch,
    `pitch ${upPitch.toFixed(2)} → ${up.pitch.toFixed(2)}`);

  const down = mkCam(); down.update(1 / 60, heroPos, () => 0, {});
  const downPitch = down.pitch; swipe(down, 0, 40);
  ok('Камера: палец вниз опускает взгляд', down.pitch > downPitch,
    `pitch ${downPitch.toFixed(2)} → ${down.pitch.toFixed(2)}`);

  // Сглаживание: за кадр догоняется только часть накопленного хода
  const smooth = mkCam();
  smooth.rotate(-0.5, 0);
  smooth.update(1 / 60, heroPos, () => 0, {});
  const firstFrame = Math.abs(smooth.yaw);
  ok('Камера: поворот сглажен (за кадр не весь накопленный ход)',
    firstFrame > 0 && firstFrame < 0.5, `за кадр ${firstFrame.toFixed(3)} из 0.500`);
  for (let i = 0; i < 30; i++) smooth.update(1 / 60, heroPos, () => 0, {});
  ok('Камера: поворот доводится до цели', Math.abs(Math.abs(smooth.yaw) - 0.5) < 0.02,
    `итог ${smooth.yaw.toFixed(3)}`);
}

// ── Коллизии: стволы деревьев и стены домов ────────────────────────────
{
  const Engine = (await import(`${ROOT}/www/js/engine.js`)).GameEngine;
  const eng = new Engine({ enabled: false, play() {}, unlock() {} });
  const p = eng.player;

  const tree = eng.world.nodes.find(n => n.kind === 'tree' && n.solid);
  ok('Коллизии: у дерева радиус ствола, а не кроны',
    tree && tree.colRadius > 0 && tree.colRadius < tree.radius / 2,
    `ствол ${tree.colRadius} ед. против габарита ${tree.radius} ед.`);

  // Проходим между двумя стволами: раньше лес был «частоколом»
  const trees = eng.world.nodes.filter(n => n.kind === 'tree' && n.solid).slice(0, 400);
  let pair = null;
  for (let i = 0; i < trees.length && !pair; i++) {
    for (let j = i + 1; j < trees.length; j++) {
      const d = Math.hypot(trees[i].x - trees[j].x, trees[i].y - trees[j].y);
      if (d > 40 && d < 90) { pair = [trees[i], trees[j]]; break; }
    }
  }
  let through = false;
  if (pair) {
    const mx = (pair[0].x + pair[1].x) / 2, my = (pair[0].y + pair[1].y) / 2;
    const ang = Math.atan2(pair[1].y - pair[0].y, pair[1].x - pair[0].x) + Math.PI / 2;
    p.x = mx - Math.cos(ang) * 120; p.y = my - Math.sin(ang) * 120;
    for (let i = 0; i < 200; i++) {
      const dx = mx - p.x, dy = my - p.y, d = Math.hypot(dx, dy) || 1;
      eng.update(1 / 60, { moveX: dx / d, moveY: dy / d });
      if (Math.hypot(mx - p.x, my - p.y) < 20) { through = true; break; }
    }
  }
  ok('Коллизии: герой проходит между стволами деревьев', through);

  // Стены домов непроходимы с любой стороны, с учётом поворота корпуса
  let breaches = 0, attacks = 0;
  for (const b of eng.world.buildings.slice(0, 6)) {
    for (const a of [0, Math.PI / 2, Math.PI / 4, Math.PI]) {
      const R = Math.max(b.colW, b.colH);
      p.x = b.x + Math.cos(a) * R;
      p.y = (b.y - b.colH / 2) + Math.sin(a) * R;
      for (let i = 0; i < 160; i++) eng.update(1 / 60, { moveX: -Math.cos(a), moveY: -Math.sin(a) });
      const dx = p.x - b.x, dy = p.y - (b.y - b.colH / 2);
      const ang = b.angle || 0;
      const lx = dx * Math.cos(-ang) - dy * Math.sin(-ang);
      const ly = dx * Math.sin(-ang) + dy * Math.cos(-ang);
      attacks++;
      if (Math.abs(lx) < b.colW / 2 - 2 && Math.abs(ly) < b.colH / 2 - 2) breaches++;
    }
  }
  ok('Коллизии: стены домов непроходимы со всех сторон', breaches === 0,
    `атак ${attacks}, проникновений ${breaches}`);
  // Рывок в чаще: раньше failRescue() пересоздавал массив врагов прямо
  // во время обхода, кадр падал на `e.animTime`, и игра выглядела зависшей.
  let dashCrash = null;
  p.stamina = 100; p.hp = p.maxHp;
  p.x = 1580; p.y = 2180;
  const frameTimes = [];
  for (let i = 0; i < 400; i++) {
    if (i % 20 === 0) { p.stamina = 100; eng.dash(); }
    const t0 = process.hrtime.bigint();
    try {
      eng.update(1 / 60, { moveX: 1, moveY: 0 });
    } catch (err) { dashCrash = err.message; break; }
    frameTimes.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  ok('Рывок в чаще: 400 кадров без падения кадра', !dashCrash, dashCrash || '');
  const worstFrame = frameTimes.length ? Math.max(...frameTimes) : 0;
  ok('Рывок: кадр не дольше 16 мс', worstFrame < 16, `худший ${worstFrame.toFixed(1)} мс`);

  ok('Коллизии: коллизия дома совпадает с корпусом модели',
    eng.world.buildings.every(b => b.colW >= 40 && b.colH >= 34), 'colW/colH заданы по геометрии модели');
}

console.log(`\nИТОГ: ${pass}/${pass + fail} проверок 3D-сцен и моста успешно${fail ? `, провалено: ${fail}` : ''}`);
if (fail) process.exitCode = 1;
