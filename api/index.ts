import { createApp } from '../backend/src/app.js';

/**
 * Point d'entrée Vercel (fonction Node.js, format « fetch » standard). Une seule fonction pour toute l'API : `vercel.json`
 * réécrit `/api/:path*` vers `/api` (un nom de fichier `[...path]` ne captait pas les chemins à plusieurs niveaux comme
 * `/api/admin/ping` : 404 de Vercel). La requête garde son adresse d'origine, que l'application Hono de backend/src/app.ts route.
 * Pour la développer en local : `npm run api:dev` (http://localhost:8787/api/health).
 */
const app = createApp();

export default {
  fetch: (request: Request) => app.fetch(request),
};
