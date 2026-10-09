/**
 * Contrôle de l'API comme Vercel la charge : le projet est en ES modules (`"type": "module"`), où Node exige l'extension
 * dans chaque import relatif (`./app.js`). Un import sans extension passe `tsc` et les tests, mais fait planter la fonction
 * Vercel (500 FUNCTION_INVOCATION_FAILED). On compile l'API dans un dossier temporaire, on la charge avec Node et on
 * interroge /api/health. Lancé par `npm run build`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
// Vercel compile api/index.ts avec le tsconfig.json le plus proche en remontant depuis api/ : un fichier api/tsconfig.json
// prendrait le pas sur la config du back (tsconfig.json racine) sans prévenir
if (existsSync(join(root, 'api/tsconfig.json'))) {
  console.error('✗ api/tsconfig.json existe : Vercel le prendrait à la place du tsconfig.json racine (config du back). Le supprimer.');
  process.exit(1);
}
const out = mkdtempSync(join(tmpdir(), 'api-esm-'));
try {
  execFileSync(join(root, 'node_modules/.bin/tsc'), ['-p', 'tsconfig.json', '--noEmit', 'false', '--outDir', out, '--rootDir', '.'], { cwd: root, stdio: 'inherit' });
  writeFileSync(join(out, 'package.json'), '{ "type": "module" }');
  symlinkSync(join(root, 'node_modules'), join(out, 'node_modules'));
  const mod = await import(pathToFileURL(join(out, 'api/index.js')).href);
  const res = await mod.default.fetch(new Request('http://localhost/api/health'));
  const body = await res.json();
  if (res.status !== 200 || body.ok !== true) throw new Error(`/api/health : ${res.status} ${JSON.stringify(body)}`);
  // La réponse respecte le contrat partagé avec le front (contrat/sante.ts, compilé avec l'API)
  const { healthResponse } = await import(pathToFileURL(join(out, 'contrat/sante.js')).href);
  const check = healthResponse.safeParse(body);
  if (!check.success) throw new Error(`/api/health ne respecte pas le contrat : ${JSON.stringify(check.error.issues)}`);
  // Le module de session (hono/jwt, WebCrypto, cookies) se charge aussi. Réponse attendue sans cookie : 503 si ADMIN_TOKEN
  // n'est pas posé (en local), 401 s'il l'est (Vercel injecte les variables d'environnement pendant le build)
  const session = await mod.default.fetch(new Request('http://localhost/api/admin/session'));
  const sessionBody = await session.json();
  const expected = { 503: 'admin-non-configuree', 401: 'non-autorise' };
  if (expected[session.status] !== sessionBody.code) throw new Error(`/api/admin/session : ${session.status} ${JSON.stringify(sessionBody)}`);
  // Une vraie session sur le code compilé (hono/jwt, WebCrypto) : connexion avec un jeton de contrôle, puis /session avec le cookie
  const { createApp } = await import(pathToFileURL(join(out, 'backend/src/app.js')).href);
  const app = createApp({ ADMIN_TOKEN: 'jeton-de-controle-du-build-0123456789' });
  const login = await app.fetch(new Request('http://localhost/api/admin/login', { method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify({ token: 'jeton-de-controle-du-build-0123456789' }) }));
  const cookie = login.headers.getSetCookie().find((c) => c.startsWith('diorama_admin='))?.split(';')[0];
  if (login.status !== 200 || !cookie) throw new Error(`/api/admin/login : ${login.status} ${await login.text()}`);
  const checked = await app.fetch(new Request('http://localhost/api/admin/session', { headers: { cookie } }));
  if (checked.status !== 200) throw new Error(`/api/admin/session avec la session : ${checked.status} ${await checked.text()}`);
  // Météo (EP009) : la route se charge et respecte le contrat, avec une source SIMULÉE et sans base (pendant le build, Vercel
  // injecte les variables d'environnement : l'application réelle `mod.default` appellerait Open-Meteo)
  const { weatherResponse } = await import(pathToFileURL(join(out, 'contrat/meteo.js')).href);
  const step = Math.floor(Date.now() / 900_000) * 900;
  const fakeSource = async () => Response.json({ latitude: 45.56, longitude: 5.92, elevation: 286, current: { time: step, interval: 900, temperature_2m: 12, weather_code: 3, cloud_cover: 90, precipitation: 0, snowfall: 0, wind_speed_10m: 10, wind_direction_10m: 270, wind_gusts_10m: 20, visibility: 20000, lightning_potential: 0 } });
  const meteo = await createApp({}, { weather: { fetch: fakeSource } }).fetch(new Request('http://localhost/api/weather'));
  const meteoBody = await meteo.json();
  if (meteo.status !== 200 || !weatherResponse.safeParse(meteoBody).success || !/s-maxage=/.test(meteo.headers.get('cache-control') ?? '')) {
    throw new Error(`/api/weather : ${meteo.status} ${meteo.headers.get('cache-control')} ${JSON.stringify(meteoBody)}`);
  }
  console.log(`✓ API chargée comme sur Vercel (ESM) : /api/health répond 200, conforme au contrat ; session sans cookie refusée (${session.status}), session ouverte et relue ; /api/weather conforme (source simulée)`);
} catch (err) {
  console.error('✗ L\'API ne se charge pas comme sur Vercel :', err.code ?? '', err.message);
  process.exitCode = 1;
} finally {
  rmSync(out, { recursive: true, force: true });
}
