# EP009 - US008 - Orage

## User Story

**En tant que** visiteur,
**je veux** voir les éclairs illuminer la ville pendant un orage,
**afin que** l'orage soit spectaculaire sans être dangereux.

---

## Critères d'acceptation

- [ ] **Given** `?weather=thunder`, **Then** forte pluie, ciel assombri, éclairs (passe finale et lumière d'ambiance), un trait d'éclair de temps en temps, loin de la caméra
- [ ] **Given** les éclairs, **Then** jamais plus de 3 par seconde, 6 à 20 s entre deux salves, amplitude bornée (planificateur pur et testé sur 1 000 tirages)
- [ ] **Given** `prefers-reduced-motion` ou « Effets réduits », **Then** aucun éclair ni flash
- [ ] **Given** l'orage, **Then** soleil et ombres immobiles (aucun recalcul de la carte des ombres)
- [ ] **Given** un orage de jour, **Then** les lumières de la ville peuvent s'allumer sous le ciel noir (à juger avec Dasco)

---

## Règles métier
Voir l'[epic](epic.md), règles 1, 5 et 10.

| Règle | Description |
|-------|-------------|
| R1 | Orage déduit des codes 95 à 99 de la source : pas d'éclair « en temps réel », ne pas le promettre |
| R2 | Éclair : `uFlash` dans la passe finale (0,3 à 0,6, décroissance de 120 à 250 ms) et lumière d'ambiance pulsée |
| R3 | Trait d'éclair : ruban d'environ 40 segments, 1 appel de rendu pendant 150 ms environ ; absent en qualité basse |
| R4 | Photosensibilité (WCAG 2.3.1) : au plus 3 éclairs par seconde, toujours |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 2 |
| Complexité | Medium |
| Dépend de | US005 |

Détail technique : [plan front v2](../../../tasks/ep009-front-plan-v2.md) § 4.5 et § 2.1 (lumières de la ville sous l'orage).

---

## Checklist dev
- [ ] Branche `feat/EP009-US008-orage` depuis `feat/EP009-meteo`
- [ ] `npm run build` et `npm test` (`weather/lightning.test.ts`) ; vérifié dans le navigateur avec `?weather=thunder` et `?debug`
- [ ] Fluidité : compteur `?debug` avant / après
- [ ] Le site marche sans la météo
- [ ] FEATURES, CHANGELOG, DECISIONS
- [ ] Validé par Dasco

---

**Priorité** : Low
**Status** : 🔲 Todo
