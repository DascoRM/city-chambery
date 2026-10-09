# EP008 - US005 - Administration : accès protégé et tableau de bord

## User Story

**En tant que** Dasco (administrateur),
**je veux** une page `/admin` non référencée, protégée (jeton secret au début, puis identifiant et mot de passe d'un compte enregistré en base ; pas de GitHub ni d'autre fournisseur, décision du 09/10/2026), qui montre l'usage et la santé,
**afin de** garder un site gratuit, simple, et que ce que j'ajoute soit fiable.

---

## Critères d'acceptation

- [ ] `/admin` et `/api/admin/*` refusent tout accès sans le jeton ; limite de tentatives
- [ ] Tableau de bord : joueurs actifs, appels par jour, taille de la base, part du quota Vercel et Neon consommé
- [ ] Le jeton n'est jamais dans le dépôt ni dans le navigateur en clair (stocké en session)

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
