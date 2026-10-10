import type { WeatherResponse } from '../../../../contrat/meteo.js';
import { validWeather } from './state';

/**
 * Lecture de `/api/weather` (EP009-US004). Le diorama ne l'attend jamais : sans réponse conforme, ciel par défaut. La lecture
 * ne lève jamais d'exception (R1) : tout passe par `{ ok: false, reason }`. La météo reste en mémoire seulement (R2) : ni
 * localStorage ni service worker (`/api` n'est pas mis en cache, voir vite.config.ts).
 */
export type WeatherFetch =
  | { ok: true; body: WeatherResponse; ms: number }
  | { ok: false; reason: 'indisponible' | 'desactivee' | 'absente' | 'hors-contrat' | 'reseau' | 'delai'; ms: number };

/** Délai de la lecture (D10) : un démarrage à froid de la fonction et une source lente peuvent dépasser 3 s ; rien ne l'attend */
export const FETCH_TIMEOUT_MS = 8000;
/** Relecture après un succès (le modèle avance par pas de 15 min) ; météo coupée par l'administration : relue au même rythme */
export const REFRESH_MS = 15 * 60_000;
/** Premier nouvel essai après un échec, puis 2, 4, 8 min… au plus REFRESH_MS */
export const RETRY_MS = 60_000;
/** Sans interaction depuis ce temps, on ne relit plus (un onglet oublié ne réveille ni la fonction ni la base) */
export const IDLE_MS = 30 * 60_000;
/**
 * Fin d'une météo forcée par l'administration (US012) : relue 5 s après `forcedUntil` (le back ne la sert plus, et le CDN ne la
 * garde jamais au-delà de sa fin : routes.ts du back), au lieu d'attendre la relecture suivante
 */
export const FORCED_END_MARGIN_MS = 5_000;
/** … mais jamais plus d'une fois toutes les 30 s (horloge du visiteur en avance sur celle du serveur) */
export const FORCED_MIN_MS = 30_000;

export async function fetchWeather(f: typeof fetch = fetch, timeoutMs = FETCH_TIMEOUT_MS, now: () => number = Date.now): Promise<WeatherFetch> {
  const ctrl = new AbortController();
  const t0 = now();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const ms = () => now() - t0;
  try {
    const res = await f('/api/weather', { signal: ctrl.signal });
    if (res.status === 503) {
      const code = await res.json().then((b: { code?: unknown }) => b?.code, () => undefined);
      return { ok: false, reason: code === 'meteo-desactivee' ? 'desactivee' : 'indisponible', ms: ms() };
    }
    if (res.status === 404) return { ok: false, reason: 'absente', ms: ms() }; // carte sans API (Pi), ou API trop ancienne
    if (!res.ok) return { ok: false, reason: 'indisponible', ms: ms() }; // 5xx, mandataire en erreur : on réessaiera
    // Le délai court aussi pendant la lecture du corps : c'est un retard (« delai »), pas une réponse hors contrat
    const body = validWeather(await res.json().catch((e: Error) => { if (e?.name === 'AbortError') throw e; return null; }), now());
    return body ? { ok: true, body, ms: ms() } : { ok: false, reason: 'hors-contrat', ms: ms() };
  } catch (e) {
    return { ok: false, reason: (e as Error)?.name === 'AbortError' ? 'delai' : 'reseau', ms: ms() };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Délai avant la prochaine lecture (ms, compté depuis la dernière lecture `attemptAtMs`), ou null pour ne pas relire : jamais
 * sans API (404, carte du Pi) ; onglet caché ou visiteur inactif depuis 30 min : on attend son retour ; météo forcée : 5 s
 * après sa fin (au moins 30 s, au plus 15 min) ; 15 min après un succès ou une météo coupée ; après un échec, 60 s puis 2, 4,
 * 8 min, au plus 15 min.
 */
export function nextRefresh(last: WeatherFetch, failures: number, visible: boolean, idleMs: number, attemptAtMs = 0): number | null {
  if (!last.ok && last.reason === 'absente') return null;
  if (!visible || idleMs > IDLE_MS) return null;
  if (last.ok && last.body.forced && last.body.forcedUntil) {
    const end = Date.parse(last.body.forcedUntil) - attemptAtMs + FORCED_END_MARGIN_MS;
    return Math.min(REFRESH_MS, Math.max(FORCED_MIN_MS, end));
  }
  if (last.ok || last.reason === 'desactivee') return REFRESH_MS;
  return Math.min(REFRESH_MS, RETRY_MS * 2 ** Math.max(0, failures - 1));
}

/**
 * Relectures : une lecture tout de suite (ou celle déjà partie pendant le chargement de la ville), puis selon `nextRefresh`.
 * `wake()` au retour sur l'onglet, `interaction()` à chaque geste du visiteur, `online()` au retour du réseau : relecture
 * si elle est due. Minuteries et horloge injectables (tests).
 */
export function createWeatherClient(d: {
  onResult(r: WeatherFetch): void;
  visible(): boolean;
  fetch?: typeof fetch;
  now?: () => number;
}) {
  const now = d.now ?? Date.now;
  let last: WeatherFetch | null = null;
  let failures = 0, lastAttemptAt = 0, lastInputAt = now(), timer: ReturnType<typeof setTimeout> | undefined, busy = false, stopped = false;

  const load = async (pending?: Promise<WeatherFetch>) => {
    if (busy || stopped) return;
    busy = true;
    clearTimeout(timer);
    lastAttemptAt = now();
    const r = await (pending ?? fetchWeather(d.fetch, FETCH_TIMEOUT_MS, now));
    busy = false;
    if (stopped) return;
    last = r;
    failures = r.ok || r.reason === 'desactivee' ? 0 : failures + 1;
    d.onResult(r);
    schedule();
  };
  /** Programme la prochaine lecture ; si elle est déjà due (retour sur l'onglet), tout de suite */
  const schedule = () => {
    clearTimeout(timer);
    if (!last || stopped || busy) return;
    const delay = nextRefresh(last, failures, d.visible(), now() - lastInputAt, lastAttemptAt);
    if (delay === null) return;
    timer = setTimeout(() => {
      // Revérifié au moment de relire : l'onglet a pu être caché, le visiteur a pu partir
      if (last && nextRefresh(last, failures, d.visible(), now() - lastInputAt, lastAttemptAt) !== null) void load();
    }, Math.max(0, delay - (now() - lastAttemptAt)));
  };

  return {
    /** Première lecture ; `pending` : celle déjà partie pendant le chargement de la ville (prefetch) */
    start(pending?: Promise<WeatherFetch>) { stopped = false; void load(pending); },
    /** Changement de visibilité de l'onglet : y revenir compte comme une présence (le temps passé ailleurs n'est pas de l'inactivité) */
    wake() {
      if (d.visible()) lastInputAt = now();
      schedule();
    },
    interaction() {
      const away = now() - lastInputAt > IDLE_MS;
      lastInputAt = now();
      if (away) schedule();
    },
    /** Retour du réseau après un échec : relu tout de suite, si l'onglet est visible et le visiteur présent (sinon à son retour) */
    online() { if (last && !last.ok && last.reason !== 'absente' && d.visible() && now() - lastInputAt <= IDLE_MS) void load(); },
    /** Météo désactivée par le visiteur : plus aucune lecture */
    stop() { stopped = true; clearTimeout(timer); },
    /** Pour les tests et l'outil de debug */
    state: () => ({ last, failures }),
  };
}
