# EP008 - US010 - Documentation et sauvegarde

## User Story

**En tant que** Dasco (administrateur),
**je veux** mode d'emploi (créer la base, les variables, les migrations), décision d'architecture, sauvegarde régulière de la base,
**afin de** garder un site gratuit, simple, et que ce que j'ajoute soit fiable.

---

## Critères d'acceptation

- [ ] README et ADR à jour ; procédure de création de la base pas à pas
- [ ] **Changement d'hébergeur testé** : sur une base Postgres vierge (par exemple en local), rejouer les migrations, restaurer l'export, changer `DATABASE_URL` : le site fonctionne ; procédure écrite
- [ ] Sauvegarde automatique (export hebdomadaire dans un stockage gratuit) et procédure de restauration testée

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
