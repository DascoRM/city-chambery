# EP006 - US004 - Marquages de places (décor)

## User Story

**En tant que** visiteur,
**je veux** voir des places dessinées dans les parkings de surface,
**afin de** sentir la maquette vivante.

---

## Critères d'acceptation

- [ ] **Given** un parking de surface, **When** la couche est allumée, **Then** des places sont tracées d'après sa forme, en géométrie (+1 appel, ≈ 12 000 triangles au plus)
- [ ] **Given** les chiffres OSM, **When** la fiche s'affiche, **Then** elle donne le chiffre OSM (la disposition affiche « illustrative »)
- [ ] **Given** les pentes, **When** je regarde un parking incliné, **Then** les marquages suivent le relief (même découpe que les rubans de `city.ts`)

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 12 (honnêteté des chiffres, priorité fiche > OSM > estimation, pas de temps réel, budget de rendu par vue, rien ne casse la balade).

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 3 |
| Dépend de | US002 |

---

## Checklist dev

- [ ] Réutiliser la découpe des rubans
- [ ] Mesurer sur pente
- [ ] `npm run build` ; vérifié dans le navigateur ; images/s, appels, triangles mesurés par vue
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : 🔲 Todo
