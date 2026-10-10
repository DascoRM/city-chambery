import * as THREE from 'three';
import { curveAt } from './curve';
import type { NightUniforms } from './city';
import { CHAMBERY, chamberyInstant, type LocalDate } from '../time/chambery';
import { sunPosition } from '../time/sun';
import type { SkyValues } from '../weather/sky';

/**
 * Cycle jour/nuit : position et couleur du soleil (puis de la lune), ambiance du ciel,
 * fond de page, fenêtres éclairées, lueur des rues et halos des bars.
 * Itération 31 : le soleil suit sa vraie course au-dessus de Chambéry pour la date et l'heure
 * données (azimut et hauteur calculés, voir src/time/sun.ts) : lever, coucher et hauteur à midi
 * changent avec la saison. L'heure est une heure décimale de Chambéry (0-24).
 */

interface Keyframe {
  sky: string; ground: string; hemi: number; // lumière d'ambiance
  key: string; keyI: number; // soleil ou lune
  bg: [string, string, string]; // dégradé de fond (centre → bord)
  exposure: number;
}

const DAY: Keyframe = { sky: '#fff4e0', ground: '#6b5a4a', hemi: 1.1, key: '#ffe2b8', keyI: 2.4, bg: ['#fdf3e1', '#f0dfc4', '#d9c3a3'], exposure: 1.05 };
const DUSK: Keyframe = { sky: '#ffc9a3', ground: '#5a4550', hemi: 0.8, key: '#ff9a5c', keyI: 1.6, bg: ['#ffe0bf', '#f2a98a', '#8a6a8f'], exposure: 1.0 };
const NIGHT: Keyframe = { sky: '#5a6aa8', ground: '#1c1a2a', hemi: 0.55, key: '#9fb4ff', keyI: 0.55, bg: ['#34406a', '#1d2442', '#0d1122'], exposure: 1.0 };

// Couleurs des ambiances converties une fois : pendant la lecture ▶, apply() tourne à chaque image
const toColors = (k: Keyframe) => ({
  sky: new THREE.Color(k.sky), ground: new THREE.Color(k.ground), key: new THREE.Color(k.key),
  bg: k.bg.map((c) => new THREE.Color(c)),
});
const DAY_C = toColors(DAY), DUSK_C = toColors(DUSK), NIGHT_C = toColors(NIGHT);

export interface DayNightDeps {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  lights: { sun: THREE.DirectionalLight; hemi: THREE.HemisphereLight; fill: THREE.DirectionalLight };
  size: number;
  night: NightUniforms;
  placeHalos?: THREE.Object3D;
  /** Part des fenêtres allumées selon l'heure (EP001-US003) : points [heure, part 0-1] ; sans courbe, l'ancienne règle (selon le soleil) */
  litCurve?: [number, number][];
}

/** Hauteur minimale de la lumière du soleil (≈ 7°) : en dessous, les ombres deviendraient trop longues pour le plateau. */
const MIN_LIGHT_ELEVATION = 0.12;

