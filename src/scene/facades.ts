import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Building, CityData, HeightFn, Place, Pt } from '../types';
import { pointInPoly, segDist2 } from './geo';
import { PLACE_CATEGORIES, placeCategory } from './palette';
import { dataUrl } from '../dataurl';

/**
 * Détails de façade tirés du pack de bâtiments (public/models/buildings/details.glb, voir
 * `npm run buildings` et src/content/buildings.json).
 *
 * Auvents (EP001-US008) : un auvent à la façade de chaque bar, café et restaurant dont l'épingle est dans
 * un bâtiment. On retient l'arête du contour du bâtiment qui donne sur la voie la plus proche (et pas sur
 * un bâtiment voisin), près du lieu ; l'auvent est posé dessus, tourné vers l'extérieur, à hauteur de
 * rez-de-chaussée, avec la couleur de la catégorie du lieu. Décor : ce n'est pas un relevé des commerces.
 * Un maillage instancié par pièce et par catégorie : la légende masque les auvents d'une catégorie.
 */
export interface AwningConfig {
  /** Largeur (m) : min et max, selon la longueur de la façade */
  width: number[];
  /** Hauteur (m) du bord haut de l'auvent, contre le mur, au-dessus du sol */
  top: number;
  /** Saillie (m) de l'auvent devant la façade */
  projection: number;
  /** Une façade doit être à moins de cette distance (m) d'une voie */
  maxStreetDistance: number;
  /** Bâtiment plus bas que ça : pas d'auvent */
  minBuildingHeight: number;
}

/** Dimensions des pièces `awning-*` telles que converties (m) : largeur et saillie à l'échelle 1 */
const PIECE_WIDTH = 4.2;
const PIECE_DEPTH = 0.95;
const PIECES = ['awning-a', 'awning-b'];
const CELL = 25;
/** Voies sans intérêt pour trouver une façade côté rue */
const SKIP_ROADS = new Set(['steps', 'track', 'cycleway']);

export interface AwningStats { placed: number; skipped: Record<string, number> }

