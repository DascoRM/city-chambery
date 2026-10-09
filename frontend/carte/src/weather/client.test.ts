import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWeatherClient, fetchWeather, nextRefresh, type WeatherFetch } from './client';

const NOW = Date.parse('2026-10-09T08:05:00Z');
const body = {
  v: 1, source: 'open-meteo', model: 'icon_seamless', observedAt: '2026-10-09T08:00:00Z', fetchedAt: '2026-10-09T08:01:00Z',
  stale: false, forced: false, condition: 'cloudy', temperatureC: 11, cloudCover: 0.9, precipMmH: 0, rainIntensity: 0,
  snowIntensity: 0, windKmh: 5, windGustKmh: null, windFromDeg: 270, visibilityM: null, fog: 0, thunder: false, attribution: null,
};
const now = () => NOW;
const reply = (status: number, b: unknown, raw = false) => vi.fn(async () => new Response(raw ? String(b) : JSON.stringify(b), { status }));
const ok = { ok: true, body: body as never, ms: 1 } as const;
const ko = (reason: 'indisponible' | 'desactivee' | 'absente' | 'reseau' | 'delai' | 'hors-contrat'): WeatherFetch => ({ ok: false, reason, ms: 1 });
afterEach(() => vi.useRealTimers()); // même si un test échoue avant de les rendre

describe('lecture de /api/weather : la carte ne plante jamais', () => {
  it('200 conforme au contrat (même avec un champ en plus) → ok', async () => {
    expect((await fetchWeather(reply(200, body), 8000, now)).ok).toBe(true);
    expect((await fetchWeather(reply(200, { ...body, nouveau: 1 }), 8000, now)).ok).toBe(true);
  });
  it('503 : météo indisponible ou coupée depuis l’administration (code du contrat)', async () => {
    expect(await fetchWeather(reply(503, { error: 'x', code: 'meteo-indisponible' }), 8000, now)).toMatchObject({ ok: false, reason: 'indisponible' });
    expect(await fetchWeather(reply(503, { error: 'x', code: 'meteo-desactivee' }), 8000, now)).toMatchObject({ ok: false, reason: 'desactivee' });
    expect(await fetchWeather(reply(503, '<html>Service Unavailable</html>', true), 8000, now)).toMatchObject({ ok: false, reason: 'indisponible' });
  });
  it('404 (carte du Pi, sans API), 502, page HTML, hors contrat, réseau coupé', async () => {
    expect(await fetchWeather(reply(404, { error: 'introuvable' }), 8000, now)).toMatchObject({ reason: 'absente' });
    expect(await fetchWeather(reply(502, {}), 8000, now)).toMatchObject({ reason: 'indisponible' });
    expect(await fetchWeather(reply(200, '<!doctype html><html></html>', true), 8000, now)).toMatchObject({ reason: 'hors-contrat' });
    for (const b of [{ ...body, v: 2 }, { ...body, rainIntensity: 3 }, { ...body, condition: 'grele' }, null, []]) {
      expect(await fetchWeather(reply(200, b), 8000, now)).toMatchObject({ reason: 'hors-contrat' });
    }
    expect(await fetchWeather(vi.fn(async () => { throw new TypeError('Failed to fetch'); }), 8000, now)).toMatchObject({ reason: 'reseau' });
  });
  it('relevé de plus de 3 h refusé ; une météo forcée, elle, n’a pas de limite d’âge (forçage de 6 h au plus)', async () => {
    const old = { ...body, observedAt: '2026-10-09T05:04:00Z' };
    expect(await fetchWeather(reply(200, old), 8000, now)).toMatchObject({ reason: 'hors-contrat' });
    const forced = { ...old, source: 'admin', model: null, forced: true, forcedUntil: '2026-10-09T11:04:00Z', temperatureC: null };
    expect((await fetchWeather(reply(200, forced), 8000, now)).ok).toBe(true);
  });
  it('la réponse s’arrête en cours de lecture et le délai expire : « delai », pas « hors-contrat » (relecture M7)', async () => {
    const stalled = vi.fn(async () => new Response(new ReadableStream({ start: (c) => c.error(Object.assign(new Error('abort'), { name: 'AbortError' })) }), { status: 200 }));
    expect(await fetchWeather(stalled, 8000, now)).toMatchObject({ ok: false, reason: 'delai' });
  });
  it('délai de 8 s dépassé → abandon (rien ne l’attend)', async () => {
    vi.useFakeTimers();
    const slow = vi.fn((_: unknown, init?: RequestInit) => new Promise<Response>((_r, reject) => init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('abort'), { name: 'AbortError' })))));
    const p = fetchWeather(slow as unknown as typeof fetch, 8000, now);
    await vi.advanceTimersByTimeAsync(7999);
    expect(slow).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(await p).toMatchObject({ ok: false, reason: 'delai' });
    vi.useRealTimers();
  });
});

describe('quand relire', () => {
  it('15 min après un succès ou une météo coupée, onglet visible et visiteur actif seulement', () => {
    expect(nextRefresh(ok, 0, true, 0)).toBe(900_000);
    expect(nextRefresh(ko('desactivee'), 0, true, 0)).toBe(900_000);
    expect(nextRefresh(ok, 0, false, 0)).toBeNull();
    expect(nextRefresh(ok, 0, true, 31 * 60_000)).toBeNull();
  });
  it('échec : 60 s, puis 2, 4, 8 min, au plus 15 ; sans API (404) : jamais', () => {
    expect([1, 2, 3, 4, 5, 6].map((n) => nextRefresh(ko('reseau'), n, true, 0))).toEqual([60_000, 120_000, 240_000, 480_000, 900_000, 900_000]);
    expect(nextRefresh(ko('absente'), 1, true, 0)).toBeNull();
  });
});

