import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { CityData, Pt } from '../types';
import { rand } from './palette';
import { dataUrl } from '../dataurl';

/**
 * Arbres modélisés (pack Quaternius, CC0) à certains endroits de la ville.
 *
 * src/content/nature.json décrit :
 *  - des « mélanges » (mixes) : modèles avec leur poids + plage d'échelle ;
 *  - des zones, chacune avec un mélange : espaces verts OSM nommés (`areas`) ou bords d'un cours
 *    d'eau (`water` + `distance` en mètres depuis la berge).
 * Les emplacements restent ceux de la ville (arbres OSM + arbres semés) : seule la forme change.
 * Un arbre prend la première zone qui le contient. Si un modèle ne se charge pas, la zone garde
 * ses arbres simples.
 */
export interface NatureMix { scale: [number, number]; models: Record<string, number> }
export interface NatureZone { areas?: string[]; water?: string; distance?: number; mix: string; note?: string }
export interface NatureConfig { mixes: Record<string, NatureMix>; zones: NatureZone[] }

const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });

export function pointInRing(x: number, y: number, ring: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToSegment([px, py]: Pt, [ax, ay]: Pt, [bx, by]: Pt): number {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

/** Test « cet emplacement est dans la zone » ; null si la zone ne correspond à rien dans city.json. */
function zoneTest(zone: NatureZone, data: CityData): ((p: Pt) => boolean) | null {
  if (zone.areas) {
    const areas = data.areas.filter((a) => a.name && zone.areas!.includes(a.name));
    for (const name of zone.areas) if (!areas.some((a) => a.name === name)) console.warn(`[nature] espace vert « ${name} » introuvable`);
    if (!areas.length) return null;
    return ([x, y]) => areas.some((a) => pointInRing(x, y, a.outer) && !a.holes.some((h) => pointInRing(x, y, h)));
  }
  if (zone.water) {
    const lines = data.water.flatMap((w) => (w.kind === 'line' && w.name === zone.water ? [w] : []));
    if (!lines.length) { console.warn(`[nature] cours d'eau « ${zone.water} » introuvable`); return null; }
    const d = zone.distance ?? 15;
    return (p) => lines.some((l) => l.pts.some((a: Pt, i: number) => i + 1 < l.pts.length && distToSegment(p, a, l.pts[i + 1]) - l.w / 2 <= d));
  }
  return null;
}

/**
 * @param spots  tous les emplacements d'arbres de la ville
 * @returns le groupe des arbres modélisés et les indices des emplacements qu'ils remplacent
 */
export async function buildNature(config: NatureConfig, data: CityData, spots: Pt[], heightAt: (x: number, y: number) => number): Promise<{ group: THREE.Group; replaced: number[] }> {
  const group = new THREE.Group();
  group.name = 'nature';
  const loader = new GLTFLoader();
  const cache = new Map<string, Promise<THREE.BufferGeometry>>();
  const geometryOf = (name: string) => {
    if (!cache.has(name)) {
      cache.set(name, loader.loadAsync(dataUrl(`models/nature/${name}.glb`)).then((gltf) => {
        let geo: THREE.BufferGeometry | null = null;
        gltf.scene.traverse((o) => { if (!geo && (o as THREE.Mesh).isMesh) geo = (o as THREE.Mesh).geometry; });
        if (!geo) throw new Error(`aucun maillage dans ${name}.glb`);
        return geo;
      }));
    }
    return cache.get(name)!;
  };

  // 1. Chaque emplacement → première zone qui le contient → modèle tiré au sort dans son mélange
  const placed = new Map<string, { i: number; scale: number }[]>(); // modèle → instances
  const taken = new Set<number>();
  for (const zone of config.zones) {
    const mix = config.mixes[zone.mix];
    if (!mix) { console.warn(`[nature] mélange « ${zone.mix} » inconnu`); continue; }
    const test = zoneTest(zone, data);
    if (!test) continue;
    const names = Object.keys(mix.models);
    try {
      await Promise.all(names.map(geometryOf)); // zone ignorée (arbres simples) si un modèle manque
    } catch (e) {
      console.warn(`[nature] zone « ${zone.mix} » : modèles non chargés, arbres simples conservés`, e);
      continue;
    }
    const total = names.reduce((s, n) => s + mix.models[n], 0);
    spots.forEach((p, i) => {
      if (taken.has(i) || !test(p)) return;
      // Tirage pondéré déterministe (même arbre au même endroit à chaque chargement)
      let r = rand(Math.round(p[0] * 7919 + p[1] * 104729)) * total, k = 0;
      while (k < names.length - 1 && (r -= mix.models[names[k]]) >= 0) k++;
      const scale = mix.scale[0] + rand(i * 17 + 3) * (mix.scale[1] - mix.scale[0]);
      if (!placed.has(names[k])) placed.set(names[k], []);
      placed.get(names[k])!.push({ i, scale });
      taken.add(i);
    });
  }

  // 2. Un maillage instancié par modèle, toutes zones confondues (peu d'appels de rendu)
  const c = new THREE.Color(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (const [name, list] of placed) {
    const inst = new THREE.InstancedMesh(await geometryOf(name), material, list.length);
    list.forEach(({ i, scale }, j) => {
      const [x, y] = spots[i];
      q.setFromAxisAngle(up, rand(i * 31 + 7) * Math.PI * 2);
      m.compose(p.set(x, heightAt(x, y), -y), q, s.setScalar(scale));
      inst.setMatrixAt(j, m);
      inst.setColorAt(j, c.setScalar(0.88 + rand(i * 23 + 11) * 0.2)); // légère variation de teinte
    });
    inst.castShadow = inst.receiveShadow = true;
    inst.computeBoundingSphere();
    inst.name = name;
    group.add(inst);
  }
  return { group, replaced: [...taken] };
}
