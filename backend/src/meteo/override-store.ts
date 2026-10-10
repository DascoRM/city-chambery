import { eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { weatherOverride, type WeatherOverride } from '../../../contrat/meteo.js';
import * as schema from '../db/schema.js';
import { appMeta, editLog } from '../db/schema.js';
import type { OverrideStore } from './service.js';

/**
 * Forçage de la météo (EP009-US012) rangé dans la table existante `app_meta` (D8) : clé `meteo.forcage`, valeur JSON. Aucune
 * migration, donc aucun conflit avec celles d'EP008. Vérifié par le contrat à l'écriture (route) et à la lecture (ici) : une
 * valeur écrite à la main hors contrat est ignorée (météo réelle) et signalée dans les journaux.
 */
export const OVERRIDE_KEY = 'meteo.forcage';
/** Règle 13 de l'epic : un forçage dure de 5 min à 6 h ; une valeur en base qui dépasse 6 h est hors contrat */
const MAX_OVERRIDE_MS = 360 * 60_000;

/** Même type que `Db` de parkings.ts, sans en dépendre (EP008-US014 réécrit parkings.ts) */
type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export type WeatherLogAction = 'meteo-forcee' | 'meteo-coupee' | 'meteo-reelle';

/**
 * Journal des forçages. AUJOURD'HUI `edit_log` (cible `meteo`, exclue du journal des parkings) ; après EP008-US013, ce seul
 * appel passe à `audit_log` (`table_name 'app_meta'`, `row_id 'meteo.forcage'`, action `update` ou `delete`, auteur).
 */
export const journal = (db: Db, action: WeatherLogAction, data: unknown) =>
  db.insert(editLog).values({ target: 'meteo', action, data: data as object, source: null });

/** Le forçage d'une ligne d'`app_meta`, s'il respecte le contrat et la durée maximale ; null sinon */
export function parseOverride(value: string | undefined): WeatherOverride | null {
  if (value === undefined) return null;
  let raw: unknown;
  try { raw = JSON.parse(value); } catch { return null; }
  const o = weatherOverride.safeParse(raw);
  if (!o.success) return null;
  const span = Date.parse(o.data.until) - Date.parse(o.data.since);
  if (!(span > 0 && span <= MAX_OVERRIDE_MS)) return null;
  if (o.data.mode === 'forcee' && !o.data.condition) return null;
  return o.data;
}

export function overrideStore(db: Db): OverrideStore {
  return {
    async read() {
      const [row] = await db.select({ value: appMeta.value }).from(appMeta).where(eq(appMeta.key, OVERRIDE_KEY)).limit(1);
      if (!row) return null;
      const o = parseOverride(row.value);
      if (!o) console.warn('[meteo] forçage hors contrat dans app_meta (écrit à la main ?) : ignoré, météo réelle');
      return o;
    },
    async save(o) {
      const value = JSON.stringify(o);
      await db.insert(appMeta).values({ key: OVERRIDE_KEY, value })
        .onConflictDoUpdate({ target: appMeta.key, set: { value, updatedAt: new Date() } });
      await journal(db, o.mode === 'forcee' ? 'meteo-forcee' : 'meteo-coupee', o);
    },
    async clear(by, nowMs) {
      const [row] = await db.delete(appMeta).where(eq(appMeta.key, OVERRIDE_KEY)).returning({ value: appMeta.value });
      const o = parseOverride(row?.value);
      // Une ligne échue (ou illisible) est retirée sans bruit : pour les visiteurs, rien ne change
      if (!o || Date.parse(o.until) <= nowMs) return false;
      await journal(db, 'meteo-reelle', { by, until: o.until });
      return true;
    },
  };
}
