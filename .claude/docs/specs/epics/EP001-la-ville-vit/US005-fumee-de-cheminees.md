# EP001 - US005 - De la fumée qui sort de cheminées, en automne et en hiver

## User Story

**En tant que** visiteur qui regarde la ville hors de l'été,
**je veux** voir de petits panaches de fumée monter de quelques toits,
**afin de** sentir la saison et la vie des maisons.

---

## Critères d'acceptation

- [ ] **Given** la saison d'hiver, **When** je zoome sur un toit à cheminée, **Then** un panache de fumée monte et dérive doucement avec le vent, à n'importe quelle heure
- [ ] **Given** la saison d'été (puce saison ou date du navigateur), **When** je regarde les mêmes toits, **Then** les cheminées sont visibles mais sans fumée
- [ ] **Given** le printemps ou l'automne, **When** je regarde la fumée, **Then** elle est moins dense qu'en hiver
- [ ] **Given** la caméra loin de ces toits (au-delà de `smoke.distance`), **When** je regarde la carte, **Then** les panaches ne sont ni simulés ni dessinés
- [ ] **Given** la carte au repos avec de la fumée visible, **When** je regarde le compteur `?debug`, **Then** il affiche toujours « repos (30 max) » (la fumée ne force pas la pleine vitesse)
- [ ] **Given** le mini-jeu, **When** un éléphant s'échappe dans un nuage, **Then** son nuage et les panaches de cheminée ne se gênent pas (réserves de particules séparées)
- [ ] **Given** `?debug`, **When** je compare avant et après (hiver, 30 cheminées), **Then** les appels de rendu augmentent d'au plus 2 et les images/s baissent de moins de 5 %

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | **Décor, pas un relevé** : OpenStreetMap ne donne pas les cheminées (la requête actuelle ne demande pas `man_made=chimney`, et il n'y en aurait pas pour toutes les maisons). Les cheminées sont posées au hasard stable (hachage de l'identifiant OSM) sur des toits en pente ; à déclarer dans « Limites connues » |
| R2 | **Quand** : selon la **saison seulement** de l'horloge (`clock.state().current`), densité de `smoke.density` dans `life.json` : printemps 0,4, **été 0 (pas de fumée)**, automne 0,7, hiver 1. **Aucune règle d'heure** (décision de Dasco, Q3 : pas de complication pour peu de chose). Les petites cheminées (boîtes) sont dessinées toute l'année |
| R3 | **Combien** : `smoke.chimneys` (30) toits équipés, dont seuls ceux à moins de `smoke.distance` m de la caméra émettent |
| R4 | **Particules** : le système existant `createParticles` (`src/scene/particles.ts`), dans **un pool à part** de celui du jeu (les 400 fumées du jeu ne sont pas partagées) ; fumée grise claire qui grossit et monte, dérive dans le sens du vent de `life.json` |
| R5 | **Cadence** : `moving()` reste faux ; une fumée lente n'a pas besoin de la pleine vitesse (règle 5 de l'epic) |
| R6 | **Forme** : petite cheminée en briques faite en code (une boîte et un chapeau), instanciée ; aucun asset tiers. Posée sur le faîtage si le toit est à deux pans, sinon au centre du toit |
| R7 | Pas de fumée de nuit plus lumineuse que le reste : la fumée est éclairée comme les autres particules (pas de lueur) |

---

## Rendu

**Écran** : la carte, en automne et en hiver.

| État | Description |
|------|-------------|
| Hiver | Panaches denses |
| Printemps, automne | Panaches légers |
| Été | Cheminées sans fumée |
| Zoom arrière | Aucune fumée (limite de distance) |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Toit plat, toit de monument modélisé, bâtiment caché par un monument | Pas de cheminée |
| Changement de saison pendant la lecture | La fumée naît et meurt progressivement (pas de coupure nette) |
| Pool plein | Les émissions en trop sont ignorées, sans erreur |
| Caméra en vol | Les panaches suivent la règle de distance à chaque image |

---

## Dépendances et existant réutilisé
`particles.ts`, `clock` (saison), `roofs.ts` (forme des toits), liste `tickers`.

## Vérification
Hiver sur un toit à cheminée ; même toit en été ; printemps et automne ; `?debug` (mode repos, images/s) ; jeu des éléphants pendant que la fumée est visible.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 3 |
| Complexité | Medium |

---

## Checklist dev

- [ ] Code implémenté (`src/scene/chimneys.ts`, `life.json`)
- [ ] `npm run build` passe ; mesures `?debug`
- [ ] Vérifié en hiver, en automne et en été
- [ ] README (Limites connues : cheminées décoratives) et clôture d'itération
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : 🔲 Todo
