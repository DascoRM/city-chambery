import * as THREE from 'three';
import type { Building, CityData, Pt } from '../../types';
import { roofGeometry, skeletonRoofGeometry } from '../roofs';
import { frameOf } from './cathedrale';
import { glowAtNight, uplight } from './lighting';
import { buildGrille } from './chateau-grille';

/**
 * Château des ducs de Savoie — version « formes simples » générée en code (itération 12).
 *
 * Chaque bâtiment du château est reconstruit sur son contour OpenStreetMap (bâtiments d'origine
 * masqués), en coordonnées du diorama (le modèle se place avec pos [0, 0]).
 *
 * Ce qui vient de sources :
 *  - contours et noms : OpenStreetMap (tour Trésorerie, tour demi-ronde, tour des Archives,
 *    Sainte-Chapelle, Porterie, aile du Midi, Conseil départemental) ;
 *  - Sainte-Chapelle gothique flamboyante (1408-1430), 22 m de hauteur intérieure, cinq travées
 *    étroites, contreforts ; porterie à mâchicoulis ; tour demi-ronde isolée face à la
 *    Sainte-Chapelle (office de tourisme Chambéry Montagnes, techno-science.net).
 * Hypothèses (à vérifier) : toutes les hauteurs, les pentes et la forme des toits, la couleur
 * de la pierre et des toits. Non représentés : la tour Yolande (clocher du carillon, emplacement
 * non trouvé dans OSM), la façade baroque de la Sainte-Chapelle, les décors.
 * Côté esplanade, la cour est fermée par une grille et un portail (voir chateau-grille.ts).
 */

type Kind = 'tower' | 'wing' | 'chapel' | 'gate';
interface Part { id: number; kind: Kind; wall: number; slopeDeg: number; maxRise: number }

// Hauteurs de murs (gouttière) et pentes de toit : hypothèses
export const CHATEAU_PARTS: Part[] = [
  { id: 101968404, kind: 'tower', wall: 24, slopeDeg: 55, maxRise: 11 }, // Tour Trésorerie
  { id: 237985590, kind: 'tower', wall: 20, slopeDeg: 55, maxRise: 10 }, // Tour demi-ronde
  { id: 101971080, kind: 'tower', wall: 22, slopeDeg: 55, maxRise: 10 }, // Tour des Archives
  { id: 237985591, kind: 'chapel', wall: 20, slopeDeg: 55, maxRise: 11 }, // Sainte-Chapelle
  { id: 237985594, kind: 'gate', wall: 16, slopeDeg: 45, maxRise: 8 }, // Porterie
  { id: 237985593, kind: 'wing', wall: 17, slopeDeg: 45, maxRise: 8 }, // Aile du Midi
  { id: 237985592, kind: 'wing', wall: 15, slopeDeg: 45, maxRise: 7 }, // Conseil départemental
];

const stone = new THREE.MeshStandardMaterial({ color: '#d8d0bd', roughness: 0.9, flatShading: true });
const stoneDark = new THREE.MeshStandardMaterial({ color: '#b9b09b', roughness: 0.9, flatShading: true });
const roofMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true, side: THREE.DoubleSide });
const opening = new THREE.MeshStandardMaterial({ color: '#3a3430', roughness: 1 });
const SLATE = new THREE.Color('#62666e');
const WALL = new THREE.Color('#d8d0bd');
let lit = false;

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[]): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

/** Murs : contour OSM extrudé jusqu'à la gouttière. */
export function walls(b: Building, h: number, mat: THREE.Material): THREE.Mesh {
  const shape = new THREE.Shape(b.outer.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const hole of b.holes) shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  return mesh(geo, mat);
}

/** Toit : rectangle (pyramide / quatre pans) ou squelette droit, avec une pente plus raide que la ville. */
function roof(b: Building, part: Part): THREE.BufferGeometry | null {
  const slope = Math.tan((part.slopeDeg * Math.PI) / 180);
  if (b.rect) {
    const r = b.rect;
    const rise = Math.min(part.maxRise, r.b * slope);
    const shape = r.a / r.b < 1.3 ? 'pyramidal' : 'hipped';
    return roofGeometry({ roof: { ...r, s: shape, rise }, eave: part.wall }, SLATE, WALL);
  }
  if (b.skel) {
    const maxD = Math.max(0, ...b.skel.v.map((v) => v[2]));
    if (maxD <= 0) return null;
    return skeletonRoofGeometry(b, { eave: part.wall, slope: Math.min(slope, part.maxRise / maxD) }, SLATE);
  }
  return null;
}

/** Point de l'anneau le plus proche d'un point donné, avec la direction du mur. */
function edgesOf(ring: Pt[]) {
  return ring.map((p, i) => {
    const q = ring[(i + 1) % ring.length];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    return { p, q, len, ux: (q[0] - p[0]) / (len || 1), uy: (q[1] - p[1]) / (len || 1) };
  });
}

/**
 * Petits éléments posés régulièrement le long des murs (contreforts, mâchicoulis, fenêtres).
 * Avec includeHoles, aussi le long des cours intérieures (orientés vers la cour).
 */
