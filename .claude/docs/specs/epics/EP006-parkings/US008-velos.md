# EP006 - US008 - Vélos : supports et stations

## User Story

**En tant que** cycliste,
**je veux** voir où poser mon vélo,
**afin de** trouver une place sans chercher.

---

## Critères d'acceptation

- [ ] **Given** la couche « Vélos » allumée, **When** je regarde, **Then** les 136 supports OSM apparaissent par instances (+1 appel au plus)
- [ ] **Given** un support, **When** je le touche, **Then** la fiche donne ce qu'OSM sait (capacité si connue) et sinon « inconnu »
- [ ] **Given** les motos et les bornes de recharge, **When** je cherche, **Then** ils n'y sont pas (hors périmètre)

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 12 (honnêteté des chiffres, priorité fiche > OSM > estimation, pas de temps réel, budget de rendu par vue, rien ne casse la balade).

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 3 |
| Dépend de | US002 |

---

## Checklist dev

- [ ] Arceaux de Grand Chambéry (ODbL) : à évaluer plus tard
- [ ] `npm run build` ; vérifié dans le navigateur ; images/s, appels, triangles mesurés par vue
- [ ] Validé par Dasco

---

**Priorité** : Low
**Status** : 🔲 Todo
