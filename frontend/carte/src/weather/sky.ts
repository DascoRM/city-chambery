import * as THREE from 'three';

/**
 * Modificateur météo du ciel (EP009-US002), dans le module météo (chargé à la demande) : le cycle jour/nuit (`daynight.ts`)
 * l'appelle APRÈS le calcul de l'heure, si bien que la relecture de l'horloge (chaque minute) ne défait jamais la météo.
 * Fonction pure, testée : par beau temps, les
 * valeurs d'aujourd'hui restent exactement les mêmes. Le soleil est voilé (son intensité baisse) mais jamais éteint ni privé
 * d'ombre : basculer `castShadow` recompilerait 28 programmes (3 s d'image figée, mesuré). Les nombres ci-dessous sont des
 * choix de rendu, à régler avec Dasco (`?debug`), pas des faits météo.
 */

/** État météo lissé que lit le ciel : couverture nuageuse et intensités, de 0 à 1 (0 partout = beau temps) */
export interface SkyLook { cloud: number; rain: number; snow: number; fog: number; storm: number }
export const CLEAR_SKY: Readonly<SkyLook> = { cloud: 0, rain: 0, snow: 0, fog: 0, storm: 0 };
export const SKY_KEYS = ['cloud', 'rain', 'snow', 'fog', 'storm'] as const;

/** Couverture nuageuse sans effet : jusqu'à 20 %, le ciel reste celui d'aujourd'hui (« ciel dégagé » vaut 5 %) */
export const CLOUD_DEAD_ZONE = 0.2;

/** Part de ciel couvert, de 0 à 1 : nuages au-delà de la zone morte, ou précipitations, brouillard, orage */
export function overcastOf(w: SkyLook): number {
  const c = THREE.MathUtils.smoothstep(w.cloud, CLOUD_DEAD_ZONE, 1);
  return Math.min(1, Math.max(c, 0.8 * w.fog, 0.9 * w.rain, 0.9 * w.snow, w.storm));
}

/** Valeurs du cycle jour/nuit que la météo modifie (couleurs modifiées en place) */
export interface SkyValues {
  hemiI: number; keyI: number; exposure: number;
  /** Gain des lueurs de nuit (halos des bars, lueur des rues) : 1 par défaut, plus fort sous la pluie (US005) */
  glow: number;
  sky: THREE.Color; key: THREE.Color; bg: THREE.Color[];
}

const GREY_SKY = new THREE.Color('#c9ccd2'), GREY_KEY = new THREE.Color('#dfe2e6');
const grey = new THREE.Color();

/** Applique la météo à `v` (en place) ; `dayF` : 1 en plein jour, 0 la nuit */
export function applyWeatherSky(v: SkyValues, w: SkyLook, dayF: number): void {
  const o = overcastOf(w);
  if (o <= 0) return; // beau temps : rien ne change
  v.keyI *= 1 - 0.8 * o; // soleil (ou lune) voilé : les ombres s'effacent d'elles-mêmes
  v.hemiI *= 1 + 0.12 * o * dayF; // lumière diffuse un peu plus forte
  v.sky.lerp(GREY_SKY, 0.55 * o * dayF);
  v.key.lerp(GREY_KEY, 0.5 * o * dayF);
  for (const c of v.bg) {
    // Fond de page : désaturé, un peu plus sombre de jour
    const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    c.lerp(grey.setRGB(l, l, l), 0.6 * o).multiplyScalar(1 - 0.06 * o * dayF);
  }
  v.exposure *= 1 - 0.07 * o * dayF;
}
