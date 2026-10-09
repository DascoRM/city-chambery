/**
 * Contrôle des noms de rues de public/data/city.json (EP002-US004).
 *   npm run check:streets
 * Ne modifie rien. Sortie 1 si une règle est violée.
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStreetLabels, DEFAULTS } from './street-names.mjs';
import { distToSegment } from './geo.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const city = JSON.parse(await readFile(resolve(ROOT, 'public/data/city.json'), 'utf8'));
const config = JSON.parse(await readFile(resolve(ROOT, 'diorama.config.json'), 'utf8'));
const opts = { ...DEFAULTS, ...config.streetNames };

const errors = [];
const fail = (msg) => errors.push(msg);
const labels = city.streetLabels;

if (!Array.isArray(labels) || labels.length === 0) {
  console.error('✗ city.json n\'a pas de streetLabels (ou la liste est vide) : lance `npm run data -- --offline`.');
  process.exit(1);
}

const roadNames = new Set(city.roads.filter((r) => r.name).map((r) => r.name));
const skip = new Set(opts.skipKinds);

for (const l of labels) {
  const id = `« ${l.text} »`;
  // 1. Le texte est celui d'OpenStreetMap, tel quel
  if (!roadNames.has(l.text)) fail(`${id} : aucun tronçon de ce nom dans roads`);
  // 2. Voies exclues
  if (skip.has(l.kind)) fail(`${id} : voie de type « ${l.kind} », exclue par la configuration`);
  // 3. Lisibilité et taille
  if (!(l.angle > -90 && l.angle <= 90)) fail(`${id} : angle ${l.angle}° hors de ]-90, 90] (texte à l'envers)`);
  if (l.size < opts.minSize - 0.05 || l.size > opts.maxSize + 0.05) fail(`${id} : taille ${l.size} m hors de [${opts.minSize}, ${opts.maxSize}]`);
  // 4. L'emplacement est bien sur une voie du même nom
  let d = Infinity;
  for (const r of city.roads) {
    if (r.name !== l.text) continue;
    for (let k = 1; k < r.pts.length; k++) d = Math.min(d, distToSegment(l.pos, r.pts[k - 1], r.pts[k]));
  }
  if (d > Math.max(3, l.w / 2)) fail(`${id} : à ${d.toFixed(1)} m de la voie (largeur ${l.w} m), hors de la chaussée`);
  // 5. Dans l'emprise
  const b = city.bounds;
  if (l.pos[0] < b.minX || l.pos[0] > b.maxX || l.pos[1] < b.minY || l.pos[1] > b.maxY) fail(`${id} : hors de l'emprise de la carte`);
}

// 6. Un nom n'est écrit qu'une fois par rue : deux exemplaires du même nom sont à plus de 60 m
const byText = new Map();
for (const l of labels) byText.set(l.text, [...(byText.get(l.text) ?? []), l]);
for (const [text, list] of byText)
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const dd = Math.hypot(list[i].pos[0] - list[j].pos[0], list[i].pos[1] - list[j].pos[1]);
      if (dd < 60) fail(`« ${text} » : deux exemplaires à ${dd.toFixed(0)} m l'un de l'autre`);
    }

// 7. city.json est à jour : même résultat que le calcul actuel (script, config)
const fresh = buildStreetLabels(city.roads, config.streetNames);
if (JSON.stringify(fresh.labels) !== JSON.stringify(labels))
  fail(`city.json n'est pas à jour : ${labels.length} noms dans le fichier, ${fresh.labels.length} avec le script et la configuration actuels (relance \`npm run data -- --offline\`)`);

// 8. Toute voie nommée et retenue a un emplacement, sauf celles que le script a écartées avec une raison
const labelled = new Set(labels.map((l) => l.text));
const dropped = new Set(fresh.dropped.map((x) => x.name));
for (const r of city.roads) {
  if (!r.name || skip.has(r.kind)) continue;
  if (!labelled.has(r.name) && !dropped.has(r.name)) fail(`« ${r.name} » : ni nom écrit, ni raison de l'avoir écarté`);
}

if (errors.length) {
  console.error(`✗ ${errors.length} problème(s) :`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`✓ ${labels.length} noms de rues contrôlés (${fresh.dropped.length} voies sans emplacement : trop courtes ou pas assez droites)`);
