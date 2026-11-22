// VEXMORA 3D — игровой контроллер: WebGL-рендерер, сцена, качество графики,
// освещение/тени, связь ввода с движком, HUD-оверлей, мини-карта, погода.
// Это «фасад», который main.js включает вместо 2D-рендерера.

import * as THREE from 'three';
import { SkySystem, WORLD_SCALE } from '../core/sky.js';
import { TerrainManager } from '../world/terrain.js';
import { WorldBuilder } from '../world/worldbuilder.js';
import { ThirdPersonCamera } from '../core/camera.js';
import { Effects3D } from '../core/effects.js';
import { World3D } from './worldbridge.js';
import { CAMPFIRES } from '../../js/data.js';
import { setDeferTextures, pendingMaterialNames, textureMaterial, materialNames } from '../core/materials.js';
import { LightBudget } from '../actors/creatures.js';

const QUALITY_PRESETS = {
  // pixelRatio — потолок плотности пикселей. На телефоне devicePixelRatio = 3:
  // рендер «высокого» в 1.35×3 = 4 млн пикселей на кадр съедал GPU. Теперь
  // множитель привязан к DPR примерно как 0.5×–0.75×, а адаптивное разрешение
  // (renderScale) добирает остальное, если кадры успевают.
  low: {
    label: 'Низкое', pixelRatio: 0.7, shadows: false, shadowSize: 512,
    viewRadius: 2, aa: false, anisotropy: 1, particles: 0.4, weather: false, grass: false, softShadows: false,
    dynamicLights: false, maxDynamic: 0, shadowDistance: 0,
    drawDistance: { boss: 55, enemy: 45 }
  },
  medium: {
    label: 'Среднее', pixelRatio: 0.9, shadows: true, shadowSize: 1024,
    viewRadius: 3, aa: false, anisotropy: 2, particles: 0.7, weather: true, grass: true, softShadows: false,
    dynamicLights: false, maxDynamic: 0, shadowDistance: 34,
    drawDistance: { boss: 75, enemy: 60 }
  },
  high: {
    label: 'Высокое', pixelRatio: 1.1, shadows: true, shadowSize: 2048,
    viewRadius: 4, aa: true, anisotropy: 4, particles: 1, weather: true, grass: true,
    dynamicLights: false, maxDynamic: 0, shadowDistance: 48,
    drawDistance: { boss: 90, enemy: 70 }
  },
  ultra: {
    label: 'Ультра', pixelRatio: 1.5, shadows: true, shadowSize: 2048,
    viewRadius: 5, aa: true, anisotropy: 8, particles: 1.3, weather: true, grass: true,
    dynamicLights: true, maxDynamic: 6, shadowDistance: 62,
    drawDistance: { boss: 110, enemy: 85 }
  }
};

// Тени — самый дорогой проход: сцена рендерится второй раз. Дальность теней
// и бюджет источников света задаются пресетом (на слабых телефонах — 0).
const SHADOW_DEFAULTS = { shadowDistance: 0, dynamicLights: false, maxDynamic: 0 };

export { QUALITY_PRESETS };

export class Game3D {
  constructor(canvas, engine, options = {}) {
    this.canvas = canvas;
    this.engine = engine;
    this.quality = options.quality || engine.settings?.quality || 'medium';
    if (!QUALITY_PRESETS[this.quality]) this.quality = 'medium';
    this.quality3d = options.quality3d || 'high';   // независимое качество 3D
    this.running = false;
    this.ready = false;
    // Внешний цикл: кадры вызывает main.js (единый игровой цикл движка и 3D)
    this.externalLoop = options.externalLoop !== false;
    this.lastTime = 0;
    this.fpsSmooth = 60;
    this.frameCount = 0;
    this.autoQualityTimer = 0;
    this.autoQualityEnabled = options.autoQuality !== false;
    // Динамическое разрешение: если FPS низкий, сначала режем разрешение кадра,
    // а не весь пресет — картинка остаётся детальной, но плавность возвращается.
    this.renderScale = 1;
    this._resScaleMin = 0.45;       // на слабых GPU разрешение может упасть сильнее
    this._fpsHistory = [];          // короткая история FPS для стабильных решений
    this._resTimer = 0;
    this.options = options;

    if (options.deferredInit) {
      // Инициализация будет вызвана через initStaged() из main.js
      this._deferred = true;
      return;
    }
    this._initRenderer();
    this._initScene();
    this._initWorld();
    this._initUI();
    this._bindResize();
  }

