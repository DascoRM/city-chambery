import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../App';
import { badgeOf, previewHref } from './Meteo';
import type { AdminWeatherResponse, WeatherOverride, WeatherResponse } from '../../../../contrat/meteo.js';

const NOW = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const LIVE: WeatherResponse = {
  v: 1, source: 'open-meteo', model: 'icon_seamless', observedAt: iso(NOW - 6 * 60_000), fetchedAt: iso(NOW - 5 * 60_000),
  stale: false, forced: false, condition: 'partly', temperatureC: 12.8, cloudCover: 0.71, precipMmH: 0, rainIntensity: 0,
  snowIntensity: 0, windKmh: 14.1, windGustKmh: 29.9, windFromDeg: 257, visibilityM: 33040, fog: 0, thunder: false,
  attribution: { text: 'Météo : Open-Meteo.com', url: 'https://open-meteo.com/', licence: 'CC BY 4.0', licenceUrl: 'https://creativecommons.org/licenses/by/4.0/' },
};
const base = (): AdminWeatherResponse => ({
  public: LIVE, publicCode: null,
  upstream: {
    model: 'icon_seamless', fetchedAt: iso(NOW - 5 * 60_000), observedAt: LIVE.observedAt, grid: { lat: 45.56, lon: 5.92, elevationM: 286 },
    raw: { time: Math.floor((NOW - 6 * 60_000) / 1000), interval: 900, temperature_2m: 12.8, cloud_cover: 71, visibility: 33040, lightning_potential: null },
  },
  override: null,
  instance: { startedAt: iso(NOW - 3600_000), upstreamCalls: 3, upstreamFailures: 1, lastError: 'http-429 : Too many requests', lastErrorAt: iso(NOW - 600_000) },
  config: { lat: 45.5658, lon: 5.9205, model: 'icon_seamless', freshS: 900, cdnMaxAgeS: 60 },
});

let state: AdminWeatherResponse;
let calls: { method: string; url: string; body?: unknown }[];

/** Fausse API : la session est ouverte ; le forçage change ce que « voient les visiteurs », comme le vrai serveur */
const fakeServer = vi.fn(async (url: string, init?: RequestInit) => {
  const method = init?.method ?? 'GET';
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  calls.push({ method, url, body });
  if (url === '/api/admin/session') return json({ sub: 'admin', method: 'token', expiresAt: iso(NOW + 3600_000), maxExpiresAt: iso(NOW + 8 * 3600_000) });
  if (url === '/api/admin/weather') return json(state);
  if (url === '/api/admin/weather/override' && method === 'PUT') {
    const o: WeatherOverride = { ...body, since: iso(NOW), until: iso(NOW + body.minutes * 60_000), by: 'admin' };
    delete (o as { minutes?: number }).minutes;
    state = o.mode === 'coupee'
      ? { ...state, override: o, public: null, publicCode: 'meteo-desactivee' }
      : { ...state, override: o, public: { ...LIVE, source: 'admin', model: null, forced: true, forcedUntil: o.until, condition: o.condition!, temperatureC: null, attribution: null } };
    return json(o);
  }
  if (url === '/api/admin/weather/override' && method === 'DELETE') {
    if (!state.override) return json({ error: 'aucun forçage en cours', code: 'introuvable' }, 404);
    state = { ...state, override: null, public: LIVE, publicCode: null };
    return new Response(null, { status: 204 });
  }
  return json({ error: 'introuvable', code: 'introuvable' }, 404);
});

beforeEach(() => {
  window.location.hash = '#/meteo';
  state = base();
  calls = [];
  vi.stubGlobal('fetch', fakeServer);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.location.hash = '';
});

const form = () => screen.getByRole('form', { name: 'Forçage de la météo' });

