# EP006 - US003 - Panneaux « P » et fiche parking sourcée

## User Story

**En tant que** visiteur,
**je veux** toucher un panneau P pour lire la fiche du parking, au ton du jeu,
**afin de** savoir ce que je sais, et ce que personne ne sait.

---

## Critères d'acceptation

- [ ] **Given** la couche allumée, **When** je regarde un parking nommé ou ≥ 150 m², **Then** un panneau « P » instancié (+1 appel) se lit de loin
- [ ] **Given** un panneau, **When** je le touche, **Then** la fiche s'ouvre (carte des lieux) : type, places, tarif d'appel daté, source ; chaque chiffre porte « OSM », « ≈ estimé » (formule visible) ou « inconnu » assumé avec humour
- [ ] **Given** les 15 parkings documentés, **When** j'ouvre leur fiche, **Then** les valeurs viennent de `src/content/parkings.json` (fiche > OSM > estimation), avec date du relevé et lien exploitant ; contradictions (Ravet 400 / 474, Ducs 64 / 112) tranchées et notées
- [ ] **Given** les priorités de clic, **When** je touche un panneau, **Then** il passe après les ✦ et les épingles, avant le sol
- [ ] **Given** le README, **When** j'y regarde, **Then** la licence « BNLS / Ville de Chambéry (ODbL) » et l'attribution sont ajoutées

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 12 (honnêteté des chiffres, priorité fiche > OSM > estimation, pas de temps réel, budget de rendu par vue, rien ne casse la balade).

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 5 |
| Dépend de | US001, US002 |

---

## Checklist dev

- [ ] `src/content/parkings.json`
- [ ] `src/scene/markers.ts`, `src/interaction.ts`, `src/ui/ui.ts`
- [ ] Panneau-liste accessible équivalent au canevas
- [ ] Fiche lisible à 390 px
- [ ] `npm run build` ; vérifié dans le navigateur ; images/s, appels, triangles mesurés par vue
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : 🔲 Todo
