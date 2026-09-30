import type * as THREE from 'three';

/**
 * Compteur de performance, affiché avec `?debug` dans l'adresse (ex. http://localhost:3000/?debug).
 * Images par seconde, durée d'une image, appels de rendu, triangles, densité de pixels, taille du rendu.
 * Les appels et triangles sont cumulés sur toutes les passes d'une image (scène, flou, étiquettes).
 * « repos » : rien n'a bougé pendant la dernière demi-seconde, la cadence est limitée à 30 images/s (TI-02).
 */
export function createPerfHud(renderer: THREE.WebGLRenderer, getPixelRatio: () => number) {
  const el = document.createElement('div');
  el.className = 'perfhud';
  document.body.appendChild(el);
  renderer.info.autoReset = false; // on remet à zéro nous-mêmes, une fois par image
  let acc = 0, frames = 0, worst = 0, moved = false;

  return {
    /** Début d'image : remet les compteurs de rendu à zéro. */
    begin() { renderer.info.reset(); },
    /** Fin d'image : cumule et rafraîchit l'affichage deux fois par seconde. */
    end(dt: number, busy: boolean) {
      acc += dt; frames++; worst = Math.max(worst, dt);
      if (busy) moved = true;
      if (acc < 0.5) return;
      const { calls, triangles } = renderer.info.render;
      const c = renderer.domElement;
      el.textContent = [
        `${(frames / acc).toFixed(0)} img/s · pire ${(worst * 1000).toFixed(0)} ms · ${moved ? 'mouvement' : 'repos (30 max)'}`,
        `${calls} appels · ${(triangles / 1e6).toFixed(2)} M triangles`,
        `densité ${getPixelRatio().toFixed(2)} · ${c.width}×${c.height} px`,
      ].join('\n');
      acc = 0; frames = 0; worst = 0; moved = false;
    },
  };
}
