# EP009 - US011 - Finitions, calibrage, documentation

## User Story

**En tant que** Dasco,
**je veux** que chaque météo soit réglée avec moi et que la documentation suive,
**afin de** livrer aux amis une météo fiable et belle.

---

## Critères d'acceptation

- [ ] **Given** chaque météo, **Then** son rendu est relu et validé par Dasco avec `?weather=` ; les constantes retenues (nommées dans le code) sont notées dans DECISIONS
- [ ] **Given** les seuils du back (D7), **Then** ils sont calibrés avec Dasco à partir du relevé brut (écran « Météo » de l'admin si US012 est faite)
- [ ] **Given** la fin de l'epic, **Then** FEATURES, CHANGELOG, DECISIONS (+ un ADR court sur la source météo), README (puce, `?weather=`, `?quality=`) et PERF-AUDIT (mesures sur téléphone) sont à jour
- [ ] **Given** l'idée d'une « veille » à 15 img/s après 2 min sans interaction (batterie, avec ou sans météo), **Then** elle est proposée au BACKLOG, hors EP009

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 13.

*Changements de la v2 : la dégradation selon la fluidité passe dans US005 (règle 8 de l'epic, nouveau seuil) ; le suivi dans l'administration devient US012.*

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 1,5 à 2 |
| Complexité | Medium |
| Dépend de | toutes les US du lot choisi |

Détail technique : [plan front v2](../../../tasks/ep009-front-plan-v2.md) § 5.4 et § 7 ; [plan back v2](../../../tasks/ep009-back-plan-v2.md) § 5.3 (seuils).

---

## Checklist dev
- [ ] Branche `feat/EP009-US011-finitions` depuis `feat/EP009-meteo`
- [ ] `npm run build` et `npm test`
- [ ] Le site marche sans la météo
- [ ] Documents de suivi, ADR, README, PERF-AUDIT
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : 🔲 Todo
