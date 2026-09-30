# Getting Started

Le détail complet (réglages, lieux, monuments, déploiement, dépannage) est dans le `README.md` à la racine.

## Prérequis

- Node.js 20+ (développement)
- Docker (optionnel, pour tester l'image de production)

Les données (`public/data/city.json`, `public/models/`) sont déjà dans le dépôt : pas besoin de les télécharger pour lancer le projet.

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
npm run build        # vérifie les types (tsc --noEmit) puis construit dist/
npm run preview

# Production avec Docker (même image que Coolify) — http://localhost:3000
npm run docker:up
npm run docker:logs
npm run docker:down
```

---

## Commandes utiles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production + vérification des types (seule vérification automatique : pas de tests ni de lint) |
| `npm run preview` | Sert le build en local |
| `npm run data` | Télécharge OSM + hauteurs BD TOPO + relief RGE ALTI et écrit `public/data/city.json` (1 à 2 min) |
| `npm run data -- --offline` | Reconstruit `city.json` depuis `data/raw/`, sans réseau (≈ 10 s) — **après toute modification des scripts ou de `diorama.config.json`** |
| `npm run nature` | Reconvertit les arbres du pack nature selon `src/content/nature.json` |
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
