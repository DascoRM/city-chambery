import * as THREE from 'three';

/**
 * Crochets de la météo dans les matériaux standards (EP009-US005) : sol mouillé (rues, sol, bâtiments et toits). Posés au
 * démarrage, inactifs (règle 9 : modifier un matériau en cours de route recompile son programme et fige l'image) ; ensuite, le
 * module météo ne règle que l'uniforme. Comme `fadeMaterial` (cutaway.ts) : l'`onBeforeCompile` existant est enchaîné, la clé du
 * programme est étendue une fois pour toutes. Par beau temps (`uWet` à 0), la branche n'est pas prise : image inchangée.
 */
export const weatherUniforms = { uWet: { value: 0 } };

// Mouillé : plus sombre et un peu satiné, surtout sur ce qui regarde vers le ciel (sols, rues, toits) ; pas de vrais reflets
const WET_GLSL = /* glsl */ `
  if (uWet > 0.0) {
    float wetUp = smoothstep(0.35, 0.8, dot(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz)));
    float wet = uWet * mix(0.35, 1.0, wetUp);
    diffuseColor.rgb *= 1.0 - 0.2 * wet;
    roughnessFactor = mix(roughnessFactor, 0.5, wet);
  }`;

/** Ajoute le crochet « sol mouillé » à un matériau standard, avant sa première compilation */
export function weatherSurface<T extends THREE.MeshStandardMaterial>(mat: T): T {
  const previous = mat.onBeforeCompile;
  const base = mat.customProgramCacheKey === THREE.Material.prototype.customProgramCacheKey ? previous.toString() : mat.customProgramCacheKey();
  mat.onBeforeCompile = (shader, renderer) => {
    previous.call(mat, shader, renderer);
    shader.uniforms.uWet = weatherUniforms.uWet;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uWet;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>${WET_GLSL}`);
  };
  mat.customProgramCacheKey = () => `${base}|wet`;
  return mat;
}
