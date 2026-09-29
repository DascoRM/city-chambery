import * as THREE from 'three';
import type { NightUniforms } from './city';
import { CHAMBERY, chamberyInstant, type LocalDate } from '../time/chambery';
import { sunPosition } from '../time/sun';

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

const mixHex = (a: string, b: string, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t);
function mixKey(a: Keyframe, b: Keyframe, t: number) {
  return {
    sky: mixHex(a.sky, b.sky, t), ground: mixHex(a.ground, b.ground, t), hemi: THREE.MathUtils.lerp(a.hemi, b.hemi, t),
    key: mixHex(a.key, b.key, t), keyI: THREE.MathUtils.lerp(a.keyI, b.keyI, t),
    bg: a.bg.map((c, i) => mixHex(c, b.bg[i], t)), exposure: THREE.MathUtils.lerp(a.exposure, b.exposure, t),
  };
}

export interface DayNightDeps {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  lights: { sun: THREE.DirectionalLight; hemi: THREE.HemisphereLight; fill: THREE.DirectionalLight };
  size: number;
  night: NightUniforms;
  placeHalos?: THREE.Object3D;
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

  let day = initial.day, hour = initial.hour, night = 0;
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
    const base = mixKey(NIGHT, DAY, dayF);
    const duskMix = dusk * 0.85;
    const sky = base.sky.lerp(new THREE.Color(DUSK.sky), duskMix);
    base.hemi = THREE.MathUtils.lerp(base.hemi, DUSK.hemi, duskMix * dayF);
    const keyCol = base.key.lerp(new THREE.Color(DUSK.key), duskMix * dayF);
    const bg = base.bg.map((c, i) => c.lerp(new THREE.Color(DUSK.bg[i]), duskMix));

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
    sun.intensity = base.keyI * (dayF > 0.02 ? 0.7 + 0.3 * THREE.MathUtils.clamp(elev * 2, 0, 1) : 1);
    hemi.color.copy(sky);
    hemi.groundColor.copy(base.ground);
    hemi.intensity = base.hemi;
    fill.intensity = 0.35 * dayF + 0.15 * night;
    d.renderer.toneMappingExposure = base.exposure;

    // Lumières de la ville
    d.night.uNight.value = THREE.MathUtils.smoothstep(night + dusk * 0.4, 0.25, 0.9);
    d.night.uLit.value = 0.15 + 0.2 * night;
    for (const m of glowMeshes) {
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissive.copy(warm);
      mat.emissiveIntensity = (m.userData.nightGlow as number) * d.night.uNight.value;
    }
    if (d.placeHalos) {
      const o = d.night.uNight.value;
      d.placeHalos.visible = o > 0.02;
      const glowU = d.placeHalos.parent?.children.find((c) => c.userData.glowUniform)?.userData.glowUniform as { value: number } | undefined;
      if (glowU) glowU.value = 1.4 * o;
      d.placeHalos.traverse((p) => {
        if ((p as THREE.Points).isPoints) ((p as THREE.Points).material as THREE.PointsMaterial).opacity = 0.9 * o;
      });
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
    onChange(f: (h: number, night: number) => void) {
      listeners.push(f);
      f(hour, night);
    },
  };
}
