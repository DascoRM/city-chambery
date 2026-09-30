# Audit données, chargement, PWA, build, déploiement — 30/09/2026

Auditeur : sub-agent (lecture seule). Base : `main` @ ceb6cf2, `npm run build` lancé (dist/ régénéré, ignoré par git).
Légende : **M** = mesuré ici · **E** = estimé (raisonnement, non mesuré dans un navigateur).

## Ce qui a évolué depuis le constat 7 de PERF-AUDIT (29/09)

| Élément | Constat 7 | Aujourd'hui (M) |
|---|---|---|
| `city.json` | 1,4 Mo / 406 Ko gzip | identique : 1 421 867 o / 405 Ko gzip-6 / **314 Ko brotli-11** |
| Code JS | 757 Ko / 199 Ko gzip | **789 Ko / 216 Ko gzip** (176 Ko brotli), un seul chunk (avertissement > 500 Ko) |
| Modèles | 18 arbres ≈ 500 Ko | **45 .glb** (44 arbres = 3 saisons + éléphant) : 677 Ko bruts / 442 Ko gzip |
| Compression serveur | « à vérifier » | ✅ gzip actif dans `deploy/nginx.conf:15-20` (glb inclus) ; pas de brotli |
| Mode hors-ligne | absent | PWA : **précache 60 entrées, 2 900 Kio** (sortie du build) |
| Cache HTTP | — | ✅ URL versionnées `?v=` + `immutable` (nginx `:6-9`, `vercel.json:11-14`) |

## Constats

