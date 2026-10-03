# EP006 - US009 - Mesures, accessibilité, documentation, scénario de test

## User Story

**En tant que** équipe,
**je veux** vérifier que tout tient,
**afin de** livrer sans régression.

---

## Critères d'acceptation

- [ ] **Given** la couche éteinte, **When** je compare avant / après, **Then** +0 appel de rendu, mêmes images/s, chargement ≤ +0,15 s
- [ ] **Given** quatre vues (ensemble, Carré Curial, château, rue de Boigne), **When** la couche est allumée, **Then** le budget de l'epic est tenu
- [ ] **Given** les lecteurs d'écran et le clavier, **When** j'utilise la liste des parkings, **Then** elle est un équivalent du canevas
- [ ] **Given** le scénario de test, **When** je le rejoue, **Then** les résultats sont dans le CHANGELOG (réussi, échoué, non vérifié) ; README, FEATURES, DECISIONS à jour

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 12 (honnêteté des chiffres, priorité fiche > OSM > estimation, pas de temps réel, budget de rendu par vue, rien ne casse la balade).

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 3 |
| Dépend de | US002 à US007 |

---

## Checklist dev

- [ ] Relevé iPhone 12 Pro via Vercel (`?debug`)
- [ ] Nuit et hiver
- [ ] `npm run build` ; vérifié dans le navigateur ; images/s, appels, triangles mesurés par vue
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : 🔲 Todo
