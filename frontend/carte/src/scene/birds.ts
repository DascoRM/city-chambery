import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CityData, HeightFn, Pt, Ticker } from '../types';
import { pointInPoly } from './geo';
import type { NightUniforms } from './city';

/**
 * Pigeons et oiseaux (EP001-US004). Décor : ce n'est pas un relevé d'oiseaux réels.
 *  - Des volées de pigeons sur les places (espaces `plaza` d'OSM assez grands) près du point regardé : ils picorent,
 *    font quelques pas ; toutes les 40 à 90 s la volée s'envole, tourne au-dessus de la place et se repose, sur la
 *    même place ou sur une autre proche. Une volée dont la place sort du rayon autour du point regardé s'envole vers
 *    une place du rayon (ou y est replacée si elle n'est pas à l'écran).
 *  - Quelques oiseaux tournent haut au-dessus de la cathédrale et du château, en alternant battements et vol plané.
 *  - Seulement de jour : ils disparaissent en fondu quand la nuit tombe (`uNight`).
 * Rendu : un seul maillage instancié (corps et ailes faits en code), battement d'ailes dans le shader ; pas d'ombre,
 * pas de cible de clic, pas de pleine vitesse forcée (moving() n'est pas défini).
 */
export interface BirdsConfig {
  pigeons: number;
  flockSize: [number, number];
  circling: number;
  circlingAnchors: string[];
  /** Taille : 1 = un vrai pigeon (≈ 33 cm), agrandi pour être vu à l'échelle de la maquette */
  scale: number;
  /** Rayon (m) autour du point regardé où se posent les volées */
  radius: number;
  /** Surface minimale (m²) d'une place pour accueillir une volée */
  minPlazaArea: number;
  takeoffSeconds: [number, number];
  mobileFactor: number;
  avoid: { anchor: string; radius: number }[];
}

/** Pigeon : corps (+X = avant) et deux ailes plates marquées par l'attribut aWing (−1 gauche, +1 droite) */
function birdGeometry(): THREE.BufferGeometry {
  const mark = (g: THREE.BufferGeometry, wing: number, shade: number) => {
    const n = g.getAttribute('position').count;
    g.setAttribute('aWing', new THREE.BufferAttribute(new Float32Array(n).fill(wing), 1));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(shade), 3));
    g.deleteAttribute('uv');
    return g;
  };
  const body = mark(new THREE.SphereGeometry(0.1, 6, 4).scale(1.7, 0.85, 0.85).translate(0, 0.12, 0), 0, 1);
  const headG = mark(new THREE.SphereGeometry(0.055, 5, 3).translate(0.17, 0.2, 0), 0, 0.85);
  const tail = mark(new THREE.ConeGeometry(0.05, 0.14, 4).rotateZ(Math.PI / 2).translate(-0.2, 0.13, 0), 0, 0.75);
  const wing = (side: number) => {
    const g = new THREE.BufferGeometry();
    // Triangle plat : attache le long du corps, pointe sur le côté (z) un peu en arrière
    g.setAttribute('position', new THREE.Float32BufferAttribute([0.08, 0.15, 0.04 * side, -0.1, 0.15, 0.04 * side, -0.06, 0.15, 0.34 * side], 3));
    g.setIndex(side > 0 ? [0, 1, 2] : [0, 2, 1]);
    g.computeVertexNormals();
    return mark(g, side, 0.7);
  };
  return mergeGeometries([body, headG, tail, wing(1), wing(-1)])!;
}

const GROUND = 0, RISING = 1, CIRCLING = 2, TRAVEL = 3;
/** Angle des ailes repliées le long du corps (au sol) ; un angle positif abaisse les deux ailes */
const FOLDED = 1.3;
const COLORS = ['#8d929c', '#9aa0a8', '#7d828c', '#a7a39b', '#6f6a66', '#c9c6c0'];

interface Plaza { poly: { outer: Pt[]; holes: Pt[][] }; cx: number; cy: number; area: number; x0: number; y0: number; x1: number; y1: number }
interface Pigeon { x: number; y: number; tx: number; ty: number; heading: number; peck: number; wait: number; ox: number; oy: number; oz: number; fx: number; fy: number }
interface Flock { plaza: number; members: number[]; state: number; t: number; timer: number; cx: number; cy: number; cz: number; to: number; ang: number; from: Pt; dest: Pt }

