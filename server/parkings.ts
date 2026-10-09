import { z } from 'zod';
import { asc, desc, eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './db/schema.js';
import { editLog, parkingEdits } from './db/schema.js';

/**
 * Retouches des parkings (EP008-US006) : validation (Zod) et accès à la base. Le format est celui de
 * `frontend/carte/content/parkings.json` (`overrides`, `added`), appliqué par le site au chargement (`frontend/carte/src/scene/parking-edits.ts`).
 * Toute retouche porte une **source** (texte libre : lien, document, « vu sur place le … »).
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const label = (max: number) => z.string().trim().min(1).max(max);
const point = z.tuple([z.number().min(-5000).max(5000), z.number().min(-5000).max(5000)]);
const kind = z.enum(['underground', 'multi-storey', 'surface', 'street']);
const capacity = z.number().int().positive().max(10000);

/** Identifiant OpenStreetMap d'un parking (`way/123`, `node/456`, `relation/789`) */
export const osmId = z.string().regex(/^(way|node|relation)\/\d{1,15}$/);
/** Identifiant d'un parking ajouté à la main */
export const customId = z.string().regex(/^custom\/[a-z0-9-]{2,60}$/);

export const overrideInput = z.strictObject({
  hide: z.boolean().optional(),
  name: label(80).optional(),
  fee: z.boolean().optional(),
  capacity: capacity.optional(),
  kind: kind.optional(),
  pos: point.optional(),
  note: label(300).optional(),
  source: label(300),
}).refine((o) => Object.keys(o).some((k) => k !== 'source'), { message: 'aucune retouche (il faut au moins un champ en plus de la source)' });

export const addedInput = z.strictObject({
  id: customId,
  kind,
  pos: point,
  name: label(80).optional(),
  fee: z.boolean().optional(),
  capacity: capacity.optional(),
  note: label(300).optional(),
  source: label(300),
});

export type OverrideInput = z.infer<typeof overrideInput>;
export type AddedInput = z.infer<typeof addedInput>;

/** Ce que lit le site : même forme que `parkings.json`, plus la source de chaque retouche */
export interface PublishedEdits {
  overrides: Record<string, Omit<OverrideInput, 'source'> & { source: string }>;
  added: AddedInput[];
  updatedAt: string | null;
}

export async function listEdits(db: Db): Promise<PublishedEdits> {
  const rows = await db.select().from(parkingEdits).orderBy(asc(parkingEdits.id));
  const out: PublishedEdits = { overrides: {}, added: [], updatedAt: null };
  for (const r of rows) {
    const data = { ...(r.data as Record<string, unknown>), source: r.source };
    if (r.type === 'override') out.overrides[r.id] = data as PublishedEdits['overrides'][string];
    else out.added.push({ ...(data as AddedInput), id: r.id });
    const at = r.updatedAt.toISOString();
    if (!out.updatedAt || at > out.updatedAt) out.updatedAt = at;
  }
  return out;
}

const log = (db: Db, target: string, action: string, data: unknown, source: string | null) =>
  db.insert(editLog).values({ target, action, data: data as object, source });

export async function saveOverride(db: Db, id: string, input: OverrideInput) {
  const { source, ...data } = input;
  await db.insert(parkingEdits).values({ id, type: 'override', data, source })
    .onConflictDoUpdate({ target: parkingEdits.id, set: { data, source, type: 'override', updatedAt: new Date() } });
  await log(db, id, 'override', data, source);
}

/** Ajoute un parking ; faux si l'identifiant est déjà pris */
export async function addParking(db: Db, input: AddedInput): Promise<boolean> {
  const { id, source, ...data } = input;
  const done = await db.insert(parkingEdits).values({ id, type: 'added', data, source }).onConflictDoNothing().returning({ id: parkingEdits.id });
  if (!done.length) return false;
  await log(db, id, 'added', data, source);
  return true;
}

/** Retire une retouche ou un ajout ; faux s'il n'existait pas */
export async function removeEdit(db: Db, id: string): Promise<boolean> {
  const done = await db.delete(parkingEdits).where(eq(parkingEdits.id, id)).returning({ id: parkingEdits.id });
  if (!done.length) return false;
  await log(db, id, 'remove', null, null);
  return true;
}

export async function recentLog(db: Db, limit = 30) {
  return db.select().from(editLog).orderBy(desc(editLog.at), desc(editLog.id)).limit(limit);
}
