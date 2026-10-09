import { createHash } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { sign, verify } from 'hono/jwt';
import type { SessionInfo } from '../../contrat/session.js';
import { appEnv, type Env } from './env.js';
import { errorBody } from './errors.js';

/**
 * Session d'administration (EP010-US008). Le jeton `ADMIN_TOKEN` ne sert qu'à l'ouvrir (D8) : le navigateur garde ensuite un
 * jeton signé (HMAC-SHA256, sans état côté serveur) dans un cookie `HttpOnly` que la page ne peut pas lire.
 * - Glissante (D9) : chaque requête de l'administration la prolonge de 2 h, sans dépasser 8 h depuis la connexion. Le cookie,
 *   lui, est gardé jusqu'aux 8 h : l'API reçoit donc une session expirée et peut le dire (« Session expirée »).
 * - Clé tirée d'`ADMIN_TOKEN` et de l'environnement (D10, pas de nouvelle variable) : changer le jeton ferme toutes les
 *   sessions, et une session de prévisualisation ne vaut pas en production. `ADMIN_TOKEN` doit être aléatoire et long
 *   (`openssl rand -base64 32`) : un cookie volé permettrait sinon d'essayer des jetons hors ligne.
 * - Sans état : rien en base (l'administration reste utilisable quand la base dort ou tombe). La déconnexion pose un témoin
 *   (cookie `diorama_admin_sortie`) qui fait refuser toute session ouverte avant elle : une réponse partie avant la
 *   déconnexion, qui revient avec une session prolongée, ne la rouvre pas. Une copie volée du cookie reste valable au plus
 *   2 h sans activité, 8 h en tout.
 */
export const SESSION_COOKIE = 'diorama_admin';
export const LOGOUT_COOKIE = 'diorama_admin_sortie';
export const SESSION_IDLE_S = 2 * 3600;
export const SESSION_MAX_S = 8 * 3600;
const COOKIE_PATH = '/api/admin';

interface Claims {
  sub: string;
  method: 'token';
  /** Heure de connexion (secondes) : départ de la limite de 8 h, comparée au témoin de déconnexion */
  auth: number;
}

/**
 * Clé de signature, ou null si l'administration n'est pas configurée. Une empreinte en hexadécimal : `hono/jwt` lirait
 * une clé texte contenant « PUBLIC » ou « PRIVATE » comme une clé PEM (et la session ne marcherait jamais).
 */
export function sessionKey(env: Env): string | null {
  const token = env.ADMIN_TOKEN?.trim();
  if (!token) return null;
  return createHash('sha256').update(`diorama-admin-session-v2|${appEnv(env)}|${token}`).digest('hex');
}

/** `Secure` partout, sauf en développement sur http (Safari refuse un cookie `Secure` sur http://localhost) */
const secure = (c: Context, env: Env) => appEnv(env) !== 'development' || new URL(c.req.url).protocol === 'https:';
const cookieOptions = (c: Context, env: Env) => ({ httpOnly: true, secure: secure(c, env), sameSite: 'Strict' as const, path: COOKIE_PATH });

const iso = (s: number) => new Date(s * 1000).toISOString();

/** Pose ou renouvelle la session : 2 h de plus, sans dépasser 8 h depuis la connexion */
export async function writeSession(c: Context, env: Env, key: string, claims: Claims, nowS: number): Promise<SessionInfo> {
  const max = claims.auth + SESSION_MAX_S;
  const exp = Math.min(nowS + SESSION_IDLE_S, max);
  const jwt = await sign({ ...claims, iat: nowS, exp }, key, 'HS256');
  setCookie(c, SESSION_COOKIE, jwt, { ...cookieOptions(c, env), maxAge: max - nowS });
  return { sub: claims.sub, method: claims.method, expiresAt: iso(exp), maxExpiresAt: iso(max) };
}

