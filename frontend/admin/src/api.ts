import type { ApiErrorBody } from './types';

/**
 * Accès à l'API depuis l'administration : un seul point d'entrée, qui ajoute le jeton et traduit les erreurs en français.
 * Le front ne parle au back que par HTTP (ADR-002). Le jeton est gardé le temps de l'onglet (sessionStorage), comme dans
 * l'admin d'origine ; il sera remplacé par un cookie de session en phase 2 (EP010-US008).
 */
const KEY = 'diorama-admin-token';

export const tokenStore = {
  get(): string | null {
    try { return sessionStorage.getItem(KEY); } catch { return null; }
  },
  set(value: string | null) {
    try { if (value) sessionStorage.setItem(KEY, value); else sessionStorage.removeItem(KEY); }
    catch { /* stockage indisponible : la session ne survit pas au rechargement */ }
  },
};

/** Émis quand l'API refuse le jeton gardé : l'administration revient à l'écran de connexion */
export const UNAUTHORIZED_EVENT = 'admin-unauthorized';

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

/**
 * Message pour une réponse en erreur. `body` est null quand la réponse n'est pas du JSON (page de la plateforme, pas de
 * l'API). `notFound` remplace le message d'un 404 renvoyé par l'API (ex. une retouche déjà retirée).
 */
export function errorMessage(status: number, body: ApiErrorBody | null, notFound?: string): string {
  if (status === 401) return 'Jeton refusé.';
  if (status === 429) return 'Trop de tentatives : réessaie dans une minute.';
  if (body?.code === 'admin-non-configuree') return "L'administration n'est pas configurée : ADMIN_TOKEN n'est pas vu par ce déploiement (variable absente pour cet environnement, ou ajoutée après le déploiement : redéployer).";
  if (body?.code === 'migrations-manquantes') return 'La base n’a pas reçu les dernières migrations : lancer « npm run db:migrate » sur cette base.';
  if (body?.code === 'base-indisponible') return 'Base indisponible.';
  if (status === 404) {
    if (!body) return "L'API ne répond pas à cette adresse (404 de la plateforme, pas de l'API).";
    return notFound ?? "Route de l'API introuvable (404).";
  }
  const detail = Array.isArray(body?.issues) ? body.issues.map((i) => `${(i.path ?? []).join('.') || 'formulaire'} : ${i.message}`).join(' ; ') : '';
  return `${body?.error ?? `Erreur ${status}`}${detail ? ` (${detail})` : ''}`;
}

export interface ApiOptions {
  body?: unknown;
  /** Jeton à essayer (connexion) ; par défaut, celui de la session */
  token?: string;
  notFound?: string;
}

export async function api<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, opts: ApiOptions = {}): Promise<T> {
  const fromSession = opts.token === undefined;
  const token = opts.token ?? tokenStore.get();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, { method, cache: 'no-store', headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  let data: unknown = null;
  try { data = await res.json(); } catch { /* pas de JSON : page de la plateforme, pas de l'API */ }
  if (!res.ok) {
    const body = data as ApiErrorBody | null;
    // Jeton de la session refusé (changé, expiré) : retour à la connexion. Un essai de connexion ne déclenche rien.
    if (res.status === 401 && fromSession) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new ApiError(errorMessage(res.status, body, opts.notFound), res.status, body?.code);
  }
  return data as T;
}
