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
  /** Nombre d'adresses suivies (contrôle de la mémoire) */
  size(): number;
}

export function createRateLimiter(max = 5, windowMs = 60_000): RateLimiter {
  const fails = new Map<string, number[]>();
  /** Échecs encore dans la fenêtre ; une adresse sans échec récent est oubliée (la table ne grossit pas sans fin) */
  const recent = (key: string, now: number) => {
    const list = (fails.get(key) ?? []).filter((t) => now - t < windowMs);
    if (list.length) fails.set(key, list);
    else fails.delete(key);
    return list;
  };
  return {
    fail(key, now = Date.now()) {
      const list = recent(key, now);
      list.push(now);
      fails.set(key, list);
      return list.length >= max;
    },
    blocked: (key, now = Date.now()) => recent(key, now).length >= max,
    size: () => fails.size,
  };
}

/**
 * Clé d'une adresse pour la limite d'essais : l'adresse IPv4 ; pour une adresse IPv6, son préfixe /64 (un client dispose
 * de milliers d'adresses dans son /64 et pourrait sinon changer d'adresse à chaque essai).
 */
export function ipKey(ip: string): string {
  const v4 = ip.match(/(\d{1,3}(?:\.\d{1,3}){3})$/); // IPv4, ou IPv4 dans une adresse IPv6 (::ffff:1.2.3.4)
  if (v4) return v4[1];
  if (!ip.includes(':')) return ip;
  const [head, tail] = ip.toLowerCase().split('::');
  const a = head ? head.split(':') : [];
  const b = tail ? tail.split(':') : [];
  const groups = tail === undefined ? a : [...a, ...Array<string>(Math.max(0, 8 - a.length - b.length)).fill('0'), ...b];
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '') || '0').join(':')}::/64`;
}

/** Adresse du client (Vercel réécrit `x-forwarded-for` : il n'est pas falsifiable là-bas) */
export const clientKey = (headers: Headers) => ipKey(headers.get('x-forwarded-for')?.split(',')[0].trim() || headers.get('x-real-ip') || 'inconnu');
