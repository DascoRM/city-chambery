# EP010 - US002 - Dossier `shared/` et contrôle des frontières au build

## User Story

**En tant que** développeur (Claude),
**je veux** un dossier `shared/` pour le contrat de l'API et un contrôle automatique des imports,
**afin de** que le site, l'admin et l'API parlent le même langage sans dépendre les uns des autres.

---

## Critères d'acceptation

- [ ] **Given** `shared/contract/health.ts`, **Then** `server/app.ts` s'en sert pour `/api/health` et `/api/admin/status` (fin de la copie manuelle de `DbStatus`)
- [ ] **Given** `shared/tsconfig.json` sans DOM ni Node, **When** on y importe `document` ou `node:fs`, **Then** la compilation échoue
- [ ] **Given** `scripts/check-boundaries.mjs` (≈ 50 lignes, sans dépendance) dans `npm run build`, **When** `src/` importe `server/`, **Then** le build échoue avec « src/x.ts importe server/app.ts : interdit (web → server) »
- [ ] **Given** `check-api-esm`, **Then** il couvre aussi `shared/` (imports relatifs avec `.js`), et Vercel embarque bien `shared/`

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 7 et règles d'import.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 0,5 |
| Risque | Faible |
| Dépend de | US001 |

Détail : [plan de cloisonnement](../../../tasks/cloisonnement-depot-plan.md) § 3.2 et § 4 (étape 1) ; règles écrites d'abord sur la structure actuelle (`src/` = web).

---

## Checklist dev
- [ ] `npm run build` et `npm test` passent
- [ ] Prévisualisation `preview/cloisonnement` : `/`, `/api/health`, `/admin/` répondent ; service worker sans `admin/`
- [ ] Lock commité si les dépendances changent
- [ ] README, DECISIONS, CHANGELOG si besoin
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : 🔲 Todo
