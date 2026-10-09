import { defineConfig } from 'drizzle-kit';

/** Génération des migrations : `npm run db:generate` (n'a pas besoin de base) ; application : `npm run db:migrate` */
export default defineConfig({
  dialect: 'postgresql',
  schema: './backend/src/db/schema.ts',
  out: './backend/src/db/migrations',
});
