import * as THREE from 'three';
import type { Building, RectRoof } from '../types';

/**
 * Dessin des toits en pente. Le choix du toit (rectangle, squelette droit ou plat)
 * est fait par le script de données : voir scripts/roofs.mjs.
 */

export interface RoofPlan {
  roof: RectRoof;
  /** Hauteur de la gouttière (haut des murs) */
  eave: number;
}

const PITCH = Math.tan((33 * Math.PI) / 180);

/** Toit « rectangle » : la hauteur OSM est la hauteur totale ; une hauteur estimée sert de gouttière. */
export function planRoof(b: Building): RoofPlan | null {
  if (!b.rect) return null;
  return { roof: b.rect, eave: b.eave ?? Math.max(b.minH + 2.5, b.h - b.rect.rise * 0.5) };
}

/** Toit à pans suivant le squelette droit (formes irrégulières, en L, avec cour). */
export interface SkeletonPlan { eave: number; slope: number }

export function planSkeletonRoof(b: Building): SkeletonPlan | null {
  if (!b.skel) return null;
  const maxD = Math.max(0, ...b.skel.v.map((v) => v[2]));
  if (maxD <= 0) return null;
  // Pente de 33°, mais faîtage limité (7 m, 14 m pour les églises) sur les très grands bâtiments
  const maxRise = ['church', 'cathedral', 'chapel'].includes(b.kind) ? 14 : 7;
  const slope = Math.min(PITCH, maxRise / maxD);
  const rise = b.roofH ?? maxD * slope;
  const eave = b.eave ?? Math.max(b.minH + 2.5, b.h - rise * 0.5);
  return { eave, slope: b.roofH ? b.roofH / maxD : slope };
}

export function skeletonRoofGeometry(b: Building, plan: SkeletonPlan, roofColor: THREE.Color): THREE.BufferGeometry | null {
  const { n, f } = b.skel!;
  // Sommets complets = emprise (distance 0) + sommets intérieurs
  const ring = n ? [b.outer, ...b.holes].flat().map(([x, y]) => [x, y, 0] as [number, number, number]) : [];
  if (ring.length !== n) return null;
  const v = [...ring, ...b.skel!.v];
  const pos: number[] = [];
  const P = (i: number) => new THREE.Vector3(v[i][0], plan.eave + v[i][2] * plan.slope, -v[i][1]);
  for (const face of f) {
    if (face.length < 3) continue;
    if (face.some((i) => !v[i])) continue;
    const contour = face.map((i) => new THREE.Vector2(v[i][0], v[i][1]));
    let tris: number[][];
    try {
      tris = THREE.ShapeUtils.triangulateShape(contour, []);
    } catch {
      continue;
    }
    for (const [i, j, k] of tris) {
      const a = P(face[i]), c = P(face[j]), d = P(face[k]);
      const n = new THREE.Vector3().subVectors(c, a).cross(new THREE.Vector3().subVectors(d, a));
      // Tous les pans regardent vers le ciel
      const [p, q, r] = n.y >= 0 ? [a, c, d] : [a, d, c];
      pos.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z);
    }
  }
  if (!pos.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const col = new Float32Array(pos.length);
  for (let i = 0; i < col.length; i += 3) col.set([roofColor.r, roofColor.g, roofColor.b], i);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Géométrie du toit (non indexée, normales à plat), avec couleurs : pans = toit, pignons = mur. */
export function roofGeometry(plan: RoofPlan, roofColor: THREE.Color, wallColor: THREE.Color): THREE.BufferGeometry {
  const { roof: obb, eave } = plan;
  const { rise, s: shape } = obb;
  const over = 0.35; // léger débord de toit, très « maquette »
  const a = obb.a + over, b = obb.b + over;
  const top = eave + rise;
  // Repère local (s le long du grand côté, t en travers) → monde (x, y, z) avec z = -nord
  const P = (s: number, t: number, y: number): [number, number, number] => [
    obb.cx + obb.ux * s - obb.uy * t,
    y,
    -(obb.cy + obb.uy * s + obb.ux * t),
  ];
  const c1 = P(-a, -b, eave), c2 = P(a, -b, eave), c3 = P(a, b, eave), c4 = P(-a, b, eave);
  const pos: number[] = [];
  const col: number[] = [];
  const center = new THREE.Vector3(...P(0, 0, eave + rise * 0.3));
  const tri = (p: number[], q: number[], r: number[], color: THREE.Color) => {
    // Orientation vers l'extérieur : on retourne le triangle si sa normale pointe vers le centre
    const n = new THREE.Vector3().crossVectors(
      new THREE.Vector3(q[0] - p[0], q[1] - p[1], q[2] - p[2]),
      new THREE.Vector3(r[0] - p[0], r[1] - p[1], r[2] - p[2]),
    );
    const out = new THREE.Vector3((p[0] + q[0] + r[0]) / 3, (p[1] + q[1] + r[1]) / 3, (p[2] + q[2] + r[2]) / 3).sub(center);
    const [x, y, z] = n.dot(out) >= 0 ? [p, q, r] : [p, r, q];
    pos.push(...x, ...y, ...z);
    for (let i = 0; i < 3; i++) col.push(color.r, color.g, color.b);
  };
  const quad = (p: number[], q: number[], r: number[], s: number[], color: THREE.Color) => {
    tri(p, q, r, color);
    tri(p, r, s, color);
  };
  // Dessous du débord (évite de voir à travers le toit en vue rasante)
  const under = wallColor.clone().multiplyScalar(0.7);
  quad(c1, c4, c3, c2, under);

  if (shape === 'gabled') {
    const r1 = P(-a, 0, top), r2 = P(a, 0, top);
    quad(c1, c2, r2, r1, roofColor); // pan côté -t
    quad(c4, r1, r2, c3, roofColor); // pan côté +t
    tri(c1, r1, c4, wallColor); // pignons
    tri(c2, c3, r2, wallColor);
  } else if (shape === 'hipped' && a - b > 0.5) {
    const r1 = P(-(a - b), 0, top), r2 = P(a - b, 0, top);
    quad(c1, c2, r2, r1, roofColor);
    quad(c4, r1, r2, c3, roofColor);
    tri(c1, r1, c4, roofColor); // croupes
    tri(c2, c3, r2, roofColor);
  } else {
    const apex = P(0, 0, top);
    tri(c1, c2, apex, roofColor);
    tri(c2, c3, apex, roofColor);
    tri(c3, c4, apex, roofColor);
    tri(c4, c1, apex, roofColor);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}
