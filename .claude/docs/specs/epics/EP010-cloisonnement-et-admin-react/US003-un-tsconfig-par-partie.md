# EP010 - US003 - Un tsconfig par partie, config Vitest dédiée

## User Story

**En tant que** développeur (Claude),
**je veux** que chaque partie compile avec ses propres règles (Node pour l'API, DOM pour le site),
**afin de** de supprimer les contournements actuels et d'attraper les erreurs de frontière.

---

## Critères d'acceptation

- [ ] **Given** le tsconfig racine devenu celui de l'API (Node, sans DOM), **When** on déploie sur `preview/cloisonnement`, **Then** `/api/health` et `/api/admin/status` répondent
- [ ] **Given** cette prévisualisation verte, **Then** `tsconfig.vercel-check.json` et les `/// <reference types="node" />` sont supprimés (pas avant)
- [ ] **Given** `vitest.config.ts` dédié, **Then** les tests ne chargent plus la config PWA du site
- [ ] **Given** VS Code, **Then** les fichiers du site prennent bien le tsconfig du site

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 7 et règles d'import.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 0,5 |
| Risque | **Moyen** : zone qui a cassé 3 fois (500, 404) |
| Dépend de | US002 |

Détail : [plan de cloisonnement](../../../tasks/cloisonnement-depot-plan.md) § 4 (étape 2) et § 6.

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
