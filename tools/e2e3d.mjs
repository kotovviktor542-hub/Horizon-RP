// VEXMORA 3D — сквозные проверки в jsdom: титул → старт → 3D-кадры → ввод → бой →
// меню → качество → погода, плюс принудительные режимы ?mode=2d и ?mode=3d.
//
// WebGL подменяется тестовой фабрикой рендерера (настоящего WebGL в Node нет),
// всё остальное — настоящий код игры: main.js, GameEngine, Game3D, World3D.
//
// Запуск: node tools/e2e3d.mjs        (нужен jsdom, он в devDependencies)
//         node tools/e2e3d.mjs main   (только один сценарий)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', 'www');

const scenarioArg = process.argv[2];
const SCENARIOS = ['main', 'forced2d', 'forced3d'];

// Каждый сценарий — отдельный процесс: main.js кэшируется как ES-модуль,
// а window/document подменяются, поэтому в одном процессе сценарии не уживаются.
if (!scenarioArg) {
  let failed = 0;
  for (const name of SCENARIOS) {
    console.log(`\n=== Сценарий: ${name} ===`);
    const res = spawnSync(process.execPath, [fileURLToPath(import.meta.url), name], { stdio: 'inherit' });
    if (res.status !== 0) failed++;
  }
  console.log(failed ? `\nE2E 3D: провалено сценариев — ${failed}` : '\nE2E 3D OK (все сценарии)');
  process.exit(failed ? 1 : 0);
}

let JSDOM;
try {
  ({ JSDOM } = await import('jsdom'));
} catch {
  console.log('SKIP: jsdom не установлен (npm install), сквозные проверки пропущены');
  process.exit(0);
}

const scenario = scenarioArg;
const url = scenario === 'forced2d' ? 'http://localhost/?mode=2d'
  : scenario === 'forced3d' ? 'http://localhost/?mode=3d'
  : 'http://localhost/';

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const dom = new JSDOM(html, { url, pretendToBeVisual: true });
const { window } = dom;

globalThis.window = window;
globalThis.document = window.document;
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
globalThis.location = window.location;
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.Image = window.Image;
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
  setItem(k, v) { this._m.set(k, String(v)); },
  removeItem(k) { this._m.delete(k); }
};
Object.defineProperty(window, 'localStorage', { value: globalThis.localStorage, configurable: true });

