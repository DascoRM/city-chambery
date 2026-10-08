import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../App';
import type { AdminParkingEdits, CityParking } from '../types';

const CITY: { parkings: CityParking[] } = {
  parkings: [
    { id: 'way/1', name: 'Parking de l’Europe', kind: 'multi-storey', fee: true, capacity: 120, pos: [10, 20] },
    { id: 'way/2', kind: 'surface', est: 30, pos: [5, 6] },
    { id: 'way/3', kind: 'street', pos: [1, 1] }, // bout de rue sans nom : écarté de la recherche
  ],
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let edits: AdminParkingEdits;
let calls: { method: string; url: string; body?: unknown }[];

/** Fausse API : retient les appels et applique les écritures comme le vrai serveur */
const fakeServer = vi.fn(async (url: string, init?: RequestInit) => {
  const method = init?.method ?? 'GET';
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  calls.push({ method, url, body });
  if (url === '/data/city.json') return json(CITY);
  if (url === '/api/admin/parkings/edits' && method === 'GET') return json(edits);
  if (url.startsWith('/api/admin/parkings/overrides/') && method === 'PUT') {
    edits.overrides[url.slice('/api/admin/parkings/overrides/'.length)] = body;
    return json({ ok: true });
  }
  if (url === '/api/admin/parkings/added' && method === 'POST') {
    edits.added.push(body);
    return json({ ok: true }, 201);
  }
  if (url.startsWith('/api/admin/parkings/edits/') && method === 'DELETE') {
    const id = url.slice('/api/admin/parkings/edits/'.length);
    if (!edits.overrides[id] && !edits.added.some((a) => a.id === id)) return json({ error: 'introuvable' }, 404);
    delete edits.overrides[id];
    edits.added = edits.added.filter((a) => a.id !== id);
    return json({ ok: true });
  }
  return json({ error: 'introuvable' }, 404);
});

async function choose(query: string) {
  const search = await screen.findByLabelText('Chercher un parking (nom ou identifiant)');
  fireEvent.focus(search);
  fireEvent.change(search, { target: { value: query } });
  fireEvent.click(await screen.findByRole('button', { name: 'Choisir' }));
  return screen.getByRole('form', { name: 'Retouche du parking' });
}

beforeEach(() => {
  sessionStorage.setItem('diorama-admin-token', 'bon');
  window.location.hash = '#/parkings';
  edits = {
    overrides: { 'way/2': { capacity: 25, source: 'relevé sur place' } },
    added: [],
    updatedAt: null,
    log: [{ id: 1, at: '2026-10-08T20:00:00Z', action: 'override', target: 'way/2', source: 'relevé sur place' }],
  };
  calls = [];
  vi.stubGlobal('fetch', fakeServer);
  vi.stubGlobal('confirm', () => true);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  window.location.hash = '';
});

describe('administration : retouches des parkings (parité avec l’admin d’origine)', () => {
  it('liste les retouches publiées et le journal', async () => {
    render(<App />);
    expect(await screen.findByText('way/2 : 25 places')).toBeTruthy();
    expect(screen.getByText('source : relevé sur place', { selector: '.results small' })).toBeTruthy();
    expect(screen.getByText(/override · way\/2/)).toBeTruthy();
  });

  it('cherche un parking, le retouche avec une source, puis retire la retouche', async () => {
    render(<App />);
    const form = await choose('europe');
    expect(within(form).getByText(/en silo, payant, 120 places, position \[10, 20\]/)).toBeTruthy();

    fireEvent.change(within(form).getByLabelText('Places'), { target: { value: '149' } });
    fireEvent.change(within(form).getByLabelText('Source (obligatoire)'), { target: { value: ' BNLS 2024 ' } });
    fireEvent.submit(form);
    expect(await within(form).findByText('Retouche enregistrée et publiée.')).toBeTruthy();
    expect(calls).toContainEqual({ method: 'PUT', url: '/api/admin/parkings/overrides/way/1', body: { capacity: 149, source: 'BNLS 2024' } });
    expect(await screen.findByText('way/1 : 149 places')).toBeTruthy();

    fireEvent.click(within(form).getByRole('button', { name: 'Retirer la retouche' }));
    expect(await within(form).findByText('Retouche retirée.')).toBeTruthy();
    expect(calls).toContainEqual({ method: 'DELETE', url: '/api/admin/parkings/edits/way/1', body: undefined });
  });

  it('reprend la retouche existante et refuse une position incomplète ou une source vide', async () => {
    render(<App />);
    const form = await choose('way/2');
    expect((within(form).getByLabelText('Places') as HTMLInputElement).value).toBe('25');
    expect(within(form).getByText(/≈ 30 places \(estimé\).*Retouche actuelle : 25 places \(source : relevé sur place\)/)).toBeTruthy();

    fireEvent.change(within(form).getByLabelText('Position x (m)'), { target: { value: '3' } });
    fireEvent.submit(form);
    expect(await within(form).findByText('Position : il faut x et y.')).toBeTruthy();

    fireEvent.change(within(form).getByLabelText('Position x (m)'), { target: { value: '' } });
    fireEvent.change(within(form).getByLabelText('Source (obligatoire)'), { target: { value: '   ' } });
    fireEvent.submit(form);
    expect(await within(form).findByText('La source est obligatoire.')).toBeTruthy();
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('écarte les bouts de rue sans nom de la recherche', async () => {
    render(<App />);
    const search = await screen.findByLabelText('Chercher un parking (nom ou identifiant)');
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: 'way/3' } });
    expect(await screen.findByText('Aucun parking trouvé.')).toBeTruthy();
  });

  it('ajoute un parking absent d’OpenStreetMap, identifiant vérifié', async () => {
    render(<App />);
    const form = await screen.findByRole('form', { name: "Ajout d'un parking" });
    fireEvent.change(within(form).getByLabelText('Identifiant'), { target: { value: 'Parking Du' } });
    fireEvent.change(within(form).getByLabelText('Position x (m)'), { target: { value: '12.5' } });
    fireEvent.change(within(form).getByLabelText('Position y (m)'), { target: { value: '-4' } });
    fireEvent.change(within(form).getByLabelText('Source (obligatoire)'), { target: { value: 'vu sur place le 08/10' } });
    fireEvent.submit(form);
    expect(await within(form).findByText(/Identifiant : 2 à 60 caractères/)).toBeTruthy();

    fireEvent.change(within(form).getByLabelText('Identifiant'), { target: { value: 'parking-du-rosaire' } });
    fireEvent.submit(form);
    expect(await within(form).findByText('Parking ajouté et publié.')).toBeTruthy();
    expect(calls).toContainEqual({
      method: 'POST', url: '/api/admin/parkings/added',
      body: { id: 'custom/parking-du-rosaire', kind: 'surface', pos: [12.5, -4], source: 'vu sur place le 08/10' },
    });
    expect(await screen.findByText('custom/parking-du-rosaire : ajout : sans nom, de surface, [12.5, -4]')).toBeTruthy();
  });
});
