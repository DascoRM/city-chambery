# EP010 - US003 - `frontend/admin` : socle React

## User Story

**En tant que** Dasco (administrateur),
**je veux** une administration construite en React, servie sous `/admin/`, séparée de la carte,
**afin de** que les écrans d'EP008 soient rapides à écrire et sûrs.

---

## Critères d'acceptation

- [ ] **Given** `frontend/admin` (Vite, `base: '/admin/'`, sortie `dist/admin/` construite **après** la carte), **Then** le service worker de la carte ne connaît pas l'admin
- [ ] **Given** la pile (React 19, wouter, TanStack Query, React Hook Form), **Then** un client `api()` unique ajoute l'authentification et traduit les erreurs (401, 429, 503, 404)
- [ ] **Given** une URL profonde `/admin/parkings/x`, **Then** Vercel et nginx renvoient `/admin/index.html`
- [ ] **Given** la CSP, **Then** elle passe en en-tête HTTP sur `/admin/` (avec `frame-ancestors 'none'`)
- [ ] **Given** le build, **Then** `dangerouslySetInnerHTML` est refusé et l'admin pèse moins de 150 Ko gzip au chargement
- [ ] **Given** `npm run dev:admin` (proxy `/api` vers l'API locale), **Then** l'admin se développe en local
- [ ] **Given** Vitest + Testing Library, **Then** un premier test de composant passe

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 7 et tableau « Qui a le droit d'utiliser quoi ».

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Phase | 1 |
| Jours | 1,5 |
| Risque | Moyen (réécritures `/admin/*`, ordre des builds) |
| Dépend de | US002 |

Détail : [plan de l'admin React](../../../tasks/admin-react-plan.md) § 2 à § 4 (ADM-01).

---

## Checklist dev
- [ ] `npm run build` et `npm test` passent
- [ ] Prévisualisation `preview/front-back` : `/`, `/admin/`, `/api/health` répondent ; service worker sans fichier de l'admin
- [ ] Lock commité si les dépendances changent
- [ ] README, DECISIONS, CHANGELOG si besoin
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : 🔲 Todo
