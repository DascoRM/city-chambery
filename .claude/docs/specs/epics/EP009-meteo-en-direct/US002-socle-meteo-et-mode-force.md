# EP009 - US002 - Socle météo : soleil / couvert, mode forcé, indicateur

## User Story

**En tant que** visiteur,
**je veux** que la lumière du diorama change quand le ciel est couvert, et voir la météo dans une petite puce,
**afin de** de sentir le temps qu'il fait sans quitter la maquette.

---

## Critères d'acceptation

- [ ] **Given** `?weather=cloudy`, **When** la scène s'affiche, **Then** la lumière est plus douce et plus grise, sans ombres portées, avec un fondu de quelques secondes
- [ ] **Given** `?weather=clear` ou aucune météo, **Then** la scène est identique à aujourd'hui
- [ ] **Given** `?debug`, **Then** un sélecteur (soleil, couvert, pluie, orage, neige, brouillard, vent + curseurs) et `window.diorama.weather.set()` permettent de forcer une météo
- [ ] **Given** la puce météo à côté de la puce Saison, **When** on l'ouvre, **Then** elle montre la condition, la température, l'âge du relevé et « Direct » ou « Simulée »
- [ ] **Given** la préférence « météo désactivée », **Then** aucun module météo n'est chargé et aucune requête n'est faite
- [ ] **Given** `prefers-reduced-motion`, **Then** les règles d'accessibilité de l'epic s'appliquent

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 10.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 3 |
| Complexité | Medium |
| Dépend de | US001 (conseillé) |

Détail technique : [plan front](../../../tasks/meteo-front-plan.md) § 1, § 3 et § 4 (module `weather.ts`, branchement dans `daynight.apply()`, vent partagé fumée / drapeaux).

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
