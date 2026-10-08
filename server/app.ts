/// <reference types="node" />
import { Hono } from 'hono';
import { appEnv, appVersion, resolveDatabase, type Env } from './env.js';
import { database } from './db/client.js';
import { adminAuth, createRateLimiter } from './auth.js';
import { dbStats } from './db/stats.js';

/**
 * API du diorama (EP008). Hono, fonctions Vercel du même dépôt. Le site fonctionne sans elle : si elle est en panne
 * ou si la base est absente, le site reste utilisable (progression locale).
 */
export type DbStatus = 'ok' | 'non-configuree' | 'desactivee-en-previsualisation' | 'erreur';

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

export function createApp(env: Env = process.env) {
  const app = new Hono().basePath('/api');

  app.use('*', async (c, next) => {
    await next();
    c.header('Cache-Control', 'no-store');
  });

  app.get('/health', async (c) => {
    const db = await checkDatabase(env);
    // `admin` dit seulement si un jeton est configuré (jamais sa valeur) : aide à diagnostiquer une variable mal posée
    return c.json({ ok: true, service: 'chambery-diorama-api', version: appVersion(env), env: appEnv(env), db, admin: env.ADMIN_TOKEN?.trim() ? 'configure' : 'absent' });
  });

  // Administration (US005) : fermée sans ADMIN_TOKEN, protégée par jeton sinon
  const admin = new Hono();
  admin.use('*', adminAuth(env, createRateLimiter()));
  admin.get('/ping', (c) => c.json({ ok: true }));
  admin.get('/status', async (c) => {
    const base = { version: appVersion(env), env: appEnv(env), node: process.version, region: env.VERCEL_REGION ?? null };
    const target = resolveDatabase(env);
    if (target.url === null) return c.json({ ...base, db: { status: target.reason } });
    try {
      const conn = database(env);
      if (!conn.ok) return c.json({ ...base, db: { status: conn.reason } });
      const stats = await dbStats(async (text) => [...(await conn.sql.unsafe(text))] as Record<string, unknown>[]);
      return c.json({ ...base, db: { status: 'ok', ...stats } });
    } catch {
      return c.json({ ...base, db: { status: 'erreur' } });
    }
  });
  app.route('/admin', admin);

  app.notFound((c) => c.json({ error: 'introuvable' }, 404));
  app.onError((err, c) => {
    console.error('[api]', err);
    return c.json({ error: 'erreur interne' }, 500);
  });

  return app;
}
