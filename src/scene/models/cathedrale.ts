import * as THREE from 'three';
import type { CityData, Pt } from '../../types';
import { glowAtNight, uplight } from './lighting';

/**
 * Cathédrale Saint-François-de-Sales — version « formes simples » générée en code (itération 11).
 *
 * Construite directement sur le contour OpenStreetMap du bâtiment (way 26543906), en coordonnées
 * du diorama (le modèle se place donc avec pos [0, 0]).
 *
 * Ce qui vient de sources :
 *  - emprise au sol : OpenStreetMap ;
 *  - nef centrale « assez élevée (23 m sous voûtes) » flanquée de bas-côtés, pas de transept,
 *    chapelles polygonales au sud, abside bordée de chapelles, clocher côté nord
 *    (salle du Trésor à sa base), façade gothique flamboyante de 1522 en molasse (Wikipédia) ;
 *  - façade côté sud-ouest : c'est le côté de la place Métropole dans OpenStreetMap.
 * Hypothèses (à vérifier sur place) : emplacement et hauteur du clocher, forme de son toit,
 * largeur de la nef, hauteur des bas-côtés, couleur des toits, détails de la façade.
 */

const OSM_ID = 26543906;
const NAVE_WALL = 25; // 23 m sous voûtes + épaisseur des voûtes
const NAVE_HALF_W = 6.5;
const AISLE_H = 13;
const TOWER_SIZE = 7.5;
const TOWER_H = 38; // hypothèse
const PLACE_METROPOLE: Pt = [140, -88]; // repère OSM (Place Métropole) pour orienter la façade

const molasse = new THREE.MeshStandardMaterial({ color: '#d9d0b4', roughness: 0.9, flatShading: true });
const molasseDark = new THREE.MeshStandardMaterial({ color: '#bfb597', roughness: 0.9, flatShading: true });
const slate = new THREE.MeshStandardMaterial({ color: '#6d7077', roughness: 0.8, flatShading: true, side: THREE.DoubleSide });
const opening = new THREE.MeshStandardMaterial({ color: '#3a3430', roughness: 1 });

// ---------------------------------------------------------------------------
// Éclairage de nuit (même principe que la fontaine : lumière simulée dans les matériaux)
// ---------------------------------------------------------------------------
let lit = false;

// ---------------------------------------------------------------------------
// Géométrie
// ---------------------------------------------------------------------------
export interface Frame { cx: number; cy: number; ux: number; uy: number; a: number; b: number }

/** Rectangle orienté minimal (repère de la cathédrale : u = axe de la nef). */
export function frameOf(pts: Pt[]): Frame {
  let best: Frame & { area: number } = { cx: 0, cy: 0, ux: 1, uy: 0, a: 0, b: 0, area: Infinity };
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 3) continue; // ignore les petits décrochements (contreforts)
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    let s0 = Infinity, s1 = -Infinity, t0 = Infinity, t1 = -Infinity;
    for (const [x, y] of pts) {
      const s = x * ux + y * uy, t = -x * uy + y * ux;
      s0 = Math.min(s0, s); s1 = Math.max(s1, s); t0 = Math.min(t0, t); t1 = Math.max(t1, t);
    }
    const area = (s1 - s0) * (t1 - t0);
    if (area < best.area) {
      const sc = (s0 + s1) / 2, tc = (t0 + t1) / 2;
      let a = (s1 - s0) / 2, b = (t1 - t0) / 2, fx = ux, fy = uy;
      if (b > a) { [a, b] = [b, a]; [fx, fy] = [-uy, ux]; }
      best = { cx: sc * ux - tc * uy, cy: sc * uy + tc * ux, ux: fx, uy: fy, a, b, area };
    }
  }
  return best;
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

