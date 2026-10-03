# EP006 - US002 - Vue stationnement : couche et aplats

## User Story

**En tant que** visiteur,
**je veux** une couche « 🅿️ Parkings » qui colore la ville,
**afin de** voir d'un coup d'œil où l'on se gare.

---

## Critères d'acceptation

- [ ] **Given** la carte, **When** je touche « 🅿️ Parkings », **Then** les aplats colorés par type (surface, voirie, souterrain, silo, privé plus pâle) apparaissent au sol dans la texture du sol, sans objet de plus (+0 appel de rendu)
- [ ] **Given** les parkings à capacité inconnue, **When** la couche est allumée, **Then** ils sont visiblement « inconnu » (hachure ou gris), jamais présentés comme renseignés
- [ ] **Given** la couche éteinte, **When** je regarde `?debug`, **Then** rien n'a changé (appels, images/s)
- [ ] **Given** le mode balade, **When** j'y suis, **Then** le bouton « 🅿️ Parkings » reste disponible (la légende bars/cafés y est masquée)
- [ ] **Given** la maquette validée par Dasco, **When** je compare, **Then** couleurs et bouton y correspondent

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 12 (honnêteté des chiffres, priorité fiche > OSM > estimation, pas de temps réel, budget de rendu par vue, rien ne casse la balade).

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 3 |
| Dépend de | US001 |

---

## Checklist dev

- [ ] Maquette HTML (2 pistes) validée avant le code
- [ ] `src/scene/terrain.ts`/texture du sol, `src/ui/ui.ts`
- [ ] Nuit et hiver regardés
- [ ] `npm run build` ; vérifié dans le navigateur ; images/s, appels, triangles mesurés par vue
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : 🔲 Todo
