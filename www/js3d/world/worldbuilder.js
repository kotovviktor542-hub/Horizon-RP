// VEXMORA 3D — размещение мира: растительность, здания, транспорт, костры, сундуки,
// камни. Использует InstancedMesh для травы/деревьев (тысячи объектов без просадок)
// и LOD-уровни: ближние — полные модели, средние — упрощённые, дальние — билборды/скрыты.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createMaterial, colorMaterial, emissiveMaterial } from '../core/materials.js';
import { Structures, Vehicles3D } from './models.js';
import { WORLD_SCALE } from '../core/sky.js';

const TAU = Math.PI * 2;
const rnd = (seed, n = 1) => {
  const v = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

export class WorldBuilder {
  constructor(scene, world, map, terrain, quality = 'high', options = {}) {
    this.scene = scene;
    this.world = world;
    this.map = map;
    this.terrain = terrain;
    this.quality = quality;
    this.group = new THREE.Group();
    this.group.name = 'world-props';
    scene.add(this.group);

    this.cells = new Map();          // ключ ячейки -> { props, nodes, buildings, ... }
    this.cellSize = 30;              // world-единиц (3 м)
    this.instanced = [];             // { mesh, positions, radius }
    this.buildingMeshes = [];
    this.dynamicProps = [];          // объекты, которым нужна анимация (огонь, свет)
    this.lampLights = [];
    this.campfires = options.campfires || [];

    this._prepareData();
    this._buildInstancedFoliage();
    this._buildStructures();
    this._buildCampfires();
    this._buildVehicles();
    this._buildChests();
  }

  // ── Индексация данных мира по ячейкам — быстрая выборка при движении ──
  _prepareData() {
    const cellSize = this.cellSize;
    const add = (obj, kind) => {
      const key = `${Math.floor(obj.x / cellSize)},${Math.floor(obj.y / cellSize)}`;
      if (!this.cells.has(key)) this.cells.set(key, { props: [], nodes: [], buildings: [], chests: [], campfires: [] });
      this.cells.get(key)[kind].push(obj);
    };
    this.world.props.forEach(p => add(p, 'props'));
    this.world.nodes.forEach(n => add(n, 'nodes'));
    this.world.buildings.forEach(b => add(b, 'buildings'));
    (this.world.chests || []).forEach(c => add(c, 'chests'));
    (this.world.campfires || []).forEach(c => add(c, 'campfires'));
  }

  // Быстрая выборка сущностей в радиусе (в world-единицах)
  queryNear(x, y, radius = 320) {
    const cellSize = this.cellSize;
    const r = Math.ceil(radius / cellSize);
    const cx = Math.floor(x / cellSize);
    const cy = Math.floor(y / cellSize);
    const out = { props: [], nodes: [], buildings: [], chests: [], campfires: [] };
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const cell = this.cells.get(`${cx + dx},${cy + dy}`);
        if (!cell) continue;
        for (const k of Object.keys(out)) {
          for (const o of cell[k]) {
            if (Math.abs(o.x - x) <= radius && Math.abs(o.y - y) <= radius) out[k].push(o);
          }
        }
      }
    }
    return out;
  }

  // ── Растительность: инстансы деревьев/кустов/камней ─────────────────────
  _buildInstancedFoliage() {
    const q = this.quality;
    const leafMat = createMaterial('leaves', { repeat: 1, quality: q === 'low' ? 'low' : 'medium' });
    const barkMat = createMaterial('bark', { repeat: 1, quality: q === 'low' ? 'low' : 'medium' });
    const pineMat = createMaterial('pine', { repeat: 1, quality: q === 'low' ? 'low' : 'medium' });
    const bushMat = colorMaterial(0x2e4a1e, { roughness: 0.94, flatShading: true });
    const rockMat = createMaterial('rock', { repeat: 1, quality: q === 'low' ? 'low' : 'medium' });

    // Геометрия-«эталон» для каждого вида: строим один раз, потом инстансим
    const makeDeciduous = (detail) => {
      const geos = [];
      const trunkH = 3.4, trunkR = 0.2;
      const trunk = new THREE.CylinderGeometry(trunkR * 0.7, trunkR, trunkH, detail ? 9 : 6, 1);
      trunk.translate(0, trunkH / 2, 0);
      geos.push({ geo: trunk, mat: barkMat });
      // Ветви
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + 0.4;
        const br = new THREE.CylinderGeometry(0.05, 0.08, 1.5, 5);
        br.translate(0, 0.75, 0);
        br.rotateZ(0.7);
        br.rotateY(a);
        br.translate(0, trunkH * 0.62, 0);
        geos.push({ geo: br, mat: barkMat });
      }
      // Крона: 3 слоя
      const layers = detail ? 4 : 2;
      for (let i = 0; i < layers; i++) {
        const r = 1.55 - i * 0.26;
        const blob = new THREE.IcosahedronGeometry(r, detail ? 1 : 0);
        const pos = blob.attributes.position;
        for (let k = 0; k < pos.count; k++) {
          const px = pos.getX(k), py = pos.getY(k), pz = pos.getZ(k);
          const n = 1 + (Math.sin(px * 2.3 + pz * 1.7 + i) * 0.5 + 0.5) * 0.18;
          pos.setXYZ(k, px * n, py * n * 0.82, pz * n);
        }
        blob.computeVertexNormals();
        blob.translate(0, trunkH + 0.55 + i * 0.62, 0);
        geos.push({ geo: blob, mat: leafMat });
      }
      return geos;
    };

    const makePine = (detail) => {
      const geos = [];
      const trunk = new THREE.CylinderGeometry(0.14, 0.2, 3.0, detail ? 8 : 5);
      trunk.translate(0, 1.5, 0);
      geos.push({ geo: trunk, mat: barkMat });
      for (let i = 0; i < (detail ? 5 : 3); i++) {
        const r = 1.5 - i * 0.26;
        const cone = new THREE.ConeGeometry(r, 1.6, detail ? 10 : 6, 1);
        cone.translate(0, 2.2 + i * 1.05, 0);
        geos.push({ geo: cone, mat: pineMat });
      }
      return geos;
    };

    const makeBush = (detail) => {
      const geos = [];
      for (let i = 0; i < (detail ? 3 : 1); i++) {
        const r = 0.55 - i * 0.12;
        const blob = new THREE.IcosahedronGeometry(r, detail ? 1 : 0);
        blob.translate((rnd(i, 3) - 0.5) * 0.5, 0.45 + i * 0.22, (rnd(i, 7) - 0.5) * 0.5);
        geos.push({ geo: blob, mat: bushMat });
      }
      return geos;
    };

    const makeRock = (detail) => {
      const geo = new THREE.DodecahedronGeometry(1, detail ? 1 : 0);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const k = 0.78 + rnd(i, 11) * 0.4;
        pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.75, pos.getZ(i) * k);
      }
      geo.computeVertexNormals();
      const geos = [{ geo, mat: rockMat }];
      return geos;
    };

    // Собираем «шаблоны» и превращаем каждый в 1-2 батча (по материалам)
    // detail=false — упрощённая геометрия для низких настроек
    const buildBatches = (partsFactory, count, forceSimple = false) => {
      const useDetail = !forceSimple && (this.quality === 'ultra' || this.quality === 'high');
      const parts = partsFactory(useDetail);
      const byMat = new Map();
      for (const { geo, mat } of parts) {
        if (!byMat.has(mat.uuid)) byMat.set(mat.uuid, { mat, geos: [] });
        byMat.get(mat.uuid).geos.push(geo);
      }
      const batches = [];
      for (const { mat, geos } of byMat.values()) {
        const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
        geos.forEach(g => { if (g !== merged) g.dispose(); });
        if (merged) batches.push({ geometry: merged, material: mat });
      }
      return batches;
    };

    // Низкое качество — упрощённые кроны и меньше ветвей (без потери силуэта)
    const simple = q === 'low';
    const treeBatches = buildBatches(makeDeciduous, 512, simple);
    const pineBatches = buildBatches(makePine, 128, simple);
    const bushBatches = buildBatches(makeBush, 532, simple);
    const rockBatches = buildBatches(makeRock, 335, simple);

    // Распределяем объекты по инстансам
    const buckets = {
      tree: [], pine: [], bush: [], rock: []
    };
    for (const n of this.world.nodes) {
      if (n.respawnTimer > 0) continue;
      if (n.kind === 'tree') buckets.tree.push(n);
      else if (n.kind === 'pine_tree') buckets.pine.push(n);
      else if (n.kind === 'bush') buckets.bush.push(n);
    }
    for (const p of this.world.props) {
      if (p.kind === 'rock') buckets.rock.push(p);
    }

    const addInstanced = (batches, list, opts = {}) => {
      if (!list.length) return;
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const v = new THREE.Vector3();
      const s = new THREE.Vector3();
      for (const batch of batches) {
        const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, list.length);
        mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
        mesh.castShadow = opts.castShadow !== false;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        for (let i = 0; i < list.length; i++) {
          const obj = list[i];
          const p3 = { x: obj.x * WORLD_SCALE, z: obj.y * WORLD_SCALE };
          const y = this.terrain.heightAt3D(p3.x, p3.z);
          const scale = (opts.scale || 1) * (0.82 + rnd(obj.x + obj.y, 5) * 0.42);
          v.set(p3.x, y + (opts.yOffset || 0), p3.z);
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd(obj.x, 9) * TAU);
          s.set(scale * (opts.sx || 1), scale * (opts.sy || 1), scale * (opts.sz || 1));
          m.compose(v, q, s);
          mesh.setMatrixAt(i, m);
        }
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere?.();
        // Ограничиваем дальность отрисовки для дальних объектов
        mesh.userData.maxRenderDist = opts.maxRenderDist || 0;
        this.group.add(mesh);
        this.instanced.push({ mesh, list, opts });
      }
    };

    this._buildPropObjects();
    addInstanced(treeBatches, buckets.tree, { castShadow: true, maxRenderDist: 160 });
    addInstanced(pineBatches, buckets.pine, { castShadow: true, maxRenderDist: 160 });
    addInstanced(bushBatches, buckets.bush, { castShadow: false, maxRenderDist: 80 });
    addInstanced(rockBatches, buckets.rock, { castShadow: true, maxRenderDist: 110, yOffset: -0.1, sy: 0.9 });
  }

  // Ящики, бочки, заборы, колонны руин: разрушаемые объекты мира.
  // Используем общие геометрии и материалы — десятки объектов почти бесплатны.
  _buildPropObjects() {
    const crateGeo = new THREE.BoxGeometry(1.1, 1.0, 1.1);
    const crateMat = createMaterial('bark', { repeat: 1 });
    const crateBandMat = colorMaterial(0x2f2a22, { roughness: 0.9 });
    const barrelGeo = new THREE.CylinderGeometry(0.5, 0.55, 1.15, 12);
    const barrelMat = createMaterial('metal', { repeat: 1 });
    const redBarrelMat = colorMaterial(0x8f2a22, { metalness: 0.55, roughness: 0.45 });
    const fenceGeo = new THREE.BoxGeometry(2.6, 1.1, 0.12);
    const fenceMat = createMaterial('bark', { repeat: 1 });
    const pillarGeo = new THREE.CylinderGeometry(0.52, 0.62, 4.2, 10);
    const pillarMat = createMaterial('stone', { repeat: 1 });

    const crates = [], barrels = [], redBarrels = [], fences = [], pillars = [];
    for (const node of this.world.nodes) {
      if (node.kind === 'crates') crates.push(node);
      else if (node.kind === 'barrel') barrels.push(node);
      else if (node.kind === 'barrel_red') redBarrels.push(node);
    }
    for (const pr of this.world.props) {
      if (pr.kind === 'fence') fences.push(pr);
      else if (pr.kind === 'ruins_pillar') pillars.push(pr);
    }

    const makeInstanced = (geo, mat, list, opts = {}) => {
      if (!list.length) return;
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const v = new THREE.Vector3();
      const sc = new THREE.Vector3();
      for (let i = 0; i < list.length; i++) {
        const o = list[i];
        const x = o.x * WORLD_SCALE, z = o.y * WORLD_SCALE;
        const y = this.terrain.heightAt3D(x, z);
        v.set(x, y + (opts.yOffset || 0), z);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd(o.x, 7) * TAU);
        const s = opts.scale || 1;
        sc.set(s, s, s);
        m.compose(v, q, sc);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.propMeshes = this.propMeshes || [];
      this.propMeshes.push({ mesh, list, kind: opts.kind });
    };

    makeInstanced(crateGeo, crateMat, crates, { yOffset: 0.5, kind: 'crates' });
    makeInstanced(barrelGeo, barrelMat, barrels, { yOffset: 0.58, kind: 'barrel' });
    makeInstanced(barrelGeo, redBarrelMat, redBarrels, { yOffset: 0.58, kind: 'barrel_red' });
    makeInstanced(fenceGeo, fenceMat, fences, { yOffset: 0.58, kind: 'fence' });
    makeInstanced(pillarGeo, pillarMat, pillars, { yOffset: 2.1, kind: 'ruins_pillar' });
  }

  // Скрывает разрушенные узлы (ящики/бочки), чтобы мир совпадал с движком
  syncNodes(nodes) {
    if (!this.propMeshes) return;
    for (const entry of this.propMeshes) {
      if (!['crates', 'barrel', 'barrel_red'].includes(entry.kind)) continue;
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const v = new THREE.Vector3();
      const sc = new THREE.Vector3();
      for (let i = 0; i < entry.list.length; i++) {
        const node = entry.list[i];
        // Движок помечает сломанный узел таймером возрождения (respawnTimer > 0)
        const alive = (node.respawnTimer || 0) <= 0 && node.hp > 0;
        const x = node.x * WORLD_SCALE, z = node.y * WORLD_SCALE;
        const y = this.terrain.heightAt3D(x, z);
        v.set(x, y + (entry.kind === 'crates' ? 0.5 : 0.58), z);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd(node.x, 7) * TAU);
        sc.setScalar(alive ? 1 : 0.0001);
        m.compose(v, q, sc);
        entry.mesh.setMatrixAt(i, m);
      }
      entry.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  // ── Здания ──────────────────────────────────────────────────────────────
  _buildStructures() {
    const BUILDING_MODELS = {
      house: () => Structures.house(7, 4.2, 6, 1),
      shop: () => Structures.shop(8, 4.6, 6),
      watchtower: () => Structures.watchtower(2.6, 8),
      base: () => Structures.fortress(14, 7, 12, false),
      warehouse: () => Structures.house(9, 5.4, 7, 3),
      factory: () => Structures.fortress(16, 8, 14, false),
      hospital: () => Structures.house(8, 5, 7, 5),
      police: () => Structures.house(8, 5.2, 7, 7),
      bunker: () => Structures.fortress(10, 5, 9, true),
      default: () => Structures.house(6, 3.8, 5, 9)
    };

    for (const b of this.world.buildings) {
      const factory = BUILDING_MODELS[b.kind] || BUILDING_MODELS.default;
      const model = factory();
      const pos = { x: b.x * WORLD_SCALE, z: b.y * WORLD_SCALE };
      const y = this.terrain.heightAt3D(pos.x, pos.z);
      model.position.set(pos.x, y, pos.z);
      model.rotation.y = rnd(b.x, 3) * TAU;
      model.castShadow = true;
      model.receiveShadow = true;
      model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      model.userData.buildingId = b.id;
      model.userData.building = b;
      model.userData.radius = Math.max(b.colW || 120, b.colH || 120) * WORLD_SCALE * 0.5;
      model.userData.kind = b.kind;
      this.group.add(model);
      this.buildingMeshes.push(model);

      // Свет из окон ночью
      const light = new THREE.PointLight(0xffc46b, 0, 14, 2);
      light.position.set(pos.x, y + 3.2, pos.z);
      this.group.add(light);
      this.lampLights.push({ light, base: 0.9, nightOnly: true });

      // Дым из трубы завода/дома (лампы-факелы)
      if (b.smokes) {
        this.dynamicProps.push({ type: 'smoke', x: b.x, y: b.y, height: 6, timer: 0 });
      }
    }
    // Табличка названия локации над зданием (спрайт с текстом).
    // На средних настройках и ниже не создаём — меньше draw calls и чище картинка.
    const labelLimit = this.quality === 'ultra' ? 20 : this.quality === 'high' ? 14 : 0;
    for (const b of this.world.buildings.slice(0, labelLimit)) {
      const sprite = this._makeLabelSprite(b.name || b.kind, 0x1a2230);
      if (!sprite) continue;
      const pos = { x: b.x * WORLD_SCALE, z: b.y * WORLD_SCALE };
      const y = this.terrain.heightAt3D(pos.x, pos.z);
      sprite.position.set(pos.x, y + 9.5, pos.z);
      sprite.scale.set(9, 2.1, 1);
      this.group.add(sprite);
      this.labelSprites = this.labelSprites || [];
      this.labelSprites.push(sprite);
    }
  }

  _makeLabelSprite(text, bg = 0x111826) {
    if (typeof document === 'undefined') return null;
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 128;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = `rgba(${(bg >> 16) & 255},${(bg >> 8) & 255},${bg & 255},0.78)`;
    ctx.beginPath();
    const r = 22;
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(4, 20, 504, 88, r);
    } else if (typeof ctx.rect === 'function') {
      ctx.rect(4, 20, 504, 88);
    } else {
      // Ручной скруглённый прямоугольник (старые браузеры и headless-среда)
      ctx.moveTo(4 + r, 20);
      ctx.lineTo(508 - r, 20);
      ctx.lineTo(508, 20 + r);
      ctx.lineTo(508, 108 - r);
      ctx.lineTo(508 - r, 108);
      ctx.lineTo(4 + r, 108);
      ctx.lineTo(4, 108 - r);
      ctx.lineTo(4, 20 + r);
      ctx.closePath();
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(180,200,230,0.55)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillStyle = '#e8eef8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const t = text.length > 26 ? text.slice(0, 25) + '…' : text;
    ctx.fillText(t, 256, 66);
    const tex = new THREE.CanvasTexture(cv);
    tex.needsUpdate = true;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    return new THREE.Sprite(mat);
  }

  // ── Костры и лагеря ─────────────────────────────────────────────────────
  _buildCampfires() {
    const fires = this.campfires || [];
    for (const c of fires) {
      const model = Structures.campfire();
      const pos = { x: c.x * WORLD_SCALE, z: c.y * WORLD_SCALE };
      const y = this.terrain.heightAt3D(pos.x, pos.z);
      model.position.set(pos.x, y, pos.z);
      this.group.add(model);
      const light = new THREE.PointLight(0xff9a3c, 2.2, 13, 2);
      light.position.set(pos.x, y + 1.1, pos.z);
      this.group.add(light);
      this.dynamicProps.push({ type: 'fire', x: c.x, y: c.y, light, model, baseIntensity: 2.2, phase: Math.random() * 10 });
      // Палатка рядом
      if (Math.random() < 0.7) {
        const tent = Structures.tent();
        tent.position.set(pos.x + 2.4, this.terrain.heightAt3D(pos.x + 2.4, pos.z + 1.2), pos.z + 1.2);
        tent.rotation.y = Math.random() * TAU;
        this.group.add(tent);
      }
    }
  }

  // ── Транспорт ───────────────────────────────────────────────────────────
  _buildVehicles() {
    const meshes = new Map();
    for (const veh of this.world.vehicles) {
      const kind = veh.kind || 'car';
      let model;
      if (kind === 'bike' || kind === 'motorcycle') model = Vehicles3D.bike();
      else model = Vehicles3D.car(kind, {});
      const pos = { x: veh.x * WORLD_SCALE, z: veh.y * WORLD_SCALE };
      const y = this.terrain.heightAt3D(pos.x, pos.z);
      model.position.set(pos.x, y + 0.1, pos.z);
      model.rotation.y = veh.angle || 0;
      model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      model.userData.vehicleId = veh.id;
      this.group.add(model);
      meshes.set(veh.id, model);
    }
    this.vehicleMeshes = meshes;
  }

  // ── Сундуки ─────────────────────────────────────────────────────────────
  _buildChests() {
    this.chestMeshes = new Map();
    const chests = this.world.chests || [];
    for (const c of chests) {
      const g = new THREE.Group();
      const wood = createMaterial('bark', { repeat: 1 });
      const iron = createMaterial('metal', { repeat: 1 });
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.75, 0.8), wood);
      box.position.y = 0.38;
      box.castShadow = true;
      g.add(box);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.15, 10, 1, false, 0, Math.PI), wood);
      lid.rotation.z = Math.PI / 2;
      lid.position.y = 0.75;
      lid.castShadow = true;
      g.add(lid);
      for (const z of [-0.42, 0.42]) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.78, 0.05), iron);
        band.position.set(0, 0.38, z);
        g.add(band);
      }
      const lock = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.08), iron);
      lock.position.set(0, 0.55, 0.44);
      g.add(lock);
      const glow = new THREE.PointLight(c.cursed ? 0xa855f7 : 0xffc46b, c.looted ? 0 : 0.9, 6, 2);
      glow.position.y = 0.9;
      g.add(glow);

      const pos = { x: c.x * WORLD_SCALE, z: c.y * WORLD_SCALE };
      const y = this.terrain.heightAt3D(pos.x, pos.z);
      g.position.set(pos.x, y, pos.z);
      g.rotation.y = Math.random() * TAU;
      g.userData.chest = c;
      this.group.add(g);
      this.chestMeshes.set(c.id, g);
    }
  }

  // ── Обновление: огонь, свет, дальность отрисовки, погода ─────────────────
  update(dt, playerPos, timeOfDay, quality) {
    const night = timeOfDay < 0.22 || timeOfDay > 0.78;
    const dusk = (timeOfDay > 0.68 && timeOfDay <= 0.78) || (timeOfDay >= 0.22 && timeOfDay < 0.30);
    const lightFactor = night ? 1 : dusk ? 0.55 : 0;

    // Свет из окон и фонарей
    for (const l of this.lampLights) {
      const target = l.nightOnly ? lightFactor * l.base : l.base;
      l.light.intensity += (target - l.light.intensity) * Math.min(1, dt * 1.5);
    }

    // Костры: мерцание + искры
    for (const d of this.dynamicProps) {
      if (d.type === 'fire' && d.light) {
        d.phase += dt * 7;
        const flicker = 1 + Math.sin(d.phase) * 0.16 + Math.sin(d.phase * 2.7) * 0.1;
        d.light.intensity = d.baseIntensity * flicker * (0.7 + lightFactor * 0.5);
        if (d.model) {
          const flames = d.model.userData.flames;
          if (flames) {
            for (let i = 0; i < flames.length; i++) {
              const f = flames[i];
              const s = 0.85 + Math.sin(d.phase * 1.3 + i * 2.1) * 0.25;
              f.scale.set(s, 0.9 + Math.sin(d.phase + i) * 0.3, s);
            }
          }
        }
      }
    }

    // Дальность отрисовки инстансов: отсекаем далёкие секции
    const px = playerPos.x, pz = playerPos.z;
    for (const inst of this.instanced) {
      const maxD = inst.opts.maxRenderDist || 0;
      if (!maxD) continue;
      // расстояние до ближайшего объекта в списке (по сетке не нужно — грубая оценка)
      let near = false;
      const list = inst.list;
      const step = list.length > 400 ? 9 : list.length > 120 ? 5 : 2;
      for (let i = 0; i < list.length; i += step) {
        const o = list[i];
        const dx = o.x * WORLD_SCALE - px;
        const dz = o.y * WORLD_SCALE - pz;
        if (dx * dx + dz * dz < maxD * maxD * 1.6) { near = true; break; }
      }
      inst.mesh.visible = near;
    }
  }

  // Поиск здания под курсором/рядом с героем (для взаимодействия)
  findBuildingNear(x, y, radius = 140) {
    let best = null, bestD = radius * radius;
    for (const b of this.world.buildings) {
      const dx = b.x - x, dy = b.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  dispose() {
    this.group.traverse(o => {
      if (o.isMesh || o.isInstancedMesh) {
        o.geometry?.dispose?.();
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose?.());
        else o.material?.dispose?.();
      }
    });
    this.scene.remove(this.group);
  }
}
