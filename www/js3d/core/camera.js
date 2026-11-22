// VEXMORA 3D — камера от третьего лица: орбита вокруг героя, коллизии с рельефом,
// плавное следование, тряска при ударах, режим прицеливания и автоповорот.

import * as THREE from 'three';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const damp = (c, t, l, dt) => c + (t - c) * (1 - Math.exp(-l * dt));

export class ThirdPersonCamera {
  constructor(camera, domElement) {
    this.camera = camera;
    this.dom = domElement;
    this.yaw = 0;               // горизонтальный угол (радианы)
    this.pitch = 0.32;          // вертикальный угол
    this.distance = 6.2;
    this.targetDistance = 6.2;
    this.minDistance = 2.4;
    this.maxDistance = 14;
    this.sensitivity = 0.0055;
    this.target = new THREE.Vector3();
    this.smoothTarget = new THREE.Vector3();
    this.shake = 0;
    this.fov = 62;

    this.isDragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.autoRotateTimer = 0;
    this.sensitivityMultiplier = 1;

    this._bindEvents();
  }

  _bindEvents() {
    const el = this.dom;
    if (!el || !el.addEventListener) return;

    // Мышь: вращение камеры перетаскиванием (Pointer Events + mouse-фолбэк для старых WebView)
    el.addEventListener('pointerdown', (e) => {
      if (e.target !== el) return;
      this.isDragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      try { el.setPointerCapture?.(e.pointerId); } catch { /* не критично */ }
    });
    const onMove = (x, y) => {
      if (!this.isDragging) return;
      const dx = x - this.lastX;
      const dy = y - this.lastY;
      this.lastX = x;
      this.lastY = y;
      // Ведём мышь/палец вправо → камера поворачивает вправо (yaw растёт).
      // Раньше здесь стоял минус: горизонталь была инвертирована.
      this.rotate(dx * this.sensitivity * this.sensitivityMultiplier,
        dy * this.sensitivity * this.sensitivityMultiplier);
    };
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;   // касания обрабатывает Game3D (_bindTouchLook)
      onMove(e.clientX, e.clientY);
    });
    // Фолбэк без Pointer Events
    el.addEventListener('mousedown', (e) => {
      if (e.target !== el) return;
      this.isDragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    el.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
    const stop = () => { this.isDragging = false; };
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);
    el.addEventListener('pointerleave', stop);
    el.addEventListener('mouseup', stop);
    el.addEventListener('mouseleave', stop);
    window.addEventListener?.('blur', stop);

    // Колесо: зум от третьего лица
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom(e.deltaY * 0.004);
    }, { passive: false });
  }

  // Накапливаем намерение поворота, а к цели подтягиваемся в update(dt):
  // на мобильных touchmove приходит рывками (30–60 Гц), и прямая запись yaw
  // давала дёргание камеры.
  rotate(dx, dy) {
    this._pendingYaw = (this._pendingYaw || 0) + dx;
    this._pendingPitch = (this._pendingPitch || 0) + dy;
    this.autoRotateTimer = 0;
  }

  // Применить накопленный поворот с плавным сглаживанием
  _applyLook(dt) {
    const py = this._pendingYaw || 0;
    const pp = this._pendingPitch || 0;
    if (!py && !pp) return;
    // 1 - exp(-k*dt): независимо от FPS, но заметно быстрее кадра
    const k = 1 - Math.exp(-34 * dt);
    this.yaw += py * k;
    this.pitch = clamp(this.pitch + pp * k, -0.42, 1.22);
    this._pendingYaw = py * (1 - k);
    this._pendingPitch = pp * (1 - k);
    if (Math.abs(this._pendingYaw) < 1e-5) this._pendingYaw = 0;
    if (Math.abs(this._pendingPitch) < 1e-5) this._pendingPitch = 0;
  }

  zoom(amount) {
    this.targetDistance = clamp(this.targetDistance + amount * 3, this.minDistance, this.maxDistance);
  }

  setDistance(d) {
    this.targetDistance = clamp(d, this.minDistance, this.maxDistance);
  }

  addShake(amount) {
    this.shake = Math.min(1.4, this.shake + amount);
  }

  update(dt, heroPos, terrainHeightFn, opts = {}) {
    const { sprinting = false, aiming = false, autoFollow = true, deltaFacing = 0 } = opts;
    this._applyLook(dt);

    // Мягкий автоповорот камеры вслед за движением (если игрок не вращал вручную)
    if (autoFollow && Math.abs(deltaFacing) > 0.0001) {
      this.autoRotateTimer += dt;
      if (this.autoRotateTimer > 0.6) {
        const targetYaw = this.yaw - deltaFacing;
        let d = targetYaw - this.yaw;
        this.yaw = damp(this.yaw, targetYaw, 1.6, dt);
      }
    } else {
      this.autoRotateTimer += dt;
    }

    // Спринт немного отдаляет камеру, прицеливание приближает
    const baseDist = this.targetDistance * (aiming ? 0.72 : sprinting ? 1.12 : 1);
    this.distance = damp(this.distance, baseDist, 6, dt);

    // Целевая точка — грудь героя
    this.target.set(heroPos.x, heroPos.y + 1.35, heroPos.z);
    this.smoothTarget.x = damp(this.smoothTarget.x, this.target.x, 14, dt);
    this.smoothTarget.y = damp(this.smoothTarget.y, this.target.y, 8, dt);
    this.smoothTarget.z = damp(this.smoothTarget.z, this.target.z, 14, dt);

    // Орбита
    const cosP = Math.cos(this.pitch);
    const offX = Math.sin(this.yaw) * cosP * this.distance;
    const offZ = Math.cos(this.yaw) * cosP * this.distance;
    const offY = Math.sin(this.pitch) * this.distance + 0.6;

    let camX = this.smoothTarget.x + offX;
    let camY = this.smoothTarget.y + offY;
    let camZ = this.smoothTarget.z + offZ;

    // Коллизия с рельефом: не опускаемся под землю
    if (terrainHeightFn) {
      const groundAtCam = terrainHeightFn(camX, camZ);
      const minY = groundAtCam + 0.9;
      if (camY < minY) camY = minY;
      // Проверка препятствия по линии взгляда (упрощённо — по 4 точкам)
      for (let i = 1; i <= 4; i++) {
        const t = i / 5;
        const px = this.smoothTarget.x + offX * (1 - t);
        const pz = this.smoothTarget.z + offZ * (1 - t);
        const gh = terrainHeightFn(px, pz) + 0.8;
        const py = this.smoothTarget.y + offY * (1 - t);
        if (py < gh) {
          // Подтягиваем камеру ближе к герою, чтобы не провалиться
          const shrink = t;
          camX = this.smoothTarget.x + offX * (1 - shrink * 0.7);
          camZ = this.smoothTarget.z + offZ * (1 - shrink * 0.7);
          camY = Math.max(camY, terrainHeightFn(camX, camZ) + 0.9);
          break;
        }
      }
    }

    // Тряска
    if (this.shake > 0.001) {
      const s = this.shake * 0.22;
      camX += (Math.random() - 0.5) * s;
      camY += (Math.random() - 0.5) * s;
      camZ += (Math.random() - 0.5) * s;
      this.shake = Math.max(0, this.shake - dt * 3.2);
    }

    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(this.smoothTarget);

    // FOV: лёгкий «спидлайн» на спринте, сужение при прицеливании
    const targetFov = aiming ? 52 : sprinting ? 70 : 62;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = damp(this.camera.fov, targetFov, 5, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  // Направление «вперёд» относительно камеры (для движения персонажа)
  getForward() {
    return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
  }

  getRight() {
    return { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) };
  }

  // Угол поворота персонажа по вектору движения
  facingFromMove(mx, mz) {
    return Math.atan2(mx, mz);
  }
}
