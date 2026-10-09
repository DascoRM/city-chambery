import * as z from 'zod/mini';

/**
 * Client Open-Meteo (EP009). Coordonnées FIXES : jamais celles du visiteur (règle 3 de l'epic), aucun paramètre de la
 * requête publique n'est transmis à la source. Point : centre de l'emprise du diorama (`frontend/carte/diorama.config.json`,
 * mêmes valeurs que `CHAMBERY` de la carte) ; la source répond avec son point de grille (45,56 ; 5,92 relevé le 09/10/2026).
 * Modèle `icon_seamless` (DWD ICON-D2 2 km, puis ICON-EU, puis global) : parmi les modèles essayés, seule la famille ICON
 * (que `best_match` suit à Chambéry) donne la visibilité et le potentiel d'éclair ; `meteofrance_seamless` (AROME) les rend
 * `null` et n'a donné aucun code de brouillard ni d'orage sur 1 434 h d'historique (essai du 09/10/2026, plan ep009-back-plan-v2 § 1).
 * Un nom de modèle explicite ne change pas sans prévenir, contrairement à `best_match`.
 */
export const WEATHER_POINT = { lat: 45.5658, lon: 5.9205 } as const;
export const WEATHER_MODEL = 'icon_seamless';
/** 10 variables au plus : au-delà, Open-Meteo compte une requête comme plusieurs appels (1,1 ; 1,2…) */
export const CURRENT_VARS = [
  'temperature_2m', 'weather_code', 'cloud_cover', 'precipitation', 'snowfall',
  'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'visibility', 'lightning_potential',
] as const;
/** Délai de l'appel à la source (mesuré le 09/10/2026 : 0,6 à 1,9 s) */
export const UPSTREAM_TIMEOUT_MS = 4000;

export const upstreamUrl = () => {
  const q = new URLSearchParams({
    latitude: String(WEATHER_POINT.lat), longitude: String(WEATHER_POINT.lon),
    current: CURRENT_VARS.join(','), models: WEATHER_MODEL, timeformat: 'unixtime', timezone: 'GMT',
  });
  return `https://api.open-meteo.com/v1/forecast?${q}`;
};

const num = (min: number, max: number) => z.number().check(z.gte(min), z.lte(max));
const optNum = (min: number, max: number) => z.optional(z.nullable(num(min, max)));

/** Réponse attendue de la source : un champ manquant ou aberrant fait rejeter tout le relevé (on passe au repli) */
export const upstreamSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  elevation: z.optional(z.nullable(z.number())),
  current: z.object({
    /** Heure de validité du pas, en secondes ; bornée (an 2100) pour qu'une valeur absurde soit un `format`, pas une exception */
    time: z.int().check(z.gte(0), z.lte(4_102_444_800)),
    interval: z.int().check(z.gte(60), z.lte(3600)),
    temperature_2m: num(-40, 50),
    weather_code: optNum(0, 99),
    cloud_cover: num(0, 100),
    precipitation: num(0, 200),
    snowfall: optNum(0, 100),
    wind_speed_10m: num(0, 300),
    wind_direction_10m: num(0, 360),
    wind_gusts_10m: optNum(0, 400),
    visibility: optNum(0, 200_000),
    lightning_potential: optNum(0, 100_000),
  }),
});
export type Upstream = z.infer<typeof upstreamSchema>;

export type UpstreamError = 'reseau' | 'delai' | `http-${number}` | 'format' | 'perime';
export class WeatherUpstreamError extends Error {
  constructor(readonly kind: UpstreamError, detail?: string) {
    super(detail ? `${kind} : ${detail}` : kind);
  }
}

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Le délai (`AbortSignal.timeout`) est dépassé, pendant la connexion ou pendant la lecture du corps */
const isTimeout = (err: unknown) => ['TimeoutError', 'AbortError'].includes((err as Error)?.name);

/** Un appel à la source ; lève `WeatherUpstreamError` (le message ne contient jamais de donnée du visiteur) */
export async function fetchOpenMeteo(fetchImpl: Fetch, nowMs: number): Promise<Upstream> {
  let res: Response;
  try {
    res = await fetchImpl(upstreamUrl(), { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS), headers: { 'user-agent': 'chambery-diorama-api' } });
  } catch (err) {
    throw new WeatherUpstreamError(isTimeout(err) ? 'delai' : 'reseau');
  }
  if (!res.ok) throw new WeatherUpstreamError(`http-${res.status}`, (await res.text().catch(() => '')).slice(0, 200));
  let body: unknown = null; // pas du JSON : refusé plus bas (`format`)
  try {
    body = await res.json();
  } catch (err) {
    if (isTimeout(err)) throw new WeatherUpstreamError('delai'); // la source s'est arrêtée en cours de réponse
  }
  const checked = upstreamSchema.safeParse(body);
  if (!checked.success) throw new WeatherUpstreamError('format', checked.error.issues.map((i) => i.path.join('.')).join(', ').slice(0, 200));
  // Pas de 15 min trop vieux (source figée) ou dans le futur (horloge folle) : refusé
  const ageS = nowMs / 1000 - checked.data.current.time;
  if (ageS > 2 * 3600 || ageS < -15 * 60) throw new WeatherUpstreamError('perime', `pas de ${new Date(checked.data.current.time * 1000).toISOString()}`);
  return checked.data;
}
