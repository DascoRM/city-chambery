import { defineConfig, type Plugin } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const POIS_PATH = resolve(fileURLToPath(new URL('.', import.meta.url)), 'src/content/pois.json');

/**
 * Outil de placement (dev uniquement) : reçoit une position cliquée sur la carte
 * et l'écrit dans src/content/pois.json. N'existe pas dans le build de production.
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
  plugins: [poiPlacementApi()],
});
