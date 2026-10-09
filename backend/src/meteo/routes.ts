import { Hono } from 'hono';
import type { WeatherResponse } from '../../../contrat/meteo.js';
import { errorBody } from '../errors.js';
import { CDN_MAX_AGE_S, type WeatherService } from './service.js';

/**
 * Mise en cache par le CDN de Vercel 60 s, puis servie encore 5 min pendant qu'il la revalide ; le navigateur ne reçoit que
 * `public, max-age=0` (Vercel retire les deux autres). Pas de `stale-if-error` : le CDN servirait l'ancienne météo à la
 * place d'un 503 voulu (météo coupée depuis l'administration, US012).
 */
export const PUBLIC_CACHE = `public, max-age=0, s-maxage=${CDN_MAX_AGE_S}, stale-while-revalidate=300`;

/** GET /api/weather : publique ; les paramètres de la requête sont ignorés (coordonnées fixes, aucune donnée du visiteur) */
export function weatherRoutes(service: WeatherService) {
  const r = new Hono();
  r.get('/', async (c) => {
    const result = await service.current();
    // Pas d'en-tête de cache sur une erreur : le middleware global pose `no-store`
    if (!result.ok) return c.json(errorBody('météo indisponible', result.code), 503);
    c.header('Cache-Control', PUBLIC_CACHE);
    return c.json(result.body satisfies WeatherResponse);
  });
  return r;
}
