// Точка входа VEXMORA — ГЛОБАЛЬНОЕ 3D-ОБНОВЛЕНИЕ.
// Игра запускается в полноценном 3D-режиме (three.js): объёмный мир, свободная
// камера от третьего лица, динамическое освещение и погода. Если WebGL недоступен,
// автоматически включается классический 2D-режим — прогресс и механики общие.

import { SoundEngine } from './audio.js';
import { GameEngine, detectQuality3D } from './engine.js';
import { Renderer } from './sprites.js';
import { InputController } from './input.js';
import { UIManager } from './ui.js';

const canvas2d = document.getElementById('game-canvas');     // 2D-слой (титул, мини-карта, фолбэк)
const canvas3d = document.getElementById('game-canvas-3d');  // WebGL-слой (основной режим)
const minimap = document.getElementById('minimap-canvas');
const loading3d = document.getElementById('loading3d');
const loadFill = document.getElementById('load3d-fill');
const loadHint = document.getElementById('load3d-hint');
const nolwebgl = document.getElementById('nolwebgl');

const sound = new SoundEngine();
const engine = new GameEngine(sound);
const renderer = new Renderer(canvas2d, minimap);
const ui = new UIManager(engine, renderer);

engine.paused = true;

// ── Ввод (2D-слой: клавиатура + джойстик; в 3D клавиатуру ведёт Game3D) ──
const input = new InputController({
  onUnlockAudio: () => sound.unlock(),
  onAttack: () => engine.performAttack(),
  onHeavy: () => engine.performHeavyAttack(),
  onJump: () => engine.jump(),
  onDash: () => engine.dash(),
  onGrenade: () => engine.throwGrenade(),
  onReload: () => engine.cycleWeapon(),
  onCycleWeapon: () => engine.cycleWeapon(),
  onQuickHeal: () => engine.useConsumable('medkit'),
  onBlock: (on) => { engine.player.blocking = on; },
  onSkill: (skillId) => engine.useSkill(skillId),
  onInteract: () => {
    const res = engine.interact();
    ui.handleInteractionResult(res);
  },
  onOpenTab: (tab) => {
    if (!document.getElementById('title-screen').classList.contains('hidden')) return;
    if (!document.getElementById('modal-panel').classList.contains('hidden') && ui.activeTab === tab) {
      ui.closeModal();
    } else {
      ui.openModal(tab);
    }
  },
  onEscape: () => {
    if (!document.getElementById('modal-panel').classList.contains('hidden') ||
        !document.getElementById('dialog-modal').classList.contains('hidden')) {
      ui.closeModal();
    }
  }
});

// ── Проверка WebGL ────────────────────────────────────────────────────────
function hasWebGL() {
  try {
    const probe = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && probe.getContext('webgl2')) ||
           !!(window.WebGLRenderingContext && (probe.getContext('webgl') || probe.getContext('experimental-webgl')));
  } catch {
    return false;
  }
}

// Ручное принуждение режима: ?mode=2d (отладка/слабые устройства), ?mode=3d (игнорирует автоподбор)
let forcedMode = null;
try {
  const p = new URLSearchParams(location.search).get('mode');
  if (p === '2d' || p === '3d') forcedMode = p;
} catch { /* location недоступен — обычный автозапуск */ }

const webglAvailable = hasWebGL();
let game3d = null;
let mode3d = false;

// Оверлей загрузки показываем ТОЛЬКО на время старта игры: если он висит
// на титульном экране, он перекрывает кнопки «Новая игра»/«Продолжить».
let loadingVisible = false;
// Даёт браузеру перерисовать оверлей загрузки между тяжёлыми этапами:
// без этого экран «замирает» на одном проценте, хотя работа идёт.
const nextFrame = () => new Promise((resolve) => {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
  else setTimeout(resolve, 0);
});

let skipTimer = null;
function showLoading() {
  if (!loading3d || loadingVisible) return;
  loadingVisible = true;
  loading3d.classList.remove('done');
  loading3d.style.display = 'flex';
  setLoading(10, 'Подготовка 3D-движка…');
  setLoading(12, 'Подготовка 3D-движка…');
  // Если через 6 с всё ещё грузимся — предлагаем сразу играть в 2D
  const skip = document.getElementById('btn3d-skip');
  if (skip) skip.classList.add('hidden');
  clearTimeout(skipTimer);
  skipTimer = setTimeout(() => {
    const btn = document.getElementById('btn3d-skip');
    if (btn && loadingVisible) {
      btn.classList.remove('hidden');
      const hint = document.getElementById('load3d-hint');
      if (hint) hint.textContent = 'Загрузка затянулась — можно играть в 2D';
    }
  }, 6000);
}
function hideLoading() {
  loadingVisible = false;
  clearTimeout(skipTimer);
  if (!loading3d) return;
  loading3d.classList.add('done');
  loading3d.style.display = 'none';
  document.getElementById('btn3d-skip')?.classList.add('hidden');
}
function setLoading(pct, text) {
  if (loadFill) loadFill.style.width = `${Math.max(8, Math.min(100, pct))}%`;
  if (loadHint && text) loadHint.textContent = text;
}

