// Точка входа VEXMORA — БОЛЬШОЕ ОБНОВЛЕНИЕ ИГРЫ (2D Pixel-Art Action-Survival RPG)

import { SoundEngine } from './audio.js';
import { GameEngine } from './engine.js';
import { Renderer } from './sprites.js';
import { InputController } from './input.js';
import { UIManager } from './ui.js';

const canvas = document.getElementById('game-canvas');
const minimap = document.getElementById('minimap-canvas');

const sound = new SoundEngine();
const engine = new GameEngine(sound);
const renderer = new Renderer(canvas, minimap);
const ui = new UIManager(engine, renderer);

engine.paused = true;

const input = new InputController({
  onUnlockAudio: () => sound.unlock(),
  onAttack: () => engine.performAttack(),
  onJump: () => engine.jump(),
  onDash: () => engine.dash(),
  onGrenade: () => engine.throwGrenade(),
  onReload: () => engine.reloadWeapon(),
  onCycleWeapon: () => engine.cycleWeapon(),
  onQuickHeal: () => engine.useConsumable('medkit'),
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

document.getElementById('btn-new-game')?.addEventListener('click', () => {
  input.resetAll();
  ui.startGame(false);
});

document.getElementById('btn-continue-game')?.addEventListener('click', () => {
  input.resetAll();
  ui.startGame(true);
});

window.addEventListener('resize', () => {
  renderer.resize(engine.settings.quality);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && document.getElementById('title-screen').classList.contains('hidden')) {
    engine.saveGame(true);
  }
});

let lastTime = performance.now();
let fpsSmooth = 60;

function loop(now) {
  const rawDt = Math.max(0.001, (now - lastTime) / 1000);
  lastTime = now;

  const instFps = 1 / rawDt;
  fpsSmooth = fpsSmooth * 0.92 + instFps * 0.08;
  ui.fpsValue = fpsSmooth;

  if (!engine.paused) {
    engine.update(rawDt, input.getState());
  }

  renderer.render(engine);

  if (document.getElementById('title-screen').classList.contains('hidden')) {
    ui.updateHud(false);
  }

  requestAnimationFrame(loop);
}

renderer.render(engine);
requestAnimationFrame(loop);

window.__vexmoraGame = { engine, renderer, ui, input };
window.__horizonGame = window.__vexmoraGame; // совместимый алиас для отладки
