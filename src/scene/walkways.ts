import type { CityData, Pt } from '../types';
import { pointInRing, segDist2 } from './geo';
import { roadLift } from './roads';

/**
 * Réseau de voies où l'on peut marcher, tiré des voies OSM (data.roads) : un nœud par point,
 * relié à ses voisins sur la voie ; les voies qui se croisent partagent leurs nœuds.
 * Sorti de mascot.ts (itération 39, EN-01) pour servir aux éléphants et, plus tard, aux passants.
 *
 * Sont retirés du réseau : les types de voies exclus (escaliers…), les tronçons qui passent sous
 * un bâtiment (passages couverts), ceux qui frôlent une façade à moins de `clearance` (trottoirs
 * cartographiés le long des murs) et les zones « avoid » (cercles autour d'un ancrage).
 */
export interface WalkwayOptions {
  excludeKinds: string[];
  /** Préférence par type de voie (1 par défaut) */
  preferKinds: Record<string, number>;
  /** Distance minimale (m) entre l'axe de la voie et une façade */
  clearance: number;
  /** Zones interdites : cercle autour d'un ancrage (data.anchors), rayon en mètres */
  avoid: { anchor: string; radius: number }[];
}

/** Tronçon vers le nœud `to` : longueur (m), hauteur du ruban, préférence, nom de la voie */
export interface Edge { to: number; len: number; lift: number; w: number; name?: string }
export interface Walkways { x: Float64Array; y: Float64Array; adj: Edge[][] }

export function buildWalkways(data: CityData, opts: WalkwayOptions): Walkways {
  const index = new Map<string, number>();
  const xs: number[] = [], ys: number[] = [], adj: Edge[][] = [];
  const node = (p: Pt) => {
    const k = `${p[0]},${p[1]}`;
    let i = index.get(k);
    if (i === undefined) {
      i = xs.length;
      index.set(k, i);
      xs.push(p[0]); ys.push(p[1]); adj.push([]);
    }
    return i;
  };
  const exclude = new Set(opts.excludeKinds);
  const blocked = blocker(data, opts);
  for (const r of data.roads) {
    if (exclude.has(r.kind)) continue;
    const lift = roadLift(r.kind, r.bridge);
    const w = opts.preferKinds[r.kind] ?? 1;
    const name = r.name;
    for (let k = 1; k < r.pts.length; k++) {
      const a = node(r.pts[k - 1]), b = node(r.pts[k]);
      if (a === b || blocked(r.pts[k - 1], r.pts[k])) continue;
      const len = Math.hypot(xs[b] - xs[a], ys[b] - ys[a]);
      adj[a].push({ to: b, len, lift, w, name });
      adj[b].push({ to: a, len, lift, w, name });
    }
  }
  return { x: Float64Array.from(xs), y: Float64Array.from(ys), adj };
}

/** Grille de 25 m : contours des bâtiments dont la boîte englobante touche chaque case. */
const CELL = 25;
function buildingGrid(data: CityData): Map<string, Pt[][]> {
  const grid = new Map<string, Pt[][]>();
  for (const b of data.buildings) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of b.outer) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++)
      for (let j = Math.floor(y0 / CELL); j <= Math.floor(y1 / CELL); j++) {
        const k = `${i},${j}`;
        const list = grid.get(k);
        if (list) list.push(b.outer); else grid.set(k, [b.outer]);
      }
  }
  return grid;
}

/** Tronçon interdit : dans une zone « avoid », ou passant sous un bâtiment (test tous les 2 m). */
function blocker(data: CityData, opts: WalkwayOptions): (a: Pt, b: Pt) => boolean {
  const zones = opts.avoid.flatMap((z) => {
    const c = data.anchors[z.anchor]?.pos;
    return c ? [{ c, r: z.radius }] : [];
  });
  const grid = buildingGrid(data);
  const c2 = opts.clearance * opts.clearance;
  const nearWall = (p: Pt, ring: Pt[]) => {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      if (segDist2(p[0], p[1], ring[j][0], ring[j][1], ring[i][0], ring[i][1]) < c2) return true;
    }
    return false;
  };
  const underBuilding = (p: Pt) => (grid.get(`${Math.floor(p[0] / CELL)},${Math.floor(p[1] / CELL)}`) ?? []).some((ring) => pointInRing(p[0], p[1], ring) || nearWall(p, ring));
  return (a, b) => {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2));
    for (let i = 0; i <= n; i++) {
      const p: Pt = [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n];
      if (zones.some((z) => Math.hypot(p[0] - z.c[0], p[1] - z.c[1]) < z.r)) return true;
      // Les extrémités peuvent toucher une façade (voie qui longe un mur) : on ne teste que l'intérieur
      if (i > 0 && i < n && underBuilding(p)) return true;
      if (n === 1 && underBuilding([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])) return true;
    }
    return false;
  };
}

/**
 * Distance (m) d'un point à la façade la plus proche, plafonnée à `max` (grille de 25 m).
 * Sert à choisir où réapparaître : en bout de chemin, un nœud peut toucher un mur, et un éléphant
 * (6 m de long) rentrerait dans la façade.
 */
export function wallDistance(data: CityData): (p: Pt, max: number) => number {
  const grid = buildingGrid(data);
  return (p, max) => {
    let best = max * max;
    const ci = Math.floor(p[0] / CELL), cj = Math.floor(p[1] / CELL);
    const seen = new Set<Pt[]>();
    for (let i = ci - 1; i <= ci + 1; i++)
      for (let j = cj - 1; j <= cj + 1; j++)
        for (const ring of grid.get(`${i},${j}`) ?? []) {
          if (seen.has(ring)) continue;
          seen.add(ring);
          if (pointInRing(p[0], p[1], ring)) return 0;
          for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
            best = Math.min(best, segDist2(p[0], p[1], ring[b][0], ring[b][1], ring[a][0], ring[a][1]));
          }
        }
    return Math.sqrt(best);
  };
}

/** Nœuds de la plus grande partie connexe du réseau (évite de démarrer sur un bout de chemin isolé). */
export function mainComponent(g: Walkways): Set<number> {
  const seen = new Int32Array(g.x.length).fill(-1);
  let best: number[] = [];
  for (let s = 0; s < g.x.length; s++) {
    if (seen[s] >= 0 || !g.adj[s].length) continue;
    const comp = [s];
    seen[s] = s;
    for (let q = 0; q < comp.length; q++)
      for (const e of g.adj[comp[q]]) if (seen[e.to] < 0) { seen[e.to] = s; comp.push(e.to); }
    if (comp.length > best.length) best = comp;
  }
  return new Set(best);
}
