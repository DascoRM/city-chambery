import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import * as schema from '../db/schema.js';
import type { Db } from '../parkings.js';
import { apiError } from '../../../contrat/erreurs.js';
import {
  WEATHER_PRESETS, adminWeatherResponse, weatherOverride, weatherResponse, type WeatherCondition, type WeatherOverride,
} from '../../../contrat/meteo.js';
import { forcedResponse } from './normalize.js';
import { OVERRIDE_KEY, parseOverride } from './override-store.js';
import { publicCache } from './routes.js';
import { createWeatherService, type OverrideStore } from './service.js';
import type { Upstream } from './open-meteo.js';

/** Météo forcée depuis l'administration (EP009-US012) : valeurs types, lecture bornée, routes admin, journal */
const json = (res: Response): Promise<any> => res.json();
const T0 = Date.UTC(2026, 9, 9, 10, 5, 0); // 10 h 05 UTC
const MIN = 60_000;
const iso = (ms: number) => new Date(ms).toISOString();

function upstream(step: number): Upstream {
  return {
    latitude: 45.56, longitude: 5.9199996, elevation: 286,
    current: {
      time: step, interval: 900, temperature_2m: 12.8, weather_code: 2, cloud_cover: 71, precipitation: 0, snowfall: 0,
      wind_speed_10m: 14.1, wind_direction_10m: 257, wind_gusts_10m: 29.9, visibility: 33040, lightning_potential: 0,
    },
  };
}
/** Fausse source, avec sa propre horloge (le relevé suit le pas de 15 min en cours) */
function fakeSource() {
  const s = { calls: 0, clock: T0, fetch: async () => { s.calls++; return Response.json(upstream(Math.floor(s.clock / 900_000) * 900)); } };
  return s;
}
const forced = (o: Partial<WeatherOverride> = {}): WeatherOverride =>
  ({ mode: 'forcee', condition: 'snow', since: iso(T0), until: iso(T0 + 30 * MIN), by: 'admin', ...o });

describe('météo forcée : valeurs types, mêmes règles que ?weather= sur la carte', () => {
  it('chaque condition : valeurs du contrat, ni température, ni modèle, ni crédit, fin du forçage', () => {
    for (const c of Object.keys(WEATHER_PRESETS) as WeatherCondition[]) {
      const p = WEATHER_PRESETS[c];
      const r = weatherResponse.parse(forcedResponse({ ...forced(), condition: c }));
      expect(r, c).toMatchObject({
        source: 'admin', model: null, forced: true, forcedUntil: iso(T0 + 30 * MIN), observedAt: iso(T0), stale: false,
        condition: c, temperatureC: null, attribution: null, cloudCover: p.cloudCover, rainIntensity: p.rainIntensity,
        snowIntensity: p.snowIntensity, fog: p.fog, thunder: p.thunder, windKmh: 10, windFromDeg: 270,
      });
    }
  });

  it('l’intensité remplace l’effet principal (pluie, neige, brouillard), pas « pluie et neige » ni le ciel sec ; vent choisi', () => {
    expect(forcedResponse({ ...forced({ condition: 'rain', intensity: 0.9 }), condition: 'rain' }).rainIntensity).toBe(0.9);
    expect(forcedResponse({ ...forced({ intensity: 0.9 }), condition: 'snow' }).snowIntensity).toBe(0.9);
    const fog = forcedResponse({ ...forced({ condition: 'fog', intensity: 1 }), condition: 'fog' });
    expect(fog).toMatchObject({ fog: 1, visibilityM: 200 });
    expect(forcedResponse({ ...forced({ condition: 'sleet', intensity: 0.9 }), condition: 'sleet' })).toMatchObject({ rainIntensity: 0.3, snowIntensity: 0.3 });
    expect(forcedResponse({ ...forced({ condition: 'clear', intensity: 0.9 }), condition: 'clear' })).toMatchObject({ rainIntensity: 0, fog: 0, visibilityM: null });
    expect(forcedResponse({ ...forced({ windKmh: 40, windFromDeg: 180 }), condition: 'snow' })).toMatchObject({ windKmh: 40, windFromDeg: 180 });
  });

  it('une valeur hors contrat en base est ignorée : condition inconnue, sans condition, plus de 6 h, JSON illisible', () => {
    expect(parseOverride(JSON.stringify(forced()))).toMatchObject({ condition: 'snow' });
    expect(parseOverride(JSON.stringify({ ...forced(), condition: 'tornade' }))).toBeNull();
    expect(parseOverride(JSON.stringify({ ...forced(), condition: undefined }))).toBeNull();
    expect(parseOverride(JSON.stringify(forced({ until: iso(T0 + 7 * 60 * MIN) })))).toBeNull();
    expect(parseOverride(JSON.stringify(forced({ until: iso(T0 - MIN) })))).toBeNull();
    expect(parseOverride('{pas du JSON')).toBeNull();
  });

  it('en-tête du CDN : 60 + 60 s d’ordinaire ; moins quand le forçage finit avant ; rien sous 2 s', () => {
    expect(publicCache(120)).toBe('public, max-age=0, s-maxage=60, stale-while-revalidate=60');
    expect(publicCache(90)).toBe('public, max-age=0, s-maxage=45, stale-while-revalidate=45');
    expect(publicCache(3)).toBe('public, max-age=0, s-maxage=2, stale-while-revalidate=1');
    expect(publicCache(1)).toBe('no-store');
    expect(publicCache(0)).toBe('no-store');
  });
});

