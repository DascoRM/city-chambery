import * as z from 'zod/mini';
import { fr } from 'zod/locales';
import type { ApiErrorBody } from '../../../contrat/erreurs.js';

// Messages de validation du contrat (zod/mini) en français, comme ceux que renvoie le back
z.config(fr());

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
  if (status >= 500) return `Erreur ${status}${body?.error ? ` : ${body.error}` : ''}.`;
  const detail = Array.isArray(body?.issues) ? issuesText(body.issues) : '';
  return `${body?.error ?? `Erreur ${status}`}${detail ? ` (${detail})` : ''}`;
}

/** Noms français des champs de l'API, pour dire lequel est refusé */
const FIELD: Record<string, string> = {
  id: 'identifiant', hide: 'masquer', name: 'nom', fee: 'tarif', capacity: 'places', kind: 'type', pos: 'position', note: 'note', source: 'source',
};

/** « places : Trop grand … ; source : Trop petit … » à partir des champs refusés (par le back ou par le contrat ici) */
export function issuesText(issues: readonly { path?: readonly PropertyKey[]; message: string }[]): string {
  return issues.map((i) => {
    const path = (i.path ?? []).map(String);
    return `${path.length ? [FIELD[path[0]] ?? path[0], ...path.slice(1)].join('.') : 'formulaire'} : ${i.message}`;
  }).join(' ; ');
}

/** Statut d'une `ApiError` quand l'API n'a pas pu être jointe (réseau coupé, serveur arrêté) */
export const NETWORK_ERROR = 0;

/** Schéma du contrat qui vérifie une réponse (`safeParse` de zod/mini) */
export interface ResponseSchema<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false };
}

export interface ApiOptions<T> {
  body?: unknown;
  /** Jeton à essayer (connexion) ; par défaut, celui de la session */
  token?: string;
  notFound?: string;
  /** Schéma du contrat : une réponse qui ne le respecte pas devient une erreur claire au lieu d'un écran faux */
  schema?: ResponseSchema<T>;
}

export async function api<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, opts: ApiOptions<T> = {}): Promise<T> {
  const fromSession = opts.token === undefined;
  const token = opts.token ?? tokenStore.get();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(path, { method, cache: 'no-store', headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  } catch {
    throw new ApiError("Impossible de joindre l'API (réseau coupé ou serveur arrêté).", NETWORK_ERROR);
  }
  let data: unknown = null;
  try { data = await res.json(); } catch { /* pas de JSON : page de la plateforme, pas de l'API */ }
  if (!res.ok) {
    const body = data as ApiErrorBody | null;
    // Jeton de la session refusé (changé, expiré) : retour à la connexion. Un essai de connexion ne déclenche rien.
    if (res.status === 401 && fromSession) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new ApiError(errorMessage(res.status, body, opts.notFound), res.status, body?.code);
  }
  // Réponse « réussie » qui n'est pas du JSON : ce n'est pas l'API mais une page de repli (ex. nginx qui sert la carte)
  if (data === null && res.status !== 204) {
    throw new ApiError("L'API ne répond pas à cette adresse (la réponse n'est pas du JSON).", res.status);
  }
  if (opts.schema) {
    const checked = opts.schema.safeParse(data);
    if (!checked.success) throw new ApiError("Réponse inattendue de l'API : son format ne correspond pas au contrat (versions différentes ? recharge la page).", res.status);
    return checked.data;
  }
  return data as T;
}
