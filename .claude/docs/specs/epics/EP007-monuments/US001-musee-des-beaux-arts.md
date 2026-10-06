# EP007 - US001 - Musée des Beaux-Arts

## User Story

**En tant que** visiteur de la maquette,
**je veux** voir Musée des Beaux-Arts modélisé pour de bon (et non un simple volume),
**afin de** le reconnaître tout de suite quand je me promène ou que je regarde la ville d'en haut.

---

## Critères d'acceptation

- [ ] **Given** la carte, **When** je regarde Musée des Beaux-Arts, **Then** il est reconnaissable de jour comme de nuit, avec les proportions du lieu réel d'après les références fournies
- [ ] **Given** la balade, **When** l'avatar passe derrière, **Then** le monument s'efface comme les autres bâtiments et l'avatar reste visible
- [ ] **Given** `?debug`, **When** je compare avec avant, **Then** le monument ne coûte aucun appel de rendu de plus par rapport au maillage fusionné des monuments (≤ 3000 triangles)
- [ ] **Given** l'ancien volume générique, **When** le modèle est posé, **Then** le contour OSM correspondant n'est plus dessiné (aucun bâtiment sur le monument)
- [ ] **Given** la fiche du lieu, **When** je l'ouvre, **Then** sa source est citée (aucun fait inventé)

---

## Contexte (mesuré le 06/10/2026)

| | |
|---|---|
| **Position / emprise** | Oui, (−61, 267), volume de 819 m², 21,4 m (ajouté à l'itération 77) |
| **Données OSM** | Fiche OSM : musée, horaires ; `wikidata` Q3330197 |
| **Travail attendu** | Façade principale, toit, corniche, entrée ; référence : photos à fournir par Dasco |

## Références à fournir par Dasco
- Photo(s) ou lien(s) : ………………………………
- Position (si à localiser) : ………………………………
- Remarques (couleurs, détails à garder, détails à ignorer) : ………………………………

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 7 (un modèle par monument, formes simples, +1 appel de rendu au total, sources).

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 5 |

---

## Checklist dev
- [ ] Références reçues (photos, liens, position)
- [ ] Modèle dans le maillage « monuments » ; `hideOsm` mis à jour ; placé avec l'outil de position
- [ ] Vérifié : jour, nuit, hiver, balade (effacement), `?debug` (appels, triangles)
- [ ] `npm run build` ; FEATURES, CHANGELOG, DECISIONS
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : 🔲 Todo
