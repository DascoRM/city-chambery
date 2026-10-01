# EP001 - US002 - Le monde suit l'heure : rues plus calmes la nuit, groupes devant les bars ouverts

## User Story

**En tant que** visiteur de la maquette,
**je veux** que la foule change avec l'heure : dense aux heures de pointe, rare la nuit, avec des petits groupes devant les bars ouverts,
**afin de** revenir voir la ville à différents moments de la journée.

---

## Critères d'acceptation

- [ ] **Given** la carte à 12 h, **When** je la compare à 3 h, **Then** il y a nettement plus de passants à 12 h (densité = part du maximum donnée par la courbe de `life.json`)
- [ ] **Given** la carte à 23 h et un bar ouvert d'après ses horaires OSM, **When** je zoome devant lui, **Then** un petit groupe (2 à 5 silhouettes) se tient devant l'entrée
- [ ] **Given** le même bar à 4 h, fermé d'après ses horaires OSM, **When** je zoome devant lui, **Then** il n'y a aucun groupe
- [ ] **Given** une boîte de nuit aux horaires provisoires (jeudi au samedi, 23 h à 5 h : US011), **When** il est 1 h un vendredi, **Then** un groupe se tient devant l'entrée
- [ ] **Given** un restaurant ou un café sans horaires, **When** il est 23 h, **Then** il n'a pas de groupe
- [ ] **Given** la lecture ▶ d'une journée en 2 minutes, **When** l'heure avance, **Then** la foule grossit et s'éclaircit progressivement, sans passant qui apparaît ou disparaît à l'écran (les arrivées et départs se font hors champ de la caméra)
- [ ] **Given** un groupe devant un lieu, **When** l'heure du curseur passe à celle de sa fermeture, **Then** le groupe s'éloigne à pied sur le réseau puis disparaît hors champ
- [ ] **Given** la légende avec « Bars » décochée, **When** il est 23 h, **Then** les groupes devant les bars, pubs et boîtes de nuit disparaissent avec leurs épingles ; ils reviennent quand je recoche (Q8 : Dasco jugera si c'est bien)

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | **Heure** : celle de l'horloge du diorama (`clock.state().hour`, heure de Chambéry), y compris en lecture ▶ et avec le curseur |
| R2 | **Courbe de densité** dans `life.json` (`people.dayCurve`), interpolée entre les points. Proposition de départ : 0–5 h 5 % · 7 h 40 % · 8 h 80 % · 9 h 60 % · 12 h 100 % · 14 h 60 % · 17 h 90 % · 19 h 50 % · 22 h 25 % · 24 h 5 % (à régler à l'œil) |
| R3 | **Lieux éligibles** : catégorie « bar » de la légende (`bar`, `pub`, `nightclub`, poids 1), `restaurant` (0,5), `cafe` (0,3) ; `ice_cream` jamais. Plage `people.groups` : de 20 h à 3 h, au plus `max` groupes (12 sur ordinateur, ×`mobileFactor` sur mobile) |
| R4 | **État d'ouverture** : `OpenState` de `src/time/openinghours.ts`. `open` → éligible ; `closed` ou `unknown` → jamais de groupe. Tous les bars, pubs et boîtes de nuit ont des horaires (OSM, ou **provisoires** dans `src/content/place-hours.json`, US011) : plus de cas « horaire inconnu » pour eux. Restaurants et cafés sans horaires : pas de groupe |
| R5 | **Choix des lieux** : parmi les lieux éligibles, tirage pondéré stable (même lieu, même groupe à la même heure) ; priorité aux lieux près de la caméra (comme la foule d'US001, R6) |
| R6 | **Emplacement du groupe** : sur le réseau des passants, au point le plus proche de l'épingle du lieu, entre 1,5 et 3 m de la façade ; silhouettes tournées vers le lieu, petits balancements au lieu de la marche |
| R7 | **Arrivées et départs hors champ** : un passant n'apparaît ni ne disparaît dans le champ de la caméra ; il naît ou meurt sur un nœud hors écran, ou se dissout à plus de `radius` m |
| R8 | Les groupes ne sont pas cliquables et ne changent pas l'éclairage des lieux (halos de nuit inchangés) |
| R9 | Les groupes sont **liés à la catégorie de leur lieu** : `setCategoryVisible` (légende) les masque avec les épingles (Q8) ; les passants qui marchent dans les rues ne sont pas concernés |

---

## Rendu

**Écran** : la carte.

| État | Description |
|------|-------------|
| Jour | Foule selon la courbe, sans groupe |
| Nuit | Rues presque vides ; groupes devant les lieux éligibles ouverts |
| Transition | Aucune apparition visible ; la foule se renouvelle par les bords de l'écran |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Curseur d'heure tiré vite | Les naissances et morts sont étalées (quelques secondes), pas de bond de la foule |
| Aucun lieu éligible ouvert à cette heure | Pas de groupe, seulement la foule des rues |
| Lieu avec horaires illisibles (2 cas sur 106) | Traité comme `unknown` : pas de groupe |
| Jours fériés et vacances | Ignorés, comme pour l'éclairage des lieux (limite connue du backlog) |
| Bar sans voie proche | Pas de groupe (on ne place pas au hasard) |

---

## Dépendances et existant réutilisé
US001 ; `createOpenStates` et `OpenState` (`src/time/openinghours.ts`) ; `PlaceLayer` (épingles, catégories) ; `clock`.

## Vérification
Comparer 3 h, 12 h, 18 h, 23 h ; un bar aux horaires OSM ouvert à 23 h et fermé à 4 h ; un bar sans horaires ; lecture ▶ complète ; `?debug` (appels de rendu, images/s) ; dire ce qui n'a pas pu être vérifié.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 5 |
| Complexité | Medium |

---

## Checklist dev

- [ ] Code implémenté (`src/scene/people.ts`, `life.json`)
- [ ] `npm run build` passe ; mesures `?debug`
- [ ] Vérifié dans le navigateur aux 4 heures et en lecture ▶
- [ ] README (courbe, « Limites connues » : groupes devant les lieux sans horaires) et clôture d'itération
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : 🟡 Livrée (itération 55), à valider par Dasco
