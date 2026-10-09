import { describe, expect, it } from 'vitest';
import { FULL_BUDGET, nextBudget, type RainBudget } from './budget';

const run = (samples: [number, boolean][], from: RainBudget = FULL_BUDGET) => samples.reduce((b, [fps, atMin]) => nextBudget(b, fps, atMin), from);

describe('dégradation des précipitations (règle 8)', () => {
  it('deux mesures de suite sous 24 img/s, densité de pixels au minimum : moitié des gouttes, puis plus rien', () => {
    expect(run([[20, true], [20, true]]).level).toBe(0.5);
    expect(run([[20, true], [20, true], [19, true], [19, true]]).level).toBe(0);
  });
  it('une seule mesure lente, ou une mesure normale entre deux : rien', () => {
    expect(run([[20, true]]).level).toBe(1);
    expect(run([[20, true], [30, true], [20, true]]).level).toBe(1);
  });
  it('la densité de pixels peut encore baisser : la pluie n’est pas touchée', () => {
    expect(run([[15, false], [15, false], [15, false]]).level).toBe(1);
  });
  it('l’iPhone à 30 img/s sans météo n’est jamais touché ; jamais de remontée', () => {
    expect(run(Array.from({ length: 20 }, () => [30, true] as [number, boolean])).level).toBe(1);
    const cut = run([[20, true], [20, true], [20, true], [20, true]]);
    expect(run([[60, true], [60, true], [60, false]], cut).level).toBe(0);
  });
});
