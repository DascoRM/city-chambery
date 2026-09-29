import * as THREE from 'three';
import type { CityData, Pt } from '../../types';
import { skeletonRoofGeometry } from '../roofs';
import { alongWalls, walls } from './chateau';
import { glowAtNight, uplight } from './lighting';

/**
 * Carré Curial — version « formes simples » générée en code (itération 15).
 *
 * Reconstruit sur le contour OpenStreetMap (relation 51756 : quatre ailes autour d'une cour),
 * en coordonnées du diorama (pos [0, 0]).
 *
 * Ce qui vient de sources :
 *  - caserne construite de 1801 à 1805, organisée en carré autour d'une vaste cour d'exercice,
 *    plan qui reprend celui des Invalides ; réhabilitée à partir de 1980, inaugurée en 1993
 *    comme centre administratif, commercial et culturel (Wikipédia) ;
 *  - contour et cour : OpenStreetMap ; hauteur à la gouttière (16,7 m) et hauteur du toit (5,4 m) :
 *    IGN BD TOPO.
 * La médiathèque Jean-Jacques-Rousseau, accolée au nord (contour OSM séparé), est rendue avec les
 * mêmes matériaux : toit plat (BD TOPO : toit de 0,6 m), gouttière 18,3 m (BD TOPO).
 * Hypothèses (à vérifier) : nombre d'étages et rythme des fenêtres, portes au rez-de-chaussée,
 * couleur des façades et des toits, aspect de la médiathèque.
 */
const OSM_ID = 51756;
/** Médiathèque Jean-Jacques-Rousseau : bâtiment arrondi accolé au côté nord (OSM way 209429258). */
const MEDIATHEQUE_ID = 209429258;
const FLOOR = 3.8; // hauteur d'étage supposée

const facade = new THREE.MeshStandardMaterial({ color: '#e0d6bf', roughness: 0.9, flatShading: true });
const plinthMat = new THREE.MeshStandardMaterial({ color: '#c9bea6', roughness: 0.9, flatShading: true });
const roofMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true, side: THREE.DoubleSide });
const opening = new THREE.MeshStandardMaterial({ color: '#3a3430', roughness: 1 });
const flatRoof = new THREE.MeshStandardMaterial({ color: '#7a7d83', roughness: 0.9 });
const SLATE = new THREE.Color('#65686f');
let lit = false;

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

export function buildCarreCurial(ctx: { night: { value: number }; data?: CityData; minUnder?: (r: Pt[]) => number }): THREE.Group {
  const g = new THREE.Group();
  g.name = 'carre-curial';
  const b = ctx.data?.buildings.find((x) => x.id === OSM_ID);
  if (!b) {
    console.warn('[Carré Curial] contour OSM introuvable dans city.json');
    return g;
  }
  const ground = ctx.minUnder?.(b.outer) ?? 0;
  g.position.y = ground;
  if (!lit) {
    uplight(facade, ctx.night, 0.9, 26, ground);
    uplight(plinthMat, ctx.night, 0.9, 26, ground);
    uplight(roofMat, ctx.night, 0.35, 26, ground);
    uplight(flatRoof, ctx.night, 0.35, 26, ground);
    glowAtNight(opening, ctx.night, 0.5);
    lit = true;
  }

  const eave = b.eave ?? 16.7;
  const rise = b.roofH ?? 5.4;

  // Murs (le contour OSM avec sa cour) + soubassement légèrement plus foncé
  g.add(walls(b, eave, facade));
  g.add(alongWalls(b, 2.2, (x, y, ang) => {
    const s = mesh(new THREE.BoxGeometry(0.35, 1.2, 2.3), plinthMat);
    s.position.set(x + Math.cos(ang) * 0.15, 0.6, -(y + Math.sin(ang) * 0.15));
    s.rotation.y = ang;
    return s;
  }, 2, true));

  // Toit à pans autour de la cour (squelette droit), pente ajustée à la hauteur de toit BD TOPO
  if (b.skel) {
    const maxD = Math.max(0, ...b.skel.v.map((v) => v[2]));
    if (maxD > 0) {
      const roof = skeletonRoofGeometry(b, { eave, slope: rise / maxD }, SLATE);
      if (roof) g.add(mesh(roof, roofMat));
    }
  }

  // Corniche sous le toit
  g.add(alongWalls(b, 1.6, (x, y, ang) => {
    const c = mesh(new THREE.BoxGeometry(0.6, 0.45, 1.7), plinthMat);
    c.position.set(x + Math.cos(ang) * 0.25, eave - 0.25, -(y + Math.sin(ang) * 0.25));
    c.rotation.y = ang;
    return c;
  }, 2, true));

  // Fenêtres régulières (rythme de caserne), côté rue et côté cour ; portes hautes au rez-de-chaussée
  const floors = Math.max(2, Math.floor((eave - 1) / FLOOR));
  for (let f = 0; f < floors; f++) {
    const y = 1.2 + f * FLOOR + (f === 0 ? 0 : 0.6);
    const h = f === 0 ? 2.8 : 2.1;
    g.add(alongWalls(b, 4, (x, yy, ang) => {
      const w = mesh(new THREE.BoxGeometry(0.25, h, f === 0 ? 1.6 : 1.2), opening);
      w.position.set(x + Math.cos(ang) * 0.08, y + h / 2, -(yy + Math.sin(ang) * 0.08));
      w.rotation.y = ang;
      return w;
    }, 5, true));
  }
  // Médiathèque accolée (arrondie) : mêmes matériaux, toit plat, grandes baies
  const m = ctx.data?.buildings.find((x) => x.id === MEDIATHEQUE_ID);
  if (m) {
    const mg = new THREE.Group();
    mg.position.y = (ctx.minUnder?.(m.outer) ?? 0) - ground; // relatif au groupe du Carré
    const mh = m.eave ?? m.h;
    const shape = new THREE.Shape(m.outer.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const hole of m.holes) shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: mh, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    const body = new THREE.Mesh(geo, [flatRoof, facade]); // dessus = toit plat, côtés = façade
    body.castShadow = body.receiveShadow = true;
    mg.add(body);
    mg.add(alongWalls(m, 1.6, (x, y, ang) => {
      const c = mesh(new THREE.BoxGeometry(0.6, 0.45, 1.7), plinthMat);
      c.position.set(x + Math.cos(ang) * 0.25, mh - 0.25, -(y + Math.sin(ang) * 0.25));
      c.rotation.y = ang;
      return c;
    }, 1));
    for (let f = 0; f < Math.max(2, Math.floor((mh - 1) / FLOOR)); f++) {
      mg.add(alongWalls(m, 3.2, (x, yy, ang) => {
        const w = mesh(new THREE.BoxGeometry(0.25, 2.4, 2.2), opening);
        w.position.set(x + Math.cos(ang) * 0.08, 1.4 + f * FLOOR + 1.2, -(yy + Math.sin(ang) * 0.08));
        w.rotation.y = ang;
        return w;
      }, 2.5));
    }
    g.add(mg);
  }
  return g;
}
