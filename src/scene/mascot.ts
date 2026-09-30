import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { CityData, Pt } from '../types';
import { dataUrl } from '../dataurl';
import { pointInRing } from './nature';

/**
 * Mascottes : les quatre éléphants échappés de la fontaine se promènent dans le diorama
 * (itération 33 pour la marche, itération 35 pour le troupeau et le cache-cache).
 *
 * Déplacement : uniquement sur les voies OSM (data.roads). Les voies sont transformées en graphe
 * (un nœud par point, relié à ses voisins sur la voie ; les voies qui se croisent partagent leurs nœuds).
 * L'éléphant va de nœud en nœud le long des segments, donc il reste toujours sur une rue ou un chemin.
 * À chaque carrefour il choisit une suite au hasard, en préférant aller tout droit, les rues piétonnes,
 * et en revenant vers la fontaine quand il s'en éloigne trop (roamRadius).
 * Sont retirés du graphe : les types de voies exclus (escaliers), les tronçons qui passent sous un
 * bâtiment (passages couverts : l'éléphant, haut de 4,5 m, traverserait la façade), ceux qui frôlent
 * une façade à moins de `clearance` (trottoirs cartographiés le long des murs) et les zones
 * « avoid » (autour de la fontaine des Éléphants, dont le bassin déborde sur le chemin OSM).
 * Le graphe est calculé une fois et partagé par les quatre éléphants.
 *
 * Marche : le modèle est statique (pas de squelette). Les pattes, la trompe, les oreilles et la queue
 * sont animées dans le shader, en fonction de la position des sommets (voir WALK_GLSL). Les seuils
 * sont ceux du modèle converti par scripts/convert-mascot.mjs (4,5 m de haut, trompe vers +X).
 *
 * Cache-cache (src/game/hunt.ts) : survolé ou touché, un éléphant disparaît dans un nuage et réapparaît
 * plus loin ; après un nombre de fuites tiré au hasard, il réapparaît épuisé (assis, étoiles au-dessus
 * de la tête) et un clic l'attrape : il s'envole alors vers sa place sur la fontaine.
 *
 * Ombre : les ombres de la scène ne sont recalculées que quand le soleil bouge (itération 25) ;
 * un objet qui se déplace ne peut donc pas projeter d'ombre. Chaque éléphant a une ombre « tache ».
 */
export interface MascotConfig {
  model: string;
  /** Identifiant d'ancrage (data.anchors) : la fontaine, autour de laquelle ils se promènent */
  start: string;
  scale: number;
  /** Vitesse de marche en m/s */
  speed: number;
  /** Distance parcourue par cycle de pas (m), à l'échelle 1 */
  stride: number;
  excludeKinds: string[];
  /** Préférence par type de voie (1 par défaut) */
  preferKinds: Record<string, number>;
  /** Distance minimale (m) entre l'axe de la voie et une façade : l'éléphant ne frôle pas les murs */
  clearance: number;
  /** Zones interdites : cercle autour d'un ancrage (data.anchors), rayon en mètres */
  avoid: { anchor: string; radius: number }[];
  /** Au-delà de cette distance de la fontaine (m), il tend à revenir */
  roamRadius: number;
  /** Durée de marche entre deux pauses, et durée des pauses (s) : [min, max] */
  walkSeconds: [number, number];
  pauseSeconds: [number, number];
  /** Mini-jeu « Ramène les éléphants à la fontaine » (itération 35) */
  game: {
    /** Nombre d'éléphants (un par place sur la fontaine) */
    count: number;
    /** Nombre de fuites avant qu'il soit épuisé, tiré au hasard entre [min, max] pour chaque éléphant */
    escapes: [number, number];
    /** Distance (m) entre l'endroit où il disparaît et celui où il réapparaît : [min, max] */
    respawnDistance: [number, number];
    /** Distance (m) de la fontaine où ils apparaissent en début de partie : [min, max] */
    startDistance: [number, number];
    /** Points par éléphant ramené, et bonus quand la fontaine est complète */
    points: number;
    bonus: number;
    /** Distance minimale (m) entre un lieu de réapparition et la façade la plus proche */
    openSpace: number;
    /** Délai (s) après la fontaine complète avant qu'ils s'échappent de nouveau */
    restartSeconds: number;
    /** Durée d'affichage (s) de la bulle quand il disparaît */
    bubbleSeconds: number;
    /** Souris sur lui : il sursaute et trotte plus vite (m/s) pendant startleSeconds */
    startleSpeed: number;
    startleSeconds: number;
    /** Phrases pour narguer (une au hasard à chaque fuite) */
    taunts: string[];
  };
}

