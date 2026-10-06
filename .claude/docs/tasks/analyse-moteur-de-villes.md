# Analyse 2 : un moteur pour monter une ville par script

Auteur : Claude (analyse seule, aucun code modifié). Date : 06/10/2026. « Mesuré » = vérifié dans le dépôt ce jour ; « non vérifié » = de mémoire ou à essayer.

## 1. Ce qu'on veut

Lancer un script qui **pose des questions** (quelle ville ? quelle emprise ? quelles sources ?), puis **construit la ville** : données, relief, bâtiments, rues, lieux, textes d'accueil, jusqu'à un diorama qui s'ouvre dans le navigateur, **ajusté ensuite à la main** là où les données se trompent.

## 2. Ce qui existe déjà (mesuré)

Le pipeline Chambéry fait déjà 80 % du travail, mais il est écrit **pour une ville** :

| Étape | Fichier | Générique ? |
|---|---|---|
| Emprise (rectangle lat/lon), pas du relief, exagération, rivières couvertes à afficher | `diorama.config.json` | Oui (déjà un fichier de config) |
| Téléchargement OSM (Overpass), bâtiments, rues, eau, arbres, aires, lieux, parkings | `scripts/fetch-osm.mjs` (559 lignes) | **Oui, monde entier** |
| Hauteurs des bâtiments | OSM (`height`, `building:levels`), sinon estimation (3,2 m par étage) ; puis **BD TOPO IGN** (`scripts/bdtopo.mjs`) | OSM oui ; BD TOPO **France seulement** |
| Relief | `scripts/terrain.mjs` : **RGE ALTI IGN** (France), repli : interpolation des altitudes des bâtiments | **France seulement** |
| Formes de toit | `scripts/roofs.mjs` (tag OSM, sinon rectangle orienté, sinon squelette droit) | Oui |
| Noms de rues au sol | `scripts/street-names.mjs` | Oui |
| Parkings | `scripts/lib/parkings.mjs` | Oui (OSM) |
| Lieux d'histoire | `src/content/pois.json` : 8 fiches **sourcées à la main**, position tirée d'OSM par le nom | Données propres à Chambéry |
| Monuments modélisés | `src/content/models.json` + `src/scene/models/*.ts` : château, cathédrale, Carré Curial, fontaine **construits en code sur les contours OSM** | **Propres à Chambéry** |
| Mascotte, jeu | `mascot.json`, `src/scene/mascot.ts`, `src/game/*` : quatre éléphants échappés d'une fontaine | **Propre à Chambéry** (le jeu est lié à la fontaine des Éléphants) |
| Accueil | `src/content/lobby.json` | Textes de Chambéry |
| Heure, soleil, saisons | `src/time/chambery.ts` (`CHAMBERY = {lat, lon, timeZone}` en dur) ; `seasons.ts` (saisons de l'hémisphère nord) | Un seul point à rendre paramétrable |
| Sauvegarde | `localStorage`, clés `chambery-diorama:*` | À préfixer par la ville |
| Outil de placement | `src/dev/placement.ts` (dev seulement) : place un lieu en cliquant, écrit `pois.json` | Générique |
| Retouches manuelles | `src/content/parkings.json` (`overrides`, `added`) : modèle à étendre aux autres couches | Générique |

**Couplages à Chambéry** (mesuré par recherche dans le dépôt) : 11 fichiers de `src/` et 5 scripts citent Chambéry ou lisent des ancres nommées (`elephants`, `chateau`) : le point d'arrivée du lobby (milieu château – fontaine), la zone interdite des passants et des oiseaux, le point de départ de l'avatar, le jeu des éléphants, les drapeaux, la mascotte.

## 3. Architecture cible

### 3.1 Un dossier par ville
```
cities/<slug>/
  city.config.json   nom, pays, langue, fuseau, centre, emprise, pas du relief, sources choisies, options (mascotte oui/non…)
  pois.json          lieux d'histoire (sourcés) ; position OSM ou imposée
  landmarks.json     monuments : « procédural:<nom> » ou « extrusion générique »
  overrides.json     retouches (parkings, bâtiments, lieux…) : le modèle de parkings.json
  content/           lobby.json, mascotte, textes
  data/raw/          caches OSM, relief, hauteurs (non commités ou ignorés)
public/cities/<slug>/city.json    le résultat du script (jamais écrit à la main : règle projet 3)
```
L'application lit `city.config.json` au lieu de constantes : l'heure et le soleil viennent du centre et du fuseau, les clés de sauvegarde sont préfixées, l'accueil, les textes et les ancres (« point de départ », « vue d'accueil », « zones à éviter ») sont des **rôles** déclarés dans la config, plus des noms d'ancres écrits dans le code.

