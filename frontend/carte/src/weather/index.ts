import type * as THREE from 'three';
import { WEATHER_MAX_AGE_S, type WeatherAttribution, type WeatherCondition } from '../../../../contrat/meteo.js';
import type { Ticker } from '../types';
import type { ClockState } from '../time/clock';
import type { QualityLevel } from '../scene/quality';
import { applyWeatherSky, type SkyValues } from './sky';
import { WEATHER_OFF, type WeatherChip } from '../ui/ui';
import { loadWeatherPref, saveWeatherPref } from '../state/weather-pref';
import {
  OLD_AFTER_S, blendLook, chipOf, clearLook, isLive, panelOf, presetLook, readingFromResponse, resolveWeather, weatherFromUrl,
  windTowards, windVisual, type Reading, type Resolved, type WeatherInputs, type WeatherLook, type WeatherStatus,
} from './state';
import { createWeatherClient, fetchWeather, type WeatherFetch } from './client';
import { createWeatherPanel } from './panel';
import { createEffects, type EffectsCtx } from './effects';

/**
 * Module météo de la carte (EP009), chargé à la demande par main.ts : rien ne l'attend, il ne bloque rien.
 * Il branche l'état météo (?weather=, outil de debug, puis relevé du back avec US004, règle « Direct ou simulée ») sur la
 * scène (ciel lissé par un fondu), la puce de la barre d'heure et son panneau. Par temps stable : aucun travail par image.
 */
