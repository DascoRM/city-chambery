# EP010 - US007 - `content/` à la racine

## User Story

**En tant que** développeur (Claude),
**je veux** sortir le contenu éditorial du code du site,
**afin de** que le site, les scripts, l'outil de placement et l'export d'EP008-US006 partagent un seul emplacement.

---

## Critères d'acceptation

- [ ] **Given** `git mv src/content content`, **Then** les imports du site, `POIS_PATH` du plugin de placement et les 3 scripts (`fetch-osm`, `convert-nature`, `convert-buildings`) sont à jour
- [ ] **Given** `npm run data -- --offline`, **Then** `city.json` est identique (`git diff --stat public/data` vide)
- [ ] **Given** l'outil de placement en dev, **Then** il écrit toujours au bon endroit

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 7 et règles d'import.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 0,5 |
| Risque | Faible |
| Dépend de | US002 ; avant EP008-US006 |

Détail : [plan de cloisonnement](../../../tasks/cloisonnement-depot-plan.md) § 4 (étape 4).

---

## Checklist dev
- [ ] `npm run build` et `npm test` passent
- [ ] `city.json` identique ; Le site se comporte comme avant (vérification navigateur)
- [ ] Lock commité si les dépendances changent
- [ ] README, DECISIONS, CHANGELOG si besoin
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : 🔲 Todo
