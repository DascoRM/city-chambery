import { describe, expect, it, vi } from 'vitest';
import { createAdaptiveResolution, initialQuality } from './quality';

describe('niveau de qualité (EP009-US001) : une seule règle pour toute la carte', () => {
  it('ordinateur → high, même avec peu de mémoire annoncée', () => {
    expect(initialQuality({ coarse: false, width: 1440 })).toBe('high');
    expect(initialQuality({ coarse: false, width: 1440, deviceMemory: 2 })).toBe('high');
  });
  it('téléphone ou tablette (pointeur grossier, ou fenêtre étroite) → medium', () => {
    expect(initialQuality({ coarse: true, width: 390 })).toBe('medium');
    expect(initialQuality({ coarse: true, width: 1024 })).toBe('medium'); // tablette
    expect(initialQuality({ coarse: false, width: 650 })).toBe('medium'); // fenêtre étroite (même règle que les passants avant US001)
    expect(initialQuality({ coarse: true, width: 390, deviceMemory: 4 })).toBe('medium');
  });
  it('téléphone avec 3 Go de mémoire ou moins (Chrome Android) → low', () => {
    expect(initialQuality({ coarse: true, width: 390, deviceMemory: 3 })).toBe('low');
    expect(initialQuality({ coarse: true, width: 390, deviceMemory: 0.5 })).toBe('low');
  });
  it('?quality= force le niveau ; une valeur inconnue est ignorée', () => {
    expect(initialQuality({ coarse: true, width: 390, param: 'high' })).toBe('high');
    expect(initialQuality({ coarse: false, width: 1440, param: 'low' })).toBe('low');
    expect(initialQuality({ coarse: false, width: 1440, param: 'ultra' })).toBe('high');
    expect(initialQuality({ coarse: true, width: 390, param: '' })).toBe('medium');
  });
});

describe('mesures de cadence transmises à la météo (règle de dégradation de la pluie, EP009-US005)', () => {
  it('toutes les 2 s en mouvement : images/s, et densité de pixels déjà au minimum ou non', () => {
    vi.stubGlobal('window', { devicePixelRatio: 2 });
    const q = createAdaptiveResolution({ setPixelRatio: vi.fn() } as never, () => {});
    const seen: [number, boolean][] = [];
    q.onSample((fps, atMin) => seen.push([Math.round(fps), atMin]));
    for (let i = 0; i < 96; i++) q.update(1 / 16, true); // 6 s à 16 img/s : la densité baisse de 1,5 à 1 en deux mesures
    for (let i = 0; i < 64; i++) q.update(1 / 16, false); // repos : pas de mesure
    expect(seen).toEqual([[16, false], [16, false], [16, true]]);
    vi.unstubAllGlobals();
  });
});
