import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from './auth';

/** Pages de l'administration, dans l'ordre de la navigation */
const PAGES: { path: string; label: string }[] = [
  { path: '/', label: 'Tableau de bord' },
];

export function Layout({ children }: { children: ReactNode }) {
  const { signedIn, logout } = useAuth();
  const [location] = useLocation();
  return (
    <main>
      <h1>Administration</h1>
      <p className="sub">Chambéry en diorama · accès réservé</p>
      {signedIn && (
        <nav className="tabs" aria-label="Pages de l'administration">
          {PAGES.map((p) => (
            <Link key={p.path} href={p.path} className={location === p.path ? 'tab on' : 'tab'} aria-current={location === p.path ? 'page' : undefined}>
              {p.label}
            </Link>
          ))}
          <button type="button" className="ghost" onClick={() => logout()}>Se déconnecter</button>
        </nav>
      )}
      {children}
    </main>
  );
}
