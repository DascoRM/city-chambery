import * as z from 'zod/mini';

/** Santé de l'API et état de la base (EP008-US001, US005) */

export const appEnv = z.enum(['production', 'preview', 'development']);
export type AppEnv = z.infer<typeof appEnv>;

export const dbStatus = z.enum(['ok', 'non-configuree', 'desactivee-en-previsualisation', 'erreur']);
export type DbStatus = z.infer<typeof dbStatus>;

/** GET /api/health (publique) : `admin` dit seulement si un jeton est configuré, jamais sa valeur */
export const healthResponse = z.object({
  ok: z.literal(true),
  service: z.string(),
  version: z.string(),
  env: appEnv,
  db: z.object({ status: dbStatus, ms: z.optional(z.number()) }),
  admin: z.enum(['configure', 'absent']),
});
export type HealthResponse = z.infer<typeof healthResponse>;

/** Statistiques de la base : taille, lignes par table, tables attendues mais absentes (migrations à appliquer) */
export const dbStats = z.object({
  sizeBytes: z.number(),
  tables: z.array(z.object({ name: z.string(), rows: z.number() })),
  missing: z.array(z.string()),
});
export type DbStats = z.infer<typeof dbStats>;

/** GET /api/admin/status : les statistiques seulement quand la base répond */
export const adminStatusResponse = z.object({
  version: z.string(),
  env: appEnv,
  node: z.string(),
  region: z.nullable(z.string()),
  db: z.union([
    z.extend(dbStats, { status: z.literal('ok') }),
    z.object({ status: z.enum(['non-configuree', 'desactivee-en-previsualisation', 'erreur']) }),
  ]),
});
export type AdminStatusResponse = z.infer<typeof adminStatusResponse>;