| # | Constat | Source | Gain | Effort | Risque |
|---|---|---|---|---|---|
| 1 | **Double téléchargement à la 1re visite.** Le précache stocke `data/city.json` et les 45 .glb avec une révision : Workbox les redemande avec `?__WB_REVISION__=…` en mode `reload`, alors que l'appli vient de les charger en `?v=…`. Le cache HTTP ne sert donc pas | `vite.config.ts:102-106`, `dist/sw.js` (entrées `revision:"…"`), `src/main.ts:134` (SW enregistré après les chargements) | E : ≈ 0,55 Mo gzip en double (city 405 Ko + arbres de la saison) ; ≈ 0,85 Mo gzip au total pour l'installation du SW | S | faible |
| 2 | **Précache de toutes les saisons** : 44 arbres précachés, ≈ 18 utiles pour la saison courante (feuillus × 3 variantes) | `vite.config.ts:104`, `src/content/nature.json` (mixes) | E : ≈ 290 Ko gzip de moins à la 1re visite si seules les autres saisons passent en cache à la demande | S | moyen (changement de saison hors-ligne → arbres simples) |
| 3 | **`generatedAt` change à chaque génération** → nouvelle empreinte `dataVersion()`, nouvelle révision SW, bandeau « Nouvelle version » et ~405 Ko gzip rechargés par chaque visiteur **à chaque déploiement Coolify** (`REFRESH_DATA: "true"`), même si la carte n'a pas bougé. Champ inutilisé par le front | `scripts/fetch-osm.mjs:526`, `vite.config.ts:17-29`, `docker-compose.yml:15`, grep `generatedAt` dans `src/` = 0 | E : 405 Ko gzip × visiteurs × déploiements ; plus de faux bandeau | S | faible |
| 4 | **Arbres et éléphant sans compression meshopt.** Test en mémoire (glTF-Transform `meshopt`, niveau medium) sur les 45 fichiers | `scripts/convert-nature.mjs:132-134`, `convert-mascot.mjs:82-85` ; loaders `src/scene/nature.ts:75`, `models.ts:58`, `mascot.ts:396` sans `setMeshoptDecoder` | **M : 677 → 273 Ko bruts, 442 → 197 Ko gzip (−55 %)** ; décodeur three (E : ~10-20 Ko) | M | **moyen** : `quantize` ajoute une échelle/translation au nœud, or `nature.ts:80-81` ne garde que la géométrie ; le shader de marche de l'éléphant lit les positions des sommets |
| 5 | **Un seul chunk JS** (three + appli). Chaque mise à jour du code fait retélécharger 216 Ko gzip, alors que three ne change pas | build : `index-*.js` 789 Ko ; `package.json:17` | E : three ≈ 85-90 % du bundle → une mise à jour de l'appli ≈ 25-35 Ko gzip au lieu de 216 | S | faible |
| 6 | **Pas de brotli** : nginx officiel alpine n'a pas le module ; aucun fichier pré-compressé (`gzip_static`) → le Pi recompresse 1,4 Mo à chaque requête non cachée | `deploy/nginx.conf:15-20`, `Dockerfile:22` | **M : city.json 405 → 314 Ko (−23 %), JS 213 → 176 Ko (−17 %)** en brotli ; `gzip -9` seul : −1 % (400 Ko). Vercel : brotli automatique (non mesuré) | M (image nginx-brotli ou compression par le proxy Coolify) | faible |
| 7 | **Chargement en cascade** : `city.json` n'est demandé qu'après téléchargement + exécution du bundle (216 Ko gzip) ; les arbres seulement après construction de la ville | `index.html` (aucun preload), `src/main.ts:38,47,77` | E : chevauchement ≈ durée du JS (0,3-0,5 s en 4G) | S | faible (preload doit avoir la même URL `?v=` et `crossorigin`) |
| 8 | **Champs de `city.json` inutilisés par le front** : `ground` (bâtiments), `hSrc`, `generatedAt`, `stats`, `origin`, `anchors.*.osm/osmName`, `water.covered` | `src/types.ts` vs grep `src/` (0 lecture) ; `ground` « réservé au futur relief » (`types.ts:13`) | **M : −61 Ko bruts, −7,7 Ko gzip (−2 %)** | S | faible (`refresh-data.sh:22` lit `attribution`, à garder ; `hSrc` utile au débogage) |
| 9 | **Coordonnées** : déjà arrondies à 0,1 m (`fetch-osm.mjs:92-93`, terrain en entiers dm `:368`). Encodage entiers dm + deltas sur `outer`/`pts` | analyse node sur `city.json` | **M : 405 → 344 Ko gzip (−15 %)**, 314 → 274 Ko brotli | M (script + décodage dans `main.ts`) | moyen (tout le front lit `Pt[]`) |
| 10 | Répartition de `city.json` : bâtiments 74 % dont **`skel` 384 Ko** et `outer` 306 Ko ; routes 14 % ; terrain 3,8 % | M | piste pour le binaire (constat 7) : cibler `skel` + `outer` | L | moyen |
| 11 | Entrées de précache en double (4 icônes + manifeste) : `includeAssets` + `globPatterns` + icônes du manifeste | `dist/sw.js`, `vite.config.ts:90,104` | M : 5 entrées ; sans effet réseau (même révision) | S | nul |
| 12 | `.dockerignore` n'exclut pas `graphify-out/` (1,1 Mo) ; `workbox-*.js` (nom à empreinte, à la racine) servi en `no-cache` | `.dockerignore`, `nginx.conf:52-55` | M : 1,1 Mo de contexte ; revalidation d'un fichier | S | nul |
| 13 | Build Docker sur le Pi dépendant d'Overpass/IGN à chaque déploiement (`REFRESH_DATA: "true"`), non reproductible | `docker-compose.yml:15`, `deploy/refresh-data.sh` | temps de build, charge Overpass ; le repli évite la casse | S (passer à `false` et régénérer à la demande) | décision produit (DECISIONS 29/09) |
| 14 | Polices Google chargées depuis un tiers (1re visite, RGPD) | `index.html:11-13` | E : 1 connexion tierce ; auto-héberger ≈ 100 Ko woff2 | S | faible |

Dépendances : `npm audit --omit=dev` → 0 vulnérabilité ; seule dépendance de prod `three` ; `npm outdated` → seul TypeScript 7.0.2 disponible (5.9.3 installé, `~5.9.3` volontaire). Rien d'inutile en prod (le squelette droit, glTF-Transform et meshoptimizer sont en dev).

## Mini-plans des 3 plus rentables

