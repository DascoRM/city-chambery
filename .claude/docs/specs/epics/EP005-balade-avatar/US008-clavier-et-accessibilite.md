# EP005 - US008 - Se déplacer au clavier et rester accessible

## User Story

**En tant que** visiteur qui préfère le clavier, ou qui a besoin d'aides à l'accessibilité,
**je veux** diriger l'avatar au clavier et comprendre ce qui se passe,
**afin de** que la balade ne soit pas réservée à la souris et au toucher.

---

## Critères d'acceptation

- [ ] **Given** le mode balade, **When** j'appuie sur les flèches ou ZQSD, **Then** l'avatar avance le long du réseau dans la direction la plus proche de celle demandée à l'écran
- [ ] **Given** le lobby ouvert, un champ avec le focus (curseur d'heure, cases de légende) ou Ctrl / Cmd enfoncé, **When** j'appuie sur une touche, **Then** rien n'est capté ; la touche P (outil de placement, dev) n'est pas détournée
- [ ] **Given** une marche en cours, **When** j'appuie sur Échap, **Then** elle s'arrête ; Entrée ou Espace ouvre le lieu proche
- [ ] **Given** un lecteur d'écran, **When** je lis la page, **Then** le canevas a un `aria-label` et une zone `aria-live` annonce « Vous êtes près de : … » (lieu, nom de rue) et « Nouveau lieu découvert »
- [ ] **Given** `prefers-reduced-motion`, **When** je me promène, **Then** le suivi est sans lissage long, sans rebond ni oscillation, et les vols sont raccourcis
- [ ] **Given** l'avatar, **When** je le regarde en couleurs atténuées, **Then** il se distingue par sa silhouette et son contraste, pas seulement par sa couleur

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | `KeyboardEvent.code` (`KeyW/KeyA/KeyS/KeyD` couvre ZQSD sur AZERTY : à vérifier sur ton clavier) |
| R2 | Pas de promesse de parcours complet au lecteur d'écran : le Journal reste l'équivalent (Q10) |
| R3 | Tout en français, tutoiement (« Touche pour marcher ») |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Direction sans voie alignée | L'avatar ne bouge pas |
| Touche maintenue | Marche continue, arrêt net au relâchement |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 3 |
| Complexité | Medium |

---

## Checklist dev

- [ ] Commandes clavier
- [ ] `aria-label` et annonces
- [ ] Réduction des animations
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : 🔲 Todo
