# Epic EP010 - Cloisonner le dépôt et poser l'administration en React

**Statut (08/10/2026) : spec à valider par Dasco ; rien n'est codé.** Prérequis des écrans d'[EP008](../EP008-back-end-et-admin/epic.md) (US005 à US010). Études : [plan de cloisonnement](../../../tasks/cloisonnement-depot-plan.md) et [plan de l'admin React](../../../tasks/admin-react-plan.md) (versions, licences et doc Vercel consultées le 08/10/2026).

## Résumé
Ranger le dépôt en **parties étanches** (site, API, administration, contrat partagé, contenu) avec des règles d'import vérifiées au build, et poser une **administration en React** à la place de la page actuelle en JS non typé. Le site public reste en TypeScript + Three.js sans framework.

## Contexte & Problème
- Le site est en **TypeScript sans framework** (Vite + Three.js, ≈ 9 500 lignes) : des fonctions `createX()` qui renvoient des méthodes et des rappels (`UiHandlers`), ce qui ressemble à React sans en être. **Décision de Dasco (08/10/2026) : le site reste ainsi** ; React n'est retenu que pour l'administration, dont les écrans vont grossir avec EP008.
- Depuis EP008 il y a un back-end, mais rien ne sépare vraiment les parties :
  - **aucun type partagé** : le contrat de l'API est recopié à la main (`DB_LABEL` de `admin.js` refait `DbStatus`), et celui des retouches vit dans `src/scene/parking-edits.ts` ;
  - **`src/content`** a quatre consommateurs : le site, 3 scripts, le plugin de placement en dev, et bientôt l'export d'US006 ;
  - **l'admin** est dans `public/admin` (JS non typé, copié par le build du site, sortie du service worker par deux exclusions) ;
  - **TypeScript** : Vercel compile `api/` avec le tsconfig racine, qui est celui du site, d'où `tsconfig.vercel-check.json` et les `/// <reference types="node" />` ;
  - **tests** : `vitest` charge la config Vite du site, PWA comprise.

## Structure cible (option A : dossiers cloisonnés, un seul `package.json`, un seul projet Vercel)
```
api/        entrée Vercel (3 lignes) → server/
server/     API Hono, Zod, Drizzle                    tsconfig racine (Node, sans DOM)
shared/     schémas Zod du contrat API, fonctions pures (describe, nearestStreet…) ; zod seulement
web/        le site (ex-src/, index.html, vite.config.ts)      → dist/
admin/      l'administration React (base /admin/)              → dist/admin/ (construite après le site)
content/    contenu éditorial (ex-src/content)
public/     données produites par les scripts (city.json, modèles) : inchangé
scripts/    pipeline de données, contrôles (check-api-esm, check-boundaries)
```

### Règles d'import (vérifiées par `scripts/check-boundaries.mjs` dans `npm run build`)
| Partie | Peut importer | Jamais |
|---|---|---|
| `api/` | `server/` | le reste |
| `server/` | `shared/`, hono, zod, drizzle, postgres | `web/`, `admin/`, `content/`, three, react |
| `web/` | `shared/`, `content/`, three, workbox-window | `server/`, `admin/`, `api/`, react |
| `admin/` | `shared/`, react et sa pile | `server/`, `web/`, `api/`, `content/` (passe par l'API ou les fichiers statiques) |
| `shared/` | zod | tout le reste (ni DOM, ni `node:*`, ni three) |
| `scripts/` | `content/` (lecture), `public/` (écriture) | `server/`, `admin/` |

- L'admin parle au serveur **uniquement par HTTP**, avec les schémas de `shared/` ; pas de client RPC Hono (il ferait dépendre l'admin des types du serveur).
- Imports **relatifs avec extension `.js`** dans `shared/` et `server/` ; pas d'alias `paths` ni de *project references* côté API (non pris en charge par les fonctions Vercel, doc citée dans le plan).

### Pile de l'administration
React 19 · wouter (routage, 2,7 Ko) · TanStack Query 5 · React Hook Form 7 + `@hookform/resolvers` + schémas Zod de `shared/` · CSS simple repris de `admin.css`, `<dialog>` natif · Vitest + Testing Library + happy-dom. Objectif **< 150 Ko gzip au chargement** (estimé 120 à 135), carte chargée à la demande. Aucun effet sur le site public.

### Options écartées
- **Workspaces npm** (`apps/*`, `packages/shared`) : 4 à 6 j. Sur Vercel, soit `shared/` compilé en JS, soit 3 projets (CORS, 3 builds par push alors que le plan gratuit n'en fait qu'un à la fois) ; Dockerfile à revoir. La structure A se convertit en workspaces plus tard sans déplacer de fichiers.
- **React pour le site** : 25 à 35 j pour une réécriture complète avec React Three Fiber, risque sur la fluidité iPhone, rendu identique. React limité à l'interface HTML du site : 6,5 à 8,5 j, gain faible avec ≈ 750 lignes d'UI. Non retenu.
- **Preact** : écarté pour l'admin (outil d'une seule personne, le poids compte peu ; Preact 11 sortait le jour de l'étude).
- **react-leaflet** : licence Hippocratic 2.1, qui n'est pas une licence open source au sens de l'OSI.

---

## User Stories

| ID | User Story | Étape | Jours | Status |
|----|------------|-------|-------|--------|
| [US001](US001-decision-et-adr.md) | Décision et ADR-002 « Cloisonnement du dépôt » | 0 | 0,25 | 🔲 Todo |
| [US002](US002-shared-et-controle-des-frontieres.md) | Dossier `shared/` et contrôle des frontières au build | 1 | 0,5 | 🔲 Todo |
| [US003](US003-un-tsconfig-par-partie.md) | Un tsconfig par partie, config Vitest dédiée | 2 | 0,5 | 🔲 Todo |
| [US004](US004-socle-admin-react.md) | Socle de l'administration React | 3 | 1,5 | 🔲 Todo |
| [US005](US005-parite-admin-actuelle.md) | Parité avec l'admin actuelle, suppression de `public/admin` | 3 | 0,5 à 1 | 🔲 Todo |
| [US006](US006-session-par-cookie.md) | Session d'administration par cookie `HttpOnly` | — | 0,75 | 🔲 Todo |
| [US007](US007-content-a-la-racine.md) | `content/` à la racine | 4 | 0,5 | 🔲 Todo |
| [US008](US008-src-vers-web.md) | `src/` → `web/` | 5 | 0,5 à 1 | 🔲 Todo |
| [US009](US009-docker-et-documentation.md) | Docker / Coolify et documentation | 6, 7 | 0,5 | 🔲 Todo |

**Total : ≈ 5,5 à 6,5 jours** (± 30 %, rien n'est mesuré). US001 à US005 (≈ 3,25 à 3,75 j) suffisent pour écrire les nouveaux écrans d'EP008 en React.

### Ordre par rapport à EP008
| Avant… (EP008) | Faire (EP010) | Pourquoi |
|---|---|---|
| La suite de US005 (tableau de bord : usage, quotas) | US001 à US005 | Écrire le tableau de bord directement en React avec le contrat de `shared/`, pas en `admin.js` pour le réécrire ensuite |
| US006 (retouches) | + US006, US007 | Premières écritures : session par cookie ; chemin définitif de `content/` fixé avant d'écrire l'export ; contrat des retouches dans `shared/contract/parkings.ts` |
| US007 (carte de position) | US008 conseillée | Selon l'option de carte retenue (décision D5) |
| US002 à US004 (joueur ↔ API) | US002 | Contrats `progress`, `scores`, `friends` dans `shared/` dès leur création |
| US008, US009 | — | Rien de requis |
| US010 (documentation, sauvegarde) | toutes | La doc décrit la structure finale |

Branche d'epic : `feat/EP010-cloisonnement`, **partie de `feat/EP008-back-end`** (elle touche `server/`, les tsconfig et `vercel.json`), une branche par US fusionnée dedans, puis fusion dans la branche d'EP008. Les US qui touchent Vercel (US003, US004, US005, US008) sont vérifiées sur une prévisualisation `preview/cloisonnement` avant fusion.

---

## Règles métier
1. **Chaque étape garde `npm run build` vert et le déploiement fonctionnel** : on vérifie `/`, `/api/health`, `/admin/` et l'installation PWA (`sw.js` sans fichier `admin/`) sur `preview/**`
2. **Le site ne change pas de comportement** : mêmes fichiers servis, même empreinte `?v=` des données, même service worker
3. **`city.json` identique** après les déplacements (`npm run data -- --offline` puis `git diff --stat public/data` vide)
4. **Frontières vérifiées par la machine** (tsconfig par partie + `check-boundaries.mjs`), pas seulement par convention
5. **Jamais de HTML construit à partir de données** dans l'admin : `dangerouslySetInnerHTML` interdit, vérifié au build
6. **Source obligatoire vérifiée deux fois** : même schéma Zod dans le formulaire et sur le serveur (règle 3 d'EP008)
7. **Lock commité** à chaque changement de dépendances (le Dockerfile fait `npm ci`)

---

## Décisions à trancher par Dasco
| # | Question | Recommandation |
|---|----------|----------------|
| D1 | Structure : dossiers cloisonnés (A), A minimale sans toucher `src/` (C), ou workspaces npm (B) ? | **A, par étapes** (C d'abord = US001 à US005) |
| D2 | React 19 ou Preact ? | **React 19** |
| D3 | Routeur : wouter ou React Router ? | **wouter** (8 routes) |
| D4 | Interface : CSS simple, Pico, ou shadcn + Tailwind ? | **CSS simple** repris de l'admin actuelle |
| D5 | Carte de position (EP008-US007) : voir ci-dessous | **(a) iframe**, (b) en repli |
| D6 | L'admin doit-elle marcher sur le Pi (il n'y a pas d'API sur le Pi) ? | **Vercel seulement** pour EP008 ; l'image du Pi ne construit que le site |
| D7 | Session : jeton en `sessionStorage` (sans expiration) ou cookie `HttpOnly` / `SameSite=Strict` 2 h dès les premières écritures ? | **Cookie dès EP008-US006** |
| D8 | Connexion GitHub : en EP008 ou plus tard ? | **Après EP008-US006 et US007** ; production seulement, jeton de secours ailleurs |
| D9 | Si EP010 tarde : démarrer l'admin React dans un `admin/` provisoire ? | **Oui** |

### D5 - Carte de position : les deux études divergent
Les positions du projet sont en **mètres locaux** (projection équirectangulaire de `scripts/fetch-osm.mjs`) et EP008-US007 demande « même rendu que l'application (même moteur) ».
| Option | Effort | Pour | Contre |
|---|---|---|---|
| **(a) iframe du site** (`/?debug&admin=1`), l'outil 📍 Position existant renvoie le clic par `postMessage` (origine vérifiée) | ≈ 0,5 j | « même moteur » par définition ; aucun code partagé ; mêmes coordonnées | communication asynchrone ; le site doit autoriser d'être affiché dans un cadre de même origine (en-têtes à vérifier) ; le service worker du site s'active dans le cadre (sans gravité) |
| (b) Plan 2D Leaflet 1.9.4 sans fond de carte (`CRS.Simple`), dessiné depuis `city.json` | 1,5 à 2 j | vue de dessus précise ; aucune dépendance au site | pas « même moteur » ; Leaflet peu actif (2.0 en alpha) |
| (c) Moteur 3D extrait de `main.ts` (`createDioramaView`) importé par l'admin | 3 à 4 j | « même moteur » intégré | refactorisation de `main.ts` (559 lignes, 50 imports) : risque de régression du site et de la fluidité |
| Fond OSM ou MapLibre | 2 à 2,5 j | fond familier | conversion de coordonnées, CSP élargie ; l'en-tête `Referrer-Policy: no-referrer` sur `/admin` contredit la politique des tuiles OSM. **Écarté** |

Dans tous les cas, la logique « qu'y a-t-il sous le clic » (`describe`, `nearestStreet`, `pointInPoly`) passe dans `shared/`.

---

## Risques
- **tsconfig racine → API** : c'est la zone qui a cassé trois fois (500 `FUNCTION_INVOCATION_FAILED`, 404). On garde `check-api-esm` et on ne supprime `tsconfig.vercel-check.json` qu'après une prévisualisation qui répond
- **Réécritures `/admin/*`** (Vercel et nginx) : déjà vécu (commits `39d9277`, `07309ef`) ; liste de contrôle des URL sur `preview/**`
- **Service worker déjà installé** chez Dasco qui intercepterait `/admin/` : à tester avec un service worker actif
- **Ordre des builds** (site puis admin dans `dist/admin`, `emptyOutDir`) et **empreinte `?v=`** après déplacement de `src/` : à vérifier
- **Documentation** : 33 lignes du README mentionnent `src/`, ainsi que ≈ 50 fichiers de `.claude/docs` (relevé du 08/10) ; on met à jour README, CLAUDE.md, context.md, getting-started ; l'historique du CHANGELOG reste tel quel
- **Écart avec EP008** : les écrans d'admin en React coûtent ≈ 6,5 à 10,5 j de front (selon la carte) en plus de cette epic (voir EP008), au-delà des « 6 à 8 sessions » prévues pour toute EP008

## Non vérifié
- Qu'un tsconfig racine orienté API passe sur Vercel
- L'ordre des builds avec `emptyOutDir` et l'empreinte `?v=` après le déplacement
- Que Vercel Hobby expose l'usage (appels, quotas) par API ; sinon il faudra compter nous-mêmes (EP008-US008)
- Le poids réel de Zod dans le site quand il sera introduit (US002 d'EP008)
- Les en-têtes nécessaires pour l'option (a) de la carte

---

## Critères d'acceptation
- [ ] Les US sont terminées ; `npm run build` et `npm test` passent
- [ ] Une violation de frontière (ex. `web` qui importe `server`) fait échouer le build avec un message clair
- [ ] Prévisualisation : `/`, `/api/health`, `/admin/` répondent ; le service worker ne contient rien de `admin/`
- [ ] Le site se comporte exactement comme avant (mêmes vues, même fluidité `?debug`, même `city.json`)
- [ ] ADR-002, DECISIONS, README, CLAUDE.md, context.md à jour
- [ ] Revue de Dasco

---

## Estimation globale
- **Complexité** : M
- **Effort estimé** : ≈ 5,5 à 6,5 jours (dont ≈ 3,25 à 3,75 pour le socle utile à EP008)

---

**Version** : v1.0
**Créé le** : 08/10/2026
