import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, tokenStore, UNAUTHORIZED_EVENT } from './api';
import type { AdminStatus } from './types';

/** Clé de cache de l'état de l'application et de la base (GET /api/admin/status) */
export const STATUS_KEY = ['admin', 'status'] as const;

interface Auth {
  /** Vrai si un jeton est gardé pour cet onglet */
  signedIn: boolean;
  /** Message à afficher sur l'écran de connexion (ex. jeton refusé en cours de route) */
  notice: string;
  /** Essaie le jeton ; en cas de succès il est gardé et le tableau de bord s'affiche, sinon l'erreur est levée */
  login(token: string): Promise<void>;
  logout(notice?: string): void;
}

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [signedIn, setSignedIn] = useState(() => tokenStore.get() !== null);
  const [notice, setNotice] = useState('');

  const logout = useCallback((why = '') => {
    tokenStore.set(null);
    queryClient.clear();
    setNotice(why);
    setSignedIn(false);
  }, [queryClient]);

  const login = useCallback(async (token: string) => {
    const status = await api<AdminStatus>('GET', '/api/admin/status', { token });
    tokenStore.set(token);
    queryClient.setQueryData(STATUS_KEY, status);
    setNotice('');
    setSignedIn(true);
  }, [queryClient]);

  useEffect(() => {
    const refused = () => logout('Jeton refusé : reconnecte-toi.');
    window.addEventListener(UNAUTHORIZED_EVENT, refused);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, refused);
  }, [logout]);

  const value = useMemo(() => ({ signedIn, notice, login, logout }), [signedIn, notice, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth hors de AuthProvider');
  return auth;
}
