// VEXMORA 3D — ландшафт: чанковая геометрия по процедурной карте (mapgen.js).
// Каждый чанк строится с учётом высот, биомов и воды, со своими материалом,
// цветами вершин (плавные переходы биомов) и LOD-уровнями детализации.

import * as THREE from 'three';
import { fbm, vnoise } from '../core/materials.js';
import { CHUNK_SIZE, WORLD_SCALE, HEIGHT_SCALE, sampleHeight } from '../core/sky.js';

// Цвета биомов в линейном пространстве (совпадают с палитрой карты)
export const BIOME_COLORS = {
  water:     [0.055, 0.115, 0.185],
  shallow:   [0.11, 0.26, 0.36],
  coast:     [0.70, 0.61, 0.42],
  plains:    [0.26, 0.42, 0.19],
  forest:    [0.17, 0.30, 0.14],
  swamp:     [0.16, 0.21, 0.14],
  desert:    [0.66, 0.52, 0.31],
  snow:      [0.82, 0.88, 0.94],
  mountains: [0.38, 0.38, 0.40],
  city:      [0.15, 0.17, 0.21],
  // OPEN WORLD: новые биомы (без этих цветов они рисовались как равнина)
  deep_forest: [0.10, 0.21, 0.09],
  ashland:     [0.30, 0.24, 0.21],
  ruins:       [0.36, 0.33, 0.29],
  canyon:      [0.46, 0.26, 0.17],
  rock:      [0.34, 0.34, 0.37],
  sand:      [0.72, 0.63, 0.44]
};

const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// Высота по карте (в метрах 3D) с выпуклостью гор
export function heightAt(map, wx, wy) {
  if (!map) return 0;
  const h = sampleHeight(map, wx, wy);
  return h * WORLD_SCALE;
}

export class TerrainManager {
  constructor(scene, map, quality = 'high') {
    this.scene = scene;
    this.map = map;
    this.quality = quality;
    this.group = new THREE.Group();
    this.group.name = 'terrain';
    scene.add(this.group);

    this.chunks = new Map();          // key -> mesh
    this.cell = map ? map.cell : 40;
    this.chunkCells = Math.round(CHUNK_SIZE / WORLD_SCALE / this.cell); // клеток на чанк
    this.viewRadius = 4;              // чанков вокруг игрока

    this.waterMesh = null;
    this.waterUniforms = null;
    this._buildWater();
  }

  setQuality(quality) {
    this.quality = quality;
    const settings = { low: 3, medium: 4, high: 5, ultra: 6 };
    this.viewRadius = settings[quality] || 4;
  }

