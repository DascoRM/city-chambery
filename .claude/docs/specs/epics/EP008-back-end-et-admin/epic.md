# Epic EP008 - Back-end léger et administration, pour un coût nul

**Statut (08/10/2026) : pile validée par Dasco ([ADR-001](../../architecture/decisions/ADR001-back-end-typescript-vercel-neon.md)) ; reste à valider l'ordre des user stories et à créer la base Neon. Rien n'est codé.** Analyse : [back-end et administration](../../../tasks/analyse-back-end-admin.md) (coûts vérifiés le 08/10/2026).

## Résumé
Ajouter au site statique un **petit back-end gratuit** (fonctions du même dépôt + une base qui se réveille seule) pour **retrouver la progression des joueurs**, un **classement** et le **partage entre amis**, et une **administration** qui permet à Dasco de corriger parkings et lieux et de placer des éléments sur la carte, sans passer par la conversation.

## Contexte & Problème
- Aujourd'hui tout est dans le navigateur (`localStorage`) : la progression ne suit pas d'un appareil à l'autre, il n'y a ni classement ni amis, et Dasco ne peut corriger le contenu que par fichiers et conversation.
- Contrainte : **ne rien payer**. Vercel Hobby (gratuit) offre 1 000 000 d'invocations de fonctions par mois et 100 Go de transfert ; il est réservé à un usage **non commercial** (vérifié le 08/10/2026).
- Pièges des bases gratuites : Supabase se met en pause après 1 semaine sans activité et Turso s'archive après 10 jours : aucun des deux ne convient à un jeu consulté de temps en temps. **Neon (Postgres)** se met en veille après 5 minutes mais **se réveille seul**.

## Pile retenue (validée par Dasco le 08/10/2026)
**TypeScript** dans le même dépôt que le site : **Hono** (routes typées, léger pour les fonctions), **Zod** (validation de tout ce qui entre), **Drizzle** (accès à la base et migrations), **Neon** (PostgreSQL), fonctions **Vercel**. Pourquoi : mêmes types que le site, un seul `npm run build` qui vérifie tout, retours du compilateur clairs ; Rust, Django, FastAPI, Flask et NestJS ont été écartés (voir l'ADR-001 : Rust n'apporte rien ici, on est à 9 % du quota gratuit). Tests : Vitest, comme le reste de la chaîne TypeScript.

## Architecture proposée
```
Navigateur ──► Vercel (site statique, plan Hobby)
          └──► /api/* (fonctions Vercel, même dépôt)  ──► Neon Postgres (gratuit, veille automatique)
Administration : /admin (React, EP010) ──► /api/admin/* (le jeton ouvre une session : cookie HttpOnly glissant, 2 h / 8 h ; plus tard des comptes en base)
Sauvegarde : export hebdomadaire des retouches en JSON dans le dépôt (historique Git)
```
- **Aucun compte** au départ : un identifiant aléatoire et un code personnel pour changer d'appareil ; pas d'adresse électronique, donc très peu de données personnelles.
- **Le site marche sans l'API** : si elle est en panne ou si le quota est atteint, on retombe sur `localStorage` comme aujourd'hui.
- **Préproduction** : les prévisualisations Vercel utilisent une base séparée (jamais la base de production).

## Objectifs
1. Retrouver sa progression sur un autre appareil, sans compte
2. Un classement et le partage entre amis, avec pseudos libres
3. Une administration pour retoucher parkings et lieux et placer des éléments sur la carte
4. **Coût nul** : cent amis ≈ 90 000 appels par mois, soit 9 % du million d'invocations gratuites
5. Aucune régression : le site statique reste le cœur, l'API est un plus

---

## User Stories

| ID | User Story | Estimation | Status |
|----|------------|-----------|--------|
| [US001](US001-socle-api-et-base.md) | Socle API et base de données | 3 | 🟡 Fait, base à migrer par Dasco |
| [US002](US002-identite-et-progression.md) | Identité anonyme et progression synchronisée | 5 | 🔲 Todo |
| [US003](US003-scores-et-classement.md) | Scores et classement | 3 | 🔲 Todo |
| [US004](US004-amis.md) | Partage entre amis | 5 | 🔲 Todo |
| [US005](US005-admin-acces-et-tableau-de-bord.md) | Administration : accès protégé et tableau de bord | 3 | 🟡 Accès et état de la base faits, essayés par Dasco sur Vercel ; usage et quotas à venir |
| [US006](US006-admin-retouches.md) | Administration : retouches des parkings et des lieux | 5 | 🟡 Parkings faits ; lieux d'histoire à venir |
| [US007](US007-admin-carte-de-position.md) | Administration : carte de position | 3 | 🔲 Todo |
| [US008](US008-garde-fous-de-cout.md) | Garde-fous de coût | 2 | 🔲 Todo |
| [US009](US009-donnees-personnelles.md) | Données personnelles | 2 | 🔲 Todo |
| [US010](US010-documentation-et-sauvegarde.md) | Documentation et sauvegarde | 2 | 🔲 Todo |

**Total : 33 points (≈ 6 à 8 sessions).** Branche d'epic : `feat/EP008-back-end` ; une branche par US fusionnée dedans (règle des epics EP005 à EP007).
**Ordre conseillé** : US001 (socle) → US005 (accès admin) → US006 et US007 (ce dont Dasco a besoin en premier) → US002 (progression) → US003, US008 → US004, US009, US010.

