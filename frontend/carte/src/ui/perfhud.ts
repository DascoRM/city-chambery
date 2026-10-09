import type * as THREE from 'three';
import type { QualityLevel } from '../scene/quality';

/** Requêtes de temps du processeur graphique (extension WebGL 2 ; absente de Safari) */
interface TimerQueryExt { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number }

/**
 * Compteur de performance, affiché avec `?debug` dans l'adresse (ex. http://localhost:3000/?debug).
 * Images par seconde, durée d'une image, appels de rendu, triangles, densité de pixels, taille du rendu,
 * niveau de qualité (scene/quality.ts) et temps du processeur graphique par image (EP009-US001).
 * Les appels et triangles sont cumulés sur toutes les passes d'une image (scène, flou, étiquettes).
 * « repos » : rien n'a bougé pendant la dernière demi-seconde, la cadence est limitée à 30 images/s (TI-02).
 * « GPU » : requêtes de temps autour de tout le rendu d'une image (moyenne sur la demi-seconde) ; « n/d » si le navigateur
 * ne les propose pas (Safari). C'est un ordre de grandeur : seuls les écarts mesurés dans la même page comptent.
 */
export function createPerfHud(renderer: THREE.WebGLRenderer, getPixelRatio: () => number, quality: QualityLevel) {
  const el = document.createElement('div');
  el.className = 'perfhud';
  document.body.appendChild(el);
  renderer.info.autoReset = false; // on remet à zéro nous-mêmes, une fois par image
  let acc = 0, frames = 0, worst = 0, moved = false;

  // Cumul depuis la dernière remise à zéro, pour les scripts de mesure (window.diorama.perf.sample())
  const total = { frames: 0, seconds: 0, worst: 0, cpuSum: 0, cpuMax: 0, gpuSum: 0, gpuN: 0 };
  let t0 = 0;

  const gl = renderer.getContext() as WebGL2RenderingContext;
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerQueryExt | null;
  const pending: WebGLQuery[] = [];
  let query: WebGLQuery | null = null;
  let gpuSum = 0, gpuN = 0, gpuShown = '';
  /** Lit les résultats arrivés (une ou deux images plus tard), dans l'ordre ; un résultat « disjoint » est jeté */
  const poll = () => {
    while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
      const q = pending.shift()!;
      if (!gl.getParameter(ext!.GPU_DISJOINT_EXT)) {
        const ms = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6;
        gpuSum += ms; gpuN++; total.gpuSum += ms; total.gpuN++;
      }
      gl.deleteQuery(q);
    }
  };

  return {
    /** Début d'image : remet les compteurs de rendu à zéro, lance la mesure du processeur graphique. */
    begin() {
      renderer.info.reset();
      t0 = performance.now();
      if (ext && pending.length < 8) {
        query = gl.createQuery();
        if (query) gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
      }
    },
    /** Fin d'image : cumule et rafraîchit l'affichage deux fois par seconde. */
    end(dt: number, busy: boolean) {
      if (query) { gl.endQuery(ext!.TIME_ELAPSED_EXT); pending.push(query); query = null; }
      if (ext) poll();
      const cpu = performance.now() - t0;
      total.frames++; total.seconds += dt; total.worst = Math.max(total.worst, dt); total.cpuSum += cpu; total.cpuMax = Math.max(total.cpuMax, cpu);
      acc += dt; frames++; worst = Math.max(worst, dt);
      if (busy) moved = true;
      if (acc < 0.5) return;
      if (gpuN) gpuShown = `GPU ${(gpuSum / gpuN).toFixed(1)} ms`;
      const { calls, triangles } = renderer.info.render;
      const c = renderer.domElement;
      el.textContent = [
        `${(frames / acc).toFixed(0)} img/s · pire ${(worst * 1000).toFixed(0)} ms · ${moved ? 'mouvement' : 'repos (30 max)'}`,
        `${calls} appels · ${(triangles / 1e6).toFixed(2)} M triangles`,
        `densité ${getPixelRatio().toFixed(2)} · ${c.width}×${c.height} px`,
        `qualité ${quality} · ${ext ? gpuShown || 'GPU …' : 'GPU n/d'}`,
      ].join('\n');
      acc = 0; frames = 0; worst = 0; moved = false; gpuSum = 0; gpuN = 0;
    },
    /** Mesures cumulées depuis `resetSample()` (scripts de mesure sur le Mac, avec `?debug`) */
    sample() {
      const t = total;
      return {
        frames: t.frames, fps: t.seconds ? t.frames / t.seconds : 0, worstMs: t.worst * 1000,
        cpuMs: t.frames ? t.cpuSum / t.frames : 0, cpuMaxMs: t.cpuMax, gpuMs: t.gpuN ? t.gpuSum / t.gpuN : null,
        calls: renderer.info.render.calls, programs: renderer.info.programs?.length ?? 0,
      };
    },
    resetSample() { Object.assign(total, { frames: 0, seconds: 0, worst: 0, cpuSum: 0, cpuMax: 0, gpuSum: 0, gpuN: 0 }); },
  };
}
