# Epic EP010 - Séparer le front et le back, et poser l'administration en React

**Statut (09/10/2026) : phase 1 (front) livrée et vérifiée par Dasco sur la prévisualisation, fusionnée dans la branche d'epic ; phase 2 (back) planifiée ([plan](../../../tasks/ep010-phase2-plan.md)), en attente de 7 réponses de Dasco.** v2 : réécrite après le retour de Dasco (« bien différencier front et back ; d'abord le front avec l'admin React, puis le back »). Prérequis des écrans d'[EP008](../EP008-back-end-et-admin/epic.md). Études : [plan de cloisonnement](../../../tasks/cloisonnement-depot-plan.md), [plan de l'admin React](../../../tasks/admin-react-plan.md) (08/10/2026).

## Résumé
Ranger le dépôt en **deux parties nettes** :
- **Frontend** : la **carte** (le diorama Three.js et les données OpenStreetMap / IGN, conservé tel quel) et l'**administration** (nouvelle, en React)
- **Backend** : l'**API**, consommée par l'administration, et à terme par la carte (progression, scores, retouches)

**Phase 1** : l'architecture du front, avec l'admin React. **Phase 2** : le back.

Décisions de Dasco (09/10/2026) : structure validée, tout le pipeline de données dans `frontend/carte`, admin React 19 + wouter + CSS simple, admin sur Vercel seulement, session par cookie, **pas de connexion GitHub** (plus tard, des comptes d'administration en base).

## Contexte & Problème
- La carte est en TypeScript sans framework (Vite + Three.js) ; **on la garde ainsi**. React sert seulement à l'administration, dont les écrans vont grossir avec EP008.
- Aujourd'hui tout est mélangé à la racine : `src/` (la carte), `public/admin/` (l'admin, en JS non typé, copiée par le build de la carte), `server/` (l'API), `api/`, `scripts/`, et un tsconfig de la carte qui sert aussi à compiler l'API sur Vercel. Rien n'empêche une partie d'importer le code d'une autre, et l'admin recopie à la main les réponses de l'API.

## Structure cible
```
frontend/
├── carte/      le diorama : Three.js + OSM / IGN (ex-src/, index.html, vite.config.ts)
│   ├── src/
│   ├── content/    fiches et réglages éditoriaux (ex-src/content)
│   ├── public/     city.json, modèles 3D (produits par les scripts)
│   └── scripts/    pipeline de données OSM / IGN (ex-scripts/)
└── admin/      l'administration React, servie sous /admin/

backend/
├── src/        l'API (Hono, Zod, Drizzle) : ex-server/, renommé tel quel ; db/ dedans (schéma, migrations)
└── data/       base locale de dev (PGlite, non versionnée)

contrat/        ce que se disent le front et le back : schémas des requêtes et réponses de l'API (zod/mini, D12)
api/index.ts    3 lignes imposées par Vercel (il ne cherche les fonctions que dans `api/` à la racine) : renvoie vers backend/
```

- **`contrat/` n'est ni du front ni du back** : c'est l'accord entre les deux. Le back s'en sert pour valider ce qu'il reçoit, le front pour vérifier ce qu'il reçoit. Sans lui, chaque format est écrit deux fois (c'est déjà le cas : l'admin recopie `DbStatus`).
- **`api/` n'est pas une partie du code** : un simple branchement pour Vercel, sans logique.
- **Le pipeline de données va avec la carte** : il ne sert qu'à elle (`city.json`, modèles).

### Qui a le droit d'utiliser quoi (vérifié au build)
| Partie | Utilise | N'utilise jamais |
|---|---|---|
| `frontend/carte` | Three.js, ses données, `contrat/` (quand elle parlera à l'API) | `frontend/admin`, `backend`, React |
| `frontend/admin` | React, `contrat/`, l'API **par HTTP** | `frontend/carte` (code), `backend` (code) |
| `backend` | Hono, Zod, Drizzle, `contrat/` | tout `frontend/` |
| `contrat/` | Zod seulement | tout le reste |

Le front ne parle au back **que par HTTP**. Contrôle : un tsconfig par partie + `check-boundaries.mjs` (≈ 50 lignes) dans `npm run build`, avec un message clair (« frontend/admin/src/x.ts importe backend/src/app.ts : interdit »).

### L'administration en React
React 19 · wouter (routage par « # », sans réécriture serveur) · TanStack Query (appels à l'API) · React Hook Form + schémas de `contrat/` (formulaires) · CSS simple repris de l'admin actuelle · Vitest + Testing Library. Moins de 150 Ko gzip au chargement. Aucun effet sur la carte.

**Carte de position dans l'admin (EP008-US007)** : l'admin **affiche la carte Three.js existante** dans un cadre (`/?debug&admin=1`) ; l'outil 📍 Position, qui existe déjà, renvoie le point cliqué à l'admin (`postMessage`). Même moteur, même rendu, aucun code de la carte copié dans l'admin, ≈ 0,5 j. *(Pas de seconde carte : Leaflet et MapLibre, évoqués par l'étude, sont écartés.)*

### Écarté
- **Workspaces npm** (un `package.json` par partie) : 4 à 6 j et des contraintes de build sur Vercel ; la structure ci-dessus pourra y passer plus tard sans déplacer de fichiers
- **React pour la carte** : réécriture lourde, risque sur la fluidité, rendu identique
- **Preact** pour l'admin : React suffit pour un outil utilisé par une personne

---

## User Stories

### Phase 1 - Frontend
| ID | User Story | Jours | Status |
|----|------------|-------|--------|
| [US001](US001-decision-et-adr.md) | ADR-002 « Séparer front et back » (décisions prises le 09/10) | 0,25 | ✅ [ADR-002](../../../architecture/decisions/ADR002-separer-front-et-back.md) (09/10) |
| [US002](US002-frontend-carte.md) | `frontend/carte` : la carte dans son dossier (avec contenu, données et scripts) | 1 à 1,5 | ✅ Fait et vérifié par Dasco (09/10) |
| [US003](US003-frontend-admin-socle-react.md) | `frontend/admin` : socle React | 1,5 | ✅ Fait et vérifié par Dasco (09/10) |
| [US004](US004-admin-parite-et-bascule.md) | Admin : parité avec l'actuelle (état, retouches de parkings), puis suppression de `public/admin` | 1 à 1,5 | ✅ Fait et vérifié par Dasco (09/10) |
| [US005](US005-frontieres-du-front.md) | Frontières du front vérifiées au build | 0,5 | ✅ Fait (09/10) : `scripts/check-boundaries.mjs` |

### Phase 2 - Backend
| ID | User Story | Jours | Status |
|----|------------|-------|--------|
| [US006](US006-backend.md) | `backend/` : l'API dans son dossier, sa propre config TypeScript | 0,5 à 1 | ✅ Fait (09/10), trois étapes vérifiées sur la prévisualisation |
| [US007](US007-contrat-front-back.md) | `contrat/` : schémas partagés entre front et back | 0,5 | ✅ Fait (09/10), vérifié sur la prévisualisation |
| [US008](US008-session-admin-par-cookie.md) | Session d'administration par cookie `HttpOnly` | 0,75 | 🔲 Todo |
| [US009](US009-docker-et-documentation.md) | Docker / Coolify et documentation | 0,5 | 🔲 Todo |

**Total : ≈ 6,5 à 8 jours** (± 30 %, rien n'est mesuré). Phase 1 ≈ 4,25 à 5,25 j ; phase 2 ≈ 2,25 à 2,75 j.

### Place par rapport à EP008
EP008 a avancé en parallèle : US005 (accès) et la partie parkings d'US006 sont livrées (08/10 : retouches en JSON dans la table `parking_edits`, écran de retouches dans l'admin actuelle). **EP008 est en pause pendant EP010** ; les réponses de Dasco du 09/10 et les plans « admin par tables » et « progression » sont mis de côté (`git stash`, message « EP008 en attente d'EP010 »).
1. **EP010 phase 1** → l'admin React reprend à l'identique l'existant, retouches de parkings comprises (US004) ; la suite d'EP008 (tableau de bord, lieux) s'écrit ensuite directement en React
2. **EP010 phase 2** → avant la reprise d'EP008 : `contrat/` (les formats des retouches et des futures tables y vont), session par cookie (les écritures existent déjà, avec le jeton seul)
3. **Reprise d'EP008** : admin par tables, US007 (carte de position = la carte dans l'admin), progression (US002 à US004), US008 à US010

Branche d'epic : `feat/EP010-front-back`, partie de `feat/EP008-back-end`, une branche par US fusionnée dedans. Les US qui touchent Vercel (US002 à US004, US006) sont vérifiées sur une prévisualisation `preview/front-back` avant fusion.

---

## Règles métier
1. **La carte ne change pas** : même rendu, même fluidité (`?debug`), mêmes fichiers servis, même empreinte `?v=` des données, même service worker
2. **`city.json` identique** après les déplacements (`npm run data -- --offline`, puis `git diff --stat` vide sur les données)
3. **Chaque US garde `npm run build` vert et le déploiement fonctionnel** : `/`, `/admin/`, `/api/health` répondent sur `preview/**` ; le service worker de la carte ne contient rien de l'admin
4. **Le front ne parle au back que par HTTP** ; frontières vérifiées par la machine, pas seulement par convention
5. **Admin : jamais de HTML construit à partir de données** (`dangerouslySetInnerHTML` refusé au build)
6. **Source obligatoire vérifiée deux fois** : même schéma dans le formulaire de l'admin et dans l'API (règle 3 d'EP008)
7. **Lock commité** à chaque changement de dépendances (le Dockerfile fait `npm ci`)

---

## Décisions (tranchées par Dasco le 09/10/2026)
| # | Question | Décision |
|---|----------|----------|
| D1 | Structure (`frontend/carte`, `frontend/admin`, `backend`, `contrat`) ? | ✅ **Oui** |
| D2 | Où va le pipeline de données (`scripts/`, `content/`, `public/`) ? | ✅ **Tout dans `frontend/carte`** |
| D3 | Admin : React 19, wouter, CSS simple ? | ✅ **Oui** |
| D4 | L'admin sur le Pi (il n'y a pas d'API sur le Pi) ? | ✅ **Vercel seulement** ; l'image du Pi ne construit que la carte |
| D5 | Session : cookie `HttpOnly` pour les écritures de l'admin ? | ✅ **Oui** (en phase 2 ; les retouches de parkings s'écrivent aujourd'hui avec le jeton seul) ; durée : voir D9 |
| D6 | Connexion de l'administration ? | ✅ **Pas de GitHub ni d'autre fournisseur.** Plus tard : **connexion simple par identifiant et mot de passe, avec des utilisateurs enregistrés en base** (hors EP010, voir EP008-US005). D'ici là, le jeton actuel, échangé contre le cookie de session (US008) |

### Décisions de la phase 2 (Dasco, 09/10/2026, d'après le [plan de la phase 2](../../../tasks/ep010-phase2-plan.md))
| # | Question | Décision |
|---|----------|----------|
| D7 | Arborescence du back | ✅ **`backend/src/`**, renommage de `server/` (« backend » répond à « frontend »), `db/` dedans : aucun import interne réécrit |
| D8 | Le jeton d'administration | ✅ **Ne sert plus qu'à ouvrir la session** ; ensuite seul le cookie est accepté (« on reprendra cette partie » avec les comptes en base) |
| D9 | Durée de la session | ✅ **Prolongée à chaque action** (renouvellement silencieux) : expire après 2 h sans activité ; **8 h au plus depuis la connexion** (confirmé par Dasco) |
| D10 | Clé qui signe la session | ✅ **Pas de nouvelle variable pour l'instant** : tirée d'`ADMIN_TOKEN` (changer le jeton ferme toutes les sessions) ; à reprendre plus tard |
| D11 | Hébergement sur le Raspberry Pi 5 (Coolify) | ✅ **On part du principe qu'il reste prévu** (Dasco se pose encore la question) : nginx répond 404 sur `/api` et `/admin` au lieu de la page de la carte (US009) |
| D12 | Zod dans la carte | ✅ **Confirmé par Dasco : tout `contrat/` en `zod/mini`** (≈ 7 Ko gzip au lieu de 26) ; le back et l'admin s'en servent pour valider et typer, la carte pour vérifier les réponses de l'API (retouches publiées, puis la connexion front-back à venir). Mesuré : carte +8 Ko gzip, administration +24 Ko (plus de types de schémas ; 108 Ko, sous l'objectif de 150) |

---

## Risques
- **Config TypeScript de l'API sur Vercel** (US006) : c'est la zone qui a cassé trois fois (500 `FUNCTION_INVOCATION_FAILED`, 404) ; on garde `check-api-esm` et on ne supprime `tsconfig.vercel-check.json` qu'après une prévisualisation qui répond
- **Réécritures `/admin/*`** (Vercel et nginx) : déjà vécu (commits `39d9277`, `07309ef`) ; liste de contrôle des URL sur `preview/**`
- **Service worker de la carte déjà installé** chez Dasco qui intercepterait `/admin/` : à tester avec un service worker actif
- **Empreinte `?v=` des données et chemins du pipeline** après le déplacement (`dataVersion()`, `deploy/refresh-data.sh`, Dockerfile)
- **Documentation** : 33 lignes du README et ≈ 50 fichiers de `.claude/docs` mentionnent `src/` ; on met à jour README, CLAUDE.md, context.md, getting-started ; l'historique reste tel quel
- **EP008 s'allonge** : les écrans d'admin coûtent ≈ 6,5 à 7 j de front en plus de cette epic (voir EP008)

## Non vérifié
- Que Vercel compile l'API avec sa propre config une fois la carte sortie de la racine
- L'ordre des deux builds (carte puis admin dans `dist/admin`) et l'empreinte `?v=` après déplacement
- Les en-têtes nécessaires pour afficher la carte dans un cadre de l'admin (même origine)
- Que Vercel Hobby expose l'usage par API (sinon EP008-US008 compte lui-même)

---

## Critères d'acceptation
- [ ] Les US sont terminées ; `npm run build` et `npm test` passent
- [ ] Une partie qui importe le code d'une autre fait échouer le build avec un message clair
- [ ] Prévisualisation : `/`, `/admin/`, `/api/health` répondent ; le service worker ne contient rien de l'admin
- [ ] La carte se comporte exactement comme avant
- [ ] ADR-002, DECISIONS, README, CLAUDE.md, context.md à jour
- [ ] Revue de Dasco

---

## Estimation globale
- **Complexité** : M
- **Effort estimé** : ≈ 6,5 à 8 jours (phase 1 ≈ 4,5 j, phase 2 ≈ 2,5 j)

---

**Version** : v2.0 (remplace la v1.0 du même jour)
**Créé le** : 08/10/2026
