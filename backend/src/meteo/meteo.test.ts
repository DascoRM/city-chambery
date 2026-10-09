import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { apiError } from '../../../contrat/erreurs.js';
import { weatherResponse } from '../../../contrat/meteo.js';
import { conditionFromWmo, fogFromVisibility, intensity, normalize, RAIN_FULL_MMH } from './normalize.js';
import { fetchOpenMeteo, upstreamUrl, WeatherUpstreamError, type Upstream } from './open-meteo.js';

const json = (res: Response): Promise<any> => res.json();
const T0 = Date.UTC(2026, 9, 9, 10, 5, 0);
const STEP = Math.floor(T0 / 900_000) * 900; // pas de 15 min en cours (secondes)

/** Relevé de la source (réponse réelle d'Open-Meteo du 09/10/2026, modèle icon_seamless), modifiable */
function upstream(current: Partial<Upstream['current']> = {}, step = STEP): Upstream {
  return {
    latitude: 45.56, longitude: 5.9199996, elevation: 286,
    current: {
      time: step, interval: 900, temperature_2m: 12.8, weather_code: 2, cloud_cover: 71, precipitation: 0, snowfall: 0,
      wind_speed_10m: 14.1, wind_direction_10m: 257, wind_gusts_10m: 29.9, visibility: 33040, lightning_potential: 0, ...current,
    },
  };
}

/** Fausse source : compte les appels, répond ce qu'on lui dit (ou échoue), avec sa propre horloge */
function fakeSource() {
  const s = {
    calls: [] as string[],
    clock: T0,
    reply: (): Response | Promise<Response> => Response.json(upstream({}, Math.floor(s.clock / 900_000) * 900)),
    fetch: async (url: string) => { s.calls.push(url); return s.reply(); },
  };
  return s;
}

const appWith = (src: ReturnType<typeof fakeSource>) => createApp({}, { now: () => src.clock, weather: { fetch: src.fetch } });

describe('météo : normalisation (choix de rendu)', () => {
  it('chaque code WMO documenté a une condition ; un code inconnu n’en a pas', () => {
    const codes = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99];
    expect(codes.length).toBe(28);
    for (const c of codes) expect(conditionFromWmo(c), `code ${c}`).not.toBeNull();
    expect(conditionFromWmo(53)).toBe('drizzle');
    expect(conditionFromWmo(61)).toBe('rain');
    expect(conditionFromWmo(96)).toBe('thunder');
    expect(conditionFromWmo(30)).toBeNull();
  });

  it('les cumuls sur 15 min deviennent des mm/h ; la bruine et la pluie suivent le code de la source', () => {
    const r = normalize(upstream({ precipitation: 0.5, weather_code: 61 }), T0);
    expect(r.precipMmH).toBe(2);
    expect(r.condition).toBe('rain');
    expect(r.rainIntensity).toBeCloseTo(intensity(2, RAIN_FULL_MMH), 2);
    expect(normalize(upstream({ precipitation: 0.05, weather_code: 53 }), T0).condition).toBe('drizzle');
    // 0,04 mm/h : rien de visible, le ciel suit le code de la source
    expect(normalize(upstream({ precipitation: 0.01, weather_code: 61 }), T0)).toMatchObject({ condition: 'partly', rainIntensity: 0 });
  });

  it('la neige seulement à 2 °C ou moins ; au-dessus, la scène montre de la pluie', () => {
    const snow = { precipitation: 0.25, snowfall: 0.175, weather_code: 73 }; // 1 mm/h d'eau, tout en neige
    expect(normalize(upstream({ ...snow, temperature_2m: 0 }), T0)).toMatchObject({ condition: 'snow', rainIntensity: 0 });
    const warm = normalize(upstream({ ...snow, temperature_2m: 4 }), T0);
    expect(warm.snowIntensity).toBe(0);
    expect(warm.rainIntensity).toBeGreaterThan(0);
    expect(warm.condition).toBe('rain');
    expect(normalize(upstream({ precipitation: 0.25, snowfall: 0.0875, temperature_2m: 1 }), T0).condition).toBe('sleet');
  });

  it('brouillard déduit de la visibilité (1 km = 0,5) ou, sans visibilité, du code 45 / 48', () => {
    expect(fogFromVisibility(200)).toBe(1);
    expect(fogFromVisibility(1000)).toBeCloseTo(0.5, 2);
    expect(fogFromVisibility(5000)).toBe(0);
    expect(normalize(upstream({ visibility: 300, weather_code: 45 }), T0)).toMatchObject({ condition: 'fog' });
    expect(normalize(upstream({ visibility: null, weather_code: 45 }), T0).fog).toBe(0.7);
    expect(normalize(upstream({ visibility: null, weather_code: 3 }), T0)).toMatchObject({ fog: 0, condition: 'cloudy', visibilityM: null });
  });

  it('orage seulement sur les codes 95 à 99 (pas d’éclair « en temps réel »)', () => {
    expect(normalize(upstream({ weather_code: 95, precipitation: 1 }), T0)).toMatchObject({ condition: 'thunder', thunder: true });
    expect(normalize(upstream({ lightning_potential: 50 }), T0).thunder).toBe(false);
  });

  it('la réponse respecte le contrat ; la date du relevé est celle du pas de la source', () => {
    const r = weatherResponse.parse(normalize(upstream(), T0));
    expect(r.observedAt).toBe(new Date(STEP * 1000).toISOString());
    expect(r).toMatchObject({ condition: 'partly', cloudCover: 0.71, windFromDeg: 257, stale: false, forced: false, model: 'icon_seamless' });
  });
});

