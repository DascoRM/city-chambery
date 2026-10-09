import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { createRateLimiter, tokenMatches } from './auth.js';
import { dbStats } from './db/stats.js';
import { appMeta } from './db/schema.js';

const TOKEN = 'jeton-de-test-0123456789';
const call = (env: Record<string, string>, path: string, headers: Record<string, string> = {}) => createApp(env).request(path, { headers });
const bearer = (t: string) => ({ authorization: `Bearer ${t}` });

describe('accès à l’administration', () => {
  it('est fermée (503, code dédié) tant qu’aucun jeton n’est configuré', async () => {
    const res = await call({}, '/api/admin/ping', bearer(TOKEN));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('admin-non-configuree');
    expect((await (await call({}, '/api/health')).json()).admin).toBe('absent');
    expect((await (await call({ ADMIN_TOKEN: TOKEN }, '/api/health')).json()).admin).toBe('configure');
  });

  it('refuse sans jeton, avec un mauvais jeton ou un schéma inconnu', async () => {
    const env = { ADMIN_TOKEN: TOKEN };
    expect((await call(env, '/api/admin/ping')).status).toBe(401);
    expect((await call(env, '/api/admin/ping', bearer('mauvais'))).status).toBe(401);
    expect((await call(env, '/api/admin/ping', { authorization: `Basic ${TOKEN}` })).status).toBe(401);
    expect((await call(env, '/api/admin/status')).status).toBe(401);
  });

  it('ignore les espaces et retours à la ligne autour du jeton (variable collée depuis le terminal)', async () => {
    const res = await call({ ADMIN_TOKEN: `  ${TOKEN}\n` }, '/api/admin/ping', bearer(`${TOKEN} `));
    expect(res.status).toBe(200);
  });

  it('accepte le bon jeton', async () => {
    const res = await call({ ADMIN_TOKEN: TOKEN }, '/api/admin/ping', bearer(TOKEN));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('status : sans base configurée, le dit sans échouer ni rien divulguer', async () => {
    const res = await call({ ADMIN_TOKEN: TOKEN }, '/api/admin/status', bearer(TOKEN));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.db.status).toBe('non-configuree');
    expect(JSON.stringify(body)).not.toContain(TOKEN);
  });

  it('bloque après 5 échecs, même avec le bon jeton ensuite (par adresse)', async () => {
    const app = createApp({ ADMIN_TOKEN: TOKEN });
    const hit = (t: string, ip = '203.0.113.7') => app.request('/api/admin/ping', { headers: { ...bearer(t), 'x-forwarded-for': ip } });
    for (let i = 0; i < 5; i++) expect((await hit('mauvais')).status).toBe(401);
    expect((await hit(TOKEN)).status).toBe(429);
    expect((await hit(TOKEN, '198.51.100.9')).status).toBe(200); // une autre adresse n'est pas touchée
  });

  it('ne mélange pas les routes : /api/health reste publique', async () => {
    expect((await call({ ADMIN_TOKEN: TOKEN }, '/api/health')).status).toBe(200);
  });
});

describe('outils de l’accès', () => {
  it('compare les jetons sans erreur, même de longueurs différentes', () => {
    expect(tokenMatches('abc', 'abc')).toBe(true);
    expect(tokenMatches('abc', 'abd')).toBe(false);
    expect(tokenMatches('abc', 'abcdefghijklmnop')).toBe(false);
    expect(tokenMatches('abc', '')).toBe(false);
  });

  it('le limiteur oublie les échecs après la fenêtre', () => {
    const l = createRateLimiter(3, 1000);
    expect(l.fail('a', 0)).toBe(false);
    expect(l.fail('a', 10)).toBe(false);
    expect(l.fail('a', 20)).toBe(true);
    expect(l.blocked('a', 500)).toBe(true);
    expect(l.blocked('a', 1500)).toBe(false);
  });
});

describe('statistiques de la base (PGlite)', () => {
  it('donne la taille et le nombre de lignes de chaque table', async () => {
    const client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('./db/migrations', import.meta.url)) });
    await db.insert(appMeta).values([{ key: 'a', value: '1' }, { key: 'b', value: '2' }]);
    const stats = await dbStats(async (text) => (await client.query(text)).rows as Record<string, unknown>[]);
    expect(stats.sizeBytes).toBeGreaterThan(0);
    expect(stats.tables).toContainEqual({ name: 'app_meta', rows: 2 });
    expect((await dbStats(async (text) => (await client.query(text)).rows as Record<string, unknown>[], ['app_meta', 'table_future'])).missing).toEqual(['table_future']);
    await client.close();
  });
});
