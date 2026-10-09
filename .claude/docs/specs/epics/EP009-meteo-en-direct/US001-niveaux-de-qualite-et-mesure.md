# EP009 - US001 - Niveaux de qualité et mesure sur téléphone

## User Story

**En tant que** Dasco,
**je veux** que le diorama connaisse la puissance de l'appareil (qualité basse, moyenne, haute) et qu'on mesure une pluie prototype sur un vrai téléphone,
**afin de** d'engager les effets météo en sachant ce qu'ils coûtent.

---

## Critères d'acceptation

- [ ] **Given** un téléphone, **When** le diorama démarre, **Then** `qualityLevel` vaut `low`, `medium` ou `high`, déduit de l'appareil, de la densité de pixels et des img/s déjà mesurées
- [ ] **Given** `?debug`, **When** on active la pluie prototype (≈ 3 000 traînées GPU, un seul appel de rendu), **Then** le compteur affiche les img/s et le temps GPU
- [ ] **Given** la mesure sur au moins un téléphone réel, **Then** un budget est noté dans DECISIONS (ex. pluie ≤ 2 ms GPU, ≤ +1 appel de rendu)

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 10.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 1 |
| Complexité | Simple |
| Dépend de | — |

Détail technique : [plan front](../../../tasks/meteo-front-plan.md) § 3 et § 7.

---

## Checklist dev
- [ ] Code ; `npm run build` ; vérifié dans le navigateur avec `?weather=` et `?debug`
- [ ] Fluidité : compteur `?debug` avant / après (rendu logiciel non représentatif : mesure GPU ou téléphone notée à part)
- [ ] Le site marche sans la météo
- [ ] FEATURES, CHANGELOG, DECISIONS, README si besoin
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : 🔲 Todo
