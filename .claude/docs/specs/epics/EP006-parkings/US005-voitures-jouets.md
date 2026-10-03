# EP006 - US005 - Voitures-jouets garées

## User Story

**En tant que** visiteur,
**je veux** voir de petites voitures dans les parkings,
**afin de** sourire et sentir l'échelle.

---

## Critères d'acceptation

- [ ] **Given** la couche allumée, **When** je m'approche, **Then** un seul `InstancedMesh` de voitures-jouets (échelle 1,2) peuple les parkings dans un rayon de 150 m autour de la vue (110 m sur téléphone), ≈ 150 en moyenne, 450 au plus
- [ ] **Given** la capacité connue ou estimée, **When** les voitures sont posées, **Then** leur nombre ne dépasse pas la capacité ; sans capacité, un damier vide
- [ ] **Given** l'occupation, **When** l'heure change, **Then** elle varie (courbe par type) et est **libellée « simulée »**
- [ ] **Given** l'avatar, **When** il approche à moins de 4 m, **Then** les voitures proches s'effacent (grandissent / rétrécissent sur place) : jamais d'obstacle
- [ ] **Given** la nuit, **When** je regarde, **Then** les voitures sont éclairées comme les passants, sans briller
- [ ] **Given** l'iPhone 12 Pro, **When** la couche est allumée, **Then** pas plus de −3 images/s par rapport à la même vue

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 12 (honnêteté des chiffres, priorité fiche > OSM > estimation, pas de temps réel, budget de rendu par vue, rien ne casse la balade).

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 5 |
| Dépend de | US002, US004 |

---

## Checklist dev

- [ ] Géométrie très simple (pas d'asset tiers)
- [ ] Mesures iPhone via Vercel
- [ ] `npm run build` ; vérifié dans le navigateur ; images/s, appels, triangles mesurés par vue
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : 🔲 Todo
