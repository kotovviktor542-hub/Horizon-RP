// VEXMORA 3D — ядро мира: координаты, небо, цикл дня/ночи, погода, освещение.
// Мир игры остаётся прежним (6400x6400 world-единиц на плоскости XZ),
// но теперь у него есть высота Y из процедурной карты (mapgen.js).

import * as THREE from 'three';

export const WORLD_SCALE = 0.1;          // 1 world-единица = 0.1 метра 3D
export const CHUNK_SIZE = 64;             // размер чанка ландшафта в world-единицах (6.4 м)
export const HEIGHT_SCALE = 210;          // амплитуда рельефа в world-единицах

// Преобразование координат игрового движка (2D) в 3D
export const worldTo3D = (x, y) => ({ x: x * WORLD_SCALE, z: y * WORLD_SCALE });
export const worldTo2D = (x, z) => ({ x: x / WORLD_SCALE, y: z / WORLD_SCALE });

// Высота поверхности в world-координатах (с учётом рельефа карты)
export function terrainHeight2D(map, x, y) {
  if (!map) return 0;
  const cell = map.cellAt(x, y);
  const e = cell.elevation;
  if (cell.water && !cell.bridge) return -6;
  const base = Math.max(0, (e - map.seaLevel) * HEIGHT_SCALE);
  // Тот же профиль, что используется в геометрии чанков (см. terrain.js)
  return base;
}

export function terrainHeight3D(map, x, z) {
  const p = worldTo2D(x, z);
  return terrainHeight2D(map, p.x, p.y) * WORLD_SCALE;
}

// Профиль высоты для вершин чанка — единый источник правды для физики и рендера
export function sampleHeight(map, wx, wy, step = 40) {
  if (!map) return 0;
  // Сглаженная выборка: 4 точки билинейно по высотам клеток
  const c = map.cellAt(wx, wy);
  const h00 = cellHeight(map, c.gx, c.gy);
  const h10 = cellHeight(map, c.gx + 1, c.gy);
  const h01 = cellHeight(map, c.gx, c.gy + 1);
  const h11 = cellHeight(map, c.gx + 1, c.gy + 1);
  const fx = (wx / map.cell) - c.gx;
  const fy = (wy / map.cell) - c.gy;
  const h = (h00 * (1 - fx) + h10 * fx) * (1 - fy) + (h01 * (1 - fx) + h11 * fx) * fy;
  return h;
}

function cellHeight(map, gx, gy) {
  const G = map.grid;
  const x = Math.max(0, Math.min(G - 1, gx));
  const y = Math.max(0, Math.min(G - 1, gy));
  const i = y * G + x;
  if (map.water[i] && !map.bridge[i]) return -8;
  const e = map.elevation[i];
  const d = Math.max(0, e - map.seaLevel);
  // Небольшая выпуклость для гор, пологая для равнин
  const t = Math.min(1, d / 0.20);
  return d * HEIGHT_SCALE * (0.75 + t * 0.55);
}

// ── Палитры неба по времени суток ────────────────────────────────────────
const SKY_KEYS = [
  { t: 0.00, top: 0x05070f, bottom: 0x121b2c, fog: 0x0b1220, sun: 0x3b4a6b, intensity: 0.16, ambient: 0x223047, amb: 0.30 },
  { t: 0.20, top: 0x101a30, bottom: 0x2a2b45, fog: 0x2a2c40, sun: 0x6b5a7a, intensity: 0.30, ambient: 0x3a3f5a, amb: 0.36 },
  { t: 0.28, top: 0x2b3a5e, bottom: 0x8a6a6a, fog: 0x6b5a62, sun: 0xffb27a, intensity: 1.05, ambient: 0x8a7f80, amb: 0.50 },
  { t: 0.36, top: 0x4a7ec0, bottom: 0xc9d8e8, fog: 0xa8bccf, sun: 0xfff0d8, intensity: 1.75, ambient: 0xa9b8c9, amb: 0.62 },
  { t: 0.50, top: 0x5590d8, bottom: 0xd6e6f2, fog: 0xbcd0e0, sun: 0xffffff, intensity: 2.05, ambient: 0xb8c6d4, amb: 0.68 },
  { t: 0.66, top: 0x4a7ec0, bottom: 0xd8c9a8, fog: 0xc0b8a6, sun: 0xffe0b0, intensity: 1.80, ambient: 0xb0a99a, amb: 0.62 },
  { t: 0.76, top: 0x2e3a5c, bottom: 0xc07a52, fog: 0x8a6a5e, sun: 0xff9a54, intensity: 1.10, ambient: 0x8a7a72, amb: 0.48 },
  { t: 0.84, top: 0x141c30, bottom: 0x3a2c3c, fog: 0x2a2438, sun: 0x5a4a6a, intensity: 0.34, ambient: 0x353a52, amb: 0.34 },
  { t: 1.00, top: 0x05070f, bottom: 0x121b2c, fog: 0x0b1220, sun: 0x3b4a6b, intensity: 0.16, ambient: 0x223047, amb: 0.30 }
];

