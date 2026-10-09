# EP008 - US008 - Garde-fous de coût

## User Story

**En tant que** Dasco (administrateur),
**je veux** rester dans les offres gratuites : mise en cache, limites par adresse, alerte avant d'atteindre un quota, arrêt propre,
**afin de** garder un site gratuit, simple, et que ce que j'ajoute soit fiable.

---

## Critères d'acceptation

- [ ] Limite de requêtes par adresse sur les écritures ; réponses de lecture mises en cache
- [ ] Alerte (message dans l'administration) à 70 % d'un quota
- [ ] Au-delà d'un quota, l'application continue de fonctionner sans l'API

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 9 (coût nul, site d'abord, validation côté serveur, sources obligatoires, assainissement, secrets, données minimales).

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 2 |

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