### Mise à jour du 08/10/2026 : séparer front et back, administration en React ([EP010](../EP010-front-back-et-admin-react/epic.md))
Dasco a demandé de **séparer nettement le front et le back** : **frontend** = la carte (Three.js + OSM, conservée telle quelle) et l'administration (en React) ; **backend** = l'API, consommée par l'admin puis, à terme, par la carte. EP010 porte cette réorganisation en deux phases. **EP008 est en pause pendant EP010** (décision de Dasco du 09/10 ; ses réponses du 09/10 et les plans « admin par tables » et « progression » sont mis de côté dans `git stash`, message « EP008 en attente d'EP010 ») :
- **Phase 1 (front)** : EP010-US001 à US005 (`frontend/carte`, `frontend/admin` en React, qui reprend l'existant à l'identique, retouches de parkings comprises)
- **Phase 2 (back)** : EP010-US006 à US009 (`backend/`, `contrat/` partagé, session par cookie)

**Ordre conseillé** : US001 ✅ → US005 (accès ✅) → US006 (parkings ✅, lieux à venir) → **EP010 phase 1 puis phase 2** → reprise : admin par tables, US005 (suite : tableau de bord), US006 (lieux), US007 → US002 → US003, US008 → US004, US009, US010.

**Écrans d'administration en React, par US** (front seul, back-end non compté sauf mention ; [plan de l'admin React](../../../tasks/admin-react-plan.md) § 1 et § 4) :
| US | Écrans | Jours (front) |
|----|--------|---------------|
| US005 | Tableau de bord : joueurs actifs, appels par jour, part des quotas, alerte à 70 %, dernière sauvegarde (avec US008) ; plus tard, connexion par identifiant et mot de passe (comptes en base, pas de GitHub : décision du 09/10) : ≈ 0,5 front + 1 à 1,5 back, à préciser | 1 (+ 0,5) |
| US006 | Parkings : repris tels quels par EP010-US004, puis repensés « par tables » ; lieux (position + source en v1) ; journal et annulation | à réestimer avec le plan « admin par tables » |
| US007 | Carte de position : **la carte Three.js existante affichée dans l'admin**, l'outil 📍 Position renvoie le point cliqué | 0,5 |
| US010 | Sauvegarde et export | 0,5 |
| | **Total** | à réestimer |

L'estimation de l'epic (« 6 à 8 sessions », back-end compris) est donc **dépassée** : EP010 (≈ 6,5 à 8 j) plus ces écrans. Points à régler côté back pour US006 : table `edits` et lecture publique des retouches par le site (`GET /api/edits` en cache, repli sur `parkings.json`) ; **la base fait foi, l'export JSON est la sauvegarde**. US008 : Vercel Hobby n'expose sans doute pas l'usage par API (non vérifié) → compter nous-mêmes en base.

---

## Règles métier
1. **Coût nul** : rester dans les offres gratuites ; chaque US vérifie son effet sur les quotas ; au-delà d'un quota le site continue sans l'API
2. **Site d'abord** : aucune fonctionnalité existante ne dépend de l'API ; hors ligne, tout marche comme aujourd'hui
3. **Aucune confiance dans le navigateur** : tout ce qui est écrit (score, retouche) est validé côté serveur
4. **Sources obligatoires** : une retouche de contenu ne s'enregistre pas sans source (règle du projet « rien d'inventé », devenue une contrainte technique)
5. **Assainir** tout texte saisi avant affichage (la relecture de l'epic parkings a trouvé une injection HTML dans une note de fiche)
6. **Secrets** hors du dépôt (variables Vercel) ; prévisualisation et production séparées
7. **Données minimales** : identifiant, pseudo, progression ; suppression sur demande
8. **Sauvegarde** : les retouches sont exportées dans le dépôt (historique Git) ; la base se restaure à partir de ses exports
9. **Usage non commercial** (Vercel Hobby) : si le projet devenait commercial, passage au plan Pro (20 $ par utilisateur et par mois) à décider alors

## Ce que Dasco doit faire (actions de compte, je ne peux pas les faire)
- Créer la base **Neon** depuis l'onglet Intégrations / Marketplace de son projet Vercel (les variables d'environnement s'ajoutent toutes seules) ; créer une branche ou un projet de base pour les prévisualisations.
- Choisir et saisir le **jeton d'administration** dans les variables Vercel (je le fournirai sous forme de commande, jamais dans le dépôt).

## Critères d'acceptation de l'epic
- [ ] US001 à US010 livrées ; `npm run build` passe ; le site fonctionne sans l'API
- [ ] Usage mesuré sur une semaine : appels, CPU, taille de la base, pas plus de 10 % des quotas gratuits
- [ ] Revue de sécurité (jeton, validation côté serveur, assainissement, limites d'accès)
- [ ] Revue de Dasco sur l'administration et sur l'effet immédiat des retouches

## Estimation globale
- **Complexité** : M. **Effort** : 6 à 8 sessions. Incertain : le temps de réveil de la base après une veille, les limites réelles de Neon en préproduction (branches), l'authentification de l'administration (jeton, puis comptes en base).
