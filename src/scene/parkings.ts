import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CityData, HeightFn, Parking, Pt } from '../types';
import { pointInRing } from './geo';
import { parkingColor } from './terrain';

/**
 * Panneaux « P » de la couche Parkings (EP006-US003) : un cube-panneau sur un poteau (un « P » blocky sur ses
 * quatre faces, lisible de partout) pour les parkings de surface et en silo ; une petite entrée de parking cartoon
 * (rampe, murs, linteau, cube P) pour les souterrains. Deux maillages instanciés (2 appels de rendu), couleur
 * payant / gratuit / inconnu par instance, lueur de nuit. Formes simples en code : aucun asset tiers.
 */
export interface ParkingSigns {
  group: THREE.Group;
  /** Zones de clic (une par panneau, `userData.parkingId`) */
  hits: THREE.Object3D[];
  parkings: Parking[];
  /** Point au-dessus du panneau (repère de la fiche), dans le repère de la scène */
  anchor(id: string, out: THREE.Vector3): THREE.Vector3 | null;
}

export interface ParkingSignsConfig {
  /** Échelle des panneaux (1 = cube de 4 m sur un poteau de 5 m) */
  scale: number;
  /** Surface minimale (m²) d'un parking de surface sans nom ni capacité pour avoir un panneau */
  minArea: number;
}

/** Plusieurs boîtes fusionnées : couleur de sommet fixe, ou teinte de l'instance (masque 1) */
function boxes(list: { w: number; h: number; d: number; x: number; y: number; z: number; color: string; tint?: boolean; rx?: number }[]) {
  const geos = list.map((b) => {
    const g = new THREE.BoxGeometry(b.w, b.h, b.d);
    if (b.rx) g.rotateX(b.rx);
    g.translate(b.x, b.y, b.z);
    g.deleteAttribute('uv');
    const n = g.getAttribute('position').count, c = new THREE.Color(b.color);
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).map((_, i) => [c.r, c.g, c.b][i % 3]), 3));
    g.setAttribute('aMask', new THREE.BufferAttribute(new Float32Array(n).fill(b.tint ? 1 : 0), 1));
    return g;
  });
  return mergeGeometries(geos)!;
}

/** Un « P » en blocs, collé sur la face avant (z = d) d'un cube de côté s */
function letterP(s: number, z: number) {
  const u = s / 10; // module
  const t = 1.6 * u; // épaisseur des traits
  const out = [
    { w: t, h: 7 * u, d: 0.5 * u, x: -2 * u, y: 0, z, color: '#ffffff' }, // fût
    { w: 5 * u, h: t, d: 0.5 * u, x: 0.2 * u, y: 3.2 * u, z, color: '#ffffff' }, // haut
    { w: 5 * u, h: t, d: 0.5 * u, x: 0.2 * u, y: 0.4 * u, z, color: '#ffffff' }, // milieu
    { w: t, h: 4.4 * u, d: 0.5 * u, x: 2.6 * u, y: 1.8 * u, z, color: '#ffffff' }, // ventre
  ];
  return out;
}

/** Cube-panneau sur poteau : le haut du poteau est à 5 m, le cube mesure 4 m ; teinte = `tint` */
function signGeometry() {
  const parts: Parameters<typeof boxes>[0] = [
    { w: 0.5, h: 5, d: 0.5, x: 0, y: 2.5, z: 0, color: '#5f6470' },
    { w: 4, h: 4, d: 4, x: 0, y: 7, z: 0, color: '#ffffff', tint: true },
  ];
  // Un P sur chacune des quatre faces (rotation de la face avant autour de l'axe vertical)
  const faces = [0, 1, 2, 3].flatMap((k) => {
    const a = (k * Math.PI) / 2;
    return letterP(4, 2.02).map((b) => {
      const x = b.x * Math.cos(a) + b.z * Math.sin(a), z = -b.x * Math.sin(a) + b.z * Math.cos(a);
      const swap = k % 2 === 1;
      return { ...b, x, z: z, w: swap ? b.d : b.w, d: swap ? b.w : b.d, y: b.y + 7 };
    });
  });
  return boxes([...parts, ...faces]);
}

/** Entrée de parking cartoon : dalle, rampe sombre, deux murs teintés, linteau, trou noir, petit cube P dessus */
function entranceGeometry() {
  const dark = '#3d4049', void_ = '#15161b', slab = '#c9c4bd';
  const parts: Parameters<typeof boxes>[0] = [
    { w: 13, h: 0.6, d: 15, x: 0, y: 0.3, z: 0, color: slab },
    { w: 7.2, h: 0.5, d: 8.5, x: 0, y: 0.7, z: 4.2, color: dark, rx: -0.14 }, // rampe qui descend vers l'entrée
    { w: 2, h: 5.5, d: 6, x: -4.6, y: 3.3, z: -1.5, color: '#ffffff', tint: true },
    { w: 2, h: 5.5, d: 6, x: 4.6, y: 3.3, z: -1.5, color: '#ffffff', tint: true },
    { w: 11.2, h: 1.6, d: 6, x: 0, y: 6.1, z: -1.5, color: '#ffffff', tint: true },
    { w: 7.2, h: 4.2, d: 0.4, x: 0, y: 2.8, z: -4.3, color: void_ }, // l'ouverture noire
    { w: 7.2, h: 0.3, d: 5.5, x: 0, y: 0.75, z: -1.2, color: dark }, // sol de l'entrée
  ];
  const cube: Parameters<typeof boxes>[0] = [{ w: 3.2, h: 3.2, d: 3.2, x: 0, y: 8.5, z: -1.5, color: '#ffffff', tint: true }];
  const faces = [0, 1, 2, 3].flatMap((k) => {
    const a = (k * Math.PI) / 2;
    return letterP(3.2, 1.62).map((b) => {
      const x = b.x * Math.cos(a) + b.z * Math.sin(a), z = -b.x * Math.sin(a) + b.z * Math.cos(a);
      const swap = k % 2 === 1;
      return { ...b, x, z: z - 1.5, w: swap ? b.d : b.w, d: swap ? b.w : b.d, y: b.y + 8.5 };
    });
  });
  return boxes([...parts, ...cube, ...faces]);
}