/**
 * walk : se promène · poof : disparaît dans un nuage · hidden : invisible, va réapparaître ·
 * tired : épuisé, attrapable · flying : vole vers la fontaine · home : sur la fontaine (plus dans les rues)
 */
export type ElephantState = 'walk' | 'poof' | 'hidden' | 'tired' | 'flying' | 'home';

export interface Escape {
  /** Où il a disparu, et où il réapparaît (mètres) */
  from: Pt;
  to: Pt;
  /** Nom de la voie où il réapparaît (OSM), s'il y en a un */
  road?: string;
  /** Il réapparaîtra épuisé */
  tired: boolean;
}

export interface Elephant {
  id: number;
  group: THREE.Group;
  /** Zone de clic (invisible), pour le lancer de rayon */
  hit: THREE.Object3D;
  state(): ElephantState;
  position(): Pt;
  /** Altitude actuelle (Three.js y) */
  height(): number;
  escapesLeft(): number;
  /** Survolé ou touché : il s'échappe (sauf s'il est épuisé ou déjà en train de disparaître). */
  escape(): Escape | null;
  /** Attrapé (seulement s'il est épuisé) : il vole jusqu'à `target` puis appelle onLand. */
  catchTo(target: THREE.Vector3, onLand: () => void): boolean;
  /** Nouvelle partie : il réapparaît dans les rues, loin de la fontaine. */
  release(): void;
  /** Déjà ramené (partie sauvegardée) : il reste sur la fontaine. */
  setHome(): void;
  /** Mode debug : plus aucune fuite, il disparaît et réapparaît épuisé. */
  exhaust(): void;
  /** Souris sur lui : il sursaute et accélère un moment (il ne disparaît qu'au clic). */
  startle(): void;
}

export interface Herd {
  group: THREE.Group;
  elephants: Elephant[];
  update(dt: number, t: number): void;
}

/** Hauteur des rubans de voies au-dessus du relief (mêmes valeurs que buildFlat, scene/city.ts) */
const FOOT = new Set(['footway', 'path', 'steps', 'cycleway', 'track', 'pedestrian', 'living_street']);
const roadLift = (kind: string, bridge?: boolean) => (bridge ? 0.9 : FOOT.has(kind) ? 0.14 : 0.18);

interface Edge { to: number; len: number; lift: number; w: number; name?: string }
interface Graph { x: Float64Array; y: Float64Array; adj: Edge[][] }

function buildGraph(data: CityData, cfg: MascotConfig): Graph {
  const index = new Map<string, number>();
  const xs: number[] = [], ys: number[] = [], adj: Edge[][] = [];
  const node = (p: Pt) => {
    const k = `${p[0]},${p[1]}`;
    let i = index.get(k);
    if (i === undefined) {
      i = xs.length;
      index.set(k, i);
      xs.push(p[0]); ys.push(p[1]); adj.push([]);
    }
    return i;
  };
  const exclude = new Set(cfg.excludeKinds);
  const blocked = blocker(data, cfg);
  for (const r of data.roads) {
    if (exclude.has(r.kind)) continue;
    const lift = roadLift(r.kind, r.bridge);
    const w = cfg.preferKinds[r.kind] ?? 1;
    const name = r.name;
    for (let k = 1; k < r.pts.length; k++) {
      const a = node(r.pts[k - 1]), b = node(r.pts[k]);
      if (a === b || blocked(r.pts[k - 1], r.pts[k])) continue;
      const len = Math.hypot(xs[b] - xs[a], ys[b] - ys[a]);
      adj[a].push({ to: b, len, lift, w, name });
      adj[b].push({ to: a, len, lift, w, name });
    }
  }
  return { x: Float64Array.from(xs), y: Float64Array.from(ys), adj };
}

