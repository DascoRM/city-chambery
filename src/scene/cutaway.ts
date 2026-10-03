import * as THREE from 'three';
import type { CityData, Pt, Ticker } from '../types';
import { pointInRing } from './geo';

/**
 * Effacement des bâtiments qui masquent l'avatar (EP005-US005), mode balade seulement.
 * Chaque bâtiment a un identifiant (attribut `aId`, ajouté par city.ts) et un facteur de visibilité dans une
 * petite texture : 1 = entier, 0 = effacé. Le fondu est un tramage (dither) au fragment, pas de transparence :
 * le maillage reste unique (0 appel de rendu de plus), les ombres (carte statique) ne changent pas.
 * Les monuments modélisés (objets à part) s'effacent de la même façon, par un uniforme propre.
 * Côté processeur : le segment caméra → avatar est testé contre les emprises, avec lissage dans le temps.
 */
export interface CutawayConfig {
  /** Durée (s) du fondu */
  fadeSeconds: number;
  /** Hauteur (m) au-dessus de l'avatar visée par le test (poitrine) */
  aimHeight: number;
  /** Marge (m) ajoutée à la hauteur d'un bâtiment pour son toit (hauteur OSM = gouttière) */
  roofAllowance: number;
  /** Pas (m) du test le long du segment caméra → avatar */
  step: number;
  /** Bâtiments (id OSM) ou monuments (id du modèle) qui ne s'effacent jamais */
  exceptions: (number | string)[];
  /** Les monuments modélisés s'effacent aussi */
  monuments: boolean;
}

export interface FadeUniforms {
  uFade: { value: THREE.DataTexture };
  uFadeW: { value: number };
}

/** Texture des facteurs (un octet par bâtiment, 255 = entier) et uniformes à brancher sur le matériau des bâtiments */
export function createFade(count: number): { uniforms: FadeUniforms; data: Uint8Array; texture: THREE.DataTexture } {
  const width = 64, height = Math.max(1, Math.ceil(count / width));
  const data = new Uint8Array(width * height).fill(255);
  const texture = new THREE.DataTexture(data, width, height, THREE.RedFormat, THREE.UnsignedByteType);
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return { uniforms: { uFade: { value: texture }, uFadeW: { value: width } }, data, texture };
}

/** Fragment : tramage selon le facteur (bruit de gradient intercalé sur les pixels) */
export const DITHER_GLSL = `
  float ditherNoise(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }`;

/**
 * Ajoute à un matériau déjà patché (éclairage de nuit des monuments…) un fondu par tramage piloté par un uniforme.
 * Uniforme seulement dans le shader (règle BUG-01) ; la clé du programme change une fois pour toutes.
 */
