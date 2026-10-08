import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

/**
 * Applique les migrations : `DATABASE_URL=… npm run db:migrate`. Jamais automatique au déploiement : on choisit la base visée
 * (le nom d'hôte est affiché avant d'agir, jamais le mot de passe). Rejouable : les migrations déjà passées sont ignorées.
 */
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL manquante : DATABASE_URL=postgres://… npm run db:migrate');
  process.exit(1);
}
console.log(`Migrations sur la base « ${new URL(url).host} »…`);
const sql = postgres(url, { max: 1, prepare: false });
await migrate(drizzle(sql), { migrationsFolder: new URL('./migrations', import.meta.url).pathname });
await sql.end();
console.log('✓ Migrations appliquées');