  // ── Вода: единая плоскость с шейдером (волны, отражение неба, прозрачность) ──
  _buildWater() {
    const geo = new THREE.PlaneGeometry(900, 900, 96, 96);
    geo.rotateX(-Math.PI / 2);
    this.waterUniforms = {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.2) },
      uSunColor: { value: new THREE.Color(0xffffff) },
      uDeep: { value: new THREE.Color(0x0b2d44) },
      uShallow: { value: new THREE.Color(0x2a7ba8) },
      uSky: { value: new THREE.Color(0x9ec8e8) },
      uOpacity: { value: 0.86 }
    };
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: this.waterUniforms,
      vertexShader: `
        uniform float uTime;
        varying vec3 vPos; varying vec3 vNormalW; varying float vWave;
        void main() {
          vec3 p = position;
          float w1 = sin(p.x * 0.12 + uTime * 1.4) * 0.16;
          float w2 = sin(p.z * 0.17 - uTime * 1.1) * 0.12;
          float w3 = sin((p.x + p.z) * 0.31 + uTime * 2.2) * 0.06;
          p.y += w1 + w2 + w3;
          vWave = w1 + w2;
          vec4 wp = modelMatrix * vec4(p, 1.0);
          vPos = wp.xyz;
          vNormalW = normalize((modelMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime; uniform vec3 uSunDir; uniform vec3 uSunColor;
        uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSky; uniform float uOpacity;
        varying vec3 vPos; varying vec3 vNormalW; varying float vWave;
        void main() {
          vec3 V = normalize(cameraPosition - vPos);
          // Микро-нормали от волн для бликов
          float dx = cos(vPos.x * 0.9 + uTime * 2.0) * 0.06 + cos(vPos.x * 2.3 - uTime * 3.1) * 0.03;
          float dz = cos(vPos.z * 0.8 - uTime * 1.7) * 0.06 + cos(vPos.z * 2.1 + uTime * 2.6) * 0.03;
          vec3 N = normalize(vec3(-dx, 1.0, -dz));
          float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
          vec3 base = mix(uDeep, uShallow, clamp(vWave * 1.6 + 0.45, 0.0, 1.0));
          vec3 col = mix(base, uSky, fres * 0.72);
          vec3 H = normalize(uSunDir + V);
          float spec = pow(max(dot(N, H), 0.0), 190.0) * 2.4;
          col += uSunColor * spec;
          float alpha = mix(uOpacity, 0.98, fres);
          gl_FragColor = vec4(col, alpha);
        }
      `
    });
    this.waterMesh = new THREE.Mesh(geo, mat);
    this.waterMesh.position.y = 0.05;
    this.waterMesh.renderOrder = 2;
    this.waterMesh.frustumCulled = false;
    this.scene.add(this.waterMesh);
  }

  // ── Построение геометрии чанка ─────────────────────────────────────────
  buildChunk(cx, cy, lod = 0) {
    const map = this.map;
    const cells = Math.max(4, this.chunkCells);
    const segs = { 0: cells, 1: Math.max(4, Math.round(cells / 2)), 2: Math.max(3, Math.round(cells / 4)) }[lod] || cells;
    const size = CHUNK_SIZE;
    const originX = cx * size;
    const originZ = cy * size;
    const res = segs + 1;

    const positions = new Float32Array(res * res * 3);
    const colors = new Float32Array(res * res * 3);
    const uvs = new Float32Array(res * res * 2);
    const indices = [];

    const cellW = size / segs;

    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const lx = i * cellW;
        const lz = j * cellW;
        // Переводим в world-единицы (2D-координаты карты)
        const wx = (originX + lx) / WORLD_SCALE;
        const wz = (originZ + lz) / WORLD_SCALE;

        // Высоты + микрорельеф (крупные формы + мелкая детализация)
        let y = heightAt(map, wx, wz);
        const detail = (fbm(wx * 0.006, wz * 0.006, 7, 4) - 0.5) * 1.7
                     + (fbm(wx * 0.02, wz * 0.02, 13, 3) - 0.5) * 0.55;
        const cellInfo = map ? map.cellAt(wx, wz) : null;
        const isWater = cellInfo ? (cellInfo.water && !cellInfo.bridge) : false;
        if (!isWater) y += detail * (cellInfo && cellInfo.biome === 'mountains' ? 1.6 : 1);
        if (isWater) y = Math.min(y, -0.4);

        const idx = j * res + i;
        positions[idx * 3] = lx;
        positions[idx * 3 + 1] = y;
        positions[idx * 3 + 2] = lz;
        uvs[idx * 2] = lx / 6;
        uvs[idx * 2 + 1] = lz / 6;

        // Цвет вершины по биому со смешиванием соседей (плавные переходы)
        let col = [0.3, 0.42, 0.2];
        if (cellInfo) {
          const biome = cellInfo.biome;
          if (isWater) col = cellInfo.water === 2 ? BIOME_COLORS.water : BIOME_COLORS.shallow;
          else if (biome === 'coast') col = BIOME_COLORS.coast;
          else col = BIOME_COLORS[biome] || BIOME_COLORS.plains;

          // Склон → камень (реалистичная смена материала на крутых участках)
          if (!isWater) {
            const hx = heightAt(map, wx + 12, wz) - heightAt(map, wx - 12, wz);
            const hz = heightAt(map, wx, wz + 12) - heightAt(map, wx, wz - 12);
            const slope = Math.hypot(hx, hz) / 24;
            if (slope > 0.55) col = lerp3(col, BIOME_COLORS.rock, Math.min(1, (slope - 0.55) * 2.2));
            // Высокогорная снежная шапка
            if (y > 9.5) col = lerp3(col, BIOME_COLORS.snow, Math.min(0.85, (y - 9.5) * 0.18));
            // Естественная вариация цвета
            const v = (vnoise(wx * 0.05, wz * 0.05, 5) - 0.5) * 0.10;
            col = [col[0] + v, col[1] + v * 1.2, col[2] + v * 0.7];
          }
        }
        colors[idx * 3] = Math.max(0, col[0]);
        colors[idx * 3 + 1] = Math.max(0, col[1]);
        colors[idx * 3 + 2] = Math.max(0, col[2]);
      }
    }

    for (let j = 0; j < segs; j++) {
      for (let i = 0; i < segs; i++) {
        const a = j * res + i;
        const b = a + 1;
        const c = a + res;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }

  // Материал ландшафта: смешивает текстуры травы/камня/песка по цветам вершин,
  // добавляет детализацию на близких дистанциях (трипланетарное наложение).
  // Детальные текстуры поверхности: микрорельеф (нормали) + модуляция цвета.
  // Умножаются на цвета вершин по биомам — так трава/камень/песок выглядят
  // фактурно, а не «залитыми» одним цветом.
  _buildDetailTextures() {
    if (this._detail) return this._detail;
    const size = this.quality === 'ultra' ? 512 : this.quality === 'high' ? 256 : 128;
    const mk = () => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = size;
      return cv;
    };

    // 1. Цветовая детализация: почти белая с вариацией яркости и лёгким сдвигом тона
    const cvA = mk();
    const ctxA = cvA.getContext('2d');
    // Без 2D-контекста (лимит канвасов на мобильном) ландшафт рисуется без
    // микрорельефа, но не падает.
    if (!ctxA || typeof ctxA.createImageData !== 'function') {
      this._detail = null;
      return null;
    }
    const imgA = ctxA.createImageData(size, size);
    const dA = imgA.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const u = x / size, v = y / size;
        const fine = fbm(u * 34, v * 34, 3, 4);
        const coarse = fbm(u * 9, v * 9, 11, 3);
        const grain = vnoise(u * 190, v * 190, 17);
        const lum = 0.72 + fine * 0.22 + coarse * 0.12 + (grain - 0.5) * 0.10;
        dA[i] = Math.min(255, lum * 255 * 1.02);
        dA[i + 1] = Math.min(255, lum * 255);
        dA[i + 2] = Math.min(255, lum * 255 * 0.96);
        dA[i + 3] = 255;
      }
    }
    ctxA.putImageData(imgA, 0, 0);
    const albedo = new THREE.CanvasTexture(cvA);
    albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping;
    albedo.colorSpace = THREE.SRGBColorSpace;
    albedo.anisotropy = this.quality === 'ultra' ? 8 : 4;

    // 2. Нормали: бугры, кочки, трещины
    const cvN = mk();
    const ctxN = cvN.getContext('2d');
    if (!ctxN || typeof ctxN.createImageData !== 'function') {
      this._detail = null;
      return null;
    }
    const imgN = ctxN.createImageData(size, size);
    const dN = imgN.data;
    const height = (u, v) => fbm(u * 18, v * 18, 29, 4) * 0.7 + fbm(u * 46, v * 46, 5, 2) * 0.3;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const u = x / size, v = y / size;
        const e = 1 / size;
        const dx = height(u + e, v) - height(u - e, v);
        const dy = height(u, v + e) - height(u, v - e);
        const nx = -dx * 14, ny = -dy * 14, nz = 1;
        const len = Math.hypot(nx, ny, nz) || 1;
        dN[i] = ((nx / len) * 0.5 + 0.5) * 255;
        dN[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
        dN[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
        dN[i + 3] = 255;
      }
    }
    ctxN.putImageData(imgN, 0, 0);
    const normal = new THREE.CanvasTexture(cvN);
    normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
    normal.colorSpace = THREE.NoColorSpace;
    normal.anisotropy = albedo.anisotropy;

    this._detail = { albedo, normal };
    return this._detail;
  }

  _terrainMaterial() {
    if (this._mat) return this._mat;
    const params = {
      vertexColors: true,
      roughness: 0.93,
      metalness: 0.02,
      flatShading: false
    };
    if (typeof document !== 'undefined') {
      try {
        const detail = this._buildDetailTextures();
        if (detail && detail.albedo) {
          params.map = detail.albedo;
          params.normalMap = detail.normal;
          params.normalScale = new THREE.Vector2(0.7, 0.7);
          // UV чанка: 1 тайл на 6 world-единиц → правдоподобный масштаб фактуры
          params.map.repeat.set(1, 1);
        }
      } catch (err) {
        console.warn('[VEXMORA 3D] детальные текстуры рельефа недоступны:', err?.message);
      }
    }
    this._mat = new THREE.MeshStandardMaterial(params);
    return this._mat;
  }

  getChunkKey(cx, cy) { return `${cx},${cy}`; }

  // Подгрузка/выгрузка чанков вокруг позиции (в 3D-координатах)
  update(playerPos, dt, quality) {
    this.waterUniforms.uTime.value += dt;
    this.waterMesh.position.set(playerPos.x, 0.05, playerPos.z);

    const size = CHUNK_SIZE;
    const camCx = Math.floor(playerPos.x / size);
    const camCz = Math.floor(playerPos.z / size);
    const R = this.viewRadius;

    // Бюджет перестроек LOD на кадр. Раньше на границе полос LOD чанк
    // пересобирался каждый кадр (до 180 перестроек в секунду на рывке) —
    // это и давало просадки до 8–20 мс в отдельных кадрах.
    let lodSwaps = 0;
    const LOD_SWAP_BUDGET = 2;
    const HYST = 0.35;                       // запас в долях чанка от границы полос
    const band = (d) => (d < 1.6 ? 0 : d < 3.2 ? 1 : 2);
    const bandEdge = (lod) => (lod === 0 ? 1.6 : 3.2);

    const needed = new Set();
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        const cx = camCx + dx, cz = camCz + dz;
        const dist = Math.hypot(dx, dz);
        if (dist > R + 0.5) continue;
        // LOD: ближние чанки полные, дальние — упрощённые
        const lod = dist < 1.6 ? 0 : dist < 3.2 ? 1 : 2;
        const key = `${cx},${cz}`;
        needed.add(key);
        const existing = this.chunks.get(key);
        if (!existing) {
          const geo = this.buildChunk(cx, cz, lod);
          const mesh = new THREE.Mesh(geo, this._terrainMaterial());
          mesh.position.set(cx * size, 0, cz * size);
          mesh.receiveShadow = true;
          mesh.castShadow = lod === 0;
          mesh.userData = { lod, key };
          this.group.add(mesh);
          this.chunks.set(key, mesh);
        } else {
          const cur = existing.userData.lod;
          // Гистерезис: у самой границы полос качество не меняем, иначе
          // чанк «мигает» между LOD 0/1/2 при каждом шаге героя.
          let want = lod;
          if (want !== cur) {
            const edge = bandEdge(Math.min(want, cur));
            if (Math.abs(dist - edge) < HYST) want = cur;
            else if (want < cur && dist > edge - HYST) want = cur;      // повышение качества — только с запасом
            else if (want > cur && dist < edge + HYST) want = cur;      // понижение — тоже с запасом
          }
          if (want !== cur && lodSwaps < LOD_SWAP_BUDGET) {
            lodSwaps++;
            existing.geometry.dispose();
            existing.geometry = this.buildChunk(cx, cz, want);
            existing.castShadow = want === 0;
            existing.userData.lod = want;
          }
        }
      }
    }

    // Выгрузка далёких чанков
    for (const [key, mesh] of this.chunks) {
      if (!needed.has(key)) {
        this.group.remove(mesh);
        mesh.geometry.dispose();
        this.chunks.delete(key);
      }
    }
  }

  // Высота ландшафта в 3D-точке (для коллизий камеры/персонажа)
  heightAt3D(x, z) {
    return heightAt(this.map, x / WORLD_SCALE, z / WORLD_SCALE);
  }

  dispose() {
    for (const [, mesh] of this.chunks) {
      this.group.remove(mesh);
      mesh.geometry.dispose();
    }
    this.chunks.clear();
    if (this._mat) this._mat.dispose();
    if (this.waterMesh) {
      this.scene.remove(this.waterMesh);
      this.waterMesh.geometry.dispose();
      this.waterMesh.material.dispose();
    }
  }
}
