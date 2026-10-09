# Chambéry en diorama — POC

Maquette 3D du centre historique de Chambéry, à explorer comme un petit jeu :
on tourne autour du socle, on clique sur les ✦ pour découvrir l'histoire des lieux,
et le journal garde la trace des lieux découverts. Le diorama est construit à partir
de données ouvertes (OpenStreetMap, IGN) : vrais contours de bâtiments, vraies hauteurs,
vrai relief (≈ 92 m de dénivelé, RGE ALTI).

**Hypothèse testée par le POC :** *explorer un quartier en diorama et découvrir son histoire
point par point, c'est assez plaisant pour que mes amis y passent 10 minutes et en redemandent.*

---

## Sommaire

1. [Démarrer](#démarrer)
2. [Commandes dans l'application](#commandes-dans-lapplication)
3. [D'où viennent les données](#doù-viennent-les-données)
4. [Réglages du diorama](#réglages-du-diorama)
5. [Gérer les lieux d'histoire](#gérer-les-lieux-dhistoire)
6. [Monuments modélisés](#monuments-modélisés)
7. [Arbres modélisés (pack nature)](#arbres-modélisés-pack-nature)
8. [Mascottes (les éléphants qui se promènent)](#mascottes-les-éléphants-qui-se-promènent)
9. [Outil de placement (mode dev)](#outil-de-placement-mode-dev)
10. [Rendu : ce qui se passe à l'écran](#rendu--ce-qui-se-passe-à-lécran)
11. [Structure du code](#structure-du-code)
12. [Déployer (Docker, Coolify, Vercel)](#déployer-docker-coolify-vercel)
13. [Dépannage](#dépannage)
14. [Limites connues](#limites-connues)
15. [Licences](#licences)
16. [Suivi du projet](#suivi-du-projet)

---

## Démarrer

Prérequis : **Node.js 20+** (développement) et/ou **Docker** (production). Les données
(`frontend/carte/public/data/city.json`, `frontend/carte/public/models/`) sont déjà dans le dépôt : pas besoin de les
télécharger pour lancer le projet.

### 1. Lancer en développement

```bash
npm install          # une fois, puis après chaque changement de package.json
npm run dev          # http://localhost:5173 (avec l'outil de placement et les brouillons)
```

### 2. Lancer la version de production

En local, sans Docker :

```bash
npm run build        # vérifie les types et construit le site dans dist/
npm run preview      # sert dist/ sur http://localhost:4173
```

Avec Docker (même image que sur Coolify, nginx sur le port 3000) :

```bash
npm run docker:up    # = docker compose up --build -d → http://localhost:3000
npm run docker:logs  # suivre les journaux du conteneur
npm run docker:down  # arrêter et supprimer le conteneur
```

Sur le Pi avec Coolify : voir [Déployer (Docker, Coolify)](#déployer-docker-coolify-vercel).

### 3. Régénérer les données (seulement si la carte doit changer)

```bash
npm run data                     # télécharge OSM + hauteurs BD TOPO + relief RGE ALTI (1 à 2 min)
npm run data -- --offline        # reconstruit depuis frontend/carte/data/raw/, sans réseau (≈ 10 s)
npm run nature                   # reconvertit les arbres du pack nature (après modification de nature.json)
```

### Toutes les commandes

| Commande | Rôle |
|---|---|
| `npm install` | Installe les dépendances. Après un changement de dépendances, commiter `package-lock.json` (sinon le build Docker échoue sur `npm ci`) |
| `npm run dev` | Carte : serveur de développement, http://localhost:5173 (avec l'outil de placement et les fiches brouillons) |
| `npm run dev:admin` | Administration (React) en développement : http://localhost:5174/admin/ ; lancer aussi `npm run api:dev` (l'API) et `npm run dev` (la carte, qui sert `/data/city.json`) |
| `npm run build` | Contrôles (types de chaque partie, chargement de l'API comme sur Vercel), puis build de la carte dans `dist/` (sans outil de placement ni brouillons) et de l'administration dans `dist/admin/` |
| `npm run check:boundaries` | Contrôle des frontières du dépôt (ADR-002) : la carte et l'administration ne s'importent pas, le front n'importe jamais le code de l'API, chaque partie a sa liste de paquets, pas de HTML brut dans l'administration (lancé par `npm run build`) |
| `npm run typecheck` | Types seulement : carte, administration, API (et l'API vue comme Vercel la compile) |
| `npm run build:pi` | Contrôles de la carte puis build de la carte seule : c'est ce que fait l'image Docker du Pi (ni API ni administration sur le Pi) |
| `npm run build:carte` / `npm run build:admin` | Build d'une seule partie (la carte vide `dist/` : construire l'administration après) |
| `npm run preview` | Sert le build de production en local |
| `npm run api:dev` | API en local (http://localhost:8787/api/health) ; `npm run dev` lui renvoie `/api` par un proxy |
| `npm test` | Tests (Vitest) : l'API (Node, base PGlite) et l'administration (React, DOM simulé par happy-dom) |
| `npm run db:generate` | Génère une migration SQL depuis `backend/src/db/schema.ts` (sans base) |
| `npm run db:migrate` | Applique les migrations : `DATABASE_URL_UNPOOLED=postgres://… npm run db:migrate` (jamais automatique au déploiement ; le nom d'hôte est affiché avant d'agir) |
| `npm run docker:up` | Construit l'image Docker et lance le conteneur en arrière-plan (http://localhost:3000) |
| `npm run docker:logs` | Affiche les journaux du conteneur en continu |
| `npm run docker:down` | Arrête et supprime le conteneur |
| `npm run data` | Télécharge tout (OpenStreetMap, hauteurs BD TOPO, relief RGE ALTI) et écrit `frontend/carte/public/data/city.json`. Les réponses brutes sont gardées dans `frontend/carte/data/raw/` |
| `npm run data -- --offline` | Reconstruit `city.json` depuis `frontend/carte/data/raw/`, sans réseau (≈ 10 s). À lancer après une modification des scripts ou de `frontend/carte/diorama.config.json` |
| `npm run data -- --offline --bdtopo` | Idem, mais retélécharge seulement les hauteurs BD TOPO |
| `npm run data -- --offline --relief` | Idem, mais retélécharge seulement le relief RGE ALTI |
| `npm run nature` | Convertit et simplifie les arbres du pack Quaternius (`frontend/carte/assets-src/` → `frontend/carte/public/models/nature/`) selon `frontend/carte/content/nature.json` |
| `npm run mascot` | Convertit l'éléphant mascotte (`frontend/carte/assets-src/Elephant by jeremy - 9J-cG39KYFC.glb` → `frontend/carte/public/models/mascotte/elephant.glb`) : mètres, 4,5 m de haut, trompe vers +X |
| `npm run check:streets` | Contrôle les noms de rues de `city.json` (texte identique à OSM, sur une voie du même nom, lisibles, un seul par rue, fichier à jour) ; sans modification, sortie 1 si une règle est violée |
| `npm run buildings` | Convertit les 2 pièces d'auvent du pack de bâtiments (`frontend/carte/assets-src/buildings` → `frontend/carte/public/models/buildings/details.glb`) selon `frontend/carte/content/buildings.json` : couleurs de la palette lues et écrites en couleurs de sommet, échelle en mètres |

Variables d'environnement utiles :

| Variable | Effet |
|---|---|
| `OVERPASS_URL=https://overpass.kumi.systems/api/interpreter` | Autre serveur OpenStreetMap si celui par défaut est saturé |
| `NO_BDTOPO=1` | Ne pas appeler le service BD TOPO (cache utilisé s'il existe, sinon hauteurs OSM ou estimées) |
| `NO_ALTI=1` | Ne pas appeler le service de relief (cache utilisé s'il existe, sinon interpolation BD TOPO) |

À la fin, `npm run data` affiche un bilan : nombre de bâtiments, combien ont une hauteur IGN,
source et dénivelé du relief, types de toits, et quels lieux d'histoire ont été retrouvés dans OSM.

---

## Commandes dans l'application

| Action | Souris | Tactile |
|---|---|---|
| Se déplacer | clic droit + glisser | glisser à un doigt |
| Tourner | glisser | tourner deux doigts (torsion) |
| Incliner la vue | glisser vers le haut / le bas | glisser deux doigts vers le haut / le bas |
| Zoomer | molette | pincer / écarter, ou double toucher (zoom vers l'endroit touché) |
| Remettre le nord en haut | clic sur la boussole (en bas à droite) | toucher la boussole (en haut à droite) |
| Découvrir un lieu | clic sur une gemme ✦ | toucher une gemme |
| Voir un bar / café / restaurant | survoler son épingle (la fiche s'affiche à côté) ; clic = la fiche reste ouverte | toucher l'épingle |
| Se promener avec un avatar (prototype EP005) | bouton **🚶 Balade** : un personnage rose apparaît à la fontaine, la caméra le suit ; **clic gauche** sur le sol = il y marche (tout droit à travers places et parcs quand rien ne gêne, sinon par les rues ; clic sur un ✦ = il marche jusqu'au lieu, la fiche s'ouvre à l'arrivée) ; clic droit glissé = déplacer la carte (suivi arrêté, bouton « Retrouver mon avatar ») ; boussole et légende masquées ; **🗺 Vue libre** pour sortir | toucher le sol pour marcher ; un doigt glissé = déplacer la carte ; deux doigts = zoomer, pivoter, incliner |
| Fermer une fiche | Échap, ✕ ou clic dans le vide | ✕ ou toucher dans le vide |
| Ramener un éléphant à la fontaine | le survoler le fait trotter plus vite ; clic = il sprinte quelques secondes ; **reclic pendant le sprint** = il file sur la fontaine (ça rate parfois) | le toucher le fait sprinter ; le retoucher pendant le sprint pour l'attraper |

Zoom maximum : 70 m du point visé (120 m avant). De près, la caméra reste à au moins 30 m au-dessus du sol pour ne pas entrer dans les toits ni dans les collines. Gestes à deux doigts : `frontend/carte/src/scene/touch.ts` ; réglages de la caméra : `frontend/carte/src/scene/stage.ts`.

En bas à gauche :
- **📜 Journal** : les lieux découverts (clic pour y voler) et les lieux mystère restants ;
- **☑ Bars ☑ Cafés ☑ Restaurants** : légende des couleurs ; chaque case affiche ou masque sa catégorie (épingles et halos de nuit). Une catégorie décochée apparaît grisée, et sa fiche ouverte se ferme ;
- **🕐 Heure** : par défaut l'heure réelle de Chambéry (**Direct**, en rouge), avec le vrai soleil du jour (↑ lever, ↓ coucher). Le curseur choisit une heure de 0 h à 24 h, **▶** fait défiler une journée en 2 minutes ; **Direct** revient à l'heure réelle. La nuit, seuls les bars, cafés et restaurants ouverts à cette heure s'allument (horaires OpenStreetMap ; un lieu sans horaires lisibles reste allumé) ;
- **🍂 Saison** : *Auto* suit la date du jour ; toucher pour passer à Printemps, Été, Automne, Hiver (feuillage et course du soleil de la saison) ;

Les noms des parcs et de la Leysse apparaissent en s'approchant. La progression est gardée
dans le navigateur (pas de compte) ; « Recommencer l'exploration » dans le journal la remet à zéro.

---

## D'où viennent les données

Tout est calculé par `npm run data` (script `frontend/carte/scripts/fetch-osm.mjs`), puis figé dans
`frontend/carte/public/data/city.json` : l'application ne fait aucun appel réseau vers ces services.

| Donnée | Source | Détail |
|---|---|---|
| Bâtiments (contours), rues, chemins, rivière, parcs, arbres, bars/cafés/restaurants, noms | **OpenStreetMap** via l'API Overpass | Projetés en mètres autour du centre du socle, découpés au carré du diorama. Trottoirs séparés ignorés ; tronçons couverts (tunnel) ignorés, sauf les cours d'eau listés dans `showCoveredWater` |
| Hauteur des bâtiments | **IGN BD TOPO** (couche `BDTOPO_V3:batiment`, service WFS de la Géoplateforme) | Chaque bâtiment OSM est associé au bâtiment BD TOPO qui recouvre le plus son emprise (36 points testés, au moins un tiers). On prend la hauteur à la gouttière (`hauteur`) et la hauteur du toit (`altitude_maximale_toit − altitude_minimale_sol`). ≈ 1 960 bâtiments sur 2 067 ; les autres gardent la hauteur OSM ou une estimation (3 à 5 niveaux) |
| Relief du terrain | **IGN RGE ALTI** (service de calcul altimétrique, ressource `ign_rge_alti_wld`) | Grille d'altitudes au pas de 10 m (≈ 15 500 points, par lots de 150, moins de 4 requêtes/s). **Repli** si le service est injoignable : interpolation des altitudes de sol des bâtiments BD TOPO (moins précis : jusqu’à ≈ 40 m d’écart sur les collines). ≈ 92 m de dénivelé sur l’emprise |
| Forme des toits | Tag OSM `roof:shape` quand il existe (≈ 3 %), sinon calculée | Voir [Rendu](#rendu--ce-qui-se-passe-à-lécran) |
| Textes des lieux | Rédigés à la main (`frontend/carte/content/pois.json`) | Chaque fiche cite ses sources |

Caches dans `frontend/carte/data/raw/` (non versionnés) : `overpass.json`, `bdtopo.json`, `terrain.json`.
Supprimer un fichier force son retéléchargement au prochain `npm run data`.

---

## Réglages du diorama

`frontend/carte/diorama.config.json` (relancer `npm run data -- --offline` après modification ; si l'emprise
change, relancer `npm run data` complet) :

| Clé | Rôle |
|---|---|
| `bbox` | Emprise du socle (sud, ouest, nord, est, en degrés) |
| `defaultLevelHeight` | Hauteur d'un étage pour les hauteurs estimées (m) |
| `terrainStep` | Pas de la grille de relief (m). Plus petit = plus fin mais plus de points à télécharger |
| `terrainExaggeration` | Exagération verticale du relief (1 = réel, 1.5 = plus marqué) |
| `streetNames` | Noms de rues au sol : `skipKinds` (types de voies sans nom : pistes cyclables, sentiers, desserte), `minLength` (m), `minSize` / `maxSize` / `sizeOfWidth` (hauteur des lettres), `maxBend` (écart toléré au bord droit), `gap` (distance max entre tronçons d'une même rue) |
| `showCoveredWater` | Cours d'eau dessinés même là où ils sont couverts (nom OSM). Par défaut `["La Leysse"]` : la rivière passe sous les boulevards du centre, mais on l'affiche pour la lisibilité. `[]` = fidèle au terrain |

---

## Gérer les lieux d'histoire

Les fiches sont dans `frontend/carte/content/pois.json` :

```json
{
  "id": "elephants",
  "title": "Fontaine des Éléphants",
  "era": "1838",
  "category": "monument",
  "osm": { "match": "fontaine des elephants", "prefer": { "amenity": "fountain" } },
  "pos": [200.7, 69.7],
  "summary": "Une phrase d'accroche.",
  "story": "Le récit, 4 à 5 phrases.",
  "anecdote": "Le « Le saviez-vous ? » (optionnel).",
  "sources": [{ "label": "Wikipédia — …", "url": "https://…" }]
}
```

Position d'un lieu, dans cet ordre :
1. `pos` s'il est renseigné (mètres depuis le centre du socle : x vers l'est, y vers le nord) ;
2. sinon l'élément OpenStreetMap dont le nom contient `osm.match` ; `osm.prefer` départage
   plusieurs candidats (ex. `{ "amenity": "fountain" }`). ⚠️ Un nom peut être porté par un élément
   sans rapport (ex. une station d'autopartage « Carré Curial ») : vérifier avec l'outil de placement.

La gemme se pose automatiquement sur le relief. `"draft": true` = fiche brouillon (visible en dev,
masquée en production). Chaque fait d'une fiche doit venir d'une source citée dans `sources`.

---

## Monuments modélisés

Déclarés dans `frontend/carte/content/models.json` :

```json
{ "id": "fontaine-elephants", "poi": "elephants", "source": "procedural:fontaine-elephants", "rotation": 37, "scale": 1.3, "hideOsm": [] }
```

| Clé | Rôle |
|---|---|
| `source` | `procedural:<nom>` (formes générées en code, `frontend/carte/src/scene/models/`) ou `models/<fichier>.glb` (export Blender dans `frontend/carte/public/models/`, voir le README de ce dossier) |
| `poi` / `pos` | Position : celle du lieu `poi`, ou `pos` [x, y] en mètres. `pos [0, 0]` = modèle construit en coordonnées absolues (sur des contours OSM) |
| `rotation`, `scale` | Degrés (0 = vers l'est) ; 1 = taille réelle |
| `hideOsm` | Identifiants OSM des bâtiments masqués sous le monument |

| Monument | Construit à partir de | Principales hypothèses |
|---|---|---|
| Fontaine des Éléphants | Bassin de 13 m (OSM), hauteur 17,65 m et statue 2,82 m (Wikipédia) | Proportions à l'œil, agrandie ×1,3, orientation |
| Cathédrale Saint-François-de-Sales | Contour OSM ; nef 23 m sous voûtes, bas-côtés, abside, clocher au nord (Wikipédia) ; façade côté place Métropole | Position et hauteur du clocher, largeur de nef, toits |
| Château des ducs de Savoie | 7 contours OSM nommés (3 tours, Sainte-Chapelle, Porterie, aile du Midi, Conseil départemental) ; côté esplanade, clôture sur le bord du jardin du château (OSM), portail là où l'allée de service entre (OSM), escalier sur son tracé OSM (`chateau-grille.ts`) | Hauteurs et toits (`CHATEAU_PARTS` dans `chateau.ts`) ; tour Yolande absente ; tracé exact, hauteurs et dessin de la grille et du portail, marches (le relief au pas de 10 m ne montre pas la montée de l'escalier) |
| Carré Curial (+ médiathèque accolée) | Contours OSM (Carré avec sa cour, médiathèque way 209429258) ; gouttière 16,7 m et toit 5,4 m (BD TOPO) ; caserne de 1801-1805 autour d'une cour (Wikipédia) ; médiathèque : gouttière 18,3 m, toit plat (BD TOPO) | Étages, fenêtres, couleurs, aspect de la médiathèque |

Tous les monuments suivent le relief et sont mis en lumière la nuit (`frontend/carte/src/scene/models/lighting.ts`).

---

## Arbres modélisés (pack nature)

Dans les parcs et le long de la Leysse, les arbres simples sont remplacés par des arbres low-poly
du pack **Ultimate Nature Pack de Quaternius** (licence CC0 : domaine public). Les emplacements ne
changent pas (arbres OSM + arbres semés) : seule la forme change. **Les rues gardent les arbres
simples.** Si un modèle ne se charge pas, la zone garde ses arbres simples.

| Endroit | Mélange | Contenu |
|---|---|---|
| Jardin botanique des Senteurs | `botanique` | Arbres classiques, bouleaux, pins et **saules** (le seul endroit avec des saules) |
| 16 parcs et squares nommés (Verney, Esplanade du Château, Clos Savoiroux, Buttet du Bourget, Calamine…) | `parc` | Surtout des arbres classiques, un peu de bouleaux, quelques pins (≈ 9 %) |
| Bords de la Leysse (arbres à moins de 15 m de la berge) | `berges` | Bouleaux uniquement |

Environ 880 arbres modélisés, avec 18 modèles. Le mélange d'essences est un choix de style, pas
l'inventaire réel : dans OSM, seuls 2 arbres sur 1 575 ont une espèce et 197 un type de feuillage.

Tout se règle dans `frontend/carte/content/nature.json` :

```json
{
  "mixes": {
    "berges": { "scale": [2.6, 3.2], "models": { "BirchTree_1": 1, "BirchTree_2": 1 } }
  },
  "zones": [
    { "mix": "parc", "areas": ["Parc du Verney", "Square Pasteur"] },
    { "mix": "berges", "water": "La Leysse", "distance": 15 }
  ]
}
```

| Clé | Rôle |
|---|---|
| `mixes.<nom>.models` | Modèles et leur poids (tirage déterministe : le même arbre au même endroit à chaque chargement) |
| `mixes.<nom>.scale` | Plage d'échelle ; les arbres du pack mesurent 2,4 à 4,9 unités, donc ×3 ≈ 7 à 15 m |
| `zones[].areas` | Noms exacts des espaces verts OSM (voir `areas` dans `city.json`) |
| `zones[].water` + `distance` | Arbres à moins de `distance` mètres de la berge d'un cours d'eau (nom OSM, ex. « La Leysse ») |
| Ordre des zones | Un arbre prend la **première** zone qui le contient |

**Ajouter un modèle ou un parc :**

1. Ajouter la zone, le mélange ou le modèle dans `frontend/carte/content/nature.json`.
2. `npm run nature` : convertit les `.obj` cités dans les mélanges, avec leurs variantes d'automne (`_Autumn_n`) et d'hiver (`_Dead_n`) pour les familles listées dans `seasons` (rangés dans `frontend/carte/assets-src/quaternius-nature/obj/<catégorie>/`) en `.glb` dans `frontend/carte/public/models/nature/` (≈ 10 à 25 Ko par arbre).
3. Recharger la page.

La conversion remplace les couleurs du pack, plus sombres, par la palette du diorama (`RECOLOR` dans
`frontend/carte/scripts/convert-nature.mjs`) et ne garde qu'un maillage à facettes avec une couleur par sommet.
Elle **simplifie** aussi les modèles (meshoptimizer), réglé par `simplify` dans `nature.json` :
`ratio` = part des triangles gardés (0,5 = la moitié), `error` = écart de forme toléré. Pour
revenir aux modèles complets, retirer `simplify` puis relancer `npm run nature`. Après la mise à
jour, lancer `npm install` une fois (nouvelles dépendances de conversion).

Sources du pack : `frontend/carte/assets-src/quaternius-nature/` (`obj/`, rangés en `arbres`, `rochers`,
`vegetation`, `bois`). Cactus, palmiers, maïs et blé ont été retirés (hors sujet pour Chambéry).
Les `.blend` d'origine ont été supprimés (pack retéléchargeable sur quaternius.com).

---

## Mascottes (les éléphants qui se promènent)

Quatre éléphants se promènent dans le diorama, **uniquement sur les rues et chemins** d'OpenStreetMap. Réglages dans
`frontend/carte/content/mascot.json`, code dans `frontend/carte/src/scene/mascot.ts`.

- **Chemin** : les voies OSM forment un graphe (les voies qui se croisent partagent leurs points). L'éléphant
  va de point en point le long des segments ; il ne coupe jamais à travers un bâtiment ou un parc.
  À chaque carrefour, il choisit au hasard, en préférant aller tout droit et les rues piétonnes (`preferKinds`).
  Il part de la fontaine des Éléphants (`start`) et y revient peu à peu quand il s'en éloigne de plus de
  `roamRadius` mètres.
- **Voies retirées** : escaliers (`excludeKinds`) ; tronçons sous un bâtiment (passages couverts) ; tronçons à
  moins de `clearance` mètres d'une façade (trottoirs le long des murs, pour qu'il ne rentre pas dedans) ;
  cercle `avoid` de 15 m autour de la fontaine (le bassin du modèle déborde sur le chemin OSM). Il reste ≈ 53 km de voies.
- **Rythme** : `speed` en m/s, pauses de `pauseSeconds` toutes les `walkSeconds` secondes.
- **Animation** : le modèle est statique (ni squelette, ni animation). Les pattes (marche en quatre temps),
  la trompe, les oreilles et la queue sont animées **dans le shader**, d'après la position des sommets.
  Les seuils sont ceux du modèle converti ; un autre modèle demanderait de les reprendre (`WALK_GLSL`).
- **Ombre** : une tache sombre sous lui (les ombres de la scène ne sont recalculées que quand le soleil bouge).
- **Modèle** : « Elephant » par jeremy, [Poly Pizza](https://poly.pizza/m/9J-cG39KYFC), CC BY 3.0. Source dans
  `frontend/carte/assets-src/` (le `.glb` et l'`.obj` d'origine), converti par `npm run mascot`.

### Mini-jeu « Ramène les éléphants à la fontaine »

Les quatre éléphants de la fontaine se sont échappés : au départ, la fontaine n'a plus ses éléphants,
et quatre éléphants se promènent dans les rues (entre 80 et 300 m de la fontaine, `game.startDistance`).

- **Sursaut** : la souris sur un éléphant le fait sursauter et trotter plus vite (`startleSpeed`, 3,5 m/s,
  pendant `startleSeconds`) : il faut le rattraper pour cliquer.
- **Sprint** : cliquer sur un éléphant (ou le toucher) le fait détaler `sprintSeconds` (3,5 s) à `sprintSpeed` (9 m/s, contre
  1,4 m/s à la promenade), en se moquant de vous dans une bulle (`game.taunts`, `bubbleSeconds`) qui le suit. Puis il
  s'arrête et souffle quelques secondes (`pauseSeconds`) avant de reprendre sa promenade : un nouveau clic le relance.
  (Itération 65 : plus de disparition, d'indice de direction, d'épuisement ni de nombre de fuites : le jeu demandait
  trop de clics et de recherches.)
- **Ramené** : un **2e clic pendant le sprint** l'attrape avec la probabilité `catchChance` (0,6) ; sinon il se moque (`missTaunts`) et continue de courir. Attrapé, il s'envole jusqu'à sa place ; la caméra suit, il se
  change en bronze en sortant du socle, gerbe d'étincelles et petit feu d'artifice. `points` (10) par
  éléphant, plus `bonus` (20) quand la fontaine est complète, avec un grand feu d'artifice.
- **Nouvelle partie** : `restartSeconds` (45 s) après la fontaine complète, les éléphants s'échappent de
  nouveau.
- **Sauvegarde** : éléphants ramenés (`frontend/carte/src/state/herd.ts`) et points (`frontend/carte/src/state/points.ts`) gardés dans
  le navigateur, comme les lieux découverts. « Recommencer l'exploration » ne touche ni l'un ni l'autre.
- **Compteur** : « 🐘 N points · ⛲ n / 4 » sous la progression.
- Code : `frontend/carte/src/game/hunt.ts` (règles, bulle, score), `frontend/carte/src/scene/mascot.ts` (troupeau, états, animations),
  `frontend/carte/src/scene/particles.ts` (fumée, étincelles, feux d'artifice), places sur la fontaine :
  `elephant-0` à `elephant-3` dans `frontend/carte/src/scene/models/elephants.ts`.

## Outil de placement (mode dev)

Disponible uniquement avec `npm run dev`.

1. Appuie sur **P** ou sur le bouton **📍 Placement** (en haut à droite).
2. Clique sur la carte : une épingle rose se pose (sur le relief) et le panneau affiche `pos` et les coordonnées GPS, chacun avec un bouton **Copier**.
3. Dans **Affecter à**, choisis un lieu : sa gemme se déplace sur l'épingle. Reclique ailleurs pour ajuster.
4. **Enregistrer dans pois.json** écrit la position dans le fichier ; la page se recharge en gardant la vue et l'outil ouvert.
5. Nouveau lieu : **➕ Nouveau lieu…**, tape le titre (l'identifiant se remplit tout seul), enregistre. La fiche est créée en brouillon (« À rédiger ») : complète-la dans `pois.json`, puis retire `"draft": true`.

Quand l'outil est actif, les clics n'ouvrent plus les fiches. **P** à nouveau pour le fermer.
En production, ni le code de l'outil ni l'endpoint `/__dev/poi` du serveur Vite n'existent.

---

## Rendu : ce qui se passe à l'écran

- **Socle** : sol en relief (maillage suivant la grille d'altitudes), bords qui épousent le profil du terrain (bande d'herbe + strates de terre), plinthe en bois. Parcs, places et plans d'eau sont peints sur une texture du sol ; rues, berges, rivière et ponts sont des rubans drapés sur le relief : un ruban est découpé le long des arêtes du sol là où il s'en écarterait de plus de 6 cm (`ribbons()` dans `frontend/carte/src/scene/city.ts`), si bien que le terrain ne traverse pas les chaussées.
- **Bâtiments** : contours OSM extrudés, posés sur le point le plus bas du terrain sous leur emprise. Couleurs pastel stables (dérivées de l'identifiant OSM).
- **Toits** (décidés par `frontend/carte/scripts/roofs.mjs`) : emprise quasi rectangulaire → deux pans, quatre pans ou pyramide ; forme irrégulière, en L, avec cour → toit à pans par *squelette droit* (librairie `straight-skeleton`) ; plats pour garages, abris, très grandes surfaces sans toit mesuré par BD TOPO. La hauteur du toit vient de BD TOPO quand elle existe.
- **Eau** : matériau brillant animé, berges en pierre.
- **Arbres** : ceux d'OSM + quelques-uns semés dans les parcs ; arbres modélisés (pack Quaternius) dans les parcs et le long de la Leysse (`nature.json`) ; les rues gardent les arbres simples.
- **Ombres** : calculées une fois au chargement, puis seulement quand le soleil bouge (curseur d'heure, lecture ▶), pas à chaque image. Les gemmes et les épingles, qui bougent, ne projettent pas d'ombre.
- **Fenêtres et portes** : la façade de chaque bâtiment porte une grille de fenêtres (3 m × 3,2 m), vitre bleu ciel avec encadrement crème le jour, allumées en partie la nuit selon l'heure (`windows.litCurve` de `life.json` : la ville rentre le soir, s'endort, se réveille vers 7 h ; les éteintes redeviennent sombres) ; des portes brunes au rez-de-chaussée des murs côté rue (à moins de 9 m d'une voie, jamais sur un mur mitoyen). Tout est calculé dans le shader des façades (`frontend/carte/src/scene/city.ts`) : décor, pas un relevé des vraies fenêtres.
- **Jour / nuit** : soleil (lever 6 h, coucher 18 h), crépuscule, lune ; la nuit, fenêtres éclairées (calculées dans le shader), lueur des rues, bars/clubs/restaurants mis en avant par un halo.
- **Bars, cafés, restaurants** : une épingle 3D (pointeur de carte) par lieu OSM, colorée par catégorie : violet = bar (bar, pub, biergarten, boîte de nuit), bleu = café (café, glacier), orange = restaurant (`PLACE_CATEGORIES` dans `frontend/carte/src/scene/palette.ts`). L'épingle est posée sur le toit du bâtiment qui contient le point OSM (161 lieux sur 169 sont à l'intérieur d'un bâtiment), sinon au sol. Au survol, l'épingle rebondit et grossit, et une fiche apparaît à côté (catégorie, nom avec un petit rebond, cuisine, horaires OSM avec les jours en français). La fiche suit l'épingle quand la caméra bouge ; sur mobile, elle s'ouvre au toucher, au-dessus de l'épingle.
- **Noms de rues** : peints à plat sur la chaussée, dans le sens de la rue, en majuscules (Inter) ; un nom par rue, sur sa partie la plus droite (`frontend/carte/scripts/street-names.mjs`, 182 noms). Invisibles en vue d'ensemble, ils apparaissent en fondu entre 320 m et 200 m de la caméra (`frontend/carte/content/streets.json`), rien n'est construit ni dessiné au-delà. Lettres en champ de distance (un atlas de 33 lettres, 2 Mo) : nettes à tous les zooms, toujours à l'endroit quel que soit le cap de la caméra (le nom se retourne de 180°), posées sur la chaussée ; un seul maillage : +1 appel de rendu. Cachés par les bâtiments comme tout objet du sol : dans une rue étroite, on les voit sous un angle oblique le long de la rue.
- **Écran initial et lobby** : `index.html` affiche tout de suite un écran de chargement (sans ressource externe), puis le lobby apparaît pendant que la ville charge (barre à étapes réelles : `frontend/carte/src/ui/loading.ts`, appelée dans `main()`). Il présente les lieux d'histoire, le mini-jeu et les ambiances ; « Explorer la carte » s'active quand la ville est prête. Le diorama vivant tourne doucement derrière un voile (cadence au repos). Textes dans `frontend/carte/content/lobby.json` (`{lieux}` et `{elephants}` sont remplacés par les nombres des données). Case « Ne plus afficher cet écran » mémorisée dans le navigateur ; le bouton « ? » de la carte le rouvre. Adresse : `?lobby=0` saute le lobby, `?lobby=1` le force, `?debug` le saute.
- **Effet maquette** : flou tilt-shift en post-traitement, toujours actif (plus d'interrupteur), bande nette sur le point visé ; les noms restent nets. Le flou est calculé en demi-résolution (`frontend/carte/src/scene/tiltshift.ts`).
- **Résolution** : densité de pixels plafonnée à 1,5, puis baissée automatiquement si les images/s chutent sous 40 pendant les mouvements (`frontend/carte/src/scene/quality.ts`).
- **Cadence** : 30 images/s quand rien ne bouge ; pleine vitesse quand la caméra bouge (et 0,5 s après), quand la souris bouge sur la carte, pendant la lecture ▶ et les animations du mini-jeu. Un module de la boucle le signale par `moving()` (`Ticker`, `frontend/carte/src/types.ts`).
- **Dire où se trouve quelque chose** : avec `?debug`, le bouton **📍 Position** (ou la touche P) permet de cliquer sur la carte : la position (mètres du diorama), le bâtiment OSM, le parking et la rue les plus proches s'affichent et un extrait `{ "pos": [x, y] }` est copié, à coller dans la conversation ou dans `pois.json` / `parkings.json` (code : `frontend/carte/src/dev/position-picker.ts`, présent en production avec `?debug` ; le grand outil de placement `placement.ts` reste réservé à `npm run dev`).
- **Mesurer la fluidité** : ajouter `?debug` à l'adresse (ex. `http://localhost:3000/?debug`) affiche images/s, pire image, mode (« repos (30 max) » ou « mouvement »), appels de rendu, triangles et densité, ainsi que le **debug des éléphants** : un faisceau coloré au-dessus de chacun (bleu : se promène, jaune : épuisé ; visible à travers les bâtiments) et un panneau avec leur état, leurs fuites restantes et leur distance à la fontaine ; « Voir » y amène la caméra, « Épuiser » le fait réapparaître épuisé. Le code de ce debug n'est téléchargé qu'avec `?debug`. Dans la console, `window.diorama` (scène, caméra, horloge, troupeau…) existe en dev et avec `?debug`, pas en production.

---

## Structure du code

```
frontend/
  carte/                   LA CARTE : diorama Three.js + OSM / IGN, avec tout son pipeline de données (chemins ci-dessous
                           relatifs à frontend/carte/ ; le reste du README les cite en entier)
    index.html             Page de la carte (écran de chargement sans ressource externe)
    vite.config.ts         Config Vite : racine = ce dossier, sortie dans dist/ à la racine du dépôt ; endpoint dev /__dev/poi (écrit content/pois.json)
    tsconfig.json          Config TypeScript de la carte (npm run build)
    diorama.config.json    Emprise, hauteur d'étage, pas et exagération du relief

    scripts/
      fetch-osm.mjs            Pipeline : OSM → projection → découpage → BD TOPO → relief → toits → city.json
      bdtopo.mjs               Hauteurs IGN BD TOPO (téléchargement WFS + association aux bâtiments OSM)
      terrain.mjs              Relief RGE ALTI (ou interpolation BD TOPO)
      roofs.mjs                Choix du toit de chaque bâtiment
      geo.mjs                  Géométrie 2D des scripts (point dans un polygone, distance à un segment)
      street-names.mjs         Emplacement du nom de chaque rue (partie la plus droite) → `streetLabels` de city.json
      check-street-labels.mjs  Contrôle des noms de rues (npm run check:streets)
      convert-nature.mjs       Pack nature : .obj → .glb (npm run nature)
      convert-mascot.mjs       Éléphant mascotte : mise à l'échelle et orientation (npm run mascot)
      convert-buildings.mjs    Auvents du pack de bâtiments → public/models/buildings/details.glb (npm run buildings)
      lib/kenney-obj.mjs       Lecture des .obj du pack (palette PNG lue par les UV) et de sa texture

    content/
      pois.json            Fiches d'histoire
      models.json          Monuments modélisés
      nature.json          Arbres modélisés : mélanges et zones
      mascot.json          Mascotte : modèle, vitesse, voies autorisées, zones interdites
      avatar.json          Balade avec un avatar (EP005) : réglages du chemin (distance d'accrochage, dernier mètre, arrondi des angles)
      parkings.json        Parkings (EP006) : textes des fiches et retouches manuelles (overrides, added), appliquées au chargement
      life.json            La ville vit : passants (nombre, rayon, taille, vitesse, pauses, voies, courbe horaire, groupes) et fenêtres allumées selon l'heure
      buildings.json       Auvents : pièces du pack, échelle, décalages, réglages de pose
      place-hours.json     Horaires PROVISOIRES (fictifs) des bars, pubs et boîtes de nuit, pour l'éclairage de nuit

    src/
      main.ts              Assemblage : scène, calques, fiches, boucle de rendu (liste de modules)
      interaction.ts       Clic, survol, double toucher, gestes à deux doigts
      types.ts             Types des données (city.json, lieux, monuments)
      scene/stage.ts       Renderer, caméra « maquette », lumières, contrôles, boussole (cap, retour au nord)
      scene/touch.ts       Gestes tactiles à deux doigts (pincer, tourner, incliner)
      scene/terrain.ts     Relief : maillage du sol, altitude en tout point, bords du socle
      scene/city.ts        Rues, eau, bâtiments, arbres (posés sur le relief)
      scene/geo.ts         Géométrie 2D commune + rayon depuis un point de l'écran (screenRay)
      scene/roads.ts       Voies piétonnes et hauteur des rubans de voies (partagées)
      scene/walkways.ts    Réseau des voies où l'on marche (éléphants, passants, avatar)
      scene/parkings.ts    Panneaux « P » de la couche Parkings (EP006), posés au sol ou sur le toit (souterrains, silos)
      scene/parking-edits.tsRetouches manuelles des parkings (parkings.json), validées et appliquées au chargement
      scene/avatar.ts      Avatar de la balade (EP005) : silhouette des passants ×2, tache au sol, anneau d'arrivée, marche le long du chemin
      scene/cutaway.ts     Effacement des bâtiments et monuments qui masquent l'avatar (balade) : test caméra → avatar, texture de facteurs, tramage
      scene/avatar-path.ts Chemin de l'avatar (EP005) : accrochage au réseau, A*, angles arrondis, dernier mètre
      scene/roofs.ts       Dessin des toits
      scene/markers.ts     Gemmes des lieux + épingles 3D et halos des bars, cafés, restaurants
      scene/labels.ts      Noms des parcs et cours d'eau
      scene/street-names.tsNoms de rues peints au sol (un maillage, une texture), visibles seulement en zoomant
      ui/lobby.ts          Lobby de démarrage : accueil posé sur la ville vivante (textes dans content/lobby.json)
      ui/parking-card.ts   Contenu de la fiche d'un parking : chaque chiffre dit d'où il vient (OSM, estimé, inconnu)
      ui/loading.ts        Progression du chargement : écran initial de index.html, puis barre du lobby
      state/lobby.ts       Case « Ne plus afficher cet écran » (localStorage)
      scene/daynight.ts    Cycle jour/nuit
      scene/tiltshift.ts   Effet maquette (flou en demi-résolution)
      scene/quality.ts     Résolution adaptative (densité de pixels selon les images/s)
      ui/perfhud.ts        Compteur de performance (?debug)
      dev/position-picker.tsOutil de position (?debug) : clic = position copiée, bâtiment, parking et rue proches
      dev/herd-debug.ts    Debug des éléphants : faisceaux et panneau (?debug)
      pwa.ts               Mode hors-ligne : service worker, bandeau « nouvelle version »
      dataurl.ts           Adresses des données avec leur version (?v=)
      scene/models.ts      Chargement et placement des monuments
      scene/nature.ts      Arbres modélisés dans les parcs
      scene/mascot.ts      Mascotte : promenade sur le réseau des voies, marche dans le shader
      scene/flags.ts       Drapeaux de la Savoie sur le château et l'hôtel de ville, qui ondulent au vent
      scene/chimneys.ts    Cheminées sur les toits et fumée selon la saison (rien l'été), qui dérive avec le vent
      scene/birds.ts       Pigeons sur les places et oiseaux au-dessus des monuments (de jour), faits en code
      scene/people.ts      Passants : silhouettes instanciées qui marchent sur les voies, autour du point regardé
      scene/facades.ts     Auvents des bars, cafés et restaurants (pièces du pack de bâtiments, couleur de la catégorie)
      scene/models/        Monuments générés en code + éclairage de nuit et mesh() partagés
      ui/ui.ts             HUD, fiche, journal, toasts, contrôles
      state/progress.ts    Progression et préférences (localStorage)
      state/points.ts      Points du mini-jeu (localStorage)
      state/herd.ts        Éléphants ramenés sur la fontaine (localStorage)
      game/balade.ts       Mode balade (EP005) : entrée / sortie, caméra qui suit, limites de zoom, ordres de marche
      game/hunt.ts         Mini-jeu « Ramène les éléphants » : cache-cache, bulle, retour, score
      game/setup.ts        Mise en place du mini-jeu : sauvegarde, places sur la fontaine, particules
      scene/particles.ts   Fumée, étincelles, feux d'artifice
      dev/placement.ts     Outil de placement (chargé seulement en dev)

    public/data/city.json  Données générées (ne pas modifier à la main)
    public/models/         Fichiers glTF des monuments (export Blender)
    public/models/nature/  Arbres du pack nature convertis (.glb)
    public/models/mascotte/Éléphant mascotte converti (.glb)
    public/icons/          Icônes de l'appli (mode hors-ligne, écran d'accueil)
    assets-src/            Sources des modèles (pack Quaternius en .obj), pas servies par le site
    data/raw/              Caches des téléchargements (non versionnés)

  admin/                   L'ADMINISTRATION : React 19, wouter (adresses en #/…), TanStack Query, React Hook Form ; servie sous /admin/
    index.html             Page de l'administration
    vite.config.ts         Base /admin/, sortie dans dist/admin/ (construite après la carte : hors de son service worker)
    tsconfig.json          Config TypeScript de l'administration (JSX)
    src/api.ts             Seul accès à l'API : jeton de session, erreurs traduites en français
    src/auth.tsx           Connexion, déconnexion, retour à la connexion si le jeton est refusé
    src/pages/             Login, Dashboard (état de l'application et de la base), Parkings (retouches, ajouts, journal)
    src/types.ts           Formats des réponses de l'API (provisoire : passeront dans contrat/, EP010-US007)
    src/**/*.test.ts(x)    Tests de l'administration (npm test)

api/index.ts               Point d'entrée imposé par Vercel (EP008) : /api/* y est réécrit (vercel.json), routé par backend/src/app.ts
backend/
  src/                     L'API (Hono, Zod, Drizzle) : app.ts (routes), env.ts (base et environnement), auth.ts (jeton d'administration, limite d'essais), parkings.ts (retouches), db/ (schéma, migrations, connexion, statistiques), dev.ts (serveur local) ; deviendra backend/ (EP010 phase 2)
  data/dev-db/             Base locale de l'API en dev (PGlite, non versionnée)
scripts/check-api-esm.mjs  Contrôle du dépôt : l'API se charge comme sur Vercel (lancé par npm run build)
scripts/check-boundaries.mjs  Contrôle du dépôt : frontières entre carte, administration et API (lancé par npm run build)
deploy/                    Docker / nginx ; refresh-data.sh régénère les données pendant le build Docker
dist/                      Sortie du build : la carte, et l'administration dans dist/admin/ (Vercel) ; l'image du Pi ne contient que la carte
.claude/                   Consignes pour Claude (CLAUDE.md) et suivi du projet (docs/)
```

Choix techniques : **Three.js** plutôt qu'une librairie de cartographie (rendu diorama plus
simple à maîtriser en scène 3D pure) ; **pas de backend** : tout est statique, hébergeable
n'importe où (Coolify sur le Pi, Netlify, GitHub Pages…) avec `npm run build`.
Le détail des choix est dans [`.claude/docs/architecture/decisions/DECISIONS.md`](.claude/docs/architecture/decisions/DECISIONS.md).

---

## Branches et déploiements Vercel

Pour ne pas publier à chaque branche (quota Vercel Hobby : 100 déploiements par jour, canceled compris) et garder une production sûre, `vercel.json` (`git.deploymentEnabled`) n'autorise que trois familles de branches :

| Branche | Rôle | Déploiement |
|---|---|---|
| `main` | **Production** | automatique, sur le domaine de production |
| `release` | **Recette** (staging) : on y regroupe ce qui est prêt à tester avant la production ; adresse stable ; utilise la base de recette (`DATABASE_URL_PREVIEW`) | automatique |
| `preview/<sujet>` | **Essai à la demande** d'une fonctionnalité | automatique, sur adresse propre à la branche |
| toute autre (`feat/…`, `fix/…`, `docs/…`, `exp/…`) | travail en cours | **aucun** |

Pour faire tester une branche : `git push origin feat/mon-sujet:preview/mon-sujet` (la branche locale garde son nom). On supprime ensuite la branche `preview/…` distante. Flux normal : `feat/…` → `release` (recette) → `main` (production, fusion seulement après accord).
Les prévisualisations sont protégées par l'authentification Vercel : seul un compte connecté les ouvre. Réglage manuel conseillé dans Vercel (Settings > Security > Deployment Retention) : durée de conservation des anciens déploiements.

Tests en local : `npm test` (API et administration) tourne **sans Neon, sans Docker, sans réseau** : les migrations sont rejouées sur PGlite, un vrai PostgreSQL embarqué (`backend/src/db/migrations.test.ts`).

---

## API et base de données (EP008)

Un petit back-end **facultatif** : le site marche sans lui. TypeScript dans le même dépôt : **Hono** (routes), **Zod** (validation), **Drizzle** (base et migrations), PostgreSQL chez **Neon**, fonctions **Vercel** (`api/index.ts` → `backend/src/app.ts`, `/api/:path*` réécrit vers `/api` dans `vercel.json`). Décision et alternatives écartées : [ADR-001](.claude/docs/architecture/decisions/ADR001-back-end-typescript-vercel-neon.md). Seul point de santé pour l'instant : `GET /api/health` (version, environnement, état de la base ; jamais d'adresse ni de mot de passe).

- **Variables d'environnement** (à saisir dans Vercel, Settings > Environment Variables ; jamais dans le dépôt) : `DATABASE_URL` (production et développement), `DATABASE_URL_PREVIEW` (prévisualisations). **Une prévisualisation n'utilise jamais `DATABASE_URL`** : sans `DATABASE_URL_PREVIEW`, la base y est désactivée. Le code ne lit que ces adresses PostgreSQL ordinaires : Neon reste remplaçable en changeant `DATABASE_URL`.
- **Variables posées par l'intégration Neon** : `DATABASE_URL` (connexion avec répartiteur, celle de l'API), `DATABASE_URL_UNPOOLED` (connexion directe, utilisée par les migrations) ; les autres (`PG*`, `POSTGRES_*`) ne sont pas lues par le code.
- **Administration (US005)** : page `/admin/` (application React de `frontend/admin/`, adresses en `#/…` ; non référencée, `noindex`, politique de contenu stricte en en-tête HTTP dans `vercel.json`) et routes `/api/admin/*`, protégées par le jeton **`ADMIN_TOKEN`** (variable Vercel, à définir pour Production **et** Preview ; jamais dans le dépôt). Générer un jeton long : `openssl rand -base64 32`. Sans `ADMIN_TOKEN`, l'administration est **fermée** (l'API répond 503, code `admin-non-configuree`). Le jeton voyage dans l'en-tête `Authorization: Bearer …` (HTTPS) ; page : jeton gardé le temps de l'onglet (`sessionStorage`) ; 5 essais ratés par minute et par adresse, puis blocage (limite par instance de fonction : un limiteur partagé viendra avec US008). En développement : `ADMIN_TOKEN=… npm run api:dev`, `npm run dev` (la carte) et `npm run dev:admin`, puis http://localhost:5174/admin/. Aujourd'hui : état de l'application, de la base, taille et lignes par table.
- **Retouches des parkings depuis l'administration (US006)** : chercher un parking, le masquer, changer nom, tarif, places, type, position, note, **avec une source obligatoire** ; ajouter un parking absent d'OSM ; liste des retouches et journal. Enregistrées dans la base (tables `parking_edits`, `edit_log`), publiées par `GET /api/parkings/edits` (mise en cache 60 s par Vercel) ; le site les demande au chargement (1,5 s au plus, sinon il part sans) et les fusionne avec celles de `frontend/carte/content/parkings.json` (l'administration l'emporte). La fiche du parking cite la source de la retouche.
- **Base locale de développement** : sans `DATABASE_URL`, `npm run api:dev` utilise un PostgreSQL embarqué (PGlite, dossier `backend/data/dev-db/`, ignoré par Git) avec les migrations du dépôt : on teste l'administration sans Neon (dans ce mode, la carte « Base de données » de l'administration indique « non configurée », c'est normal).
- **Créer ou mettre à jour la base** : `DATABASE_URL_UNPOOLED=postgres://… npm run db:migrate` (rejouable ; l'adresse se copie depuis la console Neon, sans la coller ailleurs). Les migrations sont dans `backend/src/db/migrations/`.
- **Développer** : `npm run api:dev` dans un terminal, `npm run dev` (la carte) dans un autre ; pour l'administration, `npm run dev:admin` en plus (http://localhost:5174/admin/ ; en local, `ADMIN_TOKEN=… npm run api:dev` pour s'y connecter).
- **Contrôle** : `npm run build` vérifie aussi les types de l'administration et de l'API (`tsconfig.api.json`) et **la charge comme Vercel** (`scripts/check-api-esm.mjs` : projet en ES modules, extension `.js` obligatoire dans les imports relatifs de `api/` et `backend/src/`) ; `npm test` lance les tests.

---

## Déployer (Docker, Coolify, Vercel)

Le site est **statique** : `npm run build:pi` produit la carte dans `dist/`, servie par nginx dans une image Docker (l'API et l'administration ne tournent que sur Vercel).

**Régénération des données au build** : l'argument `REFRESH_DATA` (dans `docker-compose.yml`,
`"true"` par défaut) fait lancer au build `npm run data` (OpenStreetMap, BD TOPO, RGE ALTI) puis
`npm run nature`, via `deploy/refresh-data.sh`. Filet de sécurité :
- si le téléchargement échoue (Overpass saturé, pas de réseau), le build continue avec le `city.json` du dépôt ;
- si BD TOPO ou RGE ALTI n'ont pas répondu, le nouveau `city.json` est rejeté et on garde celui du dépôt. Sans ce contrôle, la carte serait publiée avec des hauteurs estimées et un relief interpolé, sans aucune erreur visible ;
- durée : compter 1 à 2 minutes de plus par build.

Avec `REFRESH_DATA: "false"`, le build est rapide et utilise les données du dépôt telles quelles.
Les données téléchargées au build ne vont que dans l'image, pas dans le dépôt. Pour les versionner,
lancer `npm run data` sur le Mac et commiter.

Une nouvelle mise à jour des données demande un nouveau build. Docker réutilise son cache si aucun
fichier n'a changé : pour forcer un rafraîchissement, reconstruire sans cache (option « no cache »
dans Coolify, ou `docker compose build --no-cache`).

| Fichier | Rôle |
|---|---|
| `Dockerfile` | Étape 1 : Node construit la carte (`npm run build:pi`). Étape 2 : nginx sert `dist/` (image finale sans Node). Images arm64 et amd64, donc compatible avec le Raspberry Pi 5 |
| `deploy/nginx.conf` | Compression gzip ; cache 1 an pour `assets/` et pour les données appelées avec `?v=` ; `index.html`, `sw.js` et le manifeste revérifiés à chaque visite (réponse 304 s'ils n'ont pas changé) |
| `docker-compose.yml` | Un service `web` (conteneur `city-chambery`) ; nginx écoute sur le port 80 du conteneur, publié sur le port **3000** de l'hôte (`'3000:80'`) ; argument `REFRESH_DATA` |
| `deploy/refresh-data.sh` | Au build, si `REFRESH_DATA=true` : `npm run data` + `npm run nature`, avec retour aux données du dépôt en cas d'échec ou de données incomplètes |
| `.dockerignore` | Exclut `node_modules`, `frontend/carte/data/raw`, `.claude/`, les `.fbx` du pack nature… (garde les `.obj` pour `npm run nature`) : contexte de build d'environ 4 Mo |

**Cache et mode hors-ligne :**

- **Code :** les fichiers `assets/` ont une empreinte dans leur nom ; nginx les garde en cache 1 an. three.js est dans son propre fichier (`three-….js`, réglage `codeSplitting` de `frontend/carte/vite.config.ts`) : une mise à jour de l'appli ne change que `index-….js` (≈ 45 Ko gzip), three.js (≈ 172 Ko gzip) reste en cache tant que la version de la librairie ne change pas.
- **Données et modèles :** ils sont chargés avec la version des données dans l'adresse (`city.json?v=…`, empreinte calculée au build par `frontend/carte/vite.config.ts`), donc gardés en cache 1 an, et rechargés dès que les données changent.
- **Hors-ligne (PWA) :** un service worker garde le site, les données et les modèles (≈ 2,4 Mo) dès la première visite. La carte s'ouvre ensuite sans réseau et peut s'installer sur l'écran d'accueil. Quand une nouvelle version est publiée, un bandeau propose « Mettre à jour ».
- **HTTPS obligatoire** pour le hors-ligne : le service worker ne fonctionne qu'en HTTPS (domaine Coolify) ou sur localhost, pas sur `http://<ip-du-pi>:3000`. Il n'existe pas non plus en `npm run dev` ; pour le tester en local, lancer `npm run build && npm run preview`.

**Avec Coolify :**

1. Pousser le dépôt (avec `package-lock.json` à jour : après un changement de dépendances, lancer `npm install` puis commiter le lock, sinon `npm ci` échoue au build).
2. Dans Coolify : *New Resource* → dépôt Git → type **Docker Compose** (fichier `docker-compose.yml`).
3. Donner un domaine au service `web` (Coolify gère le HTTPS), puis *Deploy*.
4. Pour mettre à jour : pousser sur la branche, puis redéployer (ou activer le déploiement automatique).

**En local :** `npm run docker:up`, puis http://localhost:3000 (voir [Démarrer](#démarrer)).

**Avec Vercel :** importer le dépôt, rien à régler : `vercel.json` donne la commande de build (`npm run build`), le dossier `dist` et les mêmes règles de cache que `deploy/nginx.conf` (1 an pour `assets/` et pour `data/` et `models/` appelés avec `?v=` ; `sw.js`, manifeste et page revérifiés à chaque visite). HTTPS fourni, donc mode hors-ligne actif. Pas de `REFRESH_DATA` : Vercel utilise les données du dépôt. Chaque branche poussée a sa propre adresse de prévisualisation.

---

## Dépannage

| Symptôme | Cause probable / solution |
|---|---|
| « Données de la ville absentes » | Lancer `npm run data` |
| Overpass répond 429 / 504 | Serveur saturé : réessayer, ou `OVERPASS_URL=…` (voir plus haut) |
| `⚠ BD TOPO indisponible` | Service IGN injoignable : le cache est utilisé s'il existe, sinon hauteurs OSM/estimées. Réessayer avec `npm run data -- --offline --bdtopo` |
| `relief interpolé depuis … altitudes de sol BD TOPO` | Service RGE ALTI injoignable : réessayer avec `npm run data -- --offline --relief` |
| Un lieu d'histoire est mal placé | Outil de placement (touche P en dev) ou `osm.match` / `osm.prefer` plus précis |
| Un monument a disparu | Vérifier que son contour OSM existe encore (identifiants dans `frontend/carte/src/scene/models/*.ts`) |
| Ça rame sur mobile | L'effet maquette est permanent (plus de bouton) : s'il pèse trop, voir le ticket « Tilt-shift » du backlog (l'alléger sur petits écrans) |

---

## Limites connues

- **Hauteurs** : ≈ 105 bâtiments (surtout de petites annexes) n'ont pas de correspondant BD TOPO et gardent une hauteur estimée.
- **Toits** : la forme ne vient d'OSM que pour ≈ 3 % des bâtiments ; le reste est un choix esthétique, pas la réalité.
- **Relief** : un bâtiment sur une pente est posé sur son point le plus bas (côté amont un peu enterré). Tant que RGE ALTI n'a pas été téléchargé, le relief est interpolé et moins précis entre les bâtiments.
- **Monuments** : versions « formes simples », proportions en partie supposées (voir le tableau plus haut).
- **Positions des lieux** : celles trouvées automatiquement dans OSM sont approximatives ; à vérifier.
- **Contenu** : 8 fiches rédigées à partir des sources citées ; à relire avant de montrer.
- **Bars et cafés** : noms et horaires bruts d'OSM ; la nuit, ils s'allument selon leur type, pas selon leurs horaires.
- **Drapeaux** : seulement le château (ancrage OSM) et l'hôtel de ville (bâtiment OSM), motif de la Savoie ; mât posé sur le point le plus haut du toit.
- **Cheminées** : du décor (OpenStreetMap ne les donne pas), sur 40 % des toits en pente « rectangle » ; fumée selon la saison seulement, rien l'été.
- **Pigeons et oiseaux** : du décor (pas un relevé d'oiseaux réels), de jour seulement, agrandis ×2,5 pour être vus.
- **Passants** : du décor, jamais dans l'eau (sauf sur les ponts) ; leur nombre suit une courbe horaire, et la nuit des groupes se tiennent devant les lieux ouverts d'après leurs horaires (y compris les horaires provisoires) ; ils ne se tiennent que dans un rayon de 250 m autour du point regardé (pour qu'il y ait du monde à l'écran sans en dessiner partout), et réapparaissent hors du champ quand on se déplace.
- **Horaires provisoires** : 23 bars, pubs et boîtes de nuit sans horaires dans OSM reçoivent des horaires fictifs (`frontend/carte/content/place-hours.json`), utilisés seulement pour leur éclairage de nuit ; ils ne sont jamais affichés. À remplacer par les vraies données (voir le backlog).
- **Auvents** : 148 lieux sur 169 en ont un, posé sur la façade côté rue d'après les contours OSM et les voies ; c'est du décor, pas un relevé des commerces. Les 12 lieux dans un bâtiment remplacé par un monument et les 8 lieux hors bâtiment n'en ont pas.
- **Soleil** : lever 6 h, coucher 18 h toute l'année (pas de saisons).
- **Leysse** : dessinée à l'air libre sur toute sa longueur, y compris là où elle est couverte en réalité (sous les boulevards du centre ; un tronçon a été découvert en 2013 près du Palais de justice). Choix de lisibilité, réglable avec `showCoveredWater`.

---

## Licences

- Données cartographiques © contributeurs OpenStreetMap, **ODbL** — attribution affichée en bas à droite.
- Hauteurs BD TOPO et relief RGE ALTI © IGN, **Licence Ouverte Etalab 2.0** — attribution affichée quand ils sont utilisés.
- Textes : reformulés, sources citées dans chaque fiche. Recopier des passages de Wikipédia imposerait la licence **CC BY-SA**.
- Modèles nature : Ultimate Nature Pack by Quaternius, **CC0 1.0** (domaine public, aucune obligation ; crédit volontaire).
- Mascotte : « Elephant » par jeremy ([Poly Pizza](https://poly.pizza/m/9J-cG39KYFC)), **CC BY 3.0** — attribution obligatoire, affichée en bas à droite de l'application. Modifié : mis à l'échelle, réorienté, animé.
- Pièces de bâtiments (auvents…) : « Building Kit » de Kenney ([kenney.nl](https://kenney.nl/assets/building-kit)), **CC0 1.0** (domaine public, crédit non obligatoire ; confirmé sur la page du pack le 30/09/2026). Seules les 2 pièces d'auvent et la palette du pack sont gardées dans `frontend/carte/assets-src/buildings` (le reste a été écarté), converties par `npm run buildings`.
- Librairies : Three.js (MIT), straight-skeleton (MIT), glTF-Transform (MIT, conversion uniquement).

---

## Suivi du projet

Le dossier [`.claude/docs/`](.claude/docs/context.md) sert de mémoire au projet (point d'entrée : [`context.md`](.claude/docs/context.md)) :

| Fichier | Contenu |
|---|---|
| [FEATURES.md](.claude/docs/versions/FEATURES.md) | Fonctionnalités livrées et leur état |
| [BACKLOG.md](.claude/docs/versions/backlog/BACKLOG.md) | Ce qui reste à faire, par priorité |
| [CHANGELOG.md](.claude/docs/versions/CHANGELOG.md) | Journal des itérations et des retours |
| [DECISIONS.md](.claude/docs/architecture/decisions/DECISIONS.md) | Choix techniques et produit, avec leur justification |
| [PERF-AUDIT.md](.claude/docs/architecture/PERF-AUDIT.md) | Audit de fluidité |
| [specs/epics/](.claude/docs/specs/) | Specs des gros chantiers |

Les consignes pour Claude sont dans [`.claude/CLAUDE.md`](.claude/CLAUDE.md).
