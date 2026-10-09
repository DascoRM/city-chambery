import * as THREE from 'three';
import type { QualityLevel } from '../scene/quality';
import type { CityData } from '../types';

/**
 * Pluie (EP009-US005), calculée par le processeur graphique : chaque traînée est un quadrilatère dont la position est calculée dans
 * le vertex shader à partir de l'avancée de la chute (aucune mise à jour des sommets par le processeur, tampon fixe). Deux nappes,
 * un appel de rendu chacune, un seul programme :
 *  - proche : boîte de 280 m autour du point regardé, gouttes courtes (en rue) ;
 *  - lointaine : tout le socle, traînées longues (vue d'ensemble) ;
 * en fondu selon la distance caméra – point regardé. La chute et la dérive du vent sont cumulées par le processeur : la vitesse peut
 * suivre le zoom sans que les gouttes sautent. Au-dessus du socle seulement (D11) : une goutte hors du socle est écartée, et le
 * mélange ne la pose que là où quelque chose est déjà dessiné (alpha de la destination) : vue de côté, rien sur le fond de page.
 */

/** Traînées par niveau de qualité, à intensité 1 : valeurs par défaut tirées des mesures du Mac, à confirmer sur iPhone (US001) */
export const RAIN_COUNT: Record<QualityLevel, number> = { low: 1200, medium: 2500, high: 5000 };

const smooth = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** Poids des deux nappes selon la distance caméra – point regardé (m) : proche en rue, lointaine en vue d'ensemble */
export const layerWeights = (d: number) => ({ near: 1 - smooth(300, 900, d), far: smooth(250, 800, d) });

/** Chute (m/s « de maquette ») et longueur des traînées (m), continues avec la distance : à l'écran, à peu près la même allure à tous les zooms */
export const layerMotion = (far: boolean, d: number) =>
  far ? { fall: clamp(d * 0.1, 100, 330), len: clamp(d * 0.009, 10, 30) } : { fall: clamp(d * 0.12, 20, 90), len: clamp(d * 0.018, 3, 9) };

/** Bruine ou averse : traînées plus longues et plus marquées quand l'intensité monte */
export const rainLook = (intensity: number) => ({ len: 0.6 + 0.8 * intensity, opacity: 0.6 + 0.5 * intensity });

/** Inclinaison des traînées par le vent : pente horizontale par m/s de vent « de maquette » */
const SLANT = 0.13;
/** Remise à zéro de la chute cumulée (précision des flottants dans le shader) : une fois par heure environ */
const WRAP = 1e6;

const VERT = /* glsl */ `
  attribute vec4 aSeed; attribute vec2 aCorner; attribute float aIdx;
  uniform vec3 uCenter, uDir; uniform vec4 uBox, uBounds;
  uniform float uPhase, uLen, uWidth, uOpacity, uDensity;
  uniform vec2 uDrift, uRes;
  varying float vAlpha; varying float vSide; varying float vAlong;
  void main() {
    vAlpha = 0.0; vSide = 0.0; vAlong = 0.0;
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    float keep = 1.0 - smoothstep(uDensity - 0.04, uDensity, aIdx);
    if (keep <= 0.0) return;
    vec3 p = vec3(aSeed.x * 2.0 * uBox.x + uDrift.x, aSeed.z * uBox.z - uPhase * (0.85 + 0.3 * aSeed.w), aSeed.y * 2.0 * uBox.y + uDrift.y);
    p.xz = uCenter.xz + mod(p.xz - uCenter.xz + uBox.xy, 2.0 * uBox.xy) - uBox.xy;
    p.y = uBox.w + mod(p.y, uBox.z);
    float inside = min(min(p.x - uBounds.x, uBounds.y - p.x), min(p.z - uBounds.z, uBounds.w - p.z));
    if (inside < 0.0) return;
    vec4 c0 = projectionMatrix * viewMatrix * vec4(p, 1.0);
    vec4 c1 = projectionMatrix * viewMatrix * vec4(p - uDir * uLen, 1.0);
    if (c0.w < 1.0 || c1.w < 1.0) return;
    vec2 e = abs(p.xz - uCenter.xz) / uBox.xy;
    float fade = keep * (1.0 - smoothstep(0.75, 1.0, max(e.x, e.y))) * (1.0 - smoothstep(0.8, 1.0, (p.y - uBox.w) / uBox.z)) * smoothstep(0.0, 20.0, inside);
    vec4 c = mix(c0, c1, aCorner.x);
    vec2 d = (c1.xy / c1.w - c0.xy / c0.w) * uRes;
    vec2 dir = length(d) > 1e-4 ? normalize(d) : vec2(0.0, 1.0);
    c.xy += vec2(-dir.y, dir.x) * aCorner.y * uWidth / uRes * c.w;
    gl_Position = c;
    vAlpha = uOpacity * fade; vSide = aCorner.y; vAlong = aCorner.x;
  }`;
const FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha; varying float vSide; varying float vAlong;
  void main() {
    float a = vAlpha * (1.0 - vSide * vSide) * mix(1.0, 0.2, vAlong);
    gl_FragColor = vec4(uColor * a, a);
  }`;

const DAY = new THREE.Color('#dfe8f2'), NIGHT = new THREE.Color('#7c88a8');

/** Une nappe : `count` traînées (4 sommets chacune), dans l'ordre d'un tirage au hasard (aIdx) : la densité garde les premières */
function layer(count: number, bounds: CityData['bounds'], material: THREE.ShaderMaterial, width: number) {
  const seeds = new Float32Array(count * 16), corners = new Float32Array(count * 8), idx = new Float32Array(count * 4), index = new Uint32Array(count * 6);
  for (let i = 0; i < count; i++) {
    const s = [Math.random(), Math.random(), Math.random(), Math.random()];
    for (let k = 0; k < 4; k++) {
      seeds.set(s, (i * 4 + k) * 4);
      corners.set([k >> 1, k & 1 ? 1 : -1], (i * 4 + k) * 2);
      idx[i * 4 + k] = (i + 0.5) / count;
    }
    const b = i * 4;
    index.set([b, b + 1, b + 2, b + 2, b + 1, b + 3], i * 6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 12), 3)); // inutilisé (three.js l'exige)
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  geo.setAttribute('aCorner', new THREE.BufferAttribute(corners, 2));
  geo.setAttribute('aIdx', new THREE.BufferAttribute(idx, 1));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  const mat = material.clone(); // même programme pour les deux nappes, uniformes à part
  const u = mat.uniforms;
  u.uBounds.value.set(bounds.minX, bounds.maxX, -bounds.maxY, -bounds.minY);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; // positions calculées dans le shader
  mesh.renderOrder = 6;
  mesh.visible = false;
  const size = new THREE.Vector2();
  mesh.onBeforeRender = (renderer) => {
    u.uRes.value.copy(renderer.getDrawingBufferSize(size));
    u.uWidth.value = width * renderer.getPixelRatio();
  };
  return { mesh, u, phase: 0, drift: new THREE.Vector2() };
}

export function createRain(scene: THREE.Scene, count: number, bounds: CityData['bounds']) {
  const base = new THREE.ShaderMaterial({
    uniforms: {
      uCenter: { value: new THREE.Vector3() }, uDir: { value: new THREE.Vector3(0, -1, 0) },
      uBox: { value: new THREE.Vector4() }, uBounds: { value: new THREE.Vector4() },
      uPhase: { value: 0 }, uLen: { value: 4 }, uWidth: { value: 1.3 }, uOpacity: { value: 0.5 }, uDensity: { value: 0 },
      uDrift: { value: new THREE.Vector2() }, uRes: { value: new THREE.Vector2(1, 1) }, uColor: { value: new THREE.Color() },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide, // l'orientation du quadrilatère dépend du sens du trait à l'écran
    // Couleur prémultipliée posée seulement là où quelque chose est déjà dessiné (alpha de la destination) ; l'alpha ne change pas
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.DstAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  });
  const near = layer(count, bounds, base, 1.5), far = layer(count, bounds, base, 1.2);
  near.mesh.name = 'rain-near';
  far.mesh.name = 'rain-far';
  scene.add(near.mesh, far.mesh);
  const cx = (bounds.minX + bounds.maxX) / 2, cz = -(bounds.minY + bounds.maxY) / 2;
  const hx = (bounds.maxX - bounds.minX) / 2 + 40, hz = (bounds.maxY - bounds.minY) / 2 + 40;
  const color = new THREE.Color(), dir = new THREE.Vector3();

  return {
    /** Appels de rendu de la pluie à cette image (0, 1 ou 2) */
    visible: () => +near.mesh.visible + +far.mesh.visible,
    /**
     * À chaque image où il pleut. intensity : 0..1 (déjà multipliée par la règle de dégradation) ; d : distance caméra – point regardé ;
     * wind : m/s « de maquette » et direction où il va (degrés, 0 = est, 90 = nord) ; slow : 0,3 avec le réduit-mouvement.
     */
    update(dt: number, focus: THREE.Vector3, d: number, intensity: number, rawIntensity: number, wind: { speed: number; towards: number }, night: number, slow: number) {
      const w = layerWeights(d), look = rainLook(rawIntensity);
      const a = (wind.towards * Math.PI) / 180, s = wind.speed * SLANT;
      dir.set(Math.cos(a) * s, -1, -Math.sin(a) * s).normalize();
      color.copy(DAY).lerp(NIGHT, night);
      for (const [l, isFar, weight] of [[near, false, w.near], [far, true, w.far]] as const) {
        const density = intensity * weight;
        l.mesh.visible = density > 0.002;
        if (!l.mesh.visible) continue;
        const m = layerMotion(isFar, d), u = l.u;
        l.phase = (l.phase + m.fall * dt * slow) % WRAP;
        l.drift.x = (l.drift.x + Math.cos(a) * s * m.fall * dt * slow) % WRAP;
        l.drift.y = (l.drift.y - Math.sin(a) * s * m.fall * dt * slow) % WRAP;
        u.uPhase.value = l.phase;
        u.uDrift.value.copy(l.drift);
        u.uDir.value.copy(dir);
        u.uLen.value = m.len * look.len;
        u.uOpacity.value = (isFar ? 0.42 : 0.55) * look.opacity;
        u.uDensity.value = density;
        u.uColor.value.copy(color);
        if (isFar) {
          u.uCenter.value.set(cx, focus.y, cz);
          u.uBox.value.set(hx, hz, 450, focus.y - 80);
        } else {
          u.uCenter.value.copy(focus);
          u.uBox.value.set(140, 140, 130, focus.y - 30);
        }
      }
    },
    hide() { near.mesh.visible = far.mesh.visible = false; },
  };
}
export type Rain = ReturnType<typeof createRain>;
