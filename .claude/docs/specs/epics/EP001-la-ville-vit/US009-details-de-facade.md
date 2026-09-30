# EP001 - US009 - Portes, balcons, climatiseurs et lucarnes sur les façades et les toits

## User Story

**En tant que** visiteur qui zoome sur les bâtiments,
**je veux** voir des portes, des balcons, des climatiseurs et des lucarnes sur les façades et les toits,
**afin que** les bâtiments aient l'air habités et moins lisses.

---

## Critères d'acceptation

- [ ] **Given** un bâtiment de plus de 6 m de haut, **When** je zoome sur sa façade côté rue, **Then** je vois une porte au rez-de-chaussée et parfois un balcon à un étage
- [ ] **Given** un bâtiment à toit à deux pans rectangulaire, **When** je regarde son toit, **Then** il peut avoir une lucarne sur un pan
- [ ] **Given** des climatiseurs, **When** je regarde les façades (côté cour, côté pignon, plus rarement côté rue), **Then** quelques-uns sont posés, à distance des fenêtres
- [ ] **Given** un bâtiment caché par un monument modélisé, **When** je regarde le monument, **Then** aucun détail n'y est ajouté
- [ ] **Given** un bâtiment de moins de 6 m de haut (annexe, garage), **When** je regarde sa façade, **Then** il n'a ni balcon ni lucarne
- [ ] **Given** la même carte rechargée, **When** je regarde le même bâtiment, **Then** il a les mêmes détails aux mêmes endroits (tirage stable par identifiant OSM)
- [ ] **Given** `?debug`, **When** je compare avant et après, **Then** les appels de rendu augmentent d'au plus 12 et les triangles de moins de 300 000, et la carte reste à 30 images/s au repos

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | **Pièces** : celles de `details.glb` (US007) : portes, balcons, climatiseurs, lucarnes, détails de toit plat. **Décor** : pas un relevé des façades (règle 2 de l'epic) |
| R2 | **Façades visées** : arêtes du contour du bâtiment qui font face à une voie (comme l'US008), sauf les climatiseurs, plutôt sur les pignons et les côtés sans voie. Jamais sur les arêtes d'une cour intérieure |
| R3 | **Portes** : une par bâtiment de plus de 6 m côté rue, hors des auvents de l'US008 (à au moins 1 m) ; **balcons** : un bâtiment sur trois, à partir du 2ᵉ étage, sur les arêtes de plus de 6 m ; **climatiseurs** : un bâtiment sur quatre, 1 à 3 par bâtiment ; **lucarnes** : seulement sur les toits en pente à deux pans rectangulaires (1 028 bâtiments de ce type, `scripts/roofs.mjs`), un bâtiment sur trois |
| R4 | **Hauteurs** : un étage ≈ 3 m ; les pièces se posent sur le sol au pied de la façade (comme l'US008), à la hauteur de l'étage choisi, sans dépasser la gouttière du bâtiment |
| R5 | **Budget** : au plus 3 000 instances au total, en un maillage instancié par pièce (≤ 12 appels) ; si la mesure est mauvaise, limiter aux bâtiments à moins de `details.distance` m de la caméra (piste à essayer en second) |
| R6 | **Couleurs** : palette du projet (US007) ; les portes et balcons prennent une couleur parmi quelques teintes choisies par hachage ; les climatiseurs restent gris |
| R7 | Tirage **stable** (hachage de l'identifiant OSM, comme les couleurs de façades et les arbres) |
| R8 | Calcul au chargement, en moins de 200 ms ; pas de changement du script de données ni de `city.json` |
| R9 | Pas d'ombre propre ; les détails ne sont pas des cibles de sélection |

---

## Rendu

**Écran** : la carte, zoom sur une rue ou une cour.

| État | Description |
|------|-------------|
| Normal | Portes, balcons, climatiseurs, lucarnes en petits volumes colorés |
| Nuit | Éclairés comme les façades (aucune lumière propre) |
| Zoom arrière | Invisibles (trop petits) |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Bâtiment sans façade côté voie | Pas de porte ni de balcon ; les climatiseurs possibles sur un pignon |
| Bâtiment sur une forte pente | Porte au niveau du sol local côté rue ; pas de balcon enterré |
| Façade où se trouve déjà un auvent | Pas de porte à moins de 1 m de l'auvent |
| Toit à quatre pans, pyramide, toit plat | Pas de lucarne ; détails de toit plat éventuels seulement sur les toits plats |
| Mesure trop mauvaise sur mobile | Activer la limite de distance (R5) puis mesurer de nouveau |

---

## Dépendances et existant réutilisé
US007 (pièces) ; US008 (calcul des façades, à mutualiser dans `facades.ts`) ; `roofs.ts` (forme des toits) ; `geo.ts` ; `terrain.heightAt` ; `hiddenBuildings`.

## Vérification
Une rue, une cour, un pignon, un toit à deux pans ; château et Carré Curial sans détail ajouté ; rechargement (mêmes détails) ; `?debug` avant / après sur Chrome avec carte graphique et sur un téléphone.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 5 |
| Complexité | Complexe |

---

## Checklist dev

- [ ] Essai sur un bâtiment de chaque type validé par Dasco
- [ ] Code implémenté (`src/scene/facades.ts`, `life.json`)
- [ ] `npm run build` passe ; mesures `?debug`
- [ ] README (Limites connues) et clôture d'itération
- [ ] Validé par Dasco

---

**Priorité** : Low
**Status** : 🔲 Todo
