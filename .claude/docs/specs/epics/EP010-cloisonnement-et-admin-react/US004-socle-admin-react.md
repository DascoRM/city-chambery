# EP010 - US004 - Socle de l'administration React

## User Story

**En tant que** Dasco (administrateur),
**je veux** une administration construite proprement en React, servie sous `/admin/`,
**afin de** que les écrans d'EP008 soient rapides à écrire et sûrs.

---

## Critères d'acceptation

- [ ] **Given** `admin/` (Vite, `base: '/admin/'`, sortie `dist/admin/` après le site, `publicDir: false`), **When** on lance `npm run build`, **Then** le site puis l'admin sont construits et le service worker ne connaît pas l'admin
- [ ] **Given** la pile (React 19, wouter, TanStack Query, React Hook Form + Zod partagé), **Then** un client `api()` unique ajoute l'authentification, valide les réponses avec `shared/` et traduit les erreurs (401, 429, 503, 404 plateforme / API)
- [ ] **Given** une URL profonde `/admin/parkings/x`, **Then** Vercel et nginx renvoient `/admin/index.html` (réécriture)
- [ ] **Given** la CSP, **Then** elle passe de la balise `<meta>` à un en-tête sur `/admin/(.*)` avec `frame-ancestors 'none'` (en production)
- [ ] **Given** le build, **Then** `dangerouslySetInnerHTML` est refusé et le chargement de l'admin fait moins de 150 Ko gzip
- [ ] **Given** Vitest + Testing Library, **Then** un premier test de composant passe
- [ ] **Given** `npm run dev:admin` (port 5174, proxy `/api` vers 8787), **Then** l'admin se développe en local

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 7 et règles d'import.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 1,5 |
| Risque | Moyen (réécritures `/admin/*`, ordre des builds) |
| Dépend de | US002 (US003 conseillée) ; sinon dossier `admin/` provisoire (D9) |

Détail : [plan de l'admin React](../../../tasks/admin-react-plan.md) § 2, § 3 et § 4 (ADM-01) ; [plan de cloisonnement](../../../tasks/cloisonnement-depot-plan.md) § 4 (étape 3).

---

## Checklist dev
- [ ] `npm run build` et `npm test` passent
- [ ] Prévisualisation `preview/cloisonnement` : `/`, `/api/health`, `/admin/` répondent ; service worker sans `admin/`
- [ ] Lock commité si les dépendances changent
- [ ] README, DECISIONS, CHANGELOG si besoin
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : 🔲 Todo