### A. Supprimer le double téléchargement PWA (constats 1, 11) — S
1. `vite.config.ts` : retirer `json,glb` de `globPatterns` (garder js, css, html, png, webmanifest) ; retirer `png,webmanifest` du glob OU `includeAssets` pour dédoublonner.
2. Réutiliser la même empreinte : calculer `const VER = dataVersion()` une fois ; générer `workbox.additionalManifestEntries` = `[{ url: 'data/city.json?v='+VER, revision: null }, …chaque .glb de public/models avec ?v=VER]` (même parcours que `dataVersion()`).
3. Supprimer `ignoreURLParametersMatching: [/^v$/]` (les URL précachées sont exactement celles de l'appli).
4. `revision: null` → Workbox demande en mode `default` → servi par le cache HTTP (`immutable`), car `setupPwa` est appelé après les chargements (`main.ts:134`).
5. Optionnel (constat 2) : ne mettre dans `additionalManifestEntries` que les arbres verts + pins, et ajouter une `runtimeCaching` `CacheFirst` sur `/models/` pour les autres saisons.
- **Vérification** : `npm run build && npm run preview`, onglet Réseau, cache vidé : une seule requête réseau `city.json` (la 2e « from disk cache ») ; Application → Cache Storage contient `city.json?v=…` ; mode avion + rechargement : la carte s'ouvre. Changer un .glb → nouvelle empreinte → bandeau de mise à jour.

### B. Données stables d'un déploiement à l'autre (constat 3, + 13) — S
1. `scripts/fetch-osm.mjs:526` : retirer `generatedAt` de `city.json` (le garder dans la sortie console, ou l'écrire dans `data/raw/`, non publié).
2. Retirer `generatedAt` de `CityData` (`src/types.ts`).
3. Vérifier le déterminisme : `npm run data -- --offline` deux fois → `shasum public/data/city.json` identique ; idem `npm run nature` pour les .glb (déjà sans horodatage ? à vérifier).
4. Option : `REFRESH_DATA: "false"` par défaut, régénération manuelle (décision à reprendre avec Dasco, DECISIONS 29/09).
- **Vérification** : deux `npm run build` successifs après régénération hors ligne → même `__DATA_VERSION__` (grep dans `dist/assets/index-*.js`) et mêmes révisions dans `dist/sw.js`.

### C. Compression meshopt des modèles (constat 4) — M
1. `scripts/convert-nature.mjs` et `convert-mascot.mjs` : après `simplify`/`weld`, `meshopt({ encoder: MeshoptEncoder, level: 'medium' })` + extensions `EXTMeshoptCompression`, `KHRMeshQuantization` enregistrées sur `NodeIO` (`@gltf-transform/extensions`, déjà tiré par `functions`).
2. Problème de quantification : soit appliquer la matrice du nœud à la géométrie au chargement (`geo.applyMatrix4(mesh.matrixWorld)` après `gltf.scene.updateMatrixWorld()` dans `nature.ts:80-81` et `mascot.ts`), soit limiter la quantification (`quantizePosition: 16` + test visuel). À trancher en test.
3. Loaders (`nature.ts:75`, `models.ts:58`, `mascot.ts:396`) : `loader.setMeshoptDecoder(MeshoptDecoder)` depuis `three/addons/libs/meshopt_decoder.module.js` (un seul loader partagé idéalement).
4. `npm run nature && npm run mascot`, puis `npm run build`.
- **Vérification** : `du -b public/models` (attendu ≈ 273 Ko bruts) ; `?debug` : mêmes triangles ; comparaison visuelle arbres (taille, position au sol) des 3 saisons ; éléphant : marche, trot, disparition.

Suivants par rentabilité : vendor chunk three (constat 5, `build.rolldownOptions.output` / `codeSplitting` de Vite 8), preload de `city.json` via un plugin `transformIndexHtml` qui injecte `?v=` (constat 7), brotli (constat 6).

## Déjà bien

- Coordonnées déjà à 0,1 m et relief en entiers (dm) : la précision n'est pas le levier.
- Toits décidés et squelettes précalculés dans le script : pas de WASM dans l'appli (décision 28/09 respectée).
- Cache HTTP propre : `?v=` + `immutable`, `index.html` / `sw.js` / manifeste en `no-cache` (nginx et Vercel cohérents).
- gzip nginx actif, glb compris (442 Ko → gain réel −35 % sur les modèles).
- Outil de placement exclu de la prod (`import()` sous `import.meta.env.DEV`, `main.ts:268`) : `__dev/poi` absent du bundle (M).
- Service worker enregistré après le chargement de la carte, bandeau de mise à jour sans rechargement forcé.
- Image finale nginx sans Node, repli sur les données du dépôt si une source tombe.
- 0 vulnérabilité en prod, une seule dépendance de prod.
