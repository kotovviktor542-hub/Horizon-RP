// Надёжное мультитач-управление для Android (виртуальный джойстик + кнопки действий)
// и полная поддержка клавиатуры/мыши для ПК и браузерного превью.

import { sound } from './audio.js';

export function createInputController(engine, uiCallbacks) {
  const keys = new Set();
  const state = {
    moveX: 0,
    moveY: 0,
    joyX: 0,
    joyY: 0,
    attackHeld: false
  };

  let joyTouchId = null;
  let joyPointerId = null;
  let joyOriginX = 0;
  let joyOriginY = 0;
  const maxJoyRadius = 52;

  const joyZone = document.getElementById('joystick-zone');
  const joyBase = document.getElementById('joystick-base');
  const joyKnob = document.getElementById('joystick-knob');

  function updateJoyVisual(dx, dy, active) {
    if (!joyBase || !joyKnob) return;
    joyBase.classList.toggle('active', active);
    joyKnob.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
  }

  function applyJoyDelta(clientX, clientY) {
    const dx = clientX - joyOriginX;
    const dy = clientY - joyOriginY;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(maxJoyRadius, dist);
    const ang = Math.atan2(dy, dx);
    const kx = dist > 2 ? Math.cos(ang) * clamped : 0;
    const ky = dist > 2 ? Math.sin(ang) * clamped : 0;

    state.joyX = kx / maxJoyRadius;
    state.joyY = ky / maxJoyRadius;
    updateJoyVisual(kx, ky, true);
  }

  function resetJoystick() {
    joyTouchId = null;
    joyPointerId = null;
    state.joyX = 0;
    state.joyY = 0;
    if (joyBase) {
      joyBase.style.left = '';
      joyBase.style.top = '';
    }
    updateJoyVisual(0, 0, false);
  }

  // ── Touch-события виртуального джойстика ─────────────────────────────
  if (joyZone) {
    joyZone.addEventListener('touchstart', (e) => {
      sound.init();
      if (joyTouchId !== null) return;
      const t = e.changedTouches[0];
      if (!t) return;
      e.preventDefault();
      joyTouchId = t.identifier;
      const rect = joyZone.getBoundingClientRect();

      if (engine.state.settings.joystickMode === 'dynamic') {
        joyOriginX = t.clientX;
        joyOriginY = t.clientY;
        if (joyBase) {
          joyBase.style.left = `${t.clientX - rect.left - 62}px`;
          joyBase.style.top = `${t.clientY - rect.top - 62}px`;
        }
      } else {
        const bRect = joyBase.getBoundingClientRect();
        joyOriginX = bRect.left + bRect.width * 0.5;
        joyOriginY = bRect.top + bRect.height * 0.5;
      }
      applyJoyDelta(t.clientX, t.clientY);
    }, { passive: false });

    joyZone.addEventListener('touchmove', (e) => {
      if (joyTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === joyTouchId) {
          e.preventDefault();
          applyJoyDelta(t.clientX, t.clientY);
          break;
        }
      }
    }, { passive: false });

    const endTouch = (e) => {
      if (joyTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joyTouchId) {
          resetJoystick();
          break;
        }
      }
    };
    joyZone.addEventListener('touchend', endTouch);
    joyZone.addEventListener('touchcancel', endTouch);

    // Поддержка мыши по джойстику для удобного теста в браузере
    joyZone.addEventListener('mousedown', (e) => {
      sound.init();
      joyPointerId = 1;
      const bRect = joyBase.getBoundingClientRect();
      joyOriginX = bRect.left + bRect.width * 0.5;
      joyOriginY = bRect.top + bRect.height * 0.5;
      applyJoyDelta(e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', (e) => {
      if (joyPointerId !== null) applyJoyDelta(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', () => {
      if (joyPointerId !== null) resetJoystick();
      state.attackHeld = false;
    });
  }

  // ── Кнопки действий (мультитач без задержки 300мс) ───────────────────
  function bindActionButton(id, onPress, holdable = false) {
    const el = document.getElementById(id);
    if (!el) return;

    const start = (e) => {
      e.preventDefault();
      e.stopPropagation();
      sound.init();
      el.classList.add('pressed');
      if (holdable) state.attackHeld = true;
      onPress();
    };
    const end = (e) => {
      if (e) e.preventDefault();
      el.classList.remove('pressed');
      if (holdable) state.attackHeld = false;
    };

    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('touchcancel', end, { passive: false });
    el.addEventListener('mousedown', start);
    el.addEventListener('mouseup', end);
    el.addEventListener('mouseleave', end);
  }

  bindActionButton('btn-attack', () => engine.triggerAttack(), true);
  bindActionButton('btn-jump', () => engine.triggerJump(state.moveX, state.moveY), false);
  bindActionButton('btn-skill-1', () => engine.triggerSkill('whirlwind'), false);
  bindActionButton('btn-skill-2', () => engine.triggerSkill('thunder_slam'), false);
  bindActionButton('btn-skill-3', () => engine.triggerSkill('aegis_pulse'), false);
  bindActionButton('btn-potion', () => engine.useQuickConsumable(), false);
  bindActionButton('btn-interact', () => uiCallbacks.onInteract(), false);

  // Клик по игровому холсту на ПК тоже атакует
  const canvas = document.getElementById('game-canvas');
  if (canvas) {
    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || uiCallbacks.isModalOpen()) return;
      sound.init();
      const rect = canvas.getBoundingClientRect();
      const cx = rect.width * 0.5;
      const cy = rect.height * 0.5;
      const ang = Math.atan2(e.clientY - rect.top - cy, e.clientX - rect.left - cx);
      engine.state.player.facingAngle = ang;
      engine.state.player.facingX = Math.cos(ang);
      engine.state.player.facingY = Math.sin(ang);
      state.attackHeld = true;
      engine.triggerAttack();
    });
  }

  // ── Клавиатура (ПК) ──────────────────────────────────────────────────
  window.addEventListener('keydown', (e) => {
    sound.init();
    const code = e.code;
    keys.add(code);

    if (code === 'Escape') {
      uiCallbacks.onEscape();
      return;
    }
    if (uiCallbacks.isModalOpen()) return;

    if (code === 'Space') {
      e.preventDefault();
      engine.triggerJump(state.moveX, state.moveY);
    } else if (code === 'KeyJ' || code === 'Enter') {
      state.attackHeld = true;
      engine.triggerAttack();
    } else if (code === 'Digit1') {
      engine.triggerSkill('whirlwind');
    } else if (code === 'Digit2') {
      engine.triggerSkill('thunder_slam');
    } else if (code === 'Digit3') {
      engine.triggerSkill('aegis_pulse');
    } else if (code === 'KeyQ') {
      engine.useQuickConsumable();
    } else if (code === 'KeyE' || code === 'KeyF') {
      uiCallbacks.onInteract();
    } else if (code === 'KeyI' || code === 'Tab') {
      e.preventDefault();
      uiCallbacks.openTab('hero');
    } else if (code === 'KeyM') {
      uiCallbacks.openTab('map');
    }
  });

  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    if (e.code === 'KeyJ' || e.code === 'Enter') {
      state.attackHeld = false;
    }
  });

  const clearAll = () => {
    keys.clear();
    state.attackHeld = false;
    resetJoystick();
  };
  window.addEventListener('blur', clearAll);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearAll();
  });

  function poll() {
    let kx = 0;
    let ky = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) kx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) kx += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) ky -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) ky += 1;

    if (kx !== 0 || ky !== 0) {
      const l = Math.hypot(kx, ky);
      state.moveX = kx / l;
      state.moveY = ky / l;
    } else {
      state.moveX = state.joyX;
      state.moveY = state.joyY;
    }
    return state;
  }

  return {
    poll,
    clearAll
  };
}
