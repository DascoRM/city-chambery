import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LIGHTNING, boltPoints, createLightning, flashOf, salvo, type Strike } from './lightning';

/** Tirage reproductible (les tests ne dépendent pas de Math.random) */
const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

/** Fait tourner le planificateur `s` secondes à `fps` images/s ; renvoie les éclairs vus (début) et le flash le plus fort */
function run(s: number, fps: number, active: (t: number) => boolean, rng = seeded(7)) {
  const l = createLightning(rng), starts: number[] = [];
  let max = 0, t = 0;
  for (let i = 0; i < s * fps; i++) {
    t += 1 / fps;
    const r = l.step(1 / fps, active(t));
    if (r.start) starts.push(t);
    max = Math.max(max, r.flash);
  }
  return { starts, max };
}

describe('éclairs : planificateur (EP009-US008)', () => {
  it('1 000 salves : 1 à 3 éclairs, au moins 0,4 s entre deux, amplitude et décroissance bornées, trait sur le premier', () => {
    const rng = seeded(42);
    for (let k = 0; k < 1000; k++) {
      const s = salvo(k * 30, rng);
      expect(s.length).toBeGreaterThanOrEqual(1);
      expect(s.length).toBeLessThanOrEqual(3);
      s.forEach((x, i) => {
        expect(x.amp).toBeGreaterThanOrEqual(0.3);
        expect(x.amp).toBeLessThanOrEqual(0.6);
        expect(x.decay).toBeGreaterThanOrEqual(0.12);
        expect(x.decay).toBeLessThanOrEqual(0.25);
        expect(x.bolt).toBe(i === 0);
        if (i) expect(x.at - s[i - 1].at).toBeGreaterThanOrEqual(0.4);
      });
    }
  });
  it('jamais plus de 3 éclairs par seconde, et 6 à 20 s entre deux salves (4 heures d’orage, à 30, 60 et 144 img/s)', () => {
    for (const fps of [30, 60, 144]) {
      const { starts } = run(4 * 3600, fps, () => true, seeded(fps));
      expect(starts.length).toBeGreaterThan(1000);
      for (let i = 3; i < starts.length; i++) expect(starts[i] - starts[i - 3]).toBeGreaterThan(1); // 4 éclairs prennent plus d'une seconde
      const gaps = starts.slice(1).map((t, i) => t - starts[i]);
      for (const g of gaps) expect(g >= 0.4 - 1 / fps && (g <= 0.9 + 1 / fps || (g >= 6 && g <= 20 + 1.5 / fps))).toBe(true);
      expect(gaps.filter((g) => g >= 6).length).toBeGreaterThan(500);
    }
  });
  it('chaque éclair est une seule impulsion : elle monte d’un coup puis décroît jusqu’à 0, sans repartir', () => {
    const s: Strike = { at: 1, amp: 0.5, decay: 0.2, bolt: true };
    expect(flashOf(s, 0.99)).toBe(0);
    expect(flashOf(s, 1)).toBe(0.5);
    let prev = 0.5;
    for (let t = 1.01; t < 1.2; t += 0.01) { const f = flashOf(s, t); expect(f).toBeLessThanOrEqual(prev); prev = f; }
    expect(flashOf(s, 1.2)).toBe(0);
  });
  it('réduit-mouvement (ou pas d’orage) : aucun éclair, jamais ; coupé net si l’orage s’en va pendant un éclair', () => {
    expect(run(3600, 60, () => false)).toEqual({ starts: [], max: 0 });
    const l = createLightning(seeded(3));
    let on = 0;
    for (let i = 0; i < 60 * 30 && !on; i++) on = l.step(1 / 60, true).flash;
    expect(on).toBeGreaterThan(0);
    expect(l.step(1 / 60, false)).toEqual({ flash: 0, start: null });
  });
  it('la première salve arrive 2 à 6 s après l’orage', () => {
    for (let seed = 1; seed < 50; seed++) {
      const { starts } = run(30, 60, () => true, seeded(seed));
      expect(starts[0]).toBeGreaterThanOrEqual(LIGHTNING.first[0]);
      expect(starts[0]).toBeLessThanOrEqual(LIGHTNING.first[1] + 2 / 60);
    }
  });
});

describe('trait d’éclair', () => {
  it('32 segments du haut jusqu’au pied, qui s’écartent peu de la verticale', () => {
    const top = new THREE.Vector3(0, 900, 0), bottom = new THREE.Vector3(0, 0, 0);
    const pts = boltPoints(top, bottom, new THREE.Vector3(1, 0, 0), seeded(5));
    expect(pts.length).toBe(33);
    expect(pts[0].equals(top) && pts[32].equals(bottom)).toBe(true);
    for (const p of pts) expect(Math.abs(p.x)).toBeLessThan(900 * 0.2);
  });
});
