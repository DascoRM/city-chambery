# EP008 - US004 - Partage entre amis

## User Story

**En tant que** joueur,
**je veux** un code d'ami : on voit la progression de ses amis (lieux découverts, points),
**afin de** garder un site gratuit, simple, et que ce que j'ajoute soit fiable.

---

## Critères d'acceptation

- [ ] Ajouter un ami par son code ; retirer un ami
- [ ] On ne voit que la progression partagée (pseudo, nombre de lieux, points), rien d'autre
- [ ] Un joueur peut se retirer et supprimer ses données

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 9 (coût nul, site d'abord, validation côté serveur, sources obligatoires, assainissement, secrets, données minimales).

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 5 |

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
