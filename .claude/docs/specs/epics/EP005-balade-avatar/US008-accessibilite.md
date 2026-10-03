# EP005 - US008 - Une balade accessible : animations réduites, silhouette contrastée

## User Story

**En tant que** visiteur sensible aux animations ou à la couleur,
**je veux** que la balade respecte mes réglages et reste lisible,
**afin de** me promener sans gêne.

---

## Critères d'acceptation

- [ ] **Given** `prefers-reduced-motion`, **When** je me promène, **Then** le suivi est sans lissage long, sans rebond ni oscillation de l'avatar, et les vols sont raccourcis
- [ ] **Given** l'avatar, **When** je le regarde en couleurs atténuées, **Then** il se distingue par sa silhouette et son contraste, pas seulement par sa couleur
- [ ] **Given** un lecteur d'écran, **When** je lis la page, **Then** le canevas a un `aria-label` et une zone `aria-live` annonce « Vous êtes près de : … » (lieu) et « Nouveau lieu découvert »
- [ ] **Given** la balade, **When** je veux lire les lieux sans la souris, **Then** le Journal reste l'équivalent (comme pour la carte libre)

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | **Pas de contrôle au clavier** : décision de Dasco, on vise le clic souris et le toucher |
| R2 | Pas de promesse de parcours complet au lecteur d'écran : le Journal est l'équivalent pour le web |
| R3 | Tout en français, tutoiement |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| `prefers-reduced-motion` actif dans le lobby | Déjà géré (rotation arrêtée, transitions supprimées) |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 2 |
| Complexité | Simple |

---

## Checklist dev

- [ ] Réduction des animations
- [ ] Silhouette contrastée (avec US002 et US005)
- [ ] `aria-label` et annonces
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : 🔲 Todo
