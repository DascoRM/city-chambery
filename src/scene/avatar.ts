import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HeightFn, Pt, Ticker } from '../types';
import type { PathPoint, Pathfinder, RouteFail } from './avatar-path';
import { HIP, bodyGeometry, headGeometry } from './people';

/**
 * L'avatar de la balade (EP005-US002) : la silhouette des passants, agrandie, d'une couleur franche,
 * avec une tache au sol cerclée (ombre en tache : la carte d'ombres est statique) et un anneau qui pulse
 * sur le point d'arrivée. Trois appels de rendu. Il suit le chemin calculé par avatar-path.ts.
 */
export interface AvatarConfig {
  /** Échelle de la silhouette passante (1,7 m à l'échelle 1) */
  scale: number;
  /** Vitesse de marche (m/s) */
  speed: number;
  /** Distance (m) d'un cycle complet des jambes */
  stride: number;
  /** Amplitude (rad) des jambes */
  swing: number;
  /** Rebond (m, à l'échelle 1) à chaque pas */
  bounce: number;
  /** Distance (m) avant l'arrivée où il ralentit */
  slowDistance: number;
  colors: { top: string; legs: string; skin: string; halo: string; ring: string };
  /** Rayon (m) de la tache au sol et de l'anneau d'arrivée */
  haloRadius: number;
  ringRadius: number;
}

export interface Avatar extends Ticker {
  group: THREE.Group;
  /** Position (m) dans le plan de la ville, ou null s'il n'a pas été posé */
  position(): Pt | null;
  /** Pose l'avatar sur le réseau, au plus près de (x, y) : le rend visible */
  place(x: number, y: number): boolean;
  hide(): void;
  /** Ordre de marche ; `false` si refusé ('far' : à plus de maxSnap d'une voie) */
  goTo(x: number, y: number): true | RouteFail;
  walking(): boolean;
}

