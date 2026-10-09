import { describe, expect, it } from 'vitest';
import { WEATHER_PRESETS, type WeatherCondition, type WeatherResponse } from '../../../../contrat/meteo.js';
import {
  blendLook, chipOf, clearLook, isLive, panelOf, presetLook, readingFromResponse, resolveWeather, validWeather, weatherFromUrl,
  windTowards, windVisual, windWords, type Reading, type WeatherInputs, type WeatherLook,
} from './state';

const WIND = { towards: 30, speed: 0.7 }; // content/life.json (smoke.wind)
const CLEAR = clearLook(WIND);
const NOW = Date.parse('2026-10-09T08:06:00Z'); // 10 h 06 à Chambéry
const reading = (o: Partial<Reading> = {}): Reading => ({
  condition: 'rain', look: presetLook('rain'), temperatureC: 12.6, forced: false, forcedUntilMs: null, stale: false,
  observedAtMs: Date.parse('2026-10-09T08:00:00Z'), model: 'icon_seamless', ...o,
});
const inputs = (o: Partial<WeatherInputs> = {}): WeatherInputs => ({ enabled: true, url: null, debug: null, api: 'ok', reading: reading(), live: true, ...o });

describe('?weather= : mêmes valeurs types et mêmes règles que le forçage de l’administration', () => {
  it('reprend WEATHER_PRESETS du contrat, vent par défaut 10 km/h d’ouest', () => {
    for (const c of Object.keys(WEATHER_PRESETS) as WeatherCondition[]) {
      const p = WEATHER_PRESETS[c], l = weatherFromUrl(`?weather=${c}`)!.look;
      expect(l).toMatchObject({ cloud: p.cloudCover, rain: p.rainIntensity, snow: p.snowIntensity, fog: p.fog, storm: p.thunder ? 1 : 0 });
      expect(l.windSpeed).toBe(windVisual(10));
      expect(l.windTowards).toBe(0); // d'ouest → vers l'est
    }
  });
  it('intensity remplace l’intensité principale (bornée), sauf pour la pluie et neige et le ciel sec (comme le back)', () => {
    expect(weatherFromUrl('?weather=rain&intensity=0.8')!.look.rain).toBe(0.8);
    expect(weatherFromUrl('?weather=thunder&intensity=0.3')!.look.rain).toBe(0.3);
    expect(weatherFromUrl('?weather=snow&intensity=4')!.look.snow).toBe(1);
    expect(weatherFromUrl('?weather=fog&intensity=0.3')!.look.fog).toBe(0.3);
    expect(weatherFromUrl('?weather=sleet&intensity=0.9')!.look).toMatchObject({ rain: 0.3, snow: 0.3 });
    expect(weatherFromUrl('?weather=cloudy&intensity=0.1')!.look.cloud).toBe(WEATHER_PRESETS.cloudy.cloudCover);
  });
  it('vent et température facultatifs ; neige au-dessus de 2 °C montrée en pluie (règle 6)', () => {
    expect(weatherFromUrl('?weather=rain&wind=60&windfrom=200')!.look).toMatchObject({ windSpeed: windVisual(60), windTowards: windTowards(200) });
    expect(weatherFromUrl('?weather=snow&temp=4')!.look).toMatchObject({ snow: 0, rain: WEATHER_PRESETS.snow.snowIntensity });
    expect(weatherFromUrl('?weather=snow&temp=0')!.look).toMatchObject({ snow: WEATHER_PRESETS.snow.snowIntensity, rain: 0 });
    expect(weatherFromUrl('?weather=rain&intensity=&wind=abc')!.look).toEqual(weatherFromUrl('?weather=rain')!.look);
  });
  it('absente ou inconnue → null', () => {
    expect(weatherFromUrl('?debug')).toBeNull();
    expect(weatherFromUrl('?weather=tornade')).toBeNull();
    expect(weatherFromUrl('?weather=')).toBeNull();
  });
  it('vent : d’où il vient → vers où il va (0 = est, 90 = nord)', () => {
    expect([windTowards(0), windTowards(90), windTowards(180), windTowards(270), windTowards(331)]).toEqual([270, 180, 90, 0, 299]);
  });
});

