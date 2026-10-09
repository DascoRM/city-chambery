import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CityData, HeightFn, Place, Ticker } from '../types';
import { buildWalkways, largeComponents, type Edge, type Walkways, type WalkwayOptions } from './walkways';
import { blobShadow } from './mascot';
import { placeCategory } from './palette';
import { curveAt } from './curve';

/**
 * Passants (EP001-US001) : petites silhouettes qui marchent sur les voies OSM, comme les éléphants mais sur
 * leur propre réseau (toutes les voies sauf les escaliers, à 1 m des façades). Décor sans interaction :
 * ni cliquables ni liés au jeu.
 *
 * Foule autour du point regardé : tous les passants sont dans un rayon de `radius` m autour de la cible de la
 * caméra (sur toute la carte, 300 passants feraient un passant tous les 200 m). Un passant qui sort du rayon
 * réapparaît sur une voie à l'intérieur, hors du champ de la caméra quand c'est possible.
 *
 * Le monde suit l'heure (EP001-US002) :
 *  - la foule des rues suit une courbe horaire (`dayCurve`, part du maximum) : dense à midi, presque vide la nuit.
 *    Les arrivées et départs se font hors du champ de la caméra : un passant en trop continue de marcher et disparaît
 *    quand il sort de l'écran (ou, s'il reste à l'écran plus de 15 s, s'efface en fondu) ; un nouveau naît hors champ
 *    quand c'est possible, sinon grandit en fondu ;
 *  - de 20 h à 3 h (`groups`), de petits groupes (2 à 5) se tiennent devant les bars, pubs, boîtes de nuit (et plus
 *    rarement restaurants, cafés) **ouverts** d'après leurs horaires (OSM ou provisoires) ; à la fermeture, le groupe
 *    s'éloigne à pied et disparaît hors champ ; décocher une catégorie dans la légende fait disparaître leurs groupes.
 *
 * Rendu : 3 maillages instanciés pour tous les passants (corps, tête, ombre « tache »). Les jambes se balancent
 * dans le shader (attribut par passant) ; le reste est replacé à chaque image. La carte reste à 30 images/s
 * au repos : la marche est lente, elle ne demande pas la pleine vitesse (moving() n'est pas défini).
 */
export interface PeopleConfig {
  max: number;
  mobileFactor: number;
  /** Rayon (m) autour du point regardé où se tiennent les passants */
  radius: number;
  scale: number;
  speed: [number, number];
  /** Probabilité de faire une pause en arrivant à un carrefour, et durée des pauses (s) */
  pauseChance: number;
  pauseSeconds: [number, number];
  /** Une partie du réseau doit avoir au moins ce nombre de nœuds pour avoir des passants (les îlots minuscules sont ignorés) */
  minComponent: number;
  network: WalkwayOptions;
  /** Part du maximum de passants selon l'heure : points [heure, part 0-1], interpolés (la courbe boucle sur 24 h) */
  dayCurve: [number, number][];
  groups: {
    /** Plage horaire des groupes (heure de début, heure de fin, peut passer minuit) et durée (h) de la montée et de la descente */
    from: number; to: number; ramp: number;
    /** Nombre maximal de groupes (×mobileFactor sur téléphone) et taille d'un groupe [min, max] */
    max: number; size: [number, number];
    /** Distance maximale (m) entre l'épingle du lieu et la voie où le groupe se tient */
    maxStandDistance: number;
    /** Poids par type de lieu (OSM) ; un type absent n'a jamais de groupe (glaciers) */
    weights: Record<string, number>;
  };
}

/** Hauteur de la hanche (m), pivot des jambes ; la silhouette mesure 1,7 m à l'échelle 1 */
export const HIP = 0.82;
/** Couleurs de vêtements, dans les tons du diorama ; peaux */
const CLOTHES = ['#c8553d', '#2f6690', '#f2a541', '#5b8e7d', '#8e5bd6', '#e07a5f', '#3d405b', '#81b29a', '#d4a373', '#6d597a', '#457b9d', '#e9c46a'];
const SKIN = ['#f1c9a5', '#e0ac85', '#c68863', '#8d5a3b', '#f6dcc5'];

