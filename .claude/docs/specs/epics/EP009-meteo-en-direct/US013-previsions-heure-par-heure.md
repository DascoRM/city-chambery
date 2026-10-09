# EP009 - US013 - Prévisions heure par heure (facultative)

## User Story

**En tant que** visiteur,
**je veux** que la météo suive le curseur d'heure dans la journée,
**afin de** voir le temps qu'il fera ce soir, ou qu'il faisait ce matin.

---

## Critères d'acceptation

- [ ] **Given** `GET /api/weather/forecast`, **Then** 200 conforme à `weatherForecast` : 48 pas horaires (24 h passées, 24 h à venir), même normalisation que `/api/weather`, `s-maxage=600`, source relue au plus toutes les 60 min, même repli
- [ ] **Given** la carte hors Direct dans cette fenêtre, **Then** elle prend l'heure la plus proche (« Prévision 18 h, modèle ICON ») ; la lecture ▶ fait défiler la météo de la journée
- [ ] **Given** une heure hors de la fenêtre, **Then** météo « simulée », comme en v1

---

## Règles métier
Voir l'[epic](epic.md), règles 1 et 7.

| Règle | Description |
|-------|-------------|
| R1 | Une prévision est présentée comme telle (« Prévision », « modèle »), jamais comme la météo du moment |
| R2 | Au plus 720 appels de plus par mois à Open-Meteo (1 par heure) : toujours loin du quota gratuit |

---

## API

### Endpoint
```
GET /api/weather/forecast   → 200 weatherForecast (contrat/meteo.ts)
```

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 1,5 (back 0,5, carte 1) |
| Complexité | Medium |
| Dépend de | US003, US004 ; décision D4 (prévisions plus tard) |

Détail technique : [plan back v2](../../../tasks/ep009-back-plan-v2.md) § 4.4 (contrat) et § 10 ; [plan front v2](../../../tasks/ep009-front-plan-v2.md) § 3.6 et § 7.

---

## Checklist dev
- [ ] Branche `feat/EP009-US013-previsions` depuis `feat/EP009-meteo`
- [ ] `npm run build` et `npm test` ; prévisualisation (`s-maxage=600`)
- [ ] Vérifié dans le navigateur : curseur d'heure et lecture ▶
- [ ] FEATURES, CHANGELOG, DECISIONS, README
- [ ] Validé par Dasco

---

**Priorité** : Low
**Status** : 🔲 Todo (facultative)
