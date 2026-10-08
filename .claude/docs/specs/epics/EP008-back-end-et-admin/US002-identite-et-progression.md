# EP008 - US002 - Identité anonyme et progression synchronisée

## User Story

**En tant que** joueur,
**je veux** un identifiant de joueur aléatoire (aucun compte, aucune adresse électronique) ; la progression (lieux découverts, points, éléphants ramenés) se synchronise avec la base et se retrouve sur un autre appareil avec un code personnel,
**afin de** garder un site gratuit, simple, et que ce que j'ajoute soit fiable.

---

## Critères d'acceptation

- [ ] Premier chargement : un identifiant est créé ; la progression locale actuelle est reprise telle quelle
- [ ] Un code personnel permet de retrouver sa progression sur un autre appareil
- [ ] Les écritures sont groupées (au plus une toutes les 30 s) ; hors ligne, on garde `localStorage` et on synchronise au retour
- [ ] Conflit entre deux appareils : on garde l'union des lieux découverts et le meilleur score

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