export async function buildAwnings(o: {
  data: CityData;
  heightAt: HeightFn;
  minUnder(ring: Pt[]): number;
  /** Bâtiments cachés sous un monument modélisé : pas d'auvent */
  hidden: Set<number>;
  config: AwningConfig;
}): Promise<{ group: THREE.Group; stats: AwningStats; setCategoryVisible(category: string, visible: boolean): void }> {
  const { data, config: cfg } = o;
  const group = new THREE.Group();
  group.name = 'awnings';
  const stats: AwningStats = { placed: 0, skipped: {} };
  const skip = (why: string) => { stats.skipped[why] = (stats.skipped[why] ?? 0) + 1; };

  const gltf = await new GLTFLoader().loadAsync(dataUrl('models/buildings/details.glb'));
  const geometries = new Map<string, THREE.BufferGeometry>();
  gltf.scene.traverse((m) => { if ((m as THREE.Mesh).isMesh) geometries.set(m.name, (m as THREE.Mesh).geometry); });
  for (const name of PIECES) if (!geometries.has(name)) throw new Error(`pièce « ${name} » absente de details.glb (npm run buildings)`);

  // Boîtes englobantes des bâtiments (recherche du bâtiment d'un point)
  const boxes = data.buildings.map((b) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of b.outer) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return { b, x0, x1, y0, y1 };
  });
  const buildingAt = (x: number, y: number, except?: Building): Building | null => {
    for (const k of boxes) if (k.b !== except && x >= k.x0 && x <= k.x1 && y >= k.y0 && y <= k.y1 && pointInPoly(x, y, k.b)) return k.b;
    return null;
  };

  // Tronçons de voies dans une grille de 25 m (distance du milieu d'une façade à la voie la plus proche)
  const grid = new Map<string, number[][]>();
  for (const r of data.roads) {
    if (SKIP_ROADS.has(r.kind)) continue;
    for (let k = 1; k < r.pts.length; k++) {
      const [ax, ay] = r.pts[k - 1], [bx, by] = r.pts[k];
      for (let i = Math.floor(Math.min(ax, bx) / CELL); i <= Math.floor(Math.max(ax, bx) / CELL); i++)
        for (let j = Math.floor(Math.min(ay, by) / CELL); j <= Math.floor(Math.max(ay, by) / CELL); j++) {
          const key = `${i},${j}`;
          const list = grid.get(key);
          if (list) list.push([ax, ay, bx, by]); else grid.set(key, [[ax, ay, bx, by]]);
        }
    }
  }
  const roadDistance = (x: number, y: number): number => {
    let best = Infinity;
    const ci = Math.floor(x / CELL), cj = Math.floor(y / CELL);
    for (let i = ci - 1; i <= ci + 1; i++)
      for (let j = cj - 1; j <= cj + 1; j++)
        for (const [ax, ay, bx, by] of grid.get(`${i},${j}`) ?? []) best = Math.min(best, segDist2(x, y, ax, ay, bx, by));
    return Math.sqrt(best);
  };

  const hashOf = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) / 4294967296; };
  const [wMin, wMax] = cfg.width;
  const q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4();
  // pièce → catégorie → instances
  const placed = new Map<string, { matrix: THREE.Matrix4 }[]>();

  data.places.forEach((place: Place) => {
    const [px, py] = place.pos;
    const b = buildingAt(px, py);
    if (!b) return skip('hors bâtiment');
    if (o.hidden.has(b.id)) return skip('bâtiment caché par un monument');
    if (b.h < cfg.minBuildingHeight) return skip('bâtiment trop bas');

    // Arête côté rue : près d'une voie, donnant sur l'extérieur (pas sur un bâtiment voisin), près du lieu
    let best: { score: number; ax: number; ay: number; dx: number; dy: number; len: number; nx: number; ny: number } | null = null;
    const ring = b.outer;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[j], [bx, by] = ring[i];
      const len = Math.hypot(bx - ax, by - ay);
      if (len < wMin + 0.6) continue;
      const dx = (bx - ax) / len, dy = (by - ay) / len;
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      let nx = dy, ny = -dx; // normale : du côté extérieur du bâtiment
      if (pointInPoly(mx + nx * 0.8, my + ny * 0.8, b)) { nx = -nx; ny = -ny; }
      if (pointInPoly(mx + nx * 0.8, my + ny * 0.8, b)) continue; // contour dégénéré
      if (buildingAt(mx + nx * 0.8, my + ny * 0.8, b)) continue; // mur mitoyen : pas de façade
      const road = roadDistance(mx, my);
      if (road > cfg.maxStreetDistance) continue;
      const score = road + 0.35 * Math.sqrt(segDist2(px, py, ax, ay, bx, by));
      if (!best || score < best.score) best = { score, ax, ay, dx, dy, len, nx, ny };
    }
    if (!best) return skip('aucune façade côté rue');

    // Largeur et position le long de la façade : au plus 60 % de l'arête, le plus près possible du lieu
    const width = Math.min(wMax, Math.max(wMin, best.len * 0.6));
    const half = width / 2;
    const along = Math.min(best.len - half - 0.3, Math.max(half + 0.3, (px - best.ax) * best.dx + (py - best.ay) * best.dy));
    const fx = best.ax + best.dx * along, fy = best.ay + best.dy * along;
    const ground = Math.max(o.heightAt(fx + best.nx * 0.8, fy + best.ny * 0.8), o.minUnder(ring));
    p.set(fx + best.nx * 0.03, ground + cfg.top, -(fy + best.ny * 0.03));
    q.setFromAxisAngle(up, Math.atan2(best.nx, -best.ny)); // +Z local → normale extérieure (monde : x = est, z = -nord)
    s.set(width / PIECE_WIDTH, 1, cfg.projection / PIECE_DEPTH);
    m.compose(p, q, s);

    const cat = placeCategory(place.kind);
    const piece = PIECES[Math.floor(hashOf(place.id) * PIECES.length)];
    const key = `${piece}|${cat.id}`;
    if (!placed.has(key)) placed.set(key, []);
    placed.get(key)!.push({ matrix: m.clone() });
    stats.placed++;
  });

  // Blanc cassé au départ (gris clair de la pièce) × couleur de la catégorie
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });
  // Couleur de la catégorie éclaircie d'un tiers : plus lisible que la couleur pleine des épingles
  const colorOf = new Map(PLACE_CATEGORIES.map((c) => [c.id, new THREE.Color(c.color).lerp(new THREE.Color('#ffffff'), 0.3)]));
  for (const [key, list] of placed) {
    const [piece, cat] = key.split('|');
    const inst = new THREE.InstancedMesh(geometries.get(piece)!, material, list.length);
    const color = colorOf.get(cat) ?? new THREE.Color('#d8ccb8');
    list.forEach(({ matrix }, j) => { inst.setMatrixAt(j, matrix); inst.setColorAt(j, color); });
    inst.castShadow = false;
    inst.receiveShadow = true;
    inst.name = `awnings-${cat}-${piece}`;
    inst.userData.category = cat;
    inst.computeBoundingSphere();
    group.add(inst);
  }

  return {
    group,
    stats,
    setCategoryVisible(category, visible) {
      for (const child of group.children) if (child.userData.category === category) child.visible = visible;
    },
  };
}