const lerpColor = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);

export class SkySystem {
  constructor(scene) {
    this.scene = scene;
    this.time = 0.36;
    this.weather = 'clear';
    this.weatherIntensity = 1;
    this.windStrength = 0.4;

    // Купол неба: сфера с градиентом через вершинные цвета
    const skyGeo = new THREE.SphereGeometry(900, 32, 20);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x4a7ec0) },
        bottomColor: { value: new THREE.Color(0xc9d8e8) },
        offset: { value: 60 },
        exponent: { value: 0.75 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPosition = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor; uniform vec3 bottomColor;
        uniform float offset; uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.sky.frustumCulled = false;
    scene.add(this.sky);

    // Солнце и луна (светила)
    this.sun = new THREE.DirectionalLight(0xffffff, 2.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 400;
    this.sun.shadow.camera.left = -80;
    this.sun.shadow.camera.right = 80;
    this.sun.shadow.camera.top = 80;
    this.sun.shadow.camera.bottom = -80;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.035;
    scene.add(this.sun);
    scene.add(this.sun.target);

    // Полусферический и заполняющий свет — «мягкая» кинематографичная база
    this.hemi = new THREE.HemisphereLight(0xa9b8c9, 0x2a2a20, 1.05);
    scene.add(this.hemi);
    this.fill = new THREE.DirectionalLight(0x8fb8ff, 0.35);
    this.fill.position.set(-1, 0.7, -0.6);
    scene.add(this.fill);

    // Текстура неба для отражений в envMap (вода, металл)
    this.fog = new THREE.FogExp2(0xa8bccf, 0.0055);
    scene.fog = this.fog;

    // Звёзды
    const starGeo = new THREE.BufferGeometry();
    const starCount = 1400;
    const pos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(Math.random() * 0.95 + 0.05);
      const r = 780;
      pos[i * 3] = Math.sin(ph) * Math.cos(th) * r;
      pos[i * 3 + 1] = Math.cos(ph) * r;
      pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xdfe9ff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0 });
    this.stars = new THREE.Points(starGeo, starMat);
    this.stars.frustumCulled = false;
    scene.add(this.stars);
  }

  // Ключевые кадры неба по времени суток (time 0..1)
  sampleSky(t) {
    let a = SKY_KEYS[0], b = SKY_KEYS[SKY_KEYS.length - 1];
    for (let i = 0; i < SKY_KEYS.length - 1; i++) {
      if (t >= SKY_KEYS[i].t && t <= SKY_KEYS[i + 1].t) { a = SKY_KEYS[i]; b = SKY_KEYS[i + 1]; break; }
    }
    const span = Math.max(0.0001, b.t - a.t);
    const k = Math.min(1, Math.max(0, (t - a.t) / span));
    return {
      top: lerpColor(a.top, b.top, k),
      bottom: lerpColor(a.bottom, b.bottom, k),
      fog: lerpColor(a.fog, b.fog, k),
      sun: lerpColor(a.sun, b.sun, k),
      intensity: a.intensity + (b.intensity - a.intensity) * k,
      ambient: lerpColor(a.ambient, b.ambient, k),
      amb: a.amb + (b.amb - a.amb) * k
    };
  }

  setQuality(level) {
    const mapSizes = { low: 512, medium: 1024, high: 2048, ultra: 4096 };
    const size = mapSizes[level] || 1024;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      if (this.sun.shadow.map) {
        this.sun.shadow.map.dispose();
        this.sun.shadow.map = null;
      }
    }
    this.sun.castShadow = level !== 'low';
    this._shadowLevel = level;
  }

  // Радиус теней: чем меньше область, тем выше фактическое разрешение тени
  // и меньше объектов попадает во второй проход рендера.
  setShadowDistance(distance) {
    const sc = this.sun?.shadow?.camera;
    if (!sc) return;
    const d = Math.max(12, distance || 0);
    if (this._shadowDist === d) return;
    this._shadowDist = d;
    sc.left = -d; sc.right = d; sc.top = d; sc.bottom = -d;
    sc.far = Math.max(120, d * 4);
    sc.updateProjectionMatrix();
  }

  update(dt, cameraPos, time, weather = 'clear', weatherIntensity = 1) {
    this.time = ((time % 1) + 1) % 1;
    this.weather = weather;
    this.weatherIntensity = weatherIntensity;
    const s = this.sampleSky(this.time);

    // Погода влияет на цвет неба и плотность тумана
    let top = s.top.clone();
    let bottom = s.bottom.clone();
    let fogColor = s.fog.clone();
    let sunIntensity = s.intensity;
    let fogDensity = 0.0055;

    if (weather === 'rain') {
      top.lerp(new THREE.Color(0x39424f), 0.75);
      bottom.lerp(new THREE.Color(0x6a7482), 0.7);
      fogColor.lerp(new THREE.Color(0x5c6570), 0.7);
      sunIntensity *= 0.42;
      fogDensity = 0.011;
    } else if (weather === 'storm') {
      top.lerp(new THREE.Color(0x1a1f2b), 0.85);
      bottom.lerp(new THREE.Color(0x353b48), 0.8);
      fogColor.lerp(new THREE.Color(0x2b313c), 0.8);
      sunIntensity *= 0.28;
      fogDensity = 0.014;
    } else if (weather === 'snow') {
      top.lerp(new THREE.Color(0x8fa3b8), 0.6);
      bottom.lerp(new THREE.Color(0xd2dde8), 0.65);
      fogColor.lerp(new THREE.Color(0xc2cedb), 0.65);
      sunIntensity *= 0.65;
      fogDensity = 0.013;
    } else if (weather === 'fog') {
      fogColor.lerp(new THREE.Color(0x9aa6b2), 0.8);
      sunIntensity *= 0.7;
      fogDensity = 0.024;
    }

    // Купол неба и звёзды двигаются вместе с камерой — бесконечное небо без артефактов
    if (cameraPos) {
      this.sky.position.set(cameraPos.x, 0, cameraPos.z);
      this.stars.position.set(cameraPos.x, 0, cameraPos.z);
      // Теневая камера солнца следует за игроком
      if (this.sun && this.sun.target) {
        this.sun.target.position.set(cameraPos.x, 0, cameraPos.z);
        this.sun.target.updateMatrixWorld();
      }
    }

    this.sky.material.uniforms.topColor.value.copy(top);
    this.sky.material.uniforms.bottomColor.value.copy(bottom);
    this.fog.color.copy(fogColor);
    this.fog.density = fogDensity;

    // Солнце идёт по дуге: восход на востоке, закат на западе
    const angle = (this.time - 0.25) * Math.PI * 2;
    const dist = 220;
    this.sun.position.set(
      cameraPos.x + Math.cos(angle) * dist,
      cameraPos.y + Math.sin(angle) * dist * 0.9 + 20,
      cameraPos.z + Math.sin(angle * 0.6) * dist * 0.55
    );
    this.sun.target.position.copy(cameraPos);
    this.sun.color.copy(s.sun);
    this.sun.intensity = sunIntensity;
    this.hemi.color.copy(s.ambient);
    this.hemi.intensity = s.amb * (weather === 'clear' ? 1 : 1.15);
    this.fill.intensity = 0.12 + (1 - Math.min(1, sunIntensity / 2)) * 0.30;

    // Тень следует за игроком, чтобы она всегда была в кадре
    const sc = this.sun.shadow.camera;
    sc.updateProjectionMatrix();

    this.sky.position.copy(cameraPos);
    this.stars.position.copy(cameraPos);
    this.stars.material.opacity = Math.max(0, 1 - Math.min(1, sunIntensity / 1.1)) * (weather === 'clear' ? 1 : 0.25);

    return { sunIntensity, fogDensity, night: sunIntensity < 0.5 };
  }
}
