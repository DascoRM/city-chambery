import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { apiError } from '../../contrat/erreurs.js';
import { sessionInfo } from '../../contrat/session.js';

/** Corps JSON d'une réponse (sans les types du navigateur, `Response.json()` rend `unknown`) */
const json = (res: Response): Promise<any> => res.json();
const TOKEN = 'jeton-de-test-0123456789';
const ORIGIN = 'http://localhost'; // adresse des requêtes de test (app.request)
const HOUR = 3600_000;
const T0 = Date.UTC(2026, 9, 9, 8, 0, 0);

/** Une application avec une horloge réglable (tests d'expiration) */
function setup(env: Record<string, string> = { ADMIN_TOKEN: TOKEN }) {
  let clock = T0;
  const app = createApp(env, { now: () => clock });
  const login = (token = TOKEN, headers: Record<string, string> = {}) =>
    app.request('/api/admin/login', { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json', ...headers }, body: JSON.stringify({ token }) });
  const get = (path: string, cookie?: string, headers: Record<string, string> = {}) =>
    app.request(path, { headers: { ...(cookie ? { cookie } : {}), ...headers } });
  const at = (ms: number) => { clock = T0 + ms; };
  return { app, login, get, at };
}
/** « diorama_admin=… » tiré de l'en-tête Set-Cookie, à renvoyer tel quel */
const cookieOf = (res: Response) => (res.headers.get('set-cookie') ?? '').split(';')[0];

describe('session d’administration : connexion', () => {
  it('le bon jeton ouvre une session : cookie HttpOnly, SameSite=Strict, limité à /api/admin, 2 h ; jamais le jeton en retour', async () => {
    const { login } = setup({ ADMIN_TOKEN: TOKEN, VERCEL_ENV: 'preview' });
    const res = await login(`  ${TOKEN}\n`); // espaces et retour à la ligne collés depuis le terminal : ignorés
    expect(res.status).toBe(200);
    const body = sessionInfo.parse(await json(res));
    expect(body).toMatchObject({ sub: 'admin', method: 'token', expiresAt: new Date(T0 + 2 * HOUR).toISOString(), maxExpiresAt: new Date(T0 + 8 * HOUR).toISOString() });
    expect(JSON.stringify(body)).not.toContain(TOKEN);
    const cookie = res.headers.get('set-cookie') ?? '';
    for (const part of ['diorama_admin=', 'Max-Age=7200', 'Path=/api/admin', 'HttpOnly', 'Secure', 'SameSite=Strict']) expect(cookie).toContain(part);
  });

  it('en développement sur http, le cookie n’a pas Secure (sinon Safari le refuse sur localhost)', async () => {
    const res = await setup().login();
    expect(res.headers.get('set-cookie')).not.toContain('Secure');
  });

  it('refuse un mauvais jeton (401), puis bloque l’adresse après 5 échecs, même avec le bon jeton', async () => {
    const { login } = setup();
    const ip = { 'x-forwarded-for': '203.0.113.7' };
    const bad = await login('mauvais', ip);
    expect(bad.status).toBe(401);
    expect(apiError.parse(await json(bad)).code).toBe('non-autorise');
    for (let i = 0; i < 4; i++) await login('mauvais', ip);
    expect((await login(TOKEN, ip)).status).toBe(429);
    expect((await login(TOKEN, { 'x-forwarded-for': '198.51.100.9' })).status).toBe(200); // une autre adresse n'est pas touchée
  });

  it('fermée sans ADMIN_TOKEN (503) ; corps invalide (400) sans compter d’échec', async () => {
    expect((await json(await setup({}).login())).code).toBe('admin-non-configuree');
    const { app, login } = setup();
    const raw = (body: string) => app.request('/api/admin/login', { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body });
    for (let i = 0; i < 6; i++) expect((await raw('{"token":""}')).status).toBe(400);
    expect((await raw(JSON.stringify({ token: TOKEN, admin: true }))).status).toBe(400);
    expect((await login()).status).toBe(200);
  });
});

describe('session d’administration : accès aux routes', () => {
  it('sans session : 401 (jamais 429, même répété) ; le jeton seul ne suffit plus', async () => {
    const { get } = setup();
    for (let i = 0; i < 6; i++) expect((await get('/api/admin/status')).status).toBe(401);
    const bearer = await get('/api/admin/status', undefined, { authorization: `Bearer ${TOKEN}` });
    expect(bearer.status).toBe(401);
    expect((await json(bearer)).code).toBe('non-autorise');
  });

  it('avec la session : état et informations de session', async () => {
    const { login, get } = setup();
    const cookie = cookieOf(await login());
    expect((await get('/api/admin/status', cookie)).status).toBe(200);
    expect(sessionInfo.parse(await json(await get('/api/admin/session', cookie))).sub).toBe('admin');
    expect((await get('/api/health')).status).toBe(200); // la santé reste publique
  });

  it('glissante : chaque requête prolonge de 2 h ; un cookie non renouvelé expire au bout de 2 h', async () => {
    const { login, get, at } = setup();
    const first = cookieOf(await login());
    at(2 * HOUR - 1000);
    const res = await get('/api/admin/session', first);
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('Max-Age=7200'); // renouvelé
    const renewed = cookieOf(res);
    at(2 * HOUR + 1000);
    const old = await get('/api/admin/session', first);
    expect(old.status).toBe(401);
    expect((await json(old)).code).toBe('session-expiree');
    expect(old.headers.get('set-cookie')).toContain('Max-Age=0'); // le cookie expiré est effacé
    at(3 * HOUR);
    expect((await get('/api/admin/session', renewed)).status).toBe(200);
  });

  it('au plus 8 h depuis la connexion, même en travaillant sans arrêt', async () => {
    const { login, get, at } = setup();
    let cookie = cookieOf(await login());
    for (let h = 1; h <= 7; h++) {
      at(h * HOUR);
      const res = await get('/api/admin/session', cookie);
      expect(res.status).toBe(200);
      cookie = cookieOf(res);
    }
    at(8 * HOUR - 60_000);
    const last = await get('/api/admin/session', cookie);
    expect(last.status).toBe(200);
    expect(last.headers.get('set-cookie')).toContain('Max-Age=60'); // plus que la minute restante
    cookie = cookieOf(last);
    at(8 * HOUR);
    const over = await get('/api/admin/session', cookie);
    expect(over.status).toBe(401);
    expect((await json(over)).code).toBe('session-expiree');
  });

  it('refuse un cookie falsifié ou signé avec un autre jeton (changer ADMIN_TOKEN ferme les sessions)', async () => {
    const { login, get } = setup();
    const cookie = cookieOf(await login());
    const [header, payload, signature] = cookie.split('=')[1].split('.');
    const forged = `diorama_admin=${header}.${payload}.${signature.slice(0, -2)}xx`;
    expect((await get('/api/admin/status', forged)).status).toBe(401);
    const other = setup({ ADMIN_TOKEN: 'un-autre-jeton-0123456789' });
    expect((await other.get('/api/admin/status', cookie)).status).toBe(401);
  });
});

describe('session d’administration : écritures et déconnexion', () => {
  /** Une écriture avec la session (la base est absente : 503 prouve que les contrôles sont passés) */
  async function write(headers: Record<string, string>) {
    const { app, login } = setup();
    const cookie = cookieOf(await login());
    return app.request('/api/admin/parkings/overrides/way/1', { method: 'PUT', headers: { cookie, ...headers }, body: JSON.stringify({ hide: true, source: 'x' }) });
  }

  it('même origine : acceptée ; autre origine ou origine inconnue : 403 ; autre chose que du JSON : 415', async () => {
    const ok = await write({ origin: ORIGIN, 'content-type': 'application/json' });
    expect(ok.status).toBe(503); // contrôles passés, puis « base indisponible »
    const foreign = await write({ origin: 'https://site-malveillant.example', 'content-type': 'application/json' });
    expect(foreign.status).toBe(403);
    expect((await json(foreign)).code).toBe('origine-refusee');
    expect((await write({ 'content-type': 'application/json' })).status).toBe(403);
    expect((await write({ origin: 'null', 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' })).status).toBe(503);
    const text = await write({ origin: ORIGIN, 'content-type': 'text/plain' });
    expect(text.status).toBe(415);
    expect((await json(text)).code).toBe('type-de-contenu');
  });

  it('une connexion depuis un autre site est refusée (403) sans compter d’échec', async () => {
    const { login } = setup();
    for (let i = 0; i < 6; i++) expect((await login(TOKEN, { origin: 'https://site-malveillant.example' })).status).toBe(403);
    expect((await login()).status).toBe(200);
  });

  it('la déconnexion efface le cookie (204), avec ou sans session', async () => {
    const { app, login } = setup();
    const out = (cookie?: string) => app.request('/api/admin/logout', { method: 'POST', headers: { origin: ORIGIN, ...(cookie ? { cookie } : {}) } });
    const res = await out(cookieOf(await login()));
    expect(res.status).toBe(204);
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
    expect((await out()).status).toBe(204);
  });
});
