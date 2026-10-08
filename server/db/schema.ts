import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

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
