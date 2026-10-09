import { describe, expect, it } from 'vitest';
import { FOG_OFF, displayed, fogColorFor, fogRange } from './fog';

const hex = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
/** Part de brouillard (THREE.Fog linéaire) à une profondeur donnée */
const fogAt = (r: { near: number; far: number }, depth: number) => Math.min(1, Math.max(0, (depth - r.near) / (r.far - r.near)));
const SIZE = 1325, OVERVIEW = 2850, STREET = 120; // socle de 1 325 m ; distances caméra – point regardé (vue d'ensemble, rue)

describe('couleur du brouillard calée sur le fond de page (inverse du rendu des tons ACES)', () => {
  for (const [name, css, exposure] of [['jour', '#f0dfc4', 1.05], ['nuit', '#1d2442', 1.0], ['crépuscule', '#f2a98a', 1.0], ['gris de pluie', '#c9c9c4', 0.95], ['brouillard clair', '#e8e6e1', 1.05]] as const) {
    it(`${name} : la couleur affichée retombe sur ${css}`, () => {
      const target = hex(css);
      displayed(fogColorFor(target, exposure), exposure).forEach((v, i) => expect(Math.abs(v - target[i])).toBeLessThan(1 / 255));
    });
  }
});

describe('portée du brouillard selon l’intensité et la distance', () => {
  it('à 0 : inactif (valeurs du démarrage)', () => {
    expect(fogRange(0, OVERVIEW, SIZE)).toEqual(FOG_OFF);
  });
  it('vue d’ensemble, brouillard type (0,8) : le devant reste lisible, le fond du socle se noie', () => {
    const r = fogRange(0.8, OVERVIEW, SIZE);
    expect(fogAt(r, OVERVIEW - 0.6 * SIZE)).toBeLessThan(0.3); // devant du socle (prototype : 22 %)
    expect(fogAt(r, OVERVIEW + 0.6 * SIZE)).toBe(1); // fond du socle
  });
  it('de près (rue), le brouillard est léger autour du point regardé', () => {
    const r = fogRange(0.8, STREET, SIZE);
    expect(fogAt(r, STREET)).toBeLessThan(0.1);
    expect(fogAt(r, STREET + 0.6 * SIZE)).toBeGreaterThan(0.8); // le bout de la ville, lui, est noyé
  });
  it('plus d’intensité, plus de brouillard partout ; il s’efface sans saut quand l’intensité tend vers 0', () => {
    const depth = OVERVIEW + 0.3 * SIZE;
    const ks = [0.002, 0.05, 0.1, 0.2, 0.35, 0.5, 0.8, 1];
    const f = ks.map((k) => fogAt(fogRange(k, OVERVIEW, SIZE), depth));
    f.slice(1).forEach((v, i) => expect(v).toBeGreaterThanOrEqual(f[i]));
    expect(f[0]).toBeLessThan(0.01);
  });
});
