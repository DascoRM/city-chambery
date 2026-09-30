import * as THREE from 'three';
import type { Poly, Pt } from '../types';

/**
 * Géométrie 2D commune (mètres, x = est, y = nord) et calcul « point de l'écran → rayon ».
 * Partagée par la ville, les arbres, les épingles, les éléphants et, plus tard, les passants.
 */

/** Point dans un anneau (règle pair-impair). */
export function pointInRing(x: number, y: number, ring: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Point dans un polygone : dans le contour extérieur et hors de ses trous. */
export function pointInPoly(x: number, y: number, poly: Poly): boolean {
  return pointInRing(x, y, poly.outer) && !poly.holes.some((h) => pointInRing(x, y, h));
}

/** Carré de la distance du point (px, py) au segment [a, b] (sans racine : pour les boucles serrées). */
export function segDist2(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  const ex = ax + dx * t - px, ey = ay + dy * t - py;
  return ex * ex + ey * ey;
}

/** Distance d'un point au segment [a, b]. */
export function distToSegment([px, py]: Pt, [ax, ay]: Pt, [bx, by]: Pt): number {
  return Math.sqrt(segDist2(px, py, ax, ay, bx, by));
}

const ndc = new THREE.Vector2();
/** Oriente `raycaster` depuis la caméra vers le point (clientX, clientY) de l'écran ; rect = rectangle du canevas. */
export function screenRay(raycaster: THREE.Raycaster, camera: THREE.Camera, rect: DOMRect, clientX: number, clientY: number): THREE.Raycaster {
  ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return raycaster;
}
