import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const POIS_PATH = resolve(ROOT, 'content/pois.json');
/** Sortie à la racine du dépôt : Vercel (`outputDirectory`) et le Dockerfile lisent dist/. */
const OUT_DIR = resolve(ROOT, '../../dist');

/**
 * Version des données : empreinte de public/data/city.json et de public/models/ (calculée au build).
 * Ajoutée aux adresses (`city.json?v=…`) : les navigateurs peuvent garder ces fichiers en cache
 * longtemps, et toute modification des données change l'adresse, donc force le rechargement.
 */
function dataVersion(): string {
  const hash = createHash('sha1');
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(json|glb)$/.test(name)) hash.update(name).update(readFileSync(p));
    }
  };
  walk(resolve(ROOT, 'public/data'));
  walk(resolve(ROOT, 'public/models'));
  return hash.digest('hex').slice(0, 10);
}

/**
 * Outil de placement (dev uniquement) : reçoit une position cliquée sur la carte
 * et l'écrit dans content/pois.json. N'existe pas dans le build de production.
 */
function poiPlacementApi(): Plugin {
  return {
    name: 'poi-placement-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dev/poi', async (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };
        if (req.method !== 'POST') return send(405, { error: 'POST attendu' });
        try {
          let raw = '';
          for await (const chunk of req) raw += chunk;
          const { id, title, pos } = JSON.parse(raw) as { id?: string; title?: string; pos?: unknown };
          if (!id || !/^[a-z0-9-]+$/.test(id)) return send(400, { error: 'id invalide (minuscules, chiffres, tirets)' });
          if (!Array.isArray(pos) || pos.length !== 2 || !pos.every((v) => typeof v === 'number' && Number.isFinite(v)))
            return send(400, { error: 'pos invalide' });

          const pois = JSON.parse(await readFile(POIS_PATH, 'utf8')) as Record<string, unknown>[];
          const existing = pois.find((p) => p.id === id);
          if (existing) {
            existing.pos = pos;
          } else {
            if (!title?.trim()) return send(400, { error: 'titre requis pour un nouveau lieu' });
            pois.push({
              id,
              title: title.trim(),
              draft: true,
              era: '',
              category: 'monument',
              osm: { match: title.trim().toLowerCase(), prefer: {} },
              pos,
              summary: 'À rédiger',
              story: 'À rédiger',
              sources: [],
            });
          }
          await writeFile(POIS_PATH, JSON.stringify(pois, null, 2) + '\n');
          send(200, { ok: true, created: !existing });
        } catch (e) {
          send(500, { error: String(e) });
        }
      });
    },
  };
}

export default defineConfig({
  root: ROOT,
  build: {
    outDir: OUT_DIR,
    emptyOutDir: true, // dist/ est hors de la racine de la carte : Vite ne le vide pas sans cette option
    rolldownOptions: {
      treeshake: { manualPureFunctions: ['z'] },
      output: {
        // three.js (≈ 90 % du poids du code) dans son propre fichier : il ne change qu'avec la version de
        // la librairie, donc une mise à jour de l'appli ne le fait pas retélécharger (nom à empreinte, cache 1 an)
        codeSplitting: { groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]/ }] },
      },
    },
  },
  define: { __DATA_VERSION__: JSON.stringify(dataVersion()) },
  // En développement, /api est renvoyé au serveur de l'API (`npm run api:dev`, port 8787)
  // changeOrigin: false en toutes lettres (la forme courte le met à true) : l'API compare l'Origin des écritures à l'hôte reçu
  server: { proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: false } } },
  plugins: [
    poiPlacementApi(),
    // Mode hors-ligne (PWA) : un service worker garde le site, city.json et les modèles sur l'appareil.
    // Actif seulement dans le build de production, et seulement en HTTPS (ou sur localhost).
    VitePWA({
      registerType: 'prompt', // nouvelle version → bandeau « Mettre à jour » (voir src/pwa.ts)
      injectRegister: false,
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Chambéry en diorama',
        short_name: 'Chambéry',
        description: "Maquette 3D du centre historique de Chambéry, à explorer comme un petit jeu",
        lang: 'fr',
        start_url: '.',
        display: 'standalone',
        background_color: '#f0dfc4',
        theme_color: '#2d2622',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Tout est gardé dès la première visite : code, page, données (city.json ≈ 1,4 Mo), modèles
        globPatterns: ['**/*.{js,css,html,json,glb,png,webmanifest}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Le cache du service worker ignore le paramètre ?v= (sa propre révision suffit)
        ignoreURLParametersMatching: [/^v$/],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        // L'API n'est jamais servie par le cache du service worker
        navigateFallbackDenylist: [/^\/api\//, /^\/admin/],
        // La page d'administration n'est pas mise en cache pour les visiteurs
        globIgnores: ['admin/**'],
        runtimeCaching: [
          {
            // Polices Google : feuille de style revérifiée en arrière-plan, fichiers gardés un an
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 3600 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
      devOptions: { enabled: false }, // pas de service worker en dev (outil de placement, rechargement à chaud)
    }),
  ],
});
