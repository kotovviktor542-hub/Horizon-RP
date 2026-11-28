// VEXMORA 3D — эффекты: искры ударов, кровь, магия, след клинка, пыль,
// всплывающие числа урона и частицы погоды. Пул объектов без утечек.

import * as THREE from 'three';

const TAU = Math.PI * 2;

// ── Пул простых спрайтов-частиц (одна точка на частицу через InstancedMesh) ──
class ParticlePool {
  constructor(scene, count, material, size = 0.12) {
    const geo = new THREE.SphereGeometry(size, 6, 5);
    this.mesh = new THREE.InstancedMesh(geo, material, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = count;
    this.count = count;
    this.scene = scene;
    scene.add(this.mesh);

    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count);
    this.scaleArr = new Float32Array(count);
    this.gravity = new Float32Array(count);
    this.drag = new Float32Array(count);
    this.cursor = 0;

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this.mesh.visible = false;
  }

  spawn(x, y, z, opts = {}) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.count;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = opts.vx || 0;
    this.vel[i3 + 1] = opts.vy || 0;
    this.vel[i3 + 2] = opts.vz || 0;
    this.life[i] = opts.life || 0.7;
    this.maxLife[i] = this.life[i];
    this.scaleArr[i] = opts.scale || 1;
    this.gravity[i] = opts.gravity ?? -9;
    this.drag[i] = opts.drag ?? 1.5;
    this.mesh.visible = true;
    return i;
  }

  burst(x, y, z, n, opts = {}) {
    const spread = opts.spread || 4;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * TAU;
      const up = (opts.upBias ?? 0.6) + Math.random() * 0.8;
      const sp = spread * (0.4 + Math.random() * 0.8);
      this.spawn(x, y, z, {
        vx: Math.cos(a) * sp * (1 - up * 0.3),
        vy: up * sp,
        vz: Math.sin(a) * sp * (1 - up * 0.3),
        life: (opts.life || 0.6) * (0.6 + Math.random() * 0.8),
        scale: (opts.scale || 1) * (0.6 + Math.random() * 0.8),
        gravity: opts.gravity ?? -9,
        drag: opts.drag ?? 1.6
      });
    }
  }

  update(dt) {
    if (!this.mesh.visible) return;
    let alive = 0;
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      if (this.life[i] <= 0) {
        this._m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this._m);
        continue;
      }
      alive++;
      this.life[i] -= dt;
      const dragK = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i3] *= dragK;
      this.vel[i3 + 1] = this.vel[i3 + 1] * dragK + this.gravity[i] * dt;
      this.vel[i3 + 2] *= dragK;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      const s = this.scaleArr[i] * k;
      this._v.set(this.pos[i3], this.pos[i3 + 1], this.pos[i3 + 2]);
      this._s.set(s, s, s);
      this._m.compose(this._v, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (alive === 0) this.mesh.visible = false;
  }

  clear() {
    this.life.fill(0);
    this.mesh.visible = false;
  }
}

