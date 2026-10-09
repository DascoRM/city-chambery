# CLAUDE.md — Agent principal

Projet : **Chambéry en diorama**, diorama 3D interactif du centre historique de Chambéry
(Vite + TypeScript + Three.js, données OSM et IGN). Depuis EP010 ([ADR-002](docs/architecture/decisions/ADR002-separer-front-et-back.md)) :
**frontend** = la carte (`frontend/carte`, site statique) et l'administration React (`frontend/admin`) ;
**backend** = l'API Hono sur Vercel (`backend/src`, facultative pour la carte) ; `contrat/` = les formats échangés (zod/mini).

Tu es l'agent principal. Tu orchestres les sub-agents (quand ils existeront) et tu es le SEUL à implémenter du code.

---

## En début de session

1. Lire `.claude/docs/context.md` (vision, stack, index des documents)
2. Lire le suivi : `docs/versions/backlog/BACKLOG.md`, `docs/versions/FEATURES.md`,
   les dernières entrées de `docs/versions/CHANGELOG.md`, `docs/architecture/decisions/DECISIONS.md`
3. Si la demande porte sur un gros chantier : lire sa spec dans `docs/specs/epics/`
4. Si un plan existe dans `docs/tasks/` pour la demande : le lire avant d'implémenter

---

## Règles projet (absolues)

1. **Ne jamais inventer de coordonnées ni de faits historiques** : chaque fiche de `frontend/carte/content/pois.json` est sourcée ; une position vient d'OSM (`osm.match`) ou de Dasco (`pos`, outil de placement)
2. **Après toute modification du script de données** (`frontend/carte/scripts/`, `frontend/carte/diorama.config.json`) : `npm run data -- --offline` pour régénérer `frontend/carte/public/data/city.json`
3. **Ne jamais modifier `frontend/carte/public/data/city.json` à la main**
4. **Après un changement de dépendances** : commiter `package-lock.json` (le build Docker fait `npm ci`)
5. **Attributions** : tout nouvel asset tiers doit avoir sa licence dans le README (section Licences) et, si elle l'exige, un crédit affiché dans l'app
6. **Dire ce qui a été vérifié et ce qui ne l'a pas été** : le navigateur de test fait un rendu WebGL logiciel, ses temps ne sont pas représentatifs
7. **Le front ne parle au back que par HTTP** : la carte et l'administration n'importent jamais le code de `backend/`, ni l'une celui de l'autre ; les formats échangés s'écrivent une fois dans `contrat/` (zod/mini seulement). `npm run build` le vérifie (`scripts/check-boundaries.mjs`)

---

## Workflow (hybride)

### Petite demande ou retour de Dasco → une itération

1. Partir du BACKLOG ou du retour de Dasco ; poser des questions si le besoin est flou
2. Branche `feat/<sujet>` (ou `fix/<sujet>`)
3. Implémenter ; vérifier dans le navigateur (`?debug` pour le compteur de perf et le debug des éléphants)
4. `npm run build` (types des quatre parties, frontières, chargement de l'API comme sur Vercel) et `npm test` doivent passer.
   Pour l'API ou l'admin : prévisualisation par `git push origin <branche>:preview/<sujet>`, vérifiable par l'agent avec
   l'en-tête `x-vercel-protection-bypass` (secret `VERCEL_AUTOMATION_BYPASS_SECRET` dans le `~/.zshrc` de Dasco, jamais dans le dépôt)
5. Clôturer l'itération (voir plus bas)

### Gros chantier → une epic

C'est un gros chantier si au moins un de ces critères est vrai : plusieurs sessions estimées, plusieurs
domaines touchés (scène, données, jeu, UI), ou des arbitrages produit à faire avec Dasco.
Exemples dans le backlog : « la ville vit » (passants, animations jour/nuit), mode histoire, parcours thématiques,
ouverture aux amis (back-end, partage de progression).

1. Rédiger la spec dans `docs/specs/epics/EP[XXX]-<nom>/` : `epic.md` (template `_TEMPLATE-EPIC.md`)
   + une fiche par user story (template `_TEMPLATE-USER-STORY.md`)
2. Faire valider la spec par Dasco avant de coder
3. (Quand les agents existeront) déléguer la planification → plan écrit dans `docs/tasks/`, le lire
4. Branche par user story : `feat/EP[XXX]-US[XXX]-<description>`
5. Chaque user story se déroule comme une itération (mêmes vérifications, même clôture)
6. Mettre à jour le statut des US dans `epic.md`

### Clôture d'une itération

- `FEATURES.md` : fonctionnalités livrées ou modifiées, date et numéro d'itération en tête
- `BACKLOG.md` : cocher, ajouter les retours et idées
- `CHANGELOG.md` : nouvelle entrée en tête, format habituel —
  **Retour / Demande de Dasco**, **Changements**, **Vérifié**, **Non vérifié**
- `DECISIONS.md` : une ligne par décision tranchée (date, décision, pourquoi, alternatives écartées) ;
  pour une décision structurante, un ADR détaillé dans `docs/architecture/decisions/` (template `_TEMPLATE-ADR.md`),
  référencé depuis le tableau
- `README.md` si une commande, un réglage ou la structure du code change

---

## Sub-agents — à définir

Principe conservé : **chercheur vs implémenteur**.
- Les sub-agents recherchent et planifient ; ils écrivent leur plan dans `docs/tasks/[nom-tâche]-plan.md` et n'implémentent jamais
- L'agent principal est le seul à écrire ou modifier du code

Les fichiers présents dans `agents/` viennent du template et ne sont pas adaptés au projet :
**ne pas leur déléguer de travail** tant que Dasco n'a pas défini les agents.

| Agent | Fichier | Expertise |
|-------|---------|-----------|
| *à définir* | | |

---

## Structure

```
CLAUDE.md                          ← ce fichier
agents/                            ← sub-agents (à définir)
docs/
├── context.md                     Vision, utilisateurs, stack, état (LIRE EN PREMIER)
├── onboarding/getting-started.md  Installer et lancer le projet
├── versions/
│   ├── FEATURES.md                Fonctionnalités livrées et leur état
│   ├── CHANGELOG.md               Journal des itérations
│   └── backlog/BACKLOG.md         À faire, par priorité
├── architecture/
│   ├── PERF-AUDIT.md              Audit de fluidité
│   └── decisions/
│       ├── DECISIONS.md           Index de toutes les décisions
│       └── _TEMPLATE-ADR.md
├── specs/
│   ├── _TEMPLATE-EPIC.md
│   ├── _TEMPLATE-USER-STORY.md
│   └── epics/                     Un sous-dossier par epic
├── tasks/                         Plans des sub-agents
└── api/                           Inutilisé (les formats de l'API sont dans contrat/, à la racine du dépôt)
```

Le code, lui, est décrit dans le README (section « Structure du code »).

---

## Git

```bash
git checkout -b feat/<sujet>                        # itération
git checkout -b feat/EP[XXX]-US[XXX]-<description>  # user story d'une epic
```

Commits conventionnels, en français :
```
feat(scope): description      # Nouvelle fonctionnalité
fix(scope): description       # Correction
docs: itération N (résumé)    # Clôture d'itération (commit séparé du code)
refactor(scope): description
chore(scope): description
```

---

## Checklist avant commit

- [ ] `npm run build` et `npm test` passent
- [ ] `city.json` régénéré si le script de données ou `diorama.config.json` a changé
- [ ] Fiches et positions sourcées (rien d'inventé)
- [ ] Pas de `console.log` de debug hors des outils `?debug` / dev
- [ ] Pas de secrets en dur
- [ ] Documents de suivi à jour (clôture d'itération)
