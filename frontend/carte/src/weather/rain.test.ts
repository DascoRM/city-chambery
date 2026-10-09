import { describe, expect, it } from 'vitest';
import { RAIN_COUNT, SNOW_COUNT, layerMotion, layerWeights, precipMotion, rainLook, snowMotion } from './rain';

const DISTANCES = Array.from({ length: 400 }, (_, i) => 60 + i * 10); // de 60 m à 4 km

describe('pluie : deux nappes en fondu selon la distance (aucun saut)', () => {
  it('en rue, la nappe proche seule ; en vue d’ensemble, la lointaine seule', () => {
    expect(layerWeights(120)).toEqual({ near: 1, far: 0 });
    expect(layerWeights(2850)).toEqual({ near: 0, far: 1 });
  });
  it('entre les deux, un fondu continu où la pluie ne disparaît jamais', () => {
    for (const d of DISTANCES) {
      const w = layerWeights(d);
      expect(w.near + w.far).toBeGreaterThan(0.75);
      const w2 = layerWeights(d + 1); // continuité : pas de saut d'un mètre à l'autre
      expect(Math.abs(w2.near - w.near)).toBeLessThan(0.01);
      expect(Math.abs(w2.far - w.far)).toBeLessThan(0.01);
    }
  });
  it('chute et longueur continues avec la distance, bornées', () => {
    for (const far of [false, true]) {
      for (const d of DISTANCES) {
        const a = layerMotion(far, d), b = layerMotion(far, d + 1);
        expect(Math.abs(b.fall - a.fall)).toBeLessThan(0.2);
        expect(Math.abs(b.len - a.len)).toBeLessThan(0.05);
      }
    }
    expect(layerMotion(false, 120)).toEqual({ fall: 20, len: 3 });
    expect(layerMotion(true, 2850)).toEqual({ fall: 285, len: 25.65 });
  });
});

describe('bruine et averse visiblement différentes', () => {
  it('traînées plus longues et plus marquées quand l’intensité monte', () => {
    const drizzle = rainLook(0.15), shower = rainLook(0.85);
    expect(shower.len / drizzle.len).toBeGreaterThan(1.5);
    expect(shower.opacity).toBeGreaterThan(drizzle.opacity);
  });
  it('nombre de traînées par niveau de qualité (valeurs par défaut, à confirmer sur iPhone)', () => {
    expect(RAIN_COUNT).toEqual({ low: 1200, medium: 2500, high: 5000 });
  });
});

describe('neige : même système, flocons lents (EP009-US007)', () => {
  it('la pluie garde exactement son allure', () => {
    for (const far of [false, true]) for (const d of [120, 700, 2850]) for (const i of [0.15, 0.85]) {
      const m = layerMotion(far, d), k = rainLook(i);
      expect(precipMotion('rain', far, d, i)).toEqual({ fall: m.fall, len: m.len * k.len, sway: 0, opacity: k.opacity });
    }
  });
  it('les flocons tombent au moins cinq fois plus lentement que la pluie, à tous les zooms, et se balancent', () => {
    for (const far of [false, true]) for (const d of DISTANCES) {
      const snow = precipMotion('snow', far, d, 0.6), rain = precipMotion('rain', far, d, 0.6);
      expect(snow.fall * 5).toBeLessThanOrEqual(rain.fall);
      expect(snow.sway).toBeGreaterThan(0);
    }
  });
  it('chute, taille et balancement continus avec la distance (aucun saut au zoom)', () => {
    for (const far of [false, true]) for (const d of DISTANCES) {
      const a = snowMotion(far, d), b = snowMotion(far, d + 1);
      expect(Math.abs(b.fall - a.fall)).toBeLessThan(0.05);
      expect(Math.abs(b.size - a.size)).toBeLessThan(0.01);
      expect(Math.abs(b.sway - a.sway)).toBeLessThan(0.01);
    }
  });
  it('petite neige et grosse neige : flocons plus gros et plus marqués', () => {
    const light = precipMotion('snow', false, 120, 0.2), heavy = precipMotion('snow', false, 120, 1);
    expect(heavy.len).toBeGreaterThan(light.len);
    expect(heavy.opacity).toBeGreaterThan(light.opacity);
  });
  it('nombre de flocons par niveau, dans la fourchette de la spec (800 à 3 000)', () => {
    expect(SNOW_COUNT).toEqual({ low: 800, medium: 1500, high: 3000 });
  });
});
