/**
 * Convertit les pièces retenues du pack de bâtiments (assets-src/buildings, « Building Kit » de Kenney, CC0)
 * en un seul fichier glTF : public/models/buildings/details.glb, une pièce par nœud nommé.
 * Lancer : `npm run buildings`. Pièces, échelle et décalages : src/content/buildings.json.
 *
 * Particularités du pack :
 *  - les couleurs viennent d'une texture de palette lue par les coordonnées UV (et non de couleurs de
 *    matériau) : lues ici et écrites en couleurs de sommet (linéaires), sans texture, comme les arbres ;
 *  - les pièces sont des modules de mur (1 × 0,63 × 1) : `part: "protrude"` ne garde que ce qui dépasse du
 *    mur (z > 0,505), par exemple l'auvent d'un module de toit ;
 *  - `tint` remplace les couleurs par des gris clairs (luminance) : la pièce se teinte alors par instance.
 * La conversion est déterministe : même résultat à chaque lancement.
 */
import { join, dirname } from 'node:path';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { readPng, readObj, bounds, srgbToLinear } from './lib/kenney-obj.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'assets-src/buildings');
const OUT_DIR = join(ROOT, 'public/models/buildings');
const OUT = join(OUT_DIR, 'details.glb');
const config = JSON.parse(readFileSync(join(ROOT, 'src/content/buildings.json'), 'utf8'));

const palette = readPng(join(SRC, 'Textures/colormap.png'));

/** Garde les triangles qui dépassent du mur, puis retire les sommets devenus inutiles. */
function protrudingPart(piece) {
  const keep = [];
  for (let t = 0; t < piece.indices.length; t += 3) {
    const tri = [0, 1, 2].map((k) => piece.indices[t + k]);
    if (tri.some((i) => piece.positions[i * 3 + 2] > 0.505)) keep.push(...tri);
  }
  const map = new Map(), positions = [], colors = [], indices = [];
  for (const i of keep) {
    if (!map.has(i)) { map.set(i, positions.length / 3); positions.push(...piece.positions.slice(i * 3, i * 3 + 3)); colors.push(...piece.colors.slice(i * 3, i * 3 + 3)); }
    indices.push(map.get(i));
  }
  return { positions: Float32Array.from(positions), colors: Float32Array.from(colors), indices: Uint32Array.from(indices) };
}

/** Gris clair d'après la luminance, le plus clair de la pièce valant 1 et le plus sombre 0,7 : la pièce se teinte ensuite par instance. */
function tinted(piece) {
  const lum = [];
  for (let i = 0; i < piece.colors.length; i += 3) lum.push(0.2126 * piece.colors[i] + 0.7152 * piece.colors[i + 1] + 0.0722 * piece.colors[i + 2]);
  const max = Math.max(...lum) || 1;
  const colors = new Float32Array(piece.colors.length);
  lum.forEach((l, k) => { colors[k * 3] = colors[k * 3 + 1] = colors[k * 3 + 2] = 0.7 + 0.3 * (l / max); });
  return { ...piece, colors };
}

/** Remplace les couleurs très sombres (l'ardoise du pack, luminance < 0,12) par `hex`, en gardant les nuances entre elles. */
function slated(piece, hex) {
  const target = srgbToLinear([1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)));
  const colors = Float32Array.from(piece.colors);
  for (let i = 0; i < colors.length; i += 3) {
    const l = 0.2126 * colors[i] + 0.7152 * colors[i + 1] + 0.0722 * colors[i + 2];
    if (l >= 0.12) continue;
    const k = Math.min(1.15, Math.max(0.75, l / 0.055));
    for (let c = 0; c < 3; c++) colors[i + c] = Math.min(1, target[c] * k);
  }
  return { ...piece, colors };
}

const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene('details');
const material = doc.createMaterial('piece').setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(0.9);
doc.getRoot().getAsset().copyright = 'Building Kit by Kenney (www.kenney.nl) — CC0 1.0';

for (const [name, def] of Object.entries(config.pieces)) {
  let piece = readObj(join(SRC, `${def.obj}.obj`), palette);
  if (def.part === 'protrude') piece = protrudingPart(piece);
  if (!piece.indices.length) { console.warn(`⚠️  ${name} (${def.obj}) : aucun triangle, pièce ignorée`); continue; }
  if (def.tint) piece = tinted(piece);
  if (def.slate) piece = slated(piece, def.slate);
  const [ox, oy, oz] = def.offset ?? [0, 0, 0];
  const pos = new Float32Array(piece.positions.length);
  for (let i = 0; i < pos.length; i += 3) {
    pos[i] = (piece.positions[i] + ox) * config.scale;
    pos[i + 1] = (piece.positions[i + 1] + oy) * config.scale;
    pos[i + 2] = (piece.positions[i + 2] + oz) * config.scale;
  }
  const idx = pos.length / 3 < 65536 ? Uint16Array.from(piece.indices) : piece.indices;
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer))
    .setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(piece.colors).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(idx).setBuffer(buffer))
    .setMaterial(material);
  scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
  const b = bounds({ positions: pos });
  console.log(`  ${name.padEnd(11)} ${String(piece.indices.length / 3).padStart(3)} triangles · ${b.size.map((v) => v.toFixed(2)).join(' × ')} m · depuis ${def.obj}${def.part ? ` (${def.part})` : ''}`);
}
mkdirSync(OUT_DIR, { recursive: true });
await new NodeIO().write(OUT, doc);
console.log(`✓ ${OUT.replace(ROOT + '/', '')}`);
