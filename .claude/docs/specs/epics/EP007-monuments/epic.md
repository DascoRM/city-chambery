# Epic EP007 - Les monuments modélisés à la main

**Statut : spec écrite le 06/10/2026, à valider par Dasco. Rien n'est codé.** Analyse : [monuments et routes](../../../tasks/analyse-monuments-et-routes.md).

## Résumé
Donner à dix lieux marquants de Chambéry un **modèle fait à la main, un par un** (au lieu du volume générique tiré du contour OpenStreetMap) : chacun est une user story avec sa position, sa source, ses photos de référence et son budget de rendu.

---

## Contexte & Problème
- Dasco a listé dix lieux à modéliser. La **rotonde ferroviaire de la SNCF est hors de la carte** et l'emprise **ne sera pas agrandie vers le nord** : elle est écartée de cette epic (voir plus bas).
- Aujourd'hui seuls quatre monuments sont modélisés (château, cathédrale, Carré Curial, fontaine des Éléphants), construits **en code** sur les contours OSM (≈ 1 000 lignes). Les autres sont des volumes génériques (ou, pour trois d'entre eux, étaient absents : corrigé à l'itération 77).
- **Dasco ne peut pas communiquer de positions** par une conversation : il faut un outil dans l'application (voir l'epic « Outils d'administration » et son premier jalon, l'outil de position en mode `?debug`).

## Objectifs
1. Neuf lieux reconnaissables, chacun fabriqué pour lui-même (pas un gabarit unique)
2. Aucune hausse du nombre d'appels de rendu : tous les monuments ajoutés sont **fusionnés dans un seul maillage** (+1 appel au total)
3. Chaque modèle est sourcé (photos, liens) ; rien d'inventé

## Écartés
- **Rotonde ferroviaire de la SNCF** : hors de la carte ; l'emprise n'est pas agrandie (décision du 06/10).
- Le seul bout de **nouvelle gare** dans l'emprise : US009, à décider.

---

## User Stories

| ID | User Story | Estimation | Status |
|----|------------|-----------|--------|
| [US001](US001-musee-des-beaux-arts.md) | Musée des Beaux-Arts | 5 | 🔲 Todo |
| [US002](US002-palais-de-justice.md) | Palais de justice | 5 | 🔲 Todo |
| [US003](US003-chapelle-vaugelas.md) | Chapelle Vaugelas | 3 | 🔲 Todo |
| [US004](US004-eglise-notre-dame-du-rosaire.md) | Église Notre-Dame du Rosaire | 5 | 🔲 Todo |
| [US005](US005-place-saint-leger.md) | Place Saint-Léger | 3 | 🔲 Todo |
| [US006](US006-statue-de-la-sasson.md) | Statue de la Sasson | 2 | 🔲 Todo |
| [US007](US007-statue-d-antoine-favre.md) | Statue d'Antoine Favre | 2 | 🔲 Todo |
| [US008](US008-fontaine-du-coeur-flambant.md) | Fontaine du Cœur Flambant | 3 | 🔲 Todo |
| [US009](US009-nouvelle-gare-de-chambery.md) | Nouvelle gare de Chambéry | 3 | 🔲 Todo |

**Total : 31 points (≈ 7 à 10 sessions).** Branche d'epic : `feat/EP007-monuments`, une branche par US fusionnée dedans (règle de l'epic EP005).

---

## Règles métier
1. **Un modèle par monument**, fait pour lui : les pièces communes (corps de bâtiment, tour, toit à quatre pans, fronton…) peuvent être partagées dans le code pour gagner du temps, mais ne sont **pas un livrable** ni un gabarit imposé
2. **Format** : formes simples en code ou fichier glTF, **couleurs dans les sommets, pas de texture**, ≤ 3 000 triangles par bâtiment (≈ 300 à 800 pour une statue)
3. **Budget de rendu** : tous les monuments ajoutés dans **un seul maillage fusionné** (+1 appel de rendu au total, ≈ +30 000 triangles pour dix) ; couche masquable non requise
4. **Remplacement du volume générique** : le contour OSM est retiré (`hideOsm` dans `src/content/models.json`) ; le modèle est posé avec l'outil de placement ; les ombres restent la carte d'ombres statique
5. **Compatibilité** : le modèle s'efface avec les autres bâtiments en mode balade (comme château et cathédrale), garde les fenêtres allumées la nuit (lumière de façade), reste lisible de nuit et en hiver
6. **Sources** : position (OSM ou saisie avec l'outil de position), photos et liens de référence **fournis par Dasco** dans la fiche de chaque US ; rien n'est dessiné d'après un souvenir
7. **Documentation** : README (Licences s'il y a un asset tiers), FEATURES, CHANGELOG, DECISIONS à chaque US

## Dépendances
- **Outil de position** (mode `?debug` : cliquer pour lire ou copier une position) pour US004 et US008.
- Photos ou liens de Dasco pour toutes les US.

## Critères d'acceptation de l'epic
- [ ] Neuf US livrées (ou écartées explicitement)
- [ ] `npm run build` passe ; appels de rendu par vue mesurés (budget : +1 au total) ; relevé iPhone
- [ ] Chaque monument vérifié de jour, de nuit, en hiver, en balade (effacement)
- [ ] Revue de Dasco monument par monument

## Estimation globale
- **Complexité** : M à L. **Effort** : 7 à 10 sessions. Incertain : la qualité des références (photos), les formes très particulières (gare), la lisibilité de très petits objets (statues) à l'échelle du diorama.
