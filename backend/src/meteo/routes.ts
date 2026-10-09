import { Hono } from 'hono';
import type { WeatherResponse } from '../../../contrat/meteo.js';
import { errorBody } from '../errors.js';
import { CDN_MAX_AGE_S, type WeatherService } from './service.js';

/**
 * Mise en cache par le CDN de Vercel 60 s, puis servie encore au plus 60 s pendant qu'il la renouvelle : un changement
 * (nouveau pas de la source, forçage de l'administration en US012) est vu par tous en 2 min au plus. Le navigateur ne reçoit
 * que `public, max-age=0` (Vercel retire les deux autres). Pas de `stale-if-error` : le CDN servirait l'ancienne météo à la
 * place d'un 503 voulu (météo coupée depuis l'administration).
 */
export const PUBLIC_CACHE = `public, max-age=0, s-maxage=${CDN_MAX_AGE_S}, stale-while-revalidate=${CDN_MAX_AGE_S}`;

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
