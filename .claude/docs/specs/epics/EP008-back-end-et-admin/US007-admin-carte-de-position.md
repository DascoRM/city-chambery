# EP008 - US007 - Administration : carte de position

## User Story

**En tant que** Dasco (administrateur),
**je veux** la carte de l'administration permet de cliquer pour placer ou déplacer un lieu, un parking, un monument (reprend l'outil `?debug` « 📍 Position »),
**afin de** garder un site gratuit, simple, et que ce que j'ajoute soit fiable.

---

## Critères d'acceptation

- [ ] Clic sur la carte : position, bâtiment, parking, rue proches ; bouton « utiliser cette position » dans le formulaire
- [ ] Même rendu que l'application (même moteur), sans gêner les joueurs

> **08/10/2026** : réalisation dans l'admin React ([EP010](../EP010-front-back-et-admin-react/epic.md)). L'admin **affiche la carte Three.js existante** dans un cadre (`/?debug&admin=1`) ; l'outil 📍 Position, qui existe déjà, renvoie le point cliqué à l'admin (`postMessage`). Même moteur, même rendu, ≈ 0,5 j.

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 9 (coût nul, site d'abord, validation côté serveur, sources obligatoires, assainissement, secrets, données minimales).

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 3 |

---

## Checklist dev
- [ ] Code + tests ; `npm run build` ; le site marche sans l'API
- [ ] Effet sur les quotas gratuits noté (invocations, CPU, base)
- [ ] Sécurité vérifiée (accès, validation, assainissement)
- [ ] README, FEATURES, CHANGELOG, DECISIONS
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : 🔲 Todo
