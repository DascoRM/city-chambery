/**
 * Convertit le modèle de la mascotte (assets-src/) en .glb prêt pour le diorama
 * (public/models/mascotte/elephant.glb). Lancer : `npm run mascot`.
 *
 * Modèle source : « Elephant » par jeremy (Poly Pizza, https://poly.pizza/m/9J-cG39KYFC),
 * licence CC BY 3.0 : attribution obligatoire (voir README et crédits de l'application).
 *
 * Le modèle d'origine est statique (pas de squelette ni d'animation), à une échelle arbitraire
 * (≈ 192 unités de haut), trompe vers -X. Le script le remet aux conventions du projet :
 *  - unité = mètre, hauteur HEIGHT ;
 *  - origine au centre de la base (entre les quatre pattes), posée au sol ;
 *  - trompe vers +X (l'avant), Y vers le haut.
 * La marche est animée dans le shader (src/scene/mascot.ts), à partir de la position des sommets.
 */
import { join, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { weld, dedup, prune } from '@gltf-transform/functions';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'assets-src/Elephant by jeremy - 9J-cG39KYFC.glb');
const OUT_DIR = join(ROOT, 'public/models/mascotte');
const OUT = join(OUT_DIR, 'elephant.glb');
/** Hauteur finale en mètres (un vrai éléphant d'Afrique : ≈ 3 à 4 m ; un peu plus grand pour être vu) */
const HEIGHT = 4.5;

const io = new NodeIO();
const doc = await io.read(SRC);
const prims = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives());

// Boîte englobante du modèle entier, et centre de la base = milieu des pattes (sommets du bas)
const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
const p = [];
for (const prim of prims) {
  const a = prim.getAttribute('POSITION');
  for (let i = 0; i < a.getCount(); i++) {
    a.getElement(i, p);
    for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]); }
  }
}
const h = max[1] - min[1];
const feet = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
for (const prim of prims) {
  const a = prim.getAttribute('POSITION');
  for (let i = 0; i < a.getCount(); i++) {
    a.getElement(i, p);
    if (p[1] > min[1] + h * 0.05) continue;
    feet.x0 = Math.min(feet.x0, p[0]); feet.x1 = Math.max(feet.x1, p[0]);
    feet.z0 = Math.min(feet.z0, p[2]); feet.z1 = Math.max(feet.z1, p[2]);
  }
}
const cx = (feet.x0 + feet.x1) / 2, cz = (feet.z0 + feet.z1) / 2;
const s = HEIGHT / h;

// Demi-tour autour de Y (la trompe passe de -X à +X) : x → -x, z → -z
const done = new Set();
for (const prim of prims) {
  const pos = prim.getAttribute('POSITION');
  if (!done.has(pos)) {
    done.add(pos);
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, p);
      pos.setElement(i, [-(p[0] - cx) * s, (p[1] - min[1]) * s, -(p[2] - cz) * s]);
    }
  }
  const nor = prim.getAttribute('NORMAL');
  if (nor && !done.has(nor)) {
    done.add(nor);
    for (let i = 0; i < nor.getCount(); i++) {
      nor.getElement(i, p);
      nor.setElement(i, [-p[0], p[1], -p[2]]);
    }
  }
  // Pas de texture : les coordonnées UV sont inutiles
  const uv = prim.getAttribute('TEXCOORD_0');
  if (uv) prim.setAttribute('TEXCOORD_0', null);
}
for (const n of doc.getRoot().listNodes()) { n.setTranslation([0, 0, 0]); n.setRotation([0, 0, 0, 1]); n.setScale([1, 1, 1]); }
for (const m of doc.getRoot().listMaterials()) m.setMetallicFactor(0).setRoughnessFactor(0.85);

await doc.transform(prune(), dedup(), weld());
doc.getRoot().getAsset().copyright = 'Elephant by jeremy (Poly Pizza) — CC BY 3.0';
mkdirSync(OUT_DIR, { recursive: true });
await io.write(OUT, doc);
const tris = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).reduce((t, q) => t + (q.getIndices()?.getCount() ?? 0) / 3, 0);
console.log(`✓ ${OUT.replace(ROOT + '/', '')} — ${tris} triangles, ${HEIGHT} m de haut (échelle ${s.toFixed(4)})`);
