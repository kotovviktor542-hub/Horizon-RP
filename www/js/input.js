// Мобильный мультитач-ввод без залипаний + клавиатура для тестирования в браузере
// Поддерживает джойстик (авто-бег при полном наклоне), стрельбу, гранату, прыжок, рывок и смену оружия

export class InputController {
  constructor(callbacks) {
    this.cb = callbacks;
    this.moveX = 0;
    this.moveY = 0;
    this.sprintHeld = false;
    this.attackHeld = false;

    this.joyPointerId = null;
    this.joyOriginX = 0;
    this.joyOriginY = 0;
    this.joyMaxRadius = 54;

    this.keys = new Set();

    this.joyZone = document.getElementById('joystick-zone');
    this.joyBase = document.getElementById('joystick-base');
    this.joyKnob = document.getElementById('joystick-knob');

    this.bindJoystick();
    this.bindActionButtons();
    this.bindKeyboard();
  }

  resetAll() {
    this.moveX = 0;
    this.moveY = 0;
    this.sprintHeld = false;
    this.attackHeld = false;
    this.joyPointerId = null;
    this.keys.clear();
    if (this.joyKnob) this.joyKnob.style.transform = 'translate(0px, 0px)';
    if (this.joyBase) this.joyBase.classList.remove('active');
  }

  bindJoystick() {
    if (!this.joyZone) return;

    const onStart = (e) => {
      e.preventDefault();
      this.cb.onUnlockAudio?.();
      if (this.joyPointerId !== null) return;
      const pt = e.changedTouches ? e.changedTouches[0] : e;
      this.joyPointerId = e.changedTouches ? pt.identifier : 'mouse';

      const rect = this.joyBase.getBoundingClientRect();
      this.joyOriginX = rect.left + rect.width * 0.5;
      this.joyOriginY = rect.top + rect.height * 0.5;
      this.joyBase.classList.add('active');
      this.updateJoystickFromPoint(pt.clientX, pt.clientY);
    };

    const onMove = (e) => {
      if (this.joyPointerId === null) return;
      if (e.changedTouches) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === this.joyPointerId) {
            e.preventDefault();
            this.updateJoystickFromPoint(t.clientX, t.clientY);
            break;
          }
        }
      } else if (this.joyPointerId === 'mouse') {
        this.updateJoystickFromPoint(e.clientX, e.clientY);
      }
    };

    const onEnd = (e) => {
      if (this.joyPointerId === null) return;
      if (e.changedTouches) {
        let ended = false;
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.joyPointerId) {
            ended = true;
            break;
          }
        }
        if (!ended) return;
      }
      this.joyPointerId = null;
      this.moveX = 0;
      this.moveY = 0;
      this.joyKnob.style.transform = 'translate(0px, 0px)';
      this.joyBase.classList.remove('active');
    };

    this.joyZone.addEventListener('touchstart', onStart, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onEnd, { passive: true });

    this.joyZone.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('blur', () => this.resetAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.resetAll();
    });
  }

  updateJoystickFromPoint(cx, cy) {
    const dx = cx - this.joyOriginX;
    const dy = cy - this.joyOriginY;
    const dist = Math.hypot(dx, dy);
    const maxR = this.joyMaxRadius;
    const clamped = Math.min(dist, maxR);
    const nx = dist > 0.001 ? dx / dist : 0;
    const ny = dist > 0.001 ? dy / dist : 0;

    this.moveX = nx * (clamped / maxR);
    this.moveY = ny * (clamped / maxR);
    this.joyKnob.style.transform = `translate(${(nx * clamped).toFixed(1)}px, ${(ny * clamped).toFixed(1)}px)`;
  }

  bindHoldButton(el, onDown, onUp) {
    if (!el) return;
    const start = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.cb.onUnlockAudio?.();
      el.classList.add('pressed');
      onDown();
    };
    const end = (e) => {
      e.preventDefault();
      el.classList.remove('pressed');
      onUp?.();
    };
    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('touchcancel', end, { passive: false });
    el.addEventListener('mousedown', start);
    el.addEventListener('mouseup', end);
    el.addEventListener('mouseleave', end);
  }

  bindTapButton(id, fn) {
    const el = document.getElementById(id);
    if (!el) return;
    this.bindHoldButton(el, fn, null);
  }

  bindActionButtons() {
    const atkBtn = document.getElementById('btn-attack');
    this.bindHoldButton(
      atkBtn,
      () => { this.attackHeld = true; this.cb.onAttack?.(); },
      () => { this.attackHeld = false; }
    );

    this.bindTapButton('btn-jump', () => this.cb.onJump?.());
    this.bindTapButton('btn-dash', () => this.cb.onDash?.());
    this.bindTapButton('btn-grenade', () => this.cb.onGrenade?.());
    this.bindTapButton('btn-reload', () => this.cb.onReload?.());
    this.bindTapButton('btn-heal', () => this.cb.onQuickHeal?.());
    this.bindTapButton('btn-interact', () => this.cb.onInteract?.());
    this.bindTapButton('hud-weapon-switch', () => this.cb.onCycleWeapon?.());
    this.bindTapButton('btn-skill-1', () => this.cb.onSkill?.('slash_wave'));
    this.bindTapButton('btn-skill-2', () => this.cb.onSkill?.('magic_nova'));
    this.bindTapButton('btn-skill-3', () => this.cb.onSkill?.('adrenaline'));
  }

  bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      if (e.key === 'Shift') this.sprintHeld = true;
      this.cb.onUnlockAudio?.();

      if (k === ' ' || k === 'j') { this.attackHeld = true; this.cb.onAttack?.(); }
      else if (k === 'k') this.cb.onJump?.();
      else if (k === 'l') this.cb.onDash?.();
      else if (k === 'g') this.cb.onGrenade?.();
      else if (k === 'r') this.cb.onReload?.();
      else if (k === 'q') this.cb.onCycleWeapon?.();
      else if (k === 'e' || k === 'f') this.cb.onInteract?.();
      else if (k === 'h') this.cb.onQuickHeal?.();
      else if (k === '1') this.cb.onSkill?.('slash_wave');
      else if (k === '2') this.cb.onSkill?.('magic_nova');
      else if (k === '3') this.cb.onSkill?.('adrenaline');
      else if (k === 'i') this.cb.onOpenTab?.('inventory');
      else if (k === 'm') this.cb.onOpenTab?.('map');
      else if (e.key === 'Escape') this.cb.onEscape?.();
    });

    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      this.keys.delete(k);
      if (e.key === 'Shift') this.sprintHeld = false;
      if (k === ' ' || k === 'j') this.attackHeld = false;
    });
  }

  getState() {
    let kx = 0;
    let ky = 0;
    if (this.keys.has('a') || this.keys.has('ф') || this.keys.has('arrowleft')) kx -= 1;
    if (this.keys.has('d') || this.keys.has('в') || this.keys.has('arrowright')) kx += 1;
    if (this.keys.has('w') || this.keys.has('ц') || this.keys.has('arrowup')) ky -= 1;
    if (this.keys.has('s') || this.keys.has('ы') || this.keys.has('arrowdown')) ky += 1;

    if (kx !== 0 || ky !== 0) {
      const len = Math.hypot(kx, ky);
      return { moveX: kx / len, moveY: ky / len, sprintHeld: this.sprintHeld, attackHeld: this.attackHeld };
    }
    const joyMag = Math.hypot(this.moveX, this.moveY);
    return {
      moveX: this.moveX,
      moveY: this.moveY,
      sprintHeld: this.sprintHeld || joyMag > 0.94,
      attackHeld: this.attackHeld
    };
  }
}
