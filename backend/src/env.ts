/**
 * Environnement de l'API (EP008) : où est la base, et dans quel contexte on tourne.
 * Règle de sécurité : une prévisualisation Vercel n'écrit JAMAIS dans la base de production. Elle n'utilise que
 * `DATABASE_URL_PREVIEW` (une autre base, ou une branche de base) ; sans elle, la base est désactivée.
 * Neon doit rester remplaçable (ADR-001) : on ne lit qu'une adresse PostgreSQL ordinaire, jamais un réglage propre à un hébergeur.
 */
export type AppEnv = 'production' | 'preview' | 'development';

export type Env = Record<string, string | undefined>;

export function appEnv(env: Env): AppEnv {
  const v = env.VERCEL_ENV;
  return v === 'production' || v === 'preview' ? v : 'development';
}

export type DatabaseTarget = { url: string } | { url: null; reason: 'non-configuree' | 'desactivee-en-previsualisation' };

export function resolveDatabase(env: Env): DatabaseTarget {
  const e = appEnv(env);
  if (e === 'preview') {
    return env.DATABASE_URL_PREVIEW ? { url: env.DATABASE_URL_PREVIEW } : { url: null, reason: 'desactivee-en-previsualisation' };
  }
  return env.DATABASE_URL ? { url: env.DATABASE_URL } : { url: null, reason: 'non-configuree' };
}

/** Version courte affichable (jamais de secret) */
export function appVersion(env: Env): string {
  return env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev';
}
