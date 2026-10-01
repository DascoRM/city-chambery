# EP001 - US004 - Des pigeons sur les places et des oiseaux autour des monuments

## User Story

**En tant que** visiteur de la maquette,
**je veux** voir des pigeons picorer sur les places et des oiseaux tourner autour de la cathédrale et du château,
**afin que** la ville ait de la vie même là où il n'y a personne.

---

## Critères d'acceptation

- [ ] **Given** la carte à midi, **When** je zoome sur une place (espace `plaza` d'OSM), **Then** un petit groupe de pigeons est posé au sol et picore
- [ ] **Given** la carte à midi, **When** je zoome sur la cathédrale ou le château, **Then** quelques oiseaux tournent au-dessus, battant des ailes
- [ ] **Given** une volée posée sur une place, **When** 40 à 90 secondes passent, **Then** la volée s'envole, fait un tour au-dessus de la place puis se repose, au même endroit ou sur une autre place proche
- [ ] **Given** la carte de nuit (soleil couché), **When** je regarde les places et les monuments, **Then** aucun oiseau n'est visible
- [ ] **Given** la souris ou un doigt qui passe au-dessus d'un oiseau, **When** je clique, **Then** rien ne se passe pour lui (les oiseaux ne sont pas des cibles)
- [ ] **Given** `?debug`, **When** je compare avant et après, **Then** les appels de rendu augmentent d'au plus 2 et les images/s baissent de moins de 5 %

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | **Où** : les places (`areas` de type `plaza`, 47 dans `city.json`) d'au moins `minArea` m², et les ancrages `cathedrale` et `chateau` pour les oiseaux qui tournent. Décor : ce n'est pas un relevé d'oiseaux réels (à déclarer dans « Limites connues ») |
| R2 | **Quand** : entre le lever et le coucher du soleil de l'horloge (`clock.state().sun`), jamais la nuit ; toute l'année |
| R3 | **Combien** : `birds.pigeons` (40) au sol et `birds.circling` (8) en l'air au maximum, ×`mobileFactor` sur mobile ; seuls ceux proches de la caméra sont dessinés |
| R4 | **Formes** : oiseau simple fait en code (corps ovale, deux ailes plates), un seul maillage instancié ; **aucun asset tiers** (pas de licence à gérer) ; battement d'ailes dans le shader |
| R5 | **Ombres** : aucune ombre projetée, pas de pastille sous les pigeons posés (trop petits) |
| R6 | Décor : aucune réaction aux passants, aux éléphants ni à la souris (décision de l'epic) |
| R7 | Le module est dans la liste `tickers`, avec `moving()` faux (règle 5 de l'epic) |

---

## Rendu

**Écran** : la carte.

| État | Description |
|------|-------------|
| Jour | Groupes de 4 à 10 pigeons sur les places, oiseaux qui tournent à 30 à 60 m au-dessus des monuments |
| Envol | Les pigeons montent en même temps, tournent, reviennent |
| Nuit | Aucun oiseau |
| Zoom arrière | Les oiseaux ne sont plus dessinés au-delà de la distance limite |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Place très petite ou en pente | Pas de pigeons (seuil de surface ; hauteur du sol lue sur le relief) |
| Lever ou coucher du soleil absent (`sun.rise` ou `sun.set` à `null`) | On se fie à `uNight` : oiseaux quand il fait jour |
| Lecture ▶ rapide | Les oiseaux apparaissent et disparaissent avec le lever et le coucher, sans à-coup (fondu d'échelle) |
| Fontaine des Éléphants | Les pigeons évitent le cercle `avoid` de 15 m (comme les éléphants) |

---

## Dépendances et existant réutilisé
`clock` (lever / coucher), `terrain.heightAt`, ancrages de `city.json`, liste `tickers`.

## Vérification
Une place, la cathédrale, le château de jour ; le même à 22 h ; un envol complet ; `?debug` avant / après.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 3 |
| Complexité | Medium |

---

## Checklist dev

- [ ] Code implémenté (`src/scene/birds.ts`, `life.json`)
- [ ] `npm run build` passe ; mesures `?debug`
- [ ] Vérifié de jour et de nuit
- [ ] README (Limites connues : oiseaux décoratifs) et clôture d'itération
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : ✅ Done (itération 57 ; PR #17)
