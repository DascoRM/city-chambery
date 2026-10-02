# EP005 - US009 - Une balade fluide et confortable sur téléphone

## User Story

**En tant que** visiteur sur téléphone,
**je veux** me promener sans saccades et sans conflit de gestes,
**afin de** que la balade fonctionne aussi bien sur téléphone que sur ordinateur.

---

## Critères d'acceptation

- [ ] **Given** l'**iPhone 12 Pro** de Dasco (référence), **When** mon avatar marche, **Then** les images/s relevées avec `?debug` sont ≥ 30 (seuil à confirmer ; 60 Hz), avec la densité de pixels qui peut descendre à 1
- [ ] **Given** les retours d'utilisateurs (carte fluide même en 4G), **When** je charge la page en 4G, **Then** le temps de chargement reste ressenti comme bon avec le mode balade présent
- [ ] **Given** la marche, **When** la fluidité baisse, **Then** une baisse temporaire d'un cran de densité pendant la marche, rétablie à l'arrêt, est essayée avec prudence (changer la densité redimensionne les cibles de rendu)
- [ ] **Given** un doigt qui bouge de 6 à 10 px sans le vouloir, **When** je touche pour aller, **Then** ce n'est pas pris pour un glissement (seuil réglé sur appareil)
- [ ] **Given** une fiche en mode balade, **When** elle s'ouvre, **Then** l'avatar reste visible (point regardé décalé vers le haut, bande nette sur l'avatar)
- [ ] **Given** un écran de 320 px, **When** j'utilise la balade, **Then** les boutons ne se chevauchent pas
- [ ] **Given** une vue près d'un monument (630 à 732 appels de rendu aujourd'hui), **When** l'avatar y marche sur téléphone, **Then** la fluidité est mesurée ; si elle baisse trop, on étudie la fusion de la géométrie des monuments (ticket du backlog « Monuments : fusionner la géométrie par matériau »)
- [ ] **Given** les options de repli si nécessaire, **When** le mobile est trop lent, **Then** une des pistes est appliquée : `samples: 2` de l'effet maquette, passants réduits, arbres découpés par quartier

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | Aucune **mesure d'images/s sur téléphone** n'a été faite à ce jour (mesures faites sur un Mac avec la carte graphique) : `?debug` affiche le compteur sur le téléphone lui-même, il suffit d'ouvrir l'adresse avec `?debug` |
| R2 | Les retours d'utilisateurs sont qualitatifs (« très fluide, même en 4G ») : très bon signe, pas une mesure |
| R3 | Autres modèles de téléphone : à définir plus tard (un modèle plus ancien) |
| R4 | Geste mobile : voir US004 (P6) |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Téléphone ancien | Dégradation documentée, seuil à décider avec Dasco |
| Mode économie d'énergie | Non vérifié |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 3 |
| Complexité | Medium (dépend d'un appareil réel) |

---

## Checklist dev

- [ ] Mesures sur l'iPhone 12 Pro (`?debug`)
- [ ] Réglages de densité et de gestes
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : 🔲 Todo