  // Мир движка пересоздан («Новая игра», смена континента): перестраиваем
  // ландшафт и объекты, иначе 3D-сцена осталась бы на прежней карте.
  rebuildWorld() {
    const map = this.engine.world?.map || null;
    if (!map) return false;
    // Если карта та же самая — пересборка не нужна
    if (map === this.map && this.worldBuilder?.world === this.engine.world) return false;
    try { this.bridge?.dispose(); } catch { /* мост мог быть не создан */ }
    try { this.worldBuilder?.dispose(); } catch { /* уже удалён */ }
    try { this.terrain?.dispose(); } catch { /* уже удалён */ }
    // Группы старых объектов убираем из сцены (материалы общие, их не трогаем)
    if (this.terrain?.group) this.scene.remove(this.terrain.group);
    if (this.worldBuilder?.group) this.scene.remove(this.worldBuilder.group);
    this.map = map;
    this._initWorld();
    // Камера — к новому спавну
    const hx = this.engine.player.x * WORLD_SCALE;
    const hz = this.engine.player.y * WORLD_SCALE;
    const gy = this.terrain.heightAt3D(hx, hz);
    this.controls?.smoothTarget?.set(hx, gy + 1.35, hz);
    return true;
  }

  // Этапная инициализация для экрана загрузки: тяжёлая сборка мира идёт
  // по шагам, между ними браузер успевает перерисовать прогресс.
  async initStaged(onProgress = () => {}) {
    // Сначала строим мир с базовыми материалами (мгновенно), текстуры — потом
    setDeferTextures(true);
    try {
      return await this._initStaged(onProgress);
    } finally {
      setDeferTextures(false);
    }
  }

  async _initStaged(onProgress = () => {}) {
    onProgress(20, 'Подготовка рендерера…');
    await Promise.resolve();
    this._initRenderer();
    onProgress(40, 'Создание неба и света…');
    await Promise.resolve();
    this._initScene();
    onProgress(62, 'Генерация ландшафта и биомов…');
    await Promise.resolve();
    this._initWorld();
    onProgress(88, 'Интерфейс и управление…');
    await Promise.resolve();
    this._initUI();
    this._bindResize();
    onProgress(92, 'Текстуры камня, дерева и металла…');
    // Прогресс внутри этапа: полоса доезжает от 92% до 100% по мере готовности карт
    await this.applyTexturesStaged((done, total) => {
      onProgress(92 + Math.round((done / Math.max(1, total)) * 7), 'Текстуры камня, дерева и металла…');
    });
    onProgress(100, 'Готово');
    return this;
  }

