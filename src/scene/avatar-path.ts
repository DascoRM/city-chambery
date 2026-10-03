import type { CityData, Pt } from '../types';
import { buildingTest, mainComponent, waterTest, type Walkways } from './walkways';

/**
 * Chemin de l'avatar (EP005-US001) : de sa position à un point désigné, en suivant le réseau de voies
 * partagé avec les passants (walkways.ts). Accrochage au point le plus proche d'une voie de la plus grande
 * partie connexe, A* avec départ et arrivée posés sur une arête (nœuds virtuels), angles arrondis,
 * « dernier mètre » en ligne droite si aucun bâtiment n'est traversé.
 */
export interface PathConfig {
  /** Au-delà de cette distance (m) à toute voie, l'ordre est refusé */
  maxSnap: number;
  /** Jusqu'à cette distance (m), l'avatar quitte la voie en ligne droite pour atteindre le point désigné */
  lastMeter: number;
  /** Rayon (m) d'arrondi des angles */
  corner: number;
}

/** Point du chemin : position (m), hauteur de la voie au-dessus du relief */
export interface PathPoint { x: number; y: number; lift: number }

export interface Route {
  points: PathPoint[];
  /** Longueur (m) */
  length: number;
  /** Point désigné ramené sur le réseau (anneau d'arrivée) ; le chemin va jusqu'à `end` */
  end: Pt;
}

export type RouteFail = 'far' | 'unreachable';

export interface Pathfinder {
  /** Plus grande partie connexe : où l'avatar peut se tenir */
  has(node: number): boolean;
  /** Point du réseau le plus proche de (x, y), ou null au-delà de `maxDist` */
  snap(x: number, y: number, maxDist: number): Snap | null;
  route(from: Pt, to: Pt): Route | RouteFail;
}

export interface Snap { x: number; y: number; a: number; b: number; ab: number; t: number; d: number; lift: number }

const CELL = 25;

