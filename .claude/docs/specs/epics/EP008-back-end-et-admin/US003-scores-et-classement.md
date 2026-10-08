# EP008 - US003 - Scores et classement

## User Story

**En tant que** joueur,
**je veux** un classement du jeu des éléphants (points, parties complètes) avec des pseudos choisis librement, sans compte,
**afin de** garder un site gratuit, simple, et que ce que j'ajoute soit fiable.

---

## Critères d'acceptation

- [ ] Un pseudo (filtré) accompagne le score ; classement des 20 meilleurs
- [ ] Le serveur **valide** le score (plafond, cadence) : un score envoyé par le navigateur peut être triché
- [ ] Lecture mise en cache (`s-maxage`) pour ménager le quota

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
