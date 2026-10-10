# EP009 - US010 - Nuages de maquette

## User Story

**En tant que** visiteur,
**je veux** voir de petits nuages de maquette flotter autour du socle,
**afin que** le ciel couvert se voie aussi en volume.

---

## Critères d'acceptation

- [x] **Given** une couverture nuageuse, **Then** des nuages instanciés (1 appel de rendu) flottent, en nombre proportionnel, et dérivent avec le vent
- [x] **Given** la caméra qui s'approche, **Then** ils s'effacent en fondu pour ne pas masquer la ville *(ils ne passent jamais au-dessus de la ville ni entre la caméra et le point regardé, et disparaissent dans le brouillard : aucun en vue de rue ; correction des couleurs prémultipliées de la passe finale activée quand ils sont affichés)*
- [x] **Given** `qualityLevel` = `low`, **Then** aucun nuage

---

## Règles métier
Voir l'[epic](epic.md), règle 9.

| Règle | Description |
|-------|-------------|
| R1 | 6 à 12 « boules de coton » (icosaèdres aplatis fusionnés) en un seul `InstancedMesh` ; `ShaderMaterial` éclairé à la main (compilation rapide, sans brouillard), sans ombre |
| R2 | Hors périmètre : ombres de nuages qui défilent sur la ville (1,5 j, modifications invasives des shaders) |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 1,5 |
| Complexité | Medium |
| Dépend de | US002 |

Détail technique : [plan front v2](../../../tasks/ep009-front-plan-v2.md) § 4.7. Risque : lisibilité de la ville.

---

## Checklist dev
- [x] Branche `feat/EP009-US010-nuages` depuis `feat/EP009-meteo`
- [x] `npm run build` et `npm test` ; vérifié dans le navigateur avec `?weather=partly`, `?weather=cloudy` et `?debug`
- [x] Fluidité : compteur `?debug` avant / après
- [x] Le site marche sans la météo
- [x] FEATURES, CHANGELOG, DECISIONS
- [ ] Validé par Dasco

---

**Priorité** : Low
**Status** : ✅ Done (10/10/2026, itération 97) ; rendu à juger par Dasco