export function buildPathfinder(g: Walkways, data: CityData, cfg: PathConfig): Pathfinder {
  const n = g.x.length;
  const main = mainComponent(g);
  const inBuilding = buildingTest(data);
  const inWater = waterTest(data);
  let maxW = 1;
  for (const list of g.adj) for (const e of list) maxW = Math.max(maxW, e.w);

  // Index des arêtes de la grande composante, grille de 25 m
  const grid = new Map<string, [number, number, number][]>();
  for (let a = 0; a < n; a++) {
    if (!main.has(a)) continue;
    g.adj[a].forEach((e, k) => {
      if (e.to < a) return;
      const b = e.to;
      for (let i = Math.floor(Math.min(g.x[a], g.x[b]) / CELL); i <= Math.floor(Math.max(g.x[a], g.x[b]) / CELL); i++)
        for (let j = Math.floor(Math.min(g.y[a], g.y[b]) / CELL); j <= Math.floor(Math.max(g.y[a], g.y[b]) / CELL); j++) {
          const key = `${i},${j}`;
          const list = grid.get(key);
          if (list) list.push([a, b, k]); else grid.set(key, [[a, b, k]]);
        }
    });
  }

  const snap = (x: number, y: number, maxDist: number): Snap | null => {
    const ci = Math.floor(x / CELL), cj = Math.floor(y / CELL);
    const rings = Math.ceil(maxDist / CELL) + 1;
    let best: Snap | null = null;
    let bestD2 = maxDist * maxDist;
    for (let r = 0; r <= rings; r++) {
      // Une case de l'anneau r est à plus de (r - 1) × CELL : inutile d'aller plus loin si on a mieux
      if (best && ((r - 1) * CELL) ** 2 > bestD2) break;
      for (let i = ci - r; i <= ci + r; i++)
        for (let j = cj - r; j <= cj + r; j++) {
          if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r) continue;
          for (const [a, b, k] of grid.get(`${i},${j}`) ?? []) {
            const ax = g.x[a], ay = g.y[a], dx = g.x[b] - ax, dy = g.y[b] - ay;
            const l2 = dx * dx + dy * dy;
            const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
            const px = ax + dx * t, py = ay + dy * t;
            const d2 = (x - px) ** 2 + (y - py) ** 2;
            if (d2 < bestD2) { bestD2 = d2; best = { x: px, y: py, a, b, ab: k, t, d: Math.sqrt(d2), lift: g.adj[a][k].lift }; }
          }
        }
    }
    return best;
  };

  /** Le segment (a, b) ne traverse ni bâtiment (test tous les mètres) ni eau */
  const clear = (a: Pt, b: Pt) => {
    if (inWater(a, b)) return false;
    const m = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
    for (let i = 1; i <= m; i++) if (inBuilding(a[0] + ((b[0] - a[0]) * i) / m, a[1] + ((b[1] - a[1]) * i) / m)) return false;
    return true;
  };

  // A* : nœuds réels 0..n-1, départ virtuel n, arrivée virtuelle n+1
  const S = n, G = n + 1;
  const cost = new Float64Array(n + 2), prev = new Int32Array(n + 2), seen = new Uint32Array(n + 2);
  let stamp = 0;

  const astar = (s: Snap, e: Snap): { nodes: number[]; length: number } | null => {
    const edgeLen = (a: number, b: number) => g.adj[a].find((f) => f.to === b)!.len;
    const sLen = edgeLen(s.a, s.b), eLen = edgeLen(e.a, e.b);
    const virtual = (v: number) => (v === S ? s : e);
    const neighbours = (u: number, out: [number, number, number][]) => {
      out.length = 0;
      if (u === S || u === G) {
        const v = virtual(u), L = u === S ? sLen : eLen;
        out.push([v.a, v.t * L, 1], [v.b, (1 - v.t) * L, 1]);
        return;
      }
      for (const f of g.adj[u]) out.push([f.to, f.len, f.w]);
      for (const [v, id, L] of [[s, S, sLen], [e, G, eLen]] as const) {
        if (u === v.a) out.push([id, v.t * L, 1]);
        else if (u === v.b) out.push([id, (1 - v.t) * L, 1]);
      }
    };
    const px = (u: number) => (u === S ? s.x : u === G ? e.x : g.x[u]);
    const py = (u: number) => (u === S ? s.y : u === G ? e.y : g.y[u]);
    stamp++;
    const heap: [number, number][] = [[0, S]];
    cost[S] = 0; seen[S] = stamp; prev[S] = -1;
    const done = new Set<number>();
    const out: [number, number, number][] = [];
    while (heap.length) {
      // Tas binaire (min)
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        for (let i = 0; ;) {
          let m = i;
          const l = 2 * i + 1, r = l + 1;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[i], heap[m]] = [heap[m], heap[i]];
          i = m;
        }
      }
      const u = top[1];
      if (done.has(u)) continue;
      done.add(u);
      if (u === G) {
        const nodes: number[] = [];
        let length = 0;
        for (let v = G; v >= 0; v = prev[v]) nodes.push(v);
        nodes.reverse();
        for (let i = 1; i < nodes.length; i++) length += Math.hypot(px(nodes[i]) - px(nodes[i - 1]), py(nodes[i]) - py(nodes[i - 1]));
        return { nodes, length };
      }
      neighbours(u, out);
      for (const [v, len, w] of out) {
        const c = cost[u] + len / w;
        if (seen[v] !== stamp || c < cost[v]) {
          seen[v] = stamp; cost[v] = c; prev[v] = u;
          const h = Math.hypot(px(v) - e.x, py(v) - e.y) / maxW;
          heap.push([c + h, v]);
          for (let i = heap.length - 1; i > 0;) {
            const p = (i - 1) >> 1;
            if (heap[p][0] <= heap[i][0]) break;
            [heap[p], heap[i]] = [heap[i], heap[p]];
            i = p;
          }
        }
      }
    }
    return null;
  };

  const route = (from: Pt, to: Pt): Route | RouteFail => {
    const e = snap(to[0], to[1], cfg.maxSnap);
    if (!e) return 'far';
    const s = snap(from[0], from[1], 1e4);
    if (!s) return 'unreachable';
    let pts: PathPoint[];
    const sameEdge = (s.a === e.a && s.b === e.b);
    if (sameEdge) {
      pts = [{ x: s.x, y: s.y, lift: s.lift }, { x: e.x, y: e.y, lift: e.lift }];
    } else {
      const r = astar(s, e);
      if (!r) return 'unreachable';
      const liftBetween = (u: number, v: number) => {
        const w = u === S ? s.a : u === G ? e.a : u;
        const z = v === S ? s.a : v === G ? e.a : v;
        return g.adj[w].find((f) => f.to === z)?.lift ?? s.lift;
      };
      pts = r.nodes.map((u, i) => {
        const x = u === S ? s.x : u === G ? e.x : g.x[u], y = u === S ? s.y : u === G ? e.y : g.y[u];
        // Hauteur : celle du tronçon qui suit (celle du précédent pour le dernier point)
        const lift = i < r.nodes.length - 1 ? liftBetween(u, r.nodes[i + 1]) : liftBetween(r.nodes[i - 1], u);
        return { x, y, lift };
      });
    }
    // Points confondus (départ ou arrivée posés sur un nœud) : retirés, sinon le cap se calcule sur une longueur nulle
    pts = pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) > 0.05);
    pts = round(pts, cfg.corner);
    // Dernier mètre : quitter la voie en ligne droite jusqu'au point désigné
    let end: Pt = [e.x, e.y];
    if (e.d > 0.5 && e.d <= cfg.lastMeter && clear([e.x, e.y], to)) {
      pts.push({ x: to[0], y: to[1], lift: e.lift });
      end = [to[0], to[1]];
    }
    let length = 0;
    for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return { points: pts, length, end };
  };

  return { has: (u) => main.has(u), snap, route };
}

/** Arrondit les angles du chemin : chaque sommet est remplacé par une courbe de Bézier d'au plus `r` mètres de part et d'autre */
function round(pts: PathPoint[], r: number): PathPoint[] {
  if (pts.length < 3 || r <= 0) return pts;
  const out: PathPoint[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const l1 = Math.hypot(b.x - a.x, b.y - a.y), l2 = Math.hypot(c.x - b.x, c.y - b.y);
    const k = Math.min(r, l1 / 2, l2 / 2);
    if (k < 0.2) { out.push(b); continue; }
    const p0 = { x: b.x + ((a.x - b.x) / l1) * k, y: b.y + ((a.y - b.y) / l1) * k, lift: b.lift };
    const p2 = { x: b.x + ((c.x - b.x) / l2) * k, y: b.y + ((c.y - b.y) / l2) * k, lift: b.lift };
    for (let m = 0; m <= 3; m++) {
      const t = m / 3, u = 1 - t;
      out.push({ x: u * u * p0.x + 2 * u * t * b.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * b.y + t * t * p2.y, lift: b.lift });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
