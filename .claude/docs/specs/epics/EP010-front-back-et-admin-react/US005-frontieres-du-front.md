# EP010 - US005 - Frontières du front vérifiées au build

## User Story

**En tant que** développeur (Claude),
**je veux** que la carte et l'admin ne puissent pas utiliser le code l'une de l'autre,
**afin de** que la séparation tienne dans le temps.

---

## Critères d'acceptation

- [ ] **Given** `check-boundaries.mjs` dans `npm run build`, **When** l'admin importe un fichier de la carte (ou l'inverse), **Then** le build échoue avec un message clair
- [ ] **Given** la carte, **When** elle importe React, **Then** le build échoue
- [ ] **Given** le front, **When** il importe le code de l'API, **Then** le build échoue (le front parle au back par HTTP)

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 7 et tableau « Qui a le droit d'utiliser quoi ».

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Phase | 1 |
| Jours | 0,5 |
| Risque | Faible |
| Dépend de | US003 |

Détail : [plan de cloisonnement](../../../tasks/cloisonnement-depot-plan.md) § 3.2.

---

## Checklist dev
- [ ] `npm run build` et `npm test` passent
- [ ] La carte se comporte comme avant (vérification navigateur, `?debug`)
- [ ] Lock commité si les dépendances changent
- [ ] README, DECISIONS, CHANGELOG si besoin
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : ✅ Fait le 09/10/2026 (itération 84)
