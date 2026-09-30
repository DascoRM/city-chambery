import * as THREE from 'three';
import { mesh } from './mesh';
import type { HeightFn, Pt } from '../../types';

/**
 * Château : clôture côté esplanade (itération 20).
 *
 * Retour de Dasco : la cour n'est pas ouverte côté esplanade. On y accède par un escalier, et
 * d'anciennes grilles ferment le château (on voit à travers).
 *
 * Ce qui vient d'OpenStreetMap (coordonnées du diorama, en mètres) :
 *  - l'ouverture : entre la tour demi-ronde (way 237985590) et le jardin du château (way 235607770) ;
 *  - l'allée de service qui entre dans le château (way 26474854) → emplacement du portail ;
 *  - le bord ouest du jardin, jusqu'au bas de la pente (way 235607770) ;
 *  - l'escalier qui monte de l'esplanade vers le Portail Saint-Dominique (ways 1396192014, 164635731, 835789461).
 * Hypothèses (à vérifier sur place) : tracé exact de la grille, hauteurs (mur bas 0,8 m,
 * grille 2,6 m, portail 3,6 m), espacement des piliers, dessin du portail, nombre de marches.
 */

/** Tracé de la clôture : tour demi-ronde → coin du jardin → bord ouest du jardin, jusqu'au bas de la pente. */
const FENCE: Pt[] = [[-259.0, -103.4], [-262.6, -85.0], [-259.8, -74.5], [-249.6, -37.5]];
/** Allée de service (way 26474854), deux premiers points : le portail est posé là où elle traverse la clôture. */
const DRIVE: [Pt, Pt] = [[-267.2, -89.5], [-239.2, -95.0]];
/** Escalier depuis l'esplanade (OSM), de bas en haut. */
const STAIRS: Pt[] = [[-271.6, -80.8], [-264.5, -76.3], [-263.3, -71.5], [-262.5, -69.0]];

const WALL_H = 0.8; // mur bas sous la grille
const FENCE_H = 2.6; // haut des barreaux
const GATE_W = 5; // largeur du portail (deux vantaux)
const GATE_H = 3.6;
const BAR_STEP = 0.16;

const iron = new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.5, metalness: 0.6 });


/** Intersection de deux segments (paramètre t sur le premier), ou null. */
function intersect([a, b]: [Pt, Pt], [c, d]: [Pt, Pt]): number | null {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
  const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}