export interface WeatherCtx extends EffectsCtx {
  root: HTMLElement;
  scene: THREE.Scene;
  camera: THREE.Camera;
  /** Point regardé (brouillard, précipitations) */
  focus(): THREE.Vector3;
  /** Pose le modificateur du ciel dans le cycle jour/nuit et le recalcule (dayNight.setWeather) */
  sky(modifier: (v: SkyValues, dayF: number) => void): void;
  clock(): ClockState;
  /** « Revenir au direct » : heure réelle et saison automatique */
  backToLive(): void;
  chip(c: WeatherChip | null): void;
  /** Crédit de la source (pied de page, accueil), tel que l'envoie le back : seulement quand la scène montre ses données (règle 11), sinon null */
  credit(a: WeatherAttribution | null): void;
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

let early: Promise<WeatherFetch> | null = null;
/** Lecture lancée dès l'arrivée du module, pendant le chargement de la ville (main.ts) ; jamais avec ?weather= (zéro réseau) */
export function prefetchWeather() {
  if (!early && !weatherFromUrl(location.search)) early = fetchWeather();
}

/** Puce pendant une lecture, quand le panneau est ouvert (au démarrage, elle reste masquée) */
const WAITING: WeatherChip = { icon: '⛅', text: '…', label: 'Météo : lecture en cours', off: true };

const sameLook = (a: WeatherLook, b: WeatherLook) =>
  a.cloud === b.cloud && a.rain === b.rain && a.snow === b.snow && a.fog === b.fog && a.storm === b.storm && a.windSpeed === b.windSpeed && a.windTowards === b.windTowards;

export function startWeather(ctx: WeatherCtx): WeatherModule {
  const clear = clearLook(ctx.wind);
  const effects = createEffects(ctx, () => mq.matches || pref.reduced);
  /** Le ciel suit la météo lissée `cur` (lue à chaque recalcul du cycle jour/nuit) ; les effets lisent le fond qui en résulte */
  const skyModifier = (v: SkyValues, dayF: number) => {
    applyWeatherSky(v, cur, dayF);
    v.glow = effects.glow();
    effects.readSky(v.bg, v.exposure);
  };
  const pref = loadWeatherPref();
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  const inputs: WeatherInputs = { enabled: pref.enabled, url: weatherFromUrl(location.search), debug: null, api: 'none', reading: null, live: isLive(ctx.clock()) };
  const cur: WeatherLook = { ...clear }; // départ : la scène d'aujourd'hui, puis fondu vers la météo
  let target: WeatherLook = { ...clear };
  let res: Resolved;
  let blending = false, night = false, open = false, creditKey: string | null = null;
  let ageTimer: ReturnType<typeof setTimeout> | undefined;
  /** Panneau ouvert : son texte (« il y a 6 min ») est rafraîchi chaque minute */
  let tick: ReturnType<typeof setInterval> | undefined;
  /** Relevé simulé par l'outil de debug : il passe devant celui du back tant qu'il existe */
  let debugReading: Reading | null = null;
  let real: { api: WeatherInputs['api']; reading: Reading | null } = { api: 'none', reading: null };

  const panel = createWeatherPanel(ctx.root, {
    anchor: () => ctx.root.querySelector<HTMLElement>('.time .weather'),
    onClose: () => { open = false; clearInterval(tick); showChip(); },
    onBackToLive: () => ctx.backToLive(),
    onEnabled: (on) => { setEnabled(on); },
    onReduced: (on) => { pref.reduced = on; saveWeatherPref(pref); update(); },
  });
  const showChip = () => {
    night = ctx.night() > 0.5;
    // Panneau ouvert pendant une lecture (météo réactivée) : la puce reste, sous le panneau
    const c = res.status === 'off' ? WEATHER_OFF : chipOf(res, night) ?? (open ? WAITING : null);
    ctx.chip(c && { ...c, expanded: open });
  };
  const update = () => {
    inputs.reading = debugReading ?? real.reading;
    inputs.api = debugReading ? 'ok' : real.api;
    const now = Date.now();
    res = resolveWeather(inputs, now, clear);
    if (!sameLook(res.target, target)) { target = res.target; blending = true; }
    // Neige d'ambiance de l'hiver choisi à la main (jamais en Direct : la saison y est automatique)
    effects.setWinter(inputs.enabled && ctx.clock().season === 'winter');
    showChip();
    const a = res.status === 'live' || res.status === 'stale' ? res.reading?.attribution ?? null : null;
    const key = a ? `${a.text}|${a.url}|${a.licence}|${a.licenceUrl}` : '';
    if (key !== creditKey) { creditKey = key; ctx.credit(a); }
    if (open) panel.render({ ...panelOf(res, now), enabled: inputs.enabled, reduced: pref.reduced, systemReduced: mq.matches });
    // Un relevé vieillit même sans relecture (onglet ouvert sans interaction) : « ancien » après 1 h, retiré après 3 h (règle 1)
    clearTimeout(ageTimer);
    const r = res.reading;
    if (r && !r.forced) {
      const age = now - r.observedAtMs, next = age < OLD_AFTER_S * 1000 ? OLD_AFTER_S * 1000 : WEATHER_MAX_AGE_S * 1000 + 1;
      if (age < next) ageTimer = setTimeout(update, next - age);
    } else if (r?.forced && r.forcedUntilMs !== null && r.forcedUntilMs >= now) {
      // Météo forcée (US012) : la scène la quitte à sa fin, même sans relecture (visiteur inactif) ; client.ts relit 5 s après
      ageTimer = setTimeout(update, r.forcedUntilMs - now + 1);
    }
  };

  // Lecture de /api/weather (US004) : jamais avec ?weather= (zéro réseau)
  const client = inputs.url ? null : createWeatherClient({
    visible: () => document.visibilityState === 'visible',
    onResult: (r) => {
      if (r.ok) real = { api: 'ok', reading: readingFromResponse(r.body) };
      else if (r.reason === 'absente') real = { api: 'none', reading: null }; // carte du Pi (sans API) : puce masquée, plus de relecture
      else if (r.reason === 'desactivee') real = { api: 'disabled', reading: null };
      // Panne passagère : on garde le dernier relevé, présenté comme ancien (il disparaîtra à 3 h), sinon ciel par défaut
      else real = { api: 'unavailable', reading: real.reading && { ...real.reading, stale: true } };
      update();
    },
  });
  const setEnabled = (on: boolean) => {
    pref.enabled = inputs.enabled = on;
    saveWeatherPref(pref);
    if (!on) client?.stop();
    else if (client) { real = { api: 'waiting', reading: real.reading }; client.start(); }
    update();
  };
  if (client && inputs.enabled) {
    real.api = 'waiting';
    client.start(early ?? undefined);
    early = null;
  }
  document.addEventListener('visibilitychange', () => client?.wake());
  for (const ev of ['pointerdown', 'keydown', 'wheel']) window.addEventListener(ev, () => client?.interaction(), { passive: true });
  window.addEventListener('online', () => client?.online());
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
      let sky = false;
      if (blending) {
        const { cloud, rain, snow, fog, storm } = cur;
        blending = blendLook(cur, target, dt);
        // Le ciel ne lit que les nuages et les précipitations : le fondu du vent (plus long) ne recalcule pas l'ambiance
        sky = cur.cloud !== cloud || cur.rain !== rain || cur.snow !== snow || cur.fog !== fog || cur.storm !== storm;
      }
      // Brouillard (suit la caméra), pluie (et son vent), sol mouillé ; vrai si les lueurs de nuit changent ; sans effet, rien
      if (effects.update(cur, dt) || sky) ctx.sky(skyModifier);
    },
    onClock(c) {
      const live = isLive(c);
      effects.setWinter(inputs.enabled && c.season === 'winter');
      if (live !== inputs.live) { inputs.live = live; update(); }
      else if (ctx.night() > 0.5 !== night) showChip(); // icône de nuit (lune)
    },
    togglePanel() {
      if (!inputs.enabled) { setEnabled(true); return; }
      open = !open;
      if (open) { panel.open(); tick = setInterval(update, 60_000); } else panel.close();
      update();
    },
    reducedMotion: () => mq.matches || pref.reduced,
    set(v) {
      inputs.debug = v ? { condition: v.condition ?? null, look: debugLook(v) } : null;
      update();
    },
    live(v) {
      debugReading = v
        ? { condition: v.condition ?? 'cloudy', look: debugLook(v), temperatureC: v.temperatureC ?? null, forced: false, forcedUntilMs: null, stale: false, observedAtMs: Date.now(), model: 'debug' }
        : null;
      update();
    },
    state: () => ({ status: res.status, condition: res.condition, target: { ...target }, current: { ...cur }, quality: ctx.quality, reduced: mq.matches || pref.reduced }),
  };
}
