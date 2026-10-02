# EP005 - US009 - Une balade fluide et confortable sur téléphone

## User Story

**En tant que** visiteur sur téléphone,
**je veux** me promener sans saccades et sans conflit de gestes,
**afin de** que la balade fonctionne aussi bien sur téléphone que sur ordinateur.

---

## Critères d'acceptation

- [ ] **Given** l'**iPhone 12 Pro** de Dasco (référence), **When** je relève avec `?debug` en mouvement, **Then** on sait pourquoi les images/s plafonnent à ≈ 31 (première mesure du 02/10 : ≤ 31 même en poussant les gestes, 750 à 1 000 appels de rendu) : mode économie d'énergie de l'iPhone, limite du téléphone, ou autre ; la cause est notée dans le CHANGELOG
- [ ] **Given** la balade (avatar, effacement), **When** je marche sur l'iPhone, **Then** les images/s ne passent pas sous le niveau relevé avant la balade (≈ 31 aujourd'hui : pas de marge, donc chaque ajout est mesuré)
- [ ] **Given** les retours d'utilisateurs (carte fluide même en 4G ; Dasco ne voit pas de contrainte sur l'iPhone), **When** je charge la page en 4G, **Then** le temps de chargement reste ressenti comme bon avec le mode balade présent
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
| R1 | **Première mesure sur téléphone (Dasco, 02/10/2026, iPhone 12 Pro)** : ≤ 31 images/s même en poussant les gestes, 750 à 1 000 appels de rendu au plus ; `?debug` affiche le compteur sur le téléphone lui-même. Le code ne plafonne rien sur mobile : en mouvement il monte à ≈ 60 sur Mac, donc un plafond à ≈ 31 est à expliquer (mode économie d'énergie, ou téléphone au maximum de ses forces avec la densité déjà au minimum) |
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