async function enable3D() {
  if (!webglAvailable || forcedMode === '2d') return false;
  try {
    showLoading();
    await nextFrame();                    // показываем «Подготовка 3D-движка…»
    setLoading(28, 'Генерация ландшафта и биомов…');
    // Динамический импорт: 2D-игра остаётся рабочей, если 3D-модули не загрузились
    const mod = await import('../js3d/game/game3d.js');
    await nextFrame();
    setLoading(58, 'Построение лесов, крепостей и руин…');
    const quality3d = engine.settings.quality3d || 'high';
    if (engine.settings.quality3dAuto && !engine.hasSaveGame?.()) {
      const detected = detectQuality3D();
      if (detected !== quality3d) {
        engine.settings.quality3d = detected;
        const labels = { low: 'Низкое', medium: 'Среднее', high: 'Высокое' };
        ui.toast?.(`🎚 Качество 3D подобрано под устройство: ${labels[detected]}`, '#7dd3fc');
      }
    }
    await nextFrame();
    // Конструктор без тяжёлой работы: сборка мира идёт этапами под прогресс-бар
    game3d = new mod.Game3D(canvas3d, engine, {
      quality: engine.settings.quality, quality3d, externalLoop: true, deferredInit: true,
      rendererFactory: window.__VEXMORA_RENDERER_FACTORY || null
    });
    await game3d.initStaged((pct, text) => setLoading(pct, text));
    game3d.attachRenderer2D(renderer);
    game3d._uiToggle = (tab) => {
      if (tab === null) { ui.closeModal(); return; }
      if (!document.getElementById('modal-panel').classList.contains('hidden') && ui.activeTab === tab) ui.closeModal();
      else ui.openModal(tab);
    };
    game3d._onInteract = (res) => ui.handleInteractionResult(res);
    game3d.start();                       // включает клавиатуру 3D-режима
    game3d.onError = (err) => {
      console.error('[VEXMORA 3D] Критическая ошибка, переключаюсь в 2D:', err);
      fallbackTo2D('3D-движок остановлен из-за ошибки');
    };
    game3d.onAutoQuality = (level) => {
      const labels = { low: 'Низкое', medium: 'Среднее', high: 'Высокое', ultra: 'Ультра' };
      ui.toast?.(`🎚 Качество графики: ${labels[level] || level}`, '#7dd3fc');
      engine.settings.quality3d = level;
    };
    setLoading(86, 'Компиляция шейдеров и текстур…');
    await nextFrame();
    // Пробный кадр: ошибки WebGL/шейдеров ловятся до старта игры
    game3d.update(0.016);
    game3d.render(0.016);
    mode3d = true;
    document.body.classList.add('mode3d');
    document.body.classList.remove('mode2d');
    input.keyboardEnabled = false;
    input.resetAll();
    ui.attach3D?.(game3d);
    window.__vexmora3d = game3d;
    setLoading(100, 'Готово');
    setTimeout(hideLoading, 400);
    return true;
  } catch (err) {
    console.error('[VEXMORA 3D] Не удалось запустить 3D-режим:', err);
    game3d = null;
    mode3d = false;
    document.body.classList.remove('mode3d');
    hideLoading();
    // Третья линия защиты: пробный кадр упал — играем в 2D, но не молчим
    ui.toast?.('⚠️ 3D недоступен на этом устройстве — включён 2D-режим', '#f59e0b');
    return false;
  }
}

function fallbackTo2D(reason) {
  if (game3d) {
    try { game3d.dispose(); } catch { /* уже остановлен */ }
    game3d = null;
  }
  mode3d = false;
  document.body.classList.remove('mode3d');
  document.body.classList.add('mode2d');
  input.keyboardEnabled = true;
  renderer.resize(engine.settings.quality);
  if (reason) ui.toast?.(`⚠️ ${reason}. Включён 2D-режим`, '#f59e0b');
}

// Кнопка «играть в 2D» прямо на экране загрузки (если 3D не успел)
let pendingStart = null;
document.getElementById('btn3d-skip')?.addEventListener('click', () => {
  const loadSaved = pendingStart === true;
  pendingStart = null;
  forcedMode = '2d';
  hideLoading();
  fallbackTo2D(null);
  if (!document.getElementById('title-screen').classList.contains('hidden')) ui.startGame(loadSaved);
});

