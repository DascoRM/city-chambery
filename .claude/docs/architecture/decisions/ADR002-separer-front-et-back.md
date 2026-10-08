# ADR-002 - Séparer le front et le back ; administration en React

## Statut
**Accepté** (Dasco, 09/10/2026)

## Date
2026-10-09

---

## Contexte
Le projet est né statique (Vite, TypeScript sans framework, Three.js). EP008 y a ajouté une API (Hono, Zod, Drizzle, Neon ; [ADR-001](ADR001-back-end-typescript-vercel-neon.md)) et une page d'administration. Résultat : tout est mélangé à la racine du dépôt :
- `src/` (la carte), `public/admin/` (l'admin, en JS non typé, copiée par le build de la carte), `server/` (l'API), `api/` (l'entrée Vercel), `scripts/` (le pipeline de données et des contrôles) ;
- le tsconfig de la carte sert aussi à compiler l'API sur Vercel (d'où `tsconfig.vercel-check.json` et les `/// <reference types="node" />`) ;
- aucun type partagé : l'admin recopie à la main les réponses de l'API (`DbStatus`), le format des retouches vit dans le code de la carte (`src/scene/parking-edits.ts`) ;
- rien n'empêche une partie d'importer le code d'une autre.

L'administration va grossir (retouches « par tables », lieux, carte de position, tableau de bord) ; la carte, elle, est réglée finement pour la fluidité (iPhone ≤ 31 img/s). Études : [plan de cloisonnement](../../tasks/cloisonnement-depot-plan.md), [plan de l'admin React](../../tasks/admin-react-plan.md) ; spec : [EP010](../../specs/epics/EP010-front-back-et-admin-react/epic.md).

## Décision
**Nous avons décidé** de séparer le dépôt en deux parties nettes, en deux phases (le front d'abord, le back ensuite) :

```
frontend/
├── carte/      le diorama Three.js + OSM / IGN, avec tout son pipeline de données
│               (src/, index.html, vite.config.ts, content/, public/, scripts/, diorama.config.json,
│                assets-src/, data/raw/ = cache des téléchargements OSM / IGN)
└── admin/      l'administration, en React 19 (wouter, TanStack Query, React Hook Form, CSS simple), servie sous /admin/
backend/        l'API (Hono, Zod, Drizzle) : ex-server/ ; data/dev-db/ (base locale de dev, PGlite) la suivra
contrat/        les formats échangés entre front et back (schémas Zod), écrits une seule fois
api/index.ts    3 lignes imposées par Vercel (il ne cherche les fonctions que dans api/ à la racine) : renvoie vers backend/
scripts/        contrôles du dépôt seulement (check-api-esm, check-boundaries)
deploy/         Docker / nginx (infrastructure)
```

Règles :
1. **Le front ne parle au back que par HTTP.** La carte et l'admin n'importent jamais le code du back, ni l'une celui de l'autre ; le back n'importe jamais le front ; `contrat/` n'utilise que Zod.
2. Ces règles sont **vérifiées par la machine** : un tsconfig par partie et `scripts/check-boundaries.mjs` dans `npm run build`.
3. **La carte reste en TypeScript sans framework** ; React sert seulement à l'administration.
4. **Un seul `package.json`, un seul projet Vercel** : la carte se construit dans `dist/`, l'admin dans `dist/admin/` (après la carte, donc hors du service worker).
5. **L'admin est servie par Vercel seulement** ; l'image Docker du Pi ne construit que la carte (le Pi n'a pas d'API).
6. **Connexion de l'admin** : session par cookie `HttpOnly` (2 h) en phase 2 ; **pas de GitHub ni d'autre fournisseur** ; plus tard, des comptes d'administration enregistrés en base (identifiant et mot de passe).
7. **Carte de position dans l'admin** : la carte Three.js existante, affichée dans un cadre ; l'outil 📍 Position renvoie le point cliqué (`postMessage`). Pas de seconde carte.

---

## Options considérées

### Option 1 : dossiers séparés, un seul `package.json`, un seul projet Vercel ← **Choix retenu**
- ✅ Séparation visible et vérifiée au build, sans toucher au projet Vercel ni au lock
- ✅ Migration par petites étapes, chacune déployable
- ✅ Convertible plus tard en workspaces npm sans déplacer de fichiers
- ❌ Les dépendances de toutes les parties restent dans un seul `package.json`

### Option 2 : workspaces npm (un `package.json` par partie)
- ✅ Dépendances isolées par partie
- ❌ 4 à 6 j ; sur Vercel, soit `contrat/` compilé en JS, soit trois projets (CORS, trois builds par push alors que le plan gratuit n'en fait qu'un à la fois) ; Dockerfile à revoir

### Option 3 : laisser la carte et le pipeline à la racine, n'ajouter que `admin/` et `contrat/`
- ✅ Moins de déplacements (≈ 0,5 j de moins)
- ❌ La séparation front / back reste illisible ; refusé par Dasco (D2 : tout le pipeline va avec la carte)

### Option 4 : React aussi pour la carte (React Three Fiber)
- ❌ 25 à 35 j de réécriture, risque sur la fluidité, rendu identique

### Écartés pour l'admin
- **Preact** : React suffit pour un outil utilisé par une personne
- **Leaflet / MapLibre** pour la carte de position : on réutilise la carte Three.js existante
- **react-leaflet** : licence Hippocratic 2.1, pas une licence open source au sens de l'OSI
- **Client RPC de Hono** : il ferait dépendre le front des types du back ; on passe par `contrat/`
- **Connexion GitHub (OAuth)** : Dasco ne veut pas dépendre d'un fournisseur

---

## Conséquences

### Positives
- Chaque partie se lit et se construit seule ; une erreur de frontière casse le build avec un message clair
- Les formats de l'API sont écrits une fois (`contrat/`) et vérifiés des deux côtés
- L'admin peut grossir (React, formulaires validés) sans toucher à la carte ni à sa fluidité
- Le tsconfig de l'API cesse d'être celui de la carte (fin des contournements Vercel, phase 2)

### Négatives
- ≈ 6,5 à 8 j de travail avant la reprise d'EP008 (mise en pause pendant EP010)
- Beaucoup de chemins changent : scripts npm, Docker, `deploy/refresh-data.sh`, README, CLAUDE.md, plans existants qui citent `src/`
- Zone sensible : la compilation de l'API sur Vercel (a cassé trois fois) ; chaque étape est vérifiée sur une prévisualisation `preview/**`
- L'admin React ajoute ≈ 120 à 135 Ko gzip (admin seulement, aucun effet sur la carte)

---

**Auteur** : Claude (agent principal), d'après les études du 08/10/2026
**Approuvé par** : Dasco (décisions D1 à D6, 09/10/2026)