// ── Всплывающие числа урона (спрайты с canvas-текстурой) ──────────────────
class DamageNumbers {
  constructor(scene, capacity = 24) {
    this.scene = scene;
    this.sprites = [];
    this.textures = new Map();
    for (let i = 0; i < capacity; i++) {
      const mat = new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false });
      const sp = new THREE.Sprite(mat);
      sp.scale.set(1.1, 0.5, 1);
      sp.visible = false;
      sp.renderOrder = 999;
      scene.add(sp);
      this.sprites.push({ sprite: sp, life: 0, maxLife: 1, vy: 0, vx: 0 });
    }
    this.cursor = 0;
  }

  _texture(text, color) {
    const key = `${text}|${color}`;
    if (this.textures.has(key)) return this.textures.get(key);
    if (typeof document === 'undefined' || !document.createElement) return null;
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 128;
    const ctx = cv.getContext('2d');
    // Нет 2D-контекста (лимит канвасов/headless) — числа урона не рисуем,
    // но игра продолжает работать.
    if (!ctx || typeof ctx.fillText !== 'function') return null;
    ctx.clearRect(0, 0, 256, 128);
    ctx.font = 'bold 84px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(text, 128, 64);
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 64);
    const tex = new THREE.CanvasTexture(cv);
    tex.needsUpdate = true;
    this.textures.set(key, tex);
    return tex;
  }

  show(x, y, z, text, kind = 'hit') {
    const color = kind === 'crit' ? '#ffd24a' : kind === 'heal' ? '#6ee7a0' : kind === 'magic' ? '#a78bfa' : '#ffffff';
    const slot = this.sprites[this.cursor];
    this.cursor = (this.cursor + 1) % this.sprites.length;
    slot.sprite.material.map = this._texture(text, color);
    slot.sprite.material.needsUpdate = true;
    slot.sprite.position.set(x + (Math.random() - 0.5) * 0.5, y, z);
    slot.sprite.scale.set(kind === 'crit' ? 1.6 : 1.15, kind === 'crit' ? 0.72 : 0.52, 1);
    slot.sprite.visible = true;
    slot.life = kind === 'crit' ? 1.25 : 0.95;
    slot.maxLife = slot.life;
    slot.vy = 1.7;
    slot.vx = (Math.random() - 0.5) * 0.7;
  }

  update(dt, camera) {
    for (const s of this.sprites) {
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) { s.sprite.visible = false; continue; }
      s.sprite.position.y += s.vy * dt;
      s.sprite.position.x += s.vx * dt;
      s.vy = Math.max(0.3, s.vy - dt * 4.5);
      const k = s.life / s.maxLife;
      s.sprite.material.opacity = Math.min(1, k * 2.2);
    }
  }

  clear() {
    for (const s of this.sprites) { s.life = 0; s.sprite.visible = false; }
  }
}

// ── След клинка (лента-дуга при ударе) ───────────────────────────────────
export class SlashArc {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
  }

  spawn(position, facing, opts = {}) {
    const radius = opts.radius || 1.15;
    const color = opts.color || 0xdfefff;
    const segs = 22;
    const start = facing - 1.1;
    const geo = new THREE.BufferGeometry();
    const verts = [];
    const idx = [];
    for (let i = 0; i <= segs; i++) {
      const a = start + (i / segs) * 2.2;
      const inner = radius * 0.42;
      verts.push(Math.sin(a) * inner, Math.cos(a) * 0.02, Math.cos(a) * inner);
      verts.push(Math.sin(a) * radius, Math.cos(a) * 0.02, Math.cos(a) * radius);
    }
    for (let i = 0; i < segs; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
      depthWrite: false, blending: THREE.AdditiveBlending
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    mesh.position.y += opts.height || 1.15;
    mesh.rotation.y = 0;
    mesh.scale.setScalar(0.7);
    this.scene.add(mesh);
    this.active.push({ mesh, life: 0.26, maxLife: 0.26, grow: opts.grow || 6 });
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      a.life -= dt;
      if (a.life <= 0) {
        this.scene.remove(a.mesh);
        a.mesh.geometry.dispose();
        a.mesh.material.dispose();
        this.active.splice(i, 1);
        continue;
      }
      const k = 1 - a.life / a.maxLife;
      a.mesh.scale.setScalar(0.7 + k * a.grow * 0.1);
      a.mesh.material.opacity = 0.85 * (1 - k);
    }
  }
}

