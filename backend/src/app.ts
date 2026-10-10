import { Hono } from 'hono';
import { except } from 'hono/combine';
import { HTTPException } from 'hono/http-exception';
import { getTableName, isTable } from 'drizzle-orm';
import * as schema from './db/schema.js';
import { appEnv, appVersion, resolveDatabase, type Env } from './env.js';
import { database } from './db/client.js';
import { clientKey, createRateLimiter, tokenMatches } from './auth.js';
import { closeSession, openSession, requireSession, sameOriginWrites, sessionKey, type SessionVariables } from './session.js';
import { errorBody } from './errors.js';
import { dbStats } from './db/stats.js';
import * as z from 'zod/mini';
import { fr } from 'zod/locales';
import { addedInput, customId, osmId, overrideInput, type AdminParkingEdits } from '../../contrat/parkings.js';
import type { AdminStatusResponse, DbStatus, HealthResponse } from '../../contrat/sante.js';
import { loginRequest, type SessionInfo } from '../../contrat/session.js';
import { addParking, listEdits, recentLog, removeEdit, saveOverride, type Db } from './parkings.js';
import { createWeatherService, type WeatherDeps } from './meteo/service.js';
import { weatherAdminRoutes, weatherRoutes } from './meteo/routes.js';
import { overrideStore } from './meteo/override-store.js';

// Messages de validation en français : ils remontent jusqu'à l'administration (« source : Trop petit : … »)
z.config(fr());

/**
 * API du diorama (EP008). Hono, fonctions Vercel du même dépôt. Le site fonctionne sans elle : si elle est en panne
 * ou si la base est absente, le site reste utilisable (progression locale).
 */
/** Tables que le code attend (d'après le schéma) : sert à détecter des migrations non appliquées */
const EXPECTED_TABLES = Object.values(schema).filter((t) => isTable(t)).map((t) => getTableName(t as Parameters<typeof getTableName>[0])).sort();

/** Code d'erreur PostgreSQL, que l'erreur vienne du pilote ou soit enveloppée par Drizzle */
function pgCode(err: unknown): string | undefined {
  for (let e: unknown = err, i = 0; e && i < 4; e = (e as { cause?: unknown }).cause, i++) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
  }
  return undefined;
}

/** Vérifie la base avec une requête triviale, sans jamais faire échouer la réponse de santé */
export async function checkDatabase(env: Env): Promise<{ status: DbStatus; ms?: number }> {
  const target = resolveDatabase(env);
  if (target.url === null) return { status: target.reason };
  const t0 = performance.now();
  try {
    const conn = database(env);
    if (!conn.ok) return { status: conn.reason };
    await Promise.race([conn.sql`select 1`, new Promise((_, reject) => setTimeout(() => reject(new Error('délai dépassé')), 5000))]);
    return { status: 'ok', ms: Math.round(performance.now() - t0) };
  } catch {
    return { status: 'erreur' }; // le message d'erreur peut contenir l'adresse de la base : on ne le renvoie pas
  }
}

/** Dépendances remplaçables (tests : base PGlite au lieu de Neon) */
export interface AppDeps {
  /** Base à utiliser ; par défaut celle de l'environnement (null si aucune) */
  db?: () => Db | null;
  /** Horloge en millisecondes (tests : expiration de la session) ; par défaut l'heure réelle */
  now?: () => number;
  /** Météo (EP009) : accès à la source (tests et contrôle du build : source simulée, sans réseau) */
  weather?: Pick<WeatherDeps, 'fetch'>;
}

