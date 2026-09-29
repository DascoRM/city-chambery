import type * as THREE from 'three';

/**
 * Résolution adaptative (itération 29).
 *
 * La densité de pixels part de min(densité de l'écran, 1,5) : sur un écran Retina (densité 2), ça fait
 * déjà 44 % de pixels en moins, avec peu de différence visible (l'effet maquette floute une bonne
 * partie de l'image). Ensuite, toutes les 2 secondes :
 *  - moins de 40 images/s → on baisse d'un cran (0,25), jusqu'à 1 au minimum ;
 *  - plus de 56 images/s pendant 3 mesures de suite → on remonte d'un cran, jusqu'au plafond.
 * Les changements sont rares (pas de va-et-vient à chaque image).
 */
export function createAdaptiveResolution(renderer: THREE.WebGLRenderer, onChange: () => void) {
  const max = Math.min(window.devicePixelRatio || 1, 1.5);
  const min = Math.min(1, max);
  let pr = max;
  renderer.setPixelRatio(pr);
  let acc = 0, frames = 0, good = 0, fps = 60;

  const set = (v: number) => {
    v = Math.round(Math.min(max, Math.max(min, v)) * 4) / 4;
    if (v === pr) return;
    pr = v;
    renderer.setPixelRatio(pr);
    onChange();
  };

  return {
    /** À appeler à chaque image avec la durée de l'image (secondes). */
    update(dt: number) {
      if (dt <= 0 || dt > 0.25) return; // onglet en pause, chargement… : ignoré
      acc += dt;
      frames++;
      if (acc < 2) return;
      fps = frames / acc;
      acc = 0;
      frames = 0;
      if (fps < 40) { good = 0; set(pr - 0.25); }
      else if (fps > 56) { if (++good >= 3) { good = 0; set(pr + 0.25); } }
      else good = 0;
    },
    get pixelRatio() { return pr; },
    get max() { return max; },
    get fps() { return fps; },
  };
}
