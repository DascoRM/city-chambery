import type { Road } from '../types';
import { segDist2 } from './geo';

/**
 * Types de voies OSM et hauteur de leurs rubans au-dessus du relief.
 * Une seule source pour le dessin des rues (city.ts) et pour tout ce qui y marche (éléphants,
 * passants) : si une hauteur change ici, ils restent posés sur la chaussée.
 */

/** Voies piétonnes (dessinées en chemin clair, préférées par les promeneurs). */
export const FOOT_KINDS = new Set(['footway', 'path', 'steps', 'cycleway', 'track', 'pedestrian', 'living_street']);

/** Ordre vertical : chemins < rues < berges < eau < ponts (le sol en relief porte les verts, places et plans d'eau). */
export const LIFT = { foot: 0.14, street: 0.18, bank: 0.24, water: 0.3, bridge: 0.9 } as const;

/** Hauteur du ruban d'une voie au-dessus du relief. */
export const roadLift = (kind: string, bridge?: boolean) => (bridge ? LIFT.bridge : FOOT_KINDS.has(kind) ? LIFT.foot : LIFT.street);

/**
 * Distance (m) d'un point à la voie la plus proche, par une grille de 25 m (voisinage de 3 × 3 cases :
 * au-delà de ≈ 25 m, la réponse peut être Infinity). Sert à trouver les façades côté rue (auvents, portes).
 */
export function roadDistanceIndex(roads: Road[], skipKinds: Set<string> = new Set(['steps', 'track', 'cycleway'])): (x: number, y: number) => number {
  const CELL = 25;
  const grid = new Map<string, number[][]>();
  for (const r of roads) {
    if (skipKinds.has(r.kind)) continue;
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
  return (x, y) => {
    let best = Infinity;
    const ci = Math.floor(x / CELL), cj = Math.floor(y / CELL);
    for (let i = ci - 1; i <= ci + 1; i++)
      for (let j = cj - 1; j <= cj + 1; j++)
        for (const [ax, ay, bx, by] of grid.get(`${i},${j}`) ?? []) best = Math.min(best, segDist2(x, y, ax, ay, bx, by));
    return Math.sqrt(best);
  };
}
