import * as THREE from 'three';

/**
 * Crochets de la météo dans les matériaux standards : sol mouillé (EP009-US005) et neige au sol (US007), un seul morceau de GLSL.
 * Posés au démarrage, inactifs (règle 9 : modifier un matériau en cours de route recompile son programme et fige l'image) ; ensuite,
 * le module météo ne règle que les uniformes. Comme `fadeMaterial` (cutaway.ts) : l'`onBeforeCompile` existant est enchaîné, la clé
 * du programme est étendue une fois pour toutes. Par beau temps (`uWet` et `uSnow` à 0), les branches ne sont pas prises : image
 * inchangée. Chaque matériau dit combien il se mouille et se couvre de neige (uniformes à lui : même programme pour tous).
 */
export const weatherUniforms = { uWet: { value: 0 }, uSnow: { value: 0 } };

// Mouillé : plus sombre et un peu satiné, surtout sur ce qui regarde vers le ciel (sols, rues, toits) ; pas de vrais reflets.
// Neige : ce qui regarde vers le ciel (selon la pente, jamais les façades) passe à un blanc bleuté un peu cassé, par plaques (bruit
// sur la position dans le monde) qui s'étendent quand la neige s'accumule.
const GLSL = /* glsl */ `
  float wxUp = dot(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz));
  if (uWet * uWetK > 0.0) {
    float wet = uWet * uWetK * mix(0.35, 1.0, smoothstep(0.35, 0.8, wxUp));
    diffuseColor.rgb *= 1.0 - 0.2 * wet;
    roughnessFactor = mix(roughnessFactor, 0.5, wet);
  }
  if (uSnow * uSnowK > 0.0) {
    vec2 wxP = (cameraPosition + (vec4(-vViewPosition, 0.0) * viewMatrix).xyz).xz;
    float wxN = 0.65 * wxNoise(wxP / 7.0) + 0.35 * wxNoise(wxP / 1.7);
    float snow = smoothstep(0.3, 0.7, wxUp) * smoothstep(0.8 * wxN, 0.8 * wxN + 0.25, uSnow * uSnowK);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.93, 0.97), snow);
    roughnessFactor = mix(roughnessFactor, 0.9, snow);
    totalEmissiveRadiance += vec3(0.05, 0.055, 0.065) * snow; // la neige reste claire sous un ciel couvert et la nuit
  }`;
const COMMON = /* glsl */ `
  uniform float uWet, uSnow, uWetK, uSnowK;
  float wxHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float wxNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
    return mix(mix(wxHash(i), wxHash(i + vec2(1.0, 0.0)), u.x), mix(wxHash(i + vec2(0.0, 1.0)), wxHash(i + 1.0), u.x), u.y);
  }`;

/**
 * Ajoute les crochets « mouillé » et « neige » à un matériau standard, avant sa première compilation.
 * wet, snow : part de mouillé et de neige que prend ce matériau (0 à 1 ; 0 = jamais).
 */
export function weatherSurface<T extends THREE.MeshStandardMaterial>(mat: T, { wet = 1, snow = 1 } = {}): T {
  const previous = mat.onBeforeCompile;
  const base = mat.customProgramCacheKey === THREE.Material.prototype.customProgramCacheKey ? previous.toString() : mat.customProgramCacheKey();
  mat.onBeforeCompile = (shader, renderer) => {
    previous.call(mat, shader, renderer);
    Object.assign(shader.uniforms, weatherUniforms, { uWetK: { value: wet }, uSnowK: { value: snow } });
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>${COMMON}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>${GLSL}`);
  };
  mat.customProgramCacheKey = () => `${base}|wet`;
  return mat;
}
