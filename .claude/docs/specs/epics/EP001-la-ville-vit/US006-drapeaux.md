# EP001 - US006 - Des drapeaux qui flottent sur des mâts sourcés

## User Story

**En tant que** visiteur de la maquette,
**je veux** voir des drapeaux flotter au vent sur quelques bâtiments,
**afin que** la ville semble animée même quand l'air est calme ailleurs.

---

## Critères d'acceptation

- [ ] **Given** un mât défini dans `life.json` (position sourcée, hauteur, motif), **When** je zoome dessus, **Then** un drapeau flotte, avec des ondulations qui se propagent du mât vers le bord libre
- [ ] **Given** la carte sans aucun mât défini, **When** je regarde la ville, **Then** il n'y a aucun drapeau (rien n'est placé par défaut)
- [ ] **Given** deux drapeaux proches, **When** je les regarde, **Then** ils ondulent avec des décalages différents, dans le même sens de vent
- [ ] **Given** la carte de nuit, **When** je regarde un drapeau, **Then** il est sombre comme le reste (pas de lueur, sauf si le monument est éclairé par le bas)
- [ ] **Given** la carte au repos, **When** les drapeaux ondulent, **Then** le compteur `?debug` affiche « repos (30 max) »
- [ ] **Given** `?debug`, **When** je compare avant et après, **Then** au plus 1 appel de rendu par motif de drapeau en plus

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | **Rien d'inventé** : chaque mât a une **source** (un élément OpenStreetMap `man_made=flagpole`, ou une position placée par Dasco avec l'outil de placement, valeur `pos` copiée), et un motif choisi par Dasco. Aucun mât « pour faire joli » |
| R2 | **Point de départ** : notre extrait OSM ne contient aucun mât car la requête actuelle ne les demande pas. Première tâche : ajouter `man_made=flagpole` à la requête (`scripts/fetch-osm.mjs`), relancer `npm run data` (avec réseau), regarder ce qu'OSM contient dans l'emprise, et le montrer à Dasco. Si OSM n'a rien de satisfaisant, Dasco place les mâts (Q4 de l'epic) |
| R3 | **Dans `city.json`** : si la requête change, les mâts arrivent par le script de données (`npm run data -- --offline` ensuite ; `city.json` jamais modifié à la main, règles 2 et 3 du projet). Sinon, les mâts sont dans `life.json` : `{ id, pos, height, design, note }` |
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
| Mât sur un bâtiment caché par un monument modélisé | La hauteur se lit sur le relief et le monument : vérifier que le mât ne traverse pas le toit |
| Mât posé sur un point hors du socle | Ignoré avec un avertissement console |
| Motif inconnu | Drapeau blanc et avertissement console |
| Nombreux mâts (> 20) | Un seul maillage instancié par motif |

---

## Dépendances et existant réutilisé
Outil de placement (`src/dev/placement.ts`) pour relever les positions ; `fetch-osm.mjs` ; `terrain.heightAt` ; liste `tickers`. **Dépend d'une décision de Dasco** (emplacements et motifs, Q4).

## Vérification
Un drapeau de chaque motif de près et de loin ; aucune erreur console si `flags` est vide ; `?debug` avant / après ; si la requête Overpass change : `npm run data`, puis `npm run data -- --offline`.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 3 |
| Complexité | Medium |

---

## Checklist dev

- [ ] Décision de Dasco sur les emplacements et les motifs
- [ ] Code implémenté (`src/scene/flags.ts`, `life.json`, éventuellement `fetch-osm.mjs`)
- [ ] `npm run build` passe ; `city.json` régénéré si le script change
- [ ] README et clôture d'itération ; sources des mâts notées
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : 🔲 Todo
