# EP009 - US005 - Pluie

## User Story

**En tant que** visiteur,
**je veux** voir la pluie tomber sur la maquette et les rues mouillées,
**afin de** de reconnaître un jour de pluie à Chambéry.

---

## Critères d'acceptation

- [ ] **Given** `?weather=rain&intensity=0.8`, **Then** des traînées de pluie tombent (un seul appel de rendu, nombre de gouttes selon `qualityLevel`) et les rues et toits paraissent mouillés
- [ ] **Given** une bruine, **Then** peu de gouttes, fines ; **Given** une averse, **Then** plus dense
- [ ] **Given** la nuit, **Then** les halos des bars et des rues sont un peu plus forts
- [ ] **Given** le budget de US001, **Then** il est respecté sur le téléphone de mesure
- [ ] **Given** la scène au repos sous la pluie, **Then** cadence plafonnée à 30 img/s et animation arrêtée après inactivité

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 10.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 3 |
| Complexité | Medium |
| Dépend de | US001, US002 |

Détail technique : [plan front](../../../tasks/meteo-front-plan.md) § 2.3.

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
