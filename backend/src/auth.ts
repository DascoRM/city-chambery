import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Accès à l'administration (EP008-US005, EP010-US008) : le jeton secret `ADMIN_TOKEN` (variable Vercel, jamais dans le dépôt)
 * n'est envoyé qu'à `POST /api/admin/login`, qui ouvre une session (cookie, `session.ts`). Sans jeton configuré,
 * l'administration est **fermée**. Comparaison en temps constant. Limite de tentatives par adresse : en mémoire, donc
 * **par instance de fonction** (un limiteur partagé en base viendra avec EP008-US008) ; elle freine surtout les rafales.
 */
const sha = (s: string) => createHash('sha256').update(s).digest();

/** Vrai si `given` est exactement le jeton attendu ; comparaison en temps constant (empreintes de même taille) */
export function tokenMatches(expected: string, given: string): boolean {
  return timingSafeEqual(sha(expected), sha(given));
}

export interface RateLimiter {
  /** Compte un échec pour cette clé ; renvoie vrai si la clé est (ou devient) bloquée */
  fail(key: string, now?: number): boolean;
  blocked(key: string, now?: number): boolean;
}

export function createRateLimiter(max = 5, windowMs = 60_000): RateLimiter {
  const fails = new Map<string, number[]>();
  const recent = (key: string, now: number) => {
    const list = (fails.get(key) ?? []).filter((t) => now - t < windowMs);
    fails.set(key, list);
    return list;
  };
  return {
    fail(key, now = Date.now()) {
      const list = recent(key, now);
      list.push(now);
      return list.length >= max;
    },
    blocked: (key, now = Date.now()) => recent(key, now).length >= max,
  };
}

/** Adresse du client (Vercel réécrit `x-forwarded-for` : il n'est pas falsifiable là-bas) */
export const clientKey = (headers: Headers) => headers.get('x-forwarded-for')?.split(',')[0].trim() || headers.get('x-real-ip') || 'inconnu';
