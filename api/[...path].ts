import { createApp } from '../server/app.js';

/**
 * Point d'entrée Vercel (fonction Node.js, format « fetch » standard) : toutes les routes /api/* passent par l'application
 * Hono de server/app.ts. Pour la développer en local : `npm run api:dev` (http://localhost:8787/api/health).
 */
const app = createApp();

export default {
  fetch: (request: Request) => app.fetch(request),
};
