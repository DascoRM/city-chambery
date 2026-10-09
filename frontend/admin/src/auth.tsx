import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { sessionInfo, type SessionInfo } from '../../../contrat/session.js';
import { api, ApiError, SESSION_EXPIRED, UNAUTHORIZED_EVENT, type UnauthorizedDetail } from './api';

/** Clé de cache de la session (GET /api/admin/session) : null = pas connecté */
export const SESSION_KEY = ['admin', 'session'] as const;
/** Clé de cache de l'état de l'application et de la base (GET /api/admin/status) */
export const STATUS_KEY = ['admin', 'status'] as const;

interface Auth {
  /** Vrai si une session est ouverte (cookie HttpOnly, invisible pour la page : on demande à l'API) */
  signedIn: boolean;
  /** Vérification de la session en cours (au démarrage) */
  checking: boolean;
  /** Message à afficher sur l'écran de connexion (session expirée, administration non configurée…) */
  notice: string;
  /** Ouvre une session avec le jeton ; lève l'erreur si le jeton est refusé */
  login(token: string): Promise<void>;
  logout(notice?: string): Promise<void>;
}

const AuthContext = createContext<Auth | null>(null);

/** La session en cours, ou null (401 : pas connecté) */
async function currentSession(): Promise<SessionInfo | null> {
  try {
    return await api('GET', '/api/admin/session', { schema: sessionInfo, expect401: true });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: SESSION_KEY, queryFn: currentSession, staleTime: Infinity });
  const [notice, setNotice] = useState('');

  /** Revient à l'écran de connexion et oublie tout ce qui a été lu (état, retouches…) */
  const forget = useCallback((why: string) => {
    // Pas de `clear()` : la requête de session doit rester dans le cache pour que ses abonnés voient la fin de session
    queryClient.setQueryData(SESSION_KEY, null);
    queryClient.removeQueries({ predicate: (q) => q.queryKey[1] !== SESSION_KEY[1] });
    setNotice(why);
  }, [queryClient]);

  const logout = useCallback(async (why = '') => {
    try { await api('POST', '/api/admin/logout', { expect401: true }); } catch { /* le cookie expirera de lui-même */ }
    forget(why);
  }, [forget]);

  const login = useCallback(async (token: string) => {
    const info = await api('POST', '/api/admin/login', { body: { token }, schema: sessionInfo, expect401: true });
    setNotice('');
    queryClient.setQueryData(SESSION_KEY, info);
  }, [queryClient]);

  useEffect(() => {
    // L'API a refusé la session en cours de route (expirée, jeton changé) : son cookie est déjà effacé
    const refused = (e: Event) => forget((e as CustomEvent<UnauthorizedDetail>).detail?.code === 'session-expiree' ? SESSION_EXPIRED : 'Session terminée : reconnecte-toi.');
    window.addEventListener(UNAUTHORIZED_EVENT, refused);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, refused);
  }, [forget]);

  useEffect(() => {
    // Ancienne administration (avant EP010-US008) : le jeton était gardé dans l'onglet ; on l'efface
    try { sessionStorage.removeItem('diorama-admin-token'); } catch { /* stockage indisponible */ }
  }, []);

  const value = useMemo<Auth>(() => ({
    signedIn: !!session.data,
    checking: session.isPending,
    notice: notice || (session.error ? session.error.message : ''),
    login,
    logout,
  }), [session.data, session.isPending, session.error, notice, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth hors de AuthProvider');
  return auth;
}