/** Ruban épais qui suit le sol le long d'un tracé (mur, lisse) : dessus + deux côtés + bouts. */
function ribbon(path: Pt[], h: HeightFn, bottom: number, top: number, half: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[]) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (let k = 0; k + 1 < path.length; k++) {
    const [p, q] = [path[k], path[k + 1]];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const nx = -(q[1] - p[1]) / len * half, ny = (q[0] - p[0]) / len * half;
    const n = Math.max(1, Math.ceil(len)); // un échantillon par mètre pour suivre la pente
    for (let i = 0; i < n; i++) {
      const [x0, y0] = [p[0] + ((q[0] - p[0]) * i) / n, p[1] + ((q[1] - p[1]) * i) / n];
      const [x1, y1] = [p[0] + ((q[0] - p[0]) * (i + 1)) / n, p[1] + ((q[1] - p[1]) * (i + 1)) / n];
      const g0 = h(x0, y0), g1 = h(x1, y1);
      const P = (x: number, y: number, z: number) => [x, z, -y];
      const L0t = P(x0 + nx, y0 + ny, g0 + top), R0t = P(x0 - nx, y0 - ny, g0 + top), L1t = P(x1 + nx, y1 + ny, g1 + top), R1t = P(x1 - nx, y1 - ny, g1 + top);
      const L0b = P(x0 + nx, y0 + ny, g0 + bottom), R0b = P(x0 - nx, y0 - ny, g0 + bottom), L1b = P(x1 + nx, y1 + ny, g1 + bottom), R1b = P(x1 - nx, y1 - ny, g1 + bottom);
      quad(L0t, R0t, R1t, L1t); // dessus
      quad(L0b, L0t, L1t, L1b); // côté gauche
      quad(R0t, R0b, R1b, R1t); // côté droit
      if (k === 0 && i === 0) quad(L0b, R0b, R0t, L0t);
      if (k === path.length - 2 && i === n - 1) quad(L1t, R1t, R1b, L1b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Barreaux instanciés : [x, y, bas, haut] (hauteurs absolues). */
function bars(list: [number, number, number, number][], size = 0.05): THREE.Group {
  const g = new THREE.Group();
  if (!list.length) return g;
  const bar = new THREE.InstancedMesh(new THREE.BoxGeometry(size, 1, size), iron, list.length);
  const tip = new THREE.InstancedMesh(new THREE.ConeGeometry(0.06, 0.22, 4), iron, list.length);
  const m = new THREE.Matrix4(), s = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Quaternion();
  list.forEach(([x, y, lo, hi], i) => {
    bar.setMatrixAt(i, m.compose(p.set(x, (lo + hi) / 2, -y), q, s.set(1, hi - lo, 1)));
    tip.setMatrixAt(i, m.compose(p.set(x, hi + 0.1, -y), q, s.set(1, 1, 1)));
  });
  bar.castShadow = tip.castShadow = true;
  g.add(bar, tip);
  return g;
}

export function buildGrille(h: HeightFn, stone: THREE.Material, stoneDark: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  g.name = 'chateau-grille';

  // Où le portail coupe la clôture
  let gateSeg = -1, gateT = 0;
  for (let k = 0; k + 1 < FENCE.length && gateSeg < 0; k++) {
    const t = intersect([FENCE[k], FENCE[k + 1]], DRIVE);
    if (t !== null) { gateSeg = k; gateT = t; }
  }

  // Tronçons de clôture (le portail est découpé dedans) + piliers
  const pieces: Pt[][] = [];
  const pillars: Pt[] = [FENCE[0]];
  let current: Pt[] = [FENCE[0]];
  let gate: { a: Pt; b: Pt; c: Pt } | null = null;
  for (let k = 0; k + 1 < FENCE.length; k++) {
    const [p, q] = [FENCE[k], FENCE[k + 1]];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const at = (d: number): Pt => [p[0] + ((q[0] - p[0]) * d) / len, p[1] + ((q[1] - p[1]) * d) / len];
    if (k === gateSeg) {
      const mid = gateT * len;
      const a = at(mid - GATE_W / 2), b = at(mid + GATE_W / 2);
      current.push(a); pieces.push(current); current = [b];
      gate = { a, b, c: at(mid) };
      pillars.push(a, b);
    }
    // Piliers intermédiaires tous les ~4,5 m
    const n = Math.max(1, Math.round(len / 4.5));
    for (let i = 1; i < n; i++) {
      const d = (len * i) / n;
      if (k === gateSeg && Math.abs(d - gateT * len) < GATE_W / 2 + 1.5) continue;
      pillars.push(at(d));
    }
    current.push(q);
    pillars.push(q);
  }
  pieces.push(current);

  for (const piece of pieces) {
    // Mur bas (descend sous le sol pour ne jamais flotter dans la pente)
    g.add(mesh(ribbon(piece, h, -1, WALL_H, 0.28), stone));
    g.add(mesh(ribbon(piece, h, WALL_H, WALL_H + 0.12, 0.34), stoneDark)); // chaperon
    // Lisses de la grille
    g.add(mesh(ribbon(piece, h, FENCE_H - 0.3, FENCE_H - 0.24, 0.04), iron));
    g.add(mesh(ribbon(piece, h, WALL_H + 0.3, WALL_H + 0.36, 0.04), iron));
    // Barreaux
    const list: [number, number, number, number][] = [];
    for (let k = 0; k + 1 < piece.length; k++) {
      const [p, q] = [piece[k], piece[k + 1]];
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      for (let d = BAR_STEP / 2; d < len; d += BAR_STEP) {
        const x = p[0] + ((q[0] - p[0]) * d) / len, y = p[1] + ((q[1] - p[1]) * d) / len, gr = h(x, y);
        list.push([x, y, gr + WALL_H + 0.12, gr + FENCE_H]);
      }
    }
    g.add(bars(list));
  }

  // Piliers de pierre avec chapeau
  for (const [x, y] of pillars) {
    const gr = h(x, y);
    const big = gate && [gate.a, gate.b].some((p) => p[0] === x && p[1] === y);
    const w = big ? 1.1 : 0.6, top = big ? GATE_H + 0.6 : FENCE_H + 0.3;
    const pil = mesh(new THREE.BoxGeometry(w, top + 1, w), stone);
    pil.position.set(x, gr + (top - 1) / 2, -y);
    const cap = mesh(new THREE.BoxGeometry(w + 0.2, 0.2, w + 0.2), stoneDark);
    cap.position.set(x, gr + top + 0.1, -y);
    g.add(pil, cap);
    if (big) {
      const ball = mesh(new THREE.SphereGeometry(0.35, 8, 6), stoneDark);
      ball.position.set(x, gr + top + 0.55, -y);
      g.add(ball);
    }
  }

  // Portail fermé sur l'allée : deux vantaux, barreaux en arc, traverses
  if (gate) {
    const { a, b } = gate;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const list: [number, number, number, number][] = [];
    const inner = 0.55; // retrait depuis l'axe des piliers
    for (let d = inner; d <= len - inner; d += 0.14) {
      const t = (d - inner) / (len - 2 * inner);
      const x = a[0] + ((b[0] - a[0]) * d) / len, y = a[1] + ((b[1] - a[1]) * d) / len, gr = h(x, y);
      list.push([x, y, gr + 0.1, gr + GATE_H - 0.5 + 0.5 * Math.sin(Math.PI * t)]);
    }
    g.add(bars(list, 0.06));
    for (const z of [0.35, 1.6, 2.7]) g.add(mesh(ribbon([a, b], h, z, z + 0.08, 0.05), iron));
  }

  // Escalier de pierre depuis l'esplanade (tracé OSM), marches de 0,4 m qui suivent le sol
  const steps = new THREE.Group();
  for (let k = 0; k + 1 < STAIRS.length; k++) {
    const [p, q] = [STAIRS[k], STAIRS[k + 1]];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
    for (let d = 0.2; d < len; d += 0.4) {
      const x = p[0] + ((q[0] - p[0]) * d) / len, y = p[1] + ((q[1] - p[1]) * d) / len;
      const top = Math.round((h(x, y) + 0.16) / 0.16) * 0.16; // hauteurs de marche régulières
      const s = mesh(new THREE.BoxGeometry(0.42, top - h(x, y) + 1, 2.2), stone);
      s.position.set(x, top - (top - h(x, y) + 1) / 2, -y);
      s.rotation.y = ang;
      steps.add(s);
    }
  }
  g.add(steps);
  return g;
}
