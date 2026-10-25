// Точка входа: связывает игровой движок, 2D-рендерер, мультитач-ввод и интерфейс

import { createGameEngine, SAVE_KEY } from './engine.js';
import { createRenderer } from './sprites.js';
import { createUI } from './ui.js';
import { createInputController } from './input.js';
import { sound } from './audio.js';

const canvas = document.getElementById('game-canvas');
const engine = createGameEngine();

// Загружаем сохранённые настройки звука/графики при запуске
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.settings) {
      Object.assign(engine.state.settings, parsed.settings);
      sound.setSettings(engine.state.settings);
    }
  }
} catch (_e) {
  // игнорируем при приватном режиме
}

const renderer = createRenderer(canvas, engine);
const ui = createUI(engine, renderer, () => {
  lastTime = performance.now();
});
const input = createInputController(engine, ui);

window.addEventListener('resize', () => renderer.resize());
window.addEventListener('orientationchange', () => setTimeout(() => renderer.resize(), 120));

renderer.resize();
ui.showMainMenu();

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
  lastTime = now;

  if (!engine.state.paused && !engine.state.gameOver) {
    const inp = input.poll();
    engine.update(dt, inp);
    ui.updateHud(false);
  } else {
    // Плавная живая панорама лагеря на фоне главного меню
    engine.state.playTime += dt * 0.45;
  }

  renderer.render();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// Экспорт для автотестов и инспекции
window.__horizonGame = { engine, renderer, ui, input };
