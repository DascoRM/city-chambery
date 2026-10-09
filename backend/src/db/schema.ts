import { jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Schéma de la base (EP008). SQL standard uniquement : rien de propre à un hébergeur (ADR-001).
 * Les tables des joueurs, scores et retouches arrivent avec leurs user stories (US002, US003, US006).
 */

/** Petites informations de l'application (version du schéma, date de la dernière sauvegarde…) */
export const appMeta = pgTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Retouches des parkings faites depuis l'administration (EP008-US006). Une ligne par parking retouché (`override`, clé =
 * identifiant OSM) ou ajouté (`added`, clé = `custom/…`). `data` : les champs de la retouche, validés par Zod
 * (backend/src/parkings.ts) avant écriture. `source` : obligatoire (règle du projet : rien d'inventé).
 */
export const parkingEdits = pgTable('parking_edits', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  data: jsonb('data').notNull(),
  source: text('source').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Journal des modifications de l'administration : qui (plus tard), quoi, quand, avec quelle source */
export const editLog = pgTable('edit_log', {
  id: serial('id').primaryKey(),
  target: text('target').notNull(),
  action: text('action').notNull(),
  data: jsonb('data'),
  source: text('source'),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});