export function alongWalls(b: Building, spacing: number, make: (x: number, y: number, angle: number) => THREE.Object3D, minEdge = 3, includeHoles = false): THREE.Group {
  const g = new THREE.Group();
  const signedArea = (r: Pt[]) => r.reduce((s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0);
  const rings: { ring: Pt[]; hole: boolean }[] = [{ ring: b.outer, hole: false }, ...(includeHoles ? b.holes.map((h) => ({ ring: h, hole: true })) : [])];
  for (const { ring, hole } of rings) {
    // Côté « extérieur au bâti » : hors de l'anneau pour le contour, dans l'anneau pour une cour
    const ccw = signedArea(ring) > 0;
    const right = hole ? !ccw : ccw;
    for (const e of edgesOf(ring)) {
      if (e.len < minEdge) continue;
      const n = Math.max(1, Math.floor(e.len / spacing));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const x = e.p[0] + (e.q[0] - e.p[0]) * t, y = e.p[1] + (e.q[1] - e.p[1]) * t;
        const nx = right ? e.uy : -e.uy, ny = right ? -e.ux : e.ux;
        g.add(make(x, y, Math.atan2(ny, nx)));
      }
    }
  }
  return g;
}

export function buildChateau(ctx: { night: { value: number }; data?: CityData; minUnder?: (r: Pt[]) => number; heightAt?: (x: number, y: number) => number }): THREE.Group {
  const g = new THREE.Group();
  g.name = 'chateau-des-ducs';
  if (!ctx.data) return g;
  const data = ctx.data;
  // Relief : chaque bâtiment est posé sur le point le plus bas du terrain sous son emprise
  const groundOf = (id: number) => {
    const b = data.buildings.find((x) => x.id === id);
    return b ? (ctx.minUnder?.(b.outer) ?? 0) : 0;
  };
  const lowest = Math.min(...CHATEAU_PARTS.map((p) => groundOf(p.id)));
  if (!lit) {
    uplight(stone, ctx.night, 1.0, 32, lowest);
    uplight(stoneDark, ctx.night, 1.0, 32, lowest);
    uplight(roofMat, ctx.night, 0.4, 32, lowest);
    glowAtNight(opening, ctx.night, 0.55);
    lit = true;
  }

  for (const part of CHATEAU_PARTS) {
    const b = ctx.data.buildings.find((x) => x.id === part.id);
    if (!b) {
      console.warn(`[château] bâtiment OSM ${part.id} introuvable`);
      continue;
    }
    const pg = new THREE.Group(); // groupe du bâtiment, calé sur son sol
    pg.position.y = groundOf(part.id);
    g.add(pg);
    pg.add(walls(b, part.wall, part.kind === 'tower' ? stoneDark : stone));
    const r = roof(b, part);
    if (r) pg.add(mesh(r, roofMat));

    // Fenêtres étroites sur les façades (une par ~6 m, deux niveaux)
    if (part.kind === 'wing' || part.kind === 'gate') {
      for (const y of [part.wall * 0.35, part.wall * 0.7]) {
        pg.add(alongWalls(b, 6, (x, yy, ang) => {
          const w = mesh(new THREE.BoxGeometry(0.25, 2.4, 1.3), opening);
          w.position.set(x + Math.cos(ang) * 0.08, y, -(yy + Math.sin(ang) * 0.08));
          w.rotation.y = ang;
          return w;
        }, 5));
      }
    }

    // Porterie : couronne de mâchicoulis sous le toit
    if (part.kind === 'gate') {
      pg.add(alongWalls(b, 1.4, (x, yy, ang) => {
        const c = mesh(new THREE.BoxGeometry(0.8, 1.2, 0.9), stoneDark);
        c.position.set(x + Math.cos(ang) * 0.35, part.wall - 0.6, -(yy + Math.sin(ang) * 0.35));
        c.rotation.y = ang;
        return c;
      }, 2));
    }

    // Tours : cordon de pierre + meurtrières
    if (part.kind === 'tower') {
      pg.add(alongWalls(b, 1.2, (x, yy, ang) => {
        const c = mesh(new THREE.BoxGeometry(0.6, 0.8, 1.3), stone);
        c.position.set(x + Math.cos(ang) * 0.3, part.wall - 0.4, -(yy + Math.sin(ang) * 0.3));
        c.rotation.y = ang;
        return c;
      }, 1));
      pg.add(alongWalls(b, 5, (x, yy, ang) => {
        const w = mesh(new THREE.BoxGeometry(0.25, 2, 0.5), opening);
        w.position.set(x + Math.cos(ang) * 0.08, part.wall * 0.55, -(yy + Math.sin(ang) * 0.08));
        w.rotation.y = ang;
        return w;
      }, 2.5));
    }

    // Sainte-Chapelle : contreforts et grandes baies gothiques sur les côtés longs
    if (part.kind === 'chapel') {
      const f = frameOf(b.outer);
      pg.add(alongWalls(b, 5.5, (x, yy, ang) => {
        const grp = new THREE.Group();
        const c = mesh(new THREE.BoxGeometry(1.8, part.wall + 1.5, 1.1), stone);
        c.position.set(x + Math.cos(ang) * 0.8, (part.wall + 1.5) / 2, -(yy + Math.sin(ang) * 0.8));
        c.rotation.y = ang;
        grp.add(c);
        const pin = mesh(new THREE.ConeGeometry(0.7, 2.5, 4), stoneDark);
        pin.position.set(c.position.x, part.wall + 1.5 + 1.25, c.position.z);
        grp.add(pin);
        return grp;
      }, Math.min(8, f.a)));
      pg.add(alongWalls(b, 5.5, (x, yy, ang) => {
        const w = mesh(new THREE.BoxGeometry(0.25, 9, 2.2), opening);
        w.position.set(x + Math.cos(ang) * 0.08, part.wall * 0.5, -(yy + Math.sin(ang) * 0.08));
        w.rotation.y = ang;
        return w;
      }, 6));
    }
  }

  // Clôture côté esplanade : mur bas + grille, portail fermé sur l'allée, escalier (chateau-grille.ts)
  g.add(buildGrille(ctx.heightAt ?? (() => 0), stone, stoneDark));
  return g;
}