describe('ce que montre la carte (priorités, Direct ou simulée)', () => {
  it('adresse › debug › administration › direct', () => {
    const url = weatherFromUrl('?weather=snow')!;
    expect(resolveWeather(inputs({ url, debug: { condition: 'fog', look: presetLook('fog') } }), NOW, CLEAR).status).toBe('url');
    expect(resolveWeather(inputs({ debug: { condition: 'fog', look: presetLook('fog') } }), NOW, CLEAR).status).toBe('debug');
    expect(resolveWeather(inputs({ reading: reading({ forced: true, temperatureC: null }) }), NOW, CLEAR).status).toBe('admin');
    expect(resolveWeather(inputs(), NOW, CLEAR)).toMatchObject({ status: 'live', condition: 'rain' });
  });
  it('préférence « météo désactivée » : beau temps, même avec ?weather=', () => {
    expect(resolveWeather(inputs({ enabled: false, url: weatherFromUrl('?weather=snow') }), NOW, CLEAR)).toMatchObject({ status: 'off', target: CLEAR });
  });
  it('hors Direct : beau temps simulé ; une météo forcée (adresse, démo) reste à toute heure', () => {
    expect(resolveWeather(inputs({ live: false }), NOW, CLEAR)).toMatchObject({ status: 'simulated', target: CLEAR });
    expect(resolveWeather(inputs({ live: false, url: weatherFromUrl('?weather=fog') }), NOW, CLEAR).status).toBe('url');
    expect(resolveWeather(inputs({ live: false, reading: reading({ forced: true }) }), NOW, CLEAR).status).toBe('admin');
    expect(isLive({ mode: 'live', season: 'auto' })).toBe(true);
    expect(isLive({ mode: 'manual', season: 'auto' })).toBe(false);
    expect(isLive({ mode: 'playing', season: 'auto' })).toBe(false);
    expect(isLive({ mode: 'live', season: 'winter' })).toBe(false);
  });
  it('sans API, coupée, en attente, indisponible : ciel par défaut', () => {
    expect(resolveWeather(inputs({ api: 'none', reading: null }), NOW, CLEAR)).toMatchObject({ status: 'none', target: CLEAR });
    expect(resolveWeather(inputs({ api: 'disabled', reading: null, live: false }), NOW, CLEAR).status).toBe('disabled');
    expect(resolveWeather(inputs({ api: 'waiting', reading: null }), NOW, CLEAR).status).toBe('waiting');
    expect(resolveWeather(inputs({ api: 'unavailable', reading: null }), NOW, CLEAR)).toMatchObject({ status: 'unavailable', target: CLEAR });
  });
  it('relevé de plus d’une heure : « ancien » ; de plus de 3 h : jamais montré (règle 1)', () => {
    const at = reading().observedAtMs;
    expect(resolveWeather(inputs({ reading: reading({ stale: true }) }), NOW, CLEAR).status).toBe('stale');
    expect(resolveWeather(inputs(), at + 61 * 60000, CLEAR).status).toBe('stale');
    expect(resolveWeather(inputs(), at + 3 * 3600000, CLEAR).status).toBe('stale');
    expect(resolveWeather(inputs(), at + 3 * 3600000 + 1, CLEAR)).toMatchObject({ status: 'unavailable', target: CLEAR });
  });
});

describe('puce et panneau : rien d’inventé', () => {
  const at = (o: Partial<WeatherInputs>) => resolveWeather(inputs(o), NOW, CLEAR);
  it('direct : condition, température, « modèle ICON, 10 h 00 (il y a 6 min) », jamais « observé »', () => {
    expect(chipOf(at({}), false)).toEqual({ icon: '🌧️', text: '13 °C', label: 'Météo : Pluie, 13 °C, direct' });
    const p = panelOf(at({}), NOW);
    expect(p).toMatchObject({ title: 'Pluie, 13 °C', lines: ['modèle ICON, 10 h 00 (il y a 6 min)'], backToLive: false });
    expect(JSON.stringify(p)).not.toMatch(/observ/i);
  });
  it('météo forcée (adresse, démo) : aucune température', () => {
    for (const s of [at({ url: weatherFromUrl('?weather=rain&temp=12') }), at({ reading: reading({ forced: true, temperatureC: null }) })]) {
      expect(JSON.stringify([chipOf(s, false), panelOf(s, NOW)])).not.toMatch(/°C/);
    }
  });
  it('ancien relevé : « Ancien relevé (il y a 1 h 10) »', () => {
    const p = panelOf(resolveWeather(inputs(), reading().observedAtMs + 70 * 60000, CLEAR), NOW + 64 * 60000);
    expect(p.lines[0]).toBe('Ancien relevé (il y a 1 h 10) : modèle ICON, 10 h 00.');
  });
  it('simulée : beau temps et « Revenir au direct » ; la nuit, la lune', () => {
    const s = at({ live: false });
    expect(panelOf(s, NOW).backToLive).toBe(true);
    expect(chipOf(s, true)).toMatchObject({ icon: '🌙', text: 'Simulée' });
  });
  it('puce masquée sans API ou pendant la première lecture', () => {
    expect(chipOf(at({ api: 'none', reading: null }), false)).toBeNull();
    expect(chipOf(at({ api: 'waiting', reading: null }), false)).toBeNull();
    expect(chipOf(at({ api: 'unavailable', reading: null }), false)).toMatchObject({ text: 'Indisponible', off: true });
  });
});

describe('fondu (R3 d’US002)', () => {
  it('converge sans dépasser, quelle que soit la cadence, puis plus rien ne bouge', () => {
    for (const fps of [20, 30, 60, 144]) {
      const cur: WeatherLook = { ...CLEAR }, target = presetLook('rain');
      let t = 0, prev = 0;
      while (t < 60) {
        blendLook(cur, target, 1 / fps);
        t += 1 / fps;
        expect(cur.rain).toBeGreaterThanOrEqual(prev);
        expect(cur.rain).toBeLessThanOrEqual(target.rain);
        prev = cur.rain;
      }
      expect(cur).toEqual(target); // atteint exactement
      expect(blendLook(cur, target, 1 / fps)).toBe(false);
    }
  });
  it('mi-chemin en ≈ 2 s pour le ciel (tau 3 s) ; le vent tourne par le plus court chemin', () => {
    const cur: WeatherLook = { ...CLEAR, windTowards: 350 }, target: WeatherLook = { ...CLEAR, cloud: 1, windTowards: 10 };
    blendLook(cur, target, 2.08);
    expect(cur.cloud).toBeCloseTo(0.5, 1);
    expect(cur.windTowards > 350 || cur.windTowards < 10).toBe(true);
  });
});

