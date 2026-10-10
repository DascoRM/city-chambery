import {
  WEATHER_MAX_AGE_S, type AdminWeatherResponse, type WeatherOverride, type WeatherOverrideInput, type WeatherResponse,
} from '../../../contrat/meteo.js';
import { fetchOpenMeteo, WEATHER_MODEL, WEATHER_POINT, WeatherUpstreamError, type Fetch, type Upstream } from './open-meteo.js';
import { forcedResponse, normalize } from './normalize.js';

/**
 * Service météo (EP009), un par instance de fonction (créé par `createApp`) ; rien n'est appelé au chargement du module.
 * - Relevé gardé en mémoire jusqu'au pas de 15 min suivant de la source, une seule requête à la source en vol : 100 visiteurs
 *   en même temps font 1 appel, aucun visiteur n'en fait aucun (relevé à la demande, D10) ; au plus 4 appels par heure.
 * - Après un échec, pas de nouvel essai avant 60 s (10 min après un refus 429 : la source limite les appels par adresse IP).
 * - Repli : le dernier bon relevé, avec `stale: true`, tant que son pas de 15 min a moins de 3 h ; ensuite indisponible.
 * - Forçage de l'administration (US012, rangé dans `app_meta`) : relu en base au plus toutes les 30 min sans forçage connu,
 *   toutes les 2 min pendant un forçage, jamais plus de 1,5 s d'attente pour une requête ; l'écriture depuis l'administration
 *   met aussi à jour cette instance. Un forçage échu est oublié à l'heure dite, sans écriture : la météo réelle revient seule.
 */
/** La source publie le pas suivant dès son heure de début (constaté le 09/10/2026) : marge avant de la rappeler */
export const STEP_MARGIN_MS = 30_000;
/** Jamais deux appels à la source à moins de 60 s, même si elle tarde à publier le pas suivant */
export const MIN_GAP_MS = 60_000;
/** Un relevé n'est jamais gardé plus de 15 min (pas d'une heure d'un autre modèle) */
export const MAX_FRESH_MS = 15 * 60_000;
export const RETRY_MS = 60_000;
export const RATE_LIMITED_RETRY_MS = 10 * 60_000;
/** Durée de mise en cache par le CDN de Vercel (`s-maxage`), puis autant de `stale-while-revalidate` */
export const CDN_MAX_AGE_S = 60;
/** Forçage relu en base : sans forçage connu, puis pendant un forçage (R2 d'US012 : réveils de Neon bornés) */
export const OVERRIDE_IDLE_MS = 30 * 60_000;
export const OVERRIDE_ACTIVE_MS = 2 * 60_000;
/** Attente maximale de la base pour une requête (Neon en veille) ; au-delà, l'état connu, la lecture continue */
export const OVERRIDE_READ_TIMEOUT_MS = 1500;
/** Base injoignable : nouvel essai de lecture du forçage */
export const OVERRIDE_RETRY_MS = 60_000;

/** Accès au forçage en base (`override-store.ts`) */
export interface OverrideStore {
  read(): Promise<WeatherOverride | null>;
  /** Enregistre (ou remplace) le forçage, avec sa ligne de journal */
  save(o: WeatherOverride): Promise<void>;
  /** Retire le forçage ; vrai s'il était encore en vigueur à `nowMs` (et alors journalisé) */
  clear(by: string, nowMs: number): Promise<boolean>;
}

export interface WeatherDeps {
  /** Accès à la source (tests et contrôle du build : source simulée, sans réseau) */
  fetch?: Fetch;
  /** Horloge en millisecondes ; par défaut l'heure réelle */
  now?: () => number;
  /** Forçage en base ; null ou absent sans base (contrôle du build, prévisualisation sans base) : jamais de forçage */
  overrides?: () => OverrideStore | null;
  /** Tests : attente maximale de la base (par défaut OVERRIDE_READ_TIMEOUT_MS) */
  overrideTimeoutMs?: number;
}

/**
 * `cdnS` : durée de vie de la réponse dans le CDN, en secondes (s-maxage + stale-while-revalidate, `publicCache` de routes.ts) ;
 * 0 : ne pas la mettre en cache.
 */
