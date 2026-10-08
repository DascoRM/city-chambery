# EP008 - US001 - Socle API et base de données

## User Story

**En tant que** joueur,
**je veux** des fonctions `/api/*` dans le même dépôt (déployées avec le site), une base Neon, des migrations, des variables d'environnement séparées entre production et prévisualisation, un point de santé `/api/health`,
**afin de** garder un site gratuit, simple, et que ce que j'ajoute soit fiable.

---

## Critères d'acceptation

- [ ] `/api/health` répond (version, base joignable) en production et en prévisualisation
- [ ] Les migrations de la base sont dans le dépôt et rejouables ; la prévisualisation n'écrit **jamais** dans la base de production
- [ ] Le site fonctionne **sans** l'API (hors ligne, API en panne) : aucune régression
- [ ] Aucun secret dans le dépôt
- [ ] **Neon remplaçable** : le code ne lit que `DATABASE_URL`, utilise un pilote PostgreSQL standard et du SQL standard (aucune fonction propre à Neon)

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