describe('météo : appel de la source', () => {
  it('coordonnées fixes, modèle et 10 variables au plus (1 appel compté par Open-Meteo)', () => {
    const url = new URL(upstreamUrl());
    expect(url.searchParams.get('latitude')).toBe('45.5658');
    expect(url.searchParams.get('longitude')).toBe('5.9205');
    expect(url.searchParams.get('models')).toBe('icon_seamless');
    expect(url.searchParams.get('current')!.split(',').length).toBeLessThanOrEqual(10);
  });

  it('refuse une réponse incomplète, aberrante, en erreur, trop vieille, ou en retard', async () => {
    const ko = async (reply: () => Response | Promise<Response>) => {
      try { await fetchOpenMeteo(async () => reply(), T0); return 'accepté'; } catch (e) { return (e as WeatherUpstreamError).kind; }
    };
    expect(await ko(() => Response.json({ ...upstream(), current: { ...upstream().current, temperature_2m: 80 } }))).toBe('format');
    const { cloud_cover: _, ...partial } = upstream().current;
    expect(await ko(() => Response.json({ ...upstream(), current: partial }))).toBe('format');
    expect(await ko(() => new Response('pas du JSON'))).toBe('format');
    expect(await ko(() => Response.json({ error: true, reason: 'Too many requests' }, { status: 429 }))).toBe('http-429');
    expect(await ko(() => Response.json(upstream({}, STEP - 3 * 3600)))).toBe('perime');
    expect(await ko(() => { throw Object.assign(new Error('délai'), { name: 'TimeoutError' }); })).toBe('delai');
    expect(await ko(() => { throw new TypeError('fetch failed'); })).toBe('reseau');
    expect(await ko(() => Response.json(upstream()))).toBe('accepté');
  });
});

describe('GET /api/weather', () => {
  it('répond le contrat, mis en cache par le CDN 60 s, sans cookie ; les paramètres de la requête sont ignorés', async () => {
    const src = fakeSource();
    const res = await appWith(src).request('/api/weather?latitude=48.85&longitude=2.35');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=0, s-maxage=60, stale-while-revalidate=300');
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(weatherResponse.parse(await json(res))).toMatchObject({ source: 'open-meteo', condition: 'partly', stale: false });
    expect(new URL(src.calls[0]).searchParams.get('latitude')).toBe('45.5658');
  });

  it('100 visites en 10 min, dont 50 simultanées : un seul appel à la source', async () => {
    const src = fakeSource();
    const app = appWith(src);
    await Promise.all(Array.from({ length: 50 }, () => app.request('/api/weather')));
    for (let i = 0; i < 50; i++) { src.clock = T0 + i * 10_000; await app.request('/api/weather'); }
    expect(src.calls.length).toBe(1);
    src.clock = T0 + 10 * 60_000;
    await app.request('/api/weather');
    expect(src.calls.length).toBe(2);
  });

  it('source en panne : dernier bon relevé « stale » jusqu’à 3 h, sans marteler la source, puis 503 avec un code', async () => {
    const src = fakeSource();
    const app = appWith(src);
    expect((await app.request('/api/weather')).status).toBe(200);
    src.reply = () => new Response('panne', { status: 502 });
    src.clock = T0 + 11 * 60_000;
    const stale = weatherResponse.parse(await json(await app.request('/api/weather')));
    expect(stale.stale).toBe(true);
    const calls = src.calls.length;
    src.clock += 30_000;
    await app.request('/api/weather'); // moins de 60 s après l'échec : pas de nouvel appel
    expect(src.calls.length).toBe(calls);
    src.clock = STEP * 1000 + 3 * 3600_000 + 1000; // le pas de 15 min a plus de 3 h
    const gone = await app.request('/api/weather');
    expect(gone.status).toBe(503);
    expect(gone.headers.get('cache-control')).toBe('no-store');
    expect(apiError.parse(await json(gone)).code).toBe('meteo-indisponible');
  });

  it('jamais de relevé (source en panne dès le départ) : 503 tout de suite', async () => {
    const src = fakeSource();
    src.reply = () => { throw new TypeError('fetch failed'); };
    const res = await appWith(src).request('/api/weather');
    expect(res.status).toBe(503);
    expect((await json(res)).code).toBe('meteo-indisponible');
  });

  it('la source revient : un nouveau relevé remplace le relevé « stale »', async () => {
    const src = fakeSource();
    const app = appWith(src);
    await app.request('/api/weather');
    src.reply = () => new Response('panne', { status: 503 });
    src.clock = T0 + 11 * 60_000;
    expect((await json(await app.request('/api/weather'))).stale).toBe(true);
    src.reply = () => Response.json(upstream({ weather_code: 3, cloud_cover: 100 }, Math.floor(src.clock / 900_000) * 900));
    src.clock += 61_000; // plus de 60 s après l'échec : la source est rappelée
    expect(weatherResponse.parse(await json(await app.request('/api/weather')))).toMatchObject({ stale: false, condition: 'cloudy' });
  });
});
