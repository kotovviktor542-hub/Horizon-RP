// VEXMORA 3D — утилита склейки статической геометрии.
// Модели собираются из десятков примитивов (кладь, заклёпки, перья, кольца).
// Склейка по материалу внутри одного родителя превращает их в 3–6 draw call.
// Здесь же сосредоточены «капризы» BufferGeometryUtils: часть геометрий
// индексирована, часть — нет; у самодельных фигур может не быть uv/normal.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Склеивает меши одной группы с одинаковым родителем и материалом.
 * @param {THREE.Object3D} root
 * @param {Object} opts
 * @param {Set<THREE.Object3D>} [opts.protectedSet] узлы, которые трогать нельзя
 * @param {(o:THREE.Mesh)=>boolean} [opts.skip] дополнительный фильтр
 * @param {boolean} [opts.keepNames] сохранять именованные меши (по умолчанию да)
 * @returns {number} сколько мешей удалось слить
 */
export function mergeStaticMeshes(root, opts = {}) {
  if (typeof mergeGeometries !== 'function') return 0;
  const protectedSet = opts.protectedSet || null;
  const skipFn = opts.skip || null;
  const keepNames = opts.keepNames !== false;

  const skip = new Set();
  root.traverse((o) => {
    if (o.isLight) skip.add(o);
    if (keepNames && o.name) skip.add(o);
    if (protectedSet && protectedSet.has(o)) skip.add(o);
    if (o.userData && o.userData.animated) skip.add(o);
  });

  const buckets = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || !o.geometry || !o.material) return;
    if (skip.has(o)) return;
    if (o.material.transparent) return;                 // прозрачные нельзя (сортировка)
    if (skipFn && skipFn(o)) return;
    const key = `${o.parent ? o.parent.uuid : 'root'}|${o.material.uuid}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(o);
  });

  let merged = 0;
  for (const [, list] of buckets) {
    if (list.length < 2) continue;
    const parent = list[0].parent;
    if (!parent) continue;
    const geos = [];
    for (const mesh of list) {
      mesh.updateMatrix();
      const g = mesh.geometry.clone();
      g.applyMatrix4(mesh.matrix);
      geos.push(g);
    }
    // Единый набор атрибутов: у примитивов есть normal/uv, у самодельных
    // фронтонов и «перьев» из Shape — только position.
    const common = Object.keys(geos[0].attributes).filter(k => geos.every(g => g.attributes[k]));
    for (const g of geos) {
      for (const k of Object.keys(g.attributes)) if (!common.includes(k)) g.deleteAttribute(k);
      if (!g.attributes.normal) g.computeVertexNormals();
    }
    const hasIndex = geos.some(g => !!g.index);
    if (hasIndex) {
      for (const g of geos) {
        if (g.index) continue;
        const n = g.attributes.position.count;
        const arr = new (n > 65535 ? Uint32Array : Uint16Array)(n);
        for (let i = 0; i < n; i++) arr[i] = i;
        g.setIndex(new THREE.BufferAttribute(arr, 1));
      }
    }
    const out = mergeGeometries(geos, false);
    geos.forEach(g => g.dispose());
    if (!out) continue;
    const mesh = new THREE.Mesh(out, list[0].material);
    mesh.castShadow = list.some(m => m.castShadow);
    mesh.receiveShadow = list.some(m => m.receiveShadow);
    mesh.userData.merged = true;
    for (const old of list) parent.remove(old);
    parent.add(mesh);
    merged += list.length;
  }
  return merged;
}
