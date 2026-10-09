# EP010 - US006 - `backend/` : l'API dans son dossier, sa propre config TypeScript

## User Story

**En tant que** développeur (Claude),
**je veux** que l'API (Hono, Zod, Drizzle) vive dans `backend/` avec sa propre config TypeScript (Node, sans DOM),
**afin de** de séparer nettement le back du front et de supprimer les contournements actuels.

---

## Critères d'acceptation

- [x] **Given** `server/` → `backend/src` (`db/` dedans, décision D7), **Then** `api/index.ts` (3 lignes, imposées par Vercel) renvoie vers `backend/`
- [x] **Given** le tsconfig du back, **When** on déploie sur `preview/front-back`, **Then** `/api/health` et `/api/admin/status` répondent
- [x] **Given** cette prévisualisation verte, **Then** `tsconfig.vercel-check.json` et les `/// <reference types="node" />` sont supprimés (pas avant)
- [x] **Given** `npm run api:dev`, Drizzle (`db:generate`, `db:migrate`) et les tests, **Then** ils marchent avec les nouveaux chemins ; les tests ne chargent plus la config de la carte
- [x] **Given** `check-boundaries.mjs`, **Then** il refuse que le back importe le front

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 7 et tableau « Qui a le droit d'utiliser quoi ».

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Phase | 2 |
| Jours | 0,5 à 1 |
| Risque | **Moyen** : zone qui a cassé 3 fois sur Vercel (500, 404) |
| Dépend de | Phase 1 |

Détail : [plan de cloisonnement](../../../tasks/cloisonnement-depot-plan.md) § 4 (étape 2) et § 6.

---

## Checklist dev
- [ ] `npm run build` et `npm test` passent
- [ ] Prévisualisation `preview/front-back` : `/`, `/admin/`, `/api/health` répondent ; service worker sans fichier de l'admin
- [ ] Lock commité si les dépendances changent
- [ ] README, DECISIONS, CHANGELOG si besoin
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : ✅ Done (09/10/2026, itération 85) : étapes A (renommage), B (tsconfig racine = back) et C (fin des contournements), chacune vérifiée sur `preview/front-back`
