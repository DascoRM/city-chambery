import type { CityData, Pt } from '../types';
import { buildingTest, mainComponent, wallDistance, waterTest, type Walkways } from './walkways';

/**
 * Chemin de l'avatar (EP005-US001) : de sa position à un point désigné, en suivant le réseau de voies
 * partagé avec les passants (walkways.ts). Accrochage au point le plus proche d'une voie de la plus grande
 * partie connexe, A* avec départ et arrivée posés sur une arête (nœuds virtuels), angles arrondis,
 * « dernier mètre » en ligne droite si aucun bâtiment n'est traversé.
 */
export interface PathConfig {
  /** Au-delà de cette distance (m) à toute voie, l'ordre est refusé */
  maxSnap: number;
  /** Rayon (m) d'arrondi des angles */
  corner: number;
  /** Déplacement libre : en ligne droite jusqu'à cette distance (m) quand rien ne gêne (bâtiment, eau, fontaine) */
  maxDirect: number;
  /** Distance (m) à garder avec les façades en ligne droite */
  clearance: number;
  /** Pour rejoindre ou quitter une voie : rayon (m) de recherche et nombre de points d'accès essayés */
  entryRadius: number;
  entries: number;
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

export function buildPathfinder(g: Walkways, data: CityData, cfg: PathConfig, avoid: { anchor: string; radius: number }[] = []): Pathfinder {
  const n = g.x.length;
  const main = mainComponent(g);
  const inBuilding = buildingTest(data);
  const inWater = waterTest(data);
  const wall = wallDistance(data);
  const zones = avoid.flatMap((z) => {
    const c = data.anchors[z.anchor]?.pos;
    return c ? [{ c, r: z.radius }] : [];
  });
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

  /** Points d'accès au réseau autour de (x, y) : le plus proche point de chaque arête à moins de `radius`, du plus près au plus loin */
  const nearEdges = (x: number, y: number, radius: number): Snap[] => {
    const out = new Map<number, Snap>();
    const c = Math.ceil(radius / CELL);
    const ci = Math.floor(x / CELL), cj = Math.floor(y / CELL);
    for (let i = ci - c; i <= ci + c; i++)
      for (let j = cj - c; j <= cj + c; j++)
        for (const [a, b, k] of grid.get(`${i},${j}`) ?? []) {
          const key = a * 1e6 + b;
          const ax = g.x[a], ay = g.y[a], dx = g.x[b] - ax, dy = g.y[b] - ay;
          const l2 = dx * dx + dy * dy;
          const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
          const px = ax + dx * t, py = ay + dy * t, d = Math.hypot(x - px, y - py);
          if (d <= radius && (!out.has(key) || d < out.get(key)!.d)) out.set(key, { x: px, y: py, a, b, ab: k, t, d, lift: g.adj[a][k].lift });
        }
    return [...out.values()].sort((u, v) => u.d - v.d);
  };

  /**
   * Passage libre en ligne droite de a à b : ni bâtiment (façades à `clearance`), ni eau, ni zone interdite (fontaine).
   * Les extrémités ne sont pas testées (un point d'une voie peut toucher une façade).
   */
  const freeLine = (a: Pt, b: Pt) => {
    if (inWater(a, b)) return false;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const m = Math.max(1, Math.ceil(len));
    for (let i = 0; i <= m; i++) {
      const x = a[0] + ((b[0] - a[0]) * i) / m, y = a[1] + ((b[1] - a[1]) * i) / m;
      for (const z of zones) if (Math.hypot(x - z.c[0], y - z.c[1]) < z.r) return false;
      if (i > 0 && i < m && wall([x, y], cfg.clearance) < cfg.clearance) return false;
      if (inBuilding(x, y) && i > 0 && i < m) return false;
    }
    return true;
  };

  // A* : nœuds réels 0..n-1, départ virtuel n (relié à tous les points d'accès de départ), arrivée virtuelle n+1
  // (reliée à tous ceux d'arrivée) : une seule recherche pour tous les couples
  const S = n, G = n + 1;
  const cost = new Float64Array(n + 2), prev = new Int32Array(n + 2), seen = new Uint32Array(n + 2);
  const tagS = new Int32Array(n + 2), tagG = new Int32Array(n + 2);
  let stamp = 0;
  const edgeLen = (a: number, b: number) => g.adj[a].find((f) => f.to === b)!.len;

  const astar = (starts: Snap[], ends: Snap[], from: Pt, to: Pt): { nodes: number[]; si: number; ei: number } | null => {
    // Nœuds d'arrivée : coût du dernier tronçon vers l'arrivée virtuelle
    const into = new Map<number, [number, number][]>();
    ends.forEach((e, j) => {
      const L = edgeLen(e.a, e.b);
      for (const [u, c] of [[e.a, e.d + e.t * L], [e.b, e.d + (1 - e.t) * L]] as const) {
        const l = into.get(u);
        if (l) l.push([j, c]); else into.set(u, [[j, c]]);
      }
    });
    const neighbours = (u: number, out: [number, number, number, number][]) => {
      out.length = 0;
      if (u === S) {
        starts.forEach((v, i) => {
          const L = edgeLen(v.a, v.b);
          out.push([v.a, v.d + v.t * L, 1, i], [v.b, v.d + (1 - v.t) * L, 1, i]);
        });
        return;
      }
      for (const f of g.adj[u]) out.push([f.to, f.len, f.w, -1]);
      for (const [j, c] of into.get(u) ?? []) out.push([G, c, 1, j]);
    };
    const px = (u: number) => (u === S ? from[0] : u === G ? to[0] : g.x[u]);
    const py = (u: number) => (u === S ? from[1] : u === G ? to[1] : g.y[u]);
    stamp++;
    const heap: [number, number][] = [[0, S]];
    cost[S] = 0; seen[S] = stamp; prev[S] = -1;
    const done = new Set<number>();
    const out: [number, number, number, number][] = [];
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
        for (let v = G; v >= 0; v = prev[v]) nodes.push(v);
        nodes.reverse();
        return { nodes, si: tagS[nodes[1]], ei: tagG[G] };
      }
      neighbours(u, out);
      for (const [v, len, w, tag] of out) {
        const c = cost[u] + len / w;
        if (seen[v] !== stamp || c < cost[v]) {
          seen[v] = stamp; cost[v] = c; prev[v] = u;
          if (u === S) tagS[v] = tag;
          if (v === G) tagG[G] = tag;
          const h = Math.hypot(px(v) - to[0], py(v) - to[1]) / maxW;
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

  /** Chemin sur le réseau entre un point d'accès de départ et un d'arrivée, d'après les nœuds trouvés (avant arrondi des angles) */
  const onNetwork = (nodes: number[], s: Snap, e: Snap): PathPoint[] => {
    const liftBetween = (u: number, v: number) => {
      const w = u === S ? s.a : u === G ? e.a : u;
      const z = v === S ? s.a : v === G ? e.a : v;
      return g.adj[w].find((f) => f.to === z)?.lift ?? (u === S ? s.lift : e.lift);
    };
    return nodes.map((u, i) => {
      const x = u === S ? s.x : u === G ? e.x : g.x[u], y = u === S ? s.y : u === G ? e.y : g.y[u];
      // Hauteur : celle du tronçon qui suit (celle du précédent pour le dernier point)
      const lift = i < nodes.length - 1 ? liftBetween(u, nodes[i + 1]) : liftBetween(nodes[i - 1], u);
      return { x, y, lift };
    });
  };
  const OFF_ROAD = 0.1; // hauteur au-dessus du relief hors des voies
  const lengthOf = (pts: PathPoint[]) => {
    let l = 0;
    for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return l;
  };
  /** Points d'accès d'un point libre : ceux qu'on voit en ligne droite, sinon le plus proche (mais seulement sans obstacle, ou au plus près) */
  const accessFor = (p: Pt, max: number): Snap[] => {
    const seen: Snap[] = [];
    let tried = 0;
    for (const c of nearEdges(p[0], p[1], cfg.entryRadius)) {
      if (seen.length >= cfg.entries || tried >= cfg.entries * 3) break;
      tried++;
      if (c.d < 0.5 || freeLine(p, [c.x, c.y])) seen.push(c);
    }
    if (seen.length) return seen;
    const near = snap(p[0], p[1], max);
    return near ? [near] : [];
  };

  const route = (from: Pt, to: Pt): Route | RouteFail => {
    const sameSpot = Math.hypot(to[0] - from[0], to[1] - from[1]) < 0.5;
    if (sameSpot) return { points: [{ x: from[0], y: from[1], lift: OFF_ROAD }], length: 0, end: to };
    // 1. Tout droit, à travers champs, places et cours, quand rien ne gêne
    if (!inBuilding(to[0], to[1]) && Math.hypot(to[0] - from[0], to[1] - from[1]) <= cfg.maxDirect && freeLine(from, to)) {
      return { points: [{ x: from[0], y: from[1], lift: OFF_ROAD }, { x: to[0], y: to[1], lift: OFF_ROAD }], length: Math.hypot(to[0] - from[0], to[1] - from[1]), end: to };
    }
    // 2. Par les voies : on essaie plusieurs points d'accès au départ et à l'arrivée (pas seulement le plus proche,
    //    qui peut être de l'autre côté d'un mur) et on garde le trajet le plus court
    const starts = accessFor(from, 1e4), ends = accessFor(to, cfg.maxSnap);
    if (!ends.length) return 'far';
    if (!starts.length) return 'unreachable';
    let best: { pts: PathPoint[]; total: number; s: Snap; e: Snap } | null = null;
    // Départ et arrivée sur la même arête : on la parcourt directement
    for (const s of starts)
      for (const e of ends) {
        if (s.a !== e.a || s.b !== e.b) continue;
        const total = s.d + Math.hypot(e.x - s.x, e.y - s.y) + e.d;
        if (!best || total < best.total) best = { pts: [{ x: s.x, y: s.y, lift: s.lift }, { x: e.x, y: e.y, lift: e.lift }], total, s, e };
      }
    const r = astar(starts, ends, from, to);
    if (r) {
      const s = starts[r.si], e = ends[r.ei];
      const pts = onNetwork(r.nodes, s, e);
      const total = s.d + lengthOf(pts) + e.d;
      if (!best || total < best.total) best = { pts, total, s, e };
    }
    if (!best) return 'unreachable';
    let pts = best.pts;
    // Points confondus (départ ou arrivée posés sur un nœud) : retirés, sinon le cap se calcule sur une longueur nulle
    pts = pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) > 0.05);
    pts = round(pts, cfg.corner);
    // Quitter ou rejoindre la voie en ligne droite (là où on voit le point de la voie)
    if (best.s.d > 0.5 && freeLine(from, [best.s.x, best.s.y])) pts.unshift({ x: from[0], y: from[1], lift: OFF_ROAD });
    let end: Pt = [best.e.x, best.e.y];
    if (best.e.d > 0.5 && !inBuilding(to[0], to[1]) && freeLine([best.e.x, best.e.y], to)) {
      pts.push({ x: to[0], y: to[1], lift: OFF_ROAD });
      end = [to[0], to[1]];
    }
    return { points: pts, length: lengthOf(pts), end };
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
