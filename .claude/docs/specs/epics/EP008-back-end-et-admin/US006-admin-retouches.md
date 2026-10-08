# EP008 - US006 - Administration : retouches des parkings et des lieux

## User Story

**En tant que** Dasco (administrateur),
**je veux** corriger les parkings (`overrides`, `added`) et placer des lieux depuis l'administration, avec effet immédiat et sauvegarde dans le dépôt,
**afin de** garder un site gratuit, simple, et que ce que j'ajoute soit fiable.

---

## Critères d'acceptation

- [ ] Formulaire : masquer un parking, changer nom, tarif, capacité, position, ajouter une note **avec source obligatoire**
- [ ] Aperçu avant publication ; effet immédiat sans redéploiement (le site lit les retouches publiées)
- [ ] Chaque retouche est datée et attribuée (journal) ; export périodique en JSON dans le dépôt (sauvegarde, historique Git)
- [ ] Un texte saisi est **assaini** avant affichage (jamais de HTML brut)

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