describe('réponse du back (US004) → relevé de la carte', () => {
  const body: WeatherResponse = {
    v: 1, source: 'open-meteo', model: 'icon_seamless', observedAt: '2026-10-09T08:00:00Z', fetchedAt: '2026-10-09T08:01:00Z',
    stale: false, forced: false, condition: 'rain', temperatureC: 12.6, cloudCover: 1, precipMmH: 2, rainIntensity: 0.5,
    snowIntensity: 0, windKmh: 11.9, windGustKmh: 23.8, windFromDeg: 331, visibilityM: 22940, fog: 0, thunder: false,
    attribution: { text: 'Météo : Open-Meteo.com, modèle ICON du DWD (données adaptées pour le diorama)', url: 'https://open-meteo.com/', licence: 'CC BY 4.0', licenceUrl: 'https://creativecommons.org/licenses/by/4.0/' },
  };
  it('garde les intensités du back, convertit le vent, garde le crédit', () => {
    const r = readingFromResponse(body);
    expect(r.look).toMatchObject({ cloud: 1, rain: 0.5, snow: 0, fog: 0, storm: 0, windTowards: 299 });
    expect(r).toMatchObject({ condition: 'rain', temperatureC: 12.6, forced: false, observedAtMs: Date.parse(body.observedAt) });
    expect(r.attribution?.licence).toBe('CC BY 4.0');
  });
  it('neige annoncée à plus de 2 °C : montrée en pluie (règle 6) ; à 0 °C : neige', () => {
    expect(readingFromResponse({ ...body, condition: 'snow', temperatureC: 4, rainIntensity: 0, snowIntensity: 0.6 }).look).toMatchObject({ rain: 0.6, snow: 0 });
    expect(readingFromResponse({ ...body, condition: 'snow', temperatureC: 0, rainIntensity: 0, snowIntensity: 0.6 }).look).toMatchObject({ snow: 0.6, rain: 0 });
  });
  it('météo forcée par l’administration : ni température ni crédit, « Météo forcée (démo) », valable jusqu’à sa fin', () => {
    const forced = readingFromResponse({ ...body, source: 'admin', model: null, forced: true, forcedUntil: '2026-10-09T09:00:00Z', temperatureC: 14, attribution: null });
    expect(forced).toMatchObject({ temperatureC: null, attribution: null, forced: true });
    const s = resolveWeather(inputs({ reading: forced }), NOW, CLEAR);
    expect(chipOf(s, false)).toMatchObject({ text: 'Démo', label: 'Météo forcée (démo) : Pluie' });
    expect(panelOf(s, NOW)).toMatchObject({ title: 'Pluie', lines: ['Météo forcée (démo) par l’administration, jusqu’à 11 h 00.'] });
    expect(resolveWeather(inputs({ reading: forced }), Date.parse('2026-10-09T09:00:01Z'), CLEAR).status).toBe('unavailable');
  });
  it('panneau en direct : relevé, vent en mots, crédit (texte, lien, licence)', () => {
    const p = panelOf(resolveWeather(inputs({ reading: readingFromResponse(body) }), NOW, CLEAR), NOW);
    expect(p.lines).toEqual(['modèle ICON, 10 h 00 (il y a 6 min)', 'Vent du nord-ouest, 12 km/h (rafales 24 km/h)']);
    expect(p.credit?.url).toBe('https://open-meteo.com/');
  });
  it('vent en mots', () => {
    expect(windWords({ kmh: 14.1, gustKmh: 29.9, fromDeg: 257 })).toBe('Vent d’ouest, 14 km/h (rafales 30 km/h)');
    expect(windWords({ kmh: 8, gustKmh: 12, fromDeg: 180 })).toBe('Vent du sud, 8 km/h');
    expect(windWords({ kmh: 1, gustKmh: null, fromDeg: 90 })).toBe('Vent calme');
  });
  it('validation : contrat (objet ouvert), relevé de moins de 3 h ; sinon null, sans exception', () => {
    expect(validWeather({ ...body, nouveau: 1 }, NOW)).not.toBeNull();
    for (const b of [undefined, 'texte', { ...body, v: 2 }, { ...body, cloudCover: 7 }, { ...body, condition: 'grele' }, { ...body, observedAt: 'hier' }]) {
      expect(validWeather(b, NOW)).toBeNull();
    }
    expect(validWeather(body, Date.parse('2026-10-09T11:00:00Z'))).not.toBeNull();
    expect(validWeather(body, Date.parse('2026-10-09T11:00:01Z'))).toBeNull();
  });
});