/** Silhouette : deux jambes et un torse (une seule géométrie, jambes marquées par l'attribut aLeg) ; +X = avant */
export function bodyGeometry(): THREE.BufferGeometry {
  const part = (g: THREE.BufferGeometry, leg: number) => {
    const n = g.getAttribute('position').count;
    g.setAttribute('aLeg', new THREE.BufferAttribute(new Float32Array(n).fill(leg), 1));
    const shade = leg !== 0 ? 0.55 : 1; // pantalon plus sombre que le haut
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(shade), 3));
    g.deleteAttribute('uv');
    return g;
  };
  const legL = part(new THREE.BoxGeometry(0.16, HIP, 0.15).translate(0, HIP / 2, 0.1), 1);
  const legR = part(new THREE.BoxGeometry(0.16, HIP, 0.15).translate(0, HIP / 2, -0.1), -1);
  const torso = part(new THREE.CylinderGeometry(0.19, 0.24, 0.62, 7).translate(0, HIP + 0.31, 0), 0);
  return mergeGeometries([legL, legR, torso])!;
}

export function headGeometry(): THREE.BufferGeometry {
  return new THREE.IcosahedronGeometry(0.13, 0).translate(0.02, HIP + 0.62 + 0.15, 0);
}

const OFF = 0, WALK = 1, STAND = 2, LEAVE = 3, FADE = 4;
const GROUP_MAX_SIZE = 5;

interface Walker {
  state: number;
  /** Échelle d'apparition (0 → 1) : fondu à l'arrivée ou au départ forcé */
  grow: number;
  from: number;
  edge: Edge;
  s: number;
  speed: number;
  pause: number;
  phase: number;
  heading: number;
  /** Décalage (m) par rapport au point de la voie : la place dans un groupe, qui s'efface quand il part */
  ox: number;
  oy: number;
  /** Cap tenu pendant l'attente, et temps passé en départ (s) */
  stand: number;
  leaving: number;
}

/** Point de la voie le plus proche d'un lieu : où se tient son groupe, et de quoi repartir à pied dans les deux sens */
interface Stand { a: number; b: number; ab: Edge; ba: Edge; t: number; x: number; y: number; toward: number; dist: number }

export interface People extends Ticker {
  group: THREE.Group;
  /** Nombre de passants des rues (maximum) */
  count: number;
  nodes: number;
  /** Part du maximum de passants à cette heure, et nombre de groupes visés */
  density(hour: number): number;
  /** Lieux ouverts à l'heure de l'horloge (même ordre que data.places) : appelé à chaque changement de minute */
  setOpen(open: boolean[]): void;
  /** Légende : masque ou affiche les groupes d'une catégorie (bar, cafe, restaurant) */
  setCategoryVisible(category: string, visible: boolean): void;
  stats(): { street: number; standing: number; leaving: number; fading: number; groups: number };
}

export interface PeopleView {
  camera: THREE.Camera;
  /** Point regardé (coordonnées Three.js) */
  focus(): THREE.Vector3;
  /** Heure de l'horloge du diorama (0 à 24) */
  hour(): number;
}

