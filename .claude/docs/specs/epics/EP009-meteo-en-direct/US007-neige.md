# EP009 - US007 - Neige (flocons, sol, toits, arbres)

## User Story

**En tant que** visiteur,
**je veux** voir la neige tomber et blanchir les toits, les rues et les arbres,
**afin de** voir Chambéry sous la neige.

---

## Critères d'acceptation

- [ ] **Given** `?weather=snow`, **Then** des flocons tombent lentement, avec une légère dérive (2 appels de rendu au plus)
- [ ] **Given** de la neige, **Then** toits, sol, parcs et canopées blanchissent selon la pente (les façades non), en gardant la palette pastel ; vérifié dans chaque vue (ensemble, Carré Curial, château, rue)
- [ ] **Given** les 8 à 10 matériaux concernés, **Then** un seul morceau de GLSL commun, posé au démarrage : aucun à-coup à l'arrivée de la neige
- [ ] **Given** `?weather=sleet` (pluie et neige), **Then** gouttes et flocons mêlés
- [ ] **Given** la neige d'hiver demandée au BACKLOG (« Hiver : reprendre les arbres », arbres enneigés plutôt que nus), **Then** traitée ici ou reportée explicitement

---

## Règles métier
Voir l'[epic](epic.md), règles 6, 8 et 9.

| Règle | Description |
|-------|-------------|
| R1 | Flocons : même système GPU que la pluie (sprites ronds, chute lente, dérive par flocon) ; 800 à 3 000 selon le niveau de qualité |
| R2 | Neige au sol : uniforme `uSnow` × orientation vers le haut × un peu de bruit, vers un blanc bleuté légèrement cassé |
| R3 | Matériaux : rues, bâtiments et toits, sol, arbres, cheminées, auvents, toits des monuments ; crochets posés au démarrage (chaque matériau modifié plus tard figerait l'image) |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 3 à 4 |
| Complexité | Complexe |
| Dépend de | US002, US005 (système de précipitations, crochets des matériaux) |

Détail technique : [plan front v2](../../../tasks/ep009-front-plan-v2.md) § 4.4 et § 2.8. Risque visuel le plus élevé de l'epic ; à planifier avant l'hiver pour l'effet démo.

---

## Checklist dev
- [ ] Branche `feat/EP009-US007-neige` depuis `feat/EP009-meteo`
- [ ] `npm run build` et `npm test` ; vérifié dans le navigateur avec `?weather=snow` et `?debug`, dans chaque vue
- [ ] Fluidité : compteur `?debug` avant / après, aucune image de plus de 50 ms à l'arrivée de la neige
- [ ] Le site marche sans la météo
- [ ] FEATURES, CHANGELOG, DECISIONS, BACKLOG (arbres d'hiver)
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : 🔲 Todo
