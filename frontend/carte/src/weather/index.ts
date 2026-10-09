import type * as THREE from 'three';
import type { WeatherCondition } from '../../../../contrat/meteo.js';
import type { Ticker } from '../types';
import type { ClockState } from '../time/clock';
import type { QualityLevel } from '../scene/quality';
import { applyWeatherSky, type SkyValues } from './sky';
import { WEATHER_OFF, type WeatherChip } from '../ui/ui';
import { loadWeatherPref, saveWeatherPref } from '../state/weather-pref';
import {
  blendLook, chipOf, clearLook, isLive, panelOf, presetLook, resolveWeather, weatherFromUrl, windTowards, windVisual,
  type Resolved, type WeatherInputs, type WeatherLook, type WeatherStatus,
} from './state';
import { createWeatherPanel } from './panel';

/**
 * Module météo de la carte (EP009), chargé à la demande par main.ts : rien ne l'attend, il ne bloque rien.
 * Il branche l'état météo (?weather=, outil de debug, puis relevé du back avec US004, règle « Direct ou simulée ») sur la
 * scène (ciel lissé par un fondu), la puce de la barre d'heure et son panneau. Par temps stable : aucun travail par image.
 */
export interface WeatherCtx {
  root: HTMLElement;
  scene: THREE.Scene;
  camera: THREE.Camera;
  /** Point regardé (précipitations, US005) */
  focus(): THREE.Vector3;
  quality: QualityLevel;
  /** Vent de beau temps (content/life.json) : objet partagé par la fumée et les drapeaux (US009 le fera varier) */
  wind: { towards: number; speed: number };
  /** Pose le modificateur du ciel dans le cycle jour/nuit et le recalcule (dayNight.setWeather) */
  sky(modifier: (v: SkyValues, dayF: number) => void): void;
  /** 0 = jour, 1 = nuit */
  night(): number;
  clock(): ClockState;
  /** « Revenir au direct » : heure réelle et saison automatique */
  backToLive(): void;
  chip(c: WeatherChip | null): void;
}

/** Réglage de l'outil de debug : une condition (valeurs types), et ce qu'on veut changer */
export interface DebugWeather {
  condition?: WeatherCondition;
  cloud?: number; rain?: number; snow?: number; fog?: number; storm?: number;
  /** km/h et degrés d'où vient le vent */
  wind?: number; windFrom?: number;
  temperatureC?: number | null;
}

export interface WeatherModule extends Ticker {
  /** À chaque changement de l'horloge (clock.onChange de main.ts) */
  onClock(c: ClockState): void;
  /** Toucher la puce : ouvre ou ferme le panneau (réactive la météo si le visiteur l'avait coupée) */
  togglePanel(): void;
  /** prefers-reduced-motion ou « Effets réduits » : pour les éclairs, le balancement, les précipitations (US005, US008, US009) */
  reducedMotion(): boolean;
  /** Debug : force une météo (null = relâcher) */
  set(v: DebugWeather | null): void;
  /** Debug : simule un relevé du back, comme en Direct, sans réseau (null = aucun) */
  live(v: DebugWeather | null): void;
  state(): { status: WeatherStatus; condition: WeatherCondition | null; target: WeatherLook; current: WeatherLook; quality: QualityLevel; reduced: boolean };
}

const sameLook = (a: WeatherLook, b: WeatherLook) =>
  a.cloud === b.cloud && a.rain === b.rain && a.snow === b.snow && a.fog === b.fog && a.storm === b.storm && a.windSpeed === b.windSpeed && a.windTowards === b.windTowards;

export function startWeather(ctx: WeatherCtx): WeatherModule {
  const clear = clearLook(ctx.wind);
  /** Le ciel suit la météo lissée `cur` (lue à chaque recalcul du cycle jour/nuit) */
  const skyModifier = (v: SkyValues, dayF: number) => applyWeatherSky(v, cur, dayF);
  const pref = loadWeatherPref();
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  const inputs: WeatherInputs = { enabled: pref.enabled, url: weatherFromUrl(location.search), debug: null, api: 'none', reading: null, live: isLive(ctx.clock()) };
  const cur: WeatherLook = { ...clear }; // départ : la scène d'aujourd'hui, puis fondu vers la météo
  let target: WeatherLook = { ...clear };
  let res: Resolved;
  let blending = false, night = false, open = false;

  const panel = createWeatherPanel(ctx.root, {
    anchor: () => ctx.root.querySelector<HTMLElement>('.time .weather'),
    onClose: () => { open = false; showChip(); },
    onBackToLive: () => ctx.backToLive(),
    onEnabled: (on) => { pref.enabled = inputs.enabled = on; saveWeatherPref(pref); update(); },
    onReduced: (on) => { pref.reduced = on; saveWeatherPref(pref); update(); },
  });
  const showChip = () => {
    night = ctx.night() > 0.5;
    const c = res.status === 'off' ? WEATHER_OFF : chipOf(res, night);
    ctx.chip(c && { ...c, expanded: open });
  };
  const update = () => {
    res = resolveWeather(inputs, Date.now(), clear);
    if (!sameLook(res.target, target)) { target = res.target; blending = true; }
    showChip();
    if (open) panel.render({ ...panelOf(res, Date.now()), enabled: inputs.enabled, reduced: pref.reduced, systemReduced: mq.matches });
  };
  mq.addEventListener('change', update);
  update();

  /** Valeurs de l'outil de debug : celles de la condition choisie, puis les curseurs */
  const debugLook = (v: DebugWeather): WeatherLook => {
    const l = v.condition ? presetLook(v.condition, { windKmh: v.wind, windFromDeg: v.windFrom, temperatureC: v.temperatureC }) : { ...clear };
    for (const k of ['cloud', 'rain', 'snow', 'fog', 'storm'] as const) if (v[k] !== undefined) l[k] = Math.min(1, Math.max(0, v[k]!));
    if (v.wind !== undefined) l.windSpeed = windVisual(v.wind);
    if (v.windFrom !== undefined) l.windTowards = windTowards(v.windFrom);
    return l;
  };

  return {
    update(dt) {
      if (!blending) return; // temps stable : rien à faire
      blending = blendLook(cur, target, dt);
      ctx.sky(skyModifier);
    },
    onClock(c) {
      const live = isLive(c);
      if (live !== inputs.live) { inputs.live = live; update(); }
      else if (ctx.night() > 0.5 !== night) showChip(); // icône de nuit (lune)
    },
    togglePanel() {
      if (!inputs.enabled) { pref.enabled = inputs.enabled = true; saveWeatherPref(pref); update(); return; }
      open = !open;
      if (open) panel.open(); else panel.close();
      update();
    },
    reducedMotion: () => mq.matches || pref.reduced,
    set(v) {
      inputs.debug = v ? { condition: v.condition ?? null, look: debugLook(v) } : null;
      update();
    },
    live(v) {
      inputs.reading = v
        ? { condition: v.condition ?? 'cloudy', look: debugLook(v), temperatureC: v.temperatureC ?? null, forced: false, forcedUntilMs: null, stale: false, observedAtMs: Date.now(), model: 'debug' }
        : null;
      inputs.api = v ? 'ok' : 'none';
      update();
    },
    state: () => ({ status: res.status, condition: res.condition, target: { ...target }, current: { ...cur }, quality: ctx.quality, reduced: mq.matches || pref.reduced }),
  };
}