// ── Погодные частицы (дождь, снег, искры грозы) ──────────────────────────
export class WeatherFX {
  constructor(scene) {
    this.scene = scene;
    this.mode = 'clear';
    this.intensity = 0;
    this.targetIntensity = 0;
    this.area = 34;

    // Дождь: линии
    const rainCount = 1800;
    const rainGeo = new THREE.BufferGeometry();
    const rp = new Float32Array(rainCount * 6);
    this.rainCount = rainCount;
    for (let i = 0; i < rainCount; i++) {
      const x = (Math.random() - 0.5) * this.area * 2;
      const y = Math.random() * 26;
      const z = (Math.random() - 0.5) * this.area * 2;
      rp[i * 6] = x; rp[i * 6 + 1] = y; rp[i * 6 + 2] = z;
      rp[i * 6 + 3] = x + 0.06; rp[i * 6 + 4] = y - 0.75; rp[i * 6 + 5] = z + 0.02;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    this.rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xa8c8e8, transparent: true, opacity: 0.5 }));
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    scene.add(this.rain);

    // Снег: точки
    const snowCount = 1400;
    const snowGeo = new THREE.BufferGeometry();
    const sp = new Float32Array(snowCount * 3);
    this.snowDrift = new Float32Array(snowCount);
    for (let i = 0; i < snowCount; i++) {
      sp[i * 3] = (Math.random() - 0.5) * this.area * 2;
      sp[i * 3 + 1] = Math.random() * 22;
      sp[i * 3 + 2] = (Math.random() - 0.5) * this.area * 2;
      this.snowDrift[i] = Math.random() * TAU;
    }
    snowGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.11, transparent: true, opacity: 0.85, sizeAttenuation: true, depthWrite: false
    }));
    this.snow.frustumCulled = false;
    this.snow.visible = false;
    scene.add(this.snow);

    // Молния
    this.lightning = new THREE.PointLight(0xcfe6ff, 0, 60, 2);
    this.lightning.position.set(0, 20, 0);
    scene.add(this.lightning);
    this.lightningTimer = 4 + Math.random() * 6;
    this.flashTime = 0;

    // Пыль/листья при ясной погоде
    this.dust = new ParticlePool(scene, 120, new THREE.PointsMaterial({ color: 0xd8c8a0, size: 0.05, transparent: true, opacity: 0.5, depthWrite: false }), 0.05);
    this.dustTimer = 0;
  }

  setWeather(mode, intensity = 1) {
    this.mode = mode;
    this.targetIntensity = mode === 'clear' ? 0 : intensity;
    this.rain.visible = mode === 'rain' || mode === 'storm';
    this.snow.visible = mode === 'snow';
    this.rain.material.opacity = mode === 'storm' ? 0.65 : 0.42;
  }

  update(dt, center) {
    this.intensity += (this.targetIntensity - this.intensity) * Math.min(1, dt * 2);
    const cx = center.x, cy = center.y, cz = center.z;

    if (this.rain.visible) {
      this.rain.position.set(cx, 0, cz);
      const pos = this.rain.geometry.attributes.position.array;
      const fall = 34 * dt;
      const drift = (this.mode === 'storm' ? 6 : 2) * dt;
      for (let i = 0; i < this.rainCount; i++) {
        const o = i * 6;
        pos[o + 1] -= fall;
        pos[o + 4] -= fall;
        pos[o] += drift;
        pos[o + 3] += drift;
        if (pos[o + 1] < cy - 2) {
          const x = (Math.random() - 0.5) * this.area * 2;
          const z = (Math.random() - 0.5) * this.area * 2;
          const y = cy + 20 + Math.random() * 6;
          pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
          pos[o + 3] = x + 0.06; pos[o + 4] = y - 0.75; pos[o + 5] = z + 0.02;
        }
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }

    if (this.snow.visible) {
      this.snow.position.set(cx, 0, cz);
      const pos = this.snow.geometry.attributes.position.array;
      for (let i = 0; i < this.snowDrift.length; i++) {
        const o = i * 3;
        this.snowDrift[i] += dt * 1.6;
        pos[o + 1] -= dt * 1.7;
        pos[o] += Math.sin(this.snowDrift[i]) * dt * 0.9;
        pos[o + 2] += Math.cos(this.snowDrift[i] * 0.7) * dt * 0.6;
        if (pos[o + 1] < cy - 2) {
          pos[o] = (Math.random() - 0.5) * this.area * 2;
          pos[o + 1] = cy + 18 + Math.random() * 5;
          pos[o + 2] = (Math.random() - 0.5) * this.area * 2;
        }
      }
      this.snow.geometry.attributes.position.needsUpdate = true;
    }

    // Молния в грозу
    if (this.mode === 'storm') {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.flashTime = 0.18;
        this.lightningTimer = 5 + Math.random() * 9;
        this.lightning.position.set(cx + (Math.random() - 0.5) * 50, 24, cz + (Math.random() - 0.5) * 50);
      }
    }
    if (this.flashTime > 0) {
      this.flashTime -= dt;
      this.lightning.intensity = this.flashTime > 0 ? 9 + Math.random() * 6 : 0;
    } else {
      this.lightning.intensity = 0;
    }

    // Пыль в ясную погоду
    if (this.mode === 'clear' || this.mode === 'fog') {
      this.dustTimer -= dt;
      if (this.dustTimer <= 0) {
        this.dustTimer = 0.22;
        this.dust.burst(cx + (Math.random() - 0.5) * 20, cy + 0.4 + Math.random() * 2.2, cz + (Math.random() - 0.5) * 20, 2, {
          spread: 0.5, life: 2.4, scale: 0.7, gravity: 0.15, drag: 0.4, upBias: 0.5
        });
      }
    }
    this.dust.update(dt);
  }

  dispose() {
    this.scene.remove(this.rain, this.snow, this.lightning);
  }
}

