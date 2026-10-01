# EP001 - US006 - Des drapeaux qui flottent sur des mâts sourcés

## User Story

**En tant que** visiteur de la maquette,
**je veux** voir des drapeaux flotter au vent sur quelques bâtiments,
**afin que** la ville semble animée même quand l'air est calme ailleurs.

---

## Critères d'acceptation

- [ ] **Given** le château, **When** je zoome sur lui, **Then** un drapeau de la Savoie (croix blanche sur fond rouge) flotte sur son mât, avec des ondulations qui se propagent du mât vers le bord libre
- [ ] **Given** l'hôtel de ville, **When** je zoome sur lui, **Then** un drapeau flotte aussi sur son mât
- [ ] **Given** n'importe quel autre bâtiment de la carte, **When** je le regarde, **Then** il n'a pas de drapeau : **seuls le château et l'hôtel de ville en ont** (Q4)
- [ ] **Given** deux drapeaux proches, **When** je les regarde, **Then** ils ondulent avec des décalages différents, dans le même sens de vent
- [ ] **Given** la carte de nuit, **When** je regarde un drapeau, **Then** il est sombre comme le reste (pas de lueur, sauf si le monument est éclairé par le bas)
- [ ] **Given** la carte au repos, **When** les drapeaux ondulent, **Then** le compteur `?debug` affiche « repos (30 max) »
- [ ] **Given** `?debug`, **When** je compare avant et après, **Then** au plus 1 appel de rendu par motif de drapeau en plus

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | **Deux mâts seulement : le château et l'hôtel de ville** (décision de Dasco, Q4). Chacun a une **source** : le château, l'ancrage OSM `chateau` de `city.json` ; l'hôtel de ville, son bâtiment OSM (à identifier par son nom, comme `osm.match` des lieux) ou, à défaut, une position placée par Dasco avec l'outil de placement (valeur `pos`). Aucun mât « pour faire joli » |
| R2 | **Motif de la Savoie** : croix blanche sur fond rouge, dessinée en code sur un canevas ; **montré à Dasco avant de finir** (il dit si c'est le bon dessin). Le même motif pour l'hôtel de ville sauf avis contraire |
| R3 | **Dans `life.json`** : `flags: [{ id, anchor ou pos, height, design }]`. Pas de changement du script de données ni de `city.json` |
| R4 | **Formes** : un mât (cylindre fin) et un plan subdivisé (8 × 4 segments) dont les sommets ondulent dans le shader ; motifs simples dessinés en code sur un canevas (bandes de couleur, croix), aucun asset tiers |
| R5 | **Vent** : une direction unique dans `life.json` (`wind`), force variable lentement ; le drapeau s'oriente dans le sens du vent, quelle que soit la position de la caméra |
| R6 | Décor : pas d'ombre projetée par le tissu (il bouge) ; le mât peut en projeter une si la carte des ombres est recalculée |
| R7 | Module dans la liste `tickers`, `moving()` faux (règle 5 de l'epic) |

---

## Rendu

**Écran** : la carte.

| État | Description |
|------|-------------|
| Jour | Drapeau qui ondule, plus lumineux au soleil |
| Nuit | Drapeau sombre |
| Aucun mât | Rien (comportement par défaut) |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Mât du château, bâtiment remplacé par un monument modélisé | La hauteur se lit sur le relief et le monument : vérifier que le mât ne traverse pas le toit |
| Mât posé sur un point hors du socle | Ignoré avec un avertissement console |
| Motif inconnu | Drapeau blanc et avertissement console |
| Autres mâts demandés plus tard | Un seul maillage instancié par motif |

---

## Dépendances et existant réutilisé
Ancrage `chateau` de `city.json` ; outil de placement (`src/dev/placement.ts`) si l'hôtel de ville n'a pas de position ; `terrain.heightAt` ; liste `tickers`. Décision de Dasco prise (Q4).

## Vérification
Le drapeau du château et celui de l'hôtel de ville de près et de loin ; motif de la Savoie montré à Dasco ; aucune erreur console si `flags` est vide ; `?debug` avant / après.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 3 |
| Complexité | Medium |

---

## Checklist dev

- [ ] Motif de la Savoie validé par Dasco
- [ ] Code implémenté (`src/scene/flags.ts`, `life.json`)
- [ ] `npm run build` passe
- [ ] README et clôture d'itération ; sources des mâts notées
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : 🟡 Livrée (itération 59), à valider par Dasco (motif à confirmer)
