# EP009 - US007 - Neige (flocons, sol, toits, arbres)

## User Story

**En tant que** visiteur,
**je veux** voir la neige tomber et blanchir toits, rues et arbres,
**afin de** de voir Chambéry sous la neige.

---

## Critères d'acceptation

- [ ] **Given** `?weather=snow`, **Then** des flocons tombent lentement (un seul appel de rendu)
- [ ] **Given** de la neige, **Then** toits, sol et arbres blanchissent selon l'orientation des surfaces, en gardant la palette pastel
- [ ] **Given** les ≈ 8 à 10 matériaux concernés, **Then** ils sont modifiés par un seul utilitaire commun, vérifié dans chaque vue
- [ ] **Given** la neige d'hiver demandée au BACKLOG (arbres enneigés plutôt que nus), **Then** elle est traitée ici ou explicitement reportée

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 10.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 3 à 4 |
| Complexité | Complexe |
| Dépend de | US002, US005 (utilitaire de modification des matériaux) |

Détail technique : [plan front](../../../tasks/meteo-front-plan.md) § 2.5 ; risque visuel le plus élevé.

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
