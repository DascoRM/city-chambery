import { Hono } from 'hono';
import { appEnv, appVersion, resolveDatabase, type Env } from './env';
import { database } from './db/client';

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
    return c.json({ ok: true, service: 'chambery-diorama-api', version: appVersion(env), env: appEnv(env), db });
  });

  app.notFound((c) => c.json({ error: 'introuvable' }, 404));
  app.onError((err, c) => {
    console.error('[api]', err);
    return c.json({ error: 'erreur interne' }, 500);
  });

  return app;
}
