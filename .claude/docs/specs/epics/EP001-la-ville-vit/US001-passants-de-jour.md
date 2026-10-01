# EP001 - US001 - Des passants qui marchent dans les rues, de jour

## User Story

**En tant que** visiteur de la maquette,
**je veux** voir de petites silhouettes marcher dans les rues piétonnes,
**afin que** le centre historique ait l'air habité quand je zoome.

---

## Critères d'acceptation

- [ ] **Given** la carte chargée à 12 h, **When** je zoome sur la rue de Boigne, **Then** je vois des silhouettes qui marchent le long de la rue, sans jamais traverser un bâtiment
- [ ] **Given** une silhouette qui arrive à un carrefour, **When** elle poursuit son trajet, **Then** elle prend une voie voisine, de préférence tout droit ; au bout d'une impasse, elle fait demi-tour
- [ ] **Given** la carte au repos (caméra immobile), **When** les passants marchent, **Then** ils restent animés et la carte reste à 30 images/s (mode « repos » du compteur `?debug`)
- [ ] **Given** un passant et un éléphant sur la même voie, **When** ils se croisent, **Then** chacun poursuit son chemin sans réagir à l'autre
- [ ] **Given** un clic ou un survol sur un passant, **When** je clique, **Then** rien ne se passe pour lui, et la sélection voit ce qui est derrière (gemme, épingle, éléphant, sol)
- [ ] **Given** `max` modifié dans `life.json`, **When** je recharge la page, **Then** le nombre de passants change
- [ ] **Given** la densité à son maximum, **When** je compare `?debug` avant et après, **Then** les appels de rendu augmentent d'au plus 4 et les images/s baissent de moins de 10 % (Chrome avec carte graphique)

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | Les passants marchent sur un **réseau de voies qui leur est propre**, construit avec `buildWalkways` (`src/scene/walkways.ts`) et ses propres options : sans escaliers, **toutes les autres voies autorisées** (pas de trottoirs ni d'axes évités pour l'instant, Q2 de l'epic), façades à 1 m au lieu de 2,2 m (un humain ne demande pas la marge d'un éléphant). Le réseau des éléphants ne change pas |
| R2 | Seule la **plus grande partie connexe** du réseau est utilisée (`mainComponent`). Mesurer sa taille en début d'US : si elle est trop petite, réduire la marge aux façades (R1) |
| R3 | Même zone interdite que les éléphants autour de la fontaine (cercle `avoid`, 15 m) : le bassin déborde sur le chemin OSM |
| R4 | **Un seul maillage instancié** pour tous les passants, marche animée dans le shader (comme `WALK_GLSL` de l'éléphant), couleur de vêtement par instance dans la palette pastel du diorama. Formes simples (corps, tête), pas d'asset tiers |
| R5 | **Pas d'ombre projetée** (la carte d'ombres ne bouge qu'avec le soleil) : une pastille d'ombre au sol, instanciée elle aussi |
| R6 | **Foule autour du point visé** (piste pour la fluidité) : seuls les passants dans un rayon de `radius` mètres (250 par défaut) autour de la cible de la caméra sont simulés et dessinés ; un passant qui en sort est replacé hors écran sur un nœud du réseau dans le rayon. À confirmer par la mesure : si la simulation de tous les passants sur toute la carte coûte peu, on garde la version simple |
| R7 | Vitesse tirée au hasard entre `speed[0]` et `speed[1]` m/s ; pauses courtes (2 à 6 s) de temps en temps ; hauteur = 1,7 m × `scale` (1 par défaut, Dasco la changera au besoin : Q1 de l'epic) |
| R8 | Facteur `mobileFactor` sur les appareils tactiles et les écrans étroits |
| R9 | Le module se branche dans la liste `tickers` de `main.ts` avec `moving()` faux (règle 5 de l'epic) ; il ne crée aucune cible de sélection |

---

## Rendu

**Écran** : la carte (aucun nouvel élément d'interface).

| État | Description |
|------|-------------|
| Chargement | Le réseau est construit au chargement, comme celui des éléphants ; si la construction échoue, pas de passants et un avertissement console (comme les éléphants : `try` / `catch`) |
| Normal | Silhouettes colorées qui marchent ; pastille sombre sous chacune |
| Zoom arrière | Les passants sont trop petits pour être vus ; ils ne coûtent rien de plus (R6) |
| Heure | Densité fixe dans cette US (la courbe horaire arrive avec US002) |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Réseau très fragmenté | Voir R2 ; journal console de la taille de la partie connexe en mode `?debug` |
| Onglet mis en veille, image très longue | `dt` plafonné comme le reste de la boucle (0,1 s) : les passants ne « sautent » pas |
| Voie sans nom, pont | Les ponts suivent la hauteur des rubans de voies (`roadLift`, `src/scene/roads.ts`) ; même hauteur que l'éléphant |
| Lecture ▶ (une journée en 2 minutes) | Les passants marchent à la vitesse normale (pas accélérés avec l'horloge) |
| `max` à 0 | Aucun passant, aucun coût |

---

## Dépendances et existant réutilisé
`walkways.ts`, `roads.ts` (EN-01) ; liste `tickers` (EN-02) ; cadence au repos (TI-02) ; `mascot.ts` pour la marche dans le shader et la pastille d'ombre.

## Vérification
`npm run build` ; `?debug` avant / après sur Chrome avec carte graphique ; passants visibles dans 3 rues (Boigne, une rue piétonne, une impasse) ; éléphants inchangés ; mobile si possible. Dire dans le CHANGELOG ce qui n'a pas été vérifié.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 5 |
| Complexité | Medium |

---

## Checklist dev

- [ ] Code implémenté (`src/scene/people.ts`, `src/content/life.json`)
- [ ] `npm run build` passe ; mesures `?debug` dans le CHANGELOG
- [ ] Vérifié dans le navigateur ; éléphants et sélection inchangés
- [ ] README (réglages, structure du code, limites connues) et documents de clôture d'itération
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : ✅ Done (itération 51, validée par Dasco ; PR #14)
