import * as THREE from 'three';
import type { Building, HeightFn, Place, PlacedPoi, Pt } from '../types';
import { PALETTE, placeCategory } from './palette';
import { pointInPoly } from './geo';

const GEM_HEIGHT = 42;

export interface PoiMarker {
  poi: PlacedPoi;
  group: THREE.Group;
  gem: THREE.Mesh;
  ring: THREE.Mesh;
  beam: THREE.Mesh;
  hit: THREE.Mesh;
  setFound(found: boolean): void;
}

/** Marqueurs des lieux d'histoire : gemme flottante + faisceau + anneau au sol. */
export function buildPoiMarkers(pois: PlacedPoi[], heightAt: HeightFn = () => 0): { root: THREE.Group; markers: PoiMarker[]; animate(t: number): void } {
  const root = new THREE.Group();
  root.name = 'pois';
  const gemGeo = new THREE.OctahedronGeometry(6, 0);
  gemGeo.scale(1, 1.5, 1);
  const ringGeo = new THREE.RingGeometry(9, 12, 32);
  ringGeo.rotateX(-Math.PI / 2);
  const beamGeo = new THREE.CylinderGeometry(0.6, 0.6, GEM_HEIGHT, 6, 1, true);
  beamGeo.translate(0, GEM_HEIGHT / 2, 0);
  const hitGeo = new THREE.CylinderGeometry(14, 14, GEM_HEIGHT + 14, 8);
  hitGeo.translate(0, (GEM_HEIGHT + 14) / 2, 0);

  const markers = pois.map((poi) => {
    const group = new THREE.Group();
    group.position.set(poi.position[0], heightAt(poi.position[0], poi.position[1]), -poi.position[1]);
    const gemMat = new THREE.MeshStandardMaterial({ color: PALETTE.poi, emissive: PALETTE.poi, emissiveIntensity: 0.45, roughness: 0.3, metalness: 0.2, flatShading: true });
    const gem = new THREE.Mesh(gemGeo, gemMat);
    gem.position.y = GEM_HEIGHT;
    gem.castShadow = false; // flotte : son ombre ne serait pas recalculée (ombres à la demande)
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: PALETTE.poi, transparent: true, opacity: 0.85, depthWrite: false }));
    ring.position.y = 0.4;
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: PALETTE.poi, transparent: true, opacity: 0.35, depthWrite: false }));
    const hit = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.poiId = poi.id;
    group.add(gem, ring, beam, hit);
    root.add(group);

    const setFound = (found: boolean) => {
      const col = new THREE.Color(found ? PALETTE.poiFound : PALETTE.poi);
      gemMat.color.copy(col);
      gemMat.emissive.copy(col);
      (ring.material as THREE.MeshBasicMaterial).color.copy(col);
      (beam.material as THREE.MeshBasicMaterial).color.copy(col);
    };
    return { poi, group, gem, ring, beam, hit, setFound };
  });

  const animate = (t: number) => {
    markers.forEach((m, i) => {
      m.gem.position.y = GEM_HEIGHT + Math.sin(t * 1.6 + i) * 2.2;
      m.gem.rotation.y = t * 0.8 + i;
      const pulse = 1 + ((t * 0.6 + i * 0.13) % 1) * 0.6;
      m.ring.scale.setScalar(pulse);
      (m.ring.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1.6 - pulse) / 0.6;
    });
  };
  return { root, markers, animate };
}

/** Texture de halo : disque au bord doux. */
function glowTexture(): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.25)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Mise en avant la nuit : bars et clubs brillent fort, restaurants moyennement, cafés à peine. */
const NIGHT_GLOW: Record<string, number> = { bar: 1.4, pub: 1.4, nightclub: 1.7, biergarten: 1.2, restaurant: 0.9, cafe: 0.45, ice_cream: 0.45 };

/** Couche des bars, cafés et restaurants (données OSM). */
export interface PlaceLayer {
  root: THREE.Group;
  places: Place[];
  /** Épingle mise en avant (survol ou sélection), ou null. */
  setActive(index: number | null): void;
  /** Point d'accroche de la fiche : la tête de l'épingle, en coordonnées monde. */
  anchor(index: number, out: THREE.Vector3): THREE.Vector3;
  /** Affiche / masque toutes les épingles (et halos) d'une catégorie (PLACE_CATEGORIES). */
  setCategoryVisible(category: string, visible: boolean): void;
  /**
   * Lieux éteints la nuit (itération 31) : true = fermé à l'heure choisie (ni lueur ni halo).
   * Un lieu aux horaires inconnus doit être passé à false (il reste allumé, comme avant).
   */
  setClosed(closed: boolean[]): void;
  animate(t: number): void;
}

