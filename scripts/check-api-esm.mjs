/**
 * Contrôle de l'API comme Vercel la charge : le projet est en ES modules (`"type": "module"`), où Node exige l'extension
 * dans chaque import relatif (`./app.js`). Un import sans extension passe `tsc` et les tests, mais fait planter la fonction
 * Vercel (500 FUNCTION_INVOCATION_FAILED). On compile l'API dans un dossier temporaire, on la charge avec Node et on
 * interroge /api/health. Lancé par `npm run build`.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const out = mkdtempSync(join(tmpdir(), 'api-esm-'));
try {
  execFileSync(join(root, 'node_modules/.bin/tsc'), ['-p', 'tsconfig.api.json', '--noEmit', 'false', '--outDir', out, '--rootDir', '.'], { cwd: root, stdio: 'inherit' });
  writeFileSync(join(out, 'package.json'), '{ "type": "module" }');
  symlinkSync(join(root, 'node_modules'), join(out, 'node_modules'));
  const mod = await import(pathToFileURL(join(out, 'api/[...path].js')).href);
  const res = await mod.default.fetch(new Request('http://localhost/api/health'));
  const body = await res.json();
  if (res.status !== 200 || body.ok !== true) throw new Error(`/api/health : ${res.status} ${JSON.stringify(body)}`);
  console.log('✓ API chargée comme sur Vercel (ESM) : /api/health répond 200');
} catch (err) {
  console.error('✗ L\'API ne se charge pas comme sur Vercel :', err.code ?? '', err.message);
  process.exitCode = 1;
} finally {
  rmSync(out, { recursive: true, force: true });
}
