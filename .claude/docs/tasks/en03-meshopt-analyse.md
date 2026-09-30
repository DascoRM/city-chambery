# EN-03 — Analyse : compression meshopt des modèles

Itération 44 — 30/09/2026. Analyse seulement : **aucun code de l'appli ni aucun modèle n'a été modifié.**
L'essai a été fait dans un dossier de travail jetable (copie du dépôt, supprimée ensuite).

## Verdict : GO, avec un petit ticket de mise en œuvre (TI-04)

| | Avant | Après (meshopt, quantifié) | Écart |
|---|---|---|---|
| 44 arbres, octets bruts | 612 672 | 248 088 | −59,5 % |
| 44 arbres, gzip (ce que reçoit le visiteur) | 420 293 | 180 688 | −57,0 % |
| Éléphant, octets bruts | 64 340 | 21 116 | −67,2 % |
| Éléphant, gzip | 21 388 | 13 698 | −36,0 % |
| **Modèles, gzip au total** | **441 681** | **194 386** | **−247 Ko (−56 %)** |
| Décodeur meshopt (dans le fichier `three-….js`) | — | +7,3 Ko gzip (171,6 → 178,9) | |
| Fichier de l'appli (`index-….js`) | 44,53 Ko gzip | 44,77 Ko gzip | +0,2 Ko |
| **Premier chargement, net** | | | **≈ −240 Ko gzip (≈ −23 % sur ≈ 1 Mo)** |
| Précache du mode hors-ligne | 2 902 Kio | 2 530 Kio | −372 Kio (−12,8 %) |

gzip : somme des fichiers compressés un à un (niveau 9) ; nginx compresse déjà les `.glb` (`model/gltf-binary` dans `deploy/nginx.conf`), donc ces chiffres sont ceux des visiteurs. Le « −55 % » du backlog est confirmé.

**Le gain est multiplié à chaque déploiement.** L'empreinte des données (`dataVersion()` dans `vite.config.ts`) couvre `city.json` (avec `generatedAt`, régénéré à chaque build Docker avec `REFRESH_DATA=true`) et tous les `.glb` : après chaque déploiement, les visiteurs retéléchargent `city.json` et les modèles (≈ 800 Ko gzip). Les modèles passent de 442 à 194 Ko dans ce lot.

## Ce que l'essai a montré

### 1. La quantification est obligatoire pour gagner quelque chose

`meshopt()` de glTF-Transform = `reorder` + `quantize` + extension. Essai sans quantification (compression sans perte des flottants, `reorder` + extension seuls) :

| | gzip avant | gzip après | |
|---|---|---|---|
| 44 arbres | 420 293 | 278 024 | −33,8 % |
| Éléphant | 21 388 | 29 369 | **+37 %** (plus lourd) |

Donc : **quantifier** (positions en entiers 16 bits normalisés, normales 8 bits, couleurs 8 bits) ou ne rien faire.

### 2. Conséquence de la quantification : deux endroits du code lisent les positions

La quantification écrit les positions en entiers normalisés et met l'échelle (≈ ×3) et la translation **sur le nœud** glTF. Deux lecteurs du projet ne s'en occupent pas :

- `src/scene/nature.ts` ne garde que la géométrie du premier maillage (et ignore le nœud) : les arbres sortiraient minuscules ;
- le shader de marche de l'éléphant (`WALK_GLSL`, `src/scene/mascot.ts`) compare les positions à des seuils en mètres (`p0.y < 1.4`, `abs(p0.x) < 1.75`…) : avec des positions normalisées, les pattes, la trompe et les oreilles ne bougeraient plus au bon endroit.

