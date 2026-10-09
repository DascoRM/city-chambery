import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';
import type { AdminStatus } from './types';

const STATUS: AdminStatus = {
  version: 'abc1234',
  env: 'preview',
  node: 'v22.0.0',
  region: 'cdg1',
  db: { status: 'ok', sizeBytes: 2048, tables: [{ name: 'parking_edits', rows: 3 }], missing: [] },
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function submitToken(value: string) {
  const field = screen.getByLabelText("Jeton d'administration");
  fireEvent.change(field, { target: { value } });
  fireEvent.submit(field.closest('form')!);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe('administration : connexion et tableau de bord', () => {
  it('refuse un mauvais jeton, puis affiche l’état avec le bon (espaces ignorés)', async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
      new Headers(init?.headers).get('Authorization') === 'Bearer bon' ? json(STATUS) : json({ error: 'non autorisé' }, 401));
    vi.stubGlobal('fetch', fetch);
    render(<App />);

    submitToken('mauvais');
    expect(await screen.findByText('Jeton refusé.')).toBeTruthy();
    expect(sessionStorage.getItem('diorama-admin-token')).toBeNull();

    submitToken('  bon\n');
    expect(await screen.findByText('abc1234')).toBeTruthy();
    expect(screen.getByText('Connectée')).toBeTruthy();
    expect(screen.getByText('à jour')).toBeTruthy();
    expect(screen.getByText('parking_edits')).toBeTruthy();
    expect(sessionStorage.getItem('diorama-admin-token')).toBe('bon');
    expect(fetch).toHaveBeenCalledWith('/api/admin/status', expect.objectContaining({ method: 'GET', cache: 'no-store' }));
  });

  it('revient à la connexion quand le jeton gardé est refusé', async () => {
    sessionStorage.setItem('diorama-admin-token', 'ancien');
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'non autorisé' }, 401)));
    render(<App />);
    expect(await screen.findByText('Jeton refusé : reconnecte-toi.')).toBeTruthy();
    expect(sessionStorage.getItem('diorama-admin-token')).toBeNull();
  });

  it('signale des migrations manquantes', async () => {
    sessionStorage.setItem('diorama-admin-token', 'bon');
    vi.stubGlobal('fetch', vi.fn(async () => json({ ...STATUS, db: { ...STATUS.db, missing: ['edit_log'] } })));
    render(<App />);
    expect(await screen.findByText(/tables absentes edit_log/)).toBeTruthy();
  });

  it('refuse une réponse qui n’est pas du JSON, comme une page de repli en 200 (revue F1)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<!doctype html><title>Carte</title>', { status: 200, headers: { 'Content-Type': 'text/html' } })));
    render(<App />);
    submitToken('nimporte-quoi');
    expect(await screen.findByText("L'API ne répond pas à cette adresse (la réponse n'est pas du JSON).")).toBeTruthy();
    expect(sessionStorage.getItem('diorama-admin-token')).toBeNull();
  });

  it('traduit une panne de réseau', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    render(<App />);
    submitToken('bon');
    expect(await screen.findByText("Impossible de joindre l'API (réseau coupé ou serveur arrêté).")).toBeTruthy();
  });
});
