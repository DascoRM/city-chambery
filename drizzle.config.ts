import { defineConfig } from 'drizzle-kit';

/** Génération des migrations : `npm run db:generate` (n'a pas besoin de base) ; application : `npm run db:migrate` */
export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
});
