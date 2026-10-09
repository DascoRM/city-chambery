import { defineConfig } from 'vitest/config';

/**
 * Tests (`npm test`) : deux projets séparés, comme les deux parties du dépôt (ADR-002).
 * - api : l'API sous Node, avec une base PostgreSQL embarquée (PGlite) ;
 * - admin : l'administration React, avec un DOM simulé (happy-dom).
 */
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'api', include: ['server/**/*.test.ts'], environment: 'node' } },
      {
        oxc: { jsx: { runtime: 'automatic' } },
        test: { name: 'admin', include: ['frontend/admin/src/**/*.test.{ts,tsx}'], environment: 'happy-dom' },
      },
    ],
  },
});
