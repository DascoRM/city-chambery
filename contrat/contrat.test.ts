import { describe, expect, it } from 'vitest';
import { apiError } from './erreurs.js';
import { adminStatusResponse, healthResponse } from './sante.js';
import { addedInput, adminParkingEdits, overrideInput, publishedEdits } from './parkings.js';
import { WEATHER_CONDITION_FR, WEATHER_PRESETS, weatherCondition, weatherOverrideInput, weatherResponse } from './meteo.js';

describe('contrat : retouches des parkings (requêtes)', () => {
  it('une retouche demande une source et au moins un autre champ ; les textes sont « trimés »', () => {
    expect(overrideInput.parse({ capacity: 149, source: '  BNLS 2024 ' })).toEqual({ capacity: 149, source: 'BNLS 2024' });
    expect(overrideInput.safeParse({ capacity: 149 }).success).toBe(false);
    expect(overrideInput.safeParse({ capacity: 149, source: '   ' }).success).toBe(false);
    expect(overrideInput.safeParse({ source: 'x' }).success).toBe(false);
  });

  it('refuse un champ inconnu et les valeurs absurdes', () => {
    expect(overrideInput.safeParse({ capacity: 149, source: 'x', couleur: 'rouge' }).success).toBe(false);
    for (const capacity of [0, -3, 1.5, 10001]) expect(overrideInput.safeParse({ capacity, source: 'x' }).success).toBe(false);
    expect(overrideInput.safeParse({ kind: 'parking-a-velos', source: 'x' }).success).toBe(false);
    expect(overrideInput.safeParse({ pos: [6000, 0], source: 'x' }).success).toBe(false);
    expect(overrideInput.safeParse({ pos: [1], source: 'x' }).success).toBe(false);
  });

  it('un ajout porte un identifiant custom/…, un type, une position et une source', () => {
    expect(addedInput.safeParse({ id: 'custom/parking-du-rosaire', kind: 'surface', pos: [12.5, -4], source: 'vu sur place' }).success).toBe(true);
    expect(addedInput.safeParse({ id: 'way/1', kind: 'surface', pos: [0, 0], source: 'x' }).success).toBe(false);
    expect(addedInput.safeParse({ id: 'custom/Parking Du', kind: 'surface', pos: [0, 0], source: 'x' }).success).toBe(false);
  });
});

describe('contrat : réponses', () => {
  it('santé et état de la base (l’état « ok » porte les statistiques)', () => {
    expect(healthResponse.safeParse({ ok: true, service: 's', version: 'dev', env: 'development', db: { status: 'non-configuree' }, admin: 'absent' }).success).toBe(true);
    const base = { version: 'abc1234', env: 'preview', node: 'v22', region: null };
    expect(adminStatusResponse.safeParse({ ...base, db: { status: 'erreur' } }).success).toBe(true);
    expect(adminStatusResponse.safeParse({ ...base, db: { status: 'ok', sizeBytes: 1, tables: [], missing: [] } }).success).toBe(true);
    expect(adminStatusResponse.safeParse({ ...base, db: { status: 'ok' } }).success).toBe(false);
  });

  it('les réponses tolèrent un champ en plus (API plus récente), pas un champ manquant', () => {
    const edits = { overrides: { 'way/1': { capacity: 10, source: 's', nouveau: true } }, added: [], updatedAt: null, plus: 1 };
    expect(publishedEdits.safeParse(edits).success).toBe(true);
    expect(publishedEdits.safeParse({ overrides: {}, added: [] }).success).toBe(false);
    expect(adminParkingEdits.safeParse({ overrides: {}, added: [], updatedAt: null, log: [{ id: 1, target: 'way/1', action: 'override', source: null, at: '2026-10-09T00:00:00Z' }] }).success).toBe(true);
  });

  it('erreurs : un code connu ou aucun', () => {
    expect(apiError.safeParse({ error: 'introuvable', code: 'introuvable' }).success).toBe(true);
    expect(apiError.safeParse({ error: 'x', code: 'code-inconnu' }).success).toBe(false);
  });
});

describe('contrat : météo (EP009)', () => {
  const ok = {
    v: 1, source: 'open-meteo', model: 'icon_seamless', observedAt: '2026-10-09T10:00:00.000Z', fetchedAt: '2026-10-09T10:05:22.000Z',
    stale: false, forced: false, condition: 'partly', temperatureC: 12.8, cloudCover: 0.71, precipMmH: 0, rainIntensity: 0, snowIntensity: 0,
    windKmh: 14.1, windGustKmh: 29.9, windFromDeg: 257, visibilityM: 33040, fog: 0, thunder: false,
    attribution: { text: 'Météo : Open-Meteo.com', url: 'https://open-meteo.com/', licence: 'CC BY 4.0', licenceUrl: 'https://creativecommons.org/licenses/by/4.0/' },
  };

  it('réponse publique : tolère un champ en plus, refuse une intensité hors 0..1, une condition inconnue, une date illisible, v: 2', () => {
    expect(weatherResponse.safeParse(ok).success).toBe(true);
    expect(weatherResponse.safeParse({ ...ok, nouveau: 1 }).success).toBe(true);
    expect(weatherResponse.safeParse({ ...ok, rainIntensity: 1.2 }).success).toBe(false);
    expect(weatherResponse.safeParse({ ...ok, condition: 'tornade' }).success).toBe(false);
    expect(weatherResponse.safeParse({ ...ok, observedAt: 'hier' }).success).toBe(false);
    expect(weatherResponse.safeParse({ ...ok, v: 2 }).success).toBe(false);
  });

  it('météo forcée : sans température ni crédit', () => {
    expect(weatherResponse.safeParse({ ...ok, source: 'admin', model: null, forced: true, forcedUntil: '2026-10-09T11:00:00.000Z', temperatureC: null, attribution: null }).success).toBe(true);
  });

  it('forçage : condition obligatoire pour « forcee », durée de 5 min à 6 h, aucun champ inconnu', () => {
    expect(weatherOverrideInput.safeParse({ mode: 'forcee', condition: 'snow', minutes: 60 }).success).toBe(true);
    expect(weatherOverrideInput.safeParse({ mode: 'coupee', minutes: 30 }).success).toBe(true);
    expect(weatherOverrideInput.safeParse({ mode: 'forcee', minutes: 60 }).success).toBe(false);
    expect(weatherOverrideInput.safeParse({ mode: 'forcee', condition: 'snow', minutes: 2 }).success).toBe(false);
    expect(weatherOverrideInput.safeParse({ mode: 'forcee', condition: 'snow', minutes: 60, lat: 48.8 }).success).toBe(false);
  });

  it('chaque condition a un libellé français et des valeurs types (les mêmes pour ?weather= et le forçage)', () => {
    for (const c of weatherCondition.options) {
      expect(WEATHER_CONDITION_FR[c], c).toBeTruthy();
      expect(WEATHER_PRESETS[c], c).toBeDefined();
    }
  });
});
