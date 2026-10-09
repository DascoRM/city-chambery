/// <reference types="node" />
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { resolveDatabase, type Env } from '../env.js';
import * as schema from './schema.js';

/**
 * Connexion à la base : paresseuse (créée au premier besoin), une seule connexion par instance de fonction,
 * fermée vite quand elle est inutilisée (une fonction serverless ne garde pas de connexions ouvertes longtemps).
 * Pilote PostgreSQL standard (postgres.js) : aucune dépendance au pilote d'un hébergeur.
 */
let cached: { url: string; sql: postgres.Sql } | null = null;

export function database(env: Env) {
  const target = resolveDatabase(env);
  if (target.url === null) return { ok: false as const, reason: target.reason };
  if (!cached || cached.url !== target.url) {
    cached = { url: target.url, sql: postgres(target.url, { max: 1, idle_timeout: 5, connect_timeout: 8, prepare: false }) };
  }
  return { ok: true as const, sql: cached.sql, db: drizzle(cached.sql, { schema }) };
}
