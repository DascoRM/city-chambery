# EP009 - US009 - Vent (fumées, drapeaux, arbres)

## User Story

**En tant que** visiteur,
**je veux** voir la fumée des cheminées, les drapeaux et les arbres suivre le vent réel,
**afin de** de sentir le vent sur la maquette.

---

## Critères d'acceptation

- [ ] **Given** un vent réel, **Then** fumées et drapeaux s'orientent selon sa direction et sa force (aujourd'hui figés à la construction)
- [ ] **Given** un vent fort et `qualityLevel` ≥ `medium`, **Then** les arbres se balancent ; coupé en qualité basse (les arbres font 80 % des triangles)
- [ ] **Given** l'automne, **Then** quelques feuilles volent (optionnel)

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 10.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 2,5 |
| Complexité | Medium |
| Dépend de | US001, US002 |

Détail technique : [plan front](../../../tasks/meteo-front-plan.md) § 2.7.

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
