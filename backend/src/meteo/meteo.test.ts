import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { apiError } from '../../../contrat/erreurs.js';
import { weatherResponse } from '../../../contrat/meteo.js';
import { conditionFromWmo, fogFromVisibility, intensity, normalize, RAIN_FULL_MMH } from './normalize.js';
import { fetchOpenMeteo, upstreamUrl, WeatherUpstreamError, type Upstream } from './open-meteo.js';

const json = (res: Response): Promise<any> => res.json();
const T0 = Date.UTC(2026, 9, 9, 10, 5, 0); // 10 h 05 UTC
const STEP = Math.floor(T0 / 900_000) * 900; // pas de 15 min en cours (10 h 00), en secondes
const NEXT_STEP_MS = (STEP + 900) * 1000; // début du pas suivant (10 h 15)

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
  it('les 29 codes WMO documentés ont une condition ; un code non documenté n’en a pas', () => {
    const codes = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 97, 99];
    expect(codes.length).toBe(29);
    for (const c of codes) expect(conditionFromWmo(c), `code ${c}`).not.toBeNull();
    expect(conditionFromWmo(53)).toBe('drizzle');
    expect(conditionFromWmo(61)).toBe('rain');
    expect(conditionFromWmo(73)).toBe('snow');
    expect(conditionFromWmo(97)).toBe('thunder');
    for (const c of [30, 50, 52, 62, 72, 98]) expect(conditionFromWmo(c), `code ${c}`).toBeNull();
  });

  it('les cumuls sur 15 min deviennent des mm/h ; la bruine et la pluie suivent le code de la source', () => {
    const r = normalize(upstream({ precipitation: 0.5, weather_code: 61 }), T0);
    expect(r.precipMmH).toBe(2);
    expect(r.condition).toBe('rain');
    expect(r.rainIntensity).toBeCloseTo(intensity(2, RAIN_FULL_MMH), 2);
    expect(normalize(upstream({ precipitation: 0.1, weather_code: 53 }), T0).condition).toBe('drizzle');
    // Plus petit cumul de la source (0,1 mm, soit 0,4 mm/h) avec un code de ciel : de la bruine
    expect(normalize(upstream({ precipitation: 0.1, weather_code: 3 }), T0)).toMatchObject({ condition: 'drizzle', precipMmH: 0.4 });
    // Code de pluie sans précipitation : rien de visible, le ciel suit la couverture nuageuse
    expect(normalize(upstream({ precipitation: 0, weather_code: 61 }), T0)).toMatchObject({ condition: 'partly', rainIntensity: 0 });
    // Cumuls horaires (autre modèle) : mm/h = cumul
    expect(normalize(upstream({ precipitation: 2, interval: 3600, weather_code: 61 }), T0).precipMmH).toBe(2);
  });

  it('la neige seulement à 2 °C ou moins ; au-dessus, la scène montre de la pluie', () => {
    const snow = { precipitation: 0.25, snowfall: 0.175, weather_code: 73 }; // 1 mm/h d'eau, tout en neige
    expect(normalize(upstream({ ...snow, temperature_2m: 0 }), T0)).toMatchObject({ condition: 'snow', rainIntensity: 0 });
    const warm = normalize(upstream({ ...snow, temperature_2m: 4 }), T0);
    expect(warm).toMatchObject({ condition: 'rain', snowIntensity: 0 });
    expect(warm.rainIntensity).toBeGreaterThan(0);
    // Sans code de neige, la part tirée de `snowfall` : moitié neige à 1 °C
    expect(normalize(upstream({ precipitation: 0.25, snowfall: 0.0875, temperature_2m: 1 }), T0).condition).toBe('sleet');
  });

  it('par temps froid, la neige annoncée par la source est de la neige, même si ses cm ne font pas le compte (relecture I1)', () => {
    // Couples réels d'ICON relevés sur des sommets alpins (température, code, précipitation en mm, neige en cm)
    const cases: Array<[number, number, number, number]> = [[-3, 71, 0.1, 0], [-3.1, 71, 0.2, 0.07], [-3, 71, 0.3, 0.14], [-3.1, 73, 0.2, 0]];
    for (const [temperature_2m, weather_code, precipitation, snowfall] of cases) {
      const r = normalize(upstream({ temperature_2m, weather_code, precipitation, snowfall }), T0);
      expect(r, `${temperature_2m} °C, code ${weather_code}, ${precipitation} mm, ${snowfall} cm`).toMatchObject({ condition: 'snow', rainIntensity: 0 });
      expect(r.snowIntensity).toBeGreaterThan(0);
    }
  });

  it('brouillard déduit de la visibilité (1 km = 0,5) ou, sans visibilité, du code 45 / 48', () => {
    expect(fogFromVisibility(200)).toBe(1);
    expect(fogFromVisibility(1000)).toBeCloseTo(0.5, 2);
    expect(fogFromVisibility(5000)).toBe(0);
    expect(normalize(upstream({ visibility: 300, weather_code: 3 }), T0)).toMatchObject({ condition: 'fog' }); // la visibilité suffit
    expect(normalize(upstream({ visibility: null, weather_code: 45 }), T0).fog).toBe(0.7);
    expect(normalize(upstream({ visibility: null, weather_code: 3 }), T0)).toMatchObject({ fog: 0, condition: 'cloudy', visibilityM: null });
    // La condition se décide sur la valeur renvoyée : jamais « fog: 0.5 » avec « Couvert » (relecture M4)
    expect(normalize(upstream({ visibility: 1005, weather_code: 3 }), T0)).toMatchObject({ fog: 0.5, condition: 'fog' });
  });

  it('orage seulement sur les codes d’orage de la source (pas d’éclair « en temps réel »)', () => {
    expect(normalize(upstream({ weather_code: 95, precipitation: 1 }), T0)).toMatchObject({ condition: 'thunder', thunder: true });
    expect(normalize(upstream({ weather_code: 97 }), T0).thunder).toBe(true);
    expect(normalize(upstream({ lightning_potential: 50 }), T0).thunder).toBe(false);
  });

  it('la réponse respecte le contrat, même sans code, sans neige ni rafales ; la date du relevé est celle du pas de la source', () => {
    const r = weatherResponse.parse(normalize(upstream(), T0));
    expect(r.observedAt).toBe(new Date(STEP * 1000).toISOString());
    expect(r).toMatchObject({ condition: 'partly', cloudCover: 0.71, windFromDeg: 257, stale: false, forced: false, model: 'icon_seamless' });
    const sparse = weatherResponse.parse(normalize(upstream({ weather_code: undefined, snowfall: undefined, wind_gusts_10m: null }), T0));
    expect(sparse).toMatchObject({ condition: 'partly', windGustKmh: null });
  });
});