export function fadeMaterial(mat: THREE.Material, uniform: { value: number }): void {
  const previous = mat.onBeforeCompile;
  // Clé de programme d'origine : par défaut, le texte de l'ancien onBeforeCompile (il va être remplacé)
  const base = mat.customProgramCacheKey === THREE.Material.prototype.customProgramCacheKey ? previous.toString() : mat.customProgramCacheKey();
  mat.onBeforeCompile = (shader, renderer) => {
    previous.call(mat, shader, renderer);
    shader.uniforms.uMonFade = uniform;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uMonFade;${DITHER_GLSL}`)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (uMonFade < 0.999 && uMonFade <= ditherNoise(gl_FragCoord.xy)) discard;');
  };
  mat.customProgramCacheKey = () => `${base}|monfade`;
  mat.needsUpdate = true;
}

interface Occluder {
  id: number | string;
  rings: Pt[][];
  /** Altitude (m) du dessus */
  top: number;
  /** Facteur actuel (0 à 1) et but */
  f: number;
  goal: number;
  write(f: number): void;
}

export interface Cutaway extends Ticker {
  setActive(active: boolean): void;
}

export function createCutaway(
  cfg: CutawayConfig, data: CityData, fade: ReturnType<typeof createFade>, minUnder: (r: Pt[]) => number,
  models: THREE.Object3D | null, hidden: Set<number>,
  camera: THREE.Camera, aim: (out: THREE.Vector3) => THREE.Vector3 | null,
): Cutaway {
  const skip = new Set(cfg.exceptions);
  const occ: Occluder[] = [];
  // Bâtiments du maillage fusionné : l'identifiant est l'indice dans data.buildings
  data.buildings.forEach((b, i) => {
    if (hidden.has(b.id) || skip.has(b.id)) return;
    occ.push({
      id: i, rings: [b.outer], top: minUnder(b.outer) + b.h + cfg.roofAllowance, f: 1, goal: 1,
      write: (f) => { fade.data[i] = Math.round(f * 255); },
    });
  });
  // Monuments modélisés : emprises des bâtiments OSM qu'ils remplacent, hauteur de leur boîte englobante
  const monumentFade = new Map<string, { value: number }>();
  if (cfg.monuments && models) {
    const entries: { id: string; ids: number[] }[] = (models.userData.entries ?? []);
    for (const e of entries) {
      if (skip.has(e.id) || !e.ids.length) continue;
      const holder = models.getObjectByName(e.id);
      if (!holder) continue;
      const u = { value: 1 };
      monumentFade.set(e.id, u);
      const seen = new Set<THREE.Material>();
      holder.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
          if (seen.has(mat)) continue;
          seen.add(mat);
          fadeMaterial(mat, u);
        }
      });
      const rings = data.buildings.filter((b) => e.ids.includes(b.id)).map((b) => b.outer);
      if (!rings.length) continue;
      const box = new THREE.Box3().setFromObject(holder);
      occ.push({ id: e.id, rings, top: box.max.y, f: 1, goal: 1, write: (f) => { u.value = f; } });
    }
  }

  // Grille de 25 m : emprises par case (boîte englobante)
  const CELL = 25;
  const grid = new Map<string, number[]>();
  occ.forEach((o, k) => {
    for (const ring of o.rings) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [x, y] of ring) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++)
        for (let j = Math.floor(y0 / CELL); j <= Math.floor(y1 / CELL); j++) {
          const key = `${i},${j}`;
          const list = grid.get(key);
          if (list) { if (!list.includes(k)) list.push(k); } else grid.set(key, [k]);
        }
    }
  });

  let active = false;
  const a = new THREE.Vector3(), lastA = new THREE.Vector3(1e9, 0, 0), lastC = new THREE.Vector3(1e9, 0, 0);
  const hiding = new Set<number>(); // occulteurs dont le but est 0
  const moving = new Set<number>(); // occulteurs en cours de fondu

  const setGoal = (k: number, goal: number) => {
    if (occ[k].goal === goal) return;
    occ[k].goal = goal;
    moving.add(k);
    if (goal === 0) hiding.add(k); else hiding.delete(k);
  };

  /** Occulteurs qui coupent le segment avatar → caméra (sous leur toit) */
  const compute = (c: THREE.Vector3) => {
    const hit = new Set<number>();
    if (active) {
      const dx = c.x - a.x, dy = c.y - a.y, dz = c.z - a.z;
      const len = Math.hypot(dx, dz);
      const n = Math.max(1, Math.ceil(len / cfg.step));
      for (let s = 1; s <= n; s++) {
        const t = s / n;
        const x = a.x + dx * t, y = a.y + dy * t, wy = -(a.z + dz * t); // plan des données : y = -z
        for (const k of grid.get(`${Math.floor(x / CELL)},${Math.floor(wy / CELL)}`) ?? []) {
          if (hit.has(k) || y >= occ[k].top) continue;
          if (occ[k].rings.some((r) => pointInRing(x, wy, r))) hit.add(k);
        }
      }
    }
    for (const k of hiding) if (!hit.has(k)) setGoal(k, 1);
    for (const k of hit) setGoal(k, 0);
  };

  return {
    setActive(on) {
      active = on;
      lastA.set(1e9, 0, 0); // force un nouveau calcul
    },
    moving: () => moving.size > 0,
    update(dt) {
      if (!active && !moving.size && !hiding.size) return;
      const c = camera.position;
      const p = active ? aim(a) : null;
      if (active && p && (a.distanceToSquared(lastA) > 0.01 || c.distanceToSquared(lastC) > 0.01)) {
        lastA.copy(a); lastC.copy(c);
        compute(c);
      } else if (!active && hiding.size) compute(c);
      if (!moving.size) return;
      const step = dt / Math.max(0.05, cfg.fadeSeconds);
      let texChanged = false;
      for (const k of moving) {
        const o = occ[k];
        o.f = o.goal > o.f ? Math.min(o.goal, o.f + step) : Math.max(o.goal, o.f - step);
        o.write(o.f);
        if (typeof o.id === 'number') texChanged = true;
        if (o.f === o.goal) moving.delete(k);
      }
      if (texChanged) fade.texture.needsUpdate = true;
    },
  };
}
