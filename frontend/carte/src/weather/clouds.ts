import * as THREE from 'three';
import type { QualityLevel } from '../scene/quality';
import type { CityData } from '../types';
import { CLOUD_DEAD_ZONE } from './sky';

/**
 * Nuages de maquette (EP009-US010), dans le module météo : des « boules de coton » (icosaèdres aplatis, à fond plat) qui flottent
 * autour du socle, en un seul maillage instancié (1 appel de rendu), avec un petit matériau éclairé à la main (1 programme, rapide à
 * compiler ; ni brouillard ni ombre). Tout se calcule dans le shader à partir de quelques uniformes : aucune mise à jour de tampon.
 *  - Nombre proportionnel à la couverture nuageuse (aucun sous 20 %, comme le ciel) ; ils apparaissent et s'effacent un à un, par
 *    tramage (pas de tri de transparence) ;
 *  - ils dérivent avec le vent dans une boîte autour du socle et s'effacent au-dessus de la ville (lisibilité), au bord de la boîte
 *    (pour revenir de l'autre côté sans saut) et quand ils sont plus près de la caméra que le point regardé ;
 *  - opaques sur le fond de page transparent : la correction des couleurs prémultipliées de la passe finale est mise pendant qu'ils
 *    sont là (effects.ts), sinon un liseré clair les entoure ;
 *  - aucun en qualité basse ; immobiles avec le réduit-mouvement.
 */

/** Nuages par niveau de qualité, à couverture complète */
export const CLOUD_COUNT: Record<QualityLevel, number> = { low: 0, medium: 6, high: 12 };
/** Dérive : m/s par m/s de vent « de maquette » (exagérée, sinon rien ne bouge à l'échelle du socle) */
export const CLOUD_DRIFT = 6;

/** Nuages visibles (nombre, avec une partie fractionnaire pour le fondu du dernier) selon la couverture et le brouillard */
export const cloudShare = (cloud: number, fog: number, max: number) =>
  max * Math.min(1, Math.max(0, (cloud - CLOUD_DEAD_ZONE) / (0.9 - CLOUD_DEAD_ZONE))) * (1 - Math.min(1, fog / 0.3));

/** Tirage reproductible : la même ronde de nuages à chaque visite */
const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

/** Une boule de coton : quelques icosaèdres fusionnés, aplatis, le fond écrasé ; environ 1 m de rayon */
function cottonGeometry(): THREE.BufferGeometry {
  const puffs: [number, number, number, number][] = [[0, 0, 0, 1], [0.95, -0.15, 0.2, 0.7], [-0.9, -0.1, -0.15, 0.75], [0.3, 0.4, -0.45, 0.62], [-0.35, 0.3, 0.5, 0.6], [1.6, -0.3, -0.1, 0.42], [-1.55, -0.3, 0.2, 0.45]];
  const parts = puffs.map(([px, py, pz, r]) => new THREE.IcosahedronGeometry(r, 1).translate(px, py, pz).getAttribute('position').array);
  const pos = new Float32Array(parts.reduce((n, a) => n + a.length, 0));
  parts.reduce((o, a) => { pos.set(a, o); return o + a.length; }, 0);
  for (let i = 1; i < pos.length; i += 3) { const y = pos[i] * 0.6; pos[i] = y < -0.2 ? -0.2 + (y + 0.2) * 0.15 : y; }
  return new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3));
}

const VERT = /* glsl */ `
  uniform vec3 uCenter; uniform vec2 uHalf, uDrift; uniform float uBox, uCount, uFocusDist;
  varying vec3 vWorld; varying float vFade;
  void main() {
    vec3 c = instanceMatrix[3].xyz;
    vec2 w = uCenter.xz + mod(c.xz + uDrift - uCenter.xz + uBox, 2.0 * uBox) - uBox; // centre après la dérive, replié dans la boîte
    vec2 e = abs(w - uCenter.xz);
    vec3 wc = vec3(w.x, c.y, w.y);
    vFade = clamp(uCount - float(gl_InstanceID), 0.0, 1.0)
      * smoothstep(0.0, 180.0, max(e.x - uHalf.x, e.y - uHalf.y))      // pas au-dessus de la ville
      * (1.0 - smoothstep(0.85 * uBox, uBox, max(e.x, e.y)))           // au bord de la boîte, avant de revenir de l'autre côté
      * smoothstep(0.85, 1.1, distance(cameraPosition, wc) / uFocusDist); // pas entre la caméra et le point regardé
    vec4 p = instanceMatrix * vec4(position, 1.0);
    p.xz += w - c.xz;
    vWorld = p.xyz;
    gl_Position = vFade > 0.0 ? projectionMatrix * viewMatrix * p : vec4(2.0, 2.0, 2.0, 1.0);
  }`;
