# EP005 - US005 - Les bâtiments entiers et les monuments qui masquent l'avatar s'effacent

## User Story

**En tant que** visiteur en mode balade,
**je veux** voir mon avatar même quand un bâtiment ou un monument est entre lui et la caméra,
**afin de** ne jamais le perdre dans une rue étroite.

---

## Critères d'acceptation

- [ ] **Given** un bâtiment entre la caméra et l'avatar, **When** je regarde, **Then** ce **bâtiment entier** disparaît (fondu en quelques dixièmes de seconde) et réapparaît quand il ne masque plus
- [ ] **Given** deux bâtiments mitoyens, **When** l'un masque l'avatar, **Then** seul celui qui masque disparaît ; les murs et toits d'un même bâtiment disparaissent ensemble
- [ ] **Given** un monument (château, cathédrale, Carré Curial, fontaine), **When** il masque l'avatar, **Then** il **disparaît** comme un bâtiment (décision de Dasco) ; la transparence façon Diablo est une variante à comparer au prototype ; **les arbres ne s'effacent pas**
- [ ] **Given** la liste d'exceptions de `avatar.json`, **When** un bâtiment ou monument y figure, **Then** il ne s'efface jamais (liste vide au départ : P1)
- [ ] **Given** un bâtiment qui reste devant, **When** il masque quand même l'avatar, **Then** une silhouette discrète de l'avatar, de couleur unie, reste visible à travers (P2 ; +1 à 3 appels de rendu)
- [ ] **Given** la nuit, **When** un bâtiment s'efface, **Then** les fenêtres allumées des autres sont correctes et l'avatar reste lisible
- [ ] **Given** les ombres, **When** un bâtiment s'efface, **Then** la carte d'ombres statique est inchangée et n'est pas recalculée (l'ombre au sol reste)
- [ ] **Given** la carte libre, **When** je ne suis pas en balade, **Then** aucun coût et aucun changement de rendu
- [ ] **Given** `?debug`, **When** l'avatar est dans une rue dense, **Then** images/s, appels de rendu (par rapport à la même vue) et chargement restent dans le budget de l'epic

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | **Bâtiments entiers d'abord** (décision de Dasco) : il faut un **identifiant de bâtiment** par sommet (attribut `aId`, index 0 à N−1), une texture de facteurs de fondu (une valeur par bâtiment) mise à jour quand l'avatar ou la caméra bougent, et un test côté processeur « segment caméra → avatar contre les emprises » (grille `ringGrid` de `city.ts`), avec lissage dans le temps |
| R2 | Aujourd'hui tous les bâtiments sont **un seul maillage fusionné, un seul matériau, sans identifiant** (`city.ts:311-315`) : le maillage reste unique (+0 appel de rendu), le fondu passe par un dither ou un test d'opacité selon le facteur du bâtiment |
| R3 | Monuments : objets séparés avec leurs matériaux (`models/*.ts`) ; fondu d'opacité propre à chacun (jusqu'à disparition, ou transparence à comparer) ; arbres exclus |
| R4 | Réglages (durée du fondu, exceptions) dans `avatar.json` ; **uniformes seulement** dans les shaders (règle BUG-01) |
| R5 | Repli si le coût sur mobile est trop élevé : cône de vue en shader (trou en pointillé), décrit dans l'analyse `tasks/ep005-effacement-batiments-plan.md` |
| R6 | Le mode balade étant exclusif, la variante de shader n'est activée qu'en balade |
| R7 | Épingles, cheminées, auvents, drapeaux au-dessus d'un bâtiment effacé : à cacher avec lui, cas par cas |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Bâtiments mitoyens inégaux | Seul le bâtiment qui masque s'efface ; on regarde le rendu |
| Fenêtres allumées d'un bâtiment qui s'efface | Atténuées avec lui |
| Bâtiment très bas devant la caméra | Non effacé s'il ne masque pas l'avatar |
| Plusieurs bâtiments à la fois | Tous ceux qui coupent le segment caméra → avatar s'effacent |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 13 |
| Complexité | Complexe (la plus incertaine de l'epic : coût sur GPU mobile non mesuré ; 2 à 3 sessions) |

---

## Checklist dev

- [ ] Attribut `aId` et texture de facteurs (`city.ts`)
- [ ] Test caméra → avatar contre les emprises
- [ ] Monuments : fondu d'opacité
- [ ] Silhouette (matériau, ordre de rendu)
- [ ] Cas : rue de Boigne, place Saint-Léger, château, nuit, hiver
- [ ] Images/s, appels, triangles mesurés ; essai iPhone
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : 🔲 Todo
