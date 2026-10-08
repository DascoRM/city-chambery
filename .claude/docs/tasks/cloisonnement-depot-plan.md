# Plan : cloisonner le dépôt (site / API / administration)

> Plan d'architecture rédigé le 08/10/2026 sur la branche `feat/EP008-back-end` (commit `6477cfc`). Rien n'est implémenté.
> L'administration React est planifiée par un autre agent ; ce plan lui réserve sa place dans la structure et fixe ses règles d'import.
> **Vérifié** : lecture du code, des configurations et de la doc Vercel (sources citées en fin de document).
> **Non vérifié** : aucune commande lancée (pas de build, pas de déploiement d'essai). Les temps de build sont des estimations.

---

## 1. Inventaire : ce qui couple aujourd'hui les parties

### 1.1 Arborescence actuelle (parties concernées)

| Partie | Où | Taille | Construit par |
|---|---|---|---|
| Site (diorama) | `index.html`, `src/` (TS + Three.js), `src/content/*.json` (11 fichiers), `src/style.css` | ~10 500 lignes | `vite.config.ts` à la racine |
| API | `api/index.ts` (entrée Vercel, 1 fonction) → `server/` (Hono, Zod, Drizzle) | ~400 lignes + tests | Vercel (fonction Node) ; `tsx` en dev |
| Administration | `public/admin/` (`index.html`, `admin.js` 60 lignes non typé, `admin.css`) | 130 lignes | **Rien** : copiée telle quelle par Vite depuis `public/` |
| Données | `scripts/*.mjs` → `public/data/city.json`, `public/models/**` | — | `npm run data`, `nature`, `mascot`, `buildings` |
| Déploiement | `vercel.json`, `Dockerfile`, `docker-compose.yml`, `deploy/nginx.conf`, `deploy/refresh-data.sh` | — | — |

Remarque : le point d'entrée Vercel est désormais `api/index.ts` (et non `api/[...path].ts`) avec la réécriture `/api/:path*` → `/api` (commit `07309ef`).

### 1.2 Couplages constatés

**Imports de code**
- `api/index.ts` → `../server/app.js` (relatif, extension `.js` obligatoire : contrôlé par `scripts/check-api-esm.mjs`).
- `src/` n'importe **rien** de `server/`, et `server/` rien de `src/` : aucun type partagé. Conséquence : le contrat API est dupliqué à la main (ex. `DB_LABEL` dans `admin.js` recopie le type `DbStatus` de `server/app.ts` ; aucune vérification).
- `public/admin/admin.js` : aucun import, appelle `/api/admin/status` en `fetch` brut, réponse non typée.
- `src/scene/parking-edits.ts` définit `ParkingOverride` / `ParkingEdits` (interfaces TS) et une validation manuelle : **c'est exactement le contrat que l'API, l'admin et le site devront partager en US006** (retouches publiées en base, lues par le site).

**Contenu éditorial (`src/content/`) : trois consommateurs déjà, quatre demain**
- Le site l'importe au build (12 `import … from './content/*.json'` dans `main.ts`, `ui/parking-card.ts`).
- Les scripts le lisent : `fetch-osm.mjs` (`pois.json`), `convert-nature.mjs` (`nature.json`), `convert-buildings.mjs` (`buildings.json`).
- Le serveur de dev Vite l'**écrit** : plugin `poiPlacementApi` dans `vite.config.ts` (POST `/__dev/poi` → `src/content/pois.json`).
- Demain : l'API/admin (US006 « export périodique en JSON dans le dépôt »).
- → `src/content` n'est pas « du code du site » : c'est une donnée partagée rangée dans le site.

**Fichiers statiques (`public/`)**
- `public/data/city.json` et `public/models/**` : écrits par `scripts/`, lus par le site à l'exécution (`dataUrl('data/city.json')`), empreintés au build par `dataVersion()` dans `vite.config.ts`. Demain lus aussi par l'admin (carte de position, US007).
- `public/admin/` : l'admin vit dans le dossier statique du site → elle est copiée dans `dist/admin/` à chaque build du site.

**Configuration TypeScript (3 fichiers + 1 script)**
- `tsconfig.json` (racine) = **le site** (`include: ["src"]`, DOM, `vite/client`).
- `tsconfig.api.json` = API (`api`, `server`, `drizzle.config.ts`, types Node).
- `tsconfig.vercel-check.json` = recompile `api/` **avec le tsconfig racine du site**, parce que Vercel compile les fonctions avec le `tsconfig.json` racine. C'est un couplage subi : le tsconfig du site gouverne la compilation de l'API sur Vercel (d'où les `/// <reference types="node" />` en tête des fichiers de `server/`).
- `scripts/check-api-esm.mjs` : compile l'API, la charge avec Node, appelle `/api/health`.
- `npm run build` enchaîne tout : `tsc` site + `tsc` API + `tsc` vercel-check + check-api-esm + `vite build`.

**Build et Vite**
- Un seul `vite.config.ts` pour le site, qui contient aussi : le proxy `/api` → `:8787` (dev), le plugin de placement (dev), `__DATA_VERSION__`, la PWA.
- `vitest run` (sans config dédiée) **charge ce `vite.config.ts`** : les tests de l'API passent par la config du site (PWA, `dataVersion()` qui lit `public/`).

**PWA (`vite-plugin-pwa`)**
- `globIgnores: ['admin/**']` et `navigateFallbackDenylist: [/^\/api\//, /^\/admin/]` : l'admin est sortie du service worker **par exception**, parce qu'elle est dans `public/`. Fonctionne, mais fragile (tout nouveau fichier admin hors de `admin/` serait précaché).

**Vercel (`vercel.json`)**
- Un seul projet, racine = racine du dépôt ; `buildCommand: npm run build`, `outputDirectory: dist`, `framework: vite`.
- Fonctions : dossier `api/` **à la racine du projet Vercel** (contrainte de la plateforme).
- En-têtes `noindex` sur `/(admin|api)(.*)` ; réécriture `/api/:path*`.
- La CSP de l'admin est dans une balise `<meta>` de `public/admin/index.html` (bloquerait le préambule inline de React en dev).

**Docker / Coolify**
- `Dockerfile` : `COPY package.json package-lock.json` → `npm ci` → `COPY . .` → `refresh-data.sh` (écrit `public/data/city.json`) → `npm run build` → nginx sert `dist/`.
- **nginx ne sert que du statique : sur le Pi il n'y a pas d'API.** L'admin y est donc publiée mais inutilisable (404 sur `/api`). Le site, lui, retombe sur `localStorage` (règle « site d'abord »).
- `npm run build` dans Docker vérifie aussi l'API (types + check-api-esm) : c'est utile mais allonge le build du Pi.

**Dépendances (un seul `package.json`)**
- Prod : `three` (site), `hono`, `drizzle-orm`, `postgres`, `zod` (API). Dev : outils des scripts (`@gltf-transform/*`, `meshoptimizer`, `straight-skeleton`), de l'API (`tsx`, `drizzle-kit`, `pglite`, `@hono/node-server`), du site (`vite`, `vite-plugin-pwa`, `workbox-window`). Tout est mélangé mais sans gêne réelle : Vite n'embarque que ce qui est importé.

**Code « miroir » entre scripts et site** (couplage implicite, hors périmètre mais à noter) : `scripts/geo.mjs` recopie `src/scene/geo.ts` ; `scripts/roofs.mjs` recopie le hachage de `src/scene/palette.ts`. Les scripts sont en `.mjs` sans TypeScript.

**US007 (carte de position de l'admin)** : la spec demande « même rendu que l'application (même moteur) ». Or le moteur est câblé dans `src/main.ts` (559 lignes, 50 imports) et l'outil existant `src/dev/position-picker.ts` dépend de `scene/geo`, `interaction`, `types`. C'est le **plus gros couplage à venir** entre site et admin.

---

## 2. Options de structure

### Option A : dossiers cloisonnés, un seul `package.json`, un seul projet Vercel ← recommandée

```
/
├── api/index.ts          entrée Vercel (inchangée : contrainte de la plateforme)
├── server/               API Hono (inchangée)
├── web/                  le site (ex-src/, index.html, vite.config.ts)
├── admin/                l'administration React (index.html, src/, vite.config.ts)
├── shared/               contrat API (schémas Zod) + types/fonctions purs, sans DOM ni Node
├── content/              ex-src/content : JSON éditoriaux (site, scripts, admin/API)
├── public/               city.json, modèles, icônes (statiques du site, inchangé)
└── scripts/              pipeline de données + contrôles
```
- **Vercel** : rien ne change côté projet (racine du dépôt, `api/` à la racine, `dist/` en sortie). Les fonctions importent `server/` et `shared/` en relatif, comme aujourd'hui `../server/app.js` : Vercel suit déjà ces imports hors de `api/`. Seul point d'attention : Vercel **ne gère pas** les `paths` ni les *project references* de TypeScript pour compiler les fonctions (doc Node.js runtime, citée) → imports relatifs obligatoires côté API, pas d'alias `@shared/…`.
- **Docker/Coolify** : `npm ci` inchangé (un seul lock). Le Dockerfile ne bouge presque pas.
- **PWA** : l'admin est construite par son propre `vite build` dans `dist/admin/` **après** le site ; le service worker du site est généré avant, donc l'admin n'y entre jamais par construction (les exclusions actuelles restent comme filet).
- **npm ci / lock** : un seul `package-lock.json` ; ajouter React = `npm install` + commit du lock (règle 4).
- **Build** : +1 `vite build` (admin, quelques secondes, non mesuré) et +1 `tsc`. Le `tsc` du vercel-check disparaît (voir § 3.3).
- **Solo** : aucun nouvel outil, pas de workspaces ; le cloisonnement est assuré par tsconfig + un script de contrôle.
- ❌ Les dépendances restent dans un seul `package.json` : rien n'empêche *techniquement* `server/` d'importer `three` ; le script de contrôle le fait respecter.

### Option B : workspaces npm (`apps/web`, `apps/admin`, `apps/api`, `packages/shared`)

- **Vercel, un seul projet à la racine** : possible, mais `api/` doit rester à la racine du projet ; `apps/api` ne serait qu'un dossier de code importé. Importer `@diorama/shared` passe par un lien symbolique dans `node_modules` vers des sources `.ts` : Node ne charge pas du `.ts` depuis `node_modules`, et je n'ai **pas** pu vérifier que Vercel transpile un paquet de workspace en TypeScript → il faudrait **compiler `shared` en JS** (étape de build + `exports` vers `dist/`, mode watch en dev). Sinon on revient aux imports relatifs, et le workspace n'apporte plus grand-chose.
- **Vercel, un projet par app** (la voie « officielle » des monorepos : un *Root Directory* par projet) : 3 projets, 3 domaines → CORS, en-tête du jeton admin en cross-origin, réécritures pour tout servir sous un domaine (« Related Projects », max 3 projets liés), 3 builds par poussée alors que le Hobby n'a **qu'un build simultané** (FAQ monorepos). `git.deploymentEnabled` et variables d'environnement à dupliquer par projet. Le « skip unaffected projects » aide, mais exige que chaque paquet ait un `name` unique et des dépendances internes déclarées. Disproportionné.
- **Docker** : `npm ci` exige que **tous** les `package.json` de workspaces soient présents avant l'installation → le Dockerfile doit copier `apps/*/package.json` et `packages/*/package.json` avant `npm ci` (sinon échec ou installation incomplète). Plus de risques de lock désynchronisé.
- **PWA** : naturellement isolée (build séparé), comme en A.
- **Gain réel** : dépendances séparées par app (React seulement dans admin, three seulement dans web). Mais avec le *hoisting* npm, un import non déclaré reste résolu : le cloisonnement des dépendances n'est **pas garanti** sans outil supplémentaire.
- **Coût** : 4 à 6 jours, et une marche d'apprentissage (workspaces, build de `shared`, Docker) pour un projet solo de ~11 000 lignes.

### Option C : « A minimale » (statu quo + `admin/` + `shared/`)

- Garder `src/` et `index.html` à la racine pour le site ; ajouter seulement `admin/` (React) et `shared/` ; script de contrôle des imports.
- 1,5 à 2 jours. Mais la racine reste ambiguë (`src/` = le site, `tsconfig.json` racine = le site, ce qui continue de gouverner la compilation de l'API sur Vercel), et `src/content` reste rangé dans le site alors que quatre parties s'en servent.
- C'est en fait **les premières étapes de A** : on peut s'arrêter là si le temps manque.

(Option écartée : séparer l'API dans un autre dépôt. Contraire à l'ADR-001 : même dépôt, mêmes types, un seul build.)

### Comparatif

| Critère | A (dossiers) | B (workspaces) | C (A minimale) |
|---|---|---|---|
| Projet Vercel | 1, inchangé | 1 (avec build de `shared`) ou 3 (CORS, 3 builds, 1 build simultané en Hobby) | 1, inchangé |
| `api/` à la racine | oui, inchangé | oui (1 projet) | oui |
| Docker / `npm ci` | inchangé | Dockerfile à revoir (copie des `package.json`) | inchangé |
| PWA : admin hors du SW | par construction | par construction | par construction |
| Contrat partagé typé | `shared/` (relatif) | `packages/shared` (compilé) | `shared/` |
| Cloisonnement garanti par | tsconfig + script | package.json (+ script quand même) | tsconfig + script |
| Clarté de la racine | bonne | très bonne | moyenne |
| Effort | 3 à 4 j | 4 à 6 j | 1,5 à 2 j |
| Réversible vers B plus tard | oui (les dossiers deviennent des paquets) | — | oui |

---

## 3. Recommandation : option A, menée par étapes (C d'abord, puis le reste)

**Pourquoi** : elle donne le cloisonnement voulu (une partie = un dossier, un tsconfig, des règles d'import vérifiées au build) sans toucher au projet Vercel, au Dockerfile ni au lock, qui viennent d'être stabilisés au prix de plusieurs correctifs (`07309ef`, `ca1f53f`, `39d9277`). Les workspaces règlent surtout des problèmes d'équipe et de dépendances lourdes que ce projet n'a pas ; et la structure A se convertit en workspaces plus tard sans déplacer de fichiers (chaque dossier recevrait son `package.json`).

### 3.1 Arborescence cible

```
/
├── api/
│   └── index.ts                 entrée Vercel (3 lignes) → ../server/app.js
├── server/                      API (Hono, Zod, Drizzle) — inchangé
│   ├── app.ts, auth.ts, env.ts, dev.ts, *.test.ts
│   └── db/ (schema, migrations, client, stats)
├── shared/                      ni DOM, ni Node, ni three : seulement zod
│   ├── tsconfig.json            lib ES2022, types: []
│   ├── contract/
│   │   ├── health.ts            schéma de /api/health et /api/admin/status (DbStatus…)
│   │   ├── parkings.ts          ParkingOverride / ParkingEdits en Zod (ex-src/scene/parking-edits.ts, US006)
│   │   └── progress.ts          (US002) progression, code personnel
│   └── geo.ts                   (plus tard, si utile) types Pt, fonctions pures partagées
├── web/                         le site
│   ├── index.html
│   ├── vite.config.ts           root: web, publicDir: ../public, outDir: ../dist, PWA, plugin de placement
│   ├── tsconfig.json            DOM, vite/client
│   └── src/                     ex-src/ (sans content/)
├── admin/                       l'administration React (plan de l'autre agent)
│   ├── index.html
│   ├── vite.config.ts           base: /admin/, outDir: ../dist/admin, publicDir: false, plugin React, proxy /api
│   ├── tsconfig.json            DOM, jsx: react-jsx
│   └── src/
├── content/                     ex-src/content (pois, parkings, nature, mascot…)
├── public/                      data/city.json, models/, icons/ (statiques du site ; plus d'admin/)
├── scripts/                     pipeline données + check-api-esm.mjs + check-boundaries.mjs
├── deploy/, Dockerfile, docker-compose.yml
├── tsconfig.json                = config de l'API (celle que Vercel lit pour compiler api/)
├── vercel.json, drizzle.config.ts, vitest.config.ts
└── package.json, package-lock.json
```

Choix argumentés :
- **`public/` reste à la racine** : `city.json` et les modèles sont produits par les scripts et lus à l'exécution par le site **et** l'admin (même origine, `/data/city.json`). Les déplacer dans `web/public` multiplierait les changements (scripts, `refresh-data.sh`, `dataVersion()`, règle 3 de CLAUDE.md) sans bénéfice. Le site les sert via `publicDir: '../public'` ; l'admin a `publicDir: false` (sinon `city.json` serait recopié dans `dist/admin/`).
- **`content/` sort du site** : quatre consommateurs (site, scripts, plugin de placement, export US006). Le site continue de l'importer au build (`import pois from '../../content/pois.json'`).
- **`tsconfig.json` racine = API** : Vercel compile `api/` avec le tsconfig racine (doc Node.js runtime) ; aujourd'hui c'est celui du site, d'où `tsconfig.vercel-check.json` et les `/// <reference types="node" />`. En faisant du tsconfig racine celui de l'API, on supprime ce contournement (un fichier et un `tsc` de moins). **À valider par un déploiement `preview/…`** avant de supprimer le contrôle (voir risques).
- **Build de l'admin après celui du site** : `vite build` du site vide `dist/` puis génère `sw.js` ; le build admin écrit ensuite `dist/admin/` (option `emptyOutDir: true` explicite, car hors de sa racine). Le service worker ne connaît donc jamais l'admin. On garde `globIgnores` et `navigateFallbackDenylist` comme filet.

### 3.2 Règles de dépendances (qui importe qui)

| Partie | Peut importer | Ne doit jamais importer |
|---|---|---|
| `api/` | `server/` | tout le reste |
| `server/` | `shared/`, paquets Node/API (`hono`, `zod`, `drizzle-orm`, `postgres`) | `web/`, `admin/`, `three`, `react`, `content/` (*) |
| `web/` | `shared/`, `content/*.json`, `three`, `workbox-window` | `server/`, `admin/`, `api/`, `react` |
| `admin/` | `shared/`, `react`, `react-dom` (+ ce que l'autre plan retiendra) | `server/` (sauf `import type` : voir plus bas), `web/`, `api/`, `content/` (passe par l'API) |
| `shared/` | `zod` uniquement | tout le reste (pas de DOM, pas de `node:*`, pas de `three`) |
| `scripts/` | `content/` (lecture), `public/` (écriture) | `server/`, `admin/` |

(*) L'export des retouches dans le dépôt (US006/US010) ne passe pas par la fonction Vercel (qui n'a pas d'accès en écriture au dépôt) mais par un script ou une action GitHub qui appelle l'API : il vit dans `scripts/`, pas dans `server/`.

**Contrat API** : les schémas Zod vivent dans `shared/contract/` ; le serveur s'en sert pour **valider** (`schema.parse`) et le client (site, admin) pour **typer et vérifier les réponses** (`z.infer`, et `safeParse` à la réception : une API d'une autre version ne fait pas planter le site). Je déconseille le client RPC de Hono (`hc<AppType>`) : il oblige l'admin et le site à importer un type de `server/`, donc à dépendre de l'arbre de types de l'API (Drizzle, Node).
Coût côté site : Zod dans le bundle du site (de l'ordre de 15 à 60 Ko min. selon l'usage, **non mesuré** ; `zod/mini` réduit fortement). À n'introduire dans `web/` qu'avec US002, et à mesurer.

**Imports dans `shared/`** : relatifs, **avec extension `.js`** (ils sont chargés par Node sur Vercel via `server/`) ; `check-api-esm.mjs` les couvre déjà puisqu'il compile et charge tout ce que l'API importe. Pas d'alias `paths` côté API (non gérés par Vercel). Pour `web/` et `admin/`, un alias Vite `@shared` est possible mais inutile au départ : rester en relatif partout = une seule règle.

**Comment le faire respecter** (trois verrous, du plus simple au plus fort) :
1. **tsconfig par partie**, avec `lib`/`types` adaptés : `shared/tsconfig.json` sans `DOM` ni `node` → un `document` ou un `node:fs` dans `shared/` est une erreur de compilation. `server` sans `DOM` (aujourd'hui l'API a `DOM` dans `lib` : à retirer, l'API n'en a pas besoin hors `Request`/`Response`, fournis par les types Node récents — **à vérifier** à la compilation).
2. **`scripts/check-boundaries.mjs`** (≈ 50 lignes, sans dépendance, même esprit que `check-api-esm.mjs`) : parcourt `api/ server/ shared/ web/src admin/src`, extrait les `import … from '…'`, `import('…')` et `export … from '…'`, résout les chemins relatifs et les noms de paquets, et échoue si une règle du tableau est violée (liste blanche par partie). Lancé dans `npm run build`, donc sur Vercel et dans Docker. Message d'erreur explicite : « web/src/x.ts importe server/app.ts : interdit (web → server) ».
3. (Facultatif, plus tard) ESLint `no-restricted-imports` ou `dependency-cruiser` : écartés pour l'instant (aucun linter dans le projet ; une dépendance de plus pour ce qu'un script de 50 lignes fait).

### 3.3 Scripts npm cibles

```
"dev":          "vite --config web/vite.config.ts"
"dev:admin":    "vite --config admin/vite.config.ts"          (port 5174, proxy /api → 8787)
"api:dev":      "tsx server/dev.ts"                            (inchangé)
"typecheck":    "tsc --noEmit && tsc --noEmit -p web && tsc --noEmit -p admin && tsc --noEmit -p shared"
"check":        "node scripts/check-boundaries.mjs && node scripts/check-api-esm.mjs"
"build:web":    "vite build --config web/vite.config.ts"
"build:admin":  "vite build --config admin/vite.config.ts"
"build":        "npm run typecheck && npm run check && npm run build:web && npm run build:admin"
"test":         "vitest run"                                   (vitest.config.ts racine, environnement node, include server/** et shared/**)
```
(`tsc -b` avec *project references* est possible pour le typecheck local, mais Vercel ignore les références pour les fonctions ; des `tsc -p` séparés restent plus simples à lire.)

---

## 4. Plan de migration (chaque étape : `npm run build` vert, déploiement fonctionnel)

Règle commune à chaque étape : branche `feat/EP008-cloisonnement-<étape>` dans la branche d'epic ; `npm run build` + `npm test` ; pour les étapes qui touchent Vercel (2, 3, 5), pousser sur `preview/cloisonnement` et vérifier `/`, `/api/health`, `/admin/` et l'installation PWA (onglet Application : `sw.js` sans fichier `admin/`) ; pour l'étape 6, `docker compose build` sur le Mac.

| # | Étape | Contenu | Effort | Risque |
|---|---|---|---|---|
| 0 | Décision | ADR-002 « Cloisonnement du dépôt » (option A, règles d'import), ligne dans DECISIONS.md, validation de Dasco | 0,25 j | — |
| 1 | `shared/` + contrôle des frontières | Créer `shared/` (tsconfig sans DOM ni Node), y mettre `contract/health.ts` (types de `/api/health` et `/api/admin/status`, utilisés par `server/app.ts`) ; écrire `scripts/check-boundaries.mjs` sur la structure **actuelle** (`src/` = web) et l'ajouter au build | 0,5 j | Faible. Vérifier que Vercel embarque bien `shared/` (même mécanisme que `server/`, couvert par check-api-esm) |
| 2 | tsconfig par partie | `tsconfig.json` racine → config de l'API (Node, sans DOM) ; config du site déplacée dans `src/tsconfig.json` (puis `web/`) ; supprimer `tsconfig.vercel-check.json` et les `/// <reference types="node" />` **seulement après** un déploiement preview qui répond sur `/api/health` et `/api/admin/status`. `vitest.config.ts` dédié (les tests ne chargent plus la config PWA du site) | 0,5 j | **Moyen** : c'est la zone qui a cassé 3 fois (500 FUNCTION_INVOCATION_FAILED, 404). Garder check-api-esm. Éditeur : vérifier que VS Code prend le bon tsconfig dans `src/` |
| 3 | Squelette `admin/` (React) | `admin/vite.config.ts` (base `/admin/`, `outDir ../dist/admin`, `publicDir: false`), `admin/tsconfig.json`, port de la page actuelle (statut) en React avec le contrat de `shared/contract/health.ts` ; supprimer `public/admin/` ; CSP déplacée de la balise `<meta>` vers `vercel.json` (en-tête sur `/admin/(.*)`, prod seulement : en dev, le préambule de React Refresh est un script inline) ; réécriture SPA `/admin/(.*)` → `/admin/index.html` si l'autre plan retient un routeur à historique (inutile avec un routeur à `#`) ; dépendances `react`, `react-dom`, `@vitejs/plugin-react`, `@types/react*` + **commit du lock** | 1 j (dont la part « structure » ≈ 0,5 j ; le reste relève du plan admin) | Moyen : ordre des builds (site puis admin), `emptyOutDir`, chemins absolus `/admin/…` (cf. `39d9277`) |
| 4 | `content/` à la racine | `git mv src/content content` ; mettre à jour les 12 imports du site, `POIS_PATH` du plugin de placement, 3 scripts (`fetch-osm`, `convert-nature`, `convert-buildings`), les commentaires ; `npm run data -- --offline` doit redonner un `city.json` **identique** (règle 2 ; contrôle par `git diff --stat public/data`) | 0,5 j | Faible (renommage), mais **11 mentions dans le README, 47 fichiers de `.claude/docs` citent `src/`** (beaucoup d'historique : ne mettre à jour que README, CLAUDE.md, context.md, conventions ; l'historique du CHANGELOG reste tel quel) |
| 5 | `src/` → `web/` | `git mv src web/src`, `git mv index.html web/`, `git mv vite.config.ts web/` (avec `root`, `publicDir: '../public'`, `outDir: '../dist'`, `emptyOutDir: true`, chemins de `dataVersion()` et `POIS_PATH` recalculés) ; scripts npm ; `vercel.json` inchangé (`buildCommand`, `dist`) — retirer `framework: vite` si la détection gêne (à observer) | 0,5 à 1 j | Moyen : `dataVersion()` et l'empreinte `?v=` (vérifier qu'elle est identique avant/après : même contenu → même empreinte), PWA (`sw.js` et manifeste toujours à la racine de `dist/`) |
| 6 | Docker / Coolify | Le Dockerfile reste valable (un seul lock). Décider : l'image du Pi construit-elle l'admin ? Sans API sur le Pi, l'admin y est inutile → `npm run build:web` (plus les contrôles) dans le Dockerfile, ou garder `npm run build` complet (coût : quelques secondes). Vérifier `deploy/refresh-data.sh` (chemins `public/data` inchangés) | 0,25 j | Faible |
| 7 | Documentation | Voir § 5 | 0,25 j | — |

**Total : 3,25 à 4,25 jours** (étapes 0 à 7). Les étapes 0 à 3 (≈ 2,25 j) forment l'option C et suffisent à démarrer l'admin React ; 4 et 5 peuvent attendre une fenêtre calme.

### Ordre par rapport aux US restantes d'EP008

| Avant… | Étapes à avoir faites | Pourquoi |
|---|---|---|
| **la suite d'US005** (tableau de bord : usage, quotas) | 0, 1, 2, 3 | Le tableau de bord sera écrit directement en React, avec le contrat de `shared/` ; inutile de l'écrire en `admin.js` pour le réécrire ensuite |
| **US006** (retouches) | 4 (`content/`) en plus | US006 déplace le contrat des retouches de parkings (`src/scene/parking-edits.ts`) vers `shared/contract/parkings.ts` (Zod, utilisé par l'API, l'admin et le site) et prévoit l'export JSON dans le dépôt : le chemin définitif de `content/` doit être fixé avant d'écrire cet export |
| **US007** (carte de position) | 5 (`web/`) conseillée ; **décision sur le moteur** | Voir ci-dessous |
| US002, US003, US004 (joueur ↔ API) | 1 (pour le contrat) | Contrats `progress`, `scores`, `friends` dans `shared/contract/` dès leur création ; introduire Zod (ou `zod/mini`) dans le site et mesurer le poids |
| US008, US009 | aucune | Purement API / admin |
| US010 (doc, sauvegarde) | toutes | La doc décrit la structure finale ; le script d'export vit dans `scripts/` |

**US007 et le moteur 3D** (décision à prendre avec l'autre plan et Dasco) :
- **(a) iframe du site dans l'admin** : l'admin charge `/?debug&admin=1` dans un `<iframe>` ; le site expose l'outil de position existant et renvoie les clics par `postMessage` (origine vérifiée). Zéro couplage de code, rendu identique par définition, ≈ 0,5 j. ❌ le service worker du site s'active dans l'iframe (sans gravité, même origine) ; communication asynchrone.
- **(b) extraire un moteur** (`engine/` ou `web/src/engine`) importable par `web` et `admin` : demande de découper `main.ts` (559 lignes, 50 imports) en « construire la scène » / « jeu et UI » ; 1,5 à 3 j, risque de régression sur le site et la perf.
- **Recommandation** : (a) pour US007 ; (b) seulement si l'admin doit un jour éditer la scène en direct. Dans les deux cas, la règle « admin n'importe pas web » tient.

---

## 5. Ce qui change dans la documentation

- **README**
  - « Structure du code » : nouvelle arborescence (web / admin / server / shared / content / public / scripts), tableau des règles d'import, rôle de `check-boundaries`.
  - « Toutes les commandes » : `dev`, `dev:admin`, `build:web`, `build:admin`, `typecheck`, `check`.
  - « API et base de données » : l'admin n'est plus `public/admin` ; développement de l'admin (`npm run api:dev` + `npm run dev:admin`, http://localhost:5174/admin/) ; CSP portée par `vercel.json`.
  - « Gérer les lieux d'histoire », « Monuments », « Arbres », « Outil de placement » : `src/content/…` → `content/…` (11 mentions), `src/…` → `web/src/…` (≈ 22 autres mentions).
  - « Déployer » : ordre des builds, admin hors service worker par construction, choix Docker (admin construite ou non, sans API sur le Pi).
  - « Licences » : React (MIT) si la règle 5 s'applique aux dépendances (à confirmer : la section liste aujourd'hui les assets et données).
- **`.claude/CLAUDE.md`** : règle 1 (`src/content/pois.json` → `content/pois.json`) ; règle 2 (« script de données » : ajouter `content/` aux fichiers qui déclenchent `npm run data -- --offline`) ; checklist avant commit : « `npm run build` passe (types de chaque partie, frontières, chargement de l'API) » ; section Structure : une ligne renvoyant à l'ADR-002 ; « Le code est décrit dans le README » reste vrai.
- **`.claude/docs/context.md`** : tableau Stack (ligne Backend aujourd'hui « Aucun — site 100 % statique », déjà périmée depuis EP008 : à corriger en même temps), ligne Administration (React), structure.
- **`DECISIONS.md`** : une ligne « Cloisonnement : dossiers par partie + `shared/`, pas de workspaces » + **ADR-002** (options A/B/C, raisons, conditions pour passer à B : deuxième app déployée séparément, ou dépendances lourdes qui se gênent).
- **`onboarding/getting-started.md`** : deux terminaux en dev (API + site), un troisième pour l'admin.
- **Epic EP008** : schéma d'architecture (« `/admin` (page statique) » → « `/admin` (React, `admin/`) ») et note dans US005/US006/US007 sur `shared/contract/`.
- Notion (mémoire projet : bases Epics / US / Backlog) : ajouter l'item « Cloisonnement » rattaché à EP008.

---

## 6. Risques et incertitudes (honnêtement)

1. **Compilation des fonctions par Vercel** (étape 2) : la doc dit que Vercel lit le `tsconfig.json` racine et ignore `paths` et *project references* ; je n'ai pas vérifié en pratique qu'un tsconfig racine « Node, sans DOM » passe sans retouche. Parade : preview avant suppression du vercel-check, check-api-esm conservé.
2. **`emptyOutDir` et ordre des builds** (étapes 3, 5) : si l'admin est construite avant le site, `dist/admin` est effacé ; si l'admin vide `dist/` entier, le site disparaît. Parade : ordre fixé dans `build`, `outDir` précis, vérification de `dist/` dans la checklist.
3. **Empreinte des données** (étape 5) : `dataVersion()` doit lire le même `public/` ; une erreur de chemin donnerait une empreinte vide ou un build en échec (bruyant, donc détectable).
4. **Poids de Zod dans le site** (US002+) : non mesuré ; à mesurer à l'introduction (`zod/mini` sinon).
5. **Vitest** : sans `vitest.config.ts`, les tests chargent aujourd'hui la config du site ; après l'étape 5 ils n'en chargeront plus aucune. Le fichier dédié de l'étape 2 évite la surprise ; si l'admin a des tests de composants, il faudra un projet Vitest `jsdom` séparé (plan admin).
6. **Estimations** : jours de travail effectif avec l'assistant, hors attente des validations de Dasco ; l'étape 2 peut doubler si Vercel réagit mal (précédent : trois correctifs successifs pour le routage de l'API).
7. **Option B plus tard** : si un jour l'API part sur le Pi (Coolify, Node) ou si une 2e app est déployée à part, passer en workspaces reste simple depuis A (ajout d'un `package.json` par dossier) ; ce n'est pas un aller simple.

---

## Sources (consultées le 08/10/2026)

- Vercel, *Using Monorepos* — un projet Vercel par dossier (Root Directory), « skip unaffected projects » (exige workspaces npm/yarn/pnpm/Bun, `name` unique, dépendances internes déclarées), installations filtrées : https://vercel.com/docs/monorepos
- Vercel, *Monorepos FAQ* — Hobby limité à **1 build simultané** ; une poussée construit chaque projet connecté ; fichiers hors du Root Directory via l'option « Include source files outside of the Root Directory » ; plusieurs projets sous un domaine via des réécritures : https://vercel.com/docs/monorepos/monorepo-faq
- Vercel, *Using the Node.js Runtime with Vercel Functions* — fonctions dans `/api`, export `fetch` standard ; « You can use a tsconfig.json file at the root of your project to configure the TypeScript compiler. Most options are supported aside from "Path Mappings" and "Project References" » : https://vercel.com/docs/functions/runtimes/node-js
- Code du dépôt : `vercel.json`, `vite.config.ts`, `tsconfig*.json`, `scripts/check-api-esm.mjs`, `Dockerfile`, `deploy/`, `api/index.ts`, `server/`, `public/admin/`, `src/main.ts`, `src/scene/parking-edits.ts`, `src/dev/position-picker.ts`.