const FRAG = /* glsl */ `
  uniform vec3 uLight, uShade;
  varying vec3 vWorld; varying float vFade;
  void main() {
    // Fondu par tramage, comme les monuments qui s'effacent (cutaway.ts) : pas de tri de transparence
    if (vFade < 0.999 && vFade <= fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))) discard;
    vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld))); // facettes, comme le reste de la maquette
    gl_FragColor = vec4(mix(uShade, uLight, smoothstep(-0.5, 0.9, n.y)), 1.0);
  }`;

const DAY = { light: new THREE.Color('#ffffff').multiplyScalar(1.25), shade: new THREE.Color('#c7cfdc') };
const NIGHT = { light: new THREE.Color('#6b7596'), shade: new THREE.Color('#2e3552') };
const GREY = { light: new THREE.Color('#d9dce2'), shade: new THREE.Color('#8e95a3') };

export function createClouds(scene: THREE.Scene, count: number, bounds: CityData['bounds'], groundY: number) {
  const hx = (bounds.maxX - bounds.minX) / 2, hz = (bounds.maxY - bounds.minY) / 2, size = 2 * Math.max(hx, hz);
  const center = new THREE.Vector3((bounds.minX + bounds.maxX) / 2, groundY, -(bounds.minY + bounds.maxY) / 2);
  const box = Math.max(hx, hz) + 0.5 * size;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uCenter: { value: center }, uHalf: { value: new THREE.Vector2(hx, hz) }, uDrift: { value: new THREE.Vector2() },
      uBox: { value: box }, uCount: { value: 0 }, uFocusDist: { value: 1 },
      uLight: { value: DAY.light.clone() }, uShade: { value: DAY.shade.clone() },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
  });
  const mesh = new THREE.InstancedMesh(cottonGeometry(), material, count);
  mesh.name = 'clouds';
  mesh.frustumCulled = false; // positions déplacées dans le shader
  mesh.visible = false;
  // Hors du socle au départ (entre son bord et celui de la boîte), à 130 à 260 m au-dessus du sol, 50 à 95 m de rayon (environ)
  const r = seeded(9), m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < count; i++) {
    do p.set((r() * 2 - 1) * box * 0.85, 0, (r() * 2 - 1) * box * 0.85); while (Math.max(Math.abs(p.x) - hx, Math.abs(p.z) - hz) < 180);
    p.add(center).setY(groundY + 130 + r() * 130);
    q.setFromAxisAngle(up, r() * Math.PI * 2);
    mesh.setMatrixAt(i, m.compose(p, q, s.setScalar(50 + r() * 45)));
  }
  scene.add(mesh);
  const u = material.uniforms;
  return {
    /**
     * À chaque image où il y a des nuages. share : nuages visibles (cloudShare) ; d : distance caméra – point regardé ;
     * wind : m/s « de maquette » et direction où il va (degrés) ; grey : part de ciel de pluie (0..1) ; slow : 0 avec le réduit-mouvement.
     */
    update(dt: number, share: number, d: number, wind: { speed: number; towards: number }, night: number, grey: number, slow: number) {
      mesh.visible = share > 0.01;
      if (!mesh.visible) return;
      const a = (wind.towards * Math.PI) / 180, k = wind.speed * CLOUD_DRIFT * dt * slow;
      u.uDrift.value.set((u.uDrift.value.x + Math.cos(a) * k) % (2 * box), (u.uDrift.value.y - Math.sin(a) * k) % (2 * box));
      u.uCount.value = share;
      u.uFocusDist.value = d;
      u.uLight.value.copy(DAY.light).lerp(GREY.light, grey).lerp(NIGHT.light, night);
      u.uShade.value.copy(DAY.shade).lerp(GREY.shade, grey).lerp(NIGHT.shade, night);
    },
    /** Appels de rendu des nuages à cette image (0 ou 1) */
    visible: () => +mesh.visible,
  };
}
export type Clouds = ReturnType<typeof createClouds>;