// Кнопка «играть в 2D» на экране отсутствия WebGL
document.getElementById('btn-fallback-2d')?.addEventListener('click', () => {
  if (nolwebgl) nolwebgl.classList.remove('show');
  hideLoading();
  document.body.classList.add('mode2d');
});

// ── Старт игры ───────────────────────────────────────────────────────────
// Страховка: если инициализация 3D зависла (тяжёлый телефон, драйвер WebGL),
// через 20 с принудительно уходим в 2D — игра всегда запускается.
let startWatchdog = null;
async function startGame(loadSaved) {
  pendingStart = !!loadSaved;
  if (startWatchdog) clearTimeout(startWatchdog);
  if (webglAvailable && forcedMode !== '2d') {
    startWatchdog = setTimeout(() => {
      if (!mode3d) {
        console.warn('[VEXMORA 3D] Инициализация заняла слишком много времени — 2D-режим');
        fallbackTo2D('3D-движок не успел запуститься');
        hideLoading();
      }
    }, 20000);
  }
  const ok3d = await enable3D();
  if (startWatchdog) { clearTimeout(startWatchdog); startWatchdog = null; }
  if (ok3d) hideLoading();
  if (!ok3d && !webglAvailable && forcedMode !== '2d') {
    // Показываем экран совместимости, игра всё равно доступна в 2D
    if (nolwebgl) nolwebgl.classList.add('show');
    fallbackTo2D(null);
  } else if (!ok3d) {
    fallbackTo2D(forcedMode === '2d' ? 'Включён 2D-режим по запросу' : '3D недоступен на этом устройстве');
  }
  pendingStart = null;
  ui.startGame(loadSaved);
}

document.getElementById('btn-new-game')?.addEventListener('click', () => {
  input.resetAll();
  startGame(false);
});

document.getElementById('btn-continue-game')?.addEventListener('click', () => {
  input.resetAll();
  startGame(true);
});

// ── Главный цикл: движок → 3D-рендер (или 2D-рендер как фолбэк) ──────────
let lastTime = performance.now();
let fpsSmooth = 60;
let hudTick = 0;

function loop(now) {
  const rawDt = Math.max(0.001, (now - lastTime) / 1000);
  lastTime = now;

  const instFps = 1 / rawDt;
  fpsSmooth = fpsSmooth * 0.92 + instFps * 0.08;
  ui.fpsValue = fpsSmooth;

  if (!engine.paused) {
    // В 3D-режиме источник ввода — 3D-контроллер (стик #stick3d + клавиатура 3D).
    // Раньше всегда брался 2D-стик, который в 3D скрыт: герой не двигался со
    // стика, а клавиши дублировались. Теперь 2D-стик остаётся для 2D-режима.
    const state = (mode3d && game3d && typeof game3d.buildInputState === 'function')
      ? game3d.buildInputState(rawDt)
      : input.getState();
    engine.update(rawDt, state);
  }

  if (mode3d && game3d) {
    if (!engine.paused) {
      game3d.update(Math.min(rawDt, 0.05));
      game3d.render(Math.min(rawDt, 0.05));
    } else {
      // Пауза (открыто меню): 3D-сцена просто дорисовывается без обновления логики
      game3d.render(0.016);
    }
    if (!game3d.running) game3d.start();
  } else if (document.getElementById('title-screen').classList.contains('hidden') || !webglAvailable) {
    // Резервный 2D-режим: рисуем игру классическим рендерером
    renderer.render(engine);
  }

  if (document.getElementById('title-screen').classList.contains('hidden')) {
    hudTick += rawDt;
    if (hudTick > 0.12) { hudTick = 0; ui.updateHud(false); }
  }

  requestAnimationFrame(loop);
}

// Начальная отрисовка титульного экрана (2D-фон), затем старт цикла
renderer.render(engine);
requestAnimationFrame(loop);

// Прогреваем 3D-модуль заранее (без оверлея): к моменту нажатия «Играть»
// модуль уже в кеше, а титульный экран остаётся доступным.
// Оверлей загрузки в разметке виден по умолчанию — на титуле он не нужен.
hideLoading();
if (webglAvailable) {
  setTimeout(() => { import('../js3d/game/game3d.js').catch(() => {}); }, 120);
} else {
  document.body.classList.add('mode2d');
}

window.__vexmoraGame = {
  engine, renderer, ui, input,
  // Отладочные хуки (используются автотестами стартового экрана)
  debug: { showLoading, hideLoading, setLoading },
  get game3d() { return game3d; },
  get is3D() { return mode3d; }
};
window.__horizonGame = window.__vexmoraGame; // совместимый алиас для отладки
