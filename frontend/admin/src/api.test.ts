import { describe, expect, it } from 'vitest';
import { errorMessage } from './api';

describe('errorMessage : réponses en erreur traduites pour Dasco', () => {
  it('jeton refusé, trop de tentatives', () => {
    expect(errorMessage(401, { error: 'non autorisé' })).toBe('Jeton refusé.');
    expect(errorMessage(429, { error: 'trop de tentatives' })).toBe('Trop de tentatives : réessaie dans une minute.');
  });

  it('administration non configurée, base non migrée ou absente', () => {
    expect(errorMessage(503, { error: 'administration non configurée', code: 'admin-non-configuree' })).toMatch(/ADMIN_TOKEN/);
    expect(errorMessage(503, { error: 'base non migrée', code: 'migrations-manquantes' })).toMatch(/npm run db:migrate/);
    expect(errorMessage(503, { error: 'base indisponible', code: 'base-indisponible' })).toBe('Base indisponible.');
  });

  it('404 : la plateforme (pas de JSON) se distingue de l’API', () => {
    expect(errorMessage(404, null)).toMatch(/404 de la plateforme/);
    expect(errorMessage(404, { error: 'introuvable' })).toBe("Route de l'API introuvable (404).");
    expect(errorMessage(404, { error: 'introuvable' }, 'Retouche introuvable.')).toBe('Retouche introuvable.');
  });

  it('données refusées : le détail de chaque champ est donné', () => {
    const body = { error: 'données invalides', issues: [{ path: ['source'], message: 'requis' }, { message: 'aucune retouche' }] };
    expect(errorMessage(400, body)).toBe('données invalides (source : requis ; formulaire : aucune retouche)');
    expect(errorMessage(500, null)).toBe('Erreur 500');
  });
});
