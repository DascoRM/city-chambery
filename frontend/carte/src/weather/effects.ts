import * as THREE from 'three';
import type { QualityLevel } from '../scene/quality';
import type { CityData } from '../types';
import { weatherUniforms } from '../scene/weather-surface';
import { fogColorFor, fogRange } from './fog';
import { FULL_BUDGET, nextBudget, type RainBudget } from './budget';
import { RAIN_COUNT, SNOW_COUNT, createRain, type PrecipKind, type Rain } from './rain';
import { approach, type WeatherLook } from './state';

/**
 * Effets de la météo sur la scène (EP009), dans le module chargé à la demande. Tout ce qui touche aux matériaux standards a été
 * posé au démarrage (règle 9) : ici on ne règle que des valeurs (brouillard, uniformes de la passe finale et du sol mouillé, mélange
 * des halos), sans aucune recompilation ; seuls les maillages de la pluie et de la neige (un programme pour les deux) arrivent avec
 * la première précipitation.
 * Par temps sans effet : aucun travail par image.
 *  - Brouillard (US006) : `THREE.Fog` linéaire, réglé à chaque image selon la distance caméra – point regardé ; sa couleur est celle
 *    du fond de page au bord du socle, passée dans l'inverse du rendu des tons ; voile léger ; correction des couleurs prémultipliées
 *    de la passe finale (sinon liseré clair autour du socle).
 *  - Pluie (US005) : deux nappes de traînées (weather/rain.ts), sol mouillé, lueurs de nuit un peu plus fortes, règle de dégradation.
 *  - Neige (US007) : deux nappes de flocons (même système), neige au sol qui s'accumule et fond, même règle de dégradation.
 */
export interface EffectsCtx {
  scene: THREE.Scene;
  camera: THREE.Camera;
  /** Point regardé */
  focus(): THREE.Vector3;
  /** Taille du socle (m) et ses limites (données) */
  size: number;
  bounds: CityData['bounds'];
  quality: QualityLevel;
  /** 0 = jour, 1 = nuit */
  night(): number;
  /** Passe finale : correction des couleurs prémultipliées, voile (couleur d'écran), éclair (tiltShift.setWeather) */
  post(w: { unpremult?: number; veil?: number; veilColor?: readonly [number, number, number]; flash?: number }): void;
  /** Mesures de cadence de la résolution adaptative (scene/quality.ts), pour la règle de dégradation de la pluie */
  onFpsSample(f: (fps: number, atMin: boolean) => void): void;
}

/** Voile de la passe finale à pleine intensité de brouillard (baisse de contraste, couleur du fond) */
export const FOG_VEIL = 0.15;
/** Brouillard à partir duquel la correction des couleurs prémultipliées est complète */
export const UNPREMULT_FULL = 0.15;
/** Sol mouillé : cible selon la pluie, temps pour mouiller (s) et pour sécher */
export const WET = { perRain: 1.6, tauUp: 20, tauDown: 120 };
/** Lueurs de nuit (halos des bars, lueur des rues) en plus quand tout est mouillé */
export const WET_GLOW = 0.25;
/** Neige au sol : cible selon la neige qui tombe, temps pour couvrir (s) et pour fondre */
export const SNOW_COVER = { perSnow: 1.6, tauUp: 30, tauDown: 300 };
/** Neige d'ambiance au sol, sans flocons, quand la saison « Hiver » est choisie à la main (la météo y est déjà simulée) */
export const WINTER_SNOW = 0.8;

/** Neige au sol visée : celle qui tombe, et au moins la neige d'ambiance en hiver choisi */
export const lyingTarget = (snow: number, winter: boolean) => Math.max(winter ? WINTER_SNOW : 0, Math.min(1, snow * SNOW_COVER.perSnow));