export function buildBirds(
  cfg: BirdsConfig, data: CityData, heightAt: HeightFn, night: NightUniforms,
  view: { camera: THREE.Camera; focus(): THREE.Vector3 },
): (Ticker & { group: THREE.Group; stats(): { flocks: number; onGround: number; flying: number; circling: number; visible: boolean }; flockCenters(): { x: number; y: number; z: number; ground: boolean }[] }) | null {
  const avoid = cfg.avoid.flatMap((a) => (data.anchors[a.anchor] ? [{ c: data.anchors[a.anchor].pos, r: a.radius }] : []));
  const area = (r: Pt[]) => Math.abs(r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
  const plazas: Plaza[] = data.areas
    .filter((a) => a.kind === 'plaza')
    .map((a) => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [x, y] of a.outer) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      return { poly: a, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, area: area(a.outer), x0, y0, x1, y1 };
    })
    .filter((p) => p.area >= cfg.minPlazaArea);
  const mobile = typeof matchMedia === 'function' && (matchMedia('(pointer: coarse)').matches || innerWidth < 700);
  const f = mobile ? cfg.mobileFactor : 1;
  const nPigeons = plazas.length ? Math.round(cfg.pigeons * f) : 0;
  const circleAnchors = cfg.circlingAnchors.flatMap((n) => (data.anchors[n] ? [data.anchors[n].pos] : []));
  const nCircling = circleAnchors.length ? Math.round(cfg.circling * f) : 0;
  const total = nPigeons + nCircling;
  if (!total) return null;

  // --- Maillage ----------------------------------------------------------------
  const flap = new THREE.InstancedBufferAttribute(new Float32Array(total), 1);
  const geo = birdGeometry();
  geo.setAttribute('aFlap', flap);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aWing;\nattribute float aFlap;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        if (aWing != 0.0) {
          // Aile : rotation autour de l'axe du corps (X), vers le haut puis le bas
          float a = aFlap * aWing;
          vec2 r = transformed.yz - vec2(0.15, 0.04 * aWing);
          transformed.yz = vec2(0.15, 0.04 * aWing) + vec2(r.x * cos(a) - r.y * sin(a), r.x * sin(a) + r.y * cos(a));
        }`);
  };
  mat.customProgramCacheKey = () => 'birds';
  const mesh = new THREE.InstancedMesh(geo, mat, total);
  mesh.name = 'birds';
  mesh.frustumCulled = false;
  mesh.castShadow = mesh.receiveShadow = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const color = new THREE.Color();
  for (let i = 0; i < total; i++) mesh.setColorAt(i, color.set(COLORS[Math.floor(Math.random() * COLORS.length)]));
  const group = new THREE.Group();
  group.name = 'birds-group';
  group.add(mesh);

  // --- Places --------------------------------------------------------------------
  const rnd = (r: [number, number]) => r[0] + Math.random() * (r[1] - r[0]);
  const forbidden = (x: number, y: number) => avoid.some((a) => Math.hypot(x - a.c[0], y - a.c[1]) < a.r);
  /** Point au hasard sur une place (près de (nx, ny) dans un rayon `near` si donné) ; null si introuvable */
  const pointOn = (pl: Plaza, nx?: number, ny?: number, near = 0): Pt | null => {
    for (let k = 0; k < 30; k++) {
      const x = near ? nx! + (Math.random() - 0.5) * 2 * near : pl.x0 + Math.random() * (pl.x1 - pl.x0);
      const y = near ? ny! + (Math.random() - 0.5) * 2 * near : pl.y0 + Math.random() * (pl.y1 - pl.y0);
      if (pointInPoly(x, y, pl.poly) && !forbidden(x, y)) return [x, y];
    }
    return null;
  };
  const focus = new THREE.Vector3();
  const inRadius = (pl: Plaza, extra = 0) => Math.hypot(pl.cx - focus.x, pl.cy + focus.z) < cfg.radius + extra;
  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), probe = new THREE.Vector3();
  const onScreen = (x: number, y: number) => frustum.containsPoint(probe.set(x, heightAt(x, y) + 1, -y));
  /** Place du rayon, de préférence près de (x, y) ; -1 si aucune */
  const pickPlaza = (x: number, y: number, maxDist = Infinity, except = -1) => {
    const list = plazas.map((p, i) => ({ i, d: Math.hypot(p.cx - x, p.cy - y) })).filter((o) => o.i !== except && inRadius(plazas[o.i]) && o.d < maxDist);
    if (!list.length) return -1;
    list.sort((a, b) => a.d - b.d);
    return list[Math.floor(Math.random() * Math.min(3, list.length))].i;
  };

  // --- Volées --------------------------------------------------------------------
  const pigeons: Pigeon[] = [];
  const flocks: Flock[] = [];
  focus.copy(view.focus());
  let used = 0;
  while (used < nPigeons) {
    const size = Math.min(nPigeons - used, Math.round(rnd(cfg.flockSize)));
    flocks.push({ plaza: -1, members: Array.from({ length: size }, (_, k) => used + k), state: GROUND, t: 0, timer: rnd(cfg.takeoffSeconds), cx: 0, cy: 0, cz: 0, to: -1, ang: 0, from: [0, 0], dest: [0, 0] });
    used += size;
  }
  for (let i = 0; i < nPigeons; i++) pigeons.push({ x: 0, y: 0, tx: 0, ty: 0, heading: Math.random() * 6.28, peck: Math.random() * 3, wait: Math.random() * 2, ox: 0, oy: 0, oz: 0, fx: 0, fy: 0 });
  /** Pose une volée sur une place : chaque pigeon à un endroit au hasard autour d'un point de la place */
  const settle = (fl: Flock, plaza: number) => {
    fl.plaza = plaza;
    fl.state = GROUND;
    fl.timer = rnd(cfg.takeoffSeconds);
    const pl = plazas[plaza];
    const c = pointOn(pl) ?? [pl.cx, pl.cy];
    fl.cx = c[0]; fl.cy = c[1];
    for (const i of fl.members) {
      const p = pigeons[i];
      const q = pointOn(pl, c[0], c[1], 3) ?? c;
      p.x = p.tx = q[0]; p.y = p.ty = q[1];
    }
  };
  const used0 = new Set<number>();
  for (const fl of flocks) {
    let pi = -1;
    for (let k = 0; k < 6 && (pi < 0 || used0.has(pi)); k++) pi = pickPlaza(focus.x + (Math.random() - 0.5) * cfg.radius, -focus.z + (Math.random() - 0.5) * cfg.radius);
    if (pi < 0) pi = Math.floor(Math.random() * plazas.length);
    used0.add(pi);
    settle(fl, pi);
  }
  /** Envol : la volée monte, tourne au-dessus de la place, puis va se poser sur `to` */
  const takeOff = (fl: Flock, to: number) => {
    fl.state = RISING;
    fl.t = 0;
    fl.to = to;
    fl.cz = heightAt(fl.cx, fl.cy);
    for (const i of fl.members) {
      const p = pigeons[i];
      p.ox = p.x - fl.cx; p.oy = p.y - fl.cy; p.oz = 0;
      p.fx = (Math.random() - 0.5) * 4; p.fy = (Math.random() - 0.5) * 4; // place dans la volée en vol
    }
  };

  // --- Oiseaux qui tournent -------------------------------------------------------------
  const circlers = Array.from({ length: nCircling }, (_, k) => {
    const c = circleAnchors[k % circleAnchors.length];
    return { c, r: 22 + Math.random() * 18, h: heightAt(c[0], c[1]) + 32 + Math.random() * 14, w: (0.25 + Math.random() * 0.12) * (Math.random() < 0.5 ? 1 : -1), a: Math.random() * 6.28, flapT: Math.random() * 4 };
  });

  // --- Animation ---------------------------------------------------------------------
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), qp = new THREE.Quaternion(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3(0, 0, 1);
  let vis = 0, check = 0, t = 0;
  const place = (i: number, x: number, y: number, z: number, heading: number, pitch: number, wing: number, scale: number) => {
    q.setFromAxisAngle(up, heading).multiply(qp.setFromAxisAngle(side, pitch));
    m.compose(p3.set(x, z, -y), q, s3.setScalar(scale));
    mesh.setMatrixAt(i, m);
    flap.setX(i, wing);
  };

  const update = (dt: number) => {
    t += dt;
    // Jour seulement : fondu quand la nuit tombe
    const target = 1 - THREE.MathUtils.smoothstep(night.uNight.value, 0.1, 0.6);
    vis += (target - vis) * Math.min(1, dt * 2);
    mesh.visible = vis > 0.01;
    if (!mesh.visible) return;
    const sc = cfg.scale * vis;

    // Deux fois par seconde : les volées hors du rayon autour du point regardé en rejoignent une place
    check -= dt;
    if (check <= 0) {
      check = 0.5;
      focus.copy(view.focus());
      view.camera.updateMatrixWorld();
      frustum.setFromProjectionMatrix(pv.multiplyMatrices(view.camera.projectionMatrix, view.camera.matrixWorldInverse));
      for (const fl of flocks) {
        if (fl.state !== GROUND || inRadius(plazas[fl.plaza], 60)) continue;
        const to = pickPlaza(focus.x, -focus.z);
        if (to < 0) continue;
        if (onScreen(fl.cx, fl.cy) || onScreen(plazas[to].cx, plazas[to].cy)) takeOff(fl, to); // on les voit : ils volent jusque-là
        else settle(fl, to); // personne ne regarde : ils y sont déjà
      }
    }

    for (const fl of flocks) {
      fl.t += dt;
      const ground = heightAt(fl.cx, fl.cy);
      if (fl.state === GROUND) {
        fl.timer -= dt;
        if (fl.timer <= 0) {
          // Même place (60 %) ou une place proche
          const other = Math.random() < 0.4 ? pickPlaza(fl.cx, fl.cy, 160, fl.plaza) : -1;
          takeOff(fl, other >= 0 ? other : fl.plaza);
        }
        for (const i of fl.members) {
          const p = pigeons[i];
          p.wait -= dt;
          const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
          if (d > 0.02) {
            const step = Math.min(d, 0.35 * dt);
            p.x += (dx / d) * step; p.y += (dy / d) * step;
            p.heading += Math.atan2(Math.sin(Math.atan2(dy, dx) - p.heading), Math.cos(Math.atan2(dy, dx) - p.heading)) * Math.min(1, dt * 8);
          } else if (p.wait <= 0) {
            // Quelques pas vers un autre point de la place
            const pt = pointOn(plazas[fl.plaza], p.x, p.y, 1.2);
            if (pt) { p.tx = pt[0]; p.ty = pt[1]; }
            p.wait = 1.5 + Math.random() * 4;
          }
          // Picore : le corps bascule vers l'avant par à-coups quand il est arrêté
          p.peck += dt;
          const pecking = d <= 0.02 ? Math.max(0, Math.sin(p.peck * 7)) * (Math.sin(p.peck * 0.9) > 0 ? 1 : 0) : 0;
          const hop = d > 0.02 ? 0.02 * Math.abs(Math.sin(p.peck * 14)) : 0;
          place(i, p.x, p.y, heightAt(p.x, p.y) + 0.04 + hop, p.heading, -0.5 * pecking, FOLDED, sc);
        }
        continue;
      }
      // En vol : montée, tour au-dessus de la place, trajet, descente
      let cx = fl.cx, cy = fl.cy, cz = fl.cz, heading = 0;
      const H = 9;
      if (fl.state === RISING) {
        const k = Math.min(1, fl.t / 1.6);
        cz = ground + H * k * (2 - k);
        if (k >= 1) { fl.state = CIRCLING; fl.t = 0; fl.ang = Math.random() * 6.28; }
      } else if (fl.state === CIRCLING) {
        const R = 9, dur = 7;
        fl.ang += dt * 0.9;
        cx = fl.cx + Math.cos(fl.ang) * R * Math.min(1, fl.t); cy = fl.cy + Math.sin(fl.ang) * R * Math.min(1, fl.t);
        cz = ground + H;
        heading = fl.ang + Math.PI / 2;
        if (fl.t > dur) {
          fl.cx = cx; fl.cy = cy;
          const pl = plazas[fl.to];
          const dest = (fl.to === fl.plaza ? pointOn(pl, fl.cx, fl.cy, 12) : null) ?? pointOn(pl) ?? [pl.cx, pl.cy];
          fl.state = TRAVEL; fl.t = 0;
          fl.from = [cx, cy];
          fl.dest = dest;
        }
      } else {
        const fx = fl;
        const dist = Math.hypot(fx.dest[0] - fx.from[0], fx.dest[1] - fx.from[1]);
        const k = Math.min(1, fl.t / Math.max(1.5, dist / 7));
        const e = k * k * (3 - 2 * k);
        cx = fx.from[0] + (fx.dest[0] - fx.from[0]) * e; cy = fx.from[1] + (fx.dest[1] - fx.from[1]) * e;
        const g2 = heightAt(cx, cy);
        cz = g2 + (H + Math.min(10, dist * 0.08)) * Math.sin(Math.PI * (0.5 + 0.5 * k)) * (k < 0.8 ? 1 : (1 - k) / 0.2) + 0.04;
        heading = Math.atan2(fx.dest[1] - fx.from[1], fx.dest[0] - fx.from[0]);
        if (k >= 1) {
          fl.plaza = fl.to; fl.state = GROUND; fl.timer = rnd(cfg.takeoffSeconds);
          fl.cx = fx.dest[0]; fl.cy = fx.dest[1];
          for (const i of fl.members) {
            const p = pigeons[i];
            const pt = pointOn(plazas[fl.plaza], fl.cx, fl.cy, 3) ?? fx.dest;
            p.x = p.tx = pt[0]; p.y = p.ty = pt[1];
            p.wait = 0.5 + Math.random() * 2;
          }
          continue;
        }
      }
      for (const i of fl.members) {
        const p = pigeons[i];
        const blend = fl.state === RISING ? Math.min(1, fl.t / 1.6) : 1; // au décollage, ils quittent leur place au sol
        const x = cx + p.ox * (1 - blend) + p.fx * blend, y = cy + p.oy * (1 - blend) + p.fy * blend;
        const z = cz + (Math.sin(t * 2 + i) * 0.4 + p.fx * 0.15) * blend;
        place(i, x, y, z, fl.state === RISING ? p.heading : heading, fl.state === RISING ? -0.4 : 0, 0.9 * Math.sin(t * 22 + i * 1.7), sc);
      }
    }

    // Oiseaux qui tournent : battements puis vol plané
    circlers.forEach((c, k) => {
      c.a += c.w * dt;
      c.flapT += dt;
      const flapping = (c.flapT % 5) < 1.6;
      const x = c.c[0] + Math.cos(c.a) * c.r, y = c.c[1] + Math.sin(c.a) * c.r;
      const heading = c.a + (c.w > 0 ? Math.PI / 2 : -Math.PI / 2);
      place(nPigeons + k, x, y, c.h + Math.sin(c.a * 3) * 1.5, heading, 0, flapping ? 0.9 * Math.sin(t * 16 + k) : -0.12, sc * 1.25);
    });

    mesh.instanceMatrix.needsUpdate = true;
    flap.needsUpdate = true;
  };
  update(0);
  return {
    group, update,
    stats: () => ({
      flocks: flocks.length,
      onGround: flocks.filter((f) => f.state === GROUND).reduce((s, f) => s + f.members.length, 0),
      flying: flocks.filter((f) => f.state !== GROUND).reduce((s, f) => s + f.members.length, 0),
      circling: nCircling,
      visible: mesh.visible,
    }),
    /** Pour les vérifications (?debug) : centre de chaque volée, en coordonnées Three.js */
    flockCenters: () => flocks.map((f) => ({ x: f.cx, y: heightAt(f.cx, f.cy), z: -f.cy, ground: f.state === GROUND })),
  };
}
