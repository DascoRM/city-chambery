/**
 * Convertit les modèles OBJ du pack Quaternius (assets-src/quaternius-nature/obj/<catégorie>/<Nom>.obj)
 * en .glb légers pour le diorama (public/models/nature/<Nom>.glb).
 *
 * Seuls les modèles cités dans les mélanges de src/content/nature.json sont convertis (ou ceux passés en arguments :
 * `node scripts/convert-nature.mjs Rock_1 Bush_1`).
 *
 * Format produit : un seul maillage indexé, couleur par sommet (COLOR_0 : palette du diorama, voir RECOLOR),
 * pas de normales (l'application utilise un rendu à facettes, flatShading) ni de textures.
 * Simplification (itération 25) : le nombre de triangles est réduit avec meshoptimizer, réglé par
 * `simplify` dans nature.json ({ ratio: part des triangles à garder, error: écart de forme toléré,
 * relatif à la taille du modèle }). Sans ce réglage, les modèles restent complets.
 */
import { readFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { simplify, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'assets-src/quaternius-nature/obj');
const OUT = join(ROOT, 'public/models/nature');

/**
 * Couleurs du diorama (src/scene/palette.ts) à la place des couleurs d'origine du pack, plus sombres :
 * les arbres modélisés se fondent ainsi avec le reste de la ville. Choix de style.
 * Clé = nom du matériau Quaternius (sans le suffixe .001). Un matériau absent garde sa couleur d'origine.
 */
const RECOLOR = {
  Green: '#7fae5f',
  DarkGreen: '#5f8f4a',
  Wood: '#7a5a42',
  White: '#e6e1d3', // écorce de bouleau
  Black: '#3f3a36', // marques de l'écorce
};
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const hexToLinear = (h) => [1, 3, 5].map((i) => srgbToLinear(parseInt(h.slice(i, i + 2), 16) / 255));

function findObj(name) {
  if (!existsSync(SRC)) return null;
  for (const cat of readdirSync(SRC)) {
    const p = join(SRC, cat, `${name}.obj`);
    if (existsSync(p)) return p;
  }
  return null;
}

function parseMtl(path) {
  const colors = {};
  if (!existsSync(path)) return colors;
  let cur = null;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim().split(/\s+/);
    if (t[0] === 'newmtl') cur = t[1];
    else if (t[0] === 'Kd' && cur) {
      const base = cur.replace(/\.\d+$/, '');
      colors[cur] = RECOLOR[base] ? hexToLinear(RECOLOR[base]) : t.slice(1, 4).map(Number); // Kd : valeurs linéaires (export Blender)
    }
  }
  return colors;
}

function convert(objPath) {
  const colors = parseMtl(objPath.replace(/\.obj$/, '.mtl'));
  const v = [];
  const pos = [], col = [], idx = [];
  const map = new Map(); // (sommet OBJ, matériau) → sommet glTF
  let mat = null;
  for (const line of readFileSync(objPath, 'utf8').split('\n')) {
    const t = line.trim().split(/\s+/);
    if (t[0] === 'v') v.push(t.slice(1, 4).map(Number));
    else if (t[0] === 'usemtl') mat = t[1];
    else if (t[0] === 'f') {
      const ids = t.slice(1).map((s) => {
        let i = parseInt(s.split('/')[0], 10);
        if (i < 0) i = v.length + i + 1;
        const key = `${i}|${mat}`;
        let k = map.get(key);
        if (k === undefined) {
          k = pos.length / 3;
          map.set(key, k);
          pos.push(...v[i - 1]);
          const c = colors[mat] ?? [0.5, 0.5, 0.5];
          col.push(...c.map((x) => Math.round(Math.min(1, x) * 255)), 255);
        }
        return k;
      });
      for (let j = 1; j + 1 < ids.length; j++) idx.push(ids[0], ids[j], ids[j + 1]);
    }
  }
  return { pos: new Float32Array(pos), col: new Uint8Array(col), idx: pos.length / 3 > 65535 ? new Uint32Array(idx) : new Uint16Array(idx) };
}

const config = JSON.parse(readFileSync(join(ROOT, 'src/content/nature.json'), 'utf8'));
const names = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [...new Set(Object.values(config.mixes).flatMap((m) => Object.keys(m.models)))];

const SIMPLIFY = config.simplify ?? null;
if (SIMPLIFY) await MeshoptSimplifier.ready;

mkdirSync(OUT, { recursive: true });
const io = new NodeIO();
let ok = 0;
for (const name of names) {
  const src = findObj(name);
  if (!src) {
    console.warn(`⚠️  ${name}.obj introuvable dans ${SRC}`);
    continue;
  }
  const { pos, col, idx } = convert(src);
  const doc = new Document();
  const buf = doc.createBuffer();
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buf))
    .setAttribute('COLOR_0', doc.createAccessor().setType('VEC4').setArray(col).setNormalized(true).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(idx).setBuffer(buf))
    .setMaterial(doc.createMaterial(name).setRoughnessFactor(0.9).setMetallicFactor(0));
  const mesh = doc.createMesh(name).addPrimitive(prim);
  doc.createScene().addChild(doc.createNode(name).setMesh(mesh));
  doc.getRoot().getAsset().copyright = 'Quaternius — CC0 1.0';
  if (SIMPLIFY) await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: SIMPLIFY.ratio, error: SIMPLIFY.error }));
  const after = prim.getIndices().getCount() / 3;
  await io.write(join(OUT, `${name}.glb`), doc);
  console.log(`✓ ${name}.glb — ${after} triangles${SIMPLIFY ? ` (au lieu de ${idx.length / 3})` : ''}, ${prim.getAttribute('POSITION').getCount()} sommets`);
  ok++;
}
console.log(`${ok}/${names.length} modèles convertis → public/models/nature/`);