export function createEffects(ctx: EffectsCtx, reduced: () => boolean) {
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

  // Pluie et neige : créées à la première précipitation ; nombre par niveau de qualité (`?debug&rainmax=N`, `&snowmax=N` pour essayer)
  const precip: Record<PrecipKind, Rain | null> = { rain: null, snow: null };
  const q = new URLSearchParams(location.search);
  const countOf = (kind: PrecipKind, table: Record<QualityLevel, number>) => {
    const max = Number(q.get(`${kind}max`));
    return q.has('debug') && max > 0 ? Math.min(50000, Math.round(max)) : table[ctx.quality];
  };
  const count = { rain: countOf('rain', RAIN_COUNT), snow: countOf('snow', SNOW_COUNT) };
  let budget: RainBudget = { ...FULL_BUDGET };
  ctx.onFpsSample((fps, atMin) => { if (precip.rain?.visible() || precip.snow?.visible()) budget = nextBudget(budget, fps, atMin); });
  let wet = 0, glow = 1, lying = 0, winter = false;

  return {
    /** Saison « Hiver » choisie à la main : la neige d'ambiance arrive ou part d'un coup, comme le feuillage des arbres */
    setWinter(on: boolean) {
      if (on === winter) return;
      winter = on;
      lying = on ? Math.max(lying, WINTER_SNOW) : 0;
      weatherUniforms.uSnow.value = lying;
    },
    /** Appelé par le modificateur du ciel (daynight.ts), une fois la météo appliquée : fond de page et exposition finals */
    readSky(bg: THREE.Color[], exp: number) {
      bg[1].getRGB(rgb, THREE.SRGBColorSpace);
      edge[0] = rgb.r; edge[1] = rgb.g; edge[2] = rgb.b;
      exposure = exp;
    },
    /** Gain des lueurs de nuit, lu par le modificateur du ciel */
    glow: () => glow,
    /** Part des gouttes gardée par la règle de dégradation (1, 0,5 ou 0) */
    budget: () => budget.level,
    /** À chaque image ; renvoie vrai si le ciel doit être recalculé (lueurs de nuit) */
    update(look: WeatherLook, dt: number): boolean {
      // Brouillard : suit la caméra ; une dernière fois quand il s'en va, pour le remettre au repos
      const k = look.fog;
      if (fog && (k > 0 || fogOn)) {
        fogOn = k > 0;
        const range = fogRange(k, ctx.camera.position.distanceTo(ctx.focus()), ctx.size);
        fog.near = range.near;
        fog.far = range.far;
        if (fogOn) {
          const [cr, cg, cb] = fogColorFor(edge, exposure);
          fog.color.setRGB(cr, cg, cb, THREE.LinearSRGBColorSpace);
        }
        const u = Math.min(1, k / UNPREMULT_FULL);
        ctx.post({ unpremult: u, veil: FOG_VEIL * k, veilColor: edge });
        if (u > 0 !== cover) { cover = u > 0; halos(cover); }
      }
      // Pluie et neige : deux nappes chacune, autour du point regardé et sur tout le socle (ralenties avec le réduit-mouvement)
      for (const kind of ['rain', 'snow'] as const) {
        const raw = look[kind], r = raw * budget.level, p = precip[kind];
        if (r > 0.002) {
          const f = ctx.focus();
          (precip[kind] ??= createRain(ctx.scene, count[kind], ctx.bounds, kind))
            .update(dt, f, ctx.camera.position.distanceTo(f), r, raw, { speed: look.windSpeed, towards: look.windTowards }, ctx.night(), reduced() ? 0.3 : 1);
        } else if (p?.visible()) p.hide();
      }
      // Neige au sol : s'accumule en une minute environ, fond en quelques minutes
      const lyingTo = lyingTarget(look.snow, winter);
      if (lying !== lyingTo) {
        lying = approach(lying, lyingTo, dt, lyingTo > lying ? SNOW_COVER.tauUp : SNOW_COVER.tauDown);
        if (Math.abs(lying - lyingTo) < 1e-3) lying = lyingTo;
        weatherUniforms.uSnow.value = lying;
      }
      // Sol mouillé : vite à l'humidification, lentement au séchage ; lueurs de nuit un peu plus fortes
      const target = Math.min(1, look.rain * WET.perRain);
      if (wet === target) return false;
      wet = approach(wet, target, dt, target > wet ? WET.tauUp : WET.tauDown);
      if (Math.abs(wet - target) < 1e-3) wet = target;
      weatherUniforms.uWet.value = wet;
      const g = 1 + WET_GLOW * wet;
      if (Math.abs(g - glow) < 0.01 && wet !== target) return false;
      glow = g;
      return true;
    },
  };
}
