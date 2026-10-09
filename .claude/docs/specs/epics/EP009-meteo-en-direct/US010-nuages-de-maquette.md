# EP009 - US010 - Nuages de maquette

## User Story

**En tant que** visiteur,
**je veux** voir de petits nuages de maquette flotter autour du socle,
**afin de** que le ciel couvert se voie aussi en volume.

---

## Critères d'acceptation

- [ ] **Given** une couverture nuageuse, **Then** des nuages instanciés (un appel de rendu) flottent en anneau, en nombre proportionnel
- [ ] **Given** la caméra qui s'approche, **Then** les nuages s'effacent en fondu pour ne pas masquer la ville
- [ ] **Given** `qualityLevel` = `low`, **Then** pas de nuages

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 10.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 1,5 |
| Complexité | Medium |
| Dépend de | US002 |

Détail technique : [plan front](../../../tasks/meteo-front-plan.md) § 2.2.

---

## Checklist dev
- [ ] Code ; `npm run build` ; vérifié dans le navigateur avec `?weather=` et `?debug`
- [ ] Fluidité : compteur `?debug` avant / après (rendu logiciel non représentatif : mesure GPU ou téléphone notée à part)
- [ ] Le site marche sans la météo
- [ ] FEATURES, CHANGELOG, DECISIONS, README si besoin
- [ ] Validé par Dasco

---

**Priorité** : Low
**Status** : 🔲 Todo