  // Дорисовывает процедурные текстуры по ОДНОЙ на кадр: генерация карт
  // 512²/1024² занимает десятки-сотни мс, синхронный блок вешал телефон.
  async applyTexturesStaged(onStep) {
    const pending = pendingMaterialNames();
    const names = pending.length ? pending : [];
    const all = materialNames();
    const quality = this.quality3d;
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      try { textureMaterial(name, quality); } catch (err) { console.warn('[VEXMORA 3D] текстура', name, err?.message); }
      onStep?.(i + 1, names.length, name);
      // Уступаем кадр, чтобы прогресс-бар и сцена перерисовывались
      await new Promise((r) => {
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => r());
        else setTimeout(r, 0);
      });
    }
    setDeferTextures(false);
    return { textured: names.length, total: all.length };
  }


  // ── Рендерер ───────────────────────────────────────────────────────────
  _initRenderer() {
    const preset = QUALITY_PRESETS[this.quality3d] || QUALITY_PRESETS.high;
    // Бюджет динамических источников света по пресету: на мобильном GPU
    // каждый PointLight считается для всех материалов, поэтому их мало.
    LightBudget.dynamicLights = !!preset.dynamicLights;
    LightBudget.maxDynamic = preset.maxDynamic || 0;
    // Дальность отрисовки существ: дальние модели не попадают в кадр,
    // но логика движка их по-прежнему обрабатывает.
    if (this.bridge) this.bridge.drawDistance = preset.drawDistance;
    // Фабрика рендерера позволяет подменять WebGL в автотестах и на сервере
    if (this.options.rendererFactory) {
      this.renderer = this.options.rendererFactory(THREE, preset);
      this.camera = new THREE.PerspectiveCamera(62, (window.innerWidth || 1280) / (window.innerHeight || 720), 0.1, 1200);
      this.camera.position.set(0, 8, 10);
      this.controls = new ThirdPersonCamera(this.camera, this.canvas);
      return;
    }
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: preset.aa,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
      preserveDrawingBuffer: false
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, preset.pixelRatio));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = preset.shadows;
    // PCFSoft — 9 сэмплов на пиксель; на мобильном это заметно дороже. Мягкие
    // тени оставляем только «Высокому» и «Ультре».
    renderer.shadowMap.type = preset.softShadows === false
      ? THREE.PCFShadowMap
      : THREE.PCFSoftShadowMap;
    renderer.info.autoReset = true;
    this.renderer = renderer;

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
    this.camera.position.set(0, 8, 10);

    this.controls = new ThirdPersonCamera(this.camera, this.canvas);
  }

  _initScene() {
    const scene = new THREE.Scene();
    this.scene = scene;
    this.sky = new SkySystem(scene);
    this.sky.setQuality(this.quality3d);
    this.effects = new Effects3D(scene);
  }

  _initWorld() {
    const map = this.engine.world?.map || null;
    this.map = map;

    this.terrain = new TerrainManager(this.scene, map, this.quality3d);
    this.terrain.setQuality(this.quality3d);

    const startPos = { x: this.engine.player.x * WORLD_SCALE, z: this.engine.player.y * WORLD_SCALE };
    // Прогреваем чанки вокруг стартовой позиции, чтобы не было пустого экрана
    this.terrain.update(startPos, 0.016, this.quality3d);

    this.worldBuilder = new WorldBuilder(
      this.scene, this.engine.world, map, this.terrain, this.quality3d,
      { campfires: CAMPFIRES }
    );

    this.bridge = new World3D(this.engine, this.scene, this.terrain, this.effects, { quality: this.quality3d });

    // Начальная позиция камеры
    const gy = this.terrain.heightAt3D(startPos.x, startPos.z);
    this.controls.smoothTarget.set(startPos.x, gy + 1.35, startPos.z);
    this.controls.yaw = -Math.PI / 2 + (this.engine.player.facing || 0);
    this.controls.update(0.016, { x: startPos.x, y: gy, z: startPos.z }, (x, z) => this.terrain.heightAt3D(x, z));

    this.ready = true;
  }

  // ── Качество графики ───────────────────────────────────────────────────
  _applyPixelRatio() {
    const preset = QUALITY_PRESETS[this.quality3d] || QUALITY_PRESETS.high;
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const ratio = Math.max(0.5, Math.min(dpr, preset.pixelRatio) * this.renderScale);
    this.renderer.setPixelRatio(Number(ratio.toFixed(3)));
  }

  applyQuality(level, persist = true) {
    if (!QUALITY_PRESETS[level]) return;
    this.quality3d = level;
    if (persist) {
      this.engine.settings.quality3d = level;
      this._qualityPinned = true;
      this.engine.saveGame?.(true);
    }
    const preset = QUALITY_PRESETS[level];
    const r = this.renderer;
    this.renderScale = 1;               // новый пресет — начинаем с полного разрешения
    this._applyPixelRatio();
    r.setSize(window.innerWidth, window.innerHeight, false);
    r.shadowMap.enabled = preset.shadows;
    r.shadowMap.needsUpdate = true;
    this.sky.setQuality(level);
    this.terrain.setQuality(level);
    // Дальность отрисовки существ и бюджет света следуют за пресетом
    if (this.bridge) this.bridge.drawDistance = preset.drawDistance;
    LightBudget.dynamicLights = !!preset.dynamicLights;
    LightBudget.maxDynamic = preset.maxDynamic || 0;
    if (this.worldBuilder) {
      const lamps = { low: 0, medium: 2, high: 4, ultra: 7 };
      this.worldBuilder.maxLampLights = lamps[level] ?? 4;
      this.worldBuilder.maxFireLights = level === 'low' ? 1 : 3;
    }
    // Тени: пересоздаём карту нужного размера
    const sun = this.sky.sunLight || this.sky.sun;
    if (sun && sun.shadow) {
      sun.shadow.mapSize.width = preset.shadowSize;
      sun.shadow.mapSize.height = preset.shadowSize;
      if (sun.shadow.map) {
        sun.shadow.map.dispose();
        sun.shadow.map = null;
      }
    }
  }

  // ── HUD для 3D: виртуальные кнопки и стик ─────────────────────────────
  _initUI() {
    this.hud3d = document.getElementById('hud3d');
    if (!this.hud3d) return;
    this.hud3d.classList.remove('hidden');

    // Кнопки действий 3D
    const bind = (id, action) => {
      const el = document.getElementById(id);
      if (!el) return;
      const down = (e) => { e.preventDefault(); el.classList.add('active'); this._actionDown(action); };
      const up = (e) => { e?.preventDefault?.(); el.classList.remove('active'); this._actionUp(action); };
      el.addEventListener('touchstart', down, { passive: false });
      el.addEventListener('touchend', up, { passive: true });
      el.addEventListener('touchcancel', up, { passive: true });
      el.addEventListener('mousedown', down);
      el.addEventListener('mouseup', up);
      el.addEventListener('mouseleave', up);
    };
    bind('btn3d-attack', 'attack');
    bind('btn3d-heavy', 'heavy');
    bind('btn3d-jump', 'jump');
    bind('btn3d-dodge', 'dodge');
    bind('btn3d-interact', 'interact');
    bind('btn3d-block', 'block');
    bind('btn3d-heal', 'heal');
    bind('btn3d-potion', 'potion');
    bind('btn3d-weapon', 'weapon');

    // Навыки: тап по кнопке → useSkill движка (откат обновляется в HUD)
    const skills = document.querySelectorAll('[data-skill3d]');
    for (const btn of skills) {
      const id = btn.dataset.skill3d;
      const tap = (e) => {
        e.preventDefault();
        btn.classList.add('active');
        this.engine.useSkill?.(id);
        setTimeout(() => btn.classList.remove('active'), 120);
      };
      btn.addEventListener('touchstart', tap, { passive: false });
      btn.addEventListener('mousedown', tap);
    }
    this.skillButtons = skills;

    // Вращение камеры касанием (вторая половина экрана)
    this._bindTouchLook();

    this.stickEl = document.getElementById('stick3d');
    this.knobEl = document.getElementById('stick3d-knob');
    this._bindStick();
  }

  _bindTouchLook() {
    let lookId = null, lastX = 0, lastY = 0;
    const el = this.canvas;
    el.addEventListener('touchstart', (e) => {
      if (!this.running) return;
      for (const t of e.changedTouches) {
        // Левая нижняя четверть — стик, остальное — камера
        const isStickZone = t.clientX < window.innerWidth * 0.45 && t.clientY > window.innerHeight * 0.45;
        if (!isStickZone && lookId === null) {
          lookId = t.identifier;
          lastX = t.clientX;
          lastY = t.clientY;
        }
      }
    }, { passive: true });
    el.addEventListener('touchmove', (e) => {
      if (lookId === null) return;
      for (const t of e.changedTouches) {
        if (t.identifier !== lookId) continue;
        const dx = t.clientX - lastX;
        const dy = t.clientY - lastY;
        lastX = t.clientX;
        lastY = t.clientY;
        // Палец вправо → взгляд вправо, палец вверх → взгляд вверх
        // (камера орбитальная: взгляд направлен от камеры к герою).
        this.controls.rotate(-dx * 0.0042, dy * 0.0032);
      }
    }, { passive: true });
    const endLook = (e) => {
      for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null;
    };
    el.addEventListener('touchend', endLook, { passive: true });
    el.addEventListener('touchcancel', endLook, { passive: true });
  }

  _actionDown(action) {
    const e = this.engine;
    switch (action) {
      case 'attack':
        this._attackPending = true;
        this._attackHeld = true;
        break;
      case 'heavy':
        this._heavyPending = true;
        break;
      case 'jump':
        e.jump?.();
        break;
      case 'dodge':
        e.dash?.();
        break;
      case 'interact':
        this._interactPending = true;
        break;
      case 'block':
        this.engine.player.blocking = true;
        break;
      case 'heal':
        e.useConsumable?.('medkit');
        break;
      case 'potion':
        e.useConsumable?.('potion');
        break;
      case 'weapon':
        e.cycleWeapon?.();
        break;
    }
  }

  _actionUp(action) {
    if (action === 'attack') this._attackHeld = false;
    if (action === 'block') this.engine.player.blocking = false;
  }

  _bindStick() {
    const zone = document.getElementById('stick3d-zone');
    const base = this.stickEl;
    const knob = this.knobEl;
    if (!zone || !base) return;
    let pointerId = null;
    let originX = 0, originY = 0;
    const R = 58;

    const setKnob = (dx, dy) => {
      if (knob) knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };

    const start = (e) => {
      const t = e.changedTouches ? e.changedTouches[0] : e;
      pointerId = e.changedTouches ? t.identifier : 'mouse';
      const rect = base.getBoundingClientRect();
      originX = rect.left + rect.width / 2;
      originY = rect.top + rect.height / 2;
      this._stickActive = true;
      move(e);
    };
    const move = (e) => {
      if (!this._stickActive) return;
      let t = null;
      if (e.changedTouches) {
        for (const tt of e.changedTouches) if (tt.identifier === pointerId) t = tt;
        if (!t) t = e.touches?.[0];
      } else t = e;
      if (!t) return;
      let dx = t.clientX - originX;
      let dy = t.clientY - originY;
      const len = Math.hypot(dx, dy);
      if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
      setKnob(dx, dy);
      this._stickMove = { x: dx / R, y: dy / R };
      e.preventDefault?.();
    };
    const end = () => {
      this._stickActive = false;
      this._stickMove = { x: 0, y: 0 };
      setKnob(0, 0);
    };

    zone.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); start(e); }, { passive: false });
    zone.addEventListener('touchmove', (e) => { e.preventDefault(); move(e); }, { passive: false });
    zone.addEventListener('touchend', end, { passive: true });
    zone.addEventListener('touchcancel', end, { passive: true });
    zone.addEventListener('mousedown', (e) => { e.stopPropagation(); start(e); });
    window.addEventListener('mousemove', (e) => { if (this._stickActive) move(e); });
    window.addEventListener('mouseup', () => { if (this._stickActive) end(); });
  }

  // ── Ввод → движок ──────────────────────────────────────────────────────
  buildInputState(dt) {
    // Стик двигает героя относительно камеры
    const stick = this._stickMove || { x: 0, y: 0 };
    const keys = this._keyState || {};
    let mx = stick.x, my = stick.y;

    // WASD (если стик не используется)
    if (Math.hypot(mx, my) < 0.05) {
      if (keys.forward) my -= 1;
      if (keys.back) my += 1;
      if (keys.left) mx -= 1;
      if (keys.right) mx += 1;
      const l = Math.hypot(mx, my);
      if (l > 1) { mx /= l; my /= l; }
    }

    // Поворот: экранный вектор → мировые координаты по направлению камеры
    const forward = this.controls.getForward();
    const right = this.controls.getRight();
    const mag = Math.hypot(mx, my);
    let worldX = 0, worldY = 0;
    if (mag > 0.03) {
      // my < 0 — вперёд (вверх по экрану)
      const f = -my;
      worldX = forward.x * f + right.x * mx;
      worldY = forward.z * f + right.z * mx;
      const l = Math.hypot(worldX, worldY) || 1;
      worldX /= l; worldY /= l;
    }

    return {
      moveX: mag > 0.03 ? worldX * Math.min(1, mag) : 0,
      moveY: mag > 0.03 ? worldY * Math.min(1, mag) : 0,
      sprintHeld: !!(keys.sprint || mag > 0.94),
      attackHeld: !!this._attackHeld
    };
  }

  _bindKeyboard() {
    if (this._kbBound) return;
    this._kbBound = true;
    this._keyState = {};
    const map = {
      KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back',
      KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
      ShiftLeft: 'sprint', ShiftRight: 'sprint'
    };
    window.addEventListener('keydown', (ev) => {
      if (!this.running) return;
      if (ev.target && /INPUT|TEXTAREA/.test(ev.target.tagName)) return;
      const k = map[ev.code];
      if (k) this._keyState[k] = true;
      if (ev.code === 'Space') { this._attackPending = true; this._attackHeld = true; ev.preventDefault(); }
      if (ev.code === 'KeyJ') this._attackPending = true;
      if (ev.code === 'KeyK') this._heavyPending = true;
      if (ev.code === 'KeyE') this._interactPending = true;
      if (ev.code === 'KeyQ') this.engine.cycleWeapon?.();
      if (ev.code === 'KeyF') this.engine.player.blocking = true;
      if (ev.code === 'KeyR') this.engine.dash?.();
      if (ev.code === 'KeyI' || ev.code === 'Tab') this._uiToggle?.('inventory');
      if (ev.code === 'KeyM') this._uiToggle?.('map');
      if (ev.code === 'Escape') this._uiToggle?.(null);
    });
    window.addEventListener('keyup', (ev) => {
      const k = map[ev.code];
      if (k) this._keyState[k] = false;
      if (ev.code === 'Space') this._attackHeld = false;
      if (ev.code === 'KeyF') this.engine.player.blocking = false;
    });
    window.addEventListener('blur', () => { this._keyState = {}; this._attackHeld = false; });
  }

  // ── Жизненный цикл ─────────────────────────────────────────────────────
  start() {
    if (this.running) return;
    this.running = true;
    this._bindKeyboard();
    this.lastTime = performance.now();
    if (!this.externalLoop) {
      this._loop = this._loop.bind(this);
      requestAnimationFrame(this._loop);
    }
  }

  // Запрос атаки из любого UI-слоя
  requestAttack() { this._attackPending = true; this._attackHeld = true; }
  requestHeavy() { this._heavyPending = true; }
  requestInteract() { this._interactPending = true; }

  stop() {
    this.running = false;
  }

  _loop(now) {
    if (!this.running) return;
    const rawDt = Math.max(0.0001, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.06);

    // FPS
    this.fpsSmooth = this.fpsSmooth * 0.92 + (1 / rawDt) * 0.08;

    // Авто-качество: при просадках ниже 34 FPS снижаем уровень
    if (this.autoQualityEnabled) {
      this.autoQualityTimer += dt;
      if (this.autoQualityTimer > 4) {
        this.autoQualityTimer = 0;
        this._autoAdjustQuality();
      }
    }
    // Динамическое разрешение — быстрая реакция (раз в 2 с), пресет меняется реже
    if (this.autoQualityEnabled && !this._qualityPinned) {
      this._resTimer += dt;
      if (this._resTimer > 2) {
        this._resTimer = 0;
        this._autoAdjustResolution();
      }
    }

    try {
      this.update(dt);
      this.render(dt);
    } catch (err) {
      console.error('[VEXMORA 3D] Ошибка кадра:', err);
      this._frameError = err;
      this.running = false;
      if (this.onError) this.onError(err);
      return;
    }

    requestAnimationFrame(this._loop);
  }

  _autoAdjustResolution() {
    if (!this.renderer) return;
    let changed = false;
    // Просадка — режем разрешение быстрее, чем поднимаем: стабильные 30–45 FPS
    // важнее периодических всплесков до 60 с провалами.
    if (this.fpsSmooth < 45 && this.renderScale > this._resScaleMin) {
      this.renderScale = Math.max(this._resScaleMin, this.renderScale - 0.12);
      changed = true;
    } else if (this.fpsSmooth > 55 && this.renderScale < 1) {
      this.renderScale = Math.min(1, this.renderScale + 0.06);
      changed = true;
    }
    if (changed) {
      this._applyPixelRatio();
      this.resize();
      this._resChanges = (this._resChanges || 0) + 1;
    }
  }

  _autoAdjustQuality() {
    const order = ['low', 'medium', 'high', 'ultra'];
    const idx = order.indexOf(this.quality3d);
    if (this._qualityPinned) return;
    if (this.fpsSmooth < 42 && idx > 0) {
      this.applyQuality(order[idx - 1], false);
      this.onAutoQuality?.(this.quality3d);
    } else if (this.fpsSmooth > 57 && idx < order.length - 1 && !this._qualityPinned) {
      // Не поднимаем автоматически выше «высокого» без явного выбора игрока
      if (idx < 2) {
        this.applyQuality(order[idx + 1], false);
        this.onAutoQuality?.(this.quality3d);
      }
    }
  }

  update(dt) {
    const e = this.engine;
    if (!this.ready) return;
    // В 3D-режиме кнопки 3D-интерфейса — основной источник действий
    if (!this._actionsHooked && this.onAction) {
      this._actionsHooked = true;
    }

    // Ввод: поворот камеры с сенсора/мыши уже обработан в controls
    const look = this._pendingLook;
    if (look) {
      this.controls.rotate(look.x, look.y);
      this._pendingLook = null;
    }

    // Кнопки атаки
    if (this._attackPending) {
      this._attackPending = false;
      const ok = e.performAttack?.();
      if (ok !== false) this.bridge.onPlayerAttack(false);
    }
    if (this._heavyPending) {
      this._heavyPending = false;
      // Тяжёлая атака = рывок с ударом (использует существующую механику)
      const ok = e.performHeavyAttack?.();
      if (ok !== false) {
        this.bridge.onPlayerAttack(true);
        this.controls.addShake(0.5);
      }
    }
    if (this._interactPending) {
      this._interactPending = false;
      const res = e.interact?.();
      this._onInteract?.(res);
    }

    // Сам движок обновляется в main.js (единый цикл), здесь — только 3D
    const p = e.player;
    const hp = { x: p.x * WORLD_SCALE, z: p.y * WORLD_SCALE };
    const gy = this.terrain.heightAt3D(hp.x, hp.z);

    // 3D-сцена
    // Движок мог пересоздать мир (новая игра в меню) — догоняем его
    if (e.world?.map && e.world.map !== this.map) this.rebuildWorld();
    this.terrain.update({ x: hp.x, y: gy, z: hp.z }, dt, this.quality3d);
    this.worldBuilder.update(dt, { x: hp.x, y: gy, z: hp.z }, e.timeOfDay, this.quality3d);
    // Разрушаемые ящики/бочки исчезают в 3D так же, как в логике игры
    this._nodeSyncTimer = (this._nodeSyncTimer || 0) + dt;
    if (this._nodeSyncTimer > 0.4) {
      this._nodeSyncTimer = 0;
      this.worldBuilder.syncNodes?.(e.world.nodes);
    }
    this.bridge.update(dt, this.camera);
    this.effects.update(dt, this.camera, { x: hp.x, y: gy, z: hp.z });

    // ── Оптимизация прохода теней ──
    // Тени стоят второго рендера сцены. Раз в 0.25 с оставляем их только у
    // близких объектов и у врагов рядом с героем (дальние — без теней).
    const preset = QUALITY_PRESETS[this.quality3d] || QUALITY_PRESETS.high;
    this._shadowTimer = (this._shadowTimer || 0) + dt;
    if (this._shadowTimer > 0.25) {
      this._shadowTimer = 0;
      const dist = preset.shadowDistance || 0;
      this.worldBuilder.cullShadows?.({ x: hp.x, z: hp.z }, dist);
      this.sky.setShadowDistance?.(dist);
      for (const [, c] of this.bridge.creatures) {
        const dx = c.root.position.x - hp.x;
        const dz = c.root.position.z - hp.z;
        c.setShadow?.(dist > 0 && (dx * dx + dz * dz) < dist * dist);
      }
    }

    // Небо и погода
    const weather = this._resolveWeather(e);
    this.sky.update(dt, this.camera.position, e.timeOfDay, weather, 1);
    this.effects.weather.setWeather(weather, 1);

    // Камера от третьего лица
    const facingDelta = 0;
    this.controls.update(dt, { x: hp.x, y: gy + (p.z || 0) * WORLD_SCALE, z: hp.z },
      (x, z) => this.terrain.heightAt3D(x, z),
      { sprinting: !!p.sprinting, aiming: !!p.aiming, autoFollow: true, deltaFacing: facingDelta });

    // Тряска от урона
    if (e.camera.shake > 0.5) {
      this.controls.addShake(e.camera.shake * 0.02);
      e.camera.shake *= 0.85;
    }

    // HUD и мини-карта пересчитываются не каждый кадр: getNearbyInteractable
    // перебирает здания/спасательных/транспорт, а это чистый CPU-налог.
    this._uiTimer = (this._uiTimer || 0) + dt;
    if (this._uiTimer > 0.2) {
      this._uiTimer = 0;
      this._updateHud3D();
    }
  }

  _resolveWeather(e) {
    // Погода из события движка (если есть) либо из биома/времени
    if (e.weather && typeof e.weather === 'string') return e.weather;
    const biome = e.terrainAt(e.player.x, e.player.y).biome;
    const tod = e.timeOfDay;
    if (biome === 'snow') return 'snow';
    if (biome === 'swamp') return 'fog';
    // Регулярные грозы ночью в горах/городе
    const cycle = (e.dayCount || 1) % 3;
    if ((biome === 'mountains' || biome === 'city') && cycle === 0 && (tod > 0.7 || tod < 0.2)) return 'storm';
    if (biome === 'city' && cycle === 1) return 'rain';
    return 'clear';
  }

  render(dt) {
    this.renderer.render(this.scene, this.camera);
    // Мини-карта — отдельный 2D-канвас: 15 Гц достаточно, а каждый кадр
    // рисовать атлас 108×108 незачем.
    this._mapTimer = (this._mapTimer || 0) + (dt || 0.016);
    if (this._mapTimer > 0.066) {
      this._mapTimer = 0;
      this._drawOverlay();
    }
  }

  // ── Мини-карта 3D (canvas поверх) ───────────────────────────────────────
  attachRenderer2D(renderer2d) {
    this.renderer2d = renderer2d;   // используется для отрисовки мини-карты
  }

  _drawOverlay() {
    const mm = document.getElementById('minimap3d');
    if (!mm) return;
    const ctx = mm.getContext('2d');
    const w = mm.width, h = mm.height;
    ctx.clearRect(0, 0, w, h);
    // Мини-карту рисует существующий 2D-рендерер во временный canvas
    if (this.renderer2d && this.renderer2d.renderMinimap) {
      try {
        if (!this._offCanvas) {
          this._offCanvas = document.createElement('canvas');
          this._offCanvas.width = 108;
          this._offCanvas.height = 108;
          this._offCtx = this._offCanvas.getContext('2d');
        }
        const prevCanvas = this.renderer2d.minimapCanvas;
        const prevCtx = this.renderer2d.mmCtx;
        this.renderer2d.minimapCanvas = this._offCanvas;
        this.renderer2d.mmCtx = this._offCtx;
        this._offCtx.clearRect(0, 0, 108, 108);
        this.renderer2d.renderMinimap(this.engine);
        this.renderer2d.minimapCanvas = prevCanvas;
        this.renderer2d.mmCtx = prevCtx;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this._offCanvas, 0, 0, w, h);
      } catch (err) {
        ctx.fillStyle = '#1a2a1a';
        ctx.fillRect(0, 0, w, h);
      }
    } else {
      ctx.fillStyle = '#1a2a1a';
      ctx.fillRect(0, 0, w, h);
    }
    // Компас (стрелка взгляда камеры)
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-this.controls.yaw);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Рамка
    ctx.strokeStyle = 'rgba(200,220,255,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
  }

  _updateHud3D() {
    const el = document.getElementById('hud3d-fps');
    if (el) el.textContent = `${Math.round(this.fpsSmooth)} FPS`;
    const q = document.getElementById('hud3d-quality');
    if (q) q.textContent = QUALITY_PRESETS[this.quality3d]?.label || '';
    // Подсветка кнопки взаимодействия, когда рядом есть объект
    const interBtn = document.getElementById('btn3d-interact');
    if (interBtn && this.engine.getNearbyInteractable) {
      const inter = this.engine.getNearbyInteractable();
      interBtn.classList.toggle('hint', !!inter);
      const lbl = document.getElementById('btn3d-interact-label');
      if (lbl) lbl.textContent = inter ? 'Взаимодействие' : '';
    }
    // Счётчики аптечек и зелий
    const cons = this.engine.inventory?.consumables || {};
    const healCount = document.getElementById('btn3d-heal-count');
    if (healCount) healCount.textContent = cons.medkit ?? 0;
    const potionCount = document.getElementById('btn3d-potion-count');
    if (potionCount) potionCount.textContent = cons.potion ?? 0;
    const healBtn = document.getElementById('btn3d-heal');
    if (healBtn) healBtn.classList.toggle('hint', (cons.medkit ?? 0) > 0 && this.engine.player.hp < this.engine.player.maxHp * 0.5);

    // Навыки: доступность и откат
    if (this.skillButtons) {
      for (const btn of this.skillButtons) {
        const st = this.engine.skills?.[btn.dataset.skill3d];
        const cd = st?.cd || 0;
        const locked = !st || st.level <= 0;
        btn.classList.toggle('locked', locked);
        btn.classList.toggle('cooling', !locked && cd > 0);
        const label = btn.querySelector('small');
        if (label) label.textContent = locked ? '🔒' : cd > 0 ? Math.ceil(cd) : '';
      }
    }

    // День/ночь на мини-карте
    const day = document.getElementById('hud3d-day');
    if (day) {
      const t = this.engine.timeOfDay;
      const icon = t < 0.22 || t > 0.8 ? '🌙' : t < 0.3 || t > 0.7 ? '🌆' : '☀️';
      day.textContent = `${icon} День ${this.engine.dayCount}`;
    }
  }

  resize() {
    if (!this.renderer) return;
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this._applyPixelRatio();
    this.renderer.setSize(w, h, false);
  }

  _bindResize() {
    if (this._resizeBound) return;
    this._resizeBound = true;
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 120));
  }

  dispose() {
    this.stop();
    this.bridge?.dispose();
    this.worldBuilder?.dispose();
    this.terrain?.dispose();
    this.renderer?.dispose();
  }
}
