import type { ErrorCode } from '../../contrat/erreurs.js';

/** Corps d'une réponse d'erreur, au format du contrat (`contrat/erreurs.ts`) : le code est vérifié à la compilation */
export const errorBody = (error: string, code: ErrorCode, issues?: unknown) => (issues ? { error, code, issues } : { error, code });