export function buildAvatar(cfg: AvatarConfig, heightAt: HeightFn, pf: Pathfinder): Avatar {
  const group = new THREE.Group();
  group.name = 'avatar';
  group.visible = false;

  // Silhouette : une seule géométrie (corps + tête), couleurs dans les sommets, jambes animées par uniforme
  const col = (hex: string) => new THREE.Color(hex);
  const top = col(cfg.colors.top), legs = col(cfg.colors.legs), skin = col(cfg.colors.skin);
  const paint = (g: THREE.BufferGeometry, pick: (leg: number) => THREE.Color) => {
    const n = g.getAttribute('position').count, leg = g.getAttribute('aLeg');
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const k = pick(leg ? leg.getX(i) : 0); c[i * 3] = k.r; c[i * 3 + 1] = k.g; c[i * 3 + 2] = k.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return g;
  };
  const bodyG = paint(bodyGeometry(), (leg) => (leg !== 0 ? legs : top));
  const headG = headGeometry();
  headG.setAttribute('aLeg', new THREE.BufferAttribute(new Float32Array(headG.getAttribute('position').count), 1));
  headG.deleteAttribute('uv');
  paint(headG, () => skin);
  const geo = mergeGeometries([bodyG.index ? bodyG.toNonIndexed() : bodyG, headG.index ? headG.toNonIndexed() : headG])!;
  const uSwing = { value: 0 };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSwing = uSwing;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aLeg;\nuniform float uSwing;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        if (aLeg != 0.0) {
          float a = uSwing * aLeg;
          vec2 r = transformed.xy - vec2(0.0, ${HIP.toFixed(2)});
          transformed.xy = vec2(0.0, ${HIP.toFixed(2)}) + vec2(r.x * cos(a) - r.y * sin(a), r.x * sin(a) + r.y * cos(a));
        }`);
  };
  mat.customProgramCacheKey = () => 'avatar-body';
  const body = new THREE.Mesh(geo, mat);
  body.name = 'avatar-body';
  body.frustumCulled = false;
  body.scale.setScalar(cfg.scale);
  group.add(body);

  // Tache au sol : ombre douce au centre, cercle franc au bord (repère de loin)
  const halo = disc(cfg.colors.halo, true);
  halo.scale.set(cfg.haloRadius * 2, 1, cfg.haloRadius * 2);
  halo.name = 'avatar-halo';
  group.add(halo);

  // Anneau d'arrivée
  const ring = disc(cfg.colors.ring, false);
  ring.name = 'avatar-ring';
  ring.visible = false;
  group.add(ring);

  let placed = false;
  let x = 0, y = 0, heading = 0, speed = 0, phase = 0, pulse = 0;
  let path: PathPoint[] = [];
  let seg = 0, along = 0;      // segment courant et distance parcourue sur ce segment
  let remaining = 0;           // longueur restante du chemin
  let lift = 0;
  let dest: Pt | null = null;
  const up = new THREE.Vector3(0, 1, 0);

  const put = () => {
    group.position.set(x, 0, -y);
    const ground = heightAt(x, y) + lift;
    body.position.y = ground + Math.abs(Math.sin(phase * Math.PI)) * cfg.bounce * cfg.scale * Math.min(1, speed / cfg.speed);
    body.quaternion.setFromAxisAngle(up, heading);
    halo.position.y = ground + 0.3; // au-dessus du relief : une pente enterrerait la moitié d'un disque posé à plat
    if (dest) ring.position.set(dest[0] - x, heightAt(dest[0], dest[1]) + 0.3, -(dest[1] - y));
  };

  const place = (px: number, py: number) => {
    const s = pf.snap(px, py, 1e4);
    if (!s) return false;
    x = s.x; y = s.y; lift = s.lift;
    path = []; dest = null; speed = 0; remaining = 0;
    ring.visible = false;
    placed = true;
    group.visible = true;
    put();
    return true;
  };

  const goTo = (tx: number, ty: number): true | RouteFail => {
    if (!placed) return 'unreachable';
    const r = pf.route([x, y], [tx, ty]);
    if (typeof r === 'string') return r;
    // Part de la position courante (pas de téléportation sur le réseau si l'avatar l'a quitté)
    path = Math.hypot(r.points[0].x - x, r.points[0].y - y) > 0.3 ? [{ x, y, lift }, ...r.points] : r.points;
    seg = 0; along = 0;
    remaining = 0;
    for (let i = 1; i < path.length; i++) remaining += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    dest = r.end;
    ring.visible = remaining > 0;
    return true;
  };

  const update = (dt: number) => {
    if (!placed) return;
    if (path.length > 1) {
      const target = cfg.speed * Math.max(0.2, Math.min(1, remaining / cfg.slowDistance));
      speed += (target - speed) * Math.min(1, dt * 8);
      let step = speed * dt;
      while (step > 0 && seg < path.length - 1) {
        const a = path[seg], b = path[seg + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const left = len - along;
        if (len > 1e-6) {
          const aim = Math.atan2(b.y - a.y, b.x - a.x);
          heading += Math.atan2(Math.sin(aim - heading), Math.cos(aim - heading)) * Math.min(1, dt * 10);
        }
        if (step < left) { along += step; remaining -= step; step = 0; } else { step -= left; remaining -= left; seg++; along = 0; }
      }
      if (seg >= path.length - 1) {
        const e = path[path.length - 1];
        x = e.x; y = e.y; lift = e.lift;
        path = []; dest = null; speed = 0; remaining = 0;
        ring.visible = false;
      } else {
        const a = path[seg], b = path[seg + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y), k = len > 0 ? along / len : 0;
        x = a.x + (b.x - a.x) * k; y = a.y + (b.y - a.y) * k; lift = a.lift + (b.lift - a.lift) * k;
        phase += (speed * dt) / cfg.stride * 2;
      }
    } else speed = 0;
    // À l'arrêt les jambes se redressent
    uSwing.value = speed > 0.01 ? cfg.swing * Math.sin(phase * Math.PI) * Math.min(1, speed / cfg.speed + 0.3) : uSwing.value * Math.max(0, 1 - dt * 12);
    pulse += dt;
    if (ring.visible) ring.scale.setScalar(cfg.ringRadius * 2 * (1 + 0.18 * Math.sin(pulse * 6)));
    put();
  };

  return {
    group, update, place, goTo,
    hide() { group.visible = false; placed = false; path = []; dest = null; ring.visible = false; speed = 0; },
    position: () => (placed ? [x, y] : null),
    walking: () => path.length > 1,
    moving: () => placed && path.length > 1,
  };
}

/** Disque plat texturé : tache ombrée cerclée (`shadow`) ou simple anneau */
function disc(color: string, shadow: boolean): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  if (shadow) {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 56);
    grad.addColorStop(0, 'rgba(0,0,0,0.45)');
    grad.addColorStop(0.8, 'rgba(0,0,0,0.2)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  }
  g.strokeStyle = color;
  g.lineWidth = shadow ? 5 : 9;
  g.beginPath();
  g.arc(64, 64, shadow ? 56 : 54, 0, Math.PI * 2);
  g.stroke();
  const mat = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat);
  m.renderOrder = 2;
  m.frustumCulled = false;
  return m;
}
