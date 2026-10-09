# Getting Started

Le détail complet (réglages, lieux, monuments, déploiement, dépannage) est dans le `README.md` à la racine.

## Prérequis

- Node.js 20+ (développement)
- Docker (optionnel, pour tester l'image de production)

Les données (`frontend/carte/public/data/city.json`, `frontend/carte/public/models/`) sont déjà dans le dépôt : pas besoin de les télécharger pour lancer le projet.

---

## Installation

```bash
git clone https://github.com/DascoRM/city-chambery.git
cd city-chambery
npm install
```

Pas de fichier `.env` : les seules variables utiles concernent la régénération des données (voir plus bas).

---

## Lancer le projet

```bash
# Développement — http://localhost:5173 (outil de placement + fiches brouillons)
npm run dev

# Production en local — http://localhost:4173
npm run build        # contrôles (types, frontières, API comme sur Vercel) puis construit dist/ (carte) et dist/admin/
npm run preview

# Production avec Docker (même image que Coolify, la carte seule) — http://localhost:3000
npm run docker:up
npm run docker:logs
npm run docker:down
```

### Développer avec l'API et l'administration

Trois terminaux :

```bash
ADMIN_TOKEN=un-jeton-local npm run api:dev   # l'API, http://localhost:8787/api/health (base locale PGlite sans DATABASE_URL)
npm run dev                                  # la carte, http://localhost:5173 (sert aussi /data/city.json à l'admin)
npm run dev:admin                            # l'administration, http://localhost:5174/admin/ (se connecter avec le jeton local)
```

La session d'administration est un cookie posé par l'API (EP010-US008) : rien à copier dans la page. Structure du dépôt :
`frontend/carte`, `frontend/admin`, `backend/src`, `contrat/` ([ADR-002](../architecture/decisions/ADR002-separer-front-et-back.md)).

---

## Commandes utiles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de développement |
| `npm run build` | Contrôles (types, frontières entre les parties) puis build de la carte et de l'administration |
| `npm test` | Tests Vitest : back (API), administration, contrat, carte, contrôles du dépôt |
| `npm run dev:admin` | Administration en dev (http://localhost:5174/admin/), avec `npm run api:dev` et `npm run dev` |
| `npm run preview` | Sert le build en local |
| `npm run data` | Télécharge OSM + hauteurs BD TOPO + relief RGE ALTI et écrit `frontend/carte/public/data/city.json` (1 à 2 min) |
| `npm run data -- --offline` | Reconstruit `city.json` depuis `frontend/carte/data/raw/`, sans réseau (≈ 10 s) — **après toute modification des scripts ou de `frontend/carte/diorama.config.json`** |
| `npm run nature` | Reconvertit les arbres du pack nature selon `frontend/carte/content/nature.json` |
| `npm run mascot` | Reconvertit l'éléphant mascotte |

Variables pour `npm run data` : `OVERPASS_URL` (autre serveur OSM), `NO_BDTOPO=1`, `NO_ALTI=1`.

---

## Dans l'application

- `?debug` dans l'adresse : compteur de performance et debug des éléphants
- Touche **P** (en dev) : outil de placement des lieux

---

## Premiers pas

1. Lire `.claude/docs/context.md` pour comprendre le projet
2. Lire le backlog : `.claude/docs/versions/backlog/BACKLOG.md`
3. Parcourir les décisions : `.claude/docs/architecture/decisions/DECISIONS.md`
4. Lire les specs en cours dans `.claude/docs/specs/epics/`
