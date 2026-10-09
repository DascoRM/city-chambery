import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadWeatherPref, saveWeatherPref } from './weather-pref';

/** Stockage du navigateur simulé (l'environnement des tests est Node) */
const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};
afterEach(() => vi.unstubAllGlobals());

describe('préférences météo du visiteur (EP009)', () => {
  it('par défaut : météo affichée, effets normaux', () => {
    vi.stubGlobal('localStorage', memory());
    expect(loadWeatherPref()).toEqual({ enabled: true, reduced: false });
  });
  it('garde le choix du visiteur ; revenir aux valeurs par défaut efface la clé', () => {
    const s = memory();
    vi.stubGlobal('localStorage', s);
    saveWeatherPref({ enabled: false, reduced: true });
    expect(loadWeatherPref()).toEqual({ enabled: false, reduced: true });
    saveWeatherPref({ enabled: true, reduced: false });
    expect(s.m.size).toBe(0);
  });
  it('stockage bloqué ou valeur abîmée : valeurs par défaut, sans exception', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('bloqué'); }, setItem: () => { throw new Error('bloqué'); }, removeItem: () => { throw new Error('bloqué'); } });
    expect(loadWeatherPref()).toEqual({ enabled: true, reduced: false });
    expect(() => saveWeatherPref({ enabled: false, reduced: false })).not.toThrow();
    const s = memory();
    s.setItem('chambery-diorama:meteo:v1', '{pas du json');
    vi.stubGlobal('localStorage', s);
    expect(loadWeatherPref()).toEqual({ enabled: true, reduced: false });
  });
});
