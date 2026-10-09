import { defineConfig } from 'vitest/config';

/**
 * Tests (`npm test`) : un projet par partie du dépôt (ADR-002), plus l'outillage.
 * - back : l'API (backend/src) sous Node, avec une base PostgreSQL embarquée (PGlite) ;
 * - admin : l'administration React, avec un DOM simulé (happy-dom) ;
 * - contrat : les schémas partagés entre le front et le back (contrat/) ;
 * - carte : les fonctions de la carte qui n'ont pas besoin du navigateur (frontend/carte) ;
 * - outillage : les contrôles du dépôt (scripts/), dont les frontières entre les parties.
 */
export default defineConfig({
  test: {
    projects: [
      // 20 s au lieu de 5 : démarrer PGlite (PostgreSQL en WebAssembly) et rejouer les migrations dépasse 5 s quand la
      // machine est chargée (constaté le 09/10/2026 : échecs « Test timed out in 5000ms » au hasard)
      { test: { name: 'back', include: ['backend/src/**/*.test.ts'], environment: 'node', testTimeout: 20_000 } },
      {
        oxc: { jsx: { runtime: 'automatic' } },
        test: { name: 'admin', include: ['frontend/admin/src/**/*.test.{ts,tsx}'], environment: 'happy-dom' },
      },
      { test: { name: 'contrat', include: ['contrat/**/*.test.ts'], environment: 'node' } },
      { test: { name: 'carte', include: ['frontend/carte/src/**/*.test.ts'], environment: 'node' } },
      { test: { name: 'outillage', include: ['scripts/**/*.test.mjs'], environment: 'node' } },
    ],
  },
});
