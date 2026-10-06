# EP007 - US009 - Nouvelle gare de Chambéry

## User Story

**En tant que** visiteur de la maquette,
**je veux** voir Nouvelle gare de Chambéry modélisé pour de bon (et non un simple volume),
**afin de** le reconnaître tout de suite quand je me promène ou que je regarde la ville d'en haut.

---

## Critères d'acceptation

- [ ] **Given** la carte, **When** je regarde Nouvelle gare de Chambéry, **Then** il est reconnaissable de jour comme de nuit, avec les proportions du lieu réel d'après les références fournies
- [ ] **Given** la balade, **When** l'avatar passe derrière, **Then** le monument s'efface comme les autres bâtiments et l'avatar reste visible
- [ ] **Given** `?debug`, **When** je compare avec avant, **Then** le monument ne coûte aucun appel de rendu de plus par rapport au maillage fusionné des monuments (≤ 3000 triangles)
- [ ] **Given** l'ancien volume générique, **When** le modèle est posé, **Then** le contour OSM correspondant n'est plus dessiné (aucun bâtiment sur le monument)
- [ ] **Given** la fiche du lieu, **When** je l'ouvre, **Then** sa source est citée (aucun fait inventé)

---

## Contexte (mesuré le 06/10/2026)

| | |
|---|---|
| **Position / emprise** | **En bordure de carte** : centre à y = 611, le socle s'arrête à y = 583 ; seule une partie du bâtiment (4 753 m², 3 niveaux) est dans l'emprise |
| **Données OSM** | Bâtiment OSM « train_station », `wikidata` Q3096183 |
| **Travail attendu** | Volume partiel seulement (l'emprise n'est pas agrandie : décision de Dasco) ; à décider si l'on modélise un morceau coupé ou rien |

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
| Points | 3 |

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
