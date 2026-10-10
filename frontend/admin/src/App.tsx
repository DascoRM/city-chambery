import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, Route, Router, Switch } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { ApiError, NETWORK_ERROR } from './api';
import { AuthProvider, useAuth } from './auth';
import { Layout } from './Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Parkings } from './pages/Parkings';
import { Meteo } from './pages/Meteo';

/**
 * Administration (EP010). Routage par « # » (`/admin/#/parkings`) : aucune réécriture d'adresse à régler côté serveur
 * (Vercel, nginx), zone qui a déjà cassé plusieurs fois ; une adresse profonde se partage quand même.
 */
export function App() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Une seule nouvelle tentative, et seulement si le serveur ou le réseau a flanché (la base Neon se réveille) :
        // une erreur 4xx (jeton refusé, route absente) ne se corrige pas en réessayant
        retry: (count, error) => count < 1 && (!(error instanceof ApiError) || error.status === NETWORK_ERROR || error.status >= 500),
        refetchOnWindowFocus: false,
      },
    },
  }));
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router hook={useHashLocation}>
          <Shell />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function Shell() {
  const { signedIn, checking } = useAuth();
  return (
    <Layout>
      {checking ? (
        <p className="card">Vérification de la session…</p>
      ) : signedIn ? (
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/parkings" component={Parkings} />
          <Route path="/meteo" component={Meteo} />
          <Route>
            <p className="card">Page introuvable. <Link href="/">Retour au tableau de bord</Link></p>
          </Route>
        </Switch>
      ) : (
        <Login />
      )}
    </Layout>
  );
}
