import { asc, desc, eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { publishedAdded, publishedOverride, type AddedInput, type OverrideInput, type PublishedEdits } from '../../contrat/parkings.js';
import * as schema from './db/schema.js';
import { editLog, parkingEdits } from './db/schema.js';

/**
 * Retouches des parkings (EP008-US006) : accès à la base. Les formats (validation des requêtes, réponses publiées) sont dans
 * le contrat partagé avec le front (`contrat/parkings.ts`, EP010-US007). Le format publié est celui de
 * `frontend/carte/content/parkings.json` (`overrides`, `added`), appliqué par la carte au chargement.
 * Toute retouche porte une **source** (texte libre : lien, document, « vu sur place le … »).
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export async function listEdits(db: Db): Promise<PublishedEdits> {
  const rows = await db.select().from(parkingEdits).orderBy(asc(parkingEdits.id));
  const out: PublishedEdits = { overrides: {}, added: [], updatedAt: null };
  for (const r of rows) {
    // Une ligne hors contrat (écrite à la main en SQL, schéma futur) est écartée et signalée : elle ne casse ni la carte ni
    // la page Parkings de l'administration, qui sert justement à corriger les retouches
    const data = { ...(r.data as Record<string, unknown>), source: r.source };
    const checked = r.type === 'override' ? publishedOverride.safeParse(data) : publishedAdded.safeParse({ ...data, id: r.id });
    if (!checked.success) {
      console.warn(`[parkings] retouche « ${r.id} » hors contrat, écartée`);
      continue;
    }
    if (r.type === 'override') out.overrides[r.id] = checked.data as PublishedEdits['overrides'][string];
    else out.added.push(checked.data as PublishedEdits['added'][number]);
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
