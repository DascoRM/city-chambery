import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CityData, Pt, Ticker } from '../types';
import { planRoof } from './roofs';
import { createParticles, type EmitOptions } from './particles';
import type { NightUniforms } from './city';
import type { Season } from '../time/seasons';
import { weatherSurface } from './weather-surface';

/**
 * Cheminées et fumée (EP001-US005). Décor, pas un relevé : OpenStreetMap ne donne pas les cheminées. Elles sont
 * posées au hasard stable (hachage de l'identifiant OSM) sur une part des toits en pente « rectangle » (deux pans, croupes,
 * pyramide), sur l'axe du toit.
 *  - Les cheminées (briques et chapeau, faites en code) sont dessinées toute l'année : un maillage instancié.
 *  - La fumée suit la **saison seulement** (décision de Dasco) : printemps légère, été aucune, automne moyenne,
 *    hiver dense ; seules les cheminées proches du point regardé fument (au plus `maxEmitters`).
 *  - Réserve de particules à part de celle du mini-jeu ; la fumée dérive avec le vent ; la nuit, elle est émise
 *    plus sombre (pas de lueur) ; elle ne force pas la pleine vitesse (moving() n'est pas défini).
 */
export interface SmokeConfig {
  /** Part des toits à pans (assez hauts) qui ont une cheminée, 0 à 1 */
  share: number;
  /** Distance (m) au point regardé au-delà de laquelle une cheminée ne fume pas */
  distance: number;
  maxEmitters: number;
  /** Bouffées par seconde et par cheminée à densité 1 */
  rate: number;
  /** Densité par saison (0 = pas de fumée) */
  density: Record<Season, number>;
  /** Vent : direction (degrés, 0 = vers l'est, 90 = vers le nord) et vitesse (m/s) */
  wind: { towards: number; speed: number };
}

const BRICK = new THREE.Color('#9c5b43'), CAP = new THREE.Color('#5f5550');

/** Cheminée : souche en briques de 0,7 × 1,8 × 0,7 m et chapeau ; origine au pied, 0,6 m enfoncés dans le toit */
function chimneyGeometry(): THREE.BufferGeometry {
  const paint = (g: THREE.BufferGeometry, c: THREE.Color) => {
    const n = g.getAttribute('position').count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('uv');
    return g;
  };
  return mergeGeometries([
    paint(new THREE.BoxGeometry(0.7, 1.8, 0.7).translate(0, 0.9, 0), BRICK),
    paint(new THREE.BoxGeometry(0.95, 0.12, 0.95).translate(0, 1.86, 0), CAP),
  ])!;
}

export function buildChimneys(
  cfg: SmokeConfig, data: CityData,
  ctx: { minUnder(r: Pt[]): number; hidden: Set<number>; night: NightUniforms; season(): Season; focus(): THREE.Vector3 },
): (Ticker & { group: THREE.Group; count: number; stats(): { emitting: number; particles: number; density: number } }) | null {
  // Toits candidats : deux pans, ou quatre pans avec un faîtage ; pas sous un monument ; pas les petites annexes
  const hash = (id: number) => { const x = Math.sin(id * 12.9898) * 43758.5453; return x - Math.floor(x); };
  const tops: THREE.Vector3[] = [];
  const candidates = data.buildings
    .filter((b) => !ctx.hidden.has(b.id) && b.rect && b.h >= 6)
    .filter((b) => hash(b.id) < cfg.share);
  if (!candidates.length) return null;
  const geo = chimneyGeometry();
  const mesh = new THREE.InstancedMesh(geo, weatherSurface(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }), { wet: 0 }), candidates.length); // neige (EP009-US007)
  mesh.name = 'chimneys';
  mesh.castShadow = mesh.receiveShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  candidates.forEach((b, i) => {
    const plan = planRoof(b)!;
    const r = plan.roof;
    // Sur l'axe du toit (t = 0), décalée vers une extrémité (côté tiré au hasard stable). Sur le faîtage d'un toit à
    // deux pans ; sur un toit à croupes ou pyramidal, le point est sur un pan : on lit la hauteur du toit à cet endroit
    const ridgeHalf = r.s === 'gabled' ? r.a : Math.max(0, r.a - r.b);
    const off = r.s === 'gabled' || ridgeHalf > 1.2 ? ridgeHalf * 0.55 : Math.min(r.a, r.b) * 0.35;
    const s = (hash(b.id * 7 + 1) < 0.5 ? -1 : 1) * off;
    const x = r.cx + r.ux * s, y = r.cy + r.uy * s;
    // Hauteur du toit à la distance |s| du centre : faîtage jusqu'à ridgeHalf, puis pente de la croupe jusqu'au bord (a)
    const beyond = Math.max(0, Math.abs(s) - ridgeHalf), slopeLen = Math.max(0.1, r.a - ridgeHalf);
    const roofHere = ctx.minUnder(b.outer) + plan.eave + r.rise * (1 - Math.min(1, beyond / slopeLen));
    const base = roofHere - 0.6;
    q.setFromAxisAngle(up, Math.atan2(r.uy, r.ux));
    m.compose(new THREE.Vector3(x, base, -y), q, one);
    mesh.setMatrixAt(i, m);
    tops.push(new THREE.Vector3(x, base + 2.0, -y));
  });
  mesh.computeBoundingSphere();

  // --- Fumée ------------------------------------------------------------------------
  const smoke = createParticles(1200, false);
  smoke.points.name = 'chimney-smoke';
  const group = new THREE.Group();
  group.name = 'chimneys-group';
  group.add(mesh, smoke.points);
  const drift: [number, number, number] = [0, 0, 0];
  const DAY = ['#e9e6e1', '#dcd8d1', '#f1efea'], NIGHT = ['#55596a', '#4b4f5e', '#5f6373'];
  const puff: EmitOptions = { count: 1, speed: [0.05, 0.25], up: 1.1, life: [6, 9], size: 1.6, grow: 4, colors: DAY, drag: 0.04, spread: 0.15, drift };
  let emitters: number[] = [];
  const acc = new Float32Array(tops.length);
  let check = 0, density = 0;
  const update = (dt: number) => {
    check -= dt;
    if (check <= 0) {
      check = 0.5;
      // Vent : objet partagé avec les drapeaux, que la météo fait varier (EP009-US009) ; les bouffées suivantes le suivent
      const wa = (cfg.wind.towards * Math.PI) / 180;
      drift[0] = Math.cos(wa) * cfg.wind.speed;
      drift[2] = -Math.sin(wa) * cfg.wind.speed;
      density = cfg.density[ctx.season()] ?? 0;
      const f = ctx.focus(), d2 = cfg.distance * cfg.distance;
      emitters = tops.map((t, i) => ({ i, d: (t.x - f.x) ** 2 + (t.z - f.z) ** 2 })).filter((o) => o.d < d2).sort((a, b) => a.d - b.d).slice(0, cfg.maxEmitters).map((o) => o.i);
      // La nuit, la fumée n'est pas éclairée : émise sombre (mélange selon uNight)
      puff.colors = ctx.night.uNight.value > 0.5 ? NIGHT : DAY;
    }
    if (density > 0) {
      for (const i of emitters) {
        acc[i] += cfg.rate * density * dt;
        while (acc[i] >= 1) { acc[i] -= 1; smoke.emit(tops[i], puff); }
      }
    }
    smoke.update(dt);
  };
  return {
    group, count: tops.length, update,
    stats: () => ({ emitting: density > 0 ? emitters.length : 0, particles: smoke.alive(), density }),
  };
}
