/// <reference types="node" />
import { createHash, timingSafeEqual } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import type { Env } from './env.js';

/**
 * Accès à l'administration (EP008-US005) : un jeton secret (`ADMIN_TOKEN`, variable Vercel, jamais dans le dépôt) envoyé dans
 * l'en-tête `Authorization: Bearer …`. Sans jeton configuré, l'administration est **fermée** (rien ne répond). Comparaison en
 * temps constant. Limite de tentatives par adresse : en mémoire, donc **par instance de fonction** (au mieux : un vrai
 * limiteur partagé viendra avec US008) ; il freine surtout les essais en rafale.
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

const clientKey = (headers: Headers) => headers.get('x-forwarded-for')?.split(',')[0].trim() || headers.get('x-real-ip') || 'inconnu';

export function adminAuth(env: Env, limiter: RateLimiter = createRateLimiter()): MiddlewareHandler {
  return async (c, next) => {
    const expected = env.ADMIN_TOKEN;
    if (!expected) return c.json({ error: 'introuvable' }, 404); // administration non configurée : fermée
    const key = clientKey(c.req.raw.headers);
    if (limiter.blocked(key)) return c.json({ error: 'trop de tentatives, réessaie dans une minute' }, 429);
    const header = c.req.header('authorization') ?? '';
    const given = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!given || !tokenMatches(expected, given)) {
      limiter.fail(key);
      return c.json({ error: 'non autorisé' }, 401);
    }
    await next();
  };
}