export function createApp(env: Env = process.env, deps: AppDeps = {}) {
  const app = new Hono().basePath('/api');
  const getDb = deps.db ?? (() => { const c = database(env); return c.ok ? (c.db as unknown as Db) : null; });
  /** Forçage de la météo (EP009-US012) : rangé dans la base quand elle existe ; sans base, jamais de forçage */
  const weatherStore = () => { const db = getDb(); return db ? overrideStore(db) : null; };
  const weather = createWeatherService({ fetch: deps.weather?.fetch, now: deps.now, overrides: weatherStore });

  app.use('*', async (c, next) => {
    await next();
    if (!c.res.headers.has('Cache-Control')) c.header('Cache-Control', 'no-store'); // une route peut choisir sa mise en cache
  });

  /** Réponse quand la base n'est pas disponible : le site continue avec ses retouches locales */
  const noDb = (c: { json: (b: unknown, s: 503) => Response }) => c.json(errorBody('base indisponible', 'base-indisponible'), 503);
  /** Données refusées par la validation (Zod) : le détail de chaque champ */
  const invalid = (c: { json: (b: unknown, s: 400) => Response }, issues: unknown) => c.json(errorBody('données invalides', 'donnees-invalides', issues), 400);

  // Retouches des parkings publiées (US006) : lues par le site au chargement ; mises en cache 60 s par Vercel
  app.get('/parkings/edits', async (c) => {
    const db = getDb();
    if (!db) return noDb(c);
    const edits = await listEdits(db);
    c.header('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
    return c.json(edits);
  });

  // Météo de Chambéry (EP009) : la source est appelée au plus une fois par pas de 15 min et par instance ; mise en cache par Vercel
  app.route('/weather', weatherRoutes(weather));

  app.get('/health', async (c) => {
    const db = await checkDatabase(env);
    // `admin` dit seulement si un jeton est configuré (jamais sa valeur) : aide à diagnostiquer une variable mal posée
    return c.json({ ok: true, service: 'chambery-diorama-api', version: appVersion(env), env: appEnv(env), db, admin: env.ADMIN_TOKEN?.trim() ? 'configure' : 'absent' } satisfies HealthResponse);
  });

  // Administration : fermée sans ADMIN_TOKEN. Le jeton ouvre une session (cookie HttpOnly, glissante : 2 h sans activité,
  // 8 h au plus), seule acceptée ensuite ; écritures de la même origine et en JSON seulement (EP010-US008, session.ts)
  const now = deps.now ?? Date.now;
  const limiter = createRateLimiter(); // 5 essais de jeton ratés par minute et par adresse, puis 429 (connexion seulement)
  const PUBLIC = new Set(['/api/admin/login', '/api/admin/logout']);
  const admin = new Hono<{ Variables: SessionVariables }>();
  admin.use('*', async (c, next) => (sessionKey(env) ? next() : c.json(errorBody('administration non configurée', 'admin-non-configuree'), 503)));
  admin.use('*', sameOriginWrites());
  admin.use('*', except((c) => PUBLIC.has(c.req.path), requireSession(env, now)));
  admin.post('/login', async (c) => {
    const ip = clientKey(c.req.raw.headers);
    if (limiter.blocked(ip)) return c.json(errorBody('trop de tentatives, réessaie dans une minute', 'trop-de-tentatives'), 429);
    const body = loginRequest.safeParse(await c.req.json().catch(() => null)); // jeton « trimé » : un retour à la ligne collé est ignoré
    if (!body.success) return invalid(c, body.error.issues);
    if (!tokenMatches(env.ADMIN_TOKEN!.trim(), body.data.token)) {
      limiter.fail(ip);
      return c.json(errorBody('non autorisé', 'non-autorise'), 401);
    }
    return c.json((await openSession(c, env, sessionKey(env)!, Math.floor(now() / 1000))) satisfies SessionInfo);
  });
  admin.post('/logout', (c) => {
    closeSession(c, env, Math.floor(now() / 1000)); // et le témoin : une réponse tardive ne rouvre pas la session
    return c.body(null, 204);
  });
  admin.get('/session', (c) => c.json(c.get('session') satisfies SessionInfo));
  admin.get('/ping', (c) => c.json({ ok: true }));
  admin.route('/weather', weatherAdminRoutes(weather, weatherStore)); // EP009-US012 : état, forçage pour les démos, coupure
  admin.get('/status', async (c) => {
    const base = { version: appVersion(env), env: appEnv(env), node: process.version, region: env.VERCEL_REGION ?? null };
    const target = resolveDatabase(env);
    if (target.url === null) return c.json({ ...base, db: { status: target.reason } } satisfies AdminStatusResponse);
    try {
      const conn = database(env);
      if (!conn.ok) return c.json({ ...base, db: { status: conn.reason } } satisfies AdminStatusResponse);
      const stats = await dbStats(async (text) => [...(await conn.sql.unsafe(text))] as Record<string, unknown>[], EXPECTED_TABLES);
      return c.json({ ...base, db: { status: 'ok' as const, ...stats } } satisfies AdminStatusResponse);
    } catch {
      return c.json({ ...base, db: { status: 'erreur' as const } } satisfies AdminStatusResponse);
    }
  });

  // Retouches des parkings (US006). Toute écriture est validée (Zod) et porte une source.
  admin.get('/parkings/edits', async (c) => {
    const db = getDb();
    if (!db) return noDb(c);
    const log = (await recentLog(db)).map((l) => ({ ...l, at: l.at.toISOString() })); // dates en texte ISO, comme dans le JSON
    return c.json({ ...(await listEdits(db)), log } satisfies AdminParkingEdits);
  });
  admin.put('/parkings/overrides/:id{.+}', async (c) => {
    const id = osmId.safeParse(c.req.param('id'));
    if (!id.success) return invalid(c, [{ path: ['id'], message: 'identifiant OpenStreetMap attendu (way/…, node/…, relation/…)' }]);
    const body = overrideInput.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return invalid(c, body.error.issues);
    const db = getDb();
    if (!db) return noDb(c);
    await saveOverride(db, id.data, body.data);
    return c.json({ ok: true });
  });
  admin.post('/parkings/added', async (c) => {
    const body = addedInput.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return invalid(c, body.error.issues);
    const db = getDb();
    if (!db) return noDb(c);
    if (!(await addParking(db, body.data))) return c.json(errorBody('identifiant déjà pris', 'deja-pris'), 409);
    return c.json({ ok: true }, 201);
  });
  admin.delete('/parkings/edits/:id{.+}', async (c) => {
    const raw = c.req.param('id');
    if (!osmId.safeParse(raw).success && !customId.safeParse(raw).success) return invalid(c, [{ path: ['id'], message: 'identifiant inconnu' }]);
    const db = getDb();
    if (!db) return noDb(c);
    if (!(await removeEdit(db, raw))) return c.json(errorBody('introuvable', 'introuvable'), 404);
    return c.json({ ok: true });
  });
  app.route('/admin', admin);

  app.notFound((c) => c.json(errorBody('introuvable', 'introuvable'), 404));
  app.onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse(); // erreur voulue (400, 401…) : pas un 500
    console.error('[api]', err);
    // Table absente (code PostgreSQL 42P01) : la base n'a pas reçu les dernières migrations
    if (pgCode(err) === '42P01') return c.json(errorBody('base non migrée : appliquer les migrations (npm run db:migrate)', 'migrations-manquantes'), 503);
    return c.json(errorBody('erreur interne', 'erreur-interne'), 500);
  });

  return app;
}
