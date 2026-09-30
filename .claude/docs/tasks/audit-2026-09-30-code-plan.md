# Audit code — 30/09/2026 (qualité, maintenabilité)

Périmètre : `src/**/*.ts` (≈ 5 000 lignes), `scripts/*.mjs`, `vite.config.ts`, `tsconfig.json`.
Objectif : préparer « la ville vit », la fluidité et la fiabilisation du POC, par des gains ciblés (pas de refonte, site statique).

## Vérifications lancées

- `npm run build` (= `tsc --noEmit && vite build`) : **OK, 0 erreur de type**, 54 modules.
  - `dist/assets/index-*.js` **789 kB (216 kB gzip) en un seul morceau** → avertissement Vite « chunk > 500 kB ».
  - CSS 10,7 kB ; précache PWA 60 entrées (2,9 Mo).
- `tsconfig.json` déjà strict (`strict`, `noUnusedLocals`, `noUnusedParameters`) : pas de variable locale morte.
- Recherche d'exports non utilisés hors de leur fichier, de `any` / `as unknown as`, de `console.*`, de `localStorage`.

## Constats

| # | Constat | Fichier:ligne | Bénéfice | Effort | Risque |
|---|---------|---------------|----------|--------|--------|
| 1 | `main()` fait tout : chargement, calques, horloge, mini-jeu, fiches, sélection souris/doigt, double toucher, survol, boucle de rendu. Les passants (« la ville vit ») ajouteraient encore un bloc + une ligne dans la boucle | `src/main.ts:46-375` | Lisibilité, point d'ajout clair pour les passants | M | Faible (déplacement de code) |
| 2 | Boucle de rendu : 20 appels `update/animate` à la main, dans un ordre implicite ; aucun moyen de savoir « rien ne bouge » (ticket « moins d'images ») | `src/main.ts:345-371` | Ajouter un module = 1 ligne ; base pour le rendu à la demande | S | Faible |
| 3 | Pas de `catch` autour de `main()` : une exception après le chargement (terrain, monuments, étiquettes) = page vide sans message | `src/main.ts:377` | Fiabilité POC (écran d'erreur au lieu d'un écran vide) | S | Nul |
| 4 | Échec de `city.json` (réseau, JSON invalide, 404) → message développeur « Lance `npm run data` » aussi en production | `src/main.ts:36-50` | Message compréhensible par les amis testeurs | S | Nul |
| 5 | Test point-dans-polygone copié 4 fois (identique) | `src/scene/markers.ts:121`, `src/scene/nature.ts:35`, `scripts/fetch-osm.mjs:482`, `scripts/bdtopo.mjs:72` | Un seul module géométrie | S | Faible |
| 6 | `city.ts` et `mascot.ts` importent `pointInRing` depuis `nature.ts` (dépendance inversée : la ville dépend des arbres modélisés) | `src/scene/city.ts:7`, `src/scene/mascot.ts:5` | Graphe de dépendances propre, utile pour extraire le réseau de voies | S | Nul |
| 7 | Liste des voies piétonnes `FOOT` et hauteurs des rubans (0,14 / 0,18 / 0,9) dupliquées, le commentaire le reconnaît | `src/scene/city.ts:137-149`, `src/scene/mascot.ts:127-129` | Passants et éléphants resteront collés aux rues si on change une valeur | S | Nul |
| 8 | `mesh()` (Mesh + ombres) recopié 5 fois | `src/scene/models/carrecurial.ts:37`, `chateau.ts:48`, `cathedrale.ts:68`, `chateau-grille.ts:75`, `elephants.ts:27` | Moins de copier-coller dans les monuments | S | Nul |
| 9 | `distToSegment` en double ; `rand` (hachage) en double src/scripts (volontaire, commenté) ; `r1` 3 fois | `src/scene/nature.ts:44`, `scripts/fetch-osm.mjs:476` ; `src/scene/palette.ts:48`, `scripts/roofs.mjs:25` ; `src/dev/placement.ts:22`, `scripts/fetch-osm.mjs:92`, `scripts/roofs.mjs:21` | Faible (src ↔ scripts : .ts vs .mjs, mutualiser coûte plus qu'il ne rapporte) | S | Faible |
| 10 | Picking écran → NDC → raycaster réécrit 4 fois | `src/main.ts:254-258`, `src/main.ts:280-284`, `src/game/hunt.ts:88-90`, `src/dev/placement.ts:186-188` | Un helper `screenRay(canvas, camera, x, y)` réutilisable par les passants | S | Faible |
| 11 | `hitTargets()` recrée un tableau (spread + filter) à chaque survol souris, donc à chaque image où la souris bouge | `src/main.ts:251`, appelé via `pick` `:258`, `:329` | Moins d'allocations (fluidité) | S | Nul |
| 12 | Code mort : `weekday` jamais utilisé ; callback `onComplete` passé comme no-op | `src/time/chambery.ts:36` ; `src/main.ts:192`, `src/game/hunt.ts:48,135` | Moins de bruit | S | Nul |
| 13 | Nombre d'éléphants codé en dur `[0,1,2,3]` alors que `game.count` existe ; si ça ne correspond pas, le jeu est désactivé **sans message** | `src/main.ts:172,178` vs `src/scene/mascot.ts:402` | Fiabilité du mini-jeu | S | Nul |
| 14 | Réglages du jeu passés un par un depuis le JSON alors que `herd` a déjà `cfg.game` | `src/main.ts:181-183` | Moins de câblage dans main.ts | S | Faible |
| 15 | Outil de debug éléphants importé statiquement (dans le bundle de prod) alors que l'outil de placement est en `import()` dynamique ; `?debug` lu 2 fois | `src/main.ts:31,103,198` vs `:268-269` | Cohérence, bundle un peu plus petit | S | Nul |
| 16 | `window.diorama` exposé aussi en production | `src/main.ts:374` | Propreté (garder derrière `DEV` ou `?debug`) | S | Nul |
| 17 | Bundle unique 789 kB : chaque déploiement invalide aussi three.js (≈ 90 % du poids) dans le cache | build, `vite.config.ts` (pas de `build.rolldownOptions`) | Rechargement plus léger après mise à jour | S | Faible |
| 18 | Casts `as unknown as` sur les JSON de config (tuples non inférés) | `src/main.ts:77,89` ; `src/scene/stage.ts:45` (`-1` pour désactiver un geste, légitime) | Une faute dans `nature.json`/`mascot.json` passe le build | S | Faible |
| 19 | `mascot.ts` (646 lignes) mélange réseau de voies, obstacles, shader de marche, étoiles et machine à états ; le backlog prévoit d'en extraire le socle pour les passants | `src/scene/mascot.ts:127-263` (graphe, `blocker`, `wallDistance`, `mainComponent`) vs `:365-646` (troupeau) | Prérequis direct de « la ville vit » | M | Moyen (éléphants à retester) |
| 20 | 3 modules `state/*` quasi identiques (try/catch localStorage) — gestion d'erreur correcte partout | `src/state/progress.ts`, `points.ts`, `herd.ts` | Faible ; un `storage.ts` générique si un 4e état arrive | S | Nul |

Types : pas de `any` ; `Pt` unique dans `src/types.ts:1` ; type `(x, y) => number` réécrit 7 fois (`markers.ts:18` `HeightFn` exporté mais inutilisé ailleurs, `chateau-grille.ts:34`, `nature.ts:72`, `stage.ts:6`, `mascot.ts:365`, `labels.ts:50`, `models.ts:37`) → à mettre dans `types.ts`.
`console.warn` restants : tous sont des avertissements de données utiles (`models.ts:64,82`, `nature.ts:54-101`, monuments) ; `mascot.ts:377` déjà limité au dev. Pas de `console.log` de debug.

## Mini-plans des 3 chantiers les plus rentables

### A. Socle partagé géométrie + voies (constats 5, 6, 7, 10) — prérequis « la ville vit »
1. Créer `src/scene/geo.ts` : `pointInRing`, `distToSegment` (depuis `nature.ts:35,44`), et `screenRay(canvas, camera, x, y, raycaster)`.
2. Remplacer `inRing` (`markers.ts:121`) et les imports `./nature` (`city.ts:7`, `mascot.ts:5`) par `./geo`.
3. Créer `src/scene/roads.ts` : `FOOT`, `roadLift(kind, bridge)` ; l'utiliser dans `city.ts:137-149` et `mascot.ts:128-129`.
4. Utiliser `screenRay` dans `main.ts:254,280`, `hunt.ts:88`, `placement.ts:186`.
5. (Étape suivante, séparée) déplacer `buildGraph`/`blocker`/`wallDistance`/`mainComponent` de `mascot.ts` vers `src/scene/walkways.ts`.
Vérif : `npm run build` ; `?debug` : éléphants toujours sur les rues, clic sur une gemme et un bar, double toucher, outil de placement en dev.

### B. Alléger `main.ts` sans refonte (constats 1, 2, 14, 15, 16)
1. Boucle : un tableau `tickers: { update(dt, t) }[]` ; chaque module s'y ajoute ; `setAnimationLoop` ne fait plus que `quality`, contrôles, tickers, rendu. Point d'accroche naturel pour « moins d'images quand rien ne bouge ».
2. Extraire `src/interaction.ts` : `pick`, `hover`, double toucher, écouteurs pointer (`main.ts:248-338`), avec un tableau de cibles mis en cache (constat 11).
3. Extraire `src/game/setup.ts` : mini-jeu + slots + particules (`main.ts:165-205`), en passant `mascotContent.game` d'un bloc.
4. `const DEBUG = new URLSearchParams(location.search).has('debug')` une fois ; `herd-debug` en `import()` dynamique ; `window.diorama` seulement si `DEV || DEBUG`.
Vérif : `npm run build`, taille du bundle, parcours complet (fiche, bar survolé/épinglé, jeu éléphants, `?debug`).

### C. Fiabiliser le démarrage (constats 3, 4, 13)
1. `main().catch((e) => showFatal(app, 'La carte n'a pas pu démarrer', …))` à `main.ts:377`.
2. `loadCity` : distinguer 404 / réseau ; message « développeur » seulement si `import.meta.env.DEV`.
3. Slots : `Array.from({ length: mascotContent.game.count }, …)` ; si `slots.length !== herdTotal`, `console.warn` explicite.
Vérif : `npm run build` ; renommer temporairement `city.json` en local → message lisible ; mode avion avec et sans service worker.

## Ce qui est déjà bien

- TypeScript strict, 0 erreur, aucun `any` ; types de données centralisés (`src/types.ts`).
- Chaque chargement optionnel a son repli : arbres modélisés (`main.ts:76-82`), monuments un par un (`models.ts:82`), mascottes (`main.ts:88-93`).
- localStorage toujours sous try/catch avec repli en mémoire (`src/state/*.ts`), clés versionnées (`:v1`).
- HTML échappé (`esc`) partout où entrent des données OSM ou éditoriales (`ui.ts:104-176`).
- Outils de dev hors production : endpoint `apply: 'serve'` (`vite.config.ts:38`), placement en `import()` dynamique (`main.ts:268`), brouillons masqués (`main.ts:55`).
- Données versionnées par empreinte (`vite.config.ts:17-29`, `dataurl.ts`) et commentaires en français qui expliquent le « pourquoi ».
- Les restes du jeu de l'itération 34 (`catch.ts`, réglages de fuite) sont bien supprimés ; toutes les clés de `mascot.json.game` sont lues.