### 3.2 L'assistant en ligne de commande : `npm run city:new`
Questions posées (réponses par défaut proposées, relançable) :
1. **Quelle ville ?** Recherche par nom (géocodage Nominatim : 1 requête par seconde au plus, en-tête d'identification obligatoire) → centre.
2. **Quelle emprise ?** Rayon (400 à 1 000 m) ou rectangle ; affichage du nombre de bâtiments estimé et de la **taille prévue** du fichier (alerte au-delà de ≈ 4 000 bâtiments : budget de rendu).
3. **Pays → sources** : France : BD TOPO (hauteurs) + RGE ALTI (relief) ; ailleurs : hauteurs OSM + relief mondial (voir 4.2).
4. **Fuseau horaire** déduit des coordonnées ; **langue** des textes.
5. **Lieux d'histoire** : le script **propose** des candidats (OSM `historic=*`, `tourism=attraction`, tags `wikipedia` / `wikidata`) classés par notoriété ; chaque candidat devient une **fiche à compléter** avec liens de source (Wikipédia, Wikidata), marquée « à relire » : on **n'invente jamais** un fait (règle projet 1).
6. **Mascotte / jeu** : non, ou « générique » (voir 5).
7. **Résumé et confirmation**, puis lancement.

Enchaînement : (1) config → (2) OSM → (3) relief → (4) hauteurs → (5) `city.json` → (6) **contrôle qualité** (script de vérification : part des hauteurs réelles, bâtiments dégénérés, lieux introuvables, rues sans nom, trous du relief, poids du fichier) → (7) serveur de dev avec l'outil de placement → (8) ajustements dans `overrides.json` → (9) build.

### 3.3 Exécution : plusieurs villes
Deux modèles, à choisir (question 1 de la section 7) :
- **Un site par ville** (une variable `CITY=<slug>` au build, un déploiement Vercel par ville) : le plus simple, aucun surcoût de poids, la marque et les textes sont propres à chaque site. C'est ce que fait déjà le projet pour Chambéry.
- **Un seul site, plusieurs villes** (`/chambery`, `/annecy`… ou `?city=`) avec une page d'accueil de choix : `city.json` chargé à la demande (1,4 Mo par ville), service worker et cache par ville, un « hub » (déjà cité dans l'epic du lobby).

