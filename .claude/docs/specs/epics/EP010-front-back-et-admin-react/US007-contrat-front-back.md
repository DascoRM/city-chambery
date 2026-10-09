# EP010 - US007 - `contrat/` : schémas partagés entre front et back

## User Story

**En tant que** développeur (Claude),
**je veux** que les formats échangés entre le front et l'API soient écrits une seule fois,
**afin de** que l'admin et l'API ne divergent jamais.

---

## Critères d'acceptation

- [ ] **Given** `contrat/` (Zod seulement, ni DOM ni Node), **Then** il contient le format de `/api/health` et `/api/admin/status`
- [ ] **Given** l'API, **Then** elle valide avec ces schémas ; **Given** l'admin, **Then** elle vérifie les réponses avec les mêmes (fin de la copie de `DbStatus`)
- [ ] **Given** EP008-US006, **Then** le format des retouches (`ParkingOverride`, aujourd'hui dans `src/scene/parking-edits.ts`) y sera écrit
- [ ] **Given** `contrat/`, **When** on y importe `document` ou `node:fs`, **Then** la compilation échoue

> **Décisions du 09/10/2026 (D12, à confirmer)** : tout `contrat/` en **`zod/mini`** (mêmes schémas et types, ≈ 7 Ko gzip au lieu de 26). Le back valide et type ses entrées avec ; l'admin vérifie les réponses ; **la carte vérifie les retouches publiées une par une** avec le contrat, en gardant sa tolérance (une retouche invalide est ignorée sans jeter les autres) : ≈ +7 Ko gzip pour la carte, prête pour la connexion front-back. Détail : [plan de la phase 2](../../../tasks/ep010-phase2-plan.md) § 3 (écrit avant cette décision : il prévoyait « types seulement » pour la carte).

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 7 et tableau « Qui a le droit d'utiliser quoi ».

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Phase | 2 |
| Jours | 0,5 |
| Risque | Faible |
| Dépend de | US006 |

Détail : [plan de cloisonnement](../../../tasks/cloisonnement-depot-plan.md) § 3.2 (contrat API).

---

## Checklist dev
- [ ] `npm run build` et `npm test` passent
- [ ] `check-api-esm` couvre `contrat/` (Vercel l'embarque)
- [ ] Lock commité si les dépendances changent
- [ ] README, DECISIONS, CHANGELOG si besoin
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : 🔲 Todo
