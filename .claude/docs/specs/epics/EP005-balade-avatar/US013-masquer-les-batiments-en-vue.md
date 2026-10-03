# EP005 - US013 - Masquer les bâtiments « en vue » dans le mode balade (itération suivante)

## User Story

**En tant que** visiteur en mode balade,
**je veux** dégager la vue en masquant les bâtiments qui sont dans mon champ de vision, dans ce mode seulement,
**afin de** mieux voir la ville et mon avatar, sans toucher à la carte libre.

---

## Critères d'acceptation

- [ ] À écrire à l'ouverture : la décision de Dasco est que **la première version efface les bâtiments entiers qui masquent l'avatar (US005)**, puis qu'**une itération** permette de « supprimer les bâtiments en vue » **uniquement dans ce mode**

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | Un mode exclusif permet des choses qu'on n'a pas dans la carte libre, sans conflit : par exemple une géométrie ou un rendu propre au mode balade |
| R2 | Idées à étudier : masquer tous les bâtiments d'un cône devant la caméra, ou dans un rayon autour de l'avatar ; bouton pour activer ou non |
| R3 | Dépend du résultat de l'US005 (identifiant de bâtiment, coût mesuré) |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Non précisé | À définir avec Dasco à l'ouverture |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 5 |
| Complexité | Medium (à estimer) |

---

## Checklist dev

- [ ] À spécifier à l'ouverture

---

**Priorité** : Low
**Status** : ⏳ Plus tard