/** Ouvre une session après la connexion : le témoin d'une déconnexion précédente n'a plus lieu d'être */
export async function openSession(c: Context, env: Env, key: string, nowS: number): Promise<SessionInfo> {
  if (getCookie(c, LOGOUT_COOKIE) !== undefined) deleteCookie(c, LOGOUT_COOKIE, cookieOptions(c, env));
  return writeSession(c, env, key, { sub: 'admin', method: 'token', auth: nowS }, nowS);
}

/** Efface la session ; à la déconnexion (`nowS`), pose aussi le témoin qui refuse les sessions ouvertes avant */
export function closeSession(c: Context, env: Env, nowS?: number): void {
  deleteCookie(c, SESSION_COOKIE, cookieOptions(c, env));
  if (nowS !== undefined) setCookie(c, LOGOUT_COOKIE, String(nowS), { ...cookieOptions(c, env), maxAge: SESSION_MAX_S });
}

/** La session du cookie, ou pourquoi il n'y en a pas */
async function readSession(c: Context, key: string, nowS: number): Promise<Claims | 'absente' | 'fermee' | 'expiree'> {
  const raw = getCookie(c, SESSION_COOKIE);
  if (!raw) return 'absente';
  let p: Record<string, unknown>;
  try {
    // Dates contrôlées ici avec l'horloge du serveur (remplaçable dans les tests), pas par la bibliothèque
    p = await verify(raw, key, { alg: 'HS256', exp: false, iat: false, nbf: false });
  } catch {
    return 'absente'; // signature fausse, autre clé (jeton ou environnement changés), jeton illisible
  }
  if (typeof p.sub !== 'string' || p.method !== 'token' || typeof p.auth !== 'number' || typeof p.exp !== 'number') return 'absente';
  const loggedOut = Number(getCookie(c, LOGOUT_COOKIE));
  if (Number.isFinite(loggedOut) && p.auth <= loggedOut) return 'fermee'; // ouverte avant une déconnexion
  if (nowS >= p.exp || nowS >= p.auth + SESSION_MAX_S) return 'expiree';
  return { sub: p.sub, method: 'token', auth: p.auth };
}

export type SessionVariables = { session: SessionInfo };

/** Exige une session valide, et la prolonge (glissante) ; `now` en millisecondes */
export function requireSession(env: Env, now: () => number): MiddlewareHandler<{ Variables: SessionVariables }> {
  return async (c, next) => {
    const key = sessionKey(env);
    if (!key) return c.json(errorBody('administration non configurée', 'admin-non-configuree'), 503);
    const nowS = Math.floor(now() / 1000);
    const s = await readSession(c, key, nowS);
    if (s === 'expiree' || s === 'fermee') closeSession(c, env);
    if (s === 'expiree') return c.json(errorBody('session expirée', 'session-expiree'), 401);
    if (s === 'absente' || s === 'fermee') return c.json(errorBody('non autorisé', 'non-autorise'), 401);
    c.set('session', await writeSession(c, env, key, s, nowS));
    await next();
  };
}

const WRITES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Écritures venues d'une autre origine refusées (en plus de `SameSite=Strict`) : l'`Origin` doit être l'adresse de l'API,
 * ou le navigateur doit dire `Sec-Fetch-Site: same-origin`. Corps en JSON seulement (un formulaire d'un autre site a toujours
 * un type « formulaire »). Le middleware `csrf()` de Hono ne suffit pas : il ne regarde que les types « formulaire ».
 * Seul l'hôte de l'`Origin` est comparé, pas son schéma (http / https) : `Secure`, `SameSite=Strict` et le HSTS de Vercel
 * couvrent ce cas.
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
      if (!same) return c.json(errorBody("requête refusée : elle ne vient pas de l'administration", 'origine-refusee'), 403);
      const type = c.req.header('content-type');
      if (type && !/^application\/json\b/i.test(type)) return c.json(errorBody('corps en JSON attendu', 'type-de-contenu'), 415);
    }
    await next();
  };
}
