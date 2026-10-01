# EP001 - US011 - Des horaires provisoires pour les bars, pubs et boîtes de nuit

## User Story

**En tant que** visiteur qui regarde la ville la nuit,
**je veux** que les bars, pubs et boîtes de nuit aient des horaires d'ouverture, même provisoires,
**afin que** la nuit soit crédible (lieux allumés ou éteints selon l'heure) et que les groupes de passants de l'US002 aient un sens.

---

## Contexte
Seuls 10 bars sur 25, 3 pubs sur 7 et aucune des 4 boîtes de nuit ont des horaires dans OpenStreetMap. Dasco a une base de données avec des informations scrappées pour son projet bar / restau : un script les récupérera plus tard. **En attendant, des horaires fictifs** (décision de Dasco, Q7 de l'epic).

---

## Critères d'acceptation

- [ ] **Given** un bar sans horaires OSM et aux horaires provisoires `Mo-Sa 17:00-01:00`, **When** l'horloge est à 3 h un mardi, **Then** il est éteint (fermé) ; **When** elle est à 23 h un mardi, **Then** il est allumé
- [ ] **Given** une boîte de nuit, **When** il est 20 h, **Then** elle est éteinte ; **When** il est 1 h un vendredi, **Then** elle est allumée
- [ ] **Given** un bar qui a des horaires dans OSM, **When** le fichier des horaires provisoires est chargé, **Then** les horaires OSM restent ceux utilisés (les provisoires ne s'appliquent qu'aux lieux sans horaires)
- [ ] **Given** la fiche d'un bar aux horaires provisoires, **When** je l'ouvre, **Then** elle n'affiche ni horaires ni « Ouvert maintenant » tirés des valeurs fictives (la fiche n'affiche que les vraies données)
- [ ] **Given** `npm run build`, **When** il s'exécute, **Then** il passe

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | Fichier **`src/content/place-hours.json`** : identifiant OSM du lieu (`node/…`) → horaire au format OSM `opening_hours` (le parseur de `src/time/openinghours.ts` le lit, y compris après minuit). Une clé `note` rappelle que ces horaires sont **fictifs** |
| R2 | Portée : les lieux `bar`, `pub` et `nightclub` **sans horaires dans `city.json`** (23 lieux aujourd'hui : 15 bars, 4 pubs, 4 boîtes de nuit) |
| R3 | Horaires de départ : bars `Mo-Sa 17:00-01:00`, `Tu-Su 18:00-02:00` ou `Mo-Su 16:00-00:00` (réparti entre les lieux pour varier) ; pubs `Mo-Su 16:00-01:00` ; boîtes de nuit `Th-Sa 23:00-05:00` |
| R4 | Les horaires provisoires servent **seulement à l'éclairage de nuit et aux groupes de passants** ; ils ne sont **jamais affichés** aux visiteurs (ni horaires, ni « ouvert / fermé » dans la fiche) |
| R5 | `public/data/city.json` n'est pas modifié (règle 3 du projet) : le fichier est lu par l'appli et fusionné au chargement |
| R6 | README, section Limites connues : horaires provisoires, à remplacer par les vraies données ; ligne au BACKLOG pour le script de Dasco |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Identifiant inconnu dans le fichier | Ignoré (avertissement console en mode dev) |
| Horaire illisible | Le lieu reste « inconnu » (allumé la nuit, comme avant) |
| Le script de Dasco ajoute de vrais horaires dans `city.json` | Les vrais horaires passent avant les provisoires ; le fichier peut être vidé |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 1 |
| Complexité | Simple |

---

**Priorité** : High
**Status** : ✅ Done (itération 46)
