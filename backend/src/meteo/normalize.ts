import type { WeatherAttribution, WeatherCondition, WeatherResponse } from '../../../contrat/meteo.js';
import { WEATHER_MODEL, type Upstream } from './open-meteo.js';

/**
 * Normalisation (EP009) : relevé brut de la source → réponse du contrat ; c'est ici que les codes de la source deviennent
 * les 9 conditions du contrat (règles 4 et 5 de l'epic). La présence et la force de la pluie, de la neige et du brouillard
 * viennent des valeurs continues (mm/h, %, m) ; bruine ou pluie, et le ciel par temps sec, suivent le code de la source quand
 * il existe (D9 : même libellé que la source 98 % du temps). Tous les seuils ci-dessous sont des CHOIX DE RENDU, à calibrer
 * avec Dasco (D7), pas des faits météo.
 */
export const PRECIP_MIN_MMH = 0.1; // en dessous : pas de précipitation visible
export const DRIZZLE_MAX_MMH = 0.5; // en dessous (sans code de la source) : bruine plutôt que pluie
export const RAIN_FULL_MMH = 8; // intensité 1 (forte averse)
export const SNOW_FULL_MMH = 3; // intensité 1, en mm d'eau par heure (≈ 4 cm de neige par heure)
export const SNOW_MAX_C = 2; // règle 6 de l'epic : au-dessus, ce qui tombe est rendu en pluie
export const SNOW_SHARE = 0.7; // part de neige au-dessus de laquelle on parle de neige ; entre 0,3 et 0,7 : pluie et neige
export const FOG_CLEAR_M = 5000; // visibilité au-dessus de laquelle il n'y a pas de brouillard
export const FOG_FULL_M = 200; // visibilité au-dessous de laquelle le brouillard est maximal
export const FOG_FROM_CODE = 0.7; // brouillard quand le modèle ne donne pas la visibilité mais le code 45 ou 48
export const CLEAR_MAX = 0.25; // couverture nuageuse sans code de la source : ciel dégagé au-dessous
export const PARTLY_MAX = 0.75; // … éclaircies au-dessous, couvert au-dessus

/** Crédit demandé par la licence CC BY 4.0 d'Open-Meteo (crédit, lien, licence, modifications signalées) */
export const ATTRIBUTION: WeatherAttribution = {
  text: 'Météo : Open-Meteo.com, modèle ICON du DWD (données adaptées pour le diorama)',
  url: 'https://open-meteo.com/',
  licence: 'CC BY 4.0',
  licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
/** Échelle logarithmique : une bruine se voit, une averse ne sature pas tout de suite */
export const intensity = (mmH: number, full: number) => clamp01(Math.log1p(Math.max(0, mmH)) / Math.log1p(full));
/** 1 à 200 m ou moins, 0,5 à 1 000 m (définition du brouillard), 0 à 5 km ou plus */
export const fogFromVisibility = (m: number) => clamp01(Math.log(FOG_CLEAR_M / Math.max(1, m)) / Math.log(FOG_CLEAR_M / FOG_FULL_M));

/** Condition correspondant au code WMO de la source (les 28 codes documentés par Open-Meteo) ; null pour un code inconnu */
export function conditionFromWmo(code: number): WeatherCondition | null {
  if (code <= 1) return 'clear';
  if (code === 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95 && code <= 99) return 'thunder';
  return null;
}

const iso = (ms: number) => new Date(ms).toISOString();

export function normalize(u: Upstream, fetchedAtMs: number): WeatherResponse {
  const c = u.current;
  const perHour = 3600 / c.interval; // les cumuls d'Open-Meteo portent sur l'intervalle (15 min pour `current`)
  const precipMmH = c.precipitation * perHour;
  const snowWaterMmH = (((c.snowfall ?? 0) * 10) / 7) * perHour; // cm de neige → mm d'eau : 7 cm = 10 mm (doc Open-Meteo)
  const share = precipMmH > 0 ? clamp01(snowWaterMmH / precipMmH) : 0;
  const cold = c.temperature_2m <= SNOW_MAX_C;
  const snowMmH = cold ? precipMmH * share : 0;
  const rainMmH = precipMmH - snowMmH;
  const code = c.weather_code ?? null;
  const vis = c.visibility ?? null;
  const fog = vis !== null ? fogFromVisibility(vis) : code === 45 || code === 48 ? FOG_FROM_CODE : 0;
  const thunder = code !== null && code >= 95 && code <= 99; // le potentiel d'éclair n'est pas utilisé : pas d'éclair « en temps réel »
  const cloudCover = clamp01(c.cloud_cover / 100);

  const label = code === null ? null : conditionFromWmo(code);
  let condition: WeatherCondition;
  if (thunder) condition = 'thunder';
  else if (precipMmH >= PRECIP_MIN_MMH) {
    if (cold && share >= SNOW_SHARE) condition = 'snow';
    else if (cold && share > 1 - SNOW_SHARE) condition = 'sleet';
    else if (label === 'drizzle' || label === 'rain') condition = label;
    else condition = precipMmH < DRIZZLE_MAX_MMH ? 'drizzle' : 'rain';
  } else if (fog >= 0.5) condition = 'fog';
  else if (label === 'clear' || label === 'partly' || label === 'cloudy') condition = label;
  else condition = cloudCover < CLEAR_MAX ? 'clear' : cloudCover < PARTLY_MAX ? 'partly' : 'cloudy';

  return {
    v: 1,
    source: 'open-meteo',
    model: WEATHER_MODEL,
    observedAt: iso(c.time * 1000),
    fetchedAt: iso(fetchedAtMs),
    stale: false,
    forced: false,
    condition,
    temperatureC: round(c.temperature_2m, 1),
    cloudCover: round(cloudCover),
    precipMmH: round(precipMmH),
    rainIntensity: round(precipMmH >= PRECIP_MIN_MMH ? intensity(rainMmH, RAIN_FULL_MMH) : 0),
    snowIntensity: round(precipMmH >= PRECIP_MIN_MMH ? intensity(snowMmH, SNOW_FULL_MMH) : 0),
    windKmh: round(c.wind_speed_10m, 1),
    windGustKmh: c.wind_gusts_10m == null ? null : round(c.wind_gusts_10m, 1),
    windFromDeg: c.wind_direction_10m,
    visibilityM: vis,
    fog: round(fog),
    thunder,
    attribution: ATTRIBUTION,
  };
}
