import { WEATHER_CONDITION_FR, WEATHER_MAX_AGE_S, WEATHER_PRESETS, weatherCondition, type WeatherCondition } from '../../../../contrat/meteo.js';
import { chamberyClock } from '../time/chambery';

/**
 * Météo de la carte (EP009), logique pure testée en Vitest (ni navigateur ni three.js) : ce que la scène affiche et ce
 * que dit la puce, à partir d'un forçage par l'adresse (`?weather=`), de l'outil de debug, d'un relevé du back (US004) et
 * de la règle « Direct ou simulée » (D4). Règle 1 de l'epic : rien d'inventé (une météo forcée n'a pas de température, la
 * puce dit « modèle ICON, 10 h 00 », jamais « observé »).
 */

/** Valeurs de rendu de 0 à 1 (choix de rendu, pas des faits) ; vent « de maquette » (m/s) et direction où il va (0 = est, 90 = nord) */
export interface WeatherLook { cloud: number; rain: number; snow: number; fog: number; storm: number; windSpeed: number; windTowards: number }

/** Beau temps : la scène d'aujourd'hui, avec le vent de `content/life.json` (smoke.wind) */
export const clearLook = (wind: { towards: number; speed: number }): WeatherLook =>
  ({ cloud: 0, rain: 0, snow: 0, fog: 0, storm: 0, windSpeed: wind.speed, windTowards: wind.towards });

/** Règle 6 de l'epic : neige seulement à 2 °C ou moins, sinon pluie (le back l'applique aussi) */
export const SNOW_MAX_C = 2;
/** Vent réel (km/h) → vent « de maquette » (m/s) : la fumée et les drapeaux exagèrent, sinon rien ne se voit. À régler (US009) */
export const WIND_VISUAL = { base: 0.4, perKmh: 0.09, max: 6 };
/** Au-delà, un relevé est présenté comme « ancien » (un relevé normal a au plus ≈ 45 min : pas de 15 min, cache du back et du CDN, relecture) */
export const OLD_AFTER_S = 3600;

/** « D'où vient le vent » (météo : 0 = nord, sens horaire) → « vers où il va » (0 = est, 90 = nord, sens trigonométrique) */
export const windTowards = (fromDeg: number) => (((-90 - fromDeg) % 360) + 360) % 360;
export const windVisual = (kmh: number) => Math.min(WIND_VISUAL.max, WIND_VISUAL.base + WIND_VISUAL.perKmh * Math.max(0, kmh));

interface RawLook { cloudCover: number; rain: number; snow: number; fog: number; thunder: boolean; windKmh: number; windFromDeg: number; temperatureC: number | null }
function lookOf(v: RawLook): WeatherLook {
  let { rain, snow } = v;
  if (snow > 0 && v.temperatureC !== null && v.temperatureC > SNOW_MAX_C) { rain = Math.max(rain, snow); snow = 0; }
  return { cloud: v.cloudCover, rain, snow, fog: v.fog, storm: v.thunder ? 1 : 0, windSpeed: windVisual(v.windKmh), windTowards: windTowards(v.windFromDeg) };
}

/**
 * Valeurs types d'une météo forcée : les MÊMES règles que le forçage de l'administration côté back (`forcedResponse`,
 * backend/src/meteo/normalize.ts), donc le même rendu (R4 d'US002). `intensity` remplace l'intensité principale (pluie seule,
 * neige seule ou brouillard ; ignorée pour « pluie et neige » et pour le ciel sec) ; vent par défaut : 10 km/h d'ouest.
 */
