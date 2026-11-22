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

const QUALITY_PRESETS = {
  low: {
    label: 'Низкое', pixelRatio: 0.75, shadows: false, shadowSize: 512,
    viewRadius: 3, aa: false, anisotropy: 1, particles: 0.5, weather: false, grass: false
  },
  medium: {
    label: 'Среднее', pixelRatio: 1, shadows: true, shadowSize: 1024,
    viewRadius: 4, aa: true, anisotropy: 2, particles: 0.8, weather: true, grass: true
  },
  high: {
    label: 'Высокое', pixelRatio: 1.35, shadows: true, shadowSize: 2048,
    viewRadius: 5, aa: true, anisotropy: 4, particles: 1, weather: true, grass: true
  },
  ultra: {
    label: 'Ультра', pixelRatio: 2, shadows: true, shadowSize: 4096,
    viewRadius: 6, aa: true, anisotropy: 8, particles: 1.4, weather: true, grass: true
  }
};

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
    this.options = options;

    this._initRenderer();
    this._initScene();
    this._initWorld();
    this._initUI();
    this._bindResize();
  }

  // ── Рендерер ───────────────────────────────────────────────────────────
  _initRenderer() {
    const preset = QUALITY_PRESETS[this.quality3d] || QUALITY_PRESETS.high;
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
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, preset.pixelRatio));
    r.setSize(window.innerWidth, window.innerHeight, false);
    r.shadowMap.enabled = preset.shadows;
    r.shadowMap.needsUpdate = true;
    this.sky.setQuality(level);
    this.terrain.setQuality(level);
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
        this.controls.rotate(-dx * 0.0042, -dy * 0.0032);
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

  _autoAdjustQuality() {
    const order = ['low', 'medium', 'high', 'ultra'];
    const idx = order.indexOf(this.quality3d);
    if (this._qualityPinned) return;
    if (this.fpsSmooth < 32 && idx > 0) {
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

    this._updateHud3D();
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
    this._drawOverlay();
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
          this._offCanvas.width = 128;
          this._offCanvas.height = 128;
          this._offCtx = this._offCanvas.getContext('2d');
        }
        const prevCanvas = this.renderer2d.minimapCanvas;
        const prevCtx = this.renderer2d.mmCtx;
        this.renderer2d.minimapCanvas = this._offCanvas;
        this.renderer2d.mmCtx = this._offCtx;
        this._offCtx.clearRect(0, 0, 128, 128);
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
