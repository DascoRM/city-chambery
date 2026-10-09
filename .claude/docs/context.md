# Chambéry en diorama — Contexte

## Vision

Maquette 3D du centre historique de Chambéry, à explorer comme un petit jeu : on tourne autour du socle,
on clique sur les ✦ pour découvrir l'histoire des lieux, et le journal garde la trace des lieux découverts.
Le diorama est construit à partir de données ouvertes (OpenStreetMap, IGN) : vrais contours de bâtiments,
vraies hauteurs, vrai relief.

**Hypothèse testée par le POC :** *explorer un quartier en diorama et découvrir son histoire point par point,
c'est assez plaisant pour que mes amis y passent 10 minutes et en redemandent.*

---

## Utilisateurs cibles

| Persona | Description | Besoins principaux |
|---------|-------------|-------------------|
| Dasco | Créateur et PO du projet ; place les lieux, rédige/valide les fiches, teste chaque itération | Outils de dev (placement des lieux, `?debug`), itérations courtes, retours visibles vite |
| Amis testeurs | Premier public (session de test prévue avec 5 personnes), sur ordinateur ou téléphone | Prise en main immédiate, envie d'explorer, fluidité sur mobile |

---

## Périmètre

### Inclus (livré ou en cours — détail dans [FEATURES.md](versions/FEATURES.md))
- Diorama : relief IGN, 2 067 bâtiments OSM avec hauteurs BD TOPO, toits en pente, rues, Leysse, parcs et arbres modélisés
- Monuments en formes simples : fontaine des Éléphants, cathédrale, château des ducs, Carré Curial
- Ambiance : cycle jour/nuit à l'heure réelle, vraie course du soleil, saisons, fenêtres et lieux ouverts éclairés la nuit, effet maquette (tilt-shift)
- Exploration : 8 lieux d'histoire (dont lieux mystère), fiches sourcées, progression dans le navigateur
- Bars / cafés / restaurants OSM avec horaires
- Mini-jeu « Ramène les éléphants à la fontaine » + points
- Web desktop et mobile, mode hors-ligne (PWA)

### Hors scope (pour l'instant)
- Comptes de joueurs, progression partagée entre appareils ou entre amis : prévus par EP008 (back-end léger et administration), en pause pendant EP010
- Autres quartiers que le centre historique
- Mode histoire / parcours thématiques, curseur d'époques (backlog P3)

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | **Carte** (`frontend/carte/`) : Vite 8 + TypeScript 5.9 + Three.js 0.186, sans framework ; PWA via vite-plugin-pwa. **Administration** (`frontend/admin/`) : React 19, wouter, TanStack Query, React Hook Form ([ADR-002](architecture/decisions/ADR002-separer-front-et-back.md)) |
| Backend | API (`backend/src/`) : Hono + Zod + Drizzle sur fonctions Vercel, base PostgreSQL Neon ([ADR-001](architecture/decisions/ADR001-back-end-typescript-vercel-neon.md)) ; facultative : la carte marche sans elle |
| Données | Pipeline Node (`frontend/carte/scripts/`) : Overpass (OSM) + IGN BD TOPO + RGE ALTI + straight-skeleton → `frontend/carte/public/data/city.json` ; contenu éditorial dans `frontend/carte/content/*.json` |
| Stockage côté client | localStorage (progression, points, éléphants ramenés) |
| Modèles 3D | Pack nature Quaternius (CC0) et éléphant de jeremy (CC BY 3.0), convertis en .glb (glTF-Transform, meshoptimizer) |
| Infrastructure | **Vercel** : la carte, l'administration et l'API (prévisualisations `preview/**`, protégées) ; base PostgreSQL Neon. **Raspberry Pi 5 / Coolify** (pas encore déployé, gardé par principe) : image Docker Node → nginx avec **la carte seule** (`npm run build:pi`) |

### Contraintes
- Licences : ODbL (OSM), Licence Ouverte Etalab 2.0 (IGN), CC BY 3.0 (éléphant) → attributions affichées dans l'app
- Tests Vitest (`npm test`) pour l'API, l'administration et les contrôles du dépôt ; la carte se vérifie par `npm run build` (types, frontières) et le navigateur (`?debug`)
- Fluidité mobile : voir [PERF-AUDIT.md](architecture/PERF-AUDIT.md)

---

## Agents Claude disponibles

À définir (voir `.claude/CLAUDE.md`, section « Sub-agents »).

---

## État actuel

- [x] POC diorama, exploration et mini-jeu (itérations 1 à 37)
- [ ] EP008 — Back-end léger et administration (en pause pendant EP010 ; retouches des parkings livrées)
- [ ] EP010 — Séparer le front et le back, administration React, contrat, session par cookie (phases 1 et 2 livrées le 09/10, reste la vérification finale)
- [ ] P1 — Fiabiliser le POC (position des lieux, relecture des fiches, « la ville vit »)
- [ ] P1 — Fluidité (arbres par quartier, moins d'images à l'arrêt)
- [ ] Déploiement sur le Pi (Coolify) puis session de test avec les amis

Détail et priorités : [BACKLOG.md](versions/backlog/BACKLOG.md).

---

## Documents de suivi

À relire en début de session et à mettre à jour à chaque itération.

| Document | Contenu | Quand le mettre à jour |
|---|---|---|
| [versions/FEATURES.md](versions/FEATURES.md) | Fonctionnalités livrées, par domaine, avec leur état | Dès qu'une fonctionnalité est livrée ou modifiée |
| [versions/backlog/BACKLOG.md](versions/backlog/BACKLOG.md) | Ce qui reste à faire, par priorité | À chaque retour ou nouvelle idée |
| [versions/CHANGELOG.md](versions/CHANGELOG.md) | Journal des itérations (date, retours, changements, vérifié / non vérifié) | À la fin de chaque itération |
| [architecture/decisions/DECISIONS.md](architecture/decisions/DECISIONS.md) | Index des choix techniques et produit, avec leur justification | Quand on tranche une question |
| `architecture/decisions/ADR-XXX-*.md` | Détail d'une décision structurante ([template](architecture/decisions/_TEMPLATE-ADR.md)) | Décision qui engage l'architecture ou demande de comparer des options |
| [architecture/PERF-AUDIT.md](architecture/PERF-AUDIT.md) | Audit de fluidité chiffré | Après un chantier de performance |
| `specs/epics/` | Specs des gros chantiers (epics + user stories) | Avant de démarrer un gros chantier |
| `tasks/` | Plans produits par les sub-agents | Écrits par les agents, lus avant d'implémenter |
| [onboarding/getting-started.md](onboarding/getting-started.md) | Installer, lancer, régénérer les données | Quand une commande change |

`api/` (de ce dossier de docs) : inutilisé ; les formats de l'API sont dans `contrat/` à la racine du dépôt.

Légende des états : ✅ livré · 🟡 partiel / à améliorer · ⬜ à faire · ❓ question ouverte · ⏸ en attente

---

*Dernière mise à jour : 09/10/2026 (EP010, itération 87)*
