import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { CityData, HeightFn, Pt } from '../types';
import { dataUrl } from '../dataurl';
import { buildWalkways, mainComponent, wallDistance, type Edge } from './walkways';

/**
 * Mascottes : les quatre éléphants échappés de la fontaine se promènent dans le diorama
 * (itération 33 pour la marche, itération 35 pour le troupeau et le cache-cache).
 *
 * Déplacement : uniquement sur les voies OSM, via le réseau de scene/walkways.ts. Les voies sont transformées en graphe
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
    /** Distance (m) de la fontaine où ils apparaissent en début de partie : [min, max] */
    startDistance: [number, number];
    /** Points par éléphant ramené, et bonus quand la fontaine est complète */
    points: number;
    bonus: number;
    /** Distance minimale (m) entre un lieu de réapparition et la façade la plus proche */
    openSpace: number;
    /** Délai (s) après la fontaine complète avant qu'ils s'échappent de nouveau */
    restartSeconds: number;
    /** Durée d'affichage (s) de la bulle de provocation */
    bubbleSeconds: number;
    /** Clic sur un éléphant : il sprinte `sprintSeconds` à `sprintSpeed` (m/s), puis s'arrête (pause de `pauseSeconds`) */
    sprintSeconds: number;
    sprintSpeed: number;
    /** Un 2e clic pendant le sprint l'attrape avec cette probabilité (0 à 1) ; sinon il se moque (`missTaunts`) */
    catchChance: number;
    /** Souris sur lui : il sursaute et trotte plus vite (m/s) pendant startleSeconds */
    startleSpeed: number;
    startleSeconds: number;
    /** Phrases pour narguer (une au hasard quand il part en sprint), et quand le 2e clic rate */
    taunts: string[];
    missTaunts: string[];
  };
}

/**
 * walk : se promène (ou fait une pause) · sprint : court après un clic, attrapable · flying : vole vers la
 * fontaine · home : sur la fontaine (plus dans les rues)
 */
export type ElephantState = 'walk' | 'sprint' | 'flying' | 'home';

export interface Elephant {
  id: number;
  group: THREE.Group;
  /** Zone de clic (invisible), pour le lancer de rayon */
  hit: THREE.Object3D;
  state(): ElephantState;
  position(): Pt;
  /** Altitude actuelle (Three.js y) */
  height(): number;
  /** Temps de sprint restant (s) : 0 s'il ne sprinte pas */
  sprintLeft(): number;
  /** Cliqué ou touché : il part en sprint (ou le prolonge) ; renvoie false s'il est en vol ou sur la fontaine. */
  sprint(): boolean;
  /** Attrapé (seulement pendant son sprint) : il vole jusqu'à `target` puis appelle onLand. */
  catchTo(target: THREE.Vector3, onLand: () => void): boolean;
  /** Nouvelle partie : il réapparaît dans les rues, loin de la fontaine. */
  release(): void;
  /** Déjà ramené (partie sauvegardée) : il reste sur la fontaine. */
  setHome(): void;
  /** Souris sur lui : il sursaute et accélère un moment (il ne disparaît qu'au clic). */
  startle(): void;
}

export interface Herd {
  group: THREE.Group;
  elephants: Elephant[];
  update(dt: number, t: number): void;
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

/** Ombre « tache » au sol (ce qui bouge ne projette pas d'ombre : la carte des ombres ne suit que le soleil). Partagée avec les passants. */
export function blobShadow(): THREE.Mesh {
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
const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

/** Petites étoiles qui tournent au-dessus de la tête d'un éléphant épuisé */

export async function buildHerd(cfg: MascotConfig, data: CityData, heightAt: HeightFn): Promise<Herd | null> {
  const g = buildWalkways(data, cfg);
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
      mat.fog = false; // repère de jeu : il perce le brouillard (D12 d'EP009), réglé avant la première image
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
    let sprintT = 0; // sprint : temps restant
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

    const el: Elephant = {
      id, group: root, hit,
      state: () => state,
      position: () => [pos[0], pos[1]],
      height: () => y,
      sprintLeft: () => (state === 'sprint' ? sprintT : 0),
      sprint() {
        if (state !== 'walk' && state !== 'sprint') return false;
        if (state === 'walk') setState('sprint');
        sprintT = G.sprintSeconds;
        walking = true;
        return true;
      },
      catchTo(target, onLand) {
        if (state !== 'sprint') return false;
        fly = { a: root.position.clone(), b: target.clone(), top: Math.max(root.position.y, target.y) + 24, onLand };
        setState('flying');
        return true;
      },
      release() {
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
    };
    elephants.push(el);

    updaters.push((dt, t) => {
      uniforms.uTime.value = t + id * 1.7;
      stateT += dt;
      root.visible = state !== 'home';
      if (!root.visible) return;
      body.position.set(0, 0, 0);
      body.rotation.set(0, 0, 0);
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
      } else if (state === 'sprint') {
        // Il détale pendant `sprintSeconds`, puis s'arrête et souffle un moment avant de reprendre sa promenade
        sprintT -= dt;
        targetAmp = 1;
        if (stateT < 0.3) body.position.y = Math.sin((stateT / 0.3) * Math.PI) * 1.1; // petit bond au départ
        speed += (G.sprintSpeed - speed) * Math.min(1, dt * 6);
        if (sprintT <= 0) {
          setState('walk');
          walking = false;
          timer = rnd(cfg.pauseSeconds);
        }
      } else if (state === 'flying' && fly) {
        const k = Math.min(1, stateT / 2.4);
        const e = ease(k);
        root.position.lerpVectors(fly.a, fly.b, e);
        root.position.y = (1 - e) * (1 - e) * fly.a.y + 2 * (1 - e) * e * fly.top + e * e * fly.b.y;
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

      // Le sprint démarre vite (sinon l'éléphant met une seconde à décoller) ; la marche, doucement
      amp = state === 'walk' || state === 'sprint' ? amp + (targetAmp - amp) * Math.min(1, dt * (state === 'sprint' ? 9 : 3)) : 0;
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
      if (state === 'walk' || state === 'sprint') heading += d * Math.min(1, dt * 4);
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
