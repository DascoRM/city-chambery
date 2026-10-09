# EP010 - US009 - Docker / Coolify et documentation

## User Story

**En tant que** Dasco,
**je veux** que l'image du Pi et la documentation suivent la nouvelle structure,
**afin de** de pouvoir reprendre le projet sans surprise.

---

## Critères d'acceptation

- [x] **Given** le Dockerfile, **Then** l'image du Pi construit la carte seule (D4), et `deploy/refresh-data.sh` marche
- [x] **Given** la doc, **Then** README (structure, commandes), CLAUDE.md (règles et checklist), context.md (« Backend : Aucun » est faux depuis EP008), getting-started et le schéma d'EP008 décrivent frontend (carte, admin) et backend ; l'historique reste tel quel

> **Décisions du 09/10/2026** : l'hébergement sur le Raspberry Pi 5 (Coolify) reste prévu par principe (D11) : nginx répond 404 sur `/api` et `/admin` au lieu de la page de la carte. **Déjà fait** pendant la relecture de la phase 1 : `npm run build:pi` (la carte seule) dans le Dockerfile. Reste : nginx, documentation, `docker compose build` chez Dasco (Docker absent du Mac de développement).

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
- [x] `npm run build` et `npm test` passent
- [x] `docker compose build` sur le Mac
- [x] Lock commité si les dépendances changent
- [x] README, DECISIONS, CHANGELOG si besoin
- [x] Validé par Dasco

---

**Priorité** : Medium
**Status** : ✅ Done (09/10/2026, itération 87) ; image Docker vérifiée par Dasco : la carte s'affiche, 404 sur `/admin` et `/api`
