import * as THREE from 'three';
import { fogColorFor, fogRange } from './fog';
import type { WeatherLook } from './state';

/**
 * Effets de la météo sur la scène (EP009), dans le module chargé à la demande. Tout ce qui touche aux matériaux standards a été
 * posé au démarrage (règle 9) : ici on ne règle que des valeurs (brouillard, uniformes de la passe finale, mélange des halos),
 * sans aucune recompilation. Par temps sans effet : aucun travail par image.
 *  - Brouillard (US006) : `THREE.Fog` linéaire, réglé à chaque image selon la distance caméra – point regardé ; sa couleur est celle
 *    du fond de page au bord du socle, passée dans l'inverse du rendu des tons ; voile léger ; correction des couleurs prémultipliées
 *    de la passe finale (sinon liseré clair autour du socle).
 */
export interface EffectsCtx {
  scene: THREE.Scene;
  camera: THREE.Camera;
  /** Point regardé */
  focus(): THREE.Vector3;
  /** Taille du socle (m) */
  size: number;
  /** Passe finale : correction des couleurs prémultipliées, voile (couleur d'écran), éclair (tiltShift.setWeather) */
  post(w: { unpremult?: number; veil?: number; veilColor?: readonly [number, number, number]; flash?: number }): void;
}

/** Voile de la passe finale à pleine intensité de brouillard (baisse de contraste, couleur du fond) */
export const FOG_VEIL = 0.15;
/** Brouillard à partir duquel la correction des couleurs prémultipliées est complète */
export const UNPREMULT_FULL = 0.15;

export function createEffects(ctx: EffectsCtx) {
  const fog = ctx.scene.fog as THREE.Fog | null; // posé inactif au démarrage (stage.ts)
  /** Fond de page au bord du socle (sRGB 0..1) et exposition, relus à chaque recalcul du ciel (après la météo) */
  const edge: [number, number, number] = [1, 1, 1];
  let exposure = 1;
  const rgb = { r: 0, g: 0, b: 0 };
  let fogOn = false, cover = false;

  // Halos des bars (lueur additive) : avec la correction des couleurs prémultipliées, leur alpha (qui n'est pas une couverture)
  // les éteindrait au-dessus du fond de page ; pendant le brouillard, ils passent « par-dessus » (l'alpha devient une couverture).
  // Le mélange est un état du pilote graphique, pas du programme : aucune recompilation.
  const haloMats: THREE.PointsMaterial[] = [];
  ctx.scene.getObjectByName('placeHalos')?.traverse((o) => {
    if ((o as THREE.Points).isPoints) haloMats.push((o as THREE.Points).material as THREE.PointsMaterial);
  });
  const halos = (over: boolean) => {
    for (const m of haloMats) {
      if (over) Object.assign(m, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor });
      else m.blending = THREE.AdditiveBlending;
    }
  };

  return {
    /** Appelé par le modificateur du ciel (daynight.ts), une fois la météo appliquée : fond de page et exposition finals */
    readSky(bg: THREE.Color[], exp: number) {
      bg[1].getRGB(rgb, THREE.SRGBColorSpace);
      edge[0] = rgb.r; edge[1] = rgb.g; edge[2] = rgb.b;
      exposure = exp;
    },
    /** À chaque image : rien sans brouillard (une dernière fois quand il s'en va, pour le remettre au repos) */
    update(look: WeatherLook) {
      const k = look.fog;
      if (!fog || (k <= 0 && !fogOn)) return;
      fogOn = k > 0;
      const r = fogRange(k, ctx.camera.position.distanceTo(ctx.focus()), ctx.size);
      fog.near = r.near;
      fog.far = r.far;
      if (fogOn) {
        const [cr, cg, cb] = fogColorFor(edge, exposure);
        fog.color.setRGB(cr, cg, cb, THREE.LinearSRGBColorSpace);
      }
      const u = Math.min(1, k / UNPREMULT_FULL);
      ctx.post({ unpremult: u, veil: FOG_VEIL * k, veilColor: edge });
      if (u > 0 !== cover) { cover = u > 0; halos(cover); }
    },
  };
}
