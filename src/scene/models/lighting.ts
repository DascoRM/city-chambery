import * as THREE from 'three';

/**
 * Mise en lumière de nuit des monuments, simulée dans les matériaux (pas de vraies lampes :
 * aucun coût sur le reste de la scène). La pierre est éclairée par le bas, d'une lumière
 * chaude qui s'estompe en montant jusqu'à refH mètres.
 */
const WARM = new THREE.Color('#ffd49a');

export function uplight(mat: THREE.MeshStandardMaterial, night: { value: number }, strength: number, refH: number, base = 0) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = night;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vWY;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\nvWY = (modelMatrix * vec4(transformed, 1.0)).y - ${base.toFixed(2)};`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vWY;\nuniform float uNight;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float up = mix(1.0, 0.3, smoothstep(0.0, ${refH.toFixed(1)}, vWY));
        totalEmissiveRadiance += diffuseColor.rgb * vec3(${WARM.toArray().map((v) => v.toFixed(3)).join(', ')}) * uNight * ${strength.toFixed(2)} * up;`,
      );
  };
  mat.needsUpdate = true;
}

/** Ouvertures (fenêtres, portails) qui s'allument la nuit d'une lueur chaude. */
export function glowAtNight(mat: THREE.MeshStandardMaterial, night: { value: number }, k = 0.6) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = night;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.62, 0.28) * uNight * ${k.toFixed(2)};`);
  };
  mat.needsUpdate = true;
}