const PIN_R = 3.2; // rayon de la tête
const PIN_H = 11; // hauteur du centre de la tête (la pointe est au sol)

/** Épingle « pointeur de carte » : goutte inversée, pointe au sol. */
function pinGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, 0)];
  const a0 = -Math.asin(PIN_R / PIN_H); // point où la pointe rejoint la tête (tangente)
  for (let k = 0; k <= 8; k++) {
    const a = a0 + ((Math.PI / 2 - a0) * k) / 8;
    pts.push(new THREE.Vector2(PIN_R * Math.cos(a) + 1e-4, PIN_H + PIN_R * Math.sin(a)));
  }
  return new THREE.LatheGeometry(pts, 14);
}

/**
 * Hauteur où poser chaque épingle : sur le toit du bâtiment qui contient le point OSM
 * (la plupart des bars sont au rez-de-chaussée d'un immeuble : posée au sol, l'épingle serait
 * cachée dans le bâtiment), sinon au sol.
 */
function standHeights(places: Place[], heightAt: HeightFn, buildings: Building[], minUnder?: (r: Pt[]) => number): number[] {
  const boxes = buildings.map((b) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of b.outer) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return { b, x0, x1, y0, y1 };
  });
  return places.map(({ pos: [x, y] }) => {
    const ground = heightAt(x, y);
    const hit = boxes.find((k) => x >= k.x0 && x <= k.x1 && y >= k.y0 && y <= k.y1 && pointInPoly(x, y, k.b));
    return hit ? (minUnder?.(hit.b.outer) ?? ground) + hit.b.h : ground;
  });
}