/** Tronçon interdit : dans une zone « avoid », ou passant sous un bâtiment (test tous les 2 m). */
function blocker(data: CityData, cfg: MascotConfig): (a: Pt, b: Pt) => boolean {
  const zones = cfg.avoid.flatMap((z) => {
    const c = data.anchors[z.anchor]?.pos;
    return c ? [{ c, r: z.radius }] : [];
  });
  // Grille de 25 m : bâtiments dont la boîte englobante touche chaque case
  const CELL = 25;
  const grid = new Map<string, Pt[][]>();
  for (const b of data.buildings) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of b.outer) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++)
      for (let j = Math.floor(y0 / CELL); j <= Math.floor(y1 / CELL); j++) {
        const k = `${i},${j}`;
        const list = grid.get(k);
        if (list) list.push(b.outer); else grid.set(k, [b.outer]);
      }
  }
  const c2 = cfg.clearance * cfg.clearance;
  const nearWall = (p: Pt, ring: Pt[]) => {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[j], [bx, by] = ring[i];
      const dx = bx - ax, dy = by - ay;
      const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy || 1)));
      const ex = ax + dx * t - p[0], ey = ay + dy * t - p[1];
      if (ex * ex + ey * ey < c2) return true;
    }
    return false;
  };
  const underBuilding = (p: Pt) => (grid.get(`${Math.floor(p[0] / CELL)},${Math.floor(p[1] / CELL)}`) ?? []).some((ring) => pointInRing(p[0], p[1], ring) || nearWall(p, ring));
  return (a, b) => {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2));
    for (let i = 0; i <= n; i++) {
      const p: Pt = [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n];
      if (zones.some((z) => Math.hypot(p[0] - z.c[0], p[1] - z.c[1]) < z.r)) return true;
      // Les extrémités peuvent toucher une façade (voie qui longe un mur) : on ne teste que l'intérieur
      if (i > 0 && i < n && underBuilding(p)) return true;
      if (n === 1 && underBuilding([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])) return true;
    }
    return false;
  };
}

/**
 * Distance (m) d'un point à la façade la plus proche, plafonnée à `max` (grille de 25 m).
 * Sert à choisir où un éléphant réapparaît : en bout de chemin, un nœud peut toucher un mur, et l'éléphant
 * (6 m de long) rentrerait dans la façade.
 */
function wallDistance(data: CityData): (p: Pt, max: number) => number {
  const CELL = 25;
  const grid = new Map<string, Pt[][]>();
  for (const b of data.buildings) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of b.outer) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++)
      for (let j = Math.floor(y0 / CELL); j <= Math.floor(y1 / CELL); j++) {
        const k = `${i},${j}`;
        const list = grid.get(k);
        if (list) list.push(b.outer); else grid.set(k, [b.outer]);
      }
  }
  return (p, max) => {
    let best = max * max;
    const ci = Math.floor(p[0] / CELL), cj = Math.floor(p[1] / CELL);
    const seen = new Set<Pt[]>();
    for (let i = ci - 1; i <= ci + 1; i++)
      for (let j = cj - 1; j <= cj + 1; j++)
        for (const ring of grid.get(`${i},${j}`) ?? []) {
          if (seen.has(ring)) continue;
          seen.add(ring);
          if (pointInRing(p[0], p[1], ring)) return 0;
          for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
            const [ax, ay] = ring[b], [bx, by] = ring[a];
            const dx = bx - ax, dy = by - ay;
            const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy || 1)));
            const ex = ax + dx * t - p[0], ey = ay + dy * t - p[1];
            best = Math.min(best, ex * ex + ey * ey);
          }
        }
    return Math.sqrt(best);
  };
}

/** Nœuds de la plus grande partie connexe du réseau (évite de démarrer sur un bout de chemin isolé). */
function mainComponent(g: Graph): Set<number> {
  const seen = new Int32Array(g.x.length).fill(-1);
  let best: number[] = [];
  for (let s = 0; s < g.x.length; s++) {
    if (seen[s] >= 0 || !g.adj[s].length) continue;
    const comp = [s];
    seen[s] = s;
    for (let q = 0; q < comp.length; q++)
      for (const e of g.adj[comp[q]]) if (seen[e.to] < 0) { seen[e.to] = s; comp.push(e.to); }
    if (comp.length > best.length) best = comp;
  }
  return new Set(best);
}

