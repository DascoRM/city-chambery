# EP010 - US009 - Docker / Coolify et documentation

## User Story

**En tant que** Dasco,
**je veux** que l'image du Pi et la documentation suivent la nouvelle structure,
**afin de** de pouvoir reprendre le projet sans surprise.

---

## Critères d'acceptation

- [ ] **Given** le Dockerfile, **Then** l'image du Pi construit la carte seule (D4), et `deploy/refresh-data.sh` marche
- [ ] **Given** la doc, **Then** README (structure, commandes), CLAUDE.md (règles et checklist), context.md (« Backend : Aucun » est faux depuis EP008), getting-started et le schéma d'EP008 décrivent frontend (carte, admin) et backend ; l'historique reste tel quel

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 7 et tableau « Qui a le droit d'utiliser quoi ».

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Phase | 2 |
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
