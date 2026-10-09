import { describe, expect, it } from 'vitest';
import { initialQuality } from './quality';

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