**Solution essayée (elle marche) : remettre la géométrie en flottants et en mètres à la sortie du chargeur**, donc ni le shader ni `nature.ts` ne changent. Helper `src/scene/gltf.ts` (à créer, testé dans l'essai) :

```ts
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export const createGltfLoader = () => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

/** Positions quantifiées (entiers + échelle du nœud) → flottants en mètres, nœuds remis à zéro */
export function bakeToFloat(gltf: GLTF): GLTF {
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const pos = mesh.geometry.getAttribute('position');
    const geo = mesh.geometry.clone();
    const f = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { f[i * 3] = pos.getX(i); f[i * 3 + 1] = pos.getY(i); f[i * 3 + 2] = pos.getZ(i); }
    geo.setAttribute('position', new THREE.BufferAttribute(f, 3));
    geo.applyMatrix4(mesh.matrixWorld);
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    mesh.geometry = geo;
  });
  gltf.scene.traverse((o) => { o.position.set(0, 0, 0); o.quaternion.identity(); o.scale.set(1, 1, 1); });
  return gltf;
}
```

(`applyMatrix4` ne suffit pas seul : sur un attribut normalisé, il réécrit et re-normalise les valeurs, d'où la copie en `Float32Array` d'abord.)

### 3. Contrôles faits

- **Géométrie, 45 fichiers (les 44 arbres et l'éléphant), chargés avec le vrai chargeur** puis comparés à l'original par distance au plus proche sommet, dans les deux sens, en mètres : **écart maximal 0,36 mm** (éléphant) ; arbres ≤ 0,28 mm avant mise à l'échelle (≈ 1 mm une fois plantés). Aucun fichier en erreur, même nombre de sommets. Couleurs : moyenne identique.
- **Arbres à l'écran** (Chrome avec la carte graphique, parc avec 927 arbres modélisés dans la scène, même vue, 14 h, 1 200 × 800) : écart moyen 0,003 / 255, **0,0045 % des pixels au-delà de 8 / 255** (≈ 40 pixels, isolés), maximum 42. Indiscernable à l'œil.
- **Éléphant à l'écran** : corps, oreilles, défenses, pattes bien placés, donc les seuils du shader sont respectés. Pas de comparaison image par image : le tirage au hasard du troupeau n'est pas reproduit à l'identique d'un chargement à l'autre (les deux éléphants n'étaient pas au même endroit) ; la preuve est la géométrie ci-dessus, identique à 0,36 mm, qui est l'entrée du shader inchangé.
- **Décodage** : ≈ 2 ms par arbre, 9 ms pour l'éléphant (Chrome, puce M1) : négligeable. Le chargement complet de la page a été aussi long avec et sans compression (≈ 1,1 à 1,4 s en local).
- **Console** : aucune erreur, aucun avertissement sur les arbres, la mascotte ou les modèles ; 18 modèles et 927 instances dans les deux versions.

### 4. Pas vérifié

- **Safari / iOS et mobiles modestes** : le décodeur de three a un repli sans WebAssembly, mais non testé ; temps de décodage sur téléphone non mesuré ;
- **de nuit** et sous d'autres saisons (arbres d'automne, branches nues) : seulement le jour (14 h) et les arbres verts testés ; les normales passent à 8 bits, les facettes étant plates (`flatShading`) ça ne doit rien changer, mais non vérifié à l'œil ;
- le **service worker** avec les fichiers compressés (le précache a seulement été compté au build) ;
- niveau `medium` de `meshopt()` (normales à 10 bits, un peu plus gros) : seul `high` a été essayé (normales à 8 bits).

## Plan de mise en œuvre — TI-04 (petit, une itération)

1. `package.json` : ajouter `@gltf-transform/extensions` aux devDependencies (aujourd'hui seulement en dépendance indirecte) ; **commiter `package-lock.json`** ;
2. `scripts/convert-nature.mjs` et `scripts/convert-mascot.mjs` : `NodeIO` avec `registerExtensions(ALL_EXTENSIONS)` et `registerDependencies({ 'meshopt.encoder': MeshoptEncoder })` (`await MeshoptEncoder.ready`), puis `meshopt({ encoder: MeshoptEncoder, level: 'high' })` en dernière transformation ; relancer `npm run nature` et `npm run mascot` ;
3. `src/scene/gltf.ts` (ci-dessus) utilisé par `nature.ts`, `mascot.ts` et `models.ts` (les trois `new GLTFLoader()`) ;
4. README : section « Arbres modélisés » et « Mascottes » (les `.glb` sont compressés, `bakeToFloat`), section Licences (décodeur meshopt, MIT, livré avec three) ; `public/models/README.md` : un export Blender peut être passé par le même décodeur ;
5. Vérifier : `npm run build` ; mêmes contrôles que l'essai (géométrie, image d'un parc, éléphant, console) ; en plus : nuit et hiver, un passage sur iPhone si possible, mode hors-ligne (`npm run build && npm run preview`).

Les modèles changent donc l'empreinte des données (nouvelle version à la publication, comme à chaque déploiement).

## Alternatives écartées

- **Compression sans perte seule** : −34 % sur les arbres et l'éléphant plus lourd (voir plus haut) ;
- **Draco** : non essayé ; son décodeur est nettement plus lourd que celui de meshopt, déjà disponible dans three, et meshoptimizer est déjà un outil du projet (simplification des arbres) ;
- **Ne rien faire** : 247 Ko gzip à retélécharger à chaque déploiement, pour ≈ 7 Ko de décodeur.

## Méthode (pour reproduire)

1. Copie du dépôt (`git worktree`) avec les modèles remplacés par leur version compressée (`@gltf-transform/functions` : `meshopt({ encoder: MeshoptEncoder, level: 'high' })`, `NodeIO` avec `ALL_EXTENSIONS`) ;
2. variante de l'appli avec `src/scene/gltf.ts` branché dans les trois chargeurs ; deux serveurs Vite côte à côte (il faut un `cacheDir` différent pour chacun si `node_modules` est partagé par lien) ;
3. Chrome sans fenêtre avec la carte graphique (voir la mémoire « tests avec GPU ») : hasard figé par un générateur de qualité (`mulberry32` ; un générateur congruentiel simple bloquait une boucle de tirage du troupeau), troupeau gelé, heure fixée ; comparaison d'images dans la page (canvas) ; comparaison de géométrie par un module chargé par Vite.
