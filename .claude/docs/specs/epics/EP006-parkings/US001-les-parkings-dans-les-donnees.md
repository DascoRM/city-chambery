# EP006 - US001 - Les parkings dans les données

## User Story

**En tant que** visiteur curieux,
**je veux** que les parkings existent dans les données de la ville, fusionnés et classés sans erreur,
**afin de** pouvoir les montrer sans rien inventer.

---

## Critères d'acceptation

- [ ] **Given** `data/raw/overpass.json`, **When** je lance `npm run data -- --offline`, **Then** `city.json` contient les parkings (polygones, segments de voirie, entrées) avec type, nom, capacité, `fee`, `access`, `maxheight`, niveaux, et le poids ajouté est de 30 à 65 Ko au plus
- [ ] **Given** les doublons (Château et Palais de Justice : nœud + polygone ; entrées de l'Hôtel de Ville et de Curial), **When** j'exporte, **Then** un parking n'apparaît qu'une fois
- [ ] **Given** le polygone « Parking du Château » (10 104 m², 604 places), **When** je l'exporte, **Then** il est classé **souterrain**
- [ ] **Given** les parkings privés et les poches de moins de 300 m², **When** j'exporte, **Then** ils sont exclus (sauf les nommés et ceux à capacité)
- [ ] **Given** l'export, **When** je lis le rapport du script, **Then** j'ai les chiffres : combien ont un contour, une capacité, un tarif, une capacité estimée
- [ ] **Given** la règle d'estimation (aire / 28 m², surface > 300 m² seulement), **When** elle s'applique, **Then** la valeur est marquée « estimée » dans les données

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 12 (honnêteté des chiffres, priorité fiche > OSM > estimation, pas de temps réel, budget de rendu par vue, rien ne casse la balade).

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 5 |
| Dépend de | — |

---

## Checklist dev

- [ ] `scripts/fetch-osm.mjs`, `diorama.config.json`, types dans `src/types.ts`
- [ ] Script de contrôle (comparaison capacités / sources, dates de relevé)
- [ ] Chargement mesuré avant / après
- [ ] `npm run build` ; vérifié dans le navigateur ; images/s, appels, triangles mesurés par vue
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : 🟡 Fait (itération 72), à valider par Dasco