### 3.4 Générateur de projet et export (précisé le 06/10 avec Dasco)
Question posée : plutôt que d'écrire des commits dans des JSON, **un script préalable qui lance toutes les manipulations et génère un nouveau projet** ? C'est la bonne forme pour créer une ville ; les deux outils ne servent pas au même moment :
- **Le générateur (script)** crée une ville : questions → données → un projet qui s'ouvre. Il écrit des fichiers (JSON, `city.json`) puis s'arrête. **À faire d'abord.**
- **L'administration (CMS ou page)** sert ensuite à **corriger** une ville existante (analyse 3). Elle édite les mêmes fichiers, en Git.
Pour que le générateur produise un projet **autonome** (front et, si besoin, back-end) sans copier le moteur à chaque ville (les copies divergeraient à chaque correction) :
```
packages/engine/    le moteur : rendu, scène, balade, jeux, interface (version unique)
cities/<slug>/      config, contenu, données, retouches de la ville
apps/<slug>/        (généré) point d'entrée de la ville : index.html + main court qui charge le moteur + sa config
server/             (généré, si activé) modèle de back-end : schéma de base de données, règles d'accès, variables d'environnement
scripts/create-city   le générateur ; scripts/export-city <slug> : produit le dossier à déployer
```
- **Export front** : `vite build` avec `CITY=<slug>` → un dossier statique (`dist/`) à déployer (Vercel, Pi/Coolify…), avec ses données, son manifest, son service worker.
- **Export back-end** (seulement si la ville active les comptes et la progression) : fichiers modèles pour le service retenu (migrations de base de données, règles d'accès, fichier d'exemple des variables) ; le moteur reste le même, la ville choisit « avec ou sans comptes » dans sa config.
- **Deux sorties possibles** pour le générateur : (a) une **nouvelle ville dans le même dépôt** (le plus simple) ; (b) un **dépôt séparé** qui dépend du moteur publié comme paquet (chaque ville évolue seule, mais il faut publier et mettre à jour le moteur). *Recommandation : (a) d'abord, (b) quand une ville appartient à quelqu'un d'autre.*
Coût ajouté à l'estimation : passage en dossiers `packages/engine` + `cities/*` : +1 à 1,5 session dans J0 ; générateur d'export front : +1 ; modèle de back-end : +1 à 1,5 (après l'analyse 3).

## 4. Les vrais obstacles

### 4.1 Qualité d'OpenStreetMap, variable d'une ville à l'autre
À Chambéry, 1 959 bâtiments sur 2 067 ont une hauteur IGN ; sans BD TOPO, il ne reste que les tags OSM (`height`, `building:levels`, souvent rares : 97 % des toits n'ont pas de forme) et l'estimation de 3,2 m par étage. Une ville sans données de hauteur donnera un diorama **plat et uniforme** : le script doit **le dire** (part des hauteurs réelles, estimées) et laisser corriger.

### 4.2 Relief hors de France (non vérifié, à essayer)
Pas de RGE ALTI hors de France. Pistes : modèles d'élévation mondiaux (Copernicus GLO-30, SRTM : environ 30 m de résolution, via des tuiles d'altitude ouvertes). Le diorama prend une grille de **10 m** : avec 30 m, le relief paraîtra plus lisse (acceptable en plaine, faible en montagne). À mesurer sur une ville test avant de promettre.

### 4.3 Hauteurs hors de France (non vérifié)
Jeux ouverts mondiaux d'emprises de bâtiments avec hauteur (par exemple des jeux consolidés type Overture ou Microsoft Building Footprints) : couverture et licences à vérifier ville par ville ; c'est un second sujet de recherche à part.

### 4.4 Taille et performance
Chambéry : 1 325 m × 1 167 m, 2 067 bâtiments, `city.json` de 1,44 Mo, un seul maillage de bâtiments, 63 à 2 406 appels de rendu selon la vue. Une ville de 10 000 bâtiments poserait la question du **découpage en tuiles** (chargement progressif), du temps de génération du maillage au chargement, de la mémoire de l'iPhone. Il faut un **budget par emprise** et un avertissement du script.

### 4.5 Contenu éditorial
Le charme de Chambéry est dans les fiches d'histoire sourcées, les éléphants, le lobby. Le moteur peut générer le décor, pas l'âme : prévoir un **mode « ville sans fiches »** (explorer, balade, parkings, bars) et un échafaudage de fiches à compléter.

### 4.6 Licences et attributions
Chaque ville : attribution OSM (ODbL), IGN (France), relief et hauteurs de la source choisie. Le moteur doit **écrire l'attribution** dans `city.json` et le README de la ville (règle projet 5).

### 4.7 Limites des services gratuits
Overpass (miroirs, quotas), Nominatim (1 requête par seconde), géoplateforme IGN (5 requêtes par seconde). Le script doit mettre en cache, réessayer, et dire quand il attend.

## 5. Ce qui devient générique, ce qui reste à la main

| Générique (moteur) | Adapté à chaque ville | Spécifique, optionnel |
|---|---|---|
| Bâtiments, toits, rues, noms de rues, eau, arbres, relief, parkings, bars et cafés, passants, jour et nuit, saisons, mode balade, avatar, effacement des bâtiments | Lieux d'histoire (fiches sourcées), textes d'accueil, point de départ, vue d'accueil, zones à éviter, couleurs si besoin | Monuments modélisés (château, cathédrale), mascotte et jeu (éléphants) : à brancher ville par ville |
Le jeu des éléphants pourrait devenir un **jeu de mascotte paramétrable** (animal, fontaine d'origine, points) : décision produit à prendre, hors du premier jalon.

## 6. Plan en jalons (estimation en sessions d'une demi-journée)

| Jalon | Contenu | Sessions |
|---|---|---|
| J0 · Extraire la config | `cities/chambery/` : lat, lon, fuseau, ancres-rôles, clés de sauvegarde, textes ; l'appli lit la config ; Chambéry doit rester **identique** (non-régression) | 1,5 à 2 |
| J1 · Générateur France | `npm run city:new` : géocodage, emprise, OSM, BD TOPO, RGE ALTI, `city.json`, contrôle qualité, rapport chiffré | 2 à 3 |
| J2 · Ville test | Une 2ᵉ ville française (en montagne ou en plaine) de bout en bout ; liste des écarts ; première correction | 1 à 1,5 |
| J3 · Hors de France | Relief mondial et hauteurs ouvertes : essai, mesure de qualité, choix | 2 |
| J4 · Retouches | `overrides.json` généralisé (bâtiments, rues, lieux, parkings), outil de placement en production protégée | 1,5 |
| J5 · Contenu | Candidats de lieux depuis Wikidata/OSM, fiches à compléter, mode « sans fiches », lobby générique | 1,5 |
| J6 · Plusieurs villes | Un déploiement par ville (simple) ou un hub (plus long), cache par ville | 1 à 2 |
| J7 · Export | `export-city` : dossier statique par ville ; modèle de back-end optionnel (voir 3.4) | 2 à 2,5 |
Total : **12 à 17 sessions** avec l'export (10 à 14 sans). **Une deuxième ville française de bout en bout : environ 5 à 7 sessions** (J0 à J2).

## 7. Questions pour Dasco (proposition par défaut)

1. **Un site par ville, ou un hub ?** *Défaut : un site par ville au début ; le hub plus tard.*
2. **La deuxième ville** : laquelle, et en France d'abord ? *Défaut : une ville française, pour réutiliser BD TOPO et RGE ALTI ; relief mondial en J3.*
3. **Les fiches d'histoire** : écrites à la main avec toi, ou générées depuis Wikipédia/Wikidata à relire ? *Défaut : générées en brouillon, jamais publiées sans relecture.*
4. **Les éléphants** restent à Chambéry, ou un jeu de mascotte pour chaque ville ? *Défaut : propres à Chambéry pour l'instant.*
5. **Qui lance le script** : toi (ligne de commande), ou un jour une page d'administration (voir l'analyse 3) ? *Défaut : ligne de commande d'abord.*
6. **Budget de taille** : jusqu'à quelle taille de ville ? *Défaut : jusqu'à ≈ 4 000 bâtiments sans découpage.*

## 8. Recommandation

Faire **J0 d'abord** : sans lui, toute ville de plus coûte du copier-coller dans le code. C'est aussi un nettoyage utile pour Chambéry (config unique, textes, clés). Ensuite J1 + J2 prouvent le moteur sur une ville réelle avant d'investir dans les cas difficiles (hors de France, hub).