// ── Главный фасад эффектов ───────────────────────────────────────────────
export class Effects3D {
  constructor(scene) {
    this.scene = scene;
    this.sparks = new ParticlePool(scene, 380, new THREE.MeshBasicMaterial({ color: 0xffd27a }), 0.055);
    this.blood = new ParticlePool(scene, 260, new THREE.MeshBasicMaterial({ color: 0x8a1218 }), 0.07);
    this.magic = new ParticlePool(scene, 320, new THREE.MeshBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), 0.08);
    this.dustFX = new ParticlePool(scene, 220, new THREE.MeshBasicMaterial({ color: 0xbfae8a, transparent: true, opacity: 0.55, depthWrite: false }), 0.1);
    this.heal = new ParticlePool(scene, 160, new THREE.MeshBasicMaterial({ color: 0x6ee7a0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }), 0.07);

    this.slash = new SlashArc(scene);
    this.numbers = new DamageNumbers(scene);
    this.weather = new WeatherFX(scene);

    // Вспышка света удара
    this.hitLight = new THREE.PointLight(0xffc46b, 0, 9, 2);
    scene.add(this.hitLight);
    this.hitLightTime = 0;

    // Кольцо ударной волны (для тяжёлых атак/боссов)
    this.rings = [];
    this.ringGeo = new THREE.RingGeometry(0.9, 1.0, 40);
  }

  hit(position, opts = {}) {
    const { power = 1, kind = 'physical' } = opts;
    const y = position.y + 1.05;
    const n = Math.round(5 + power * 7);
    if (kind === 'magic') {
      this.magic.burst(position.x, y, position.z, n + 6, { spread: 3.6 * power, life: 0.75, scale: 1.1, gravity: 1.2, drag: 1.1 });
    } else {
      this.sparks.burst(position.x, y, position.z, n, { spread: 4.2 * power, life: 0.5, scale: 1, gravity: -8 });
      this.blood.burst(position.x, y, position.z, Math.round(3 + power * 5), { spread: 2.6 * power, life: 0.8, scale: 0.9, gravity: -12 });
    }
    this.hitLight.position.set(position.x, y, position.z);
    this.hitLightTime = 0.12;
    this.hitLight.intensity = 3.5 * power;
  }

  footstep(position, kind = 'ground') {
    this.dustFX.burst(position.x, position.y + 0.05, position.z, 3, {
      spread: kind === 'snow' ? 1.2 : 0.9, life: 0.5, scale: 0.7, gravity: 0.6, drag: 2.2, upBias: 0.4
    });
  }

  healBurst(position) {
    this.heal.burst(position.x, position.y + 1.0, position.z, 18, { spread: 2.4, life: 1.2, scale: 1.1, gravity: 2.4, drag: 0.8 });
  }

  impactRing(position, radius = 3, color = 0xff8a3a) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.62, 40), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(position.x, position.y + 0.12, position.z);
    this.scene.add(mesh);
    this.rings.push({ mesh, life: 0.62, maxLife: 0.62, radius });
  }

  damageNumber(position, amount, kind) {
    this.numbers.show(position.x, position.y + 1.9, position.z, String(Math.round(amount)), kind);
  }

  update(dt, camera, center) {
    this.sparks.update(dt);
    this.blood.update(dt);
    this.magic.update(dt);
    this.dustFX.update(dt);
    this.heal.update(dt);
    this.slash.update(dt);
    this.numbers.update(dt, camera);
    this.weather.update(dt, center || { x: 0, y: 0, z: 0 });

    if (this.hitLightTime > 0) {
      this.hitLightTime -= dt;
      if (this.hitLightTime <= 0) this.hitLight.intensity = 0;
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) {
        this.scene.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mesh.material.dispose();
        this.rings.splice(i, 1);
        continue;
      }
      const k = 1 - r.life / r.maxLife;
      r.mesh.scale.setScalar(0.4 + k * r.radius * 2.6);
      r.mesh.material.opacity = 0.8 * (1 - k);
    }
  }

  clear() {
    this.sparks.clear();
    this.blood.clear();
    this.magic.clear();
    this.dustFX.clear();
    this.heal.clear();
    this.numbers.clear();
  }
}
