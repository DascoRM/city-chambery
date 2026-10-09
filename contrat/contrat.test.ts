import { describe, expect, it } from 'vitest';
import { apiError } from './erreurs.js';
import { adminStatusResponse, healthResponse } from './sante.js';
import { addedInput, adminParkingEdits, overrideInput, publishedEdits } from './parkings.js';

describe('contrat : retouches des parkings (requêtes)', () => {
  it('une retouche demande une source et au moins un autre champ ; les textes sont « trimés »', () => {
    expect(overrideInput.parse({ capacity: 149, source: '  BNLS 2024 ' })).toEqual({ capacity: 149, source: 'BNLS 2024' });
    expect(overrideInput.safeParse({ capacity: 149 }).success).toBe(false);
    expect(overrideInput.safeParse({ capacity: 149, source: '   ' }).success).toBe(false);
    expect(overrideInput.safeParse({ source: 'x' }).success).toBe(false);
  });

  it('refuse un champ inconnu et les valeurs absurdes', () => {
    expect(overrideInput.safeParse({ capacity: 149, source: 'x', couleur: 'rouge' }).success).toBe(false);
    for (const capacity of [0, -3, 1.5, 10001]) expect(overrideInput.safeParse({ capacity, source: 'x' }).success).toBe(false);
    expect(overrideInput.safeParse({ kind: 'parking-a-velos', source: 'x' }).success).toBe(false);
    expect(overrideInput.safeParse({ pos: [6000, 0], source: 'x' }).success).toBe(false);
    expect(overrideInput.safeParse({ pos: [1], source: 'x' }).success).toBe(false);
  });

  it('un ajout porte un identifiant custom/…, un type, une position et une source', () => {
    expect(addedInput.safeParse({ id: 'custom/parking-du-rosaire', kind: 'surface', pos: [12.5, -4], source: 'vu sur place' }).success).toBe(true);
    expect(addedInput.safeParse({ id: 'way/1', kind: 'surface', pos: [0, 0], source: 'x' }).success).toBe(false);
    expect(addedInput.safeParse({ id: 'custom/Parking Du', kind: 'surface', pos: [0, 0], source: 'x' }).success).toBe(false);
  });
});

describe('contrat : réponses', () => {
  it('santé et état de la base (l’état « ok » porte les statistiques)', () => {
    expect(healthResponse.safeParse({ ok: true, service: 's', version: 'dev', env: 'development', db: { status: 'non-configuree' }, admin: 'absent' }).success).toBe(true);
    const base = { version: 'abc1234', env: 'preview', node: 'v22', region: null };
    expect(adminStatusResponse.safeParse({ ...base, db: { status: 'erreur' } }).success).toBe(true);
    expect(adminStatusResponse.safeParse({ ...base, db: { status: 'ok', sizeBytes: 1, tables: [], missing: [] } }).success).toBe(true);
    expect(adminStatusResponse.safeParse({ ...base, db: { status: 'ok' } }).success).toBe(false);
  });

  it('les réponses tolèrent un champ en plus (API plus récente), pas un champ manquant', () => {
    const edits = { overrides: { 'way/1': { capacity: 10, source: 's', nouveau: true } }, added: [], updatedAt: null, plus: 1 };
    expect(publishedEdits.safeParse(edits).success).toBe(true);
    expect(publishedEdits.safeParse({ overrides: {}, added: [] }).success).toBe(false);
    expect(adminParkingEdits.safeParse({ overrides: {}, added: [], updatedAt: null, log: [{ id: 1, target: 'way/1', action: 'override', source: null, at: '2026-10-09T00:00:00Z' }] }).success).toBe(true);
  });

  it('erreurs : un code connu ou aucun', () => {
    expect(apiError.safeParse({ error: 'introuvable', code: 'introuvable' }).success).toBe(true);
    expect(apiError.safeParse({ error: 'x', code: 'code-inconnu' }).success).toBe(false);
  });
});
