# EP009 - US008 - Orage

## User Story

**En tant que** visiteur,
**je veux** voir les éclairs illuminer la ville pendant un orage,
**afin de** que l'orage soit spectaculaire sans être dangereux.

---

## Critères d'acceptation

- [ ] **Given** `?weather=thunder`, **Then** forte pluie, ciel assombri, flashs dans la passe finale et un éclair visible de temps en temps
- [ ] **Given** les flashs, **Then** jamais plus de 3 par seconde
- [ ] **Given** `prefers-reduced-motion` ou la préférence « effets réduits », **Then** aucun flash ni éclair
- [ ] **Given** l'orage, **Then** la position du soleil et les ombres ne bougent pas

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 10.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 2 |
| Complexité | Medium |
| Dépend de | US005 |

Détail technique : [plan front](../../../tasks/meteo-front-plan.md) § 2.4 ; l'orage est déduit du code météo, pas d'éclairs en temps réel.

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
