import type * as THREE from 'three';

/**
 * Niveau de qualité (EP009-US001) : la puissance supposée de l'appareil, lue une fois au démarrage. Une seule règle pour
 * toute la carte (passants, oiseaux, et plus tard les effets météo) :
 *  - ordinateur → `high` ;
 *  - téléphone ou tablette (pointeur grossier, ou fenêtre de moins de 700 px) → `medium`, et `low` si le navigateur dit
 *    3 Go de mémoire ou moins (`navigator.deviceMemory` : Chrome Android seulement ; Safari ne le donne pas) ;
 *  - `?quality=low|medium|high` dans l'adresse force le niveau (mesures, essais).
 * Affiché par le compteur `?debug`.
 */
export type QualityLevel = 'low' | 'medium' | 'high';
const LEVELS: readonly string[] = ['low', 'medium', 'high'];

export interface DeviceInfo {
  /** Pointeur grossier (écran tactile sans souris) */
  coarse: boolean;
  /** Largeur de la fenêtre (px CSS) */
  width: number;
  /** Mémoire annoncée par le navigateur (Go), si elle est connue */
  deviceMemory?: number;
  /** Valeur de `?quality=` */
  param?: string | null;
}

/** La règle, sans navigateur (testée) */
export function initialQuality(d: DeviceInfo): QualityLevel {
  if (d.param && LEVELS.includes(d.param)) return d.param as QualityLevel;
  if (!d.coarse && d.width >= 700) return 'high';
  return d.deviceMemory !== undefined && d.deviceMemory <= 3 ? 'low' : 'medium';
}

let level: QualityLevel | null = null;
/** Niveau de qualité de cet appareil (lu au premier appel, puis gardé pour toute la visite) */
export function qualityLevel(): QualityLevel {
  level ??= initialQuality({
    coarse: typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches,
    width: typeof innerWidth === 'number' ? innerWidth : 1280,
    deviceMemory: typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    param: typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('quality'),
  });
  return level;
}

/**
 * Résolution adaptative (itération 29).
 *
 * La densité de pixels part de min(densité de l'écran, 1,5) : sur un écran Retina (densité 2), ça fait
 * déjà 44 % de pixels en moins, avec peu de différence visible (l'effet maquette floute une bonne
 * partie de l'image). Ensuite, toutes les 2 secondes :
 *  - moins de 40 images/s → on baisse d'un cran (0,25), jusqu'à 1 au minimum ;
 *  - plus de 56 images/s pendant 3 mesures de suite → on remonte d'un cran, jusqu'au plafond.
 * Les changements sont rares (pas de va-et-vient à chaque image).
 * Au repos, la boucle est limitée à 30 images/s (TI-02) : seules les images en mouvement sont mesurées,
 * sinon les 30 images/s voulues passeraient pour de la lenteur.
 */
export function createAdaptiveResolution(renderer: THREE.WebGLRenderer, onChange: () => void) {
  const max = Math.min(window.devicePixelRatio || 1, 1.5);
  const min = Math.min(1, max);
  let pr = max;
  renderer.setPixelRatio(pr);
  let acc = 0, frames = 0, good = 0, fps = 60;
  let onSample: ((fps: number, atMin: boolean) => void) | null = null;

  const set = (v: number) => {
    v = Math.round(Math.min(max, Math.max(min, v)) * 4) / 4;
    if (v === pr) return;
    pr = v;
    renderer.setPixelRatio(pr);
    onChange();
  };

  return {
    /** À appeler à chaque image avec sa durée (secondes) ; measure = image en mouvement, précédée d'une autre. */
    update(dt: number, measure: boolean) {
      if (!measure || dt <= 0 || dt > 0.25) return; // repos, onglet en pause, chargement… : ignoré
      acc += dt;
      frames++;
      if (acc < 2) return;
      fps = frames / acc;
      acc = 0;
      frames = 0;
      onSample?.(fps, pr <= min); // densité de pixels déjà au minimum ? (règle 8 d'EP009 : dégradation de la pluie)
      if (fps < 40) { good = 0; set(pr - 0.25); }
      else if (fps > 56) { if (++good >= 3) { good = 0; set(pr + 0.25); } }
      else good = 0;
    },
    /** Chaque mesure de 2 s en mouvement : images/s, et densité de pixels déjà au minimum (EP009-US005) */
    onSample(f: (fps: number, atMin: boolean) => void) { onSample = f; },
    get pixelRatio() { return pr; },
    get max() { return max; },
    get fps() { return fps; },
  };
}
