import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';
import type { AdminStatusResponse } from '../../../contrat/sante.js';
import type { SessionInfo } from '../../../contrat/session.js';

const STATUS: AdminStatusResponse = {
  version: 'abc1234',
  env: 'preview',
  node: 'v22.0.0',
  region: 'cdg1',
  db: { status: 'ok', sizeBytes: 2048, tables: [{ name: 'parking_edits', rows: 3 }], missing: [] },
};
const SESSION: SessionInfo = { sub: 'admin', method: 'token', expiresAt: '2026-10-09T10:00:00.000Z', maxExpiresAt: '2026-10-09T16:00:00.000Z' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Fausse API : la session est un cookie côté serveur (ici, un drapeau) ; la page ne voit jamais le jeton après la connexion */
let signedIn = false;
let statusResponse: () => Response = () => json(STATUS);
let calls: { method: string; url: string; init?: RequestInit }[] = [];
const fakeApi = vi.fn(async (url: string, init?: RequestInit) => {
  const method = init?.method ?? 'GET';
  calls.push({ method, url, init });
  if (url === '/api/admin/login') {
    const { token } = JSON.parse(String(init?.body));
    if (token !== 'bon') return json({ error: 'non autorisé', code: 'non-autorise' }, 401);
    signedIn = true;
    return json(SESSION);
  }
  if (url === '/api/admin/logout') { signedIn = false; return new Response(null, { status: 204 }); }
  if (!signedIn) return json({ error: 'non autorisé', code: 'non-autorise' }, 401);
  if (url === '/api/admin/session') return json(SESSION);
  if (url === '/api/admin/status') return statusResponse();
  return json({ error: 'introuvable', code: 'introuvable' }, 404);
});

function submitToken(value: string) {
  const field = screen.getByLabelText("Jeton d'administration");
  fireEvent.change(field, { target: { value } });
  fireEvent.submit(field.closest('form')!);
}

beforeEach(() => {
  signedIn = false;
  statusResponse = () => json(STATUS);
  calls = [];
  vi.stubGlobal('fetch', fakeApi);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe('administration : session et tableau de bord', () => {
  it('sans session : l’écran de connexion, après vérification auprès de l’API', async () => {
    render(<App />);
    expect(screen.getByText('Vérification de la session…')).toBeTruthy();
    expect(await screen.findByLabelText("Jeton d'administration")).toBeTruthy();
    expect(calls[0]).toMatchObject({ method: 'GET', url: '/api/admin/session' });
  });

  it('refuse un mauvais jeton, puis ouvre la session avec le bon (espaces ignorés) ; plus jamais de jeton dans les requêtes', async () => {
    render(<App />);
    await screen.findByLabelText("Jeton d'administration");
    submitToken('mauvais');
    expect(await screen.findByText('Jeton refusé.')).toBeTruthy();

    submitToken('  bon\n');
    expect(await screen.findByText('abc1234')).toBeTruthy();
    expect(screen.getByText('Connectée')).toBeTruthy();
    expect(screen.getByText('parking_edits')).toBeTruthy();
    const login = calls.filter((c) => c.url === '/api/admin/login');
    expect(JSON.parse(String(login.at(-1)!.init!.body))).toEqual({ token: 'bon' });
    for (const c of calls) {
      expect(new Headers(c.init?.headers).has('Authorization')).toBe(false);
      expect(c.init?.credentials).toBe('same-origin');
      expect(c.init?.mode).toBeUndefined(); // en mode « cors » par défaut, l'Origin réelle part avec les écritures
    }
    expect(sessionStorage.length).toBe(0);
  });

  it('une session déjà ouverte (cookie) mène directement au tableau de bord', async () => {
    signedIn = true;
    render(<App />);
    expect(await screen.findByText('abc1234')).toBeTruthy();
  });

  it('session expirée en cours de route : retour à la connexion, avec le message', async () => {
    signedIn = true;
    statusResponse = () => json({ error: 'session expirée', code: 'session-expiree' }, 401);
    render(<App />);
    expect(await screen.findByText(/Session expirée \(2 h sans activité, ou 8 h depuis la connexion\)/)).toBeTruthy();
    expect(screen.getByLabelText("Jeton d'administration")).toBeTruthy();
  });

  it('session terminée en cours de route (cookie absent ou fermé) : retour à la connexion, avec le message', async () => {
    signedIn = true;
    statusResponse = () => json({ error: 'non autorisé', code: 'non-autorise' }, 401);
    render(<App />);
    expect(await screen.findByText('Session terminée : reconnecte-toi.')).toBeTruthy();
  });

  it('la déconnexion prévient l’API (le cookie est effacé) et revient à la connexion', async () => {
    signedIn = true;
    render(<App />);
    await screen.findByText('abc1234');
    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    expect(await screen.findByLabelText("Jeton d'administration")).toBeTruthy();
    expect(calls.some((c) => c.method === 'POST' && c.url === '/api/admin/logout')).toBe(true);
    expect(signedIn).toBe(false);
  });

  it('efface le jeton gardé par l’ancienne administration', async () => {
    sessionStorage.setItem('diorama-admin-token', 'ancien');
    render(<App />);
    await screen.findByLabelText("Jeton d'administration");
    expect(sessionStorage.getItem('diorama-admin-token')).toBeNull();
  });

  it('signale des migrations manquantes', async () => {
    signedIn = true;
    statusResponse = () => json({ ...STATUS, db: { ...STATUS.db, missing: ['edit_log'] } });
    render(<App />);
    expect(await screen.findByText(/tables absentes edit_log/)).toBeTruthy();
  });

  it('signale une réponse qui ne respecte pas le contrat, au lieu d’afficher un tableau de bord faux', async () => {
    signedIn = true;
    statusResponse = () => json({ version: 'abc1234' }); // champs manquants
    render(<App />);
    expect(await screen.findByText(/Réponse inattendue de l'API : son format ne correspond pas au contrat/)).toBeTruthy();
  });

  it('refuse une réponse qui n’est pas du JSON, comme une page de repli en 200 (revue F1)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<!doctype html><title>Carte</title>', { status: 200, headers: { 'Content-Type': 'text/html' } })));
    render(<App />);
    expect(await screen.findByText("L'API ne répond pas à cette adresse (la réponse n'est pas du JSON).")).toBeTruthy();
  });

  it('traduit une panne de réseau', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    render(<App />);
    expect(await screen.findByText("Impossible de joindre l'API (réseau coupé ou serveur arrêté).", {}, { timeout: 4000 })).toBeTruthy();
  });
});