// Seuils du modèle converti (mètres, à l'échelle 1) — voir scripts/convert-mascot.mjs
const WALK_GLSL = /* glsl */ `
  vec3 p0 = transformed;
  // Pattes (sous le ventre, |x| < 1.75) : rotation autour de la hanche, marche « en amble » décalée
  // d'un quart de cycle d'une patte à l'autre (arrière gauche, avant gauche, arrière droite, avant droite)
  if (p0.y < 1.4 && abs(p0.x) < 1.75) {
    float front = step(0.0, p0.x);
    float left = step(0.0, p0.z);
    float off = mix(mix(0.5, 0.0, left), mix(0.75, 0.25, left), front);
    float ph = 6.2831853 * (uPhase + off);
    float a = uAmp * 0.3 * sin(ph);
    vec2 hip = vec2(front > 0.5 ? 1.25 : -1.25, 1.95);
    vec2 r = p0.xy - hip;
    float c = cos(a), s = sin(a);
    transformed.x = hip.x + r.x * c - r.y * s;
    transformed.y = hip.y + r.x * s + r.y * c;
    // Le pied se lève pendant qu'il revient vers l'avant
    transformed.y += uAmp * 0.18 * max(0.0, cos(ph)) * clamp(1.0 - p0.y / 1.4, 0.0, 1.0);
  }
  // Trompe (à l'avant, sous la tête) : balancement lent, plus ample vers le bout
  float tw = clamp((p0.x - 2.3) / 1.8, 0.0, 1.0) * step(p0.y, 3.2);
  transformed.z += tw * tw * 0.45 * sin(uTime * 1.3);
  transformed.x += tw * tw * 0.12 * sin(uTime * 0.9 + 1.0);
  // Oreilles : battement léger
  float ew = clamp((abs(p0.z) - 1.0) / 1.1, 0.0, 1.0) * step(1.6, p0.y) * step(p0.x, 2.4);
  transformed.x += ew * 0.25 * sin(uTime * 2.2 + sign(p0.z));
  // Queue (tout à l'arrière)
  float qw = clamp((-p0.x - 1.75) / 0.4, 0.0, 1.0) * step(p0.y, 2.7);
  transformed.z += qw * 0.25 * sin(uTime * 3.1);
  // Corps : petit dandinement à chaque pas
  float bw = step(1.4, p0.y);
  transformed.y += bw * uAmp * 0.05 * sin(6.2831853 * uPhase * 2.0);
  transformed.z += bw * uAmp * 0.04 * sin(6.2831853 * uPhase) * (p0.y - 1.4);
`;

function blobShadow(): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.3)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const mat = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat);
  m.scale.set(5.2, 1, 3);
  m.position.y = 0.04;
  m.renderOrder = 1;
  return m;
}


const rnd = (r: [number, number]) => r[0] + Math.random() * (r[1] - r[0]);
const rndInt = (r: [number, number]) => Math.floor(r[0] + Math.random() * (r[1] - r[0] + 1));
const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

/** Texture d'étoile partagée (sprites : toujours face à la caméra, lisibles même vues du dessus) */
let starTexture: THREE.CanvasTexture | null = null;
function starMaterial(): THREE.SpriteMaterial {
  if (!starTexture) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d')!;
    x.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 12 : 30, a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
    }
    x.closePath();
    x.fillStyle = '#ffd23f';
    x.strokeStyle = '#b8860b';
    x.lineWidth = 3;
    x.fill();
    x.stroke();
    starTexture = new THREE.CanvasTexture(c);
    starTexture.colorSpace = THREE.SRGBColorSpace;
  }
  return new THREE.SpriteMaterial({ map: starTexture, depthWrite: false });
}

/** Petites étoiles qui tournent au-dessus de la tête d'un éléphant épuisé */
function dizzyStars(): THREE.Group {
  const g = new THREE.Group();
  const mat = starMaterial();
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Sprite(mat);
    s.scale.setScalar(0.9);
    const a = (i / 5) * Math.PI * 2;
    s.position.set(Math.cos(a) * 1.1, 0, Math.sin(a) * 1.1);
    g.add(s);
  }
  g.position.set(2.2, 5.1, 0);
  g.visible = false;
  return g;
}

