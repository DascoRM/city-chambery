# EP009 - US003 - Route `/api/weather` : source, cache, repli, tests

## User Story

**En tant que** Dasco (administrateur),
**je veux** une route qui donne la météo de Chambéry dans un format simple, avec un seul appel à la source toutes les 10 minutes,
**afin de** de rester gratuit et de ne pas dépendre de la source à chaque visite.

---

## Critères d'acceptation

- [ ] **Given** une source disponible, **When** on appelle `GET /api/weather`, **Then** on reçoit le JSON v1 (condition, température, couverture nuageuse, intensités pluie / neige 0..1, vent, visibilité, brouillard, orage, `observedAt`, attribution)
- [ ] **Given** 100 appels en 10 minutes, **Then** un seul appel part vers Open-Meteo (cache mémoire, requête partagée, `s-maxage=600, stale-while-revalidate`)
- [ ] **Given** la source en panne, **Then** on sert le dernier bon relevé avec `stale: true` jusqu'à 3 h, puis `503`
- [ ] **Given** une réponse amont incomplète ou aberrante (température hors -40..50 °C), **Then** elle est rejetée par Zod et on passe au repli
- [ ] **Given** les tests Vitest (amont simulé, sans réseau), **Then** ils couvrent la correspondance des codes WMO, la panne, le cache et la forme du contrat

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 10.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 2 |
| Complexité | Medium |
| Dépend de | EP008-US001 (socle API) |

Détail technique : [plan back](../../../tasks/meteo-back-plan.md) § 2 à § 4 ; retirer le `no-store` global de `backend/src/app.ts` pour cette route.

---

## Checklist dev
- [ ] Code ; `npm run build` ; vérifié dans le navigateur avec `?weather=` et `?debug`
- [ ] Fluidité : compteur `?debug` avant / après (rendu logiciel non représentatif : mesure GPU ou téléphone notée à part)
- [ ] Le site marche sans la météo
- [ ] FEATURES, CHANGELOG, DECISIONS, README si besoin
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : 🔲 Todo