describe('lecture du forçage par la route publique : bornée (réveils de Neon)', () => {
  /** Fausse base : compte les lectures, rend ce qu'on lui dit, ou attend, ou échoue */
  function fakeStore(value: () => WeatherOverride | null) {
    const s = {
      reads: 0, mode: 'ok' as 'ok' | 'hang' | 'fail', release: () => {},
      store: {
        read: async () => {
          s.reads++;
          if (s.mode === 'fail') throw new Error('connexion refusée');
          if (s.mode === 'hang') await new Promise<void>((r) => { s.release = r; });
          return value();
        },
        save: async () => {}, clear: async () => false,
      } satisfies OverrideStore,
    };
    return s;
  }

  it('sans forçage : au plus une lecture toutes les 30 min ; pendant un forçage : toutes les 2 min', async () => {
    const src = fakeSource();
    let value: WeatherOverride | null = null;
    const db = fakeStore(() => value);
    const w = createWeatherService({ fetch: src.fetch, now: () => src.clock, overrides: () => db.store });
    for (let i = 0; i < 100; i++) { src.clock = T0 + i * 17_000; await w.current(); } // 100 visites en 28 min
    expect(db.reads).toBe(1);
    src.clock = T0 + 30 * MIN;
    value = forced({ since: iso(src.clock), until: iso(src.clock + 30 * MIN) });
    expect((await w.current()).ok && db.reads).toBe(2);
    src.clock += 119_000;
    await w.current();
    expect(db.reads).toBe(2);
    src.clock += 1_000;
    await w.current();
    expect(db.reads).toBe(3);
  });

  it('forçage échu : météo réelle à l’heure dite, sans attendre la base ni écrire', async () => {
    const src = fakeSource();
    const db = fakeStore(() => forced());
    const w = createWeatherService({ fetch: src.fetch, now: () => src.clock, overrides: () => db.store });
    expect(await w.current()).toMatchObject({ ok: true, body: { forced: true } });
    src.clock = T0 + 30 * MIN;
    expect(await w.current()).toMatchObject({ ok: true, body: { forced: false, source: 'open-meteo' } });
  });

  it('le CDN ne garde jamais une météo forcée après sa fin', async () => {
    const src = fakeSource();
    const db = fakeStore(() => forced({ until: iso(T0 + 90_000) }));
    const w = createWeatherService({ fetch: src.fetch, now: () => src.clock, overrides: () => db.store });
    expect(await w.current()).toMatchObject({ ok: true, cdnS: 90 });
    src.clock = T0 + 89_000;
    expect(await w.current()).toMatchObject({ ok: true, cdnS: 1 });
  });

  it('base lente (Neon en veille) : la requête attend au plus le délai, sert la météo réelle sans cache, puis la suivante sait', async () => {
    const src = fakeSource();
    const db = fakeStore(() => forced());
    db.mode = 'hang';
    const w = createWeatherService({ fetch: src.fetch, now: () => src.clock, overrides: () => db.store, overrideTimeoutMs: 50 });
    const t = performance.now();
    const first = await w.current();
    expect(performance.now() - t).toBeLessThan(1000);
    expect(first).toMatchObject({ ok: true, cdnS: 0, body: { forced: false } }); // juste, mais pas mis en cache
    const second = await w.current(); // la lecture est toujours en cours : pas d'attente de plus
    expect(second).toMatchObject({ ok: true, cdnS: 0 });
    expect(db.reads).toBe(1);
    db.release();
    await new Promise((r) => setTimeout(r, 0));
    expect(await w.current()).toMatchObject({ ok: true, body: { forced: true, condition: 'snow' } });
  });

  it('base injoignable : météo réelle sans cache, nouvel essai 60 s plus tard', async () => {
    const src = fakeSource();
    const db = fakeStore(() => forced());
    db.mode = 'fail';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const w = createWeatherService({ fetch: src.fetch, now: () => src.clock, overrides: () => db.store });
    expect(await w.current()).toMatchObject({ ok: true, cdnS: 0, body: { forced: false } });
    src.clock += 59_000;
    await w.current();
    expect(db.reads).toBe(1);
    db.mode = 'ok';
    src.clock += 1_000;
    expect(await w.current()).toMatchObject({ ok: true, body: { forced: true } });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('sans base (contrôle du build, prévisualisation sans base) : jamais de forçage, réponse mise en cache', async () => {
    const src = fakeSource();
    const w = createWeatherService({ fetch: src.fetch, now: () => src.clock, overrides: () => null });
    expect(await w.current()).toMatchObject({ ok: true, cdnS: 120, body: { forced: false } });
  });
});

describe('forçage depuis l’administration (routes, session, base PGlite)', () => {
  const TOKEN = 'jeton-de-test-meteo-0123456789';
  const ORIGIN = 'http://localhost';
  let client: PGlite;
  let db: Db;
  beforeEach(async () => {
    client = new PGlite();
    const d = drizzle(client, { schema });
    await migrate(d, { migrationsFolder: fileURLToPath(new URL('../db/migrations', import.meta.url)) });
    db = d as unknown as Db;
  });
  afterEach(async () => { if (!client.closed) await client.close(); });

  /** Une instance de l'API (même base) ; `clock` partagée par la fausse source et la session */
  function instance(src = fakeSource(), base: () => Db | null = () => db) {
    const app = createApp({ ADMIN_TOKEN: TOKEN }, { db: base, now: () => src.clock, weather: { fetch: src.fetch } });
    let cookie = '';
    const login = async () => {
      const res = await app.request('/api/admin/login', { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: JSON.stringify({ token: TOKEN }) });
      cookie = res.headers.getSetCookie().find((c) => c.startsWith('diorama_admin='))!.split(';')[0];
    };
    const send = (method: string, path: string, body?: unknown) =>
      app.request(path, { method, headers: { cookie, origin: ORIGIN, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { src, app, login, send, pub: () => app.request('/api/weather') };
  }
  const meteoLog = () => db.select().from(schema.editLog).where(eq(schema.editLog.target, 'meteo'));

  it('sans session : 401 sur la lecture, le forçage et le retour au réel', async () => {
    const { app } = instance();
    expect((await app.request('/api/admin/weather')).status).toBe(401);
    const put = await app.request('/api/admin/weather/override', { method: 'PUT', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'coupee', minutes: 60 }) });
    expect(put.status).toBe(401);
    expect((await app.request('/api/admin/weather/override', { method: 'DELETE', headers: { origin: ORIGIN } })).status).toBe(401);
  });

  it('400 : condition absente pour « forcee », durée hors de 5 à 360 min, condition inconnue, champ inconnu', async () => {
    const a = instance();
    await a.login();
    for (const body of [{ mode: 'forcee', minutes: 60 }, { mode: 'forcee', condition: 'snow', minutes: 2 }, { mode: 'forcee', condition: 'snow', minutes: 361 },
      { mode: 'forcee', condition: 'grele', minutes: 60 }, { mode: 'forcee', condition: 'snow', minutes: 60, lat: 48.8 }, null]) {
      const res = await a.send('PUT', '/api/admin/weather/override', body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(apiError.parse(await json(res)).code).toBe('donnees-invalides');
    }
  });

  it('forcer la neige : vue tout de suite ici, à froid par une autre instance, journalisée hors du journal des parkings', async () => {
    const a = instance();
    await a.login();
    const put = await a.send('PUT', '/api/admin/weather/override', { mode: 'forcee', condition: 'snow', intensity: 0.9, minutes: 30, note: 'démo avec les amis' });
    expect(put.status).toBe(200);
    expect(weatherOverride.parse(await json(put))).toMatchObject({ mode: 'forcee', condition: 'snow', intensity: 0.9, by: 'admin', since: iso(T0), until: iso(T0 + 30 * MIN), note: 'démo avec les amis' });
    const pub = await a.pub();
    expect(pub.headers.get('cache-control')).toBe('public, max-age=0, s-maxage=60, stale-while-revalidate=60');
    expect(weatherResponse.parse(await json(pub))).toMatchObject({ forced: true, source: 'admin', condition: 'snow', snowIntensity: 0.9, temperatureC: null, attribution: null });
    // Une instance qui démarre lit la base tout de suite
    expect((await json(await instance(a.src).pub())).condition).toBe('snow');
    expect((await meteoLog()).map((l) => l.action)).toEqual(['meteo-forcee']);
    const parkings = await json(await a.send('GET', '/api/admin/parkings/edits'));
    expect(parkings.log).toEqual([]);
  });

  it('une autre instance déjà chaude le voit au plus 30 min après ; la fin revient seule, sans écriture', async () => {
    const a = instance();
    const b = instance(a.src); // même horloge, même base
    expect((await json(await b.pub())).forced).toBe(false); // b a lu la base : pas de forçage
    await a.login();
    await a.send('PUT', '/api/admin/weather/override', { mode: 'forcee', condition: 'fog', minutes: 60 });
    a.src.clock = T0 + 29 * MIN;
    expect((await json(await b.pub())).forced).toBe(false);
    a.src.clock = T0 + 30 * MIN;
    expect((await json(await b.pub())).condition).toBe('fog');
    a.src.clock = T0 + 60 * MIN;
    expect((await json(await a.pub())).forced).toBe(false);
    expect((await json(await b.pub())).forced).toBe(false);
    expect((await meteoLog()).length).toBe(1); // seule l'écriture de l'admin
  });

  it('couper la météo : 503 « meteo-desactivee » sans cache ; revenir au réel : 204, puis 404', async () => {
    const a = instance();
    await a.login();
    expect((await a.send('PUT', '/api/admin/weather/override', { mode: 'coupee', minutes: 60, condition: 'snow' })).status).toBe(200);
    const off = await a.pub();
    expect(off.status).toBe(503);
    expect(off.headers.get('cache-control')).toBe('no-store');
    expect(apiError.parse(await json(off)).code).toBe('meteo-desactivee');
    expect((await a.send('DELETE', '/api/admin/weather/override')).status).toBe(204);
    expect((await a.pub()).status).toBe(200);
    const again = await a.send('DELETE', '/api/admin/weather/override');
    expect(again.status).toBe(404);
    expect(apiError.parse(await json(again)).code).toBe('introuvable');
    expect((await meteoLog()).map((l) => l.action)).toEqual(['meteo-coupee', 'meteo-reelle']);
  });

  it('retour au réel après la fin : 404, la ligne échue est retirée sans journal', async () => {
    const a = instance();
    await a.login();
    await a.send('PUT', '/api/admin/weather/override', { mode: 'forcee', condition: 'rain', minutes: 5 });
    a.src.clock = T0 + 6 * MIN;
    expect((await a.send('DELETE', '/api/admin/weather/override')).status).toBe(404);
    expect(await db.select().from(schema.appMeta).where(eq(schema.appMeta.key, OVERRIDE_KEY))).toEqual([]);
    expect((await meteoLog()).length).toBe(1);
  });

  it('écran admin : conforme au contrat, sans cache ; pendant un forçage, le relevé réel aussi ; autre instance : l’état écrit', async () => {
    const a = instance();
    await a.login();
    await a.send('PUT', '/api/admin/weather/override', { mode: 'forcee', condition: 'thunder', minutes: 60 });
    const res = await a.send('GET', '/api/admin/weather');
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = adminWeatherResponse.parse(await json(res));
    expect(body).toMatchObject({ public: { forced: true, condition: 'thunder' }, publicCode: null, override: { mode: 'forcee', condition: 'thunder', by: 'admin' } });
    expect(body.upstream).toMatchObject({ model: 'icon_seamless', grid: { lat: 45.56, lon: 5.9199996, elevationM: 286 } });
    expect(body.upstream!.raw.cloud_cover).toBe(71);
    expect(body.instance.upstreamCalls).toBe(1);
    expect(body.config).toMatchObject({ freshS: 900, cdnMaxAgeS: 60 });
    // Une autre instance chaude, qui avait lu « pas de forçage », relit la base pour l'écran admin
    const b = instance(a.src);
    await b.pub();
    await b.login();
    await a.send('DELETE', '/api/admin/weather/override');
    await a.send('PUT', '/api/admin/weather/override', { mode: 'coupee', minutes: 30 });
    const seen = adminWeatherResponse.parse(await json(await b.send('GET', '/api/admin/weather')));
    expect(seen).toMatchObject({ public: null, publicCode: 'meteo-desactivee', override: { mode: 'coupee' } });
  });

  it('valeur illisible dans app_meta (écrite à la main) : ignorée, météo réelle, signalée dans les journaux', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await db.insert(schema.appMeta).values({ key: OVERRIDE_KEY, value: '{"mode":"forcee","condition":"tornade"}' });
    const res = await instance().pub();
    expect(res.status).toBe(200);
    expect((await json(res)).forced).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('hors contrat'));
    warn.mockRestore();
  });

  it('sans base : forcer et revenir au réel répondent 503 « base-indisponible » ; la route publique continue', async () => {
    const a = instance(fakeSource(), () => null);
    await a.login();
    for (const [m, b] of [['PUT', { mode: 'coupee', minutes: 30 }], ['DELETE', undefined]] as const) {
      const res = await a.send(m, '/api/admin/weather/override', b);
      expect(res.status).toBe(503);
      expect((await json(res)).code).toBe('base-indisponible');
    }
    expect((await a.pub()).status).toBe(200);
  });

  it('base injoignable : 503 « base-indisponible » (pas une erreur interne)', async () => {
    const a = instance();
    await a.login();
    await client.close();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await a.send('PUT', '/api/admin/weather/override', { mode: 'coupee', minutes: 30 });
    expect(res.status).toBe(503);
    expect((await json(res)).code).toBe('base-indisponible');
    err.mockRestore();
  });
});