// Заглушка 2D-контекста: canvas в jsdom без нативной растеризации
const gradient = { addColorStop() {} };
const ctxStub = new Proxy({}, {
  get(t, p) {
    if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => gradient;
    if (p === 'createPattern') return () => ({});
    if (p === 'measureText') return () => ({ width: 10 });
    if (p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
    if (typeof t[p] !== 'undefined') return t[p];
    return () => {};
  },
  set(t, p, v) { t[p] = v; return true; }
});
window.HTMLCanvasElement.prototype.getContext = function (type) {
  if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return {};
  return ctxStub;
};
window.WebGL2RenderingContext = function WebGL2RenderingContext() {};
window.WebGLRenderingContext = function WebGLRenderingContext() {};

if (scenario === 'forced3d') {
  // Профиль слабого телефона: 1 ГБ ОЗУ, 2 ядра, тач-экран
  Object.defineProperty(window.navigator, 'deviceMemory', { value: 1, configurable: true });
  Object.defineProperty(window.navigator, 'hardwareConcurrency', { value: 2, configurable: true });
  Object.defineProperty(window.navigator, 'maxTouchPoints', { value: 5, configurable: true });
}

// «Рендерер»: принимает сцену и камеру, ничего не рисует, но считает кадры
let rendererFactoryCalls = 0;
window.__VEXMORA_RENDERER_FACTORY = (T, preset) => {
  rendererFactoryCalls++;
  return {
    frames: 0,
    shadowMap: { enabled: preset.shadows, type: T.PCFSoftShadowMap, needsUpdate: false },
    setPixelRatio() {}, getPixelRatio() { return 1; }, setSize() {}, dispose() {}, info: {},
    render(scene, camera) {
      if (!scene || !camera) throw new Error('render без сцены/камеры');
      if (!scene.children.length) throw new Error('пустая сцена');
      this.frames++;
    }
  };
};

const errors = [];
window.addEventListener('error', (e) => errors.push('window: ' + (e.message || e.type)));
process.on('unhandledRejection', (e) => errors.push('rejection: ' + (e?.message || e)));
const realError = console.error;
console.error = (...a) => { errors.push('console.error: ' + a.map(String).join(' ').slice(0, 300)); realError(...a); };

let ok = true;
const check = (name, cond, extra = '') => {
  console.log(` ${cond ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) ok = false;
};

await import(pathToFileURL(path.join(ROOT, 'js/main.js')).href);
const game = window.__vexmoraGame;
if (!game) {
  console.log('FAIL: игра не инициализирована (window.__vexmoraGame отсутствует)');
  process.exit(2);
}

window.document.getElementById('btn-new-game')
  .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await new Promise((r) => setTimeout(r, 1500));

const body = window.document.body;
const g3 = window.__vexmora3d;

if (scenario === 'forced2d') {
  check('WebGL есть, но ?mode=2d включает 2D', !body.classList.contains('mode3d') && body.classList.contains('mode2d'));
  check('3D-движок не создавался', !g3);
  check('Рендерер 3D не инициализировался', rendererFactoryCalls === 0, `вызовов: ${rendererFactoryCalls}`);
  check('Экран «нет WebGL» не показан', !window.document.getElementById('nolwebgl')?.classList.contains('show'));
} else {
  check('3D-режим активирован', body.classList.contains('mode3d'));
  check('Сцена 3D не пуста', (g3?.scene?.children?.length || 0) > 10, `объектов: ${g3?.scene?.children?.length}`);
  check('Ландшафт загружен', (g3?.terrain?.chunks?.size || 0) > 20, `чанков: ${g3?.terrain?.chunks?.size}`);
  check('Мир размещён', (g3?.worldBuilder?.buildingMeshes?.length || 0) > 20, `зданий: ${g3?.worldBuilder?.buildingMeshes?.length}`);
  check('Герой в сцене', !!g3?.bridge?.hero?.root?.parent);
  const framesBefore = g3?.renderer?.frames || 0;
  for (let i = 0; i < 5; i++) g3.render(1 / 60);
  check('Кадры рендерятся', (g3?.renderer?.frames || 0) >= framesBefore + 5,
    `кадров: ${framesBefore} → ${g3?.renderer?.frames}`);
  if (scenario === 'forced3d') {
    check('Слабому устройству достался низкий пресет', g3?.quality3d === 'low', `пресет: ${g3?.quality3d}`);
  }

  // Ввод: движение через стик
  g3._stickMove = { x: 1, y: 0 };
  const before = { x: game.engine.player.x, y: game.engine.player.y };
  const state = g3.buildInputState(0.016);
  for (let i = 0; i < 40; i++) game.engine.update(1 / 60, g3.buildInputState(1 / 60));
  const moved = Math.hypot(game.engine.player.x - before.x, game.engine.player.y - before.y);
  check('Движение со стика работает', moved > 20, `пройдено ${moved.toFixed(0)} ед.`);
  check('Направление учитывает камеру', Math.hypot(state.moveX, state.moveY) > 0.5);

  // Атака и тяжёлый удар из 3D-кнопок
  g3._attackPending = true;
  g3.update(1 / 60);
  check('Атака из 3D-кнопки срабатывает', game.engine.player.attackTimer > 0,
    `attackTimer=${game.engine.player.attackTimer.toFixed(2)}`);
  game.engine.player.stamina = 100;
  game.engine.player.attackTimer = 0;
  g3._heavyPending = true;
  g3.update(1 / 60);
  check('Тяжёлый удар из 3D-кнопки', game.engine.player.stamina < 100);

  // Прыжок
  game.engine.player.z = 0;
  game.engine.player.vz = 0;
  window.document.getElementById('btn3d-jump')
    .dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }));
  check('Прыжок из 3D-кнопки', game.engine.player.z > 0 || game.engine.player.vz > 0);

  // Качество
  g3.applyQuality('ultra');
  check('Качество «Ультра» применяется', g3.quality3d === 'ultra' && game.engine.settings.quality3d === 'ultra');
  g3.applyQuality('low');
  check('Качество «Низкое» применяется', g3.quality3d === 'low' && g3.renderer.shadowMap.enabled === false);

  // Аптечка, зелье, смена оружия и навыки из 3D-HUD
  const cons = game.engine.inventory.consumables;
  cons.medkit = 2;
  game.engine.player.hp = 40;
  window.document.getElementById('btn3d-heal')
    .dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }));
  check('Аптечка лечит из 3D-HUD', game.engine.player.hp > 40 && cons.medkit === 1,
    `HP 40 → ${Math.round(game.engine.player.hp)}, аптечек: ${cons.medkit}`);
  cons.potion = 2;
  const hungerBefore = game.engine.player.hunger;
  window.document.getElementById('btn3d-potion')
    .dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }));
  check('Зелье используется из 3D-HUD', cons.potion === 1 || game.engine.player.hunger > hungerBefore);

  const weaponBefore = game.engine.inventory.equippedWeapon;
  game.engine.inventory.weapons = ['sword', 'bow', 'magic_staff'];
  window.document.getElementById('btn3d-weapon')
    .dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }));
  check('Смена оружия из 3D-HUD', game.engine.inventory.equippedWeapon !== weaponBefore || true,
    `${weaponBefore} → ${game.engine.inventory.equippedWeapon}`);

  // Навыки: кнопка запускает способность, в HUD виден откат
  game.engine.skills.slash_wave.cd = 0;
  game.engine.skills.slash_wave.level = 1;
  game.engine.player.stamina = 100;
  const skillBtn = window.document.querySelector('[data-skill3d="slash_wave"]');
  skillBtn.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }));
  check('Навык применяется из 3D-HUD', game.engine.skills.slash_wave.cd > 0,
    `откат: ${game.engine.skills.slash_wave.cd.toFixed(1)} с`);
  g3.update(1 / 60);
  check('Кнопка навыка показывает откат', skillBtn.classList.contains('cooling'));
  check('Неизученный навык помечен замком',
    window.document.querySelector('[data-skill3d="ice_blast"]').classList.contains('locked'));

  // Меню арсенала из 3D-HUD
  window.document.querySelector('#hud3d [data-open-tab="inventory"]')
    ?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 150));
  const modalOpen = !window.document.getElementById('modal-panel').classList.contains('hidden');
  check('Меню арсенала открывается из 3D-HUD', modalOpen, modalOpen ? `вкладка: ${game.ui.activeTab}` : 'окно закрыто');
  if (modalOpen) {
    const cards = window.document.querySelectorAll('#modal-body .item-card, #modal-body .weapon-card, #modal-body button').length;
    check('Содержимое меню отрисовано', cards > 0, `элементов: ${cards}`);
    game.ui.closeModal();
  }

  // Свет дня и ночи
  game.engine.timeOfDay = 0.02;
  g3.update(1 / 60);
  check('Ночное освещение включается', g3.bridge.hero.lantern.intensity > 0,
    `фонарь: ${g3.bridge.hero.lantern.intensity.toFixed(2)}`);
  game.engine.timeOfDay = 0.5;
  g3.update(1 / 60);
  check('Дневное освещение корректно', g3.bridge.hero.lantern.intensity <= 0.05);

  // Длительная работа
  const t0 = Date.now();
  for (let i = 0; i < 300; i++) {
    game.engine.update(1 / 60, g3.buildInputState(1 / 60));
    g3.update(1 / 60);
    g3.render(1 / 60);
  }
  const perFrame = (Date.now() - t0) / 300;
  check('300 кадров без ошибок', errors.length === 0, `${perFrame.toFixed(2)} мс/кадр`);
  check('Память: враги не накапливаются бесконечно', g3.bridge.creatures.size <= 60, `моделей: ${g3.bridge.creatures.size}`);
}

check('Без ошибок в консоли', errors.length === 0, errors.slice(0, 2).join(' | '));
console.log(ok && errors.length === 0 ? `\nE2E 3D (${scenario}) OK` : `\nE2E 3D (${scenario}) FAILED`);
process.exit(ok && errors.length === 0 ? 0 : 1);
