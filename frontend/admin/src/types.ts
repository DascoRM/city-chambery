/**
 * Formats des réponses de l'API lus par l'administration. Provisoire : ils passeront dans `contrat/` (EP010-US007),
 * partagés avec le back qui les produit (aujourd'hui `server/app.ts`, `server/db/stats.ts`, `server/parkings.ts`).
 */

export type DbState = 'ok' | 'non-configuree' | 'desactivee-en-previsualisation' | 'erreur';

/** GET /api/admin/status */
export interface AdminStatus {
  version: string;
  env: string;
  node: string;
  region: string | null;
  db: {
    status: DbState;
    sizeBytes?: number;
    tables?: { name: string; rows: number }[];
    /** Tables attendues par le code mais absentes de la base (migrations non appliquées) */
    missing?: string[];
  };
}

/** Corps d'une réponse en erreur de l'API */
export interface ApiErrorBody {
  error?: string;
  code?: string;
  issues?: { path?: (string | number)[]; message: string }[];
}
