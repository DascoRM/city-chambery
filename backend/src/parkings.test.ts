import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import * as schema from './db/schema.js';
import type { Db } from './parkings.js';
import { adminParkingEdits, publishedEdits } from '../../contrat/parkings.js';

/** Corps JSON d'une réponse (sans les types du navigateur, `Response.json()` rend `unknown`) */
const json = (res: Response): Promise<any> => res.json();
const TOKEN = 'jeton-de-test-parkings';
let client: PGlite;
let db: Db;

beforeEach(async () => {
  client = new PGlite();
  const d = drizzle(client, { schema });
  await migrate(d, { migrationsFolder: fileURLToPath(new URL('./db/migrations', import.meta.url)) });
  db = d as unknown as Db;
});

const app = (withDb = true) => createApp({ ADMIN_TOKEN: TOKEN }, { db: () => (withDb ? db : null) });
const ORIGIN = 'http://localhost';
let cookie = '';
beforeEach(async () => {
  // une session ouverte par le jeton (le cookie est valable pour toute application qui a le même jeton)
  const res = await app().request('/api/admin/login', { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: JSON.stringify({ token: TOKEN }) });
  cookie = (res.headers.get('set-cookie') ?? '').split(';')[0];
});
const auth = () => ({ cookie, origin: ORIGIN, 'content-type': 'application/json' });
const send = (method: string, path: string, body?: unknown, headers: Record<string, string> = auth()) =>
  app().request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });

describe('retouches des parkings : écriture (administration)', () => {
  it('enregistre une retouche puis la publie avec sa source', async () => {
    const put = await send('PUT', '/api/admin/parkings/overrides/way/37376434', { capacity: 149, note: 'Chiffre de la Ville', source: 'BNLS 2024' });
    expect(put.status).toBe(200);
    const pub = await app().request('/api/parkings/edits');
    expect(pub.status).toBe(200);
    expect(pub.headers.get('cache-control')).toContain('s-maxage=60');
    const body = publishedEdits.parse(await json(pub)); // ce que lit la carte, conforme au contrat
    expect(body.overrides['way/37376434']).toEqual({ capacity: 149, note: 'Chiffre de la Ville', source: 'BNLS 2024' });
    expect(body.updatedAt).toBeTypeOf('string');
  });

  it('remplace une retouche existante (pas de doublon)', async () => {
    await send('PUT', '/api/admin/parkings/overrides/way/1', { hide: true, source: 'vu sur place' });
    await send('PUT', '/api/admin/parkings/overrides/way/1', { name: 'Parking X', source: 'panneau' });
    const body = await json(await app().request('/api/parkings/edits'));
    expect(body.overrides['way/1']).toEqual({ name: 'Parking X', source: 'panneau' });
  });

  it('refuse sans source, sans retouche, ou avec un champ inconnu ou absurde', async () => {
    expect((await send('PUT', '/api/admin/parkings/overrides/way/1', { capacity: 12 })).status).toBe(400);
    expect((await send('PUT', '/api/admin/parkings/overrides/way/1', { source: 'x' })).status).toBe(400);
    expect((await send('PUT', '/api/admin/parkings/overrides/way/1', { source: 'x', html: '<b>' })).status).toBe(400);
    expect((await send('PUT', '/api/admin/parkings/overrides/way/1', { source: 'x', capacity: -3 })).status).toBe(400);
    expect((await send('PUT', '/api/admin/parkings/overrides/way/1', { source: '   ', hide: true })).status).toBe(400);
    expect((await send('PUT', '/api/admin/parkings/overrides/pas-un-id', { source: 'x', hide: true })).status).toBe(400);
  });

  it('ajoute un parking, refuse un doublon, puis le retire', async () => {
    const added = { id: 'custom/rosaire', kind: 'surface', pos: [10.5, -20], name: 'Parking du Rosaire', source: 'lien' };
    expect((await send('POST', '/api/admin/parkings/added', added)).status).toBe(201);
    expect((await send('POST', '/api/admin/parkings/added', added)).status).toBe(409);
    let body = await json(await app().request('/api/parkings/edits'));
    expect(body.added).toEqual([{ ...added }]);
    expect((await send('DELETE', '/api/admin/parkings/edits/custom/rosaire')).status).toBe(200);
    expect((await send('DELETE', '/api/admin/parkings/edits/custom/rosaire')).status).toBe(404);
    body = await json(await app().request('/api/parkings/edits'));
    expect(body.added).toEqual([]);
  });

  it('garde un journal des modifications', async () => {
    await send('PUT', '/api/admin/parkings/overrides/node/5', { fee: false, source: 'x' });
    await send('DELETE', '/api/admin/parkings/edits/node/5');
    const body = adminParkingEdits.parse(await json(await send('GET', '/api/admin/parkings/edits')));
    expect(body.log.map((l) => l.action)).toEqual(['remove', 'override']);
  });

  it('les écritures exigent la session', async () => {
    const open = { origin: ORIGIN, 'content-type': 'application/json' };
    expect((await send('PUT', '/api/admin/parkings/overrides/way/1', { hide: true, source: 'x' }, open)).status).toBe(401);
    expect((await send('POST', '/api/admin/parkings/added', {}, open)).status).toBe(401);
    expect((await send('DELETE', '/api/admin/parkings/edits/way/1', undefined, open)).status).toBe(401);
  });

  it('base sans les dernières migrations : 503 « migrations-manquantes » au lieu d’une erreur interne', async () => {
    const bare = new PGlite();
    const old = createApp({ ADMIN_TOKEN: TOKEN }, { db: () => drizzle(bare, { schema }) as unknown as Db });
    const res = await old.request('/api/admin/parkings/added', { method: 'POST', headers: auth(), body: JSON.stringify({ id: 'custom/essai', kind: 'surface', pos: [1, 2], source: 'x' }) });
    expect(res.status).toBe(503);
    expect((await json(res)).code).toBe('migrations-manquantes');
    await bare.close();
  });

  it('sans base : 503 avec un code, le site garde ses retouches locales', async () => {
    const res = await app(false).request('/api/parkings/edits');
    expect(res.status).toBe(503);
    expect((await json(res)).code).toBe('base-indisponible');
  });
});
