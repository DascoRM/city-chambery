# EP008 - US009 - Données personnelles

## User Story

**En tant que** joueur,
**je veux** mention claire de ce qui est collecté, export et suppression de ses données,
**afin de** garder un site gratuit, simple, et que ce que j'ajoute soit fiable.

---

## Critères d'acceptation

- [ ] Page d'information : identifiant, pseudo, progression ; aucune adresse électronique, aucun suivi publicitaire
- [ ] Bouton « supprimer mes données » qui efface côté serveur
- [ ] Hébergement des données dans l'Union européenne (région de la base)

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
