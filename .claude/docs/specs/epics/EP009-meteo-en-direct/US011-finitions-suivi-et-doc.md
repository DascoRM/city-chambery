# EP009 - US011 - Finitions, dégradation selon la fluidité, suivi admin, doc

## User Story

**En tant que** Dasco,
**je veux** que la météo se règle bien, se dégrade seule quand l'appareil peine et soit suivie dans l'administration,
**afin de** de livrer une météo fiable aux amis.

---

## Critères d'acceptation

- [ ] **Given** la fluidité sous 40 img/s après baisse de résolution maximale, **Then** précipitations coupées d'abord, puis sol mouillé / enneigé
- [ ] **Given** chaque météo, **Then** son rendu est relu et validé par Dasco
- [ ] **Given** l'administration, **Then** `/api/admin/status` montre le dernier relevé, son âge, les appels amont du jour et du mois, et passe en rouge si le relevé est « stale » depuis plus d'1 h
- [ ] **Given** la fin de l'epic, **Then** README, FEATURES, CHANGELOG, DECISIONS (+ ADR court sur la source météo) sont à jour

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 10.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 2,5 |
| Complexité | Medium |
| Dépend de | toutes |

Détail technique : [plan front](../../../tasks/meteo-front-plan.md) § 3 et § 7, [plan back](../../../tasks/meteo-back-plan.md) § 4 (monitoring).

---

## Checklist dev
- [ ] Code ; `npm run build` ; vérifié dans le navigateur avec `?weather=` et `?debug`
- [ ] Fluidité : compteur `?debug` avant / après (rendu logiciel non représentatif : mesure GPU ou téléphone notée à part)
- [ ] Le site marche sans la météo
- [ ] FEATURES, CHANGELOG, DECISIONS, README si besoin
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : 🔲 Todo
