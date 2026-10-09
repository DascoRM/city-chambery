import * as z from 'zod/mini';

/**
 * Session d'administration (EP010-US008). Le jeton d'administration ne sert qu'à l'ouvrir (D8) ; ensuite un cookie HttpOnly,
 * que le navigateur garde sans que la page puisse le lire. Plus tard : un identifiant et un mot de passe (D6), même session.
 */

/** POST /api/admin/login */
export const loginRequest = z.strictObject({ token: z.string().check(z.trim(), z.minLength(1), z.maxLength(500)) });
export type LoginRequest = z.infer<typeof loginRequest>;

/** Réponse de POST /api/admin/login et de GET /api/admin/session : jamais le jeton */
export const sessionInfo = z.object({
  sub: z.string(),
  method: z.enum(['token']),
  /** Fin de la session si rien ne se passe (2 h après la dernière action) */
  expiresAt: z.string(),
  /** Limite absolue : 8 h après la connexion, même en continuant à travailler */
  maxExpiresAt: z.string(),
});
export type SessionInfo = z.infer<typeof sessionInfo>;