/** Hasard stable par indice (même lieu, même tirage à chaque chargement) */
const stable = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** `shared` : réseau déjà construit avec `cfg.network` (partagé avec l'avatar, EP005), sinon construit ici */
export function buildPeople(cfg: PeopleConfig, data: CityData, heightAt: HeightFn, view: PeopleView, shared?: Walkways): People | null {
  const g = shared ?? buildWalkways(data, cfg.network);
  const mainSet = largeComponents(g, cfg.minComponent);
  const main = [...mainSet];
  if (!main.length) return null;
  const mobile = typeof matchMedia === 'function' && (matchMedia('(pointer: coarse)').matches || innerWidth < 700);
  const factor = mobile ? cfg.mobileFactor : 1;
  const count = Math.max(0, Math.round(cfg.max * factor));
  const slots = Math.max(0, Math.round(cfg.groups.max * factor));
  const total = count + slots * GROUP_MAX_SIZE;
  const group = new THREE.Group();
  group.name = 'people';
  const empty: People = {
    group, count, nodes: main.length, update() {}, density: () => 0, setOpen() {}, setCategoryVisible() {},
    stats: () => ({ street: 0, standing: 0, leaving: 0, fading: 0, groups: 0 }),
  };
  if (!total) return empty;

  // --- Maillages -------------------------------------------------------------
  const swing = new THREE.InstancedBufferAttribute(new Float32Array(total), 1); // angle des jambes par passant
  const bodyGeo = bodyGeometry();
  bodyGeo.setAttribute('aSwing', swing);
  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
  bodyMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aLeg;\nattribute float aSwing;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        if (aLeg != 0.0) {
          // Jambe : rotation autour de la hanche (axe Z), en opposition d'une jambe à l'autre
          float a = aSwing * aLeg;
          vec2 r = transformed.xy - vec2(0.0, ${HIP.toFixed(2)});
          transformed.xy = vec2(0.0, ${HIP.toFixed(2)}) + vec2(r.x * cos(a) - r.y * sin(a), r.x * sin(a) + r.y * cos(a));
        }`);
  };
  bodyMat.customProgramCacheKey = () => 'people-body';
  const body = new THREE.InstancedMesh(bodyGeo, bodyMat, total);
  const head = new THREE.InstancedMesh(headGeometry(), new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.8 }), total);
  const blob = blobShadow();
  const shadow = new THREE.InstancedMesh(blob.geometry, blob.material as THREE.Material, total);
  shadow.renderOrder = 1;
  for (const m of [body, head, shadow]) {
    m.frustumCulled = false; // ils bougent : la sphère englobante serait fausse
    m.castShadow = false;
    m.receiveShadow = m !== shadow;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(m);
  }
  body.name = 'people-body'; head.name = 'people-head'; shadow.name = 'people-shadow';
  const color = new THREE.Color();

  // --- Réseau ------------------------------------------------------------------
  const rnd = (r: [number, number]) => r[0] + Math.random() * (r[1] - r[0]);
  const pickNext = (prev: number, at: number): Edge => {
    const opts = g.adj[at].filter((e) => mainSet.has(e.to));
    const forward = opts.filter((e) => e.to !== prev);
    const list = forward.length ? forward : opts; // impasse : demi-tour
    if (prev < 0) return list[Math.floor(Math.random() * list.length)];
    const dirIn = Math.atan2(g.y[at] - g.y[prev], g.x[at] - g.x[prev]);
    const weights = list.map((e) => {
      const dir = Math.atan2(g.y[e.to] - g.y[at], g.x[e.to] - g.x[at]);
      const straight = (1 + Math.cos(dir - dirIn)) / 2;
      return e.w * (0.1 + straight * straight);
    });
    let r = Math.random() * weights.reduce((a, c) => a + c, 0);
    for (let i = 0; i < list.length; i++) if ((r -= weights[i]) <= 0) return list[i];
    return list[list.length - 1];
  };
  // Nœuds dans le rayon autour du point regardé (recalculés quand le point bouge de plus de 20 m)
  let near: number[] = main;
  const lastFocus = new THREE.Vector3(Infinity, 0, Infinity);
  const refreshNear = () => {
    const f = view.focus();
    if (Math.hypot(f.x - lastFocus.x, f.z - lastFocus.z) < 20) return false;
    const jumped = Math.hypot(f.x - lastFocus.x, f.z - lastFocus.z) > cfg.radius;
    lastFocus.copy(f);
    const r2 = cfg.radius * cfg.radius;
    near = main.filter((n) => (g.x[n] - f.x) ** 2 + (g.y[n] + f.z) ** 2 < r2);
    if (!near.length) near = main;
    return jumped;
  };
  refreshNear();
  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), probe = new THREE.Vector3();
  const visible = (x: number, y: number) => frustum.containsPoint(probe.set(x, heightAt(x, y) + 1, -y));
  /** Nœud au hasard dans le rayon, hors du champ de la caméra si possible */
  const spawnNode = (allowVisible: boolean) => {
    let n = near[Math.floor(Math.random() * near.length)];
    if (allowVisible) return n;
    for (let k = 0; k < 12; k++) {
      if (!visible(g.x[n], g.y[n])) return n;
      n = near[Math.floor(Math.random() * near.length)];
    }
    return n;
  };

  // --- Lieux où se tiennent les groupes : point de la voie le plus proche de chaque épingle ----------
  const places: Place[] = data.places;
  const stands: (Stand | null)[] = places.map(() => null);
  const weightOf = places.map((pl) => cfg.groups.weights[pl.kind] ?? 0);
  const catOf = places.map((pl) => placeCategory(pl.kind).id);
  if (slots) {
    const edgeTo = (a: number, b: number) => g.adj[a].find((e) => e.to === b)!;
    places.forEach((pl, i) => {
      if (weightOf[i] <= 0) return;
      const [px, py] = pl.pos;
      let best: Stand | null = null;
      for (const a of main) {
        for (const e of g.adj[a]) {
          const b = e.to;
          if (b < a || !mainSet.has(b)) continue; // chaque tronçon une seule fois
          const dx = g.x[b] - g.x[a], dy = g.y[b] - g.y[a];
          const len2 = dx * dx + dy * dy || 1;
          const t = Math.max(0, Math.min(1, ((px - g.x[a]) * dx + (py - g.y[a]) * dy) / len2));
          const x = g.x[a] + dx * t, y = g.y[a] + dy * t, d = Math.hypot(px - x, py - y);
          if (d <= cfg.groups.maxStandDistance && (!best || d < best.dist)) best = { a, b, ab: e, ba: edgeTo(b, a), t, x, y, toward: Math.atan2(py - y, px - x), dist: d };
        }
      }
      stands[i] = best;
    });
  }
  const openFlag: boolean[] = places.map(() => false);
  const catVisible: Record<string, boolean> = {};
  interface Slot { place: number; size: number; first: number }
  const slotList: Slot[] = Array.from({ length: slots }, (_, k) => ({ place: -1, size: 0, first: count + k * GROUP_MAX_SIZE }));

  // --- Passants ------------------------------------------------------------------
  const walkers: Walker[] = [];
  for (let i = 0; i < total; i++) {
    const from = near[Math.floor(Math.random() * near.length)];
    const edge = pickNext(-1, from);
    walkers.push({ state: OFF, grow: 0, from, edge, s: Math.random() * edge.len, speed: rnd(cfg.speed), pause: 0, phase: Math.random(), heading: Math.atan2(g.y[edge.to] - g.y[from], g.x[edge.to] - g.x[from]), ox: 0, oy: 0, stand: 0, leaving: 0 });
    body.setColorAt(i, color.set(CLOTHES[Math.floor(Math.random() * CLOTHES.length)]));
    head.setColorAt(i, color.set(SKIN[Math.floor(Math.random() * SKIN.length)]));
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const shadowScale = new THREE.Vector3(0.9 * cfg.scale, 1, 0.6 * cfg.scale);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const STRIDE = 1.3; // distance (m) d'un cycle de pas
  const FADE_S = 0.6; // durée (s) d'un fondu

  /** Éteint un passant : plus dessiné, plus mis à jour */
  const turnOff = (i: number) => {
    walkers[i].state = OFF;
    walkers[i].grow = 0;
    body.setMatrixAt(i, zero); head.setMatrixAt(i, zero); shadow.setMatrixAt(i, zero);
  };
  /** Place un passant des rues sur un nœud et le fait naître (fondu) ; hors du champ si possible */
  const spawnStreet = (i: number, allowVisible: boolean, instant = false) => {
    const w = walkers[i];
    w.state = WALK;
    w.grow = instant ? 1 : 0;
    w.from = spawnNode(allowVisible);
    w.edge = pickNext(-1, w.from);
    w.s = Math.random() * w.edge.len;
    w.ox = w.oy = 0;
    w.pause = 0;
    w.heading = Math.atan2(g.y[w.edge.to] - g.y[w.from], g.x[w.edge.to] - g.x[w.from]);
  };
  const standPos = (st: Stand) => ({ x: st.x, y: st.y });

  // --- Foule des rues, groupes, selon l'heure (deux fois par seconde) -----------------------------
  const groupRamp = (h: number) => {
    const { from, to, ramp } = cfg.groups;
    const len = ((to - from) % 24 + 24) % 24 || 24;
    const u = (((h - from) % 24) + 24) % 24;
    if (u > len) return 0;
    return Math.max(0, Math.min(1, u / ramp, (len - u) / ramp));
  };
  const groupCount = () => slotList.filter((s) => s.place >= 0).length;

  /** Un groupe s'en va : à pied par la voie où il se tenait (reason « leave »), ou en fondu (légende décochée) */
  const dismiss = (s: Slot, fade: boolean) => {
    const st = stands[s.place]!;
    for (let k = 0; k < s.size; k++) {
      const w = walkers[s.first + k];
      if (w.state !== STAND && w.state !== WALK) continue;
      if (fade || w.grow < 1) { w.state = FADE; continue; }
      const reverse = Math.random() < 0.5;
      w.state = LEAVE;
      w.leaving = 0;
      w.pause = 0;
      w.from = reverse ? st.b : st.a;
      w.edge = reverse ? st.ba : st.ab;
      w.s = (reverse ? 1 - st.t : st.t) * w.edge.len;
    }
    s.place = -1;
    s.size = 0;
  };
  /** Un groupe se forme devant un lieu : 2 à 5 silhouettes en arc, tournées vers l'entrée, qui apparaissent en fondu */
  const form = (s: Slot, place: number) => {
    const st = stands[place]!;
    const [lo, hi] = cfg.groups.size;
    s.place = place;
    s.size = Math.min(GROUP_MAX_SIZE, lo + Math.floor(stable(place * 3 + 1) * (hi - lo + 1)));
    const { x, y } = standPos(st);
    for (let k = 0; k < s.size; k++) {
      const w = walkers[s.first + k];
      const lateral = (k - (s.size - 1) / 2) * 0.6 + (Math.random() - 0.5) * 0.25, forward = (Math.random() - 0.5) * 0.5;
      const c = Math.cos(st.toward), sn = Math.sin(st.toward);
      w.state = STAND;
      w.grow = 0;
      w.from = st.a; w.edge = st.ab; w.s = st.t * st.ab.len;
      w.ox = x + c * forward - sn * lateral - (g.x[st.a] + (g.x[st.b] - g.x[st.a]) * st.t);
      w.oy = y + sn * forward + c * lateral - (g.y[st.a] + (g.y[st.b] - g.y[st.a]) * st.t);
      w.stand = st.toward + (Math.random() - 0.5) * 0.9;
      w.heading = w.stand;
      w.phase = Math.random() * 6.28;
    }
  };

  let check = 0;
  const hourCheck = () => {
    const h = view.hour();
    const jumped = refreshNear(); // la caméra a sauté loin (vol vers un lieu) : on peut apparaître à l'écran
    view.camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(pv.multiplyMatrices(view.camera.projectionMatrix, view.camera.matrixWorldInverse));
    const r2 = (cfg.radius + 20) ** 2;
    const outside = (n: number) => (g.x[n] - lastFocus.x) ** 2 + (g.y[n] + lastFocus.z) ** 2 >= r2;

    // 1. Sortis du rayon : les passants des rues réapparaissent dedans, ceux qui partent s'effacent
    for (let i = 0; i < total; i++) {
      const w = walkers[i];
      if (w.state === WALK && i < count && outside(w.from)) spawnStreet(i, jumped);
      else if (w.state === LEAVE) {
        w.leaving += 0.5;
        // Un passant qui part s'éteint dès qu'il est hors champ ; resté à l'écran 15 s, il s'efface en fondu
        const x = g.x[w.from], y = g.y[w.from];
        if (!visible(x, y) || outside(w.from)) turnOff(i);
        else if (w.leaving > 15) w.state = FADE;
      }
    }

    // 2. Foule des rues : part du maximum selon l'heure, naissances et départs étalés sur quelques secondes
    const target = Math.round(count * curveAt(cfg.dayCurve, h));
    let active = 0;
    for (let i = 0; i < count; i++) if (walkers[i].state === WALK) active++;
    const step = Math.max(2, Math.ceil(count / 12));
    if (active < target) {
      let n = Math.min(step, target - active);
      for (let i = 0; i < count && n > 0; i++) if (walkers[i].state === OFF) { spawnStreet(i, jumped); n--; }
    } else if (active > target) {
      let n = Math.min(step, active - target);
      for (let k = 0; k < 4 * count && n > 0; k++) {
        const i = Math.floor(Math.random() * count);
        if (walkers[i].state !== WALK) continue;
        walkers[i].state = LEAVE; walkers[i].leaving = 0; // il continue de marcher jusqu'à sortir du champ
        n--;
      }
    }

    // 3. Groupes devant les lieux ouverts
    if (!slots) return;
    const want = Math.round(slotList.length * groupRamp(h));
    const eligible: { place: number; score: number }[] = [];
    const inUse = new Map<number, Slot>();
    for (const s of slotList) if (s.place >= 0) inUse.set(s.place, s);
    places.forEach((_, i) => {
      const st = stands[i];
      if (!st || !openFlag[i] || catVisible[catOf[i]] === false) return;
      const near2 = (st.x - lastFocus.x) ** 2 + (st.y + lastFocus.z) ** 2 < (cfg.radius * (inUse.has(i) ? 1.15 : 1)) ** 2;
      if (!near2) return;
      // Tirage pondéré stable (même lieu, même rang) ; un groupe déjà formé garde un avantage : pas de va-et-vient
      eligible.push({ place: i, score: Math.pow(stable(i), 1 / weightOf[i]) + (inUse.has(i) ? 0.35 : 0) });
    });
    eligible.sort((a, b) => b.score - a.score);
    const chosen = new Set(eligible.slice(0, want).map((e) => e.place));
    for (const s of slotList) {
      if (s.place < 0 || chosen.has(s.place)) continue;
      const hidden = catVisible[catOf[s.place]] === false;
      dismiss(s, hidden);
    }
    let formed = 0;
    for (const e of eligible.slice(0, want)) {
      if (formed >= 2 || inUse.has(e.place)) continue; // deux nouveaux groupes par vérification au plus
      const slot = slotList.find((s) => s.place < 0 && walkers.slice(s.first, s.first + GROUP_MAX_SIZE).every((w) => w.state === OFF));
      if (!slot) break;
      form(slot, e.place);
      formed++;
    }
  };

  const update = (dt: number) => {
    check -= dt;
    if (check <= 0) { check = 0.5; hourCheck(); }
    for (let i = 0; i < total; i++) {
      const w = walkers[i];
      if (w.state === OFF) continue;
      w.grow = Math.max(0, Math.min(1, w.grow + (w.state === FADE ? -dt : dt) / FADE_S));
      if (w.state === FADE && w.grow <= 0) { turnOff(i); continue; }
      let moving = 0;
      if (w.state === WALK || w.state === LEAVE || w.state === FADE) {
        if (w.pause > 0) w.pause -= dt;
        else {
          moving = 1;
          w.s += w.speed * dt;
          while (w.s >= w.edge.len) {
            w.s -= w.edge.len;
            const prev = w.from;
            w.from = w.edge.to;
            w.edge = pickNext(prev, w.from);
            if (w.state === WALK && Math.random() < cfg.pauseChance) { w.pause = rnd(cfg.pauseSeconds); break; }
          }
          w.phase = (w.phase + (w.speed * dt) / (STRIDE * cfg.scale)) % 1;
        }
        // La place dans le groupe s'efface en quelques secondes : il rejoint la voie sans à-coup
        const decay = Math.exp(-dt * 1.5);
        w.ox *= decay; w.oy *= decay;
      }
      const e = w.edge, k = e.len > 0 ? Math.min(1, w.s / e.len) : 0;
      const x = g.x[w.from] + (g.x[e.to] - g.x[w.from]) * k + w.ox, y = g.y[w.from] + (g.y[e.to] - g.y[w.from]) * k + w.oy;
      let ph = 0;
      if (w.state === STAND) {
        // À l'arrêt : balancement lent du cap et du corps, jambes immobiles
        w.phase += dt * 0.7;
        w.heading = w.stand + 0.3 * Math.sin(w.phase);
        ph = 0;
      } else {
        // Cap lissé : pas de demi-tour instantané à un carrefour
        const target = Math.atan2(g.y[e.to] - g.y[w.from], g.x[e.to] - g.x[w.from]);
        const d = Math.atan2(Math.sin(target - w.heading), Math.cos(target - w.heading));
        w.heading += d * Math.min(1, dt * 6);
        ph = w.phase * Math.PI * 2;
      }
      const ground = heightAt(x, y) + e.lift;
      swing.setX(i, moving * 0.45 * Math.sin(ph));
      const scale = cfg.scale * (w.grow * w.grow * (3 - 2 * w.grow)); // fondu adouci
      q.setFromAxisAngle(up, w.heading);
      p.set(x, ground + moving * 0.03 * Math.abs(Math.sin(ph)) * cfg.scale, -y);
      m.compose(p, q, sc.setScalar(scale));
      body.setMatrixAt(i, m);
      head.setMatrixAt(i, m);
      p.y = ground + 0.03;
      m.compose(p, q, sc.set(shadowScale.x * (scale / cfg.scale), 1, shadowScale.z * (scale / cfg.scale)));
      shadow.setMatrixAt(i, m);
    }
    body.instanceMatrix.needsUpdate = head.instanceMatrix.needsUpdate = shadow.instanceMatrix.needsUpdate = true;
    swing.needsUpdate = true;
  };

  // Départ : la foule de l'heure actuelle est déjà là (sans fondu)
  for (let i = 0; i < total; i++) turnOff(i);
  const initial = Math.round(count * curveAt(cfg.dayCurve, view.hour()));
  for (let i = 0; i < initial; i++) spawnStreet(i, true, true);
  update(0);

  return {
    group, count, nodes: main.length, update,
    density: (h) => curveAt(cfg.dayCurve, h),
    setOpen(open) { places.forEach((_, i) => { openFlag[i] = !!open[i]; }); check = 0; },
    setCategoryVisible(category, visible) { catVisible[category] = visible; check = 0; },
    stats() {
      const c = { street: 0, standing: 0, leaving: 0, fading: 0, groups: groupCount() };
      for (const w of walkers) { if (w.state === WALK) c.street++; else if (w.state === STAND) c.standing++; else if (w.state === LEAVE) c.leaving++; else if (w.state === FADE) c.fading++; }
      return c;
    },
  };
}