/** Matériau : couleur de sommet, sauf là où le masque vaut 1 (teinte de l'instance) ; la teinte s'allume la nuit */
function signMaterial(night: { value: number }) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.75 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNightP = night;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aMask;\nattribute vec3 aTint;\nvarying vec3 vTintP;\nvarying float vMaskP;')
      .replace('#include <color_vertex>', '#include <color_vertex>\nvColor.rgb = mix(vColor.rgb, aTint, aMask);\nvTintP = aTint;\nvMaskP = aMask;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNightP;\nvarying vec3 vTintP;\nvarying float vMaskP;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vTintP * vMaskP * uNightP * 0.6;');
  };
  mat.customProgramCacheKey = () => 'parking-signs';
  return mat;
}

/** Un point à l'intérieur du contour, le plus proche du centroïde (le centroïde d'une forme en L peut tomber dehors) */
function insidePoint(p: Parking): Pt {
  if (!p.outer || pointInRing(p.pos[0], p.pos[1], p.outer)) return p.pos;
  const xs = p.outer.map((q) => q[0]), ys = p.outer.map((q) => q[1]);
  let best: Pt = p.outer[0], bd = Infinity;
  for (let i = 0; i <= 12; i++) for (let j = 0; j <= 12; j++) {
    const x = Math.min(...xs) + ((Math.max(...xs) - Math.min(...xs)) * i) / 12, y = Math.min(...ys) + ((Math.max(...ys) - Math.min(...ys)) * j) / 12;
    if (!pointInRing(x, y, p.outer)) continue;
    const d = Math.hypot(x - p.pos[0], y - p.pos[1]);
    if (d < bd) { bd = d; best = [x, y]; }
  }
  return best;
}

export function buildParkingSigns(cfg: ParkingSignsConfig, data: CityData, heightAt: HeightFn, night: { value: number }): ParkingSigns | null {
  const shown = (data.parkings ?? []).filter((p) => p.kind !== 'street' && (p.name || p.capacity || (p.areaM2 ?? 0) >= cfg.minArea || p.kind === 'underground'));
  if (!shown.length) return null;
  const group = new THREE.Group();
  group.name = 'parking-signs';
  group.visible = false;
  const material = signMaterial(night);
  const under = shown.filter((p) => p.kind === 'underground'), above = shown.filter((p) => p.kind !== 'underground');
  const hits: THREE.Object3D[] = [];
  const anchors = new Map<string, THREE.Vector3>();
  const hitGeo = new THREE.CylinderGeometry(5, 5, 14, 6);
  hitGeo.translate(0, 7, 0);

  const make = (list: Parking[], geo: THREE.BufferGeometry, entrance: boolean) => {
    if (!list.length) return;
    const tint = new Float32Array(list.length * 3);
    const mesh = new THREE.InstancedMesh(geo, material, list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
    // Les entrées font face au sud-est, vers la caméra de départ
    const face = Math.atan2(-0.42, 0.56);
    list.forEach((p, i) => {
      const at: Pt = entrance ? (p.entrances?.[0] ?? p.pos) : insidePoint(p);
      const y = heightAt(at[0], at[1]);
      q.setFromAxisAngle(up, entrance ? face : (i * 0.7) % (Math.PI / 2));
      m.compose(new THREE.Vector3(at[0], y, -at[1]), q, new THREE.Vector3().setScalar(cfg.scale));
      mesh.setMatrixAt(i, m);
      c.set(parkingColor(p));
      tint.set([c.r, c.g, c.b], i * 3);
      const hit = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.set(at[0], y, -at[1]);
      hit.scale.setScalar(cfg.scale);
      hit.userData.parkingId = p.id;
      group.add(hit);
      hits.push(hit);
      anchors.set(p.id, new THREE.Vector3(at[0], y + (entrance ? 10 : 9) * cfg.scale, -at[1]));
    });
    geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 3));
    mesh.frustumCulled = false;
    mesh.castShadow = false; // objets du décor posés par-dessus la carte d'ombres statique
    mesh.receiveShadow = false;
    group.add(mesh);
  };
  make(above, signGeometry(), false);
  make(under, entranceGeometry(), true);

  return {
    group, hits, parkings: shown,
    anchor: (id, out) => { const a = anchors.get(id); return a ? out.copy(a) : null; },
  };
}
