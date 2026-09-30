import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { CityData, Pt } from '../types';
import { dataUrl } from '../dataurl';
import { pointInRing } from './nature';

/**
 * Mascotte : un éléphant qui se promène dans le diorama (itération 33).
 *
 * Déplacement : uniquement sur les voies OSM (data.roads). Les voies sont transformées en graphe
 * (un nœud par point, relié à ses voisins sur la voie ; les voies qui se croisent partagent leurs nœuds).
 * L'éléphant va de nœud en nœud le long des segments, donc il reste toujours sur une rue ou un chemin.
 * À chaque carrefour il choisit une suite au hasard, en préférant aller tout droit, les rues piétonnes,
 * et en revenant vers son point de départ quand il s'en éloigne trop (roamRadius).
 * Sont retirés du graphe : les types de voies exclus (escaliers), les tronçons qui passent sous un
 * bâtiment (passages couverts : l'éléphant, haut de 4,5 m, traverserait la façade), ceux qui frôlent
 * une façade à moins de `clearance` (trottoirs cartographiés le long des murs) et les zones
 * « avoid » (autour de la fontaine des Éléphants, dont le bassin déborde sur le chemin OSM).
 *
 * Marche : le modèle est statique (pas de squelette). Les pattes, la trompe, les oreilles et la queue
 * sont animées dans le shader, en fonction de la position des sommets (voir WALK_GLSL). Les seuils
 * sont ceux du modèle converti par scripts/convert-mascot.mjs (4,5 m de haut, trompe vers +X).
 *
 * Ombre : les ombres de la scène ne sont recalculées que quand le soleil bouge (itération 25) ;
 * un objet qui se déplace ne peut donc pas projeter d'ombre. L'éléphant a une ombre « tache » sous lui.
 */
export interface MascotConfig {
  model: string;
  /** Identifiant d'ancrage (data.anchors) près duquel l'éléphant démarre */
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
  /** Au-delà de cette distance du départ (m), il tend à revenir */
  roamRadius: number;
  /** Durée de marche entre deux pauses, et durée des pauses (s) : [min, max] */
  walkSeconds: [number, number];
  pauseSeconds: [number, number];
  /** Mini-jeu « Attrape l'éléphant » (itération 34) */
  game: {
    /** Distance (m) à laquelle la souris le fait fuir */
    fleeRadius: number;
    fleeSpeed: number;
    /** Sprint après un clic raté, en m/s, pendant boostSeconds */
    boostSpeed: number;
    boostSeconds: number;
    /** Temps sans menace avant qu'il se calme */
    calmSeconds: number;
    /** Temps pendant lequel il reste coincé avant de forcer le passage */
    cornerSeconds: number;
    /**
     * Coincé si la meilleure issue d'un carrefour ne s'éloigne pas assez de la menace :
     * produit scalaire entre la direction de la voie et la direction opposée à la menace (−1 à 1).
     * −0,3 : toutes les issues repartent vers la souris (cul-de-sac, bout de carte, coin fermé).
     */
    cornerScore: number;
    points: number;
  };
}

/** calm : promenade · flee : fuit la souris · cornered : coincé, il rebondit · caught : attrapé */
export type MascotMode = 'calm' | 'flee' | 'cornered' | 'caught';

export interface Mascot {
  group: THREE.Group;
  /** Zone de clic (invisible), pour le lancer de rayon */
  hit: THREE.Object3D;
  update(dt: number, t: number): void;
  /**
   * Position de la menace (souris ou doigt) en mètres, null si elle a quitté la carte.
   * click = tentative de clic : s'il n'est pas coincé, il sprinte.
   */
  setThreat(p: Pt | null, click?: boolean): void;
  /** Tentative de capture : réussit seulement s'il est coincé (renvoie true), sinon il sprinte. */
  tryCatch(): boolean;
  /** Position actuelle [x, y] en mètres (coordonnées OSM projetées) */
  position(): Pt;
  mode(): MascotMode;
  /** Altitude actuelle (Three.js y) */
  height(): number;
  time(): number;
  /** État interne (tests) */
  debug(): { from: number; to: number; s: number; len: number; mode: MascotMode; deg: number };
}

