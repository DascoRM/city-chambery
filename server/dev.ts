/// <reference types="node" />
import { serve } from '@hono/node-server';
import { createApp } from './app.js';

/** Serveur de développement : `npm run api:dev` (le site, lancé par `npm run dev`, lui renvoie /api par un proxy) */
const port = Number(process.env.API_PORT ?? 8787);
serve({ fetch: createApp().fetch, port });
console.log(`API : http://localhost:${port}/api/health`);
