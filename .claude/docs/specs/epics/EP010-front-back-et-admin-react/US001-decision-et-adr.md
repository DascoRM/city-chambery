# EP010 - US001 - Décision et ADR-002 « Séparer front et back »

## User Story

**En tant que** Dasco,
**je veux** que la structure (frontend : carte + admin ; backend : API) et la pile de l'admin, tranchées le 09/10/2026 (D1 à D6), soient consignées dans un ADR,
**afin de** que la séparation soit faite une fois, sans revenir dessus.

---

## Critères d'acceptation

- [x] **Given** les décisions D1 à D6 (tranchées le 09/10/2026), **Then** l'ADR-002 décrit la structure, les règles « qui utilise quoi », la pile de l'admin et les options écartées
- [x] **Given** DECISIONS.md, **Then** une ligne par décision renvoie à l'ADR-002

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 7 et tableau « Qui a le droit d'utiliser quoi ».

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Phase | 1 |
| Jours | 0,25 |
| Risque | — |
| Dépend de | — |

Détail : [plan de cloisonnement](../../../tasks/cloisonnement-depot-plan.md), [plan de l'admin React](../../../tasks/admin-react-plan.md).

---

## Checklist dev
- [x] `npm run build` et `npm test` passent
- [x] Décisions reportées dans l'epic
- [x] Lock commité si les dépendances changent
- [x] README, DECISIONS, CHANGELOG si besoin
- [x] Validé par Dasco

---

**Priorité** : High
**Status** : ✅ Done (09/10/2026)