describe('administration : écran « Météo »', () => {
  it('montre ce que voient les visiteurs, le relevé brut avec ses unités et l’instance, avec la mise en garde sur les compteurs', async () => {
    render(<App />);
    expect(await screen.findByText('Direct')).toBeTruthy();
    expect(screen.getByText('Éclaircies, 13 °C')).toBeTruthy();
    expect(screen.getByText(/modèle icon_seamless, valable pour .* \(il y a 6 min\)/)).toBeTruthy();
    expect(screen.getByText('71 %')).toBeTruthy();
    expect(screen.getByText('33 040 m')).toBeTruthy(); // nombres à la française (l'espace fine est ramenée à une espace par Testing Library)
    expect(screen.getByText('Compteurs depuis le démarrage de cette instance, ce ne sont pas des totaux.')).toBeTruthy();
    expect(screen.getByText(/http-429 : Too many requests/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Météo' })).toBeTruthy(); // onglet de la navigation
  });

  it('force la neige pour tous : corps validé par le contrat, pastille « Forcée », lien d’aperçu, puis retour au réel', async () => {
    render(<App />);
    await screen.findByText('Direct');
    fireEvent.change(within(form()).getByLabelText('Condition'), { target: { value: 'snow' } });
    fireEvent.change(within(form()).getByLabelText('Intensité (0 à 1)'), { target: { value: '0.9' } });
    fireEvent.change(within(form()).getByLabelText('Durée'), { target: { value: '30' } });
    fireEvent.change(within(form()).getByLabelText('Motif (facultatif)'), { target: { value: ' démo avec les amis ' } });
    expect(within(form()).getByRole('link', { name: 'Aperçu sur la carte' }).getAttribute('href')).toBe('/?weather=snow&intensity=0.9');
    fireEvent.submit(form());
    expect(await within(form()).findByText(/Météo forcée \(Neige\) jusqu’à/)).toBeTruthy();
    expect(calls).toContainEqual({ method: 'PUT', url: '/api/admin/weather/override', body: { mode: 'forcee', condition: 'snow', intensity: 0.9, minutes: 30, note: 'démo avec les amis' } });
    expect(await screen.findByText('Forcée')).toBeTruthy();
    expect(await screen.findByText(/Météo forcée : Neige \(intensité 0,9\), jusqu’à .*, par admin. Motif : démo avec les amis./)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Revenir à la météo réelle' }));
    expect(await screen.findByText('Retour à la météo réelle.')).toBeTruthy();
    expect(calls.some((c) => c.method === 'DELETE' && c.url === '/api/admin/weather/override')).toBe(true);
    expect(await screen.findByText('Direct')).toBeTruthy();
  });

  it('refuse un forçage sans condition (message du contrat, rien n’est envoyé) ; couper la météo pour tous', async () => {
    render(<App />);
    await screen.findByText('Direct');
    fireEvent.submit(form());
    expect(await within(form()).findByText('condition : condition obligatoire pour une météo forcée')).toBeTruthy();
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);

    fireEvent.click(within(form()).getByLabelText('Couper la météo'));
    expect(within(form()).queryByLabelText('Condition')).toBeNull();
    expect(within(form()).queryByRole('link', { name: 'Aperçu sur la carte' })).toBeNull();
    fireEvent.submit(form());
    expect(await within(form()).findByText(/Météo coupée jusqu’à/)).toBeTruthy();
    expect(calls).toContainEqual({ method: 'PUT', url: '/api/admin/weather/override', body: { mode: 'coupee', minutes: 60 } });
    expect(await screen.findByText('Coupée')).toBeTruthy();
    expect(screen.getByText('Météo coupée depuis l’administration : la carte garde son ciel par défaut.')).toBeTruthy();
  });

  it('retour au réel alors que le forçage vient de finir : le message du serveur (404)', async () => {
    state = { ...base(), override: { mode: 'forcee', condition: 'rain', since: iso(NOW - 60_000), until: iso(NOW + 60_000), by: 'admin' } };
    render(<App />);
    const back = await screen.findByRole('button', { name: 'Revenir à la météo réelle' });
    state = base(); // fini entre-temps
    fireEvent.click(back);
    expect(await screen.findByText('Aucun forçage en cours (déjà terminé ?).')).toBeTruthy();
  });
});

describe('pastille et lien d’aperçu', () => {
  it('Direct, Ancien relevé (plus d’1 h ou « stale »), Forcée, Coupée, Indisponible', () => {
    const d = base();
    expect(badgeOf(d, NOW).text).toBe('Direct');
    expect(badgeOf({ ...d, public: { ...LIVE, stale: true } }, NOW).text).toBe('Ancien relevé');
    expect(badgeOf(d, Date.parse(LIVE.observedAt) + 61 * 60_000).text).toBe('Ancien relevé');
    expect(badgeOf({ ...d, public: { ...LIVE, forced: true } }, NOW).text).toBe('Forcée');
    expect(badgeOf({ ...d, public: null, publicCode: 'meteo-desactivee' }, NOW).text).toBe('Coupée');
    expect(badgeOf({ ...d, public: null, publicCode: 'meteo-indisponible' }, NOW).text).toBe('Indisponible');
  });

  it('même rendu que le forçage : ?weather=, intensité, vent, direction ; rien sans condition', () => {
    expect(previewHref({ condition: 'fog', intensity: '', windKmh: '', windFromDeg: '' })).toBe('/?weather=fog');
    expect(previewHref({ condition: 'rain', intensity: '0.8', windKmh: '40', windFromDeg: '200' })).toBe('/?weather=rain&intensity=0.8&wind=40&windfrom=200');
    expect(previewHref({ condition: '', intensity: '0.8', windKmh: '', windFromDeg: '' })).toBeNull();
  });
});
