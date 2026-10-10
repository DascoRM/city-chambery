import { describe, expect, it } from 'vitest';
import { SNOW_COVER, SWAY, WET, WINTER_SNOW, lyingTarget, swayAmount } from './effects';
import { approach, windVisual } from './state';

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
  it('hiver choisi à la main : neige d’ambiance au sol sans neige qui tombe ; une vraie neige peut couvrir davantage', () => {
    expect(lyingTarget(0, false)).toBe(0);
    expect(lyingTarget(0, true)).toBe(WINTER_SNOW);
    expect(lyingTarget(1, true)).toBe(1);
    expect(lyingTarget(0.2, true)).toBe(WINTER_SNOW);
  });
});

describe('arbres qui se balancent au vent (EP009-US009)', () => {
  it('rien par vent faible ou modéré (25 km/h et moins), ni par le vent de beau temps', () => {
    for (const kmh of [0, 10, 20, 25]) expect(swayAmount(windVisual(kmh), 'high', false)).toBe(0);
    expect(swayAmount(0.7, 'high', false)).toBe(0); // content/life.json
  });
  it('au-delà, de plus en plus fort jusqu’à 60 km/h, puis plafonné', () => {
    let prev = 0;
    for (const kmh of [30, 40, 50, 60]) {
      const a = swayAmount(windVisual(kmh), 'medium', false);
      expect(a).toBeGreaterThan(prev);
      prev = a;
    }
    expect(swayAmount(windVisual(60), 'high', false)).toBeCloseTo(SWAY.amp);
    expect(swayAmount(windVisual(150), 'high', false)).toBeCloseTo(SWAY.amp);
  });
  it('rien en qualité basse ni avec le réduit-mouvement', () => {
    expect(swayAmount(windVisual(60), 'low', false)).toBe(0);
    expect(swayAmount(windVisual(60), 'high', true)).toBe(0);
  });
});
