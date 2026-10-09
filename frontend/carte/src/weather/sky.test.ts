import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CLEAR_SKY, applyWeatherSky, overcastOf, type SkyValues } from './sky';

/** Valeurs de plein jour de daynight.ts (DAY) : ce que la scène affiche aujourd'hui */
const day = (): SkyValues => ({
  hemiI: 1.1, keyI: 2.4, exposure: 1.05, glow: 1,
  sky: new THREE.Color('#fff4e0'), key: new THREE.Color('#ffe2b8'),
  bg: ['#fdf3e1', '#f0dfc4', '#d9c3a3'].map((c) => new THREE.Color(c)),
});
const snapshot = (v: SkyValues) => ({ ...v, sky: v.sky.toArray(), key: v.key.toArray(), bg: v.bg.map((c) => c.toArray()) });
const saturation = (c: THREE.Color) => Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);

describe('modificateur météo du ciel (EP009-US002)', () => {
  it('beau temps : exactement les valeurs d’aujourd’hui, de jour comme de nuit', () => {
    for (const dayF of [1, 0.4, 0]) {
      for (const w of [CLEAR_SKY, { ...CLEAR_SKY, cloud: 0.05 }, { ...CLEAR_SKY, cloud: 0.2 }]) {
        const v = day();
        const before = snapshot(v);
        applyWeatherSky(v, w, dayF);
        expect(snapshot(v)).toEqual(before);
      }
    }
  });

  it('couvert : soleil voilé (ombres effacées), lumière plus grise, fond désaturé, exposition un peu plus basse', () => {
    const v = day(), ref = day();
    applyWeatherSky(v, { ...CLEAR_SKY, cloud: 0.95 }, 1);
    expect(v.keyI).toBeLessThan(ref.keyI * 0.3);
    expect(v.keyI).toBeGreaterThan(0); // jamais éteint (pas de bascule d'ombre)
    expect(v.hemiI).toBeGreaterThan(ref.hemiI);
    expect(saturation(v.sky)).toBeLessThan(saturation(ref.sky));
    v.bg.forEach((c, i) => expect(saturation(c)).toBeLessThan(saturation(ref.bg[i])));
    expect(v.exposure).toBeLessThan(ref.exposure);
  });

  it('la nuit, seuls la lune et le fond changent', () => {
    const v = day(), ref = day();
    applyWeatherSky(v, { ...CLEAR_SKY, cloud: 1 }, 0);
    expect(v.keyI).toBeLessThan(ref.keyI);
    expect([v.hemiI, v.exposure, v.sky.toArray(), v.key.toArray()]).toEqual([ref.hemiI, ref.exposure, ref.sky.toArray(), ref.key.toArray()]);
  });

  it('part de ciel couvert bornée à 0..1, plus forte quand il pleut ou qu’il y a du brouillard', () => {
    expect(overcastOf(CLEAR_SKY)).toBe(0);
    expect(overcastOf({ cloud: 1, rain: 1, snow: 1, fog: 1, storm: 1 })).toBe(1);
    expect(overcastOf({ ...CLEAR_SKY, cloud: 0.45 })).toBeGreaterThan(0);
    expect(overcastOf({ ...CLEAR_SKY, cloud: 0.45 })).toBeLessThan(overcastOf({ ...CLEAR_SKY, cloud: 0.95 }));
    expect(overcastOf({ ...CLEAR_SKY, rain: 0.5 })).toBeCloseTo(0.45);
  });
});
