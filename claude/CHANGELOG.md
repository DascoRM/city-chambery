# Journal des itérations

## Itération 26 — 29/09/2026 (réflexion, pas de code)

**Demandes de Dasco :**
- animations de jour et de nuit en P1 (éléphant qui se promène, passants) : que peut-on faire, et combien ça coûte ?
- faut-il un back-end ou une gestion du cache pour la suite ?
- timing des ombres en heure réelle : rien de défini pour l'instant.

**Backlog :**
- P1 : ticket animations, avec son découpage et son estimation.
- Nouvelle section « Architecture » : back-end (pas nécessaire aujourd'hui, avec les cas où il le deviendrait), cache HTTP, données versionnées, mode hors-ligne.
- Ticket heure réelle : fréquence des ombres « à définir ».

**Vérifié :**
- Les packs Quaternius CC0 vérifiés ne contiennent pas d'éléphant : le pack d'animaux animés (poly.pizza) a vache, âne, cerf, alpaga, taureau, renard, shiba, cerf élaphe, husky, loup et deux chevaux.
- Le pack de 52 personnages animés est en FBX, OBJ et Blend (pas de glTF annoncé).

## Itération 25 — 29/09/2026

**Demandes de Dasco** (suite de l'audit) :
- ombres recalculées seulement quand il le faut (pour l'instant, quand on bouge le curseur d'heure) ;
- `antialias` coupé sur le renderer ;
- arbres simplifiés à la conversion.

Ne pas toucher aux monuments. Noter au backlog : effet maquette moins gourmand ou inactif sur mobile.

**Changements :**
- `stage.ts` :
  - `renderer.shadowMap.autoUpdate = false` : ombres calculées au chargement (`main.ts`, avant la boucle) ;
  - `antialias: false` : l'effet maquette garde son anticrénelage ×4.
- `daynight.ts` : ombres recalculées quand la position du soleil ou de la lune change (curseur d'heure, lecture ▶).
- `markers.ts` : les gemmes et les épingles ne projettent plus d'ombre, car elles bougent et leur ombre resterait figée.
- `convert-nature.mjs` : simplification meshoptimizer (via glTF-Transform), réglée par `simplify` dans `nature.json` (ratio 0,5, erreur 0,02) :
  - les 18 modèles passent à exactement la moitié de leurs triangles ;
  - arbres : 1,97 M → 0,99 M triangles ;
  - fichiers d'environ 10 à 25 Ko.
- Nouvelles dépendances de dev : `@gltf-transform/functions`, `meshoptimizer`. **Lancer `npm install`.** `package-lock.json` n'a pas été envoyé pour ne pas écraser celui de Dasco : `npm install` le mettra à jour.

**Vérifié dans le navigateur de test :**
- arbres avant / après de près : différence à peine visible (pointes des pins un peu plus anguleuses) ;
- ombres présentes au chargement, inchangées quand la caméra bouge, recalculées dans la nouvelle direction à 9 h 30.

**Estimation par image la plupart du temps :** ≈ 2 400 appels de rendu et ≈ 1,5 M triangles, contre ≈ 4 800 et ≈ 4,7 M. Ce sont des comptes : la vitesse réelle reste à mesurer sur un vrai appareil.

## Itération 24 — 29/09/2026

**Demande de Dasco :** faire une passe sur le projet pour trouver ce qui améliorerait la fluidité, et le noter au backlog.

**Fait :**
- Audit chiffré dans `claude/PERF-AUDIT.md` : appels de rendu, triangles et ombres par couche, poids des fichiers.
- 8 tickets dans une nouvelle section **P1 — Fluidité** du backlog. Les deux anciens tickets « mesurer la fluidité mobile » (arbres, tilt-shift) y sont regroupés.
- Aucun code modifié.

**Principaux constats :**
- Monuments : 2 340 appels de rendu pour 42 000 triangles.
- Ombres recalculées à chaque image.
- Arbres modélisés : 1,97 M triangles, soit 80 % du total.
- Anticrénelage payé deux fois.
- Les temps n'ont pas été mesurés sur un vrai appareil (rendu logiciel dans l'environnement de Claude).

## Itération 23 — 29/09/2026

**Retour de Dasco :** après son changement d'animation (rebond sur toute la fiche), la fiche des bars, cafés et restaurants remontait en haut à gauche au survol.

**Cause :** le code plaçait la fiche avec `transform: translate(x, y)`. L'animation `pc-bounce` réécrit aussi `transform` (translateY + scale) : pendant l'animation, la position était écrasée et la fiche revenait à `left: 0; top: 0`. Sans le CSS, la fiche n'était plus en `position: fixed` et n'apparaissait plus.

**Changements :**
- `ui.ts` (`movePlaceCard`) : la fiche est positionnée avec `left` / `top` ; `transform` reste libre pour les animations
- `style.css` : animation de Dasco conservée, commentaire ajouté sur `position: fixed`

## Itération 22 — 29/09/2026

**Demandes de Dasco :**
- supprimer la possibilité de décocher l'effet maquette ;
- rendre la légende bars / cafés / restaurants cochable par catégorie.

**Changements :**
- Effet maquette toujours actif : bouton 📷 retiré, préférence mémorisée supprimée (`loadTiltShift`/`saveTiltShift` dans `progress.ts`). Quelqu'un qui l'avait coupé le retrouve activé.
- Légende avec une case par catégorie (Bars, Cafés, Restaurants), cochée par défaut, de la couleur de la catégorie ; grisée quand elle est décochée. Elle remplace la case unique de la couche.
- `markers.ts` : `setCategoryVisible(catégorie, visible)`. Les épingles masquées passent à l'échelle 0 et ne sont plus cliquables. Leurs halos de nuit s'éteignent (couleur noire en mélange additif).
- Si la fiche ouverte appartient à la catégorie masquée, elle se ferme.
- Choix non mémorisé : tout est coché à chaque chargement.
- Testé : bouton absent, restaurant masqué non survolable, bar visible survolable, nuit avec seulement les bars, recochage.

## Itération 21 — 29/09/2026

**Demande de Dasco :** reprendre les fiches des bars, cafés et restaurants. Une couleur par catégorie, un pointeur 3D de cette couleur, une fiche à côté au survol avec un petit rebond sur le titre, et un toucher sur l'épingle sur mobile. Première version : pointeur de couleur uniquement.

**Constat en cours de route :** 161 lieux sur 169 ont leur point OSM à l'intérieur d'un bâtiment. Posées au sol, les épingles étaient cachées dans les immeubles (c'était déjà le cas avant, en moins visible).

**Changements :**
- `palette.ts` : `PLACE_CATEGORIES` avec 3 catégories et leurs couleurs :
  - Bar (bar, pub, biergarten, boîte de nuit) : violet ;
  - Café (café, glacier) : bleu ;
  - Restaurant : orange.
  Les couleurs évitent l'or et le turquoise des gemmes d'histoire.
- `markers.ts` : épingle 3D en forme de goutte, un seul maillage instancié. Elle est posée sur le toit du bâtiment qui contient le lieu, sinon au sol. Une zone de clic plus large facilite la visée au doigt. L'épingle active rebondit puis reste soulevée et grossie. Les halos de nuit reprennent la couleur de la catégorie.
- `ui.ts` / `style.css` : la fiche du lieu remplace le grand panneau latéral. Elle contient :
  - la catégorie en couleur ;
  - le nom, avec un rebond à l'apparition ;
  - la cuisine en français ;
  - les horaires OSM avec les jours en français.
  La fiche se place à droite de l'épingle (à gauche si elle déborde) et au-dessus sur mobile. Elle suit l'épingle quand la caméra bouge. L'animation est coupée si le système demande moins d'animations.
- `main.ts` : survol → fiche temporaire ; clic ou toucher → fiche épinglée ; clic dans le vide, ✕ ou Échap → fermeture ; masquer la couche ferme la fiche.
- Bouton de la couche : légende des 3 couleurs à la place de « 🍷 Bars & cafés ».
- Testé dans le navigateur de test : survol, sortie, clic épinglé, toucher mobile (iPhone 13), toucher dans le vide, nuit.

## Itération 20 — 29/09/2026

**Demande de Dasco :** fermer la cour du château côté esplanade. On y accède par un escalier, et d'anciennes grilles la ferment.

**Vérifié dans OSM :**
- L'ouverture se trouve entre la tour demi-ronde et le jardin du château (way 235607770), là où entre l'allée de service (way 26474854).
- Un escalier (ways 1396192014, 164635731 et 835789461) monte de l'esplanade vers le Portail Saint-Dominique (way 235607769).
- OSM ne contient ni mur ni grille à cet endroit.
- Les sources en ligne consultées ne décrivent pas les grilles : le tracé et le dessin restent des hypothèses.

**Changements :**
- Nouveau `src/scene/models/chateau-grille.ts`, appelé par `buildChateau`, avec :
  - un mur bas en pierre (0,8 m) avec chaperon, surmonté d'une grille en fer à pointes (2,6 m) ;
  - des piliers tous les ~4,5 m ;
  - une clôture qui va de la tour demi-ronde au coin du jardin, puis longe le bord ouest du jardin jusqu'au bas de la pente, en suivant le relief ;
  - un portail fermé de 5 m sur l'allée (deux gros piliers à boules, barreaux en arc, 3,6 m) ;
  - un escalier de pierre sur le tracé OSM, avec des marches qui suivent le sol.
- On voit la cour à travers les barreaux ; de nuit, les piliers sont éclairés et la grille se découpe en silhouette.
- Limite : le relief au pas de 10 m ne montre pas la montée de l'escalier, qui reste peu marqué.

## Itération 19 — 28/09/2026

**Retour de Dasco :** l'eau de la Leysse manque à un endroit.

**Vérifié :** ce n'était pas un bug. Sur environ 320 m, OSM marque la Leysse comme couverte (`tunnel=yes`, `layer=-2`, ways 22177522 et 239874808) : elle passe sous les boulevards du centre. Un second tronçon couvert existe au nord-ouest, le long du Verney. Le script ignorait volontairement ces tronçons. Seul un court passage a été découvert en 2013, entre le Centenaire et le Palais de justice.

**Choix de Dasco :** afficher l'eau quand même.

**Changements :**
- `diorama.config.json` : nouveau réglage `showCoveredWater: ["La Leysse"]`
- `fetch-osm.mjs` : les tronçons couverts de ces cours d'eau sont dessinés et marqués `covered: true` dans `city.json` ; les autres tronçons couverts restent ignorés
- `city.json` régénéré hors ligne, à partir des mêmes caches ; seule l'eau change
- Conséquence : la zone « berges » (bouleaux) suit toute la rivière et passe de 53 à 101 arbres (927 arbres modélisés au total)

## Itération 18 — 28/09/2026

**Demande de Dasco :** étendre les arbres du pack. Quelques pins dans les parcs, pas dans les rues. Des saules seulement au jardin botanique. Un peu de bouleaux. Les rues restent en arbres simples. Des bouleaux le long de la Leysse.

**Vérifié avant :** 53 arbres OSM à moins de 15 m de la berge de la Leysse, aucun dans un parc. Dans OSM, 2 arbres sur 1 575 ont une espèce et 197 un type de feuillage (190 feuillus, 7 résineux) : les essences restent un choix de style.

**Changements :**
- `nature.json` : nouveau format, avec des mélanges (`parc`, `botanique`, `berges`) et des zones (`areas` = liste d'espaces verts, ou `water` + `distance`). La première zone qui contient un arbre gagne.
- Zones :
  - jardin botanique des Senteurs : arbres classiques, bouleaux, pins et saules ;
  - 16 parcs et squares nommés : arbres classiques, un peu de bouleaux, quelques pins (≈ 9 %) ;
  - bords de la Leysse : bouleaux.
- 10 modèles de plus convertis (BirchTree 4-5, PineTree 1-5, Willow 1-3), soit 18 au total.
- `nature.ts` : un seul InstancedMesh par modèle, toutes zones confondues (18 appels de rendu).
- Résultat : ≈ 880 arbres modélisés, ≈ 1,7 million de triangles pour les arbres. Fluidité mobile toujours non mesurée.

## Itération 17 — 28/09/2026

**Demandes de Dasco :** ranger le pack « Ultimate Nature Pack » de Quaternius (ajouté à la racine), supprimer ce qui n'est pas exploitable ainsi que cactus, palmiers, maïs et blé ; intégrer des arbres du pack au parc du Verney (v1).

**Précision :** les `.blend` ne se chargent pas dans le navigateur, mais c'étaient les fichiers sources pour Blender. Les `.obj` suffisent. Le pack est sous licence CC0.

**Changements :**
- Pack rangé dans `assets-src/quaternius-nature/{obj,fbx}/{arbres,rochers,vegetation,bois}/` (15 Mo, contre 97 Mo avant). `.blend` et `.DS_Store` supprimés, ainsi que cactus, palmiers, maïs et blé (OBJ et FBX). `License.txt` et `Preview.jpg` sont conservés.
- `scripts/convert-nature.mjs` (`npm run nature`) : conversion `.obj` → `.glb`, un maillage indexé par arbre. Couleur par sommet reprise de la palette du diorama, sans normales (rendu à facettes). Poids : 20 à 45 Ko par arbre. Nouvelle dépendance de dev : `@gltf-transform/core`.
- `src/content/nature.json` : zones d'arbres modélisés. v1 : parc du Verney avec CommonTree 1-5 et BirchTree 1-3, pondérés.
- `src/scene/nature.ts` : un InstancedMesh par modèle, tirage déterministe, orientation et échelle variées, légère variation de teinte, ombres. Les arbres simples de la zone sont masqués seulement si le chargement réussit.
- `city.ts` : `buildCity` expose les emplacements d'arbres et une fonction de masquage.
- Parc du Verney : ≈ 190 arbres (156 d'OSM + arbres semés), ≈ 400 000 triangles en plus. Fluidité non mesurée sur mobile.
- Premier essai trop sombre avec les couleurs d'origine : remplacées par la palette du diorama.

## Itération 16 — 28/09/2026

**Retour de Dasco :** le bloc arrondi à côté du Carré Curial n'a pas la même couleur et n'apparaît pas dans `carrecurial.ts`.

**Explication :** ce bloc est un bâtiment OSM séparé, la médiathèque Jean-Jacques-Rousseau (way 209429258). Elle était dessinée par la ville avec une couleur tirée au hasard.

**Changements :**
- `carrecurial.ts` : la médiathèque est ajoutée au modèle, avec la même façade, un toit plat gris, une corniche, des rangées de baies et l'éclairage de nuit. Gouttière 18,3 m et toit 0,6 m (BD TOPO). Elle est posée sur son propre sol.
- `models.json` : `hideOsm` du Carré Curial = `[51756, 209429258]`
- Non traité : l'Espace Malraux (way 209429255, autre bâtiment arrondi à l'est) garde le rendu de la ville

## Itération 15 — 28/09/2026

**Demandes de Dasco :** bien documenter le README ; modéliser le Carré Curial.

**Vérification du relief (lancé par Dasco) :** RGE ALTI OK — 133 × 117 points, 264,8 → 355,9 m (≈ 92 m de dénivelé), aucune valeur manquante. Écart avec l'interpolation BD TOPO utilisée avant : 0,6 m en médiane, 5,4 m pour 90 % des points, jusqu'à 40 m sur les collines.

**Changements :**
- README réécrit : sommaire, sources de données et méthode, réglages, lieux, monuments (tableau des sources et hypothèses), outil de placement, rendu, structure, dépannage, limites, licences
- Nouveau modèle `src/scene/models/carrecurial.ts` : contour OSM avec sa cour (relation 51756), gouttière 16,7 m et toit 5,4 m BD TOPO, toit à pans autour de la cour, soubassement, corniche, fenêtres régulières côté rue et côté cour, éclairage de nuit
- Règle des toits : un très grand bâtiment (> 2 500 m²) a un toit à pans si BD TOPO mesure un toit de plus de 1,5 m (9 bâtiments concernés)
- Constat : la gemme « Carré Curial » avait été accrochée à une station d'autopartage du même nom ; la position manuelle actuelle est sur la médiathèque

## Itération 14 — 28/09/2026

**Demande de Dasco :** relief du terrain.

**Changements :**
- `scripts/terrain.mjs` : grille d'altitudes au pas de 10 m (133 × 117 points) via l'API de calcul altimétrique IGN (RGE ALTI, lots de 150 points, < 4 requêtes/s, cache `data/raw/terrain.json`) ; repli : interpolation des 1 959 altitudes de sol BD TOPO
- Réglages dans `diorama.config.json` : `terrainStep`, `terrainExaggeration` (1 = réel)
- `src/scene/terrain.ts` : maillage du sol en relief ; `heightAt()` suit exactement les mêmes triangles que le maillage ; espaces verts, places et plans d'eau peints sur une texture du sol ; bords du socle qui suivent le profil (bande d'herbe + strates)
- Rues, berges, rivière et ponts drapés (segments redécoupés tous les 4 m) ; bâtiments posés sur le point le plus bas sous leur emprise ; arbres, repères, épingles, halos, étiquettes, monuments (y compris l'éclairage de nuit) et outil de placement suivent le sol ; la caméra vise le sol
- Données livrées avec le repli BD TOPO (le service IGN est injoignable depuis l'environnement de Claude)

## Itération 13 — 28/09/2026

**Demande de Dasco :** hauteurs réelles via IGN BD TOPO. Retour au passage : la cour du château n'est pas ouverte côté esplanade (escalier + anciennes grilles) — noté au backlog ; le relief du terrain manque — noté au backlog (ce n'est pas la même donnée que les hauteurs).

**Changements :**
- `scripts/bdtopo.mjs` : téléchargement de la couche `BDTOPO_V3:batiment` (WFS Géoplateforme, par pages de 1 000), cache `data/raw/bdtopo.json`
- Association OSM ↔ BD TOPO : 36 points échantillonnés dans chaque emprise OSM, vote pour le bâtiment BD TOPO qui en couvre le plus (au moins un tiers)
- Hauteur de gouttière (`hauteur`) et hauteur de toit (`altitude_maximale_toit − altitude_minimale_sol`) utilisées par les toits ; altitude du sol conservée pour le futur relief
- Champs détectés automatiquement, ordre des axes (lat/lon ou lon/lat) détecté automatiquement ; si le service est injoignable : cache, sinon hauteurs actuelles
- Attribution « Hauteurs BD TOPO © IGN » ajoutée quand utilisée
- ⚠️ Non testé contre le vrai service (injoignable depuis l'environnement de Claude) ; testé sur des données simulées : 1 798 / 1 799 associations correctes, les deux ordres d'axes

**Vérification sur les vraies données (lancement de Dasco) :**
- Service OK : 2 191 bâtiments BD TOPO reçus ; champs `hauteur`, `altitude_minimale_sol`, `altitude_maximale_toit` confirmés ; coordonnées en (lon, lat)
- `hauteur` cohérente avec une hauteur à la gouttière : toit − sol dépasse `hauteur` de 2,2 m en médiane
- **Bug corrigé** : quand l'altitude du toit est vide (282 bâtiments, dont presque toutes les églises), elle était lue comme 0 → bâtiment rejeté. Résultat : 1 700 → **1 959** bâtiments avec hauteur IGN, 344 → **105** encore estimées
- Plus haut : Tour du Centenaire, ≈ 80 m

## Itération 12 — 28/09/2026

**Demande de Dasco :** modéliser le château des ducs de Savoie.

**Changements :**
- Nouveau modèle `src/scene/models/chateau.ts` : 7 bâtiments nommés dans OSM, chacun reconstruit sur son contour (bâtiments d'origine masqués)
- Tours : cordon de pierre, meurtrières, toits pointus en ardoise ; Porterie : couronne de mâchicoulis ; Sainte-Chapelle : contreforts à pinacles et grandes baies ; ailes : deux rangs de fenêtres, toits d'ardoise raides
- Hauteurs et pentes regroupées dans `CHATEAU_PARTS` pour les ajuster facilement
- Éclairage de nuit mutualisé avec la cathédrale (`src/scene/models/lighting.ts`)
- Sources : contours et noms OSM ; Sainte-Chapelle 1408-1430, 22 m intérieurs, contreforts ; mâchicoulis de la porterie ; tour Yolande (1466 ou 1470 selon les sources) avec carillon de 70 cloches — non placée faute d'emplacement connu

## Itération 11 — 28/09/2026

**Demande de Dasco :** modéliser la cathédrale Saint-François-de-Sales.

**Changements :**
- Nouveau modèle `src/scene/models/cathedrale.ts`, construit directement sur le contour OpenStreetMap (le bâtiment OSM d'origine est masqué)
- Axe de la nef calculé depuis le contour ; façade placée côté place Métropole (repère OSM)
- Sources : nef de 23 m sous voûtes, bas-côtés, pas de transept, abside à chapelles, clocher côté nord, façade gothique flamboyante de 1522 en molasse (Wikipédia)
- Hypothèses : position/hauteur du clocher (≈ 38 m + toit), largeur de nef, hauteur des bas-côtés, toits en ardoise
- Nuit : éclairage par le bas + portail et baie éclairés de l'intérieur
- Les modèles générés en code reçoivent aussi les données de la ville (pour lire un contour OSM)
- Bonus : les noms de parcs rétrécissent quand la caméra est très proche (ticket du backlog)

## Itération 10 — 28/09/2026

**Demande de Dasco :** mettre en lumière la fontaine des Éléphants la nuit.

**Changements :**
- Éclairage simulé dans les matériaux de la fontaine (pas de vraies lampes, donc sans coût sur le reste de la scène) : lumière chaude par le bas qui s'estompe en montant, statue du général éclairée comme par un projecteur, bassin et jets bleutés
- Halo chaud au sol autour du bassin
- S'allume et s'éteint avec le cycle jour/nuit ; rendu de jour inchangé
- Les modèles générés en code reçoivent maintenant un contexte (intensité de la nuit)

## Itération 9 — 28/09/2026

**Demande de Dasco :** test « monuments modélisés » avec la fontaine des Éléphants (« les Quatre sans cul »).

**Changements :**
- Système de monuments : `src/content/models.json` (position via un lieu ou `pos`, rotation, échelle, bâtiments OSM à masquer) et `src/scene/models.ts` (formes générées en code ou fichier glTF de `public/models/`)
- Fontaine en formes simples (`src/scene/models/elephants.ts`) : bassin circulaire de ≈ 13 m (contour OSM), socle, 4 avant-trains d'éléphants dos à dos, trompes qui crachent l'eau, colonne, statue du général ; hauteur totale 17,65 m (Wikipédia)
- Orientée dans l'axe de la rue de Boigne (37°), agrandie ×1,3 pour rester lisible dans le diorama
- Proportions à l'œil (pas de plans) ; détails non reproduits (ornements, inscriptions, forme exacte de la statue)

## Itération 8 — 28/09/2026

**Demande de Dasco :** ticket backlog « cycle jour/nuit : fenêtres éclairées, bars mis en avant la nuit ».

**Changements :**
- Nouveau module `src/scene/daynight.ts` : heure 0–24 h, soleil (position, couleur, intensité), lune la nuit, lumière d'ambiance, exposition, dégradé de fond
- Contrôle d'heure en bas à gauche : curseur + bouton ▶ (une journée en 2 minutes)
- Fenêtres éclairées dans le shader des bâtiments (grille 3 m × 3,2 m, allumage pseudo-aléatoire)
- Rues et places avec une légère lueur chaude la nuit
- Bars/clubs, restaurants, cafés : épingles qui s'allument + halo de taille décroissante
- Réglages après essais : moins de fenêtres allumées, lueur des rues réduite, crépuscule plus lumineux

**Correctif (signalé par Dasco) :** bars et cafés n'étaient plus cliquables. Cause : le calque des halos de nuit était devenu le premier élément du groupe, et le clic ne testait que ce premier élément. La détection cible désormais les épingles elles-mêmes, quel que soit l'ordre.

## Itération 7 — 28/09/2026

**Demande de Dasco :** ticket backlog « effet tilt-shift ».

**Changements :**
- Post-traitement (`src/scene/tiltshift.ts`) : flou gaussien séparable en espace écran, bande nette calée sur le point visé par la caméra
- Intensité selon la distance : maximale en vue d'ensemble, réduite à 25 % de près
- Étiquettes des parcs et de la Leysse dessinées après le flou (restent lisibles)
- Rendu dans une cible multi-échantillonnée (anticrénelage conservé)
- Bouton « 📷 Effet maquette » en bas à gauche, activé par défaut, choix gardé dans le navigateur

## Itération 6 — 28/09/2026

**Demande de Dasco :** ticket backlog « alléger `city.json` ».

**Changements :**
- Le choix du toit (rectangle / squelette / plat) est désormais fait une seule fois, dans le script (`scripts/roofs.mjs`) ; l'app ne fait que dessiner
- Plus de squelette stocké pour les bâtiments à toit rectangulaire
- Squelettes : on ne stocke plus les sommets de l'emprise (déjà présents), seulement les sommets intérieurs
- `city.json` : 1 649 → 1 220 Ko (−26 %), 472 → 361 Ko compressé (−23 %) ; rendu identique
- Détail : les cabanes (`hut`) passent en toit plat, comme les abris (2 bâtiments)

## Itération 5 — 28/09/2026

**Demande de Dasco :** ticket backlog « toits en pente sur les bâtiments irréguliers ou en L — squelette droit ».

**Changements :**
- Squelette droit calculé dans le script de données avec la librairie `straight-skeleton` (CGAL en WebAssembly, licence MIT) : 1 698 squelettes, 4 échecs
- Rendu des toits à pans dans l'app (`skeletonRoofGeometry`), y compris autour des cours intérieures (château, îlots du centre)
- Les toits rectangulaires (itération 4) restent prioritaires pour garder des pignons et de la variété
- Résultat : 1 700 toits en pente sur 2 067 bâtiments (contre 1 030)
- `city.json` passe de 0,76 à 1,6 Mo (470 Ko compressé)
- ⚠️ Nouvelle dépendance : relancer `npm install`

## Itération 4 — 28/09/2026

**Demande de Dasco :** ticket backlog « toits en pente sur les petits bâtiments ».

**Changements :**
- Nouveau module `src/scene/roofs.ts` : rectangle orienté minimal de l'emprise, puis toit à deux pans, quatre pans ou pyramide, avec léger débord
- Critères : emprise sans cour intérieure, 12 à 900 m², au moins 82 % du rectangle englobant (65 % si tag OSM) ; garages, abris, auvents restent plats
- Tags OSM `roof:shape` et `roof:height` récupérés par le script de données et respectés quand présents
- Résultat : 1 030 toits en pente sur 2 067 bâtiments

## Itération 3 — 28/09/2026

**Demande de Dasco :** outil de placement en mode dev pour saisir les positions des lieux.

**Changements :**
- Outil de placement (dev uniquement, absent du build) : touche P / bouton 📍, épingle, coordonnées `pos` + GPS à copier
- Affectation à un lieu existant avec aperçu de la gemme, ou création d'un nouveau lieu (brouillon)
- Enregistrement direct dans `src/content/pois.json` via un petit endpoint du serveur Vite ; la vue et l'outil sont conservés après le rechargement
- Nouveau champ `draft` sur les lieux : visibles en dev, masqués en production

## Itération 2 — 28/09/2026

**Retours de Dasco sur la v1 (vraies données) :** « pas mal du tout » ; positions des lieux imprécises (il les reprendra) ; artefacts noirs sur le sol ; la Leysse à améliorer ; afficher le nom des parcs (ex. le Verney).

**Changements :**
- Artefacts noirs corrigés : triangles des rues orientés vers le bas (vus de dos) + acné d'ombre
- Trottoirs séparés masqués (≈ 400 tronçons en moins)
- Scintillement des toits superposés supprimé
- Leysse : berges, eau animée, largeur réelle exagérée, ponts au-dessus
- Étiquettes des parcs et cours d'eau (Parc du Verney, Clos Savoiroux, La Leysse…)

**Questions ouvertes :** ❓ flèches vertes (axes) visibles sur la capture — ne viennent pas du code, extension navigateur ?

## Itération 1 — 28/09/2026

- Cadrage : Chambéry, style diorama 3D, exploration libre, public = Dasco et ses amis
- Squelette Vite + TypeScript + Three.js
- Script de données OSM (bâtiments, rues, verts, eau, arbres, bars)
- 8 lieux d'histoire rédigés à partir de sources citées
- Mécanique de découverte, progression, journal