describe('météo : appel de la source', () => {
  it('coordonnées fixes, modèle, 10 variables au plus (1 appel compté par Open-Meteo), avec un délai', async () => {
    const url = new URL(upstreamUrl());
    expect(url.searchParams.get('latitude')).toBe('45.5658');
    expect(url.searchParams.get('longitude')).toBe('5.9205');
    expect(url.searchParams.get('models')).toBe('icon_seamless');
    expect(url.searchParams.get('current')!.split(',').length).toBeLessThanOrEqual(10);
    let init: RequestInit | undefined;
    await fetchOpenMeteo(async (_url, i) => { init = i; return Response.json(upstream()); }, T0);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('refuse une réponse incomplète, aberrante, en erreur, trop vieille, dans le futur, ou en retard', async () => {
    const ko = async (reply: () => Response | Promise<Response>) => {
      try { await fetchOpenMeteo(async () => reply(), T0); return 'accepté'; } catch (e) { return (e as WeatherUpstreamError).kind; }
    };
    expect(await ko(() => Response.json({ ...upstream(), current: { ...upstream().current, temperature_2m: 80 } }))).toBe('format');
    const { cloud_cover: _, ...partial } = upstream().current;
    expect(await ko(() => Response.json({ ...upstream(), current: partial }))).toBe('format');
    expect(await ko(() => new Response('pas du JSON'))).toBe('format');
    expect(await ko(() => Response.json(upstream({}, 9_000_000_000_000)))).toBe('format'); // heure absurde : pas d'exception
    expect(await ko(() => Response.json({ error: true, reason: 'Too many requests' }, { status: 429 }))).toBe('http-429');
    expect(await ko(() => Response.json(upstream({}, STEP - 3 * 3600)))).toBe('perime');
    expect(await ko(() => Response.json(upstream({}, STEP + 3600)))).toBe('perime'); // pas dans le futur
    expect(await ko(() => { throw Object.assign(new Error('délai'), { name: 'TimeoutError' }); })).toBe('delai');
    expect(await ko(() => { throw new TypeError('fetch failed'); })).toBe('reseau');
    // La source s'arrête pendant l'envoi du corps : le délai la coupe, c'est un retard et pas un format illisible
    const stalled = new Response(new ReadableStream({ start: (ctl) => ctl.error(Object.assign(new Error('délai'), { name: 'TimeoutError' })) }));
    expect(await ko(() => stalled)).toBe('delai');
    expect(await ko(() => Response.json(upstream()))).toBe('accepté');
  });
});

describe('GET /api/weather', () => {
  it('répond le contrat, mis en cache par le CDN, sans cookie ; les paramètres de la requête sont ignorés', async () => {
    const src = fakeSource();
    const res = await appWith(src).request('/api/weather?latitude=48.85&longitude=2.35');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=0, s-maxage=60, stale-while-revalidate=60');
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(weatherResponse.parse(await json(res))).toMatchObject({ source: 'open-meteo', condition: 'partly', stale: false });
    expect(new URL(src.calls[0]).searchParams.get('latitude')).toBe('45.5658');
  });

  it('100 visites pendant un pas de 15 min, dont 50 simultanées : un seul appel ; le pas suivant est relu 30 s après son début', async () => {
    const src = fakeSource();
    const app = appWith(src);
    await Promise.all(Array.from({ length: 50 }, () => app.request('/api/weather')));
    for (let i = 0; i < 50; i++) { src.clock = T0 + i * 10_000; await app.request('/api/weather'); }
    src.clock = NEXT_STEP_MS + 29_000;
    await app.request('/api/weather');
    expect(src.calls.length).toBe(1);
    src.clock = NEXT_STEP_MS + 30_000;
    const next = weatherResponse.parse(await json(await app.request('/api/weather')));
    expect(src.calls.length).toBe(2);
    expect(next.observedAt).toBe(new Date(NEXT_STEP_MS).toISOString());
  });

  it('la source tarde à publier le pas suivant : elle est rappelée au plus une fois par minute', async () => {
    const src = fakeSource();
    const app = appWith(src);
    src.reply = () => Response.json(upstream({}, STEP)); // toujours le pas de 10 h 00
    await app.request('/api/weather');
    src.clock = NEXT_STEP_MS + 30_000;
    await app.request('/api/weather');
    expect(src.calls.length).toBe(2);
    src.clock += 59_000;
    expect((await json(await app.request('/api/weather'))).stale).toBe(false);
    expect(src.calls.length).toBe(2);
    src.clock += 1_000;
    await app.request('/api/weather');
    expect(src.calls.length).toBe(3);
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

  it('jamais de relevé (source en panne dès le départ) : 503 tout de suite, 50 visiteurs simultanés font 1 appel, nouvel essai après 60 s', async () => {
    const src = fakeSource();
    src.reply = () => { throw new TypeError('fetch failed'); };
    const app = appWith(src);
    const all = await Promise.all(Array.from({ length: 50 }, () => app.request('/api/weather')));
    expect(all.every((r) => r.status === 503)).toBe(true);
    expect((await json(all[0])).code).toBe('meteo-indisponible');
    expect(src.calls.length).toBe(1);
    src.clock += 59_000;
    await app.request('/api/weather');
    expect(src.calls.length).toBe(1);
    src.clock += 1_000;
    await app.request('/api/weather');
    expect(src.calls.length).toBe(2);
  });

  it('refus 429 de la source (quota par adresse IP) : pas de nouvel essai avant 10 min', async () => {
    const src = fakeSource();
    src.reply = () => Response.json({ error: true, reason: 'Too many requests' }, { status: 429 });
    const app = appWith(src);
    expect((await app.request('/api/weather')).status).toBe(503);
    src.reply = () => Response.json(upstream({}, Math.floor(src.clock / 900_000) * 900));
    src.clock = T0 + 9 * 60_000;
    expect((await app.request('/api/weather')).status).toBe(503);
    expect(src.calls.length).toBe(1);
    src.clock = T0 + 10 * 60_000;
    expect((await app.request('/api/weather')).status).toBe(200);
    expect(src.calls.length).toBe(2);
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
