# EP002 - US001 - Choisir où écrire chaque nom de rue

## User Story

**En tant que** visiteur qui explore les rues,
**je veux** que chaque rue ait son nom écrit à quelques endroits bien choisis,
**afin de** me repérer sans que le sol soit couvert de texte.

---

## Critères d'acceptation

- [x] **Given** `npm run data -- --offline`, **When** il se termine, **Then** `city.json` contient une liste d'emplacements de noms de rues, chacun avec son texte, sa position et sa direction (angle de la rue)
- [x] **Given** les 225 noms de voies de l'export actuel, **When** je regarde la liste, **Then** chaque nom retenu (Q1) a au moins un emplacement, et les voies exclues n'en ont aucun
- [x] **Given** une longue rue en plusieurs tronçons (« Avenue de Lyon », 21 tronçons), **When** la liste est construite, **Then** les tronçons de même nom sont réunis et l'emplacement est choisi sur le tracé continu (pas un nom par tronçon)
- [x] **Given** une rue longue, **When** la liste est construite, **Then** son nom n'est écrit **qu'une seule fois** (décision Q4) ; deux exemplaires du même nom ne se trouvent qu'à plus de 60 m (rues homonymes distinctes)
- [x] **Given** une rue courte, **When** la liste est construite, **Then** le nom n'est écrit que s'il tient dans la longueur de la rue (sinon : pas de nom, ou nom plus petit)
- [x] **Given** une rue courbe, **When** l'emplacement est choisi, **Then** il tombe sur une partie presque droite, pas dans un virage serré
- [x] **Given** un nom, **When** je compare avec OpenStreetMap, **Then** le texte est identique au tag `name`

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | Les noms viennent des tronçons `roads[].name` déjà exportés ; aucune nouvelle requête Overpass nécessaire |
| R2 | La liste est calculée dans `scripts/fetch-osm.mjs` (comme `labels` pour les parcs), pas dans le navigateur : le navigateur ne fait que dessiner |
| R3 | Le script ne modifie pas `city.json` à la main (règle projet) : régénération par `npm run data -- --offline` |
| R4 | Une rue est une suite de tronçons de même nom qui se touchent ; deux rues homonymes éloignées (ex. « Rue Pasteur » à deux endroits) restent séparées |
| R5 | Le texte est affiché tel quel ; la longueur sert à choisir la taille de caractères |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Tronçon sans nom | Aucun nom écrit |
| Voie très courte (< 25 m) | Aucun nom |
| Même nom, deux rues éloignées | Chacune a ses propres emplacements |
| Rue en forme de U ou de boucle | Un emplacement par partie droite, pas de nom écrit « en travers » |
| Place (`area`) et rue du même nom | Un seul affichage : la rue |
| Pont ou voie couverte | Le nom suit la hauteur du pont (voir US002) |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 3 |
| Complexité | Medium |

---

## Checklist dev

- [x] Code implémenté (`scripts/fetch-osm.mjs`, `diorama.config.json`)
- [x] `npm run data -- --offline` relancé, `city.json` régénéré
- [x] Types (`src/types.ts`) mis à jour
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : ✅ Done (01/10/2026) : `scripts/street-names.mjs`, 182 noms sur 212 noms de voies ; 32 sans emplacement (trop courtes ou pas assez droites)
