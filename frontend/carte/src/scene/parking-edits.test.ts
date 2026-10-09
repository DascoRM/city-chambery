import { afterEach, describe, expect, it, vi } from 'vitest';
import { mergeParkingEdits, validPublishedEdits } from './parking-edits';

const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
afterEach(() => warn.mockClear());

describe('retouches publiées par l’API : contrôle par le contrat, une par une', () => {
  it('garde les retouches et ajouts conformes', () => {
    const body = {
      overrides: { 'way/1': { capacity: 149, note: 'Chiffre de la Ville', source: 'BNLS 2024' } },
      added: [{ id: 'custom/parking-du-rosaire', kind: 'surface', pos: [12.5, -4], source: 'vu sur place' }],
      updatedAt: '2026-10-09T00:00:00Z',
    };
    expect(validPublishedEdits(body)).toEqual(body);
    expect(warn).not.toHaveBeenCalled();
  });

  it('ignore une retouche hors contrat sans jeter les autres', () => {
    const edits = validPublishedEdits({
      overrides: {
        'way/1': { capacity: 149, source: 'ok' },
        'way/2': { capacity: 'beaucoup', source: 'x' }, // type faux
        'pas-un-id': { hide: true, source: 'x' }, // identifiant faux
        'way/3': { hide: true }, // sans source
      },
      added: [
        { id: 'custom/ok', kind: 'surface', pos: [1, 2], source: 'x' },
        { id: 'way/9', kind: 'surface', pos: [1, 2], source: 'x' }, // un ajout porte un identifiant custom/…
        { id: 'custom/sans-position', kind: 'surface', source: 'x' },
      ],
      updatedAt: null,
    });
    expect(Object.keys(edits!.overrides)).toEqual(['way/1']);
    expect(edits!.added.map((a) => a.id)).toEqual(['custom/ok']);
    expect(warn).toHaveBeenCalledTimes(5);
  });

  it('refuse une réponse qui n’a pas la forme attendue (page de repli, tableau, vide)', () => {
    for (const body of [null, 'texte', [1, 2], 42]) expect(validPublishedEdits(body)).toBeNull();
    expect(validPublishedEdits({})).toEqual({ overrides: {}, added: [], updatedAt: null });
  });

  it('les retouches publiées l’emportent sur celles du fichier', () => {
    const merged = mergeParkingEdits(
      { overrides: { 'way/1': { capacity: 10 } }, added: [{ id: 'custom/a', kind: 'surface', pos: [0, 0] }] },
      { overrides: { 'way/1': { capacity: 20, source: 'admin' } }, added: [{ id: 'custom/a', kind: 'underground', pos: [1, 1], source: 'admin' }], updatedAt: null },
    );
    expect(merged.overrides?.['way/1']).toEqual({ capacity: 20, source: 'admin' });
    expect(merged.added).toEqual([{ id: 'custom/a', kind: 'underground', pos: [1, 1], source: 'admin' }]);
  });
});