/** Hauteur des rubans de voies au-dessus du relief (mêmes valeurs que buildFlat, scene/city.ts) */
const FOOT = new Set(['footway', 'path', 'steps', 'cycleway', 'track', 'pedestrian', 'living_street']);
const roadLift = (kind: string, bridge?: boolean) => (bridge ? 0.9 : FOOT.has(kind) ? 0.14 : 0.18);

interface Edge { to: number; len: number; lift: number; w: number }
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
    for (let k = 1; k < r.pts.length; k++) {
      const a = node(r.pts[k - 1]), b = node(r.pts[k]);
      if (a === b || blocked(r.pts[k - 1], r.pts[k])) continue;
      const len = Math.hypot(xs[b] - xs[a], ys[b] - ys[a]);
      adj[a].push({ to: b, len, lift, w });
      adj[b].push({ to: a, len, lift, w });
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

export async function buildMascot(cfg: MascotConfig, data: CityData, heightAt: (x: number, y: number) => number): Promise<Mascot | null> {
  const g = buildGraph(data, cfg);
  const main = mainComponent(g);
  if (!main.size) return null;

  // Départ : nœud du réseau principal le plus proche de l'ancrage (fontaine des Éléphants)
  const home: Pt = data.anchors[cfg.start]?.pos ?? [0, 0];
  let from = -1, bestD = Infinity;
  for (const i of main) {
    const d = Math.hypot(g.x[i] - home[0], g.y[i] - home[1]);
    if (d < bestD) { bestD = d; from = i; }
  }

  const gltf = await new GLTFLoader().loadAsync(dataUrl(cfg.model));
  const uniforms = { uPhase: { value: 0 }, uAmp: { value: 0 }, uTime: { value: 0 } };
  gltf.scene.traverse((o) => {
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
    mesh.material = mat;
  });

  const group = new THREE.Group();
  group.name = 'mascot';
  const body = new THREE.Group();
  body.scale.setScalar(cfg.scale);
  body.add(gltf.scene);
  group.add(body);
  const shadow = blobShadow();
  shadow.scale.multiplyScalar(cfg.scale);
  group.add(shadow);

  // Zone de clic plus large que l'éléphant (plus facile à attraper), invisible
  const hit = new THREE.Mesh(new THREE.BoxGeometry(7, 5.5, 4.5), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(1, 2.4, 0);
  hit.scale.multiplyScalar(cfg.scale);
  hit.name = 'mascot-hit';
  group.add(hit);

  const G = cfg.game;
  // --- État ------------------------------------------------------------------
  let edge = pickNext(-1, from);
  let s = 0; // distance parcourue sur le segment courant
  let mode: MascotMode = 'calm';
  let walking = true;
  let timer = rnd(cfg.walkSeconds);
  let heading = Math.atan2(g.y[edge.to] - g.y[from], g.x[edge.to] - g.x[from]);
  let y = NaN;
  let amp = 0;
  let speed = cfg.speed;
  let threat: Pt | null = null;
  let calmIn = 0; // fuite : temps restant avant de se calmer
  let boostIn = 0; // clic raté : sprint
  let reverseCooldown = 0;
  let modeT = 0; // temps passé dans le mode courant
  let lastT = 0;
  const pos: Pt = [g.x[from], g.y[from]];

  const setMode = (m: MascotMode) => {
    mode = m;
    modeT = 0;
  };
  const dirOf = (a: number, e: Edge): [number, number] => {
    const dx = g.x[e.to] - g.x[a], dy = g.y[e.to] - g.y[a];
    const l = Math.hypot(dx, dy) || 1;
    return [dx / l, dy / l];
  };
  /** Direction opposée à la menace (unitaire), depuis la position actuelle */
  const away = (): [number, number] => {
    if (!threat) return [0, 0];
    const dx = pos[0] - threat[0], dy = pos[1] - threat[1];
    const l = Math.hypot(dx, dy) || 1;
    return [dx / l, dy / l];
  };
  const threatDist = () => (threat ? Math.hypot(pos[0] - threat[0], pos[1] - threat[1]) : Infinity);

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
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < list.length; i++) if ((r -= weights[i]) <= 0) return list[i];
    return list[list.length - 1];
  }

  /**
   * En fuite : la voie qui s'éloigne le plus de la menace (un peu de hasard pour ne pas être prévisible).
   * Renvoie null si toutes les voies ramènent vers la menace : l'éléphant est coincé.
   */
  function pickFlee(at: number): Edge | null {
    const [ax, ay] = away();
    let best: Edge | null = null, bestScore = -Infinity;
    for (const e of g.adj[at]) {
      if (!main.has(e.to)) continue;
      const [dx, dy] = dirOf(at, e);
      const score = dx * ax + dy * ay + Math.random() * 0.15;
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return bestScore < G.cornerScore && threatDist() < G.fleeRadius * 1.5 ? null : best;
  }

  /** Demi-tour sur place : on repart vers le nœud d'où l'on vient. */
  function reverse() {
    const back = g.adj[edge.to].find((e) => e.to === from);
    if (!back) return;
    const len = edge.len;
    from = edge.to;
    edge = back;
    s = Math.max(0, len - s);
  }

  function setThreat(p: Pt | null, click = false) {
    if (mode === 'caught') return;
    threat = p;
    if (!p) return;
    const d = threatDist();
    if (d < G.fleeRadius) {
      if (mode === 'calm') setMode('flee');
      if (mode === 'flee') calmIn = G.calmSeconds;
      // Clic à côté de lui (ou sur lui sans l'avoir coincé) : il sprinte
      if (click && mode === 'flee') boostIn = G.boostSeconds;
    }
  }

  let respawnAt = -1;
  function tryCatch(): boolean {
    if (mode !== 'cornered') {
      setThreat(threat ?? pos.slice() as Pt, true);
      return false;
    }
    setMode('caught');
    threat = null;
    return true;
  }

  function bounceAt(t: number) {
    // Rebond « coincé » : petits sauts avec écrasement à l'atterrissage
    const hop = Math.abs(Math.sin(t * 9));
    body.position.y = hop * 0.9 * cfg.scale;
    const squash = 1 - (1 - hop) * 0.18;
    body.scale.set(cfg.scale * (2 - squash), cfg.scale * squash, cfg.scale * (2 - squash));
  }

  function update(dt: number, t: number) {
    uniforms.uTime.value = t;
    lastT = t;
    modeT += dt;
    reverseCooldown -= dt;
    boostIn -= dt;
    body.position.y = 0;
    body.scale.setScalar(cfg.scale);
    body.rotation.set(0, 0, 0);
    group.visible = true;

    let targetAmp = 1;
    // Souris immobile sur son chemin : il la voit en arrivant
    if (mode === 'calm' && threatDist() < G.fleeRadius) { setMode('flee'); calmIn = G.calmSeconds; }
    if (mode === 'calm') {
      timer -= dt;
      if (timer <= 0) {
        walking = !walking;
        timer = rnd(walking ? cfg.walkSeconds : cfg.pauseSeconds);
      }
      targetAmp = walking ? 1 : 0;
      speed += (cfg.speed - speed) * Math.min(1, dt * 2);
    } else if (mode === 'flee') {
      calmIn -= dt;
      if (threatDist() < G.fleeRadius) calmIn = G.calmSeconds;
      if (calmIn <= 0) { setMode('calm'); walking = true; timer = rnd(cfg.walkSeconds); }
      const want = boostIn > 0 ? G.boostSpeed : G.fleeSpeed;
      speed += (want - speed) * Math.min(1, dt * 4);
      // La menace est devant lui sur la voie : demi-tour immédiat
      if (threat && reverseCooldown <= 0 && threatDist() < G.fleeRadius) {
        const [dx, dy] = dirOf(from, edge);
        const [ax, ay] = away();
        if (dx * ax + dy * ay < -0.35) { reverse(); reverseCooldown = 0.5; }
      }
    } else if (mode === 'cornered') {
      targetAmp = 0;
      speed = 0;
      bounceAt(t);
      // Menace partie, ou trop lent à cliquer : il force le passage et repart en sprint
      if (modeT > G.cornerSeconds || threatDist() > G.fleeRadius * 1.8) {
        setMode('flee');
        calmIn = G.calmSeconds;
        boostIn = G.boostSeconds;
        const e = g.adj[from].filter((q) => main.has(q.to));
        edge = e[Math.floor(Math.random() * e.length)] ?? edge;
        s = 0;
        threat = null;
      }
    } else if (mode === 'caught') {
      // Célébration : grand saut en tournant, puis il disparaît et revient à la fontaine
      targetAmp = 0;
      speed = 0;
      const k = modeT / 1.4;
      if (k < 1) {
        body.position.y = Math.sin(k * Math.PI) * 4 * cfg.scale;
        body.rotation.y = k * Math.PI * 2;
        const sc = cfg.scale * (k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25);
        body.scale.setScalar(Math.max(0.01, sc));
      } else {
        group.visible = false;
        if (respawnAt < 0) respawnAt = t + 1.2;
        if (t >= respawnAt) {
          respawnAt = -1;
          from = startNode;
          edge = pickNext(-1, from);
          s = 0;
          y = NaN;
          setMode('calm');
          walking = false;
          timer = 1.5;
        }
      }
    }

    // Démarrage et arrêt en douceur
    amp += (targetAmp - amp) * Math.min(1, dt * (mode === 'flee' ? 8 : 3));
    const step = speed * amp * dt;
    s += step;
    while (s >= edge.len) {
      s -= edge.len;
      const prev = from;
      from = edge.to;
      if (mode === 'flee') {
        const next = pickFlee(from);
        if (!next) {
          // Coincé au nœud : toutes les issues passent par la menace
          s = 0;
          setMode('cornered');
          break;
        }
        edge = next;
      } else edge = pickNext(prev, from);
    }
    const k = edge.len > 0 ? Math.min(1, s / edge.len) : 0;
    pos[0] = g.x[from] + (g.x[edge.to] - g.x[from]) * k;
    pos[1] = g.y[from] + (g.y[edge.to] - g.y[from]) * k;
    // Au galop, les pas sont plus longs
    const stride = cfg.stride * cfg.scale * (mode === 'flee' ? 1.8 : 1);
    uniforms.uPhase.value = (uniforms.uPhase.value + step / stride) % 1;
    uniforms.uAmp.value = amp;

    // Cap lissé (la position, elle, reste exactement sur la voie). Coincé : il fait face à la menace
    let target = Math.atan2(g.y[edge.to] - g.y[from], g.x[edge.to] - g.x[from]);
    if (mode === 'cornered' && threat) target = Math.atan2(threat[1] - pos[1], threat[0] - pos[0]);
    let d = target - heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    heading += d * Math.min(1, dt * (mode === 'flee' ? 10 : 4));
    // Altitude lissée : pas de saut à l'entrée d'un pont
    const ty = heightAt(pos[0], pos[1]) + edge.lift;
    y = Number.isNaN(y) ? ty : y + (ty - y) * Math.min(1, dt * 6);

    group.position.set(pos[0], y, -pos[1]);
    // Modèle orienté vers +X ; en Three.js, le nord (y OSM) est vers -Z
    group.rotation.y = heading;
  }

  const startNode = from;
  update(0, 0);
  return {
    group, hit, update, setThreat, tryCatch,
    position: () => [pos[0], pos[1]],
    mode: () => mode,
    height: () => y,
    time: () => lastT,
    debug: () => ({ from, to: edge.to, s: +s.toFixed(2), len: +edge.len.toFixed(2), mode, deg: g.adj[from].length }),
  };
}
