import { describe, expect, it } from 'vitest';
import { SNOW_COVER, WET } from './effects';
import { approach } from './state';

/** Neige au sol après `s` secondes d'une neige constante (ou de fonte, si `snow` vaut 0), par pas d'une image à 60 img/s */
function lying(from: number, snow: number, s: number) {
  let v = from;
  const target = Math.min(1, snow * SNOW_COVER.perSnow);
  for (let t = 0; t < s * 60; t++) v = approach(v, target, 1 / 60, target > v ? SNOW_COVER.tauUp : SNOW_COVER.tauDown);
  return v;
}

describe('neige au sol : s’accumule puis fond, comme le sol mouillé (EP009-US007)', () => {
  it('la neige type (0,6) blanchit presque tout en une à deux minutes', () => {
    expect(lying(0, 0.6, 30)).toBeGreaterThan(0.55);
    expect(lying(0, 0.6, 90)).toBeGreaterThan(0.9);
  });
  it('une petite neige ne couvre qu’en partie, même longtemps', () => {
    expect(lying(0, 0.2, 600)).toBeCloseTo(0.32, 2);
  });
  it('la fonte est bien plus lente que l’accumulation, et plus lente que le séchage', () => {
    expect(lying(1, 0, 60)).toBeGreaterThan(0.8);
    expect(lying(1, 0, 900)).toBeLessThan(0.1);
    expect(SNOW_COVER.tauDown).toBeGreaterThan(WET.tauDown);
  });
});
