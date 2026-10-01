# EP004 - US003 - Un lobby qui explique le projet, les jeux et les fonctionnalités

## User Story

**En tant que** visiteur qui arrive sur le site,
**je veux** un écran d'accueil clair qui m'explique ce qu'est le projet et ce que je peux y faire,
**afin de** savoir par où commencer et d'avoir envie d'explorer.

---

## Critères d'acceptation

- [ ] **Given** j'ouvre le site, **When** le lobby apparaît (tout de suite, la ville charge derrière), **Then** il montre le nom du projet, une courte présentation, une barre de progression et un bouton « Explorer la carte » grisé
- [ ] **Given** la ville est prête, **When** la dernière étape se termine, **Then** « La ville est prête » s'affiche et le bouton « Explorer la carte » s'active
- [ ] **Given** le lobby, **When** je le lis, **Then** il présente : le projet, les lieux d'histoire (exploration), le mini-jeu des éléphants, les ambiances (heure réelle, saisons, ville qui vit) et comment se déplacer (sections à confirmer, Q4)
- [ ] **Given** une présentation chiffrée (« 8 lieux d'histoire », « 169 bars, cafés et restaurants »), **When** je lis le lobby, **Then** les chiffres viennent des données chargées, pas d'un texte écrit en dur
- [ ] **Given** je clique sur « Explorer la carte » (ou j'appuie sur Entrée), **When** la transition se termine, **Then** le lobby disparaît et la carte est utilisable, sans nouveau chargement
- [ ] **Given** la case « Ne plus afficher cet écran » est cochée, **When** je reviens, **Then** le lobby n'apparaît plus (je vais à la carte après l'écran initial), et l'icône « ? » de la carte le rouvre
- [ ] **Given** la case n'est pas cochée, **When** je reviens, **Then** le lobby apparaît de nouveau
- [ ] **Given** `?debug` ou `?lobby=0`, **When** j'ouvre le site, **Then** je vais directement à la carte
- [ ] **Given** un écran de 320 px, **When** j'ouvre le lobby, **Then** tout est lisible sans dépasser, et le bouton « Explorer » est accessible sans longue recherche
- [ ] **Given** le clavier ou un lecteur d'écran, **When** je navigue, **Then** le focus est sur le bouton « Explorer », les titres sont des titres, et la touche Échap ou Entrée fait entrer
- [ ] **Given** la piste B (carte vivante) retenue, **When** la ville est prête, **Then** le fond passe en fondu du fond uni à la carte derrière un voile, et `?debug` indique toujours « repos (30 max) »
- [ ] **Given** les attributions, **When** je regarde le lobby ou la carte, **Then** les crédits et licences restent visibles (règle projet 5)

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | Le contenu est dans `src/content/lobby.json` (titres, textes, liste d'expériences) ; Dasco peut le modifier sans toucher au code |
| R2 | Le lobby est une liste d'**expériences** ; aujourd'hui une seule (« la carte », disponible), la place d'autres (« bientôt ») est prévue dans le design (US006) |
| R3 | Rien d'inventé : chaque phrase sur le projet est vérifiable dans `FEATURES.md` ou les données ; pas de fait historique non sourcé |
| R4 | Style **épuré**, selon le design validé à l'US001 ; réutilise les composants existants (`.card`, boutons, polices) |
| R5 | Le lobby est un calque HTML au-dessus de la carte (pas dans le canevas 3D) ; il ne reçoit les clics que tant qu'il est ouvert |
| R6 | Le bouton « Explorer » est grisé tant que la ville charge, actif dès qu'elle est prête |
| R7 | La case « Ne plus afficher » est mémorisée dans `localStorage` (comme la progression, `src/state/`) ; si le navigateur refuse le stockage, le lobby s'affiche à chaque visite |

---

## UI / Maquettes

**Écran** : lobby (voir le design de l'US001).

### États UI
| État | Description |
|---|---|
| Ordinateur | Panneau centré ou deux colonnes, sections lisibles d'un coup d'œil |
| Téléphone | Une colonne, bouton fixe en bas |
| Fermeture | Fondu vers la carte |
| Retour (Q1) | Rouvert par l'icône « ? » |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Pas de données pour un chiffre | La phrase est écrite sans le chiffre |
| Très petit écran | Sections repliables ou défilement, bouton toujours accessible |
| Retour depuis la carte | La carte garde sa position et sa progression |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 5 |
| Complexité | Medium |

---

## Checklist dev

- [ ] Code implémenté (`src/ui/lobby.ts`, `src/content/lobby.json`, style)
- [ ] `npm run build` passe
- [ ] Vérifié ordinateur et 320 px, clavier
- [ ] `?debug` : repos 30 max
- [ ] README et FEATURES à jour
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : 🔲 Todo