export function presetLook(c: WeatherCondition, o: { intensity?: number | null; windKmh?: number | null; windFromDeg?: number | null; temperatureC?: number | null } = {}): WeatherLook {
  const p = WEATHER_PRESETS[c], i = o.intensity ?? undefined;
  return lookOf({
    cloudCover: p.cloudCover,
    rain: p.rainIntensity > 0 && p.snowIntensity === 0 ? (i ?? p.rainIntensity) : p.rainIntensity,
    snow: p.snowIntensity > 0 && p.rainIntensity === 0 ? (i ?? p.snowIntensity) : p.snowIntensity,
    fog: p.fog > 0 ? (i ?? p.fog) : 0,
    thunder: p.thunder,
    windKmh: o.windKmh ?? 10,
    windFromDeg: o.windFromDeg ?? 270,
    temperatureC: o.temperatureC ?? null,
  });
}

/** `?weather=rain&intensity=0.8&wind=40&windfrom=200&temp=4` → météo forcée par l'adresse ; null si absente ou inconnue */
export function weatherFromUrl(search: string): { condition: WeatherCondition; look: WeatherLook } | null {
  const q = new URLSearchParams(search);
  const c = weatherCondition.safeParse(q.get('weather'));
  if (!c.success) return null;
  const num = (k: string, min: number, max: number) => {
    const s = q.get(k);
    const v = s === null || s.trim() === '' ? NaN : Number(s);
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null;
  };
  return {
    condition: c.data,
    look: presetLook(c.data, { intensity: num('intensity', 0, 1), windKmh: num('wind', 0, 150), windFromDeg: num('windfrom', 0, 360), temperatureC: num('temp', -40, 50) }),
  };
}

/** Règle D4 : la météo réelle seulement en « Direct » (heure réelle et saison automatique) ; sinon « simulée » (beau temps) */
export const isLive = (c: { mode: string; season: string }) => c.mode === 'live' && c.season === 'auto';

/** Relevé retenu par la carte : réponse du back (US004) ou relevé simulé par l'outil de debug */
export interface Reading {
  condition: WeatherCondition;
  look: WeatherLook;
  /** null pour une météo forcée : on n'invente pas de température */
  temperatureC: number | null;
  /** Forcée depuis l'administration (démo, US012) */
  forced: boolean;
  forcedUntilMs: number | null;
  /** Le back sert son dernier bon relevé (la source n'a pas répondu) */
  stale: boolean;
  /** Heure de validité du pas du modèle (début du forçage pour une météo forcée) */
  observedAtMs: number;
  model: string | null;
}

/** État de la lecture de `/api/weather` : `none` tant qu'elle n'existe pas (US004) ou sans API (carte du Pi, 404) */
export type ApiState = 'none' | 'waiting' | 'ok' | 'unavailable' | 'disabled';

export interface WeatherInputs {
  /** Préférence du visiteur « Afficher la météo » */
  enabled: boolean;
  url: { condition: WeatherCondition; look: WeatherLook } | null;
  debug: { condition: WeatherCondition | null; look: WeatherLook } | null;
  api: ApiState;
  reading: Reading | null;
  /** Horloge en Direct (isLive) */
  live: boolean;
}

/**
 * Ce que montre la carte, par ordre de priorité (règle 13 : adresse › administration › direct) :
 * off (préférence) › url › debug › none (pas d'API) › admin (forcée, à toute heure : c'est une démo) › disabled (coupée par
 * l'administration) › simulated (hors Direct) › live / stale (relevé de moins de 3 h) › waiting / unavailable (ciel par défaut).
 */
export type WeatherStatus = 'off' | 'url' | 'debug' | 'none' | 'admin' | 'disabled' | 'simulated' | 'live' | 'stale' | 'waiting' | 'unavailable';
export interface Resolved { status: WeatherStatus; target: WeatherLook; condition: WeatherCondition | null; reading: Reading | null }

