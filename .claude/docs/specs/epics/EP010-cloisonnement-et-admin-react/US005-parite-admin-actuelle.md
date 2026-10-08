# EP010 - US005 - Parité avec l'admin actuelle, suppression de `public/admin`

## User Story

**En tant que** Dasco (administrateur),
**je veux** retrouver dans la nouvelle admin exactement ce que montre l'actuelle (connexion, état de la base),
**afin de** de basculer sans rien perdre.

---

## Critères d'acceptation

- [ ] **Given** le jeton, **When** je me connecte, **Then** je vois version, environnement, Node, région, état et taille de la base, lignes par table, avec les mêmes messages d'erreur
- [ ] **Given** la parité vérifiée sur prévisualisation, **Then** `public/admin/` est supprimé
- [ ] **Given** un service worker du site déjà installé dans le navigateur, **Then** `/admin/` s'ouvre quand même

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 7 et règles d'import.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 0,5 à 1 |
| Risque | Faible |
| Dépend de | US004 |

Détail : [plan de l'admin React](../../../tasks/admin-react-plan.md) § 4 (ADM-02).

---

## Checklist dev
- [ ] `npm run build` et `npm test` passent
- [ ] Prévisualisation `preview/cloisonnement` : `/`, `/api/health`, `/admin/` répondent ; service worker sans `admin/`
- [ ] Lock commité si les dépendances changent
- [ ] README, DECISIONS, CHANGELOG si besoin
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : 🔲 Todo
