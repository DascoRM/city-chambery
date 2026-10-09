import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { createRateLimiter, ipKey, tokenMatches } from './auth.js';
import { dbStats } from './db/stats.js';
import { appMeta } from './db/schema.js';
import { adminStatusResponse } from '../../contrat/sante.js';

/** Corps JSON d'une réponse (sans les types du navigateur, `Response.json()` rend `unknown`) */
const json = (res: Response): Promise<any> => res.json();
const TOKEN = 'jeton-de-test-0123456789';

/** Ouvre une session (connexion par le jeton) et rend le cookie à renvoyer */
async function session(app: ReturnType<typeof createApp>) {
  const res = await app.request('/api/admin/login', { method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify({ token: TOKEN }) });
  return res.headers.getSetCookie().find((c) => c.startsWith('diorama_admin='))?.split(';')[0] ?? '';
}

describe('administration : état (avec une session)', () => {
  it('santé publique : dit seulement si un jeton est configuré', async () => {
    expect((await json(await createApp({}).request('/api/health'))).admin).toBe('absent');
    expect((await json(await createApp({ ADMIN_TOKEN: TOKEN }).request('/api/health'))).admin).toBe('configure');
  });

  it('status : sans base configurée, le dit sans échouer ni rien divulguer', async () => {
    const app = createApp({ ADMIN_TOKEN: TOKEN });
    const res = await app.request('/api/admin/status', { headers: { cookie: await session(app) } });
    const body = adminStatusResponse.parse(await json(res)); // conforme au contrat
    expect(res.status).toBe(200);
    expect(body.db.status).toBe('non-configuree');
    expect(JSON.stringify(body)).not.toContain(TOKEN);
  });

  it('ping avec la session', async () => {
    const app = createApp({ ADMIN_TOKEN: TOKEN });
    expect(await json(await app.request('/api/admin/ping', { headers: { cookie: await session(app) } }))).toEqual({ ok: true });
  });
});

describe('outils de l’accès', () => {
  it('compare les jetons sans erreur, même de longueurs différentes', () => {
    expect(tokenMatches('abc', 'abc')).toBe(true);
    expect(tokenMatches('abc', 'abd')).toBe(false);
    expect(tokenMatches('abc', 'abcdefghijklmnop')).toBe(false);
    expect(tokenMatches('abc', '')).toBe(false);
  });

  it('une adresse IPv6 compte pour son /64 ; l’IPv4 reste l’IPv4 (même écrite en IPv6)', () => {
    expect(ipKey('203.0.113.7')).toBe('203.0.113.7');
    expect(ipKey('::ffff:192.0.2.1')).toBe('192.0.2.1');
    expect(ipKey('2001:db8:85a3:8d3:1319:8a2e:370:7348')).toBe('2001:db8:85a3:8d3::/64');
    expect(ipKey('2001:0DB8:0000:0001::abcd')).toBe('2001:db8:0:1::/64');
    expect(ipKey('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(ipKey('2001:db8::1')).toBe(ipKey('2001:db8:0:0:ffff::2'));
  });

  it('la limite d’essais ne garde pas en mémoire les adresses sans échec récent', () => {
    const l = createRateLimiter(3, 1000);
    for (let i = 0; i < 100; i++) l.blocked(`198.51.100.${i}`, 0);
    expect(l.size()).toBe(0);
    l.fail('a', 0);
    expect(l.size()).toBe(1);
    l.blocked('a', 5000);
    expect(l.size()).toBe(0);
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