export async function buildHerd(cfg: MascotConfig, data: CityData, heightAt: (x: number, y: number) => number): Promise<Herd | null> {
  const g = buildGraph(data, cfg);
  const main = mainComponent(g);
  if (!main.size) return null;
  const home: Pt = data.anchors[cfg.start]?.pos ?? [0, 0];
  const b = data.bounds;
  const G = cfg.game;
  // Lieux de réapparition : seulement des nœuds dégagés (façade à plus de openSpace mètres),
  // sinon l'éléphant, qui s'assoit épuisé à cet endroit, peut rentrer dans un mur (itération 36)
  const wall = wallDistance(data);
  const open = [...main].filter((i) => wall([g.x[i], g.y[i]], G.openSpace + 1) >= G.openSpace);
  const mainList = open.length ? open : [...main];
  if (import.meta.env.DEV) console.info(`[mascottes] ${open.length} lieux de réapparition dégagés sur ${main.size} nœuds`);

  /** Nœud dégagé au hasard, à une distance de `from` comprise dans [min, max], à moins de roamRadius de la fontaine */
  const randomNode = (from: Pt, range: [number, number]): number => {
    let best = mainList[0], bestErr = Infinity;
    for (let k = 0; k < 400; k++) {
      const i = mainList[Math.floor(Math.random() * mainList.length)];
      const x = g.x[i], y = g.y[i];
      if (x < b.minX + 30 || x > b.maxX - 30 || y < b.minY + 30 || y > b.maxY - 30) continue;
      // Il reste dans le quartier de la fontaine : sinon, de fuite en fuite, il pouvait finir au bout de la carte
      if (Math.hypot(x - home[0], y - home[1]) > cfg.roamRadius) continue;
      const d = Math.hypot(x - from[0], y - from[1]);
      const err = d < range[0] ? range[0] - d : d > range[1] ? d - range[1] : 0;
      if (err === 0) return i;
      if (err < bestErr) { bestErr = err; best = i; }
    }
    return best;
  };

  const gltf = await new GLTFLoader().loadAsync(dataUrl(cfg.model));
  const group = new THREE.Group();
  group.name = 'mascots';
  const elephants: Elephant[] = [];
  const updaters: ((dt: number, t: number) => void)[] = [];

  for (let id = 0; id < G.count; id++) {
    // Chaque éléphant a ses propres matériaux : ses pattes bougent à son rythme
    const uniforms = { uPhase: { value: Math.random() }, uAmp: { value: 0 }, uTime: { value: 0 } };
    const model = gltf.scene.clone(true);
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false; // voir l'en-tête : ombre « tache » à la place
      mesh.receiveShadow = true;
      mesh.frustumCulled = false; // les sommets bougent dans le shader
      const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
      mat.flatShading = true;
      mat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float uPhase;\nuniform float uAmp;\nuniform float uTime;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>\n${WALK_GLSL}`);
      };
      mat.customProgramCacheKey = () => 'mascot-walk';
      mesh.material = mat;
    });

    const root = new THREE.Group();
    root.name = `mascot-${id}`;
    const body = new THREE.Group();
    body.add(model);
    root.add(body);
    const shadow = blobShadow();
    shadow.scale.multiplyScalar(cfg.scale);
    root.add(shadow);
    const stars = dizzyStars();
    body.add(stars);
    // Zone de clic plus large que l'éléphant (plus facile à attraper), invisible
    const hit = new THREE.Mesh(new THREE.BoxGeometry(7, 5.5, 4.5), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(1, 2.4, 0);
    hit.scale.multiplyScalar(cfg.scale);
    hit.userData.elephant = id;
    root.add(hit);
    group.add(root);

    // --- État ----------------------------------------------------------------
    let from = randomNode(home, G.startDistance);
    let edge = pickNext(-1, from);
    let s = 0; // distance parcourue sur le segment courant
    let state: ElephantState = 'walk';
    let stateT = 0;
    let walking = true;
    let timer = rnd(cfg.walkSeconds);
    let heading = Math.random() * Math.PI * 2;
    let y = NaN;
    let amp = 0;
    let escapes = rndInt(G.escapes);
    let next = -1; // nœud de réapparition
    let appearT = 0; // animation d'apparition (0 → 1)
    let startleT = 0; // sursaut : temps restant au trot
    let speed = cfg.speed;
    const pos: Pt = [g.x[from], g.y[from]];
    let fly: { a: THREE.Vector3; b: THREE.Vector3; top: number; onLand: () => void } | null = null;

    function pickNext(prev: number, at: number): Edge {
      const opts = g.adj[at].filter((e) => main.has(e.to));
      const forward = opts.filter((e) => e.to !== prev);
      const list = forward.length ? forward : opts; // cul-de-sac : demi-tour
      if (prev < 0) return list[Math.floor(Math.random() * list.length)];
      const dirIn = Math.atan2(g.y[at] - g.y[prev], g.x[at] - g.x[prev]);
      const far = Math.hypot(g.x[at] - home[0], g.y[at] - home[1]) > cfg.roamRadius;
      const weights = list.map((e) => {
        const dir = Math.atan2(g.y[e.to] - g.y[at], g.x[e.to] - g.x[at]);
        const straight = (1 + Math.cos(dir - dirIn)) / 2; // 1 = tout droit, 0 = demi-tour
        let w = e.w * (0.08 + straight * straight);
        if (far) {
          const closer = Math.hypot(g.x[e.to] - home[0], g.y[e.to] - home[1]) < Math.hypot(g.x[at] - home[0], g.y[at] - home[1]);
          w *= closer ? 4 : 0.25;
        }
        return w;
      });
      let r = Math.random() * weights.reduce((a, c) => a + c, 0);
      for (let i = 0; i < list.length; i++) if ((r -= weights[i]) <= 0) return list[i];
      return list[list.length - 1];
    }

    const setState = (st: ElephantState) => {
      state = st;
      stateT = 0;
    };
    /** Se poser sur un nœud (réapparition, nouvelle partie) */
    const placeAt = (node: number) => {
      from = node;
      edge = pickNext(-1, from);
      s = 0;
      y = NaN;
      heading = Math.atan2(g.y[edge.to] - g.y[from], g.x[edge.to] - g.x[from]);
      appearT = 0;
    };
    const roadName = (node: number) => g.adj[node].find((e) => e.name)?.name;

    const el: Elephant = {
      id, group: root, hit,
      state: () => state,
      position: () => [pos[0], pos[1]],
      height: () => y,
      escapesLeft: () => escapes,
      escape() {
        if (state !== 'walk') return null;
        escapes = Math.max(0, escapes - 1);
        next = randomNode(pos, G.respawnDistance);
        setState('poof');
        return { from: [pos[0], pos[1]], to: [g.x[next], g.y[next]], road: roadName(next), tired: escapes === 0 };
      },
      catchTo(target, onLand) {
        if (state !== 'tired') return false;
        fly = { a: root.position.clone(), b: target.clone(), top: Math.max(root.position.y, target.y) + 24, onLand };
        setState('flying');
        return true;
      },
      release() {
        escapes = rndInt(G.escapes);
        placeAt(randomNode(home, G.startDistance));
        walking = true;
        timer = rnd(cfg.walkSeconds);
        setState('walk');
      },
      setHome() {
        setState('home');
      },
      startle() {
        // Déjà au trot : on prolonge sans refaire le sursaut
        if (state !== 'walk') return;
        if (startleT <= 0) stateT = 0;
        startleT = G.startleSeconds;
        walking = true;
        timer = Math.max(timer, G.startleSeconds);
      },
      exhaust() {
        if (state !== 'walk') return;
        escapes = 1;
        el.escape();
      },
    };
    elephants.push(el);

    updaters.push((dt, t) => {
      uniforms.uTime.value = t + id * 1.7;
      stateT += dt;
      root.visible = state !== 'hidden' && state !== 'home';
      if (!root.visible) {
        // Réapparition, plus loin (épuisé s'il n'a plus de fuite)
        if (state === 'hidden' && stateT > 0.8) {
          placeAt(next);
          setState(escapes === 0 ? 'tired' : 'walk');
          walking = true;
          timer = rnd(cfg.walkSeconds);
        }
        return;
      }
      body.position.set(0, 0, 0);
      body.rotation.set(0, 0, 0);
      stars.visible = state === 'tired';
      appearT = Math.min(1, appearT + dt / 0.45);
      // Apparition : il sort de terre avec un petit rebond
      const pop = appearT < 1 ? Math.sin(appearT * Math.PI * 0.5) * (1 + 0.25 * Math.sin(appearT * Math.PI)) : 1;
      let sc = cfg.scale * pop;

      let targetAmp = 0;
      if (state === 'walk') {
        timer -= dt;
        if (timer <= 0) {
          walking = !walking;
          timer = rnd(walking ? cfg.walkSeconds : cfg.pauseSeconds);
        }
        targetAmp = walking ? 1 : 0;
        if (startleT > 0) {
          startleT -= dt;
          targetAmp = 1;
          // Sursaut : petit bond au moment où la souris arrive sur lui
          if (stateT < 0.35) body.position.y = Math.sin((stateT / 0.35) * Math.PI) * 0.9;
        }
        speed += ((startleT > 0 ? G.startleSpeed : cfg.speed) - speed) * Math.min(1, dt * 5);
      } else if (state === 'poof') {
        // Il tourne sur lui-même et rétrécit, puis disparaît dans le nuage
        const k = Math.min(1, stateT / 0.35);
        sc *= 1 - k;
        body.rotation.y = k * Math.PI * 1.5;
        body.position.y = Math.sin(k * Math.PI) * 1.2;
        if (k >= 1) setState('hidden');
      } else if (state === 'tired') {
        // Assis, la tête en l'air, il souffle ; les étoiles tournent
        body.rotation.z = 0.28;
        body.position.set(-0.6, 0.35 + Math.sin(t * 2.4) * 0.06, 0);
        stars.rotation.y = t * 2.2;
        stars.position.y = 5.1 + Math.sin(t * 3) * 0.15;
      } else if (state === 'flying' && fly) {
        const k = Math.min(1, stateT / 2.4);
        const e = ease(k);
        const p = new THREE.Vector3().lerpVectors(fly.a, fly.b, e);
        p.y = (1 - e) * (1 - e) * fly.a.y + 2 * (1 - e) * e * fly.top + e * e * fly.b.y;
        root.position.copy(p);
        body.rotation.y = e * Math.PI * 4;
        sc *= 1 - 0.55 * e;
        if (k >= 1) {
          const done = fly.onLand;
          fly = null;
          setState('home');
          done();
        }
        body.scale.setScalar(Math.max(0.01, sc));
        return;
      }
      body.scale.setScalar(Math.max(0.01, sc));

      amp = state === 'walk' ? amp + (targetAmp - amp) * Math.min(1, dt * 3) : 0;
      const step = speed * amp * dt;
      s += step;
      while (s >= edge.len) {
        s -= edge.len;
        const prev = from;
        from = edge.to;
        edge = pickNext(prev, from);
      }
      const k = edge.len > 0 ? Math.min(1, s / edge.len) : 0;
      pos[0] = g.x[from] + (g.x[edge.to] - g.x[from]) * k;
      pos[1] = g.y[from] + (g.y[edge.to] - g.y[from]) * k;
      // Au trot, les pas s'allongent un peu (sinon les pattes s'affolent)
      uniforms.uPhase.value = (uniforms.uPhase.value + step / (cfg.stride * cfg.scale * Math.sqrt(speed / cfg.speed))) % 1;
      uniforms.uAmp.value = amp;

      // Cap lissé (la position, elle, reste exactement sur la voie)
      const target = Math.atan2(g.y[edge.to] - g.y[from], g.x[edge.to] - g.x[from]);
      let d = target - heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (state === 'walk') heading += d * Math.min(1, dt * 4);
      // Altitude lissée : pas de saut à l'entrée d'un pont
      const ty = heightAt(pos[0], pos[1]) + edge.lift;
      y = Number.isNaN(y) ? ty : y + (ty - y) * Math.min(1, dt * 6);

      root.position.set(pos[0], y, -pos[1]);
      // Modèle orienté vers +X ; en Three.js, le nord (y OSM) est vers -Z
      root.rotation.y = heading;
    });
  }

  const update = (dt: number, t: number) => updaters.forEach((u) => u(dt, t));
  update(0, 0);
  return { group, elephants, update };
}
