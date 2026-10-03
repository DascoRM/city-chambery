# EP005 - US012 - L'avatar et les éléphants (optionnelle, plus tard)

## User Story

**En tant que** joueur du mini-jeu,
**je veux** que mon avatar puisse approcher les éléphants pour les attraper,
**afin de** faire de la balade une vraie partie de cache-cache.

---

## Critères d'acceptation

- [ ] **Given** un éléphant épuisé, **When** mon avatar s'approche à ≤ 8-10 m, **Then** je peux l'attraper
- [ ] **Given** un éléphant qui marche, **When** l'avatar s'en approche, **Then** il sursaute (`startle` existe)
- [ ] **Given** le jeu hors balade, **When** je clique un éléphant, **Then** le comportement actuel est inchangé

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | À décider par Dasco après le prototype (Q7) ; hors v1 |
| R2 | Pas de collision avatar / éléphant en v1 (réseaux voisins : l'avatar peut passer « dans » un éléphant) |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Éléphant dans une autre composante | Non attrapable à pied : le clic reste possible |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 3 |
| Complexité | Medium |

---

## Checklist dev

- [ ] À spécifier à l'ouverture

---

**Priorité** : Low
**Status** : ⏳ Plus tard
