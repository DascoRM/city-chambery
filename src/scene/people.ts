import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CityData, HeightFn, Ticker } from '../types';
import { buildWalkways, largeComponents, type Edge, type WalkwayOptions } from './walkways';
import { blobShadow } from './mascot';

/**
 * Passants (EP001-US001) : petites silhouettes qui marchent sur les voies OSM, comme les éléphants mais sur
 * leur propre réseau (toutes les voies sauf les escaliers, à 1 m des façades). Décor sans interaction :
 * ni cliquables ni liés au jeu.
 *
 * Foule autour du point regardé : tous les passants sont dans un rayon de `radius` m autour de la cible de la
 * caméra (sur toute la carte, 300 passants feraient un passant tous les 200 m). Un passant qui sort du rayon
 * réapparaît sur une voie à l'intérieur, hors du champ de la caméra quand c'est possible.
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
}

/** Hauteur de la hanche (m), pivot des jambes ; la silhouette mesure 1,7 m à l'échelle 1 */
const HIP = 0.82;
/** Couleurs de vêtements, dans les tons du diorama ; peaux */
const CLOTHES = ['#c8553d', '#2f6690', '#f2a541', '#5b8e7d', '#8e5bd6', '#e07a5f', '#3d405b', '#81b29a', '#d4a373', '#6d597a', '#457b9d', '#e9c46a'];
const SKIN = ['#f1c9a5', '#e0ac85', '#c68863', '#8d5a3b', '#f6dcc5'];

