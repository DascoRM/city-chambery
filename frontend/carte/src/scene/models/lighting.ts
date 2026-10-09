import * as THREE from 'three';

/**
 * Mise en lumière de nuit des monuments, simulée dans les matériaux (pas de vraies lampes :
 * aucun coût sur le reste de la scène). La pierre est éclairée par le bas, d'une lumière
 * chaude qui s'estompe en montant jusqu'à refH mètres.
 */
const WARM = new THREE.Color('#ffd49a');

/*
 * Les réglages de chaque matériau passent par des uniformes, jamais dans le texte du shader :
 * three.js reconnaît un programme au texte de onBeforeCompile (customProgramCacheKey), où les
 * valeurs d'une fermeture n'apparaissent pas. Écrites en dur, elles seraient celles du premier
 * matériau compilé pour tous les autres. Avec des uniformes, le programme est partagé à juste
 * titre et chaque matériau garde ses valeurs.
 */
export function uplight(mat: THREE.MeshStandardMaterial, night: { value: number }, strength: number, refH: number, base = 0) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = night;
    shader.uniforms.uUpStrength = { value: strength };
    shader.uniforms.uUpRefH = { value: refH };
    shader.uniforms.uUpBase = { value: base };
    shader.uniforms.uUpWarm = { value: WARM };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vWY;\nuniform float uUpBase;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWY = (modelMatrix * vec4(transformed, 1.0)).y - uUpBase;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vWY;\nuniform float uNight;\nuniform float uUpStrength;\nuniform float uUpRefH;\nuniform vec3 uUpWarm;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float up = mix(1.0, 0.3, smoothstep(0.0, uUpRefH, vWY));
        totalEmissiveRadiance += diffuseColor.rgb * uUpWarm * uNight * uUpStrength * up;`,
      );
  };
  mat.needsUpdate = true;
}

/** Ouvertures (fenêtres, portails) qui s'allument la nuit d'une lueur chaude. */
export function glowAtNight(mat: THREE.MeshStandardMaterial, night: { value: number }, k = 0.6) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = night;
    shader.uniforms.uGlowK = { value: k };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;\nuniform float uGlowK;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.62, 0.28) * uNight * uGlowK;');
  };
  mat.needsUpdate = true;
}
