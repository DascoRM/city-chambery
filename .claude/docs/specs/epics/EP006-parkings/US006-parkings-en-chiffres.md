# EP006 - US006 - Parkings en chiffres et quiz

## User Story

**En tant que** visiteur,
**je veux** des chiffres rigolos et un petit quiz sur les parkings,
**afin de** m'amuser en apprenant.

---

## Critères d'acceptation

- [ ] **Given** un panneau « Parkings en chiffres », **When** je l'ouvre, **Then** des équivalences comiques s'affichent, formules visibles et étiquetées « estimé » ; aucune équivalence « éléphant » chiffrée inventée
- [ ] **Given** le classement, **When** je le consulte, **Then** les plus gros parkings sont listés avec leur source
- [ ] **Given** le quiz, **When** je réponds, **Then** 3 à 5 questions à partir des données sourcées donnent la réponse et sa source
- [ ] **Given** le rendu, **When** j'ouvre le panneau, **Then** 0 appel de rendu de plus

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 12 (honnêteté des chiffres, priorité fiche > OSM > estimation, pas de temps réel, budget de rendu par vue, rien ne casse la balade).

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 3 |
| Dépend de | US001, US003 |

---

## Checklist dev

- [ ] Textes éditoriaux dans `src/content/parkings.json`
- [ ] Ton validé sur la maquette
- [ ] `npm run build` ; vérifié dans le navigateur ; images/s, appels, triangles mesurés par vue
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : 🔲 Todo
