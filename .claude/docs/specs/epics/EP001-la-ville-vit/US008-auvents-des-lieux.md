# EP001 - US008 - Des auvents devant les bars, cafés et restaurants

## User Story

**En tant que** visiteur qui explore les rues commerçantes,
**je veux** voir un auvent coloré à la façade de chaque bar, café et restaurant,
**afin de** repérer les lieux dans la rue et de sentir des commerces vivants.

---

## Critères d'acceptation

- [ ] **Given** un bar dont l'épingle est dans un bâtiment, **When** je zoome sur sa façade côté rue, **Then** un auvent violet est posé sur cette façade, à hauteur de rez-de-chaussée, sans traverser le bâtiment ni la voie
- [ ] **Given** un café, **When** je zoome sur sa façade, **Then** l'auvent est bleu ; **Given** un restaurant, **Then** il est orange (couleurs des épingles, `PLACE_CATEGORIES`)
- [ ] **Given** la case « Bars » décochée dans la légende, **When** je regarde les bars, **Then** leurs auvents disparaissent avec leurs épingles et leurs halos ; ils reviennent quand je la recoche
- [ ] **Given** un lieu dans un bâtiment remplacé par un monument modélisé (`hideOsm`), **When** je regarde la façade du monument, **Then** aucun auvent n'y est posé
- [ ] **Given** un lieu dont le bâtiment n'a aucune façade à moins de `maxStreetDistance` m d'une voie, **When** je regarde la carte, **Then** ce lieu n'a pas d'auvent (on ne place rien au hasard)
- [ ] **Given** un lieu sur un terrain en pente, **When** je regarde son auvent, **Then** il est à la hauteur du sol local plus la hauteur de rez-de-chaussée, ni enterré ni en l'air
- [ ] **Given** `?debug`, **When** je compare avant et après, **Then** les appels de rendu augmentent d'au plus 3 et les triangles de moins de 50 000

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | **Façade** : pour chaque lieu dont l'épingle est dans un bâtiment (161 lieux sur 169, `buildPlaceMarkers`), on retient l'arête du contour du bâtiment la plus proche de la voie la plus proche, dans un rayon de `maxStreetDistance` (20 m), puis le point de cette arête le plus proche du lieu. L'auvent est orienté vers l'extérieur du bâtiment |
| R2 | **Les 8 lieux hors bâtiment** n'ont pas d'auvent |
| R3 | **Dimensions** : largeur entre 2 et 4 m selon la longueur de la façade (jamais plus de la moitié de l'arête), hauteur du rez-de-chaussée ≈ 3 m (réglable) ; les bâtiments sont posés sur le point le plus bas du terrain sous leur emprise (voir README, Limites : sur une pente, l'amont est enterré) : lire le sol au pied de la façade |
| R4 | **Couleur** : celle de la catégorie du lieu (Q5 de l'epic : on juge au rendu, puis on ajuste), appliquée à la pièce `details.glb` de l'auvent par couleur d'instance ; les rayures éventuelles de la pièce sont gardées en clair |
| R5 | **Visibilité** : liée à `setCategoryVisible` de `PlaceLayer` (`src/scene/markers.ts`) : l'auvent d'une catégorie masquée est masqué ; l'API de `PlaceLayer` est étendue pour cela |
| R6 | **Instancié** : un maillage par pièce d'auvent (1 à 3 modèles différents choisis par hachage de l'identifiant du lieu) ; aucune ombre projetée par l'auvent au-delà de la carte des ombres existante |
| R7 | **Décor** : l'auvent ne prétend pas reproduire le vrai commerce (règle 2 de l'epic) ; à déclarer dans « Limites connues » |
| R8 | Les bâtiments cachés par un monument (`hiddenBuildings`) n'en reçoivent pas |
| R9 | Calcul au chargement, en moins de 50 ms ; le résultat n'est pas écrit dans `city.json` (pas de changement du script de données dans cette US) |

---

## Rendu

**Écran** : la carte, zoom sur une rue commerçante (rue de Boigne, place Saint-Léger).

| État | Description |
|------|-------------|
| Normal | Auvents colorés sur les façades des bars, cafés et restaurants |
| Catégorie masquée | Auvents de la catégorie masqués |
| Nuit | Mêmes auvents, éclairés comme les façades (halos des lieux ouverts inchangés) |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Plusieurs lieux dans le même bâtiment | Un auvent par lieu, espacés ; sinon un seul et un avertissement console |
| Façade trop courte (< 2 m) | Pas d'auvent |
| Bâtiment en L ou à cour intérieure | Seules les arêtes du contour extérieur côté voie comptent (pas les arêtes de la cour) |
| Voie qui passe sous le bâtiment ou qui le longe à 0 m | Distance minimale de 0,5 m entre l'auvent et l'axe de la voie |
| Données changées (`npm run data`) | Les auvents se recalculent au chargement, rien à régénérer |

---

## Dépendances et existant réutilisé
US007 ; `markers.ts` (lieux, catégories, visibilité) ; `walkways.ts` / `city.roads` (voies) ; `geo.ts` (`segDist2`, `distToSegment`) ; `terrain.heightAt` ; `hiddenBuildings` (`models.ts`).

## Vérification
Trois rues avec leurs auvents de près ; case « Bars » décochée et recochée ; un lieu en pente ; le château et le Carré Curial sans auvent ; `?debug` avant / après. **Essayer sur un seul bâtiment avant de faire le lot** (échelle, couleur, orientation).

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 5 |
| Complexité | Complexe |

---

## Checklist dev

- [ ] Essai sur un bâtiment validé par Dasco
- [ ] Code implémenté (`src/scene/facades.ts`, extension de `PlaceLayer`)
- [ ] `npm run build` passe ; mesures `?debug`
- [ ] README (Limites connues : auvents décoratifs) et clôture d'itération
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : ✅ Done (itération 46) ; **validée par Dasco le 30/09/2026** (« les auvents, ça me va »)