/** Bars, cafés, restaurants : épingles 3D, une couleur par catégorie (PLACE_CATEGORIES). */
export function buildPlaceMarkers(places: Place[], heightAt: HeightFn = () => 0, buildings: Building[] = [], minUnder?: (r: Pt[]) => number): PlaceLayer {
  const root = new THREE.Group();
  root.name = 'places';
  const noop = { root, places, setActive() {}, anchor: (_: number, out: THREE.Vector3) => out, setCategoryVisible() {}, setClosed() {}, animate() {} };
  if (!places.length) return noop;

  // La nuit, les épingles s'allument dans leur propre couleur (uGlow piloté par le cycle jour/nuit),
  // sauf les lieux fermés à cette heure (attribut aLit par épingle : 1 allumé, 0 éteint)
  const glowUniform = { value: 0 };
  const pinMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.05, flatShading: true });
  pinMat.onBeforeCompile = (shader) => {
    shader.uniforms.uGlow = glowUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aLit;\nvarying float vLit;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLit = aLit;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uGlow;\nvarying float vLit;')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance += vColor.rgb * uGlow * vLit;\n#endif',
      );
  };
  const pinGeo = pinGeometry();
  const litAttr = new THREE.InstancedBufferAttribute(new Float32Array(places.length).fill(1), 1);
  pinGeo.setAttribute('aLit', litAttr);
  const pins = new THREE.InstancedMesh(pinGeo, pinMat, places.length);
  pins.userData.glowUniform = glowUniform;
  pins.castShadow = false; // rebondit au survol : pas d'ombre (ombres recalculées à la demande)

  // Zone de clic plus large que l'épingle (invisible), plus facile à viser au doigt
  const hitGeo = new THREE.CylinderGeometry(5.5, 3, PIN_H + PIN_R + 2, 8);
  hitGeo.translate(0, (PIN_H + PIN_R + 2) / 2, 0);
  const hit = new THREE.InstancedMesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }), places.length);
  hit.userData.places = places;

  const stand = standHeights(places, heightAt, buildings, minUnder);
  const base: THREE.Vector3[] = [];
  const m = new THREE.Matrix4(), c = new THREE.Color(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  places.forEach((pl, i) => {
    const v = new THREE.Vector3(pl.pos[0], stand[i], -pl.pos[1]);
    base.push(v);
    m.makeTranslation(v.x, v.y, v.z);
    pins.setMatrixAt(i, m);
    hit.setMatrixAt(i, m);
    pins.setColorAt(i, c.set(placeCategory(pl.kind).color));
  });
  pins.computeBoundingSphere();
  hit.computeBoundingSphere();

  // Halos lumineux, visibles seulement la nuit (opacité pilotée par le cycle jour/nuit).
  // Trois paliers de taille : clubs/bars, restaurants, cafés.
  const halos = new THREE.Group();
  halos.name = 'placeHalos';
  halos.visible = false;
  const tex = glowTexture();
  const tiers = [
    { test: (g: number) => g >= 1.2, size: 90 },
    { test: (g: number) => g >= 0.8 && g < 1.2, size: 55 },
    { test: (g: number) => g < 0.8, size: 28 },
  ];
  const haloSets: { attr: THREE.BufferAttribute; ids: number[] }[] = [];
  for (const tier of tiers) {
    const ids = places.map((_, i) => i).filter((i) => tier.test(NIGHT_GLOW[places[i].kind] ?? 0.6));
    const sel = ids.map((i) => places[i]);
    if (!sel.length) continue;
    const pos = new Float32Array(sel.length * 3), col = new Float32Array(sel.length * 3);
    sel.forEach((pl, i) => {
      pos.set([pl.pos[0], stand[ids[i]] + PIN_H, -pl.pos[1]], i * 3);
      c.set(placeCategory(pl.kind).color);
      col.set([c.r, c.g, c.b], i * 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const colAttr = new THREE.BufferAttribute(col, 3);
    g.setAttribute('color', colAttr);
    haloSets.push({ attr: colAttr, ids });
    const mat = new THREE.PointsMaterial({
      size: tier.size, map: tex, vertexColors: true, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    halos.add(new THREE.Points(g, mat));
  }
  root.add(halos, pins, hit);

  // Épingle active : petit rebond puis reste grossie et soulevée
  let active: number | null = null, since = 0, now = 0;
  const hidden = new Set<string>(); // catégories masquées
  const isHidden = (i: number) => hidden.has(placeCategory(places[i].kind).id);
  let closed: boolean[] = [];
  // Halos : couleur noire = invisible (mélange additif) pour une catégorie masquée ou un lieu fermé
  const refreshHalos = () => {
    for (const { attr, ids } of haloSets) {
      ids.forEach((i, j) => {
        c.set(isHidden(i) || closed[i] ? '#000000' : placeCategory(places[i].kind).color);
        attr.setXYZ(j, c.r, c.g, c.b);
      });
      attr.needsUpdate = true;
    }
  };
  const place = (i: number, lift: number, scale: number) => {
    const k = isHidden(i) ? 0 : scale; // échelle 0 = épingle masquée (et plus cliquable)
    m.compose(p.copy(base[i]).setY(base[i].y + lift), q, s.setScalar(k));
    pins.setMatrixAt(i, m);
    pins.instanceMatrix.addUpdateRange(i * 16, 16); // seulement cette épingle, pas les 169
    pins.instanceMatrix.needsUpdate = true;
  };
  let settled = false; // rebond de l'épingle active terminé : plus rien à renvoyer à la carte graphique
  return {
    root,
    places,
    setActive(i) {
      if (i === active) return;
      if (active !== null) place(active, 0, 1);
      active = i;
      since = now;
      settled = false;
    },
    setCategoryVisible(category, visible) {
      if (visible) hidden.delete(category); else hidden.add(category);
      places.forEach((_, i) => {
        if (placeCategory(places[i].kind).id !== category) return;
        place(i, i === active ? 2 : 0, i === active ? 1.3 : 1);
        m.compose(p.copy(base[i]), q, s.setScalar(visible ? 1 : 0));
        hit.setMatrixAt(i, m);
      });
      hit.instanceMatrix.needsUpdate = true;
      refreshHalos();
    },
    setClosed(list) {
      closed = list;
      list.forEach((v, i) => litAttr.setX(i, v ? 0 : 1));
      litAttr.needsUpdate = true;
      refreshHalos();
    },
    anchor(i, out) {
      return out.copy(base[i]).setY(base[i].y + PIN_H + PIN_R + (i === active ? 3 : 0));
    },
    animate(t) {
      now = t;
      if (active === null || settled) return;
      const u = Math.min(1, (t - since) / 0.55);
      if (u >= 1) settled = true; // dernière pose, puis l'épingle ne bouge plus
      const bounce = Math.abs(Math.sin(u * Math.PI * 2)) * 4 * (1 - u); // deux rebonds qui s'amortissent
      place(active, 2 + bounce, 1 + 0.3 * Math.min(1, u * 3));
    },
  };
}
