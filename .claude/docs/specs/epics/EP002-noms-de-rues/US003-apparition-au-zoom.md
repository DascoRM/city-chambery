# EP002 - US003 - Les noms apparaissent en fondu quand je zoome

## User Story

**En tant que** visiteur qui navigue sur la carte,
**je veux** que les noms de rues n'apparaissent que quand je zoome,
**afin que** la vue d'ensemble reste propre et que je lise les noms quand j'en ai besoin.

---

## Critères d'acceptation

- [ ] **Given** la vue d'ensemble à l'ouverture, **When** je regarde la carte, **Then** aucun nom de rue n'est visible
- [ ] **Given** la caméra au-delà de la distance de début (Q2), **When** je regarde la carte, **Then** les noms ne sont ni dessinés ni mis à jour (aucun coût)
- [ ] **Given** je zoome vers une rue, **When** la caméra franchit la distance de début, **Then** les noms apparaissent en fondu (pas d'un coup) et sont pleinement lisibles à la distance de pleine opacité
- [ ] **Given** je dézoome, **When** la caméra repasse la distance de début, **Then** les noms s'effacent en fondu
- [ ] **Given** je m'arrête pile à la distance de début, **When** je ne bouge plus, **Then** l'état est stable (pas de clignotement ni de va-et-vient)
- [ ] **Given** un téléphone (pincer pour zoomer), **When** je zoome, **Then** les noms apparaissent comme avec la molette
- [ ] **Given** la caméra en vol (`flyTo` vers un lieu), **When** elle s'approche, **Then** les noms apparaissent pendant le vol sans saccade
- [ ] **Given** la carte au repos zoomée, **When** je regarde le compteur `?debug`, **Then** il affiche toujours « repos (30 max) » (les noms ne forcent pas la pleine vitesse)
- [ ] **Given** la carte zoomée, **When** je compare avant et après avec `?debug`, **Then** les images/s baissent de moins de 5 %

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | **Distance d'apparition** : fondu entre `streetNames.fadeStart` (≈ 320 m) et `streetNames.fadeEnd` (≈ 200 m) de la caméra, valeurs à régler ensemble (Q2) ; stockées dans un fichier de réglages (comme `life.json`), pas en dur |
| R2 | **Distance caméra → centre de vue** (pas la hauteur seule) : l'apparition suit le zoom, pas l'inclinaison de la vue |
| R3 | **Hystérésis** : le seuil de disparition est un peu plus loin que celui d'apparition, pour éviter le clignotement autour du seuil |
| R4 | **Pas de calcul hors zoom** : la mise à jour est sautée tant que l'opacité reste 0 |
| R5 | **Cadence** : le module de la boucle (`Ticker`) ne se déclare « en mouvement » que pendant un fondu en cours ; au repos il est immobile (règle TI-02) |
| R6 | Au-delà du fondu, l'opacité est 1 (pas d'autre changement de style selon la distance) |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Zoom maximum (70 m) | Noms pleinement lisibles, pas disproportionnés |
| Vue très inclinée (on regarde l'horizon) | Les noms lointains s'effacent avec la distance, comme le reste |
| Retour à la vue d'ensemble par un bouton (reset nord / vue) | Les noms disparaissent en fondu |
| Changement d'heure pendant le fondu | Pas d'effet sur les noms |
| Mode `prefers-reduced-motion` | Fondu raccourci ou changement net (à confirmer) |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 3 |
| Complexité | Medium |

---

## Checklist dev

- [ ] Code implémenté (module des noms de rues, réglages, câblage dans `Ticker`)
- [ ] `npm run build` passe
- [ ] Vérifié avec molette, pincer et vol (`flyTo`)
- [ ] `?debug` : repos 30 max, images/s mesurées
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : 🔲 Todo
