import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { sign, verify } from 'hono/jwt';
import type { SessionInfo } from '../../contrat/session.js';
import { appEnv, type Env } from './env.js';

/**
 * Session d'administration (EP010-US008). Le jeton `ADMIN_TOKEN` ne sert qu'à l'ouvrir (D8) : le navigateur garde ensuite un
 * jeton signé (HMAC-SHA256, sans état côté serveur) dans un cookie `HttpOnly` que la page ne peut pas lire.
 * - Glissante (D9) : chaque requête de l'administration la prolonge de 2 h, sans dépasser 8 h depuis la connexion.
 * - Clé tirée d'`ADMIN_TOKEN` (D10, pas de nouvelle variable) : changer le jeton ferme toutes les sessions.
 *   `ADMIN_SESSION_SECRET`, si elle existe un jour, la remplace.
 * - Sans état : rien en base (l'administration reste utilisable quand la base dort ou tombe) ; en contrepartie, la
 *   déconnexion efface le cookie du navigateur mais ne révoque pas une copie volée (au plus 2 h sans activité, 8 h en tout).
 */
export const SESSION_COOKIE = 'diorama_admin';
export const SESSION_IDLE_S = 2 * 3600;
export const SESSION_MAX_S = 8 * 3600;
const COOKIE_PATH = '/api/admin';

interface Claims {
  sub: string;
  method: 'token';
  /** Heure de connexion (secondes) : point de départ de la limite de 8 h */
  auth: number;
}

/** Clé de signature, ou null si l'administration n'est pas configurée */
export function sessionKey(env: Env): string | null {
  const token = env.ADMIN_TOKEN?.trim();
  if (!token) return null;
  return env.ADMIN_SESSION_SECRET?.trim() || `diorama-admin-session-v1|${token}`;
}

/** `Secure` partout, sauf en développement sur http (Safari refuse un cookie `Secure` sur http://localhost) */
const secure = (c: Context, env: Env) => appEnv(env) !== 'development' || new URL(c.req.url).protocol === 'https:';

const iso = (s: number) => new Date(s * 1000).toISOString();

/** Pose ou renouvelle le cookie : 2 h de plus, sans dépasser 8 h depuis la connexion */
export async function writeSession(c: Context, env: Env, key: string, claims: Claims, nowS: number): Promise<SessionInfo> {
  const max = claims.auth + SESSION_MAX_S;
  const exp = Math.min(nowS + SESSION_IDLE_S, max);
  const jwt = await sign({ ...claims, iat: nowS, exp }, key, 'HS256');
  setCookie(c, SESSION_COOKIE, jwt, { httpOnly: true, secure: secure(c, env), sameSite: 'Strict', path: COOKIE_PATH, maxAge: exp - nowS });
  return { sub: claims.sub, method: claims.method, expiresAt: iso(exp), maxExpiresAt: iso(max) };
}

export function closeSession(c: Context, env: Env): void {
  deleteCookie(c, SESSION_COOKIE, { httpOnly: true, secure: secure(c, env), sameSite: 'Strict', path: COOKIE_PATH });
}

/** La session du cookie, ou pourquoi il n'y en a pas */
async function readSession(c: Context, key: string, nowS: number): Promise<Claims | 'absente' | 'expiree'> {
  const raw = getCookie(c, SESSION_COOKIE);
  if (!raw) return 'absente';
  let p: Record<string, unknown>;
  try {
    // Dates contrôlées ici avec l'horloge du serveur (remplaçable dans les tests), pas par la bibliothèque
    p = await verify(raw, key, { alg: 'HS256', exp: false, iat: false, nbf: false });
  } catch {
    return 'absente'; // signature fausse, autre clé (jeton changé depuis), jeton illisible
  }
  if (typeof p.sub !== 'string' || p.method !== 'token' || typeof p.auth !== 'number' || typeof p.exp !== 'number') return 'absente';
  if (nowS >= p.exp || nowS >= p.auth + SESSION_MAX_S) return 'expiree';
  return { sub: p.sub, method: 'token', auth: p.auth };
}

export type SessionVariables = { session: SessionInfo };

/** Exige une session valide, et la prolonge (glissante) ; `now` en millisecondes */
export function requireSession(env: Env, now: () => number): MiddlewareHandler<{ Variables: SessionVariables }> {
  return async (c, next) => {
    const key = sessionKey(env);
    if (!key) return c.json({ error: 'administration non configurée', code: 'admin-non-configuree' }, 503);
    const nowS = Math.floor(now() / 1000);
    const s = await readSession(c, key, nowS);
    if (s === 'expiree') {
      closeSession(c, env);
      return c.json({ error: 'session expirée', code: 'session-expiree' }, 401);
    }
    if (s === 'absente') return c.json({ error: 'non autorisé', code: 'non-autorise' }, 401);
    c.set('session', await writeSession(c, env, key, s, nowS));
    await next();
  };
}

const WRITES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Écritures venues d'une autre origine refusées (en plus de `SameSite=Strict`) : l'`Origin` doit être l'adresse de l'API,
 * ou le navigateur doit dire `Sec-Fetch-Site: same-origin`. Corps en JSON seulement (un formulaire d'un autre site a toujours
 * un type « formulaire »). Le middleware `csrf()` de Hono ne suffit pas : il ne regarde que les types « formulaire ».
 */
export function sameOriginWrites(): MiddlewareHandler {
  return async (c, next) => {
    if (WRITES.has(c.req.method)) {
      const host = c.req.header('host') ?? new URL(c.req.url).host;
      const origin = c.req.header('origin');
      let same = c.req.header('sec-fetch-site') === 'same-origin';
      if (!same && origin && origin !== 'null') {
        try { same = new URL(origin).host === host; } catch { same = false; }
      }
      if (!same) return c.json({ error: "requête refusée : elle ne vient pas de l'administration", code: 'origine-refusee' }, 403);
      const type = c.req.header('content-type');
      if (type && !/^application\/json\b/i.test(type)) return c.json({ error: 'corps en JSON attendu', code: 'type-de-contenu' }, 415);
    }
    await next();
  };
}
