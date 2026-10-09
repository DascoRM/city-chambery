# EP009 - US006 - Brouillard

## User Story

**En tant que** visiteur,
**je veux** voir le brouillard noyer le bout de la ville,
**afin de** de retrouver les matins de brouillard de la cluse.

---

## Critères d'acceptation

- [ ] **Given** `?weather=fog`, **Then** un brouillard (FogExp2) dont la couleur suit le dégradé de fond du ciel, de jour comme de nuit
- [ ] **Given** la caméra rapprochée, **Then** le brouillard reste léger ; éloignée, il s'épaissit
- [ ] **Given** la nuit, **Then** les halos des bars percent le brouillard
- [ ] **Given** les étiquettes et l'interface, **Then** elles restent nettes et lisibles

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 10.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 1,5 à 2 |
| Complexité | Medium |
| Dépend de | US002 |

Détail technique : [plan front](../../../tasks/meteo-front-plan.md) § 2.6 (brouillard de vallée en nappes écarté : trop coûteux).

---

## Checklist dev
- [ ] Code ; `npm run build` ; vérifié dans le navigateur avec `?weather=` et `?debug`
- [ ] Fluidité : compteur `?debug` avant / après (rendu logiciel non représentatif : mesure GPU ou téléphone notée à part)
- [ ] Le site marche sans la météo
- [ ] FEATURES, CHANGELOG, DECISIONS, README si besoin
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : 🔲 Todo