export type WeatherResult = { ok: true; body: WeatherResponse; cdnS: number } | { ok: false; code: 'meteo-indisponible' | 'meteo-desactivee' };

interface Reading { upstream: Upstream; fetchedAtMs: number }

/** Jusqu'à quand un relevé sert : début du pas suivant de la source (+ marge), au plus 15 min, au moins 60 s */
function freshUntil(r: Reading): number {
  const nextStepMs = (r.upstream.current.time + r.upstream.current.interval) * 1000 + STEP_MARGIN_MS;
  return Math.max(r.fetchedAtMs + MIN_GAP_MS, Math.min(nextStepMs, r.fetchedAtMs + MAX_FRESH_MS));
}

const inForce = (o: WeatherOverride | null, t: number): o is WeatherOverride => !!o && Date.parse(o.until) > t;

/** Attend `p`, au plus `ms` */
function within(p: Promise<void>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    void p.finally(() => { clearTimeout(timer); resolve(); });
  });
}

export function createWeatherService(deps: WeatherDeps = {}) {
  const fetchImpl: Fetch = deps.fetch ?? ((url, init) => fetch(url, init));
  const now = deps.now ?? Date.now;
  const overrideTimeoutMs = deps.overrideTimeoutMs ?? OVERRIDE_READ_TIMEOUT_MS;
  /** Compteurs de cette instance (écran admin) : perdus au redémarrage, ce ne sont pas des totaux */
  const stats = { startedAt: now(), upstreamCalls: 0, upstreamFailures: 0, lastError: null as string | null, lastErrorAt: null as number | null };
  let last: Reading | null = null;
  let retryAt = -Infinity;
  let inflight: Promise<void> | null = null;
  /** Dernier forçage lu ou écrit par cette instance ; `known` : au moins une lecture réussie (sinon l'état est incertain) */
  let override: WeatherOverride | null = null;
  let known = false;
  let checkAt = -Infinity;
  let reading: { promise: Promise<void>; startedAt: number } | null = null;

  async function refresh() {
    stats.upstreamCalls++;
    try {
      last = { upstream: await fetchOpenMeteo(fetchImpl, now()), fetchedAtMs: now() };
    } catch (err) {
      const limited = err instanceof WeatherUpstreamError && err.kind === 'http-429';
      retryAt = now() + (limited ? RATE_LIMITED_RETRY_MS : RETRY_MS);
      stats.upstreamFailures++;
      stats.lastError = err instanceof WeatherUpstreamError ? err.message : String(err);
      stats.lastErrorAt = now();
      // Aucune donnée du visiteur ici : la requête vers la source n'en contient pas
      console.warn('[meteo] source indisponible :', stats.lastError);
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

  /**
   * Relit le forçage en base s'il est temps (ou toujours, `force`, pour l'écran admin). Une seule lecture en vol ; la requête
   * l'attend au plus `overrideTimeoutMs` depuis son début (Neon qui se réveille), puis répond avec l'état connu.
   */
  async function readOverride(force: boolean) {
    const store = deps.overrides?.() ?? null;
    if (!store) { override = null; known = true; return; } // sans base, jamais de forçage
    if (!reading && (force || now() >= checkAt)) {
      const startedAt = now();
      const promise = store.read().then(
        (o) => { override = o; known = true; checkAt = now() + (inForce(o, now()) ? OVERRIDE_ACTIVE_MS : OVERRIDE_IDLE_MS); },
        (err) => { checkAt = now() + OVERRIDE_RETRY_MS; console.warn('[meteo] forçage illisible (base injoignable ?) :', String(err)); },
      ).finally(() => { reading = null; });
      reading = { promise, startedAt };
    }
    if (reading) {
      const left = reading.startedAt + overrideTimeoutMs - now();
      if (left > 0) await within(reading.promise, left);
    }
  }

  /** Forçage en vigueur (un forçage échu est oublié à l'heure dite) */
  const active = () => (inForce(override, now()) ? override : null);

  async function current(force = false): Promise<WeatherResult> {
    // En parallèle : la base (forçage) et la source (relevé réel, que l'écran admin montre aussi pendant un forçage)
    await Promise.all([readOverride(force), ensureFresh()]);
    const t = now();
    const o = active();
    if (o?.mode === 'coupee') return { ok: false, code: 'meteo-desactivee' };
    if (o?.mode === 'forcee' && o.condition) {
      // Jamais servie par le CDN après sa fin : s-maxage + stale-while-revalidate tiennent dans le temps restant
      const leftS = Math.floor((Date.parse(o.until) - t) / 1000);
      return { ok: true, body: forcedResponse({ ...o, condition: o.condition }), cdnS: Math.min(2 * CDN_MAX_AGE_S, leftS) };
    }
    if (!last || t / 1000 - last.upstream.current.time > WEATHER_MAX_AGE_S) return { ok: false, code: 'meteo-indisponible' };
    // Encore périmé après `ensureFresh` : la source n'a pas répondu, on sert le dernier bon relevé. Forçage pas encore lu
    // (base qui se réveille) : réponse juste, mais pas mise en cache ; la suivante saura
    return { ok: true, body: { ...normalize(last.upstream, last.fetchedAtMs), stale: t >= freshUntil(last) }, cdnS: known ? 2 * CDN_MAX_AGE_S : 0 };
  }

  const iso = (ms: number) => new Date(ms).toISOString();

  return {
    /** La météo à servir aux visiteurs, ou pourquoi il n'y en a pas */
    current: () => current(),

    /** Forcer ou couper la météo (route admin) : écrit en base, puis cette instance le sait tout de suite */
    async setOverride(input: WeatherOverrideInput, by: string, store: OverrideStore): Promise<WeatherOverride> {
      const t = now();
      const o: WeatherOverride = {
        mode: input.mode,
        ...(input.mode === 'forcee' ? { condition: input.condition } : {}),
        ...(input.mode === 'forcee' && input.intensity !== undefined ? { intensity: input.intensity } : {}),
        ...(input.mode === 'forcee' && input.windKmh !== undefined ? { windKmh: input.windKmh } : {}),
        ...(input.mode === 'forcee' && input.windFromDeg !== undefined ? { windFromDeg: input.windFromDeg } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
        since: iso(t),
        until: iso(t + input.minutes * 60_000),
        by,
      };
      await store.save(o);
      override = o;
      known = true;
      checkAt = now() + OVERRIDE_ACTIVE_MS;
      return o;
    },

    /** Revenir à la météo réelle (route admin) ; faux s'il n'y avait pas de forçage en vigueur */
    async clearOverride(by: string, store: OverrideStore): Promise<boolean> {
      const was = await store.clear(by, now());
      override = null;
      known = true;
      checkAt = now() + OVERRIDE_IDLE_MS;
      return was;
    },

    /** Écran « Météo » : la base est relue à chaque fois (l'admin voit l'état écrit, pas celui de cette instance) */
    async adminView(): Promise<AdminWeatherResponse> {
      const r = await current(true);
      return {
        public: r.ok ? r.body : null,
        publicCode: r.ok ? null : r.code,
        upstream: last && {
          model: WEATHER_MODEL,
          fetchedAt: iso(last.fetchedAtMs),
          observedAt: iso(last.upstream.current.time * 1000),
          grid: { lat: last.upstream.latitude, lon: last.upstream.longitude, elevationM: last.upstream.elevation ?? null },
          raw: Object.fromEntries(Object.entries(last.upstream.current).map(([k, v]) => [k, v ?? null])),
        },
        override: active(),
        instance: {
          startedAt: iso(stats.startedAt), upstreamCalls: stats.upstreamCalls, upstreamFailures: stats.upstreamFailures,
          lastError: stats.lastError, lastErrorAt: stats.lastErrorAt === null ? null : iso(stats.lastErrorAt),
        },
        config: { lat: WEATHER_POINT.lat, lon: WEATHER_POINT.lon, model: WEATHER_MODEL, freshS: MAX_FRESH_MS / 1000, cdnMaxAgeS: CDN_MAX_AGE_S },
      };
    },
  };
}
export type WeatherService = ReturnType<typeof createWeatherService>;
