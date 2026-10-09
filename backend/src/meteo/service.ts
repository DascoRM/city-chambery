import { WEATHER_MAX_AGE_S, type WeatherResponse } from '../../../contrat/meteo.js';
import { fetchOpenMeteo, WeatherUpstreamError, type Fetch, type Upstream } from './open-meteo.js';
import { normalize } from './normalize.js';

/**
 * Service météo (EP009), un par instance de fonction (créé par `createApp`) ; rien n'est appelé au chargement du module.
 * - Relevé gardé en mémoire 10 min, une seule requête à la source en vol : 100 visiteurs en même temps font 1 appel,
 *   aucun visiteur n'en fait aucun (relevé à la demande, D10).
 * - Après un échec, pas de nouvel essai avant 60 s : on ne martèle pas la source.
 * - Repli : le dernier bon relevé, avec `stale: true`, tant que son pas de 15 min a moins de 3 h ; ensuite indisponible.
 */
export const FRESH_MS = 10 * 60_000;
export const RETRY_MS = 60_000;
/** Durée de mise en cache par le CDN de Vercel (`s-maxage`) */
export const CDN_MAX_AGE_S = 60;

export interface WeatherDeps {
  /** Accès à la source (tests et contrôle du build : source simulée, sans réseau) */
  fetch?: Fetch;
  /** Horloge en millisecondes ; par défaut l'heure réelle */
  now?: () => number;
}

export type WeatherResult = { ok: true; body: WeatherResponse } | { ok: false; code: 'meteo-indisponible' };

export function createWeatherService(deps: WeatherDeps = {}) {
  const fetchImpl: Fetch = deps.fetch ?? ((url, init) => fetch(url, init));
  const now = deps.now ?? Date.now;
  let last: { upstream: Upstream; fetchedAtMs: number } | null = null;
  let lastFailureAt = -Infinity;
  let inflight: Promise<void> | null = null;

  async function refresh() {
    try {
      last = { upstream: await fetchOpenMeteo(fetchImpl, now()), fetchedAtMs: now() };
    } catch (err) {
      lastFailureAt = now();
      // Aucune donnée du visiteur ici : la requête vers la source n'en contient pas
      console.warn('[meteo] source indisponible :', err instanceof WeatherUpstreamError ? err.message : String(err));
    }
  }

  /** Relit la source si le relevé a plus de 10 min, sauf échec depuis moins de 60 s ; requête partagée par les visiteurs */
  async function ensureFresh() {
    const t = now();
    if (last && t - last.fetchedAtMs < FRESH_MS) return;
    if (t - lastFailureAt < RETRY_MS) return;
    inflight ??= refresh().finally(() => { inflight = null; });
    await inflight;
  }

  return {
    /** La météo à servir aux visiteurs, ou pourquoi il n'y en a pas */
    async current(): Promise<WeatherResult> {
      await ensureFresh();
      if (!last || now() / 1000 - last.upstream.current.time > WEATHER_MAX_AGE_S) return { ok: false, code: 'meteo-indisponible' };
      return { ok: true, body: { ...normalize(last.upstream, last.fetchedAtMs), stale: now() - last.fetchedAtMs >= FRESH_MS } };
    },
  };
}
export type WeatherService = ReturnType<typeof createWeatherService>;
