# EP001 - US009 - Des fenêtres et des portes visibles de jour sur les bâtiments

**Statut : 📝 à préciser avec Dasco** (remplace l'ancienne US009 « portes, balcons, climatiseurs et lucarnes » du pack, abandonnée avec le pack le 30/09/2026).

## User Story

**En tant que** visiteur qui zoome sur les bâtiments en plein jour,
**je veux** voir des fenêtres et des portes sur les façades,
**afin que** les bâtiments ne ressemblent plus à des boîtes lisses quand le soleil est levé.

---

## Contexte
Dasco préfère les bâtiments actuels (extrusions pastel) à ceux du pack modulaire essayé à l'itération 47, et ne regrette qu'une chose : **de jour, ils n'ont ni fenêtres ni portes**. Aujourd'hui les fenêtres n'existent que la nuit : le shader `windowsMaterial` (`src/scene/city.ts`) les allume en émission sur une grille de 3 m × 3,2 m quand `uNight` est positif, et ne dessine rien le jour.

---

## Critères d'acceptation (à affiner)

- [ ] **Given** la carte à midi, **When** je zoome sur une façade, **Then** je vois des fenêtres : des panneaux de verre sombres et légèrement bleutés, aux mêmes endroits que les fenêtres allumées de la nuit
- [ ] **Given** la même façade à 23 h, **When** je la regarde, **Then** les fenêtres allumées sont aux mêmes emplacements qu'avant (rien ne change la nuit)
- [ ] **Given** une façade côté rue au rez-de-chaussée, **When** je zoome dessus, **Then** je vois parfois une porte (un panneau plus haut et plus foncé, teinte bois), pas une porte sur chaque mur
- [ ] **Given** `?debug`, **When** je compare avant et après, **Then** le nombre d'appels de rendu et de triangles est identique (tout se passe dans le shader)
- [ ] **Given** un téléphone, **When** je regarde la carte, **Then** la cadence n'est pas dégradée (mesure)

---

## Règles métier et piste technique

| Règle | Description |
|-------|-------------|
| R1 | **Dans le shader existant**, sans nouveau modèle, sans pack, sans triangle de plus : le masque de fenêtre `win` (grille de 3 × 3,2 m, hauteur > 1,5 m) sert aussi de jour, pour assombrir la couleur de base du mur (verre) au lieu d'ajouter de la lumière |
| R2 | **Teinte du verre** : mélange de la couleur du mur et d'un bleu-gris sombre (à régler à l'œil) ; un léger reflet du ciel est possible (à juger) |
| R3 | **Volets, appuis, encadrements** : hors scope de cette US (un simple décalage de couleur autour du panneau de verre peut suffire pour l'encadrement) |
| R4 | **Portes** : au rez-de-chaussée seulement (hauteur du sol local < 2,5 m), sur une fraction des cases (hachage stable comme pour les fenêtres), jamais sur un mur de moins de 3 m ; sur les façades côté rue si l'information est facile à obtenir dans le shader, sinon au hasard stable (décor) |
| R5 | **Règle du projet** : décor, pas un relevé ; à déclarer dans « Limites connues » |
| R6 | La grille et le hachage des fenêtres de nuit ne changent pas (les fenêtres allumées restent aux mêmes endroits) |

## Questions pour Dasco
- Verre sombre ou plutôt clair (reflet du ciel) ?
- Faut-il des volets ou des encadrements colorés, ou le verre seul suffit ?
- Des portes sur toutes les façades du rez-de-chaussée, ou seulement côté rue ?

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 3 |
| Complexité | Medium (shader, à juger à l'œil sur plusieurs façades et à toute heure) |

---

**Priorité** : Medium
**Status** : 📝 À préciser
