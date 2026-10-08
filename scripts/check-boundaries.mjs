/**
 * Contrôle des frontières du dépôt (ADR-002, EP010-US005), lancé par `npm run build` (donc aussi sur Vercel et dans Docker).
 *
 * Chaque partie n'importe que ce qui lui est permis :
 *  - la carte (frontend/carte) et l'administration (frontend/admin) ne s'importent pas l'une l'autre ;
 *  - le front ne parle au back que par HTTP : il n'importe jamais le code de l'API (server/, api/) ;
 *  - le back n'importe jamais le front ;
 *  - chaque partie a sa liste de paquets npm : une nouvelle dépendance s'ajoute ici, en connaissance de cause.
 * L'administration ne construit jamais de HTML à partir de données (`dangerouslySetInnerHTML`, `innerHTML`… refusés).
 *
 * Les imports sont lus par TypeScript (`ts.preProcessFile`, déjà installé) : `import`, `export … from`, `import()` et `require()`,
 * sur plusieurs lignes, avec des commentaires ; un import dans un commentaire ou une chaîne n'est pas compté.
 * Non contrôlés : les fichiers de configuration (`vite.config.ts`, `vitest.config.ts`, `drizzle.config.ts`), les `index.html`
 * et les CSS (`@import`, `url()`), qui sont de l'outillage.
 * Tests : scripts/check-boundaries.test.mjs (`npm test`).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Les parties. `dirs` : où chercher les fichiers ; `parts` : les parties dont elle peut importer le code ;
 * `packages` : les paquets npm permis (null = tous, pour l'outillage de données) ; `node` : modules `node:*` permis.
 */
const PARTS = {
  carte: {
    dirs: ['frontend/carte/src'],
    parts: ['carte', 'contrat'],
    packages: ['three', 'virtual:pwa-register'],
    node: false,
  },
  'données de la carte': {
    dirs: ['frontend/carte/scripts'],
    parts: ['carte', 'données de la carte'],
    packages: null,
    node: true,
  },
  admin: {
    dirs: ['frontend/admin/src'],
    parts: ['admin', 'contrat'],
    packages: ['react', 'react-dom', 'wouter', '@tanstack/react-query', 'react-hook-form', '@hookform/resolvers', 'zod',
      'vitest', '@testing-library/react', '@testing-library/dom'],
    node: false,
    noRawHtml: true,
  },
  back: {
    dirs: ['server', 'api'],
    parts: ['back', 'contrat'],
    packages: ['hono', '@hono/node-server', 'zod', 'drizzle-orm', 'postgres', '@electric-sql/pglite', 'vitest'],
    node: true,
  },
  contrat: {
    dirs: ['contrat'],
    parts: ['contrat'],
    packages: ['zod'],
    node: false,
  },
};

/** Chemins des modules importés par un fichier source (TypeScript ou JavaScript) */
export function importsOf(source) {
  return ts.preProcessFile(source, true, true).importedFiles.map((f) => f.fileName);
}

const RAW_HTML = /dangerouslySetInnerHTML|\.(?:inner|outer)HTML\b|insertAdjacentHTML|document\.write|createContextualFragment|setHTMLUnsafe|\bsrcDoc\b/;
/** Vrai si le source construit du HTML à partir de texte (interdit dans l'administration) */
export function buildsRawHtml(source) {
  return RAW_HTML.test(source);
}

/** Partie d'un fichier (chemin relatif à la racine), ou null s'il n'appartient à aucune */
function partOf(rel) {
  for (const [name, part] of Object.entries(PARTS)) {
    if (part.dirs.some((d) => rel === d || rel.startsWith(d + '/'))) return name;
  }
  // La carte au sens large (contenu, données publiques, config) : importable par la carte et ses scripts
  if (rel.startsWith('frontend/carte/')) return 'carte';
  if (rel.startsWith('frontend/admin/')) return 'admin';
  return null;
}

const CODE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
function* files(dir) {
  let names;
  try { names = readdirSync(dir); } catch { return; }
  for (const name of names) {
    if (name === 'node_modules' || name === 'dist') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (CODE.test(name)) yield p;
  }
}

const packageName = (spec) => (spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]);

/** Contrôle tout le dépôt (ou un autre dossier racine, pour les tests) ; renvoie les violations */
export function checkBoundaries(root = ROOT) {
  const errors = [];
  let checked = 0;
  for (const [name, part] of Object.entries(PARTS)) {
    for (const dir of part.dirs) {
      for (const file of files(join(root, dir))) {
        checked++;
        const rel = relative(root, file).split(sep).join('/');
        const source = readFileSync(file, 'utf8');
        for (const spec of importsOf(source)) {
          if (spec.startsWith('.') || spec.startsWith('/')) {
            const target = relative(root, resolve(dirname(file), spec)).split(sep).join('/');
            const targetPart = partOf(target);
            if (!targetPart || !part.parts.includes(targetPart)) {
              errors.push(`${rel} importe ${target} : interdit (${name} → ${targetPart ?? 'hors des parties'})`);
            }
          } else if (spec.startsWith('node:')) {
            if (!part.node) errors.push(`${rel} importe ${spec} : interdit (${name} tourne dans le navigateur)`);
          } else if (part.packages && !part.packages.includes(packageName(spec)) && !part.packages.includes(spec)) {
            errors.push(`${rel} importe le paquet « ${packageName(spec)} » : pas dans la liste de ${name} (scripts/check-boundaries.mjs)`);
          }
        }
        if (part.noRawHtml && buildsRawHtml(source)) {
          errors.push(`${rel} construit du HTML brut (dangerouslySetInnerHTML, innerHTML…) : interdit dans l'administration`);
        }
      }
    }
  }
  return { errors, checked };
}

// Lancé directement (npm run build, npm run check:boundaries) ; importé par les tests, il ne fait rien de plus
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { errors, checked } = checkBoundaries();
  if (errors.length) {
    console.error(`✗ Frontières du dépôt : ${errors.length} problème(s)`);
    for (const e of errors) console.error(`  - ${e}`);
    console.error("Rappel (ADR-002) : le front ne parle au back que par HTTP ; la carte et l'administration ne partagent pas de code.");
    process.exit(1);
  }
  console.log(`✓ Frontières du dépôt respectées (${checked} fichiers : carte, données de la carte, admin, back)`);
}