export function resolveWeather(i: WeatherInputs, nowMs: number, clear: WeatherLook): Resolved {
  const out = (status: WeatherStatus, target = clear, condition: WeatherCondition | null = null, reading: Reading | null = null): Resolved =>
    ({ status, target, condition, reading });
  if (!i.enabled) return out('off');
  if (i.url) return out('url', i.url.look, i.url.condition);
  if (i.debug) return out('debug', i.debug.look, i.debug.condition);
  if (i.api === 'none') return out('none');
  const r = i.reading;
  if (r?.forced) return out('admin', r.look, r.condition, r);
  if (i.api === 'disabled') return out('disabled');
  if (!i.live) return out('simulated', clear, 'clear');
  const age = r ? nowMs - r.observedAtMs : Infinity;
  if (r && age <= WEATHER_MAX_AGE_S * 1000) return out(r.stale || age > OLD_AFTER_S * 1000 ? 'stale' : 'live', r.look, r.condition, r);
  return out(i.api === 'waiting' ? 'waiting' : 'unavailable');
}

// --- Textes de la puce et du panneau ---------------------------------------------------------------

/** Icône d'une condition, de jour et de nuit */
const ICON: Record<WeatherCondition, [string, string]> = {
  clear: ['☀️', '🌙'], partly: ['⛅', '☁️'], cloudy: ['☁️', '☁️'], fog: ['🌫️', '🌫️'], drizzle: ['🌦️', '🌧️'],
  rain: ['🌧️', '🌧️'], snow: ['🌨️', '🌨️'], sleet: ['🌨️', '🌨️'], thunder: ['⛈️', '⛈️'],
};
const icon = (c: WeatherCondition | null, night: boolean) => ICON[c ?? 'partly'][night ? 1 : 0];
const temp = (t: number | null) => (t === null ? '' : `${Math.round(t)} °C`);
/** Heure de Chambéry : « 10 h 05 » */
export const hm = (ms: number) => { const t = Math.floor(chamberyClock(new Date(ms)).hour * 60 + 1e-6) % 1440; return `${Math.floor(t / 60)} h ${String(t % 60).padStart(2, '0')}`; };
/** Âge d'un relevé : « il y a 6 min », « il y a 1 h 10 » */
export const ago = (ms: number) => {
  const m = Math.round(ms / 60000);
  if (m < 1) return 'à l’instant';
  return m < 60 ? `il y a ${m} min` : `il y a ${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
};
/** `icon_seamless` → « ICON » */
export const modelLabel = (m: string | null) => (m ? m.split('_')[0].toUpperCase() : 'météo');
/** « modèle ICON, 10 h 00 (il y a 6 min) » : l'heure de validité du modèle, jamais « observé » (règle 1) */
const modelLine = (r: Reading, nowMs: number) => `modèle ${modelLabel(r.model)}, ${hm(r.observedAtMs)} (${ago(nowMs - r.observedAtMs)})`;

export interface ChipView { icon: string; text: string; label: string; off?: boolean }

/** Puce de la barre d'heure : null = masquée (pas d'API, première lecture en cours) ; texte masqué sous 720 px (icône seule) */
export function chipOf(s: Resolved, night: boolean): ChipView | null {
  const fr = s.condition ? WEATHER_CONDITION_FR[s.condition] : '';
  const r = s.reading;
  switch (s.status) {
    case 'off': case 'none': case 'waiting': return null; // 'off' : puce posée par la carte (ui.ts)
    case 'url': return { icon: icon(s.condition, night), text: 'Forcée', label: `Météo forcée par l’adresse : ${fr}` };
    case 'debug': return { icon: icon(s.condition, night), text: 'Debug', label: `Météo forcée par l’outil de debug${fr ? ` : ${fr}` : ''}` };
    case 'admin': return { icon: icon(s.condition, night), text: 'Démo', label: `Météo forcée (démo) : ${fr}` };
    case 'live': case 'stale': {
      const t = temp(r!.temperatureC);
      return { icon: icon(s.condition, night), text: t || fr, label: `Météo : ${fr}${t ? `, ${t}` : ''}, ${s.status === 'live' ? 'direct' : 'ancien relevé'}` };
    }
    case 'simulated': return { icon: icon('clear', night), text: 'Simulée', label: 'Météo simulée (beau temps) : l’heure ou la saison est choisie' };
    case 'disabled': return { icon: '⛅', text: 'Coupée', label: 'Météo coupée par l’administration', off: true };
    case 'unavailable': return { icon: '⛅', text: 'Indisponible', label: 'Météo non disponible', off: true };
  }
}

export interface PanelView { title: string; lines: string[]; backToLive: boolean }

/** Contenu du panneau de la puce (texte seulement : le panneau l'écrit avec textContent) */
export function panelOf(s: Resolved, nowMs: number): PanelView {
  const fr = s.condition ? WEATHER_CONDITION_FR[s.condition] : '';
  const r = s.reading;
  const view = (title: string, lines: string[], backToLive = false): PanelView => ({ title, lines, backToLive });
  switch (s.status) {
    case 'off': return view('Météo désactivée', ['Rien n’est téléchargé ni demandé : le ciel reste celui du cycle jour et nuit.']);
    case 'url': return view(fr, ['Forcée par l’adresse (?weather=) : démonstration, sans réseau ni température.']);
    case 'debug': return view(fr || 'Météo réglée à la main', ['Forcée par l’outil de debug.']);
    case 'admin': return view(fr, [`Météo forcée (démo) par l’administration${r?.forcedUntilMs ? `, jusqu’à ${hm(r.forcedUntilMs)}` : ''}.`]);
    case 'live': case 'stale': {
      const t = temp(r!.temperatureC);
      return view(`${fr}${t ? `, ${t}` : ''}`, [s.status === 'live' ? modelLine(r!, nowMs) : `Ancien relevé (${ago(nowMs - r!.observedAtMs)}) : modèle ${modelLabel(r!.model)}, ${hm(r!.observedAtMs)}.`]);
    }
    case 'simulated': return view('Beau temps simulé', ['L’heure ou la saison est choisie : la météo réelle ne s’affiche qu’en direct.'], true);
    case 'disabled': return view('Météo coupée', ['Coupée depuis l’administration : ciel par défaut. Nouvel essai dans 15 min.']);
    case 'none': case 'waiting': case 'unavailable': return view('Météo non disponible', ['Ciel par défaut ; nouvel essai automatique.']);
  }
}

// --- Fondu -------------------------------------------------------------------------------------

/** Rapproche `cur` de `target` (constante de temps tau, en s) : indépendant de la cadence, sans dépassement */
export const approach = (cur: number, target: number, dt: number, tau: number) => (tau <= 0 ? target : target + (cur - target) * Math.exp(-dt / tau));

/** Angle (degrés) par le plus court chemin */
export function approachAngle(cur: number, target: number, dt: number, tau: number): number {
  const d = ((((target - cur) % 360) + 540) % 360) - 180;
  return (((cur + d - approach(d, 0, dt, tau)) % 360) + 360) % 360;
}

const BLEND_KEYS = ['cloud', 'rain', 'snow', 'fog', 'storm', 'windSpeed'] as const;
/** Fondu (R3 d'US002) : tau 3 s pour le ciel, 6 s pour le vent ; cible atteinte exactement, puis plus rien ; true si quelque chose a bougé */
export function blendLook(cur: WeatherLook, target: WeatherLook, dt: number, tau = 3): boolean {
  let moved = false;
  for (const k of BLEND_KEYS) {
    const v = approach(cur[k], target[k], dt, k === 'windSpeed' ? tau * 2 : tau);
    const next = Math.abs(v - target[k]) < 1e-3 ? target[k] : v;
    if (next !== cur[k]) { moved = true; cur[k] = next; }
  }
  const a = approachAngle(cur.windTowards, target.windTowards, dt, tau * 2);
  const na = Math.abs(((((target.windTowards - a) % 360) + 540) % 360) - 180) < 0.05 ? target.windTowards : a;
  if (na !== cur.windTowards) { moved = true; cur.windTowards = na; }
  return moved;
}
