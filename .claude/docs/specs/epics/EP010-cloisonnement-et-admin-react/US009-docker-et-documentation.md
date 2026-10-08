# EP010 - US009 - Docker / Coolify et documentation

## User Story

**En tant que** Dasco,
**je veux** que l'image du Pi et la documentation suivent la nouvelle structure,
**afin de** de pouvoir reprendre le projet sans surprise.

---

## Critères d'acceptation

- [ ] **Given** le Dockerfile, **Then** l'image du Pi ne construit que le site (contrôles compris) tant que l'API n'y tourne pas (D6), et `deploy/refresh-data.sh` marche toujours
- [ ] **Given** la doc, **Then** README (structure, commandes, admin), CLAUDE.md (règles 1 et 2, checklist), context.md (la ligne « Backend : Aucun » est fausse depuis EP008), getting-started et le schéma d'EP008 sont à jour ; l'historique du CHANGELOG reste tel quel

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 7 et règles d'import.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 0,5 |
| Risque | Faible |
| Dépend de | US008 |

Détail : [plan de cloisonnement](../../../tasks/cloisonnement-depot-plan.md) § 4 (étapes 6 et 7) et § 5.

---

## Checklist dev
- [ ] `npm run build` et `npm test` passent
- [ ] `docker compose build` sur le Mac
- [ ] Lock commité si les dépendances changent
- [ ] README, DECISIONS, CHANGELOG si besoin
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : 🔲 Todo
