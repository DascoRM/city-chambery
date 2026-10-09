import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import type { Db } from './parkings.js';

/**
 * Serveur de développement : `npm run api:dev` (le site, lancé par `npm run dev`, lui renvoie /api par un proxy).
 * Sans `DATABASE_URL`, il utilise une **base PostgreSQL locale** (PGlite, dans `backend/data/dev-db/`, ignorée par Git) avec les
 * migrations du dépôt : on développe et on teste sans Neon ni réseau. Avec `DATABASE_URL`, il utilise cette base.
 */
const port = Number(process.env.API_PORT ?? 8787);
let db: Db | undefined;
if (!process.env.DATABASE_URL) {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  const schema = await import('./db/schema.js');
  const { fileURLToPath } = await import('node:url');
  const { mkdirSync } = await import('node:fs');
  const dir = process.env.DEV_DB_DIR ?? fileURLToPath(new URL('../data/dev-db', import.meta.url));
  mkdirSync(dir, { recursive: true }); // PGlite ne crée pas les dossiers parents (data/ n'existe plus d'office)
  const d = drizzle(new PGlite(dir), { schema });
  await migrate(d, { migrationsFolder: fileURLToPath(new URL('./db/migrations', import.meta.url)) });
  db = d as unknown as Db;
  console.log(`Base locale PGlite : ${dir} (migrations appliquées)`);
}
serve({ fetch: createApp(process.env, db ? { db: () => db! } : {}).fetch, port });
console.log(`API : http://localhost:${port}/api/health`);