/** Silhouette : deux jambes et un torse (une seule géométrie, jambes marquées par l'attribut aLeg) ; +X = avant */
function bodyGeometry(): THREE.BufferGeometry {
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

function headGeometry(): THREE.BufferGeometry {
  return new THREE.IcosahedronGeometry(0.13, 0).translate(0.02, HIP + 0.62 + 0.15, 0);
}

interface Walker {
  from: number;
  edge: Edge;
  s: number;
  speed: number;
  pause: number;
  phase: number;
  heading: number;
}

export function buildPeople(
  cfg: PeopleConfig, data: CityData, heightAt: HeightFn,
  view: { camera: THREE.Camera; /** Point regardé (coordonnées Three.js) */ focus(): THREE.Vector3 },
): (Ticker & { group: THREE.Group; count: number; nodes: number }) | null {
  const g = buildWalkways(data, cfg.network);
  const mainSet = largeComponents(g, cfg.minComponent);
  const main = [...mainSet];
  if (!main.length) return null;
  const mobile = typeof matchMedia === 'function' && (matchMedia('(pointer: coarse)').matches || innerWidth < 700);
  const count = Math.max(0, Math.round(cfg.max * (mobile ? cfg.mobileFactor : 1)));
  const group = new THREE.Group();
  group.name = 'people';
  if (!count) return { group, count, nodes: main.length, update() {} };

  // --- Maillages -------------------------------------------------------------
  const swing = new THREE.InstancedBufferAttribute(new Float32Array(count), 1); // angle des jambes par passant
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
  const body = new THREE.InstancedMesh(bodyGeo, bodyMat, count);
  const head = new THREE.InstancedMesh(headGeometry(), new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.8 }), count);
  const blob = blobShadow();
  const shadow = new THREE.InstancedMesh(blob.geometry, blob.material as THREE.Material, count);
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

  // --- Passants ----------------------------------------------------------------
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
  /** Nœud au hasard dans le rayon, hors du champ de la caméra si possible */
  const spawnNode = (allowVisible: boolean) => {
    let n = near[Math.floor(Math.random() * near.length)];
    if (allowVisible) return n;
    for (let k = 0; k < 12; k++) {
      probe.set(g.x[n], heightAt(g.x[n], g.y[n]) + 1, -g.y[n]);
      if (!frustum.containsPoint(probe)) return n;
      n = near[Math.floor(Math.random() * near.length)];
    }
    return n;
  };
  const walkers: Walker[] = [];
  for (let i = 0; i < count; i++) {
    const from = near[Math.floor(Math.random() * near.length)];
    const edge = pickNext(-1, from);
    walkers.push({ from, edge, s: Math.random() * edge.len, speed: rnd(cfg.speed), pause: 0, phase: Math.random(), heading: Math.atan2(g.y[edge.to] - g.y[from], g.x[edge.to] - g.x[from]) });
    body.setColorAt(i, color.set(CLOTHES[Math.floor(Math.random() * CLOTHES.length)]));
    head.setColorAt(i, color.set(SKIN[Math.floor(Math.random() * SKIN.length)]));
  }

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const shadowScale = new THREE.Vector3(0.9 * cfg.scale, 1, 0.6 * cfg.scale);
  const STRIDE = 1.3; // distance (m) d'un cycle de pas

  let check = 0;
  const update = (dt: number) => {
    // Deux fois par seconde : les passants sortis du rayon reviennent à l'intérieur
    check -= dt;
    if (check <= 0) {
      check = 0.5;
      const jumped = refreshNear(); // la caméra a sauté loin (vol vers un lieu) : on peut réapparaître à l'écran
      view.camera.updateMatrixWorld();
      frustum.setFromProjectionMatrix(pv.multiplyMatrices(view.camera.projectionMatrix, view.camera.matrixWorldInverse));
      const r2 = (cfg.radius + 20) ** 2;
      for (const w of walkers) {
        const x = g.x[w.from], y = g.y[w.from];
        if ((x - lastFocus.x) ** 2 + (y + lastFocus.z) ** 2 < r2) continue;
        w.from = spawnNode(jumped);
        w.edge = pickNext(-1, w.from);
        w.s = Math.random() * w.edge.len;
        w.heading = Math.atan2(g.y[w.edge.to] - g.y[w.from], g.x[w.edge.to] - g.x[w.from]);
      }
    }
    for (let i = 0; i < count; i++) {
      const w = walkers[i];
      let moving = 1;
      if (w.pause > 0) { w.pause -= dt; moving = 0; }
      else {
        w.s += w.speed * dt;
        while (w.s >= w.edge.len) {
          w.s -= w.edge.len;
          const prev = w.from;
          w.from = w.edge.to;
          w.edge = pickNext(prev, w.from);
          if (Math.random() < cfg.pauseChance) { w.pause = rnd(cfg.pauseSeconds); break; }
        }
        w.phase = (w.phase + (w.speed * dt) / (STRIDE * cfg.scale)) % 1;
      }
      const e = w.edge, k = e.len > 0 ? Math.min(1, w.s / e.len) : 0;
      const x = g.x[w.from] + (g.x[e.to] - g.x[w.from]) * k, y = g.y[w.from] + (g.y[e.to] - g.y[w.from]) * k;
      // Cap lissé : pas de demi-tour instantané à un carrefour
      const target = Math.atan2(g.y[e.to] - g.y[w.from], g.x[e.to] - g.x[w.from]);
      const d = Math.atan2(Math.sin(target - w.heading), Math.cos(target - w.heading));
      w.heading += d * Math.min(1, dt * 6);
      const ground = heightAt(x, y) + e.lift;
      const ph = w.phase * Math.PI * 2;
      swing.setX(i, moving * 0.45 * Math.sin(ph));
      q.setFromAxisAngle(up, w.heading);
      p.set(x, ground + moving * 0.03 * Math.abs(Math.sin(ph)) * cfg.scale, -y);
      m.compose(p, q, sc.setScalar(cfg.scale));
      body.setMatrixAt(i, m);
      head.setMatrixAt(i, m);
      p.y = ground + 0.03;
      m.compose(p, q, shadowScale);
      shadow.setMatrixAt(i, m);
    }
    body.instanceMatrix.needsUpdate = head.instanceMatrix.needsUpdate = shadow.instanceMatrix.needsUpdate = true;
    swing.needsUpdate = true;
  };
  update(0);
  return { group, count, nodes: main.length, update };
}
