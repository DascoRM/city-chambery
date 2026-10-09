import * as z from 'zod/mini';

/**
 * Erreurs de l'API (EP010-US007). Le contrat est écrit avec `zod/mini` (≈ 7 Ko dans un navigateur au lieu de 26) : la carte,
 * l'administration et le back lisent les mêmes schémas. Les messages en français viennent de la locale configurée par le back
 * et l'administration (`z.config(fr())`).
 */

/** Codes d'erreur : stables, l'administration et la carte réagissent au code, pas au message */
export const errorCode = z.enum([
  'donnees-invalides', 'non-autorise', 'session-expiree', 'origine-refusee', 'type-de-contenu',
  'introuvable', 'deja-pris', 'trop-de-tentatives',
  'base-indisponible', 'migrations-manquantes', 'admin-non-configuree', 'erreur-interne',
]);
export type ErrorCode = z.infer<typeof errorCode>;

/** Champ refusé par la validation (format des « issues » de Zod) */
export const issue = z.object({ path: z.array(z.union([z.string(), z.number()])), message: z.string() });

/** Toute réponse d'erreur de l'API */
export const apiError = z.object({ error: z.string(), code: z.optional(errorCode), issues: z.optional(z.array(issue)) });
export type ApiErrorBody = z.infer<typeof apiError>;
