# EP010 - US002 - `frontend/carte` : la carte dans son dossier

## User Story

**En tant que** développeur (Claude),
**je veux** que la carte (Three.js + OSM / IGN) vive dans `frontend/carte` avec son contenu, ses données et son pipeline,
**afin de** qu'on voie d'un coup d'œil ce qui appartient à la carte.

---

## Critères d'acceptation

- [x] **Given** les déplacements (`src/` → `frontend/carte/src`, `index.html`, `vite.config.ts`, `src/content` → `frontend/carte/content`, `public/` → `frontend/carte/public`, `scripts/` de données → `frontend/carte/scripts`, décision D2 : tout le pipeline va avec la carte), **Then** `npm run build` produit le même `dist/` qu'avant
- [x] **Given** `npm run data -- --offline`, **Then** `city.json` est identique
- [x] **Given** l'empreinte `?v=` des données, **Then** elle est identique avant et après
- [x] **Given** la PWA, **Then** `sw.js` et le manifeste restent à la racine de `dist/`, l'installation marche
- [x] **Given** l'outil de placement en dev, `deploy/refresh-data.sh` et le Dockerfile, **Then** ils pointent vers les nouveaux chemins
- [x] **Given** la carte, **Then** elle a son propre tsconfig (DOM, Vite)

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 7 et tableau « Qui a le droit d'utiliser quoi ».

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Phase | 1 |
| Jours | 1 à 1,5 |
| Risque | Moyen (`dataVersion()`, PWA, chemins du pipeline) |
| Dépend de | US001 |

Détail : [plan de cloisonnement](../../../tasks/cloisonnement-depot-plan.md) § 4 (étapes 4 et 5).

---

## Checklist dev
- [x] `npm run build` et `npm test` passent
- [x] Prévisualisation `preview/front-back` : `/`, `/admin/`, `/api/health` répondent ; service worker sans fichier de l'admin ; `city.json` identique ; La carte se comporte comme avant (vérification navigateur, `?debug`)
- [x] Lock commité si les dépendances changent
- [x] README, DECISIONS, CHANGELOG si besoin
- [x] Validé par Dasco

---

**Priorité** : High
**Status** : ✅ Done (09/10/2026), vérifié par Dasco sur `preview/front-back`