describe('relectures programmées (minuteries simulées)', () => {
  let visible = true;
  const results: WeatherFetch[] = [];
  const client = (f: typeof fetch) => createWeatherClient({ fetch: f, visible: () => visible, onResult: (r) => results.push(r) });
  beforeEach(() => { vi.useFakeTimers({ now: NOW }); visible = true; results.length = 0; });
  afterEach(() => vi.useRealTimers());

  it('API en panne : nouvel essai à 60 s, puis 2, 4, 8 min, au plus 15 ; retour du réseau : tout de suite', async () => {
    const f = reply(503, { error: 'x', code: 'meteo-indisponible' });
    const c = client(f);
    c.start();
    await vi.advanceTimersByTimeAsync(0);
    const calls: number[] = [];
    for (const step of [60_000, 120_000, 240_000, 480_000, 900_000]) {
      await vi.advanceTimersByTimeAsync(step - 1);
      calls.push(f.mock.calls.length);
      await vi.advanceTimersByTimeAsync(1);
    }
    expect(calls).toEqual([1, 2, 3, 4, 5]); // chaque essai arrive exactement à son heure
    expect(f).toHaveBeenCalledTimes(6);
    c.online();
    await vi.advanceTimersByTimeAsync(0);
    expect(f).toHaveBeenCalledTimes(7);
  });

  it('404 (carte du Pi) : une seule lecture, jamais de relance, même au retour du réseau', async () => {
    const f = reply(404, { error: 'introuvable' });
    const c = client(f);
    c.start();
    await vi.advanceTimersByTimeAsync(3 * 3600_000);
    c.online();
    c.wake();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f).toHaveBeenCalledOnce();
  });

  it('succès : relu toutes les 15 min ; onglet caché : rien ; au retour, relu si le relevé a plus de 15 min', async () => {
    const f = reply(200, body);
    const c = client(f);
    c.start();
    await vi.advanceTimersByTimeAsync(15 * 60_000);
    expect(f).toHaveBeenCalledTimes(2);
    visible = false;
    c.wake();
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    expect(f).toHaveBeenCalledTimes(2); // onglet caché : aucune requête
    visible = true;
    c.wake(); // retour sur l'onglet, sans geste (relecture I1 b)
    await vi.advanceTimersByTimeAsync(0);
    expect(f).toHaveBeenCalledTimes(3); // relevé de plus de 15 min : relu tout de suite
  });

  it('visiteur inactif depuis 30 min : plus de relecture ; il revient : relu tout de suite', async () => {
    const f = reply(200, body);
    const c = client(f);
    c.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(2 * 3600_000);
    expect(f).toHaveBeenCalledTimes(3); // à 15 et 30 min ; à 45 min, inactif depuis plus de 30 min : plus rien
    c.interaction();
    await vi.advanceTimersByTimeAsync(0);
    expect(f).toHaveBeenCalledTimes(4);
  });

  it('retour du réseau : relu seulement si l’onglet est visible et le visiteur présent (relecture I1 a)', async () => {
    const f = reply(503, { error: 'x', code: 'meteo-indisponible' });
    const c = client(f);
    c.start();
    await vi.advanceTimersByTimeAsync(0);
    visible = false;
    c.wake();
    c.online();
    await vi.advanceTimersByTimeAsync(0);
    expect(f).toHaveBeenCalledOnce(); // onglet caché : rien
    visible = true;
    await vi.advanceTimersByTimeAsync(40 * 60_000); // 40 min sans geste (onglet de nouveau visible)
    const n = f.mock.calls.length;
    c.online();
    await vi.advanceTimersByTimeAsync(0);
    expect(f).toHaveBeenCalledTimes(n); // visiteur absent depuis 40 min : rien
    c.interaction();
    await vi.advanceTimersByTimeAsync(0);
    expect(f).toHaveBeenCalledTimes(n + 1); // il revient : relu
  });

  it('onglet caché 45 min puis revenu, sans geste : relu tout de suite (relecture I1 b)', async () => {
    const f = reply(200, body);
    const c = client(f);
    c.start();
    await vi.advanceTimersByTimeAsync(0);
    visible = false;
    c.wake();
    await vi.advanceTimersByTimeAsync(45 * 60_000);
    expect(f).toHaveBeenCalledOnce();
    visible = true;
    c.wake();
    await vi.advanceTimersByTimeAsync(0);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('lecture déjà partie pendant le chargement de la ville : réutilisée, pas de seconde requête', async () => {
    const f = reply(200, body);
    const c = client(f);
    c.start(Promise.resolve(ok));
    await vi.advanceTimersByTimeAsync(0);
    expect(f).not.toHaveBeenCalled();
    expect(results).toHaveLength(1);
  });

  it('météo désactivée par le visiteur : plus aucune lecture', async () => {
    const f = reply(200, body);
    const c = client(f);
    c.start();
    await vi.advanceTimersByTimeAsync(0);
    c.stop();
    await vi.advanceTimersByTimeAsync(3600_000);
    c.online();
    expect(f).toHaveBeenCalledOnce();
  });
});
