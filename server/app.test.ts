import { describe, expect, it } from 'vitest';
import { createApp } from './app';
import { appEnv, resolveDatabase } from './env';

const get = (env: Record<string, string>, path = '/api/health') => createApp(env).request(path);

describe('environnement', () => {
  it('reconnaît production, prévisualisation et développement', () => {
    expect(appEnv({ VERCEL_ENV: 'production' })).toBe('production');
    expect(appEnv({ VERCEL_ENV: 'preview' })).toBe('preview');
    expect(appEnv({})).toBe('development');
  });

  it('production et développement lisent DATABASE_URL', () => {
    expect(resolveDatabase({ VERCEL_ENV: 'production', DATABASE_URL: 'postgres://prod' })).toEqual({ url: 'postgres://prod' });
    expect(resolveDatabase({ DATABASE_URL: 'postgres://dev' })).toEqual({ url: 'postgres://dev' });
    expect(resolveDatabase({})).toEqual({ url: null, reason: 'non-configuree' });
  });

  it("une prévisualisation n'utilise JAMAIS la base de production", () => {
    const env = { VERCEL_ENV: 'preview', DATABASE_URL: 'postgres://prod' };
    expect(resolveDatabase(env)).toEqual({ url: null, reason: 'desactivee-en-previsualisation' });
    expect(resolveDatabase({ ...env, DATABASE_URL_PREVIEW: 'postgres://preview' })).toEqual({ url: 'postgres://preview' });
  });

  it("la production ignore DATABASE_URL_PREVIEW", () => {
    expect(resolveDatabase({ VERCEL_ENV: 'production', DATABASE_URL_PREVIEW: 'postgres://preview' })).toEqual({ url: null, reason: 'non-configuree' });
  });
});

describe('GET /api/health', () => {
  it('répond sans base configurée (le site fonctionne sans l’API)', async () => {
    const res = await get({});
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, service: 'chambery-diorama-api', env: 'development', db: { status: 'non-configuree' } });
  });

  it('dit que la base est désactivée en prévisualisation', async () => {
    const res = await get({ VERCEL_ENV: 'preview', DATABASE_URL: 'postgres://utilisateur:secret@prod/db' });
    expect((await res.json()).db.status).toBe('desactivee-en-previsualisation');
  });

  it('ne divulgue ni adresse ni mot de passe, même quand la base est injoignable', async () => {
    const res = await get({ DATABASE_URL: 'postgres://utilisateur:motdepassesecret@127.0.0.1:1/inexistante' });
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(JSON.parse(body).db.status).toBe('erreur');
    expect(body).not.toContain('motdepassesecret');
    expect(body).not.toContain('127.0.0.1');
  }, 15000);

  it('affiche la version courte du commit et interdit la mise en cache', async () => {
    const res = await get({ VERCEL_GIT_COMMIT_SHA: 'abcdef1234567890' });
    expect((await res.json()).version).toBe('abcdef1');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});

describe('routes inconnues', () => {
  it('répondent 404 en JSON', async () => {
    const res = await get({}, '/api/nimporte-quoi');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'introuvable' });
  });
});
