import { Hono, type Context } from 'hono';
import { weatherOverrideInput, type AdminWeatherResponse, type WeatherOverride, type WeatherResponse } from '../../../contrat/meteo.js';
import { errorBody } from '../errors.js';
import type { SessionVariables } from '../session.js';
import { CDN_MAX_AGE_S, type OverrideStore, type WeatherService } from './service.js';

/**
 * En-tête de cache d'une réponse 200 : `cdnS` secondes de vie dans le CDN de Vercel, moitié `s-maxage`, moitié
 * `stale-while-revalidate` ; d'ordinaire 120 s (60 + 60 : un changement est vu par tous en 2 min au plus), moins pour une
 * météo forcée qui finit avant (le CDN ne la sert jamais après sa fin), 0 tant que le forçage n'a pas pu être lu. Le
 * navigateur ne reçoit que `public, max-age=0` (Vercel retire les deux autres). Pas de `stale-if-error` : le CDN servirait
 * l'ancienne météo à la place d'un 503 voulu (météo coupée depuis l'administration).
 */
export function publicCache(cdnS: number): string {
  if (cdnS < 2) return 'no-store';
  return `public, max-age=0, s-maxage=${Math.ceil(cdnS / 2)}, stale-while-revalidate=${Math.floor(cdnS / 2)}`;
}
export const PUBLIC_CACHE = publicCache(2 * CDN_MAX_AGE_S);

/** GET /api/weather : publique ; les paramètres de la requête sont ignorés (coordonnées fixes, aucune donnée du visiteur) */
export function weatherRoutes(service: WeatherService) {
  const r = new Hono();
  r.get('/', async (c) => {
    const result = await service.current();
    // Pas d'en-tête de cache sur une erreur : le middleware global pose `no-store`
    if (!result.ok) {
      return c.json(errorBody(result.code === 'meteo-desactivee' ? 'météo coupée par l’administration' : 'météo indisponible', result.code), 503);
    }
    c.header('Cache-Control', publicCache(result.cdnS));
    return c.json(result.body satisfies WeatherResponse);
  });
  return r;
}

/** Table absente (code PostgreSQL 42P01, même s'il est enveloppé par Drizzle) : laissée à `onError` (« migrations-manquantes ») */
function missingTable(err: unknown): boolean {
  for (let e: unknown = err, i = 0; e && i < 4; e = (e as { cause?: unknown }).cause, i++) {
    if ((e as { code?: unknown }).code === '42P01') return true;
  }
  return false;
}

/** Base absente ou injoignable : 503 « base-indisponible », comme les autres écritures de l'administration */
function dbDown(c: Context, err?: unknown) {
  if (err !== undefined) {
    if (missingTable(err)) throw err;
    console.error('[meteo] écriture du forçage impossible :', err);
  }
  return c.json(errorBody('base indisponible', 'base-indisponible'), 503);
}

/**
 * /api/admin/weather (EP009-US012), montées sous le routeur admin : session exigée, écritures de la même origine en JSON.
 * GET : ce que voient les visiteurs, le relevé brut, le forçage, l'état de cette instance ; PUT /override : forcer ou couper
 * la météo pour une durée limitée ; DELETE /override : revenir à la météo réelle.
 */
export function weatherAdminRoutes(service: WeatherService, store: () => OverrideStore | null) {
  const r = new Hono<{ Variables: SessionVariables }>();
  r.get('/', async (c) => c.json((await service.adminView()) satisfies AdminWeatherResponse));
  r.put('/override', async (c) => {
    const body = weatherOverrideInput.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json(errorBody('données invalides', 'donnees-invalides', body.error.issues), 400);
    const s = store();
    if (!s) return dbDown(c);
    try {
      return c.json((await service.setOverride(body.data, c.get('session').sub, s)) satisfies WeatherOverride);
    } catch (err) {
      return dbDown(c, err);
    }
  });
  r.delete('/override', async (c) => {
    const s = store();
    if (!s) return dbDown(c);
    let removed: boolean;
    try {
      removed = await service.clearOverride(c.get('session').sub, s);
    } catch (err) {
      return dbDown(c, err);
    }
    if (!removed) return c.json(errorBody('aucun forçage en cours', 'introuvable'), 404);
    return c.body(null, 204);
  });
  return r;
}
