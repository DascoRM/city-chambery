import * as THREE from 'three';
import type { CityData, Poly, Pt } from '../types';
import { PALETTE } from './palette';

/**
 * Relief du diorama.
 *
 * La grille d'altitudes (city.json → terrain) est triangulée exactement comme le maillage affiché,
 * si bien que heightAt() renvoie l'altitude de la surface visible : les rues, bâtiments, arbres et
 * repères posés avec heightAt() tombent pile sur le sol. Sans données de relief, tout est à 0.
 *
 * Les espaces verts, places et plans d'eau sont peints sur une texture posée sur le relief
 * (ils suivent donc la pente sans géométrie supplémentaire).
 */
export interface Terrain {
  /** Altitude du sol (m, relative au point le plus bas) en coordonnées OSM projetées (x est, y nord). */
  heightAt(x: number, y: number): number;
  /** Altitude la plus basse sous une emprise (pour poser un bâtiment sans qu'il flotte). */
  minUnder(ring: Pt[]): number;
  hasRelief: boolean;
}

export function createTerrain(data: CityData): Terrain {
  const t = data.terrain;
  if (!t) return { heightAt: () => 0, minUnder: () => 0, hasRelief: false };
  const { x0, y0, step, nx, ny } = t;
  const z = (i: number, j: number) => t.z[Math.min(ny - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))] / 10;
  const heightAt = (x: number, y: number) => {
    const fx = THREE.MathUtils.clamp((x - x0) / step, 0, nx - 1.0001);
    const fy = THREE.MathUtils.clamp((y - y0) / step, 0, ny - 1.0001);
    const i = Math.floor(fx), j = Math.floor(fy);
    const u = fx - i, v = fy - j;
    const a = z(i, j), b = z(i + 1, j), c = z(i, j + 1), d = z(i + 1, j + 1);
    // Même découpage en triangles que le maillage : diagonale (i+1, j) – (i, j+1)
    return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
  };
  const minUnder = (ring: Pt[]) => {
    let m = Infinity;
    for (const [x, y] of ring) m = Math.min(m, heightAt(x, y));
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    return Math.min(m, heightAt(cx, cy));
  };
  return { heightAt, minUnder, hasRelief: true };
}

// ---------------------------------------------------------------------------
// Maillage du sol (relief) + texture peinte + bords du socle
// ---------------------------------------------------------------------------
const SOIL_BOTTOM = -14;

function paintGround(data: CityData): THREE.CanvasTexture {
  const b = data.bounds;
  const W = b.maxX - b.minX, D = b.maxY - b.minY;
  const px = 2048;
  const cv = document.createElement('canvas');
  cv.width = px;
  cv.height = Math.round((px * D) / W);
  const ctx = cv.getContext('2d')!;
  const sx = cv.width / W, sy = cv.height / D;
  const X = (x: number) => (x - b.minX) * sx, Y = (y: number) => (b.maxY - y) * sy;
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(0, 0, cv.width, cv.height);
  const fillPolys = (polys: Poly[], color: string) => {
    ctx.fillStyle = color;
    for (const p of polys) {
      ctx.beginPath();
      for (const ring of [p.outer, ...p.holes]) {
        ring.forEach(([x, y], k) => (k ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
        ctx.closePath();
      }
      ctx.fill('evenodd');
    }
  };
  fillPolys(data.areas.filter((a) => a.kind === 'green'), PALETTE.green);
  fillPolys(data.areas.filter((a) => a.kind === 'plaza'), PALETTE.plaza);
  fillPolys(data.water.filter((w): w is Extract<typeof w, { kind: 'area' }> => w.kind === 'area'), PALETTE.water);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function buildGround(data: CityData, terrain: Terrain): THREE.Group {
  const g = new THREE.Group();
  g.name = 'ground';
  const b = data.bounds;
  const W = b.maxX - b.minX, D = b.maxY - b.minY;
  const t = data.terrain;
  // Grille du maillage : celle du relief (complétée jusqu'au bord exact du socle), ou un simple plan
  const axis = (start: number, step: number, count: number, end: number) => {
    const v = Array.from({ length: count }, (_, k) => start + k * step);
    if (end - v[v.length - 1] > 0.05) v.push(end);
    return v;
  };
  const xs = t ? axis(t.x0, t.step, t.nx, b.maxX) : [b.minX, b.maxX];
  const ys = t ? axis(t.y0, t.step, t.ny, b.maxY) : [b.minY, b.maxY];
  const nx = xs.length, ny = ys.length;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const x = xs[i], y = ys[j];
      pos.push(x, terrain.heightAt(x, y), -y);
      uv.push((x - b.minX) / W, (y - b.minY) / D);
    }
  }
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, bb = a + 1, c = a + nx, d = c + 1;
      // Triangles orientés vers le haut, diagonale (bb, c) comme dans heightAt()
      idx.push(a, bb, c, bb, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: paintGround(data), roughness: 1 }));
  ground.receiveShadow = true;
  ground.name = 'terrain';
  g.add(ground);

  // Bords du socle : strates de terre qui suivent le profil du relief
  const skirt: number[] = [], col: number[] = [];
  const top = new THREE.Color(PALETTE.soilTop), bottom = new THREE.Color(PALETTE.soilBottom), green = new THREE.Color(PALETTE.ground);
  const edge = (pts: [number, number][]) => {
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, ay] = pts[k], [bx, by] = pts[k + 1];
      const ha = terrain.heightAt(ax, ay), hb = terrain.heightAt(bx, by);
      // bande d'herbe (0,6 m) puis terre
      const quad = (y1a: number, y1b: number, y2a: number, y2b: number, c1: THREE.Color, c2: THREE.Color) => {
        skirt.push(ax, y1a, -ay, bx, y1b, -by, bx, y2b, -by, ax, y1a, -ay, bx, y2b, -by, ax, y2a, -ay);
        for (const c of [c1, c1, c2, c1, c2, c2]) col.push(c.r, c.g, c.b);
      };
      quad(ha, hb, ha - 0.6, hb - 0.6, green, green);
      quad(ha - 0.6, hb - 0.6, SOIL_BOTTOM, SOIL_BOTTOM, top, bottom);
    }
  };
  const along = (fx: (s: number) => [number, number], len: number) => {
    const steps = Math.max(2, Math.ceil(len / (t?.step ?? len)));
    return Array.from({ length: steps + 1 }, (_, k) => fx(k / steps));
  };
  edge(along((s) => [b.minX + s * W, b.minY], W)); // sud
  edge(along((s) => [b.maxX, b.minY + s * D], D)); // est
  edge(along((s) => [b.maxX - s * W, b.maxY], W)); // nord
  edge(along((s) => [b.minX, b.maxY - s * D], D)); // ouest
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(skirt, 3));
  sg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  sg.computeVertexNormals();
  g.add(new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide })));

  // Fond fermé + plinthe en bois
  const cx = (b.minX + b.maxX) / 2, cz = -(b.minY + b.maxY) / 2;
  const bottomPlate = new THREE.Mesh(new THREE.BoxGeometry(W, 0.5, D), new THREE.MeshStandardMaterial({ color: PALETTE.soilBottom }));
  bottomPlate.position.set(cx, SOIL_BOTTOM - 0.25, cz);
  g.add(bottomPlate);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(W + 30, 12, D + 30), new THREE.MeshStandardMaterial({ color: PALETTE.plinth, roughness: 0.95 }));
  plinth.position.set(cx, SOIL_BOTTOM - 6, cz);
  g.add(plinth);
  return g;
}
