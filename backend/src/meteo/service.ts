import { WEATHER_MAX_AGE_S, type WeatherResponse } from '../../../contrat/meteo.js';
import { fetchOpenMeteo, WeatherUpstreamError, type Fetch, type Upstream } from './open-meteo.js';
import { normalize } from './normalize.js';

/**
 * Service météo (EP009), un par instance de fonction (créé par `createApp`) ; rien n'est appelé au chargement du module.
 * - Relevé gardé en mémoire jusqu'au pas de 15 min suivant de la source, une seule requête à la source en vol : 100 visiteurs
 *   en même temps font 1 appel, aucun visiteur n'en fait aucun (relevé à la demande, D10) ; au plus 4 appels par heure.
 * - Après un échec, pas de nouvel essai avant 60 s (10 min après un refus 429 : la source limite les appels par adresse IP).
 * - Repli : le dernier bon relevé, avec `stale: true`, tant que son pas de 15 min a moins de 3 h ; ensuite indisponible.
 */
/** La source publie le pas suivant dès son heure de début (constaté le 09/10/2026) : marge avant de la rappeler */
export const STEP_MARGIN_MS = 30_000;
/** Jamais deux appels à la source à moins de 60 s, même si elle tarde à publier le pas suivant */
export const MIN_GAP_MS = 60_000;
/** Un relevé n'est jamais gardé plus de 15 min (pas d'une heure d'un autre modèle) */
export const MAX_FRESH_MS = 15 * 60_000;
export const RETRY_MS = 60_000;
export const RATE_LIMITED_RETRY_MS = 10 * 60_000;
/** Durée de mise en cache par le CDN de Vercel (`s-maxage`) */
export const CDN_MAX_AGE_S = 60;

export interface WeatherDeps {
  /** Accès à la source (tests et contrôle du build : source simulée, sans réseau) */
  fetch?: Fetch;
  /** Horloge en millisecondes ; par défaut l'heure réelle */
  now?: () => number;
}

export type WeatherResult = { ok: true; body: WeatherResponse } | { ok: false; code: 'meteo-indisponible' };

interface Reading { upstream: Upstream; fetchedAtMs: number }

/** Jusqu'à quand un relevé sert : début du pas suivant de la source (+ marge), au plus 15 min, au moins 60 s */
function freshUntil(r: Reading): number {
  const nextStepMs = (r.upstream.current.time + r.upstream.current.interval) * 1000 + STEP_MARGIN_MS;
  return Math.max(r.fetchedAtMs + MIN_GAP_MS, Math.min(nextStepMs, r.fetchedAtMs + MAX_FRESH_MS));
}

export function createWeatherService(deps: WeatherDeps = {}) {
  const fetchImpl: Fetch = deps.fetch ?? ((url, init) => fetch(url, init));
  const now = deps.now ?? Date.now;
  let last: Reading | null = null;
  let retryAt = -Infinity;
  let inflight: Promise<void> | null = null;

  async function refresh() {
    try {
      last = { upstream: await fetchOpenMeteo(fetchImpl, now()), fetchedAtMs: now() };
    } catch (err) {
      const limited = err instanceof WeatherUpstreamError && err.kind === 'http-429';
      retryAt = now() + (limited ? RATE_LIMITED_RETRY_MS : RETRY_MS);
      // Aucune donnée du visiteur ici : la requête vers la source n'en contient pas
      console.warn('[meteo] source indisponible :', err instanceof WeatherUpstreamError ? err.message : String(err));
    }
  }

  /** Relit la source quand son pas suivant a commencé, sauf échec récent ; requête partagée par les visiteurs */
  async function ensureFresh() {
    const t = now();
    if (last && t < freshUntil(last)) return;
    if (t < retryAt) return;
    inflight ??= refresh().finally(() => { inflight = null; });
    await inflight;
  }

  return {
    /** La météo à servir aux visiteurs, ou pourquoi il n'y en a pas */
    async current(): Promise<WeatherResult> {
      await ensureFresh();
      if (!last || now() / 1000 - last.upstream.current.time > WEATHER_MAX_AGE_S) return { ok: false, code: 'meteo-indisponible' };
      // Encore périmé après `ensureFresh` : la source n'a pas répondu, on sert le dernier bon relevé
      return { ok: true, body: { ...normalize(last.upstream, last.fetchedAtMs), stale: now() >= freshUntil(last) } };
    },
  };
}
export type WeatherService = ReturnType<typeof createWeatherService>;
