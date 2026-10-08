# EP010 - US008 - `src/` → `web/`

## User Story

**En tant que** développeur (Claude),
**je veux** que le site vive dans son propre dossier, comme l'API et l'admin,
**afin de** que la structure se lise d'un coup d'œil.

---

## Critères d'acceptation

- [ ] **Given** `web/` (`src/`, `index.html`, `vite.config.ts` avec `root`, `publicDir: '../public'`, `outDir: '../dist'`), **Then** `npm run build` produit le même `dist/` qu'avant
- [ ] **Given** l'empreinte `?v=` des données, **Then** elle est identique avant et après
- [ ] **Given** la PWA, **Then** `sw.js` et le manifeste restent à la racine de `dist/` et l'installation marche
- [ ] **Given** `check-boundaries.mjs`, **Then** il vise `web/src` au lieu de `src/`

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 7 et règles d'import.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 0,5 à 1 |
| Risque | Moyen (`dataVersion()`, PWA) |
| Dépend de | US007 ; conseillée avant EP008-US007 |

Détail : [plan de cloisonnement](../../../tasks/cloisonnement-depot-plan.md) § 4 (étape 5).

---

## Checklist dev
- [ ] `npm run build` et `npm test` passent
- [ ] Prévisualisation `preview/cloisonnement` : `/`, `/api/health`, `/admin/` répondent ; service worker sans `admin/` ; Le site se comporte comme avant (vérification navigateur)
- [ ] Lock commité si les dépendances changent
- [ ] README, DECISIONS, CHANGELOG si besoin
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : 🔲 Todo
