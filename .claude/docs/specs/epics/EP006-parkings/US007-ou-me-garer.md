# EP006 - US007 - « Où me garer pour aller à… ? » avec l'avatar

## User Story

**En tant que** visiteur,
**je veux** choisir un lieu et voir où me garer, avec le temps de marche,
**afin de** passer de l'information à l'action.

---

## Critères d'acceptation

- [ ] **Given** un lieu (✦ ou bar), **When** je demande « où me garer ? », **Then** les parkings sont classés par temps de marche réel sur le réseau de l'avatar
- [ ] **Given** un parking du classement, **When** je le choisis, **Then** l'avatar part de là et marche jusqu'au lieu (temps affiché = temps du trajet)
- [ ] **Given** un parking dont la capacité est inconnue, **When** il figure au classement, **Then** son étiquette « inconnu » reste visible
- [ ] **Given** le mode balade, **When** j'utilise la fonction, **Then** la caméra et l'effacement des bâtiments se comportent comme d'habitude

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 12 (honnêteté des chiffres, priorité fiche > OSM > estimation, pas de temps réel, budget de rendu par vue, rien ne casse la balade).

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 5 |
| Dépend de | US003, EP005 (US001, US004) |

---

## Checklist dev

- [ ] Réutiliser `avatar-path.ts`
- [ ] Vitesse de marche réaliste pour le temps affiché (pas 14 m/s)
- [ ] `npm run build` ; vérifié dans le navigateur ; images/s, appels, triangles mesurés par vue
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : 🔲 Todo