export function createDayNight(d: DayNightDeps, initial: { day: LocalDate; hour: number }) {
  const R = d.size;
  const glowMeshes: THREE.Mesh[] = [];
  d.scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o.userData.nightGlow) glowMeshes.push(o as THREE.Mesh);
  });
  const warm = new THREE.Color('#ffa94d');
  // Couleurs de travail réutilisées à chaque appel
  const sky = new THREE.Color(), ground = new THREE.Color(), keyCol = new THREE.Color();
  const bg = [new THREE.Color(), new THREE.Color(), new THREE.Color()];
  // Halos des bars : uniforme de lueur et nuages de points cherchés une seule fois
  const glowU = d.placeHalos?.parent?.children.find((c) => c.userData.glowUniform)?.userData.glowUniform as { value: number } | undefined;
  const haloPoints: THREE.PointsMaterial[] = [];
  d.placeHalos?.traverse((p) => {
    if ((p as THREE.Points).isPoints) haloPoints.push((p as THREE.Points).material as THREE.PointsMaterial);
  });

  let day = initial.day, hour = initial.hour, night = 0;
  // Météo (EP009) : modificateur fourni par le module météo (chargé à la demande), appliqué après l'heure ; sans lui, rien ne change
  let weather: ((v: SkyValues, dayF: number) => void) | null = null;
  const sv: SkyValues = { hemiI: 0, keyI: 0, exposure: 0, glow: 1, lit: 0, sky, key: keyCol, bg };
  let lastBg = '';
  const lastSun = new THREE.Vector3(NaN, NaN, NaN);
  const listeners: ((h: number, night: number) => void)[] = [];

  const apply = () => {
    // Vraie position du soleil : azimut depuis le nord vers l'est, hauteur au-dessus de l'horizon
    const sunPos = sunPosition(chamberyInstant(day, hour), CHAMBERY.lat, CHAMBERY.lon);
    const elev = Math.sin(sunPos.elevation);
    const dayF = THREE.MathUtils.smoothstep(elev, -0.2, 0.1);
    const dusk = 1 - THREE.MathUtils.smoothstep(Math.abs(elev), 0.0, 0.35);
    night = 1 - dayF;

    // Ambiance : nuit ↔ jour, avec une teinte de crépuscule autour du lever/coucher
    const lerp = THREE.MathUtils.lerp;
    const duskMix = dusk * 0.85;
    sky.lerpColors(NIGHT_C.sky, DAY_C.sky, dayF).lerp(DUSK_C.sky, duskMix);
    ground.lerpColors(NIGHT_C.ground, DAY_C.ground, dayF);
    keyCol.lerpColors(NIGHT_C.key, DAY_C.key, dayF).lerp(DUSK_C.key, duskMix * dayF);
    bg.forEach((c, i) => c.lerpColors(NIGHT_C.bg[i], DAY_C.bg[i], dayF).lerp(DUSK_C.bg[i], duskMix));
    sv.hemiI = lerp(lerp(NIGHT.hemi, DAY.hemi, dayF), DUSK.hemi, duskMix * dayF);
    sv.keyI = lerp(NIGHT.keyI, DAY.keyI, dayF);
    sv.exposure = lerp(NIGHT.exposure, DAY.exposure, dayF);
    sv.glow = 1;
    sv.lit = 0;
    weather?.(sv, dayF); // météo (EP009) : ciel voilé, lumière grise, fond désaturé ; lueurs de nuit plus fortes sous la pluie, éclairs
    const { hemiI, keyI, exposure, glow: glowGain } = sv;

    // Soleil le jour (repère : x = est, −z = nord, y = haut), lune la nuit (fixe, haute, un peu à l'ouest)
    const { sun, hemi, fill } = d.lights;
    if (dayF > 0.02) {
      const e = Math.max(sunPos.elevation, MIN_LIGHT_ELEVATION), a = sunPos.azimuth;
      sun.position.set(Math.sin(a) * Math.cos(e) * R, Math.sin(e) * R, -Math.cos(a) * Math.cos(e) * R);
    } else {
      sun.position.set(-R * 0.3, R * 0.75, R * 0.35);
    }
    // Ombres à recalculer seulement si le soleil (ou la lune) a bougé
    if (!sun.position.equals(lastSun)) {
      lastSun.copy(sun.position);
      d.renderer.shadowMap.needsUpdate = true;
    }
    sun.color.copy(keyCol);
    sun.intensity = keyI * (dayF > 0.02 ? 0.7 + 0.3 * THREE.MathUtils.clamp(elev * 2, 0, 1) : 1);
    hemi.color.copy(sky);
    hemi.groundColor.copy(ground);
    hemi.intensity = hemiI;
    fill.intensity = 0.35 * dayF + 0.15 * night;
    d.renderer.toneMappingExposure = exposure;

    // Lumières de la ville
    d.night.uNight.value = Math.max(sv.lit, THREE.MathUtils.smoothstep(night + dusk * 0.4, 0.25, 0.9)); // orage de jour (EP009-US008)
    // Fenêtres (EP001-US003) : la part allumée suit l'heure (rentrée le soir, extinction dans la nuit, réveil le matin) ;
    // le shader allume une fenêtre si son hachage est sous uLit : quand uLit baisse, elles s'éteignent une à une, sans
    // clignoter, toujours dans le même ordre. On ne les voit que quand il fait sombre (uNight)
    d.night.uLit.value = d.litCurve ? THREE.MathUtils.clamp(curveAt(d.litCurve, hour), 0, 1) : 0.15 + 0.2 * night;
    for (const m of glowMeshes) {
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissive.copy(warm);
      mat.emissiveIntensity = (m.userData.nightGlow as number) * d.night.uNight.value * glowGain;
    }
    if (d.placeHalos) {
      const o = d.night.uNight.value;
      d.placeHalos.visible = o > 0.02;
      if (glowU) glowU.value = 1.4 * o * glowGain;
      for (const m of haloPoints) m.opacity = Math.min(1, 0.9 * o * glowGain);
    }

    // Fond de page (dégradé CSS)
    const css = `radial-gradient(ellipse at 50% 35%, #${bg[0].getHexString()} 0%, #${bg[1].getHexString()} 55%, #${bg[2].getHexString()} 100%)`;
    if (css !== lastBg) {
      document.body.style.background = css;
      lastBg = css;
    }
    listeners.forEach((f) => f(hour, night));
  };

  apply();

  return {
    getHour: () => hour,
    /** 0 = plein jour, 1 = nuit. */
    getNight: () => night,
    /** Change la date et l'heure de Chambéry (heure décimale 0-24). */
    set(newDay: LocalDate, h: number) {
      day = newDay;
      hour = ((h % 24) + 24) % 24;
      apply();
    },
    /**
     * Météo (EP009) : pose le modificateur (weather/sky.ts) et recalcule lumières et fond. Le soleil ne bouge pas, donc la carte
     * des ombres n'est pas recalculée ; appelé seulement pendant un fondu, jamais par temps stable.
     */
    setWeather(m: ((v: SkyValues, dayF: number) => void) | null) {
      weather = m;
      apply();
    },
    onChange(f: (h: number, night: number) => void) {
      listeners.push(f);
      f(hour, night);
    },
  };
}