export function buildCathedrale(ctx: { night: { value: number }; data?: CityData }): THREE.Group {
  const g = new THREE.Group();
  g.name = 'cathedrale-saint-francois-de-sales';
  const b = ctx.data?.buildings.find((x) => x.id === OSM_ID);
  if (!b) {
    console.warn('[cathédrale] contour OSM introuvable dans city.json');
    return g;
  }
  // Relief : la cathédrale est posée sur le point le plus bas du terrain sous son emprise
  const ground = (ctx as { minUnder?: (r: Pt[]) => number }).minUnder?.(b.outer) ?? 0;
  g.position.y = ground;
  if (!lit) {
    uplight(molasse, ctx.night, 1.0, 40, ground);
    uplight(molasseDark, ctx.night, 1.0, 40, ground);
    uplight(slate, ctx.night, 0.5, 40, ground);
    glowAtNight(opening, ctx.night, 0.6); // baies éclairées de l'intérieur
    lit = true;
  }

  // Repère : s le long de la nef (façade à s = -a), t en travers ; façade côté place Métropole
  const f = frameOf(b.outer);
  const toS = (x: number, y: number) => (x - f.cx) * f.ux + (y - f.cy) * f.uy;
  if (toS(...PLACE_METROPOLE) > 0) { f.ux = -f.ux; f.uy = -f.uy; }
  const W = (s: number, t: number, y: number) => new THREE.Vector3(f.cx + f.ux * s - f.uy * t, y, -(f.cy + f.uy * s + f.ux * t));
  const place = (m: THREE.Object3D, s: number, t: number, y: number) => {
    m.position.copy(W(s, t, y));
    m.rotation.y = Math.atan2(f.uy, f.ux); // l'axe X local suit la nef
    return m;
  };

  // 1. Bas-côtés et chapelles : le contour OSM réel, extrudé
  const shape = new THREE.Shape(b.outer.map(([x, y]) => new THREE.Vector2(x, y)));
  const low = new THREE.ExtrudeGeometry(shape, { depth: AISLE_H, bevelEnabled: false });
  low.rotateX(-Math.PI / 2);
  const lowMesh = new THREE.Mesh(low, [slate, molasse]); // dessus = toit (ardoise), côtés = murs
  lowMesh.castShadow = lowMesh.receiveShadow = true;
  g.add(lowMesh);

  // 2. Toits en appentis des bas-côtés (de la nef vers l'extérieur)
  const apseR = NAVE_HALF_W + 1;
  const s0 = -f.a + 0.6, s1 = f.a - apseR - 1;
  const outerT = f.b - 2.5;
  for (const side of [-1, 1]) {
    const pts = [
      W(s0, side * NAVE_HALF_W, NAVE_WALL - 5), W(s1, side * NAVE_HALF_W, NAVE_WALL - 5),
      W(s1, side * outerT, AISLE_H), W(s0, side * outerT, AISLE_H),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints([pts[0], pts[1], pts[2], pts[0], pts[2], pts[3]]);
    geo.computeVertexNormals();
    g.add(mesh(geo, slate));
  }

  // 3. Nef centrale (murs hauts) + toit à deux pans
  const naveLen = s1 - s0;
  const nave = place(mesh(new THREE.BoxGeometry(naveLen, NAVE_WALL, NAVE_HALF_W * 2), molasse), (s0 + s1) / 2, 0, NAVE_WALL / 2);
  g.add(nave);
  const ridge = NAVE_WALL + NAVE_HALF_W * 1.1;
  const roofPts = [
    W(s0, -NAVE_HALF_W - 0.4, NAVE_WALL), W(s1, -NAVE_HALF_W - 0.4, NAVE_WALL), W(s1, 0, ridge), W(s0, 0, ridge),
    W(s0, NAVE_HALF_W + 0.4, NAVE_WALL), W(s1, NAVE_HALF_W + 0.4, NAVE_WALL),
  ];
  const roofGeo = new THREE.BufferGeometry().setFromPoints([
    roofPts[0], roofPts[1], roofPts[2], roofPts[0], roofPts[2], roofPts[3],
    roofPts[4], roofPts[3], roofPts[2], roofPts[4], roofPts[2], roofPts[5],
  ]);
  roofGeo.computeVertexNormals();
  g.add(mesh(roofGeo, slate));

  // 4. Contreforts le long de la nef
  for (let s = s0 + 5; s < s1 - 2; s += 7) {
    for (const side of [-1, 1]) {
      g.add(place(mesh(new THREE.BoxGeometry(1.2, NAVE_WALL - AISLE_H + 2, 2.2), molasseDark), s, side * (NAVE_HALF_W + 1), AISLE_H + (NAVE_WALL - AISLE_H) / 2 - 1));
    }
  }

  // 5. Abside polygonale (chevet) avec toit en demi-cône
  const apse = new THREE.CylinderGeometry(apseR, apseR, NAVE_WALL, 7, 1, false, 0, Math.PI);
  g.add(place(mesh(apse, molasse), s1, 0, NAVE_WALL / 2)); // demi-cylindre tourné vers le chevet (+s)
  const apseRoof = new THREE.ConeGeometry(apseR + 0.4, ridge - NAVE_WALL, 7, 1, true, 0, Math.PI);
  g.add(place(mesh(apseRoof, slate), s1, 0, NAVE_WALL + (ridge - NAVE_WALL) / 2));

  // 6. Façade (pignon) côté place Métropole, avec portail, grande baie et pinacles
  const facadeS = -f.a + 0.4;
  const fw = NAVE_HALF_W * 2 + 3;
  const gable = new THREE.Shape([
    new THREE.Vector2(-fw / 2, 0), new THREE.Vector2(fw / 2, 0), new THREE.Vector2(fw / 2, NAVE_WALL + 1),
    new THREE.Vector2(0, ridge + 2.5), new THREE.Vector2(-fw / 2, NAVE_WALL + 1),
  ]);
  const gableGeo = new THREE.ExtrudeGeometry(gable, { depth: 1.6, bevelEnabled: false });
  gableGeo.translate(0, 0, -0.8);
  const gableMesh = place(mesh(gableGeo, molasse), facadeS, 0, 0);
  gableMesh.rotation.y += Math.PI / 2; // le plan du pignon est perpendiculaire à la nef
  g.add(gableMesh);
  const arch = (w: number, h: number) =>
    new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(w / 2, h - w * 0.6), new THREE.Vector2(0, h), new THREE.Vector2(-w / 2, h - w * 0.6)]);
  const portal = mesh(new THREE.ExtrudeGeometry(arch(4.2, 7.5), { depth: 0.3, bevelEnabled: false }), opening);
  g.add(place(portal, facadeS - 0.95, 0, 0)).children.at(-1)!.rotation.y += -Math.PI / 2;
  const win = mesh(new THREE.ExtrudeGeometry(arch(3.4, 8.5), { depth: 0.3, bevelEnabled: false }), opening);
  g.add(place(win, facadeS - 0.95, 0, 10.5)).children.at(-1)!.rotation.y += -Math.PI / 2;
  for (const side of [-1, 1]) {
    g.add(place(mesh(new THREE.BoxGeometry(1.6, NAVE_WALL + 2, 1.6), molasseDark), facadeS, side * (fw / 2), (NAVE_WALL + 2) / 2));
    g.add(place(mesh(new THREE.ConeGeometry(0.9, 3.5, 4), molasseDark), facadeS, side * (fw / 2), NAVE_WALL + 2 + 1.75));
  }

  // 7. Clocher côté nord (hypothèse : vers le chevet, là où le contour OSM fait saillie)
  const towerS = f.a - apseR - TOWER_SIZE * 0.9;
  const towerT = f.b - TOWER_SIZE / 2 - 0.5;
  // côté nord = côté dont la normale pointe vers le nord (y OSM croissant)
  const northSign = f.ux >= 0 ? 1 : -1;
  const tt = northSign * towerT;
  g.add(place(mesh(new THREE.BoxGeometry(TOWER_SIZE, TOWER_H, TOWER_SIZE), molasse), towerS, tt, TOWER_H / 2));
  g.add(place(mesh(new THREE.BoxGeometry(TOWER_SIZE + 0.8, 0.8, TOWER_SIZE + 0.8), molasseDark), towerS, tt, TOWER_H));
  for (let k = 0; k < 4; k++) {
    // baies du beffroi
    const bay = mesh(new THREE.BoxGeometry(0.3, 4.5, 2.2), opening);
    const ang = (k * Math.PI) / 2;
    const off = TOWER_SIZE / 2 + 0.05;
    const w = W(towerS + Math.cos(ang) * off, tt + Math.sin(ang) * off, TOWER_H - 4);
    bay.position.copy(w);
    bay.rotation.y = Math.atan2(f.uy, f.ux) + ang;
    g.add(bay);
  }
  const spire = mesh(new THREE.ConeGeometry((TOWER_SIZE + 0.8) * 0.71, 7, 4), slate);
  place(spire, towerS, tt, TOWER_H + 0.4 + 3.5);
  spire.rotation.y += Math.PI / 4;
  g.add(spire);

  return g;
}
