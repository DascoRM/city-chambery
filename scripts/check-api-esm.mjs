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
  // Le module de session (hono/jwt, WebCrypto, cookies) se charge aussi : sans ADMIN_TOKEN, l'administration répond 503 en JSON
  const session = await mod.default.fetch(new Request('http://localhost/api/admin/session'));
  const sessionBody = await session.json();
  if (session.status !== 503 || sessionBody.code !== 'admin-non-configuree') throw new Error(`/api/admin/session : ${session.status} ${JSON.stringify(sessionBody)}`);
  console.log('✓ API chargée comme sur Vercel (ESM) : /api/health répond 200, conforme au contrat ; administration fermée sans jeton (503)');
} catch (err) {
  console.error('✗ L\'API ne se charge pas comme sur Vercel :', err.code ?? '', err.message);
  process.exitCode = 1;
} finally {
  rmSync(out, { recursive: true, force: true });
}
