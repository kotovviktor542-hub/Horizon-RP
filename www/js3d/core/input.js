// VEXMORA 3D — управление: клавиатура + мышь + сенсор (виртуальный стик,
// кнопки действий, свайп-камера). Единый объект Input с нормализованным состоянием.

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Input3D {
  constructor(domElement, options = {}) {
    this.el = domElement;
    this.keys = Object.create(null);
    this.move = { x: 0, y: 0 };          // -1..1 (x — вправо, y — вперёд)
    this.look = { x: 0, y: 0 };          // дельта вращения камеры за кадр
    this.actions = {
      attack: false, heavy: false, jump: false, block: false,
      dodge: false, interact: false, sprint: false, inventory: false, map: false
    };
    this.pressed = Object.create(null);   // однократные нажатия (сбрасываются в endFrame)
    this.usedTouch = false;
    this.enabled = true;
    this.options = options;

    this._touchId = null;
    this._stickOrigin = { x: 0, y: 0 };
    this._lookTouchId = null;
    this._lookStart = { x: 0, y: 0 };

    this._bindKeyboard();
    this._bindTouch();
  }

  // ── Клавиатура ─────────────────────────────────────────────────────────
  _bindKeyboard() {
    if (typeof window === 'undefined') return;
    const map = {
      KeyW: 'forward', ArrowUp: 'forward',
      KeyS: 'back', ArrowDown: 'back',
      KeyA: 'left', ArrowLeft: 'left',
      KeyD: 'right', ArrowRight: 'right'
    };
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      this.keys[e.code] = true;
      const m = map[e.code];
      if (m) { this._keyMove = this._keyMove || {}; this._keyMove[m] = true; e.preventDefault?.(); }
      if (e.code === 'Space') { this.press('jump'); e.preventDefault?.(); }
      if (e.code === 'KeyJ') this.press('attack');
      if (e.code === 'KeyK') this.press('heavy');
      if (e.code === 'KeyL' || e.code === 'KeyQ') this.press('block');
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.press('sprint');
      if (e.code === 'KeyF') this.press('interact');
      if (e.code === 'KeyR') this.press('dodge');
      if (e.code === 'KeyI' || e.code === 'Tab') { this.press('inventory'); e.preventDefault?.(); }
      if (e.code === 'KeyM') this.press('map');
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      const m = map[e.code];
      if (m && this._keyMove) this._keyMove[m] = false;
    });
    window.addEventListener('blur', () => {
      this.keys = Object.create(null);
      this._keyMove = {};
      this.move.x = this.move.y = 0;
    });
  }

  // ── Сенсор ─────────────────────────────────────────────────────────────
  _bindTouch() {
    const el = this.el;
    if (!el || !el.addEventListener) return;

    // Стик рисуется UI-слоем, здесь — его геометрия (центр в левой нижней части)
    this._stickRadius = 68;
    this._stickCenter = { x: 96, y: -110 };   // относительно низа-лева экрана

    const isLeftHalf = (x) => x < (window.innerWidth || 800) * 0.45;

    el.addEventListener('touchstart', (e) => {
      if (!this.enabled) return;
      this.usedTouch = true;
      for (const t of e.changedTouches) {
        if (isLeftHalf(t.clientX) && this._touchId === null) {
          this._touchId = t.identifier;
          this._stickOrigin.x = t.clientX;
          this._stickOrigin.y = t.clientY;
        } else if (this._lookTouchId === null) {
          this._lookTouchId = t.identifier;
          this._lookStart.x = t.clientX;
          this._lookStart.y = t.clientY;
        }
      }
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
      if (!this.enabled) return;
      for (const t of e.changedTouches) {
        if (t.identifier === this._touchId) {
          const dx = t.clientX - this._stickOrigin.x;
          const dy = t.clientY - this._stickOrigin.y;
          const len = Math.hypot(dx, dy);
          const max = this._stickRadius;
          const k = len > max ? max / len : 1;
          this.move.x = (dx * k) / max;
          this.move.y = (-dy * k) / max;
        } else if (t.identifier === this._lookTouchId) {
          const dx = t.clientX - this._lookStart.x;
          const dy = t.clientY - this._lookStart.y;
          this.look.x += dx * 0.0032;
          this.look.y += dy * 0.0026;
          this._lookStart.x = t.clientX;
          this._lookStart.y = t.clientY;
        }
      }
    }, { passive: true });

    const endTouch = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._touchId) {
          this._touchId = null;
          this.move.x = 0;
          this.move.y = 0;
        }
        if (t.identifier === this._lookTouchId) this._lookTouchId = null;
      }
    };
    el.addEventListener('touchend', endTouch, { passive: true });
    el.addEventListener('touchcancel', endTouch, { passive: true });
  }

  // Публичный API для UI-кнопок (виртуальные кнопки вызывают эти методы)
  press(action) {
    this.actions[action] = true;
    this.pressed[action] = true;
  }

  release(action) {
    this.actions[action] = false;
  }

  bindButton(el, action) {
    if (!el) return;
    const down = (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.add('pressed');
      this.press(action);
    };
    const up = (e) => {
      e?.preventDefault?.();
      el.classList.remove('pressed');
      this.release(action);
    };
    el.addEventListener('touchstart', down, { passive: false });
    el.addEventListener('touchend', up, { passive: true });
    el.addEventListener('touchcancel', up, { passive: true });
    el.addEventListener('mousedown', down);
    el.addEventListener('mouseup', up);
    el.addEventListener('mouseleave', up);
  }

  // Чтение состояния: объединяет клавиши и стик
  update() {
    if (!this.enabled) {
      this.move.x = 0; this.move.y = 0;
      return;
    }
    // Клавиатурное движение
    const km = this._keyMove || {};
    if (km.forward || km.back || km.left || km.right) {
      let x = (km.right ? 1 : 0) - (km.left ? 1 : 0);
      let y = (km.forward ? 1 : 0) - (km.back ? 1 : 0);
      const len = Math.hypot(x, y) || 1;
      this.move.x = x / len;
      this.move.y = y / len;
    }
    // Спринт по Shift или двойному отклонению стика
    this.actions.sprint = !!(this.keys.ShiftLeft || this.keys.ShiftRight)
      || Math.hypot(this.move.x, this.move.y) > 0.92;
  }

  consume(name) {
    if (this.pressed[name]) {
      this.pressed[name] = false;
      return true;
    }
    return false;
  }

  consumeLook() {
    const l = { x: this.look.x, y: this.look.y };
    this.look.x = 0;
    this.look.y = 0;
    return l;
  }

  endFrame() {
    this.pressed = Object.create(null);
  }

  // Экранный стик для отрисовки UI
  stickVisual() {
    if (this._touchId === null) return null;
    return {
      ox: this._stickOrigin.x,
      oy: this._stickOrigin.y,
      x: this._stickOrigin.x + this.move.x * this._stickRadius,
      y: this._stickOrigin.y + this.move.y * this._stickRadius,
      r: this._stickRadius
    };
  }
}
