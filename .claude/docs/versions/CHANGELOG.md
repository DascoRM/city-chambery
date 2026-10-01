# Journal des itérations

## Itération 57 — 01/10/2026 (branche `feat/EP001-US004-pigeons`, empilée sur `feat/EP001-US003-fenetres-soiree`)

**Demande de Dasco :** « c'est top, tu peux avancer » (PR #16 ouverte pour l'US003), puis US004.

**Changements :**
- `src/scene/birds.ts` : pigeons et oiseaux faits en code (corps, tête, queue, deux ailes plates), un seul maillage instancié, battement d'ailes dans le shader, ailes repliées au sol ; aucun asset tiers ;
- **pigeons** : 40 en volées de 4 à 9 sur les places (espaces `plaza` d'au moins 300 m², hors du bassin de la fontaine) dans un rayon de 300 m autour du point regardé ; ils picorent et font quelques pas ; toutes les 40 à 90 s une volée s'envole, tourne au-dessus de la place puis se pose sur la même (60 %) ou une autre place proche ; quand on change de quartier, les volées hors du rayon y volent (si on les voit) ou y sont replacées (sinon) ;
- **oiseaux qui tournent** : 8 au-dessus de la cathédrale et du château, à 32-46 m, battements puis vol plané ;
- **de jour seulement** : fondu quand la nuit tombe ; ×0,5 sur téléphone ; taille ×2,5 (un vrai pigeon serait invisible à l'échelle de la maquette) ;
- `src/content/life.json` → `birds`.

**Vérifié :** `npm run build` ; Chrome avec carte graphique : 7 volées et 40 pigeons au sol à 13 h, 8 oiseaux au-dessus des monuments ; envols observés (jusqu'à 17 pigeons en vol en même temps sur 100 s) ; invisibles à 23 h, de retour à 13 h ; après un saut vers le Carré Curial, 28 pigeons sur 40 déjà dans le rayon, les autres en vol vers lui ; **coût : +1 appel de rendu**, cadence au repos inchangée ; aucune erreur console ; captures d'une volée au sol (après correction : ailes d'abord déployées au sol, repliées maintenant).

**Non vérifié / limites :** les pigeons sont petits et souvent cachés par les immeubles ou les arbres (on les voit surtout sur les grandes places, vue plongeante) ; la nuit, une volée en vol au moment du coucher reste figée en l'air (invisible) et repart au matin ; téléphone.

## Itération 56 — 01/10/2026 (branche `feat/EP001-US003-fenetres-soiree`)

**Demande de Dasco :** faire l'US003 (fenêtres qui s'allument et s'éteignent au fil de la soirée).

**Changements :**
- `src/scene/daynight.ts` : la part de fenêtres allumées (`uLit`) suit une **courbe horaire** (`windows.litCurve` de `life.json`) au lieu de ne dépendre que du soleil : 35 % à 18 h, 40 % à 22 h, 20 % à minuit, 5 % à 4 h, 20 % au réveil à 7 h, 10 % à 9 h ; les fenêtres restent invisibles le jour (multipliées par `uNight`, inchangé) ;
- le shader (inchangé) allume une fenêtre quand son hachage est sous `uLit` : quand la part baisse, **elles s'éteignent une à une, toujours dans le même ordre, sans clignoter** ;
- `src/scene/curve.ts` : `curveAt` (courbe horaire bouclant sur 24 h) partagée avec les passants ;
- aucun maillage ni appel de rendu en plus : seule la valeur d'un uniforme change.

**Vérifié :** `npm run build` ; Chrome avec carte graphique, en hiver, même vue de la rue de Boigne : 18 h 30 (environ un tiers des fenêtres allumées), 4 h (quelques-unes), 7 h (environ une sur cinq, avant le lever de 8 h 13) ; aucune erreur console ; trois captures dans la spec (`assets/fenetres-hiver-*.png`).

**Non vérifié :** l'été (nuit courte, la courbe s'applique aux seules heures sombres) ; la lecture ▶ complète à l'œil ; téléphone.

## Itération 55 — 01/10/2026 (branche `feat/EP001-US002-rythme-jour-nuit`)

**Demande de Dasco :** passer à l'US002 (la foule suit l'heure, groupes devant les bars ouverts).

**Changements (`src/scene/people.ts`, `src/content/life.json`, `main.ts`) :**
- **foule des rues selon l'heure** : courbe `dayCurve` (part des 300 passants) : 5 % de 0 h à 5 h, 40 % à 7 h, 80 % à 8 h, 100 % à 12 h, 90 % à 17 h, 25 % à 22 h ; à l'heure du chargement la foule est déjà là ; ensuite au plus 25 naissances ou départs par demi-seconde ;
- **arrivées et départs hors champ** : un nouveau passant naît sur une voie hors de l'écran quand c'est possible (sinon il grandit en fondu) ; un passant en trop continue de marcher et s'éteint dès qu'il sort du champ, ou s'efface en fondu s'il reste visible plus de 15 s ;
- **groupes de 2 à 5 silhouettes** de 20 h à 3 h (montée et descente sur 1 h 30), au plus 12 (×0,5 sur téléphone), devant les lieux **ouverts** d'après leurs horaires (OSM ou provisoires, US011) et à moins de 25 m d'une voie : bars, pubs (poids 1), boîtes de nuit (1,5), restaurants (0,5), cafés (0,3), jamais les glaciers ; tirage stable par lieu, lieux près du point regardé ; en arc, tournés vers l'entrée, avec un léger balancement ;
- **à la fermeture**, le groupe repart à pied sur la voie (dans un sens ou l'autre) puis disparaît hors champ ;
- **légende** : décocher une catégorie efface ses groupes en fondu (Q8) ; les passants des rues ne sont pas concernés ;
- 60 instances de plus réservées aux groupes (même maillage, aucun appel de rendu en plus).

**Vérifié (Chrome avec carte graphique, caméra sur la fontaine) :** foule mesurée = foule attendue à 12 h (300), 3 h (15), 8 h (240), 18 h (210), 23 h (45) ; à 23 h, 8 groupes (27 silhouettes), chacun à 4 à 13 m de son lieu (bars, pubs, un restaurant, un café) ; « Bars » décochée : 1 groupe reste (un café), recochée : 9 groupes ; à 4 h : groupes partis à pied, plus personne debout 25 s plus tard ; balayage rapide 12 h → 2 h → 18 h → 5 h → 23 h → 9 h : 180 passants à 9 h comme attendu ; coût inchangé (≈ 2 400 appels de rendu, 30 images/s au repos) ; aucune erreur console.

**Non vérifié / à noter :** **la nuit, les silhouettes sont très sombres** (aucune lumière propre) : les groupes se devinent plus qu'ils ne se voient, surtout dans les rues étroites ; à regarder à l'œil, une petite lueur des halos sur eux est possible si besoin. L'écart réel au lieu dépend de la voie la plus proche (pas la porte). Téléphone.

## Itération 54 — 01/10/2026 (branche `feat/EP001-US001-passants`, documents seulement)

**Demande de Dasco :** essai d'un personnage animé du pack Kenney (en mode `?debug`), puis d'un personnage Mixamo « Rigged Character » ; finalement : « laisse tomber, pas rentable, garde les personnages que tu as modélisés ».

**Résultat : US010 abandonnée.** Kenney : « très cartoon », marchait « de côté » (**erreur de ma formule d'orientation**, corrigée et vérifiée avant l'abandon). Mixamo : proportions réalistes mais aucune animation de marche dans le fichier, 4 864 triangles et 65 os pour un seul personnage ; il a fallu une marche de remplacement calculée dans le code pour le voir bouger. Détail et conseils si l'idée revient : `US010-personnages-animes.md`.

**Changements :** tout l'essai retiré : la branche `feat/EP001-US010-essai-personnage` supprimée (locale et distante, donc le pack Kenney de 3,3 Mo n'entre pas dans l'historique de `main`), aucun code d'essai ne reste (`main.ts`, `stage.ts`, `vite.config.ts` inchangés). Spec, epic et BACKLOG mis à jour. Les silhouettes de l'US001 restent.

**À noter :** ton fichier `assets-src/RIgged Character.fbx` est toujours là, non commité ; supprime-le si tu n'en as plus besoin.

## Itération 53 — 01/10/2026 (branche `feat/EP001-US001-passants`, documents seulement)

**Demande de Dasco :** ajouter une tâche pour intégrer les modèles de `assets-src/characters` aux passants ; « dis-moi si ok pour toi ».

**Changements :** US010 réécrite (de « option non planifiée » à planifiée), epic et BACKLOG mis à jour. Aucun code, aucun fichier du pack commité.

**Constats sur le pack (lus dans les fichiers) :** « Mini Characters 1.0 » de Kenney, **CC0** (`License.txt`) ; 12 personnages (6 femmes, 6 hommes) de 700 à 880 triangles ; squelette de **7 os** ; 32 animations dont `walk` (0,67 s) et `idle` (1,33 s) ; 0,67 unité de haut (× 2,54 pour 1,7 m) ; une texture de palette partagée ; 14 Mo au total, dont 8,8 Mo de FBX inutiles. Deux méthodes d'animation comparées dans la spec (instances avec matrices d'os cuites, ou personnages classiques près de la caméra).

**Non vérifié :** le rendu de ces personnages dans le diorama (c'est l'objet de l'essai).

## Itération 52 — 01/10/2026 (branche `feat/EP001-US001-passants`)

**Retour de Dasco :** « les PNJ peuvent marcher sur l'eau : il faudrait un système de hitbox pour qu'ils ne puissent pas marcher sur l'eau. »

**Changements :**
- `src/scene/walkways.ts` : option `avoidWater` : un tronçon de voie qui entre dans l'eau est retiré du réseau, **sauf sur les ponts** (voies marquées `bridge`). « Dans l'eau » = dans un plan d'eau (polygone) ou à moins de la demi-largeur du ruban d'une rivière (la largeur dessinée) ; points testés tous les 1,5 m ; un chemin sur la berge de pierre reste permis ;
- **la Leysse coupe alors le réseau en deux rives** (les croisements ne sont pas tous des ponts dans les données) : la plus grande partie passe de 59,5 à 48,1 km, une deuxième rive compte 982 nœuds ; plutôt que de ne garder que la plus grande, `largeComponents` (nouveau) garde **toutes les parties de plus de 100 nœuds** (`minComponent`) : chaque passant reste sur sa rive, les deux sont peuplées ;
- `src/content/life.json` : `avoidWater: true`, `minComponent: 100`.

**Vérifié :** mesure sur le réseau : tronçons hors pont dans l'eau 46 → 0 ; en direct, caméra centrée sur la Leysse, 8 relevés sur 40 s : **0 passant dans l'eau sur 300** (témoin, interdiction désactivée : 6 sur 300, donc le test voit bien le problème) ; les passants longent les quais ; aucune erreur console ; `npm run build`.

**Non vérifié :** les éléphants : leur réseau compte aussi 43 tronçons hors pont dans l'eau (non modifié, ils n'étaient pas dans la demande) ; téléphone.

## Itération 51 — 01/10/2026 (branche `feat/EP001-US001-passants`)

**Demande de Dasco :** attaquer l'US001 (passants de jour). Premier essai vu par Dasco : « je vois bien des gens sur certains axes ».

**Changements :**
- `src/scene/people.ts` : 300 silhouettes de 1,7 m (jambes et torse, tête), couleurs de vêtements et de peau variées, jambes qui se balancent dans le shader, petit rebond, ombre « tache » ; 3 maillages instanciés ; ils marchent sur leur propre réseau de voies (`buildWalkways` : toutes les voies sauf les escaliers, à 1 m des façades, hors du bassin de la fontaine), vont plutôt tout droit, font parfois une pause de 2 à 6 s à un carrefour ; décor, non cliquables, sans lien avec le jeu ; pas de pleine vitesse forcée (la carte reste à 30 images/s au repos) ;
- **foule autour du point regardé** (règle R6 de la spec) : le réseau couvre 59,5 km de voies sur 65, donc 300 passants répartis partout faisaient un passant tous les 200 m (« certains axes ») ; ils se tiennent maintenant dans un rayon de 250 m autour de la cible de la caméra, et un passant qui en sort réapparaît sur une voie du rayon, hors du champ quand c'est possible (sauf après un grand saut de la caméra) ;
- `src/content/life.json` (réglages), `blobShadow` exportée de `mascot.ts` ; ×0,5 sur téléphone ;
- README, FEATURES, spec.

**Vérifié :** `npm run build` ; Chrome avec la carte graphique : réseau de 5 011 nœuds (partie principale) ; **coût : +3 appels de rendu, +0,02 M de triangles, 60 images/s en mouvement avec et sans passants** ; après des sauts de caméra (Saint-Léger, rue de Boigne), 296 à 300 passants sur 300 dans le rayon ; passants visibles autour de la fontaine, au zoom maximal ; aucune erreur console.

**Non vérifié :** téléphone ; qu'aucun passant ne traverse un bâtiment (même réseau que les éléphants, avec une marge de 1 m au lieu de 2,2 : à regarder) ; l'apparition hors champ à l'œil ; dans les rues étroites ils sont souvent cachés par les immeubles (comme le pied des façades).

## Itération 50 — 01/10/2026 (branche `feat/EP001-US009-fenetres-de-jour`)

**Retour de Dasco :** « c'est trop gris, il faut faire dans la même idée que le mode nuit ; ça fait très volet fermé en pleine journée. Donc pas verre sombre. »

**Changements (`src/scene/city.ts`, shader des façades) :** vitre **claire qui reflète le ciel** (bleu, plus clair en haut) au lieu du verre sombre, avec un **encadrement crème** d'environ 12 cm ; la nuit, les vitres éteintes redeviennent sombres (mélange selon `uNight`), les allumées ne changent pas ; portes inchangées.

**Vérifié :** `npm run build` ; dans Chrome avec la carte graphique, rue de Boigne, place Saint-Léger, théâtre à 14 h et 23 h, et une grande place (portes visibles) ; aucune erreur console ; triangles et appels de rendu inchangés.

**Non vérifié :** l'aube et le crépuscule (mélange jour / nuit des vitres), téléphone.

## Itération 49 — 01/10/2026 (branche `feat/EP001-US009-fenetres-de-jour`, empilée sur `feat/EP001-US007-US008-batiments`)

**Demande de Dasco (EP001-US009) :** fenêtres et portes visibles de jour ; « un verre sombre, juste du verre dans un premier temps, porte côté rue ».

**Changements :**
- `src/scene/city.ts`, shader des façades : la grille de fenêtres de la nuit (3 m × 3,2 m) est aussi dessinée **de jour, en verre sombre** (couleur du mur assombrie à 85 % vers un gris-bleu) ; la nuit, les fenêtres allumées restent aux mêmes endroits, les éteintes sont désormais en verre sombre au lieu de la couleur du mur ;
- **portes** : panneau brun de 1,2 × 2,3 m au rez-de-chaussée, environ une case de 3 m sur trois, **seulement sur les murs côté rue** : attribut par face `aStreet` calculé au chargement (devant du mur à moins de 9 m d'une voie, et pas dans un bâtiment voisin : un mur mitoyen n'en a pas), plus `aBase` (pied du bâtiment) pour la hauteur ; pas de fenêtre au rez-de-chaussée au-dessus d'une porte ; pas de porte sur les parties de bâtiment qui ne touchent pas le sol ;
- `src/scene/roads.ts` : `roadDistanceIndex` (distance à la voie la plus proche par grille), partagé avec les auvents (`facades.ts` n'a plus sa propre copie) ;
- README, FEATURES, BACKLOG, spec.

**Vérifié :** `npm run build` ; dans Chrome avec la carte graphique, à 14 h et 23 h (rue de Boigne, place Saint-Léger, théâtre) et au-dessus des 4 plus grandes places : fenêtres visibles de jour, nuit comme avant, portes visibles là où le pied des façades est dégagé ; 15 803 triangles de mur « côté rue » sur 117 579 ; **triangles et appels de rendu inchangés** (1,36 M, même maillage) ; aucune erreur console.

**Non vérifié / limites :** dans les rues étroites, le pied des façades est presque toujours caché par l'immeuble d'en face (la caméra reste à au moins 30 m du sol) : **les portes se voient surtout sur les places et les grandes rues** ; images/s non mesurées avant / après (le travail est dans le shader, par pixel de mur) ; mémoire : deux valeurs de plus par sommet des bâtiments ; téléphone.

## Itération 48 — 30/09/2026 (branche `feat/EP001-US007-US008-batiments`)

**Retour de Dasco :** « autant les auvents ça me va, autant les bâtiments non, je trouve que les autres sont mieux ; le seul truc c'est qu'ils n'ont pas de fenêtres et portes la journée. Supprime les obj buildings. »

**Changements :**
- **essai du bâtiment modulaire retiré** : `src/scene/modular.ts`, son branchement et son bouton dans `main.ts`, le réglage `prototype`, les 7 pièces de mur et de toit, l'option `slate` du script, les 3 captures de la spec ;
- **pack de bâtiments supprimé**, sauf ce qu'il faut aux auvents gardés : `assets-src/buildings` ne contient plus que `roof-flat-awning-b`, `roof-flat-awning-c` (`.obj` et `.mtl`) et `Textures/colormap.png` (28 Ko au lieu de 1,1 Mo) ; `buildings.json` réduit aux 2 pièces d'auvent ; `details.glb` régénéré (3,2 Ko) ;
- spec : US008 validée ; ancienne US009 (portes, balcons, climatiseurs, lucarnes du pack) **remplacée** par « fenêtres et portes visibles de jour », à faire dans le shader existant des façades, sans pack, à préciser avec Dasco ;
- README, FEATURES, DECISIONS.

**Vérifié :** `npm run buildings` puis `npm run build` ; dans Chrome avec la carte graphique : toujours 148 auvents posés, légende qui masque et remet ceux d'une catégorie, aucune erreur console ; plus aucune référence à l'essai dans `main.ts`.

**Non vérifié :** rien de visible n'a changé pour les auvents (même pièces, même réglages) ; pas de nouvelle capture.

## Itération 47 — 30/09/2026 (branche `feat/EP001-US007-US008-batiments`, essai du pack)

**Retour de Dasco sur les auvents :** « je vois un rectangle sur la partie basse du bâtiment, j'ai pas l'impression que le bâtiment est intégré ». Il choisit d'**essayer le pack autrement, sur un seul bâtiment** (fenêtres, porte, toit), avant de décider.

**Changements :**
- `src/scene/modular.ts` : le bâtiment OSM **101968677** (14,1 × 9,9 m, gouttière 10,4 m, toit 5,7 m, 4 côtés dégagés, à l'ouest, isolé) est masqué et remplacé par un assemblage de modules du pack : anneau de cubes à fenêtres sur les faces extérieures (modules étirés pour remplir exactement le rectangle), pilastres pleins aux angles, porte et balcon sur la façade côté voie, toit à quatre pans ; hauteur de toit tirée des données (sinon `roofHeight`) ;
- `src/content/buildings.json` : 7 pièces de plus (`wall-*`, `roof-gable*`) et le réglage `prototype` (`id: null` désactive l'essai) ; `scripts/convert-buildings.mjs` : option `slate` qui remplace l'ardoise très sombre du pack par le gris-bleu de la palette du diorama ;
- la nuit : les fenêtres (faces bleues) brillent avec `uNight` / `uLit` de la ville ; pas les toits (ils ont leur propre matériau) ;
- bouton « 🏠 Bâtiment d'essai » en dev ou avec `?debug` (vole vers le bâtiment) ;
- trois captures dans `specs/epics/EP001-la-ville-vit/assets/`.

**Essais qui ont échoué en route :** un premier bâtiment coincé entre de grands voisins (on n'en voyait qu'une colonne aveugle) → choisi un bâtiment isolé ; toit noir (ardoise du pack trop sombre) → recolorée ; trame de points sur les murs (réception d'ombre sur modules étirés) → supprimée ; toit qui brillait la nuit (le gris-bleu pris pour une fenêtre) → matériau séparé.

**Vérifié :** dans Chrome avec la carte graphique, avant / après sur les mêmes caméras (zoom maximal du jeu à 70 m et vue moyenne à 126 m), de jour (14 h) et de nuit (23 h) ; aucune erreur console ; **coût de l'essai : 44 instances, 1 156 triangles, 7 maillages (2 397 → 2 404 appels de rendu)**, cadence inchangée.

**Constats :**
- de jour, le diorama actuel n'a **aucune fenêtre visible** (elles n'apparaissent que la nuit, dans le shader) : le bâtiment d'essai se remarque donc beaucoup plus que ses voisins ; du coup **un seul bâtiment détaillé dans un quartier de boîtes** se voit comme une exception ;
- extrapolation : les 2 067 bâtiments refaits de la même façon donneraient environ 2,4 M de triangles en plus (aujourd'hui 1,4 M) et des dizaines de milliers d'instances : **infaisable tel quel sur mobile**, il faudrait une distance limite (seulement près de la caméra) et/ou seulement les façades côté voie ;
- les contours OSM sont irréguliers (ici un rectangle presque parfait) : un assemblage général demande des modules le long de chaque arête, des angles et des cours ;
- couleurs : le crème du pack est proche de la palette, les fenêtres bleues tranchent ; toits : recolorés.

**Non vérifié :** le rendu sur téléphone ; la décision de Dasco (en attente) ; un second bâtiment (façades plus complexes, contour irrégulier) ; le coût d'un groupe de 50 à 100 bâtiments.

## Itération 46 — 30/09/2026 (branche `feat/EP001-US007-US008-batiments`)

**Demande de Dasco :** réponses aux questions de la spec (Q1 à Q8) ; horaires fictifs pour les bars ; commencer par le pack de bâtiments (US007 puis US008) et lui faire un retour pour qu'il teste et donne son go avant la suite de l'epic.

**Changements :**
- spec EP001 mise à jour (questions tranchées, US011 ajoutée, US007 renommée, dossier `assets-src/buildings`) ;
- **US011** : `src/content/place-hours.json`, horaires fictifs pour 23 bars, pubs et boîtes de nuit sans horaires OSM ; ils ne servent qu'à l'éclairage de nuit (`main.ts` : deux listes d'états, la fiche garde les vrais horaires), jamais affichés ; ligne au BACKLOG pour le script de récupération des données du projet bar / restau de Dasco ;
- **US007** : licence vérifiée (« Building Kit » de Kenney, CC0 1.0) ; `npm run buildings` (`scripts/convert-buildings.mjs`, `scripts/lib/kenney-obj.mjs`, `src/content/buildings.json`) → `public/models/buildings/details.glb` (8 pièces, 13,9 Ko, 4,1 Ko gzip) ; palette PNG lue par les UV et écrite en couleurs de sommet ; pièces dédoublonnées (chaque pièce est répétée deux fois dans les `.obj`) ; échelle 4,2 m par unité (porte de 0,5 unité = 2,1 m) ;
- **US008** : `src/scene/facades.ts`, auvents sur la façade côté rue de chaque lieu dans un bâtiment : arête du contour proche d'une voie, pas mitoyenne, près du lieu ; hauteur de rez-de-chaussée ; couleur de la catégorie éclaircie d'un tiers ; masqués avec la catégorie dans la légende ; README, FEATURES, BACKLOG.

**Vérifié :**
- horaires provisoires, avec le vrai parseur : mardi 3 h tout fermé, mardi 23 h bars ouverts et boîte fermée, vendredi 1 h boîte ouverte, samedi 4 h boîte ouverte ;
- `npm run buildings` deux fois : fichier identique ; `npm run build` ;
- Chrome avec la carte graphique : 148 auvents posés sur 169 lieux (12 dans un bâtiment remplacé par un monument, 8 hors bâtiment, 1 sans façade côté rue), 6 maillages, aucune erreur console ; légende : décocher « Restaurants » masque leurs auvents, recocher les remet ; **coût : 2 371 → 2 377 appels de rendu, 1,46 → 1,47 M triangles, cadence inchangée** ; captures à 14 h et 23 h au zoom maximal du jeu (70 m) ;
- constat de rendu : les auvents du pack sont de petites **dalles plates** (pas des toiles inclinées), discrètes ; sur 148, seulement 26 sont visibles en ligne droite depuis une caméra basse dans l'axe de leur façade (les autres sont cachés par les immeubles d'en face) ; la nuit ils sont sombres (aucune lumière propre).

**Non vérifié :** que le dossier est bien le « Building Kit » (les noms des pièces correspondent, mais il n'y a pas de fichier de licence dans le dossier : Dasco confirme où il l'a téléchargé) ; le rendu sur téléphone ; la fiche d'un bar aux horaires provisoires (vérifié par lecture du code : elle lit les vrais horaires), pas à l'écran ; l'éclairage de nuit des bars avec les horaires provisoires, à l'écran ; les pièces convertie mais non utilisées (portes, balcon, climatiseurs, lucarne) : **le balcon extrait garde les deux faces du module** (4,8 m de profondeur), à reprendre en US009.

## Itération 45 — 30/09/2026 (branche `docs/EP001-la-ville-vit`, pas de code applicatif)

**Demande de Dasco :** regarder la spec de « la ville vit » ; choix : silhouettes simples d'abord, fenêtres, oiseaux, fumée et drapeaux (pas de voitures), décor sans interaction, et intégrer le pack de bâtiments (en détails de façade).

**Changements :** documents seulement : `specs/epics/EP001-la-ville-vit/` (`epic.md` et `US001` à `US010`), BACKLOG (section P2 renvoyée vers l'epic), DECISIONS.

**À retenir de la spec :**
- 9 user stories (34 points, ≈ 6 à 8 sessions), US010 en option ; budget de fluidité de l'epic : au plus +25 appels de rendu et +0,5 M de triangles, tout en instances ; les animations lentes (passants, pigeons, fumée, drapeaux) ne forcent pas la pleine vitesse (TI-02) ;
- **constat sur les données** : seuls 10 bars sur 25, 3 pubs sur 7 et aucune des 4 boîtes de nuit ont des horaires OSM (63 lieux sur 169 sans horaires, 2 illisibles) : « du monde devant les bars ouverts » ne suffirait pas ; proposition : groupes aussi devant les bars sans horaires, entre 21 h et 2 h, à poids réduit, déclarés décor (Q7) ;
- **constat sur le pack** : pièces Kenney colorées par une texture de palette (pas par des couleurs de matériau) : `convert-nature.mjs` ne suffit pas (US007) ; licence à confirmer (aucun fichier de licence dans le dossier) ;
- OpenStreetMap n'est pas interrogé pour les mâts de drapeaux ni les cheminées : les drapeaux dépendent d'une décision de Dasco (Q4), les cheminées sont du décor déclaré ;
- `uLit` (part de fenêtres allumées) ne dépend aujourd'hui que du soleil : une courbe horaire suffit pour US003.

**Vérifié :** nombres de lieux, horaires, voies et espaces lus dans `city.json` ; existence des pièces Kenney citées ; format et taille de la palette (512 × 512) ; valeurs de `uLit`, `OpenState` et saisons lues dans le code.

**Non vérifié :** la licence du pack Kenney ; l'échelle réelle des pièces (une unité ≈ un étage, à mesurer) ; le coût des passants et des détails (budgets à confirmer par la mesure) ; la taille de la plus grande partie connexe du réseau piéton sans les grandes rues (à mesurer en US001).

## Itération 44 — 30/09/2026 (branche `feat/EN-03-analyse-meshopt`, pas de code applicatif)

**Demande de Dasco :** EN-03, analyse de la compression meshopt des modèles (go / no go).

**Changements :** documents seulement : `.claude/docs/tasks/en03-meshopt-analyse.md` (mesures, essai, plan), BACKLOG (EN-03 fait, nouveau ticket **TI-04**), DECISIONS.

**Résultat : GO.** Modèles : 442 → 194 Ko gzip (−247 Ko, −56 %), décodeur +7,3 Ko, donc ≈ −240 Ko au premier chargement (≈ −23 %) ; précache hors-ligne −372 Kio ; et les modèles sont retéléchargés à chaque déploiement (l'empreinte des données change). Sans quantification, le gain tombe à −34 % sur les arbres et l'éléphant devient plus lourd : il faut quantifier, ce qui oblige à remettre la géométrie en flottants et en mètres au chargement (helper `gltf.ts`, sinon le shader de marche et `nature.ts` cassent).

**Vérifié :** essai complet dans une copie jetable (rien n'a été modifié dans l'appli) : 45 modèles rechargés avec le vrai chargeur, écart maximal 0,36 mm par rapport à l'original ; parc de 927 arbres : 0,0045 % des pixels au-delà de 8/255 ; éléphant correct à l'écran (corps, oreilles, défenses, pattes) ; décodage ≈ 2 ms par arbre, 9 ms pour l'éléphant ; aucune erreur console ; tailles du build mesurées (fichiers JS et précache).

**Non vérifié :** Safari / iOS et mobiles modestes (repli sans WebAssembly, temps de décodage) ; nuit, automne et hiver (seulement 14 h et arbres verts) ; service worker avec les fichiers compressés ; niveau `medium` de `meshopt()` ; éléphant comparé image par image (impossible : le hasard du troupeau diffère d'un chargement à l'autre, la preuve est la géométrie).

## Itération 43 — 30/09/2026 (branche `feat/TI-03-three-separe`)

**Demande de Dasco :** TI-03 pour finaliser le P1 (three.js dans un fichier JS séparé).

**Changements (aucun changement visible) :**
- `vite.config.ts` : `build.rolldownOptions.output.codeSplitting` met three.js dans son propre fichier (`three-<empreinte>.js`) ; l'appli garde son fichier `index-<empreinte>.js` ;
- avant : un seul fichier de 789 Ko (216 Ko gzip) ; après : appli 111 Ko (44,5 Ko gzip) + three.js 678 Ko (171,6 Ko gzip), soit 216,1 Ko gzip au total : le premier chargement ne change pas ;
- après une mise à jour de l'appli, seuls les 44,5 Ko gzip de l'appli changent (l'audit estimait ≈ 30 Ko) ; three.js garde son nom et reste en cache (nginx et Vercel : `assets/` en cache 1 an) ;
- l'avertissement « fichier de plus de 500 Ko » de Vite disparaît ;
- README : cache.

**Vérifié :** `npm run build` ; après une vraie modification du code de l'appli, `index-…js` change de nom et `three-Eow9QVYq.js` reste identique ; `index.html` précharge le fichier three (`modulepreload`) ; sur le build de production (`vite preview`), dans Chrome avec la puce graphique : la carte s'affiche avec et sans `?debug`, les 3 fichiers JS sont servis (200), compteur et panneau des éléphants présents avec `?debug`, aucune erreur de l'appli.

**Non vérifié :** le gain réel après une mise à jour sur un vrai serveur (nginx, Coolify, en-têtes de cache) ; le service worker (bloqué dans le test) : il devrait ne retélécharger que le fichier de l'appli, un fichier à empreinte inchangée étant gardé tel quel ; le temps de chargement (deux fichiers en parallèle au lieu d'un, non mesuré).

## Itération 42 — 30/09/2026 (branche `feat/TI-02-cadence-repos`)

**Demande de Dasco :** attaquer TI-02 (30 images/s au repos, pleine vitesse pendant les mouvements).

**Changements :**
- boucle de rendu (`main.ts`) : quand rien ne bouge, une image sur deux sur un écran 60 Hz (30 images/s) ; les éléphants, l'eau et les gemmes continuent de s'animer à cette cadence ;
- pleine vitesse quand : la caméra bouge (détecté en comparant sa position et son point visé d'une image à l'autre, donc vols, retour au nord, gestes et inertie compris), puis 0,5 s après ; dès que l'utilisateur prend la carte en main ; la souris bouge sur la carte (et 0,5 s après) ; lecture ▶ ; particules, fusées, bulle d'un éléphant, statue qui sort du socle, éléphant qui disparaît ou vole ; épingle qui rebondit ;
- chaque module concerné le dit par `moving()` (type `Ticker`) : épingles, horloge, mini-jeu, interactions ;
- `quality.ts` : ne mesure les images/s que pendant les mouvements (et pas la première image après le repos) ;
- compteur `?debug` : « repos (30 max) » ou « mouvement » sur la première ligne.

**Vérifié :** `npm run build` ; dans Chrome sans fenêtre **avec la carte graphique du Mac** (M1, et non le rendu logiciel), fenêtre 1 200 × 800 à densité 2, écran à 60 images/s : repos 30,0 images dessinées/s ; glisser la carte 59,8 ; souris qui bouge 55,8 ; lecture ▶ 59,0 ; clic sur un éléphant (fumée, bulle) 53,4 ; le compteur affiche le bon mode ; densité restée à 1,5 (maximum) pendant tout le test ; aucune erreur console.

**Vérifié par Dasco :** tout est fluide, aucun effet visible de la cadence à 30 images/s au repos. Doublons remarqués sur des bars / restaurants : doublons OSM (ajouté au BACKLOG).

**Non vérifié :** mobile et écrans 120 Hz (au repos, une image sur quatre, toujours 30 images/s en théorie) ; économie de batterie ou de chauffe (non mesurée). Non traité : le curseur d'heure tiré à la main reste à 30 images/s (lumière et ombres un peu moins fluides pendant qu'on le tire), à ajouter si c'est gênant.

## Itération 41 — 30/09/2026 (branche `feat/TI-01-mode-debug`)

**Demande de Dasco :** enchaîner TI-01 (mode dev / debug propre).

**Changements (aucun changement visible pour les visiteurs) :**
- `?debug` lu une seule fois (constante `DEBUG` dans `main.ts`) ;
- debug des éléphants (`dev/herd-debug.ts`) chargé à la demande (`import()`), comme l'outil de placement : il sort du fichier JS principal (fichier à part de 1,8 Ko, téléchargé seulement avec `?debug`) ;
- `window.diorama` n'existe plus en production, sauf avec `?debug`.

**Vérifié :** `npm run build` (fichier principal 789,6 → 788,0 Ko, 216,5 → 216,0 Ko gzip) ; dans Chromium (Playwright), en dev et sur le build de production (`vite preview`), sans et avec `?debug` : sans `?debug`, ni compteur, ni panneau des éléphants, ni téléchargement de `herd-debug`, et `window.diorama` absent en production (présent en dev) ; avec `?debug`, compteur de perf, panneau des éléphants (boutons « Voir » / « Épuiser » des 4 éléphants) et `window.diorama` présents ; aucune erreur console.

**Non vérifié :** les boutons du panneau des éléphants en action (seulement leur présence) ; le mode hors-ligne : le petit fichier `herd-debug` est gardé par le service worker comme les autres (1 Ko gzip de plus, sans importance).

## Itération 40 — 30/09/2026 (branche `feat/EN-02-reprise-main`)

**Demande de Dasco :** attaquer EN-02 (reprise de `main.ts`).

**Changements (aucun changement visible) :**
- boucle de rendu : un tableau de modules `{ update(dt, t) }` (type `Ticker` dans `types.ts`) remplace les appels écrits à la main ; ajouter un module (passants) = une ligne ; la caméra, la résolution adaptative et le rendu restent à part ;
- `src/interaction.ts` : sélection souris / doigt, survol (traité une fois par image), double toucher, gestes à deux doigts ; `main.ts` ne garde que ce qu'on fait d'un clic ou d'un survol (fiches, infobulle) ;
- `src/game/setup.ts` : mini-jeu (points et partie sauvegardés, places sur la fontaine, particules, message d'accueil) ;
- `hunt.ts` reçoit les réglages du jeu d'un bloc (`mascot.json` → `game`) au lieu de 5 valeurs une à une ; `mascot.json` converti une seule fois dans `main.ts` ;
- `main.ts` : 381 → 300 lignes ; README : structure du code.

**Vérifié :** `npm run build` (taille du JS inchangée : 789,6 Ko, 216,5 Ko gzip) ; dans Chromium (Playwright, rendu logiciel), avec `?debug` : jeu actif (4 éléphants, 4 places), survol d'une épingle de bar → fiche, clic → fiche épinglée, clic dans le vide → fermée, **clic sur la gemme de la fontaine → fiche d'histoire** (le test de l'itération 39 visait mal), clic sur un éléphant → il disparaît (`poof`, identique sur `main`), outil de placement en dev (P puis clic → position affichée) ; aucune erreur ni avertissement de l'appli dans la console.

**Non vérifié :** double toucher sur mobile : dans le navigateur de test, les deux touchers arrivent (`pointerup` × 2) mais la caméra ne zoome pas, **exactement pareil sur `main`** : limite du test ou bug antérieur, à vérifier sur un vrai téléphone ; gestes à deux doigts ; « chaque module dit s'il bouge » (prévu dans EN-02) laissé à TI-02, qui l'utilisera.

## Itération 39 — 30/09/2026 (branche `feat/EN-01-module-geo-voies`)

**Demande de Dasco :** lancer EN-01 (module commun géométrie et voies), prérequis de « la ville vit ».

**Changements (aucun changement visible) :**
- `src/scene/geo.ts` : `pointInRing`, `pointInPoly`, `segDist2`, `distToSegment`, `screenRay` ; remplace les copies de `nature.ts` et `markers.ts` et les 4 calculs « clic → rayon » (`main.ts` ×2, `hunt.ts`, `placement.ts`) ; `city.ts` et `mascot.ts` n'importent plus rien de `nature.ts` ;
- `src/scene/roads.ts` : `FOOT_KINDS`, hauteurs des rubans (`LIFT`), `roadLift()` ; plus de doublon entre `city.ts` et `mascot.ts` ;
- `src/scene/walkways.ts` : réseau des voies (graphe, obstacles, distance aux façades, plus grande partie connexe) sorti de `mascot.ts` ; grille des bâtiments construite par une seule fonction ;
- `scripts/geo.mjs` : point dans un polygone et distance à un segment pour `fetch-osm.mjs` et `bdtopo.mjs` ;
- `src/scene/models/mesh.ts` : `mesh()` commun aux 5 fichiers de monuments ; type `HeightFn` dans `types.ts` (7 réécritures) ;
- README : structure du code.

**Vérifié :** `npm run build` ; `npm run data -- --offline` → `city.json` identique à l'ancien hors `generatedAt` (fichier du dépôt conservé, pour ne pas publier de nouvelle version pour rien) ; dans Chromium, avant / après : même réseau des éléphants (3 717 lieux de réapparition sur 4 459 nœuds), clic sur un éléphant → il disparaît, survol d'une épingle de bar → la fiche s'affiche.

**Non vérifié :** clic sur la gemme d'un lieu (mon test automatique ne l'ouvre ni avant ni après : cible mal visée par le test, à vérifier à la main) ; double toucher sur mobile ; outil de placement en dev ; éléphants qui marchent à l'œil.

## Itération 38 — 30/09/2026 (branche `fix/audit-bugs`)

**Demande de Dasco :** corriger les bugs P0 de l'audit (BUG-01, BUG-02) ; review ensuite.

**Changements :**
- BUG-01 : `uplight()` / `glowAtNight()` (`models/lighting.ts`) et `uplight()` / `glowFlat()` (`models/elephants.ts`) passent intensité, hauteur, altitude du sol et couleur par des uniformes au lieu de les écrire dans le texte du shader ; les matériaux partagent toujours un programme, mais gardent leurs valeurs ;
- BUG-02 :
  - fiche des lieux et bulle : rectangle du canevas gardé en mémoire (recalculé au redimensionnement), taille de la fiche mesurée une fois par contenu, style réécrit seulement s'il change ;
  - particules : `update()` envoyait les 4 tableaux complets à la carte graphique **à chaque image, même sans particule** (3 000 étincelles + 400 fumées en permanence) ; désormais rien quand elles sont vides, seulement les vivantes sinon, couleurs seulement quand elles changent ;
  - épingle active : une seule instance envoyée, plus rien après le rebond ;
  - plus d'objets créés à chaque image : cap de la boussole, passes du tilt-shift, vol des éléphants, cibles du survol (calculées une fois), couleurs du cycle jour/nuit (pendant ▶) ;
  - mini-jeu : places de la fontaine selon `game.count`, avertissement console si le nombre d'éléphants ne correspond pas ;
  - code mort retiré : `weekday`, callback `onComplete`.

**Vérifié :** `npm run build` ; dans Chromium (rendu logiciel, Playwright) : à 23 h, uniformes lus dans le renderer pour chaque matériau — Carré Curial façades 0,9 / toits 0,35 / baies 0,5, château 1,0 / 0,4, cathédrale 1,0 / 0,5, fontaine pierre 0,9 (+1,6 statue) / bronze 0,6 (+3,2), altitude du sol propre à chaque monument (8,51 / 6,82 / 7,08 m) ; aucune erreur ni avertissement console au chargement.

**Non vérifié :** le rendu de nuit à l'écran (captures inutilisables : environ 5 s par image en rendu logiciel, la caméra ne s'est pas déplacée) ; fiche d'un bar qui suit son épingle, bulle de l'éléphant, particules et feu d'artifice, après les changements ; gain de fluidité (non mesuré).

## Audit avant nouveaux travaux — 30/09/2026 (pas de code applicatif)

**Demande de Dasco :** un audit rapide du projet avec les agents et les skills, pour voir ce qu'il y a à optimiser avant de commencer de nouveaux travaux ; puis ranger les suites en P0 (bugs), P1 (enablers et technical improvements) et P2 (reprise de « la ville vit »).

**Changements :**
- skills Three.js installés (`threejs-fundamentals`, `-geometry`, `-interaction`, `-animation`) et graphe de connaissances graphify (`graphify-out/`, ignoré par git) ;
- 3 audits en lecture seule par des sub-agents génériques (pas les agents du template) : rendu, qualité du code, données / chargement / déploiement → `.claude/docs/tasks/audit-2026-09-30-{rendu,code,donnees}-plan.md` ;
- BACKLOG : section P0 (BUG-01 éclairage de nuit, BUG-02 lot de petites corrections), P1 (EN-01 module commun géométrie et voies, EN-02 reprise de `main.ts`, TI-01 mode dev, TI-02 30 images/s au repos, TI-03 three.js séparé, EN-03 analyse meshopt), P2 « la ville vit » déplacée à la suite des enablers ; démarrage raté rattaché au launcher (P3) ;
- DECISIONS : nouvelle version à chaque déploiement, assumée ;
- `.gitignore` : `graphify-out/`.

**Vérifié :** `npm run build` passe (0 erreur de type, un seul fichier JS de 789 Ko / 216 Ko gzip) ; `npm audit --omit=dev` : 0 vulnérabilité ; mécanisme de BUG-01 confirmé dans le code de three.js 0.186 (`Material.customProgramCacheKey` = texte de `onBeforeCompile`) ; `generatedAt` bien inclus dans l'empreinte des données (`vite.config.ts`).

**Non vérifié :** BUG-01 à l'écran (rendu de nuit) ; les gains estimés (TI-03, double téléchargement du service worker) ; aucune mesure de temps (navigateur de test en rendu logiciel).

**Non retenu :** ombre figée des statues de la fontaine (non constatée par Dasco) ; `generatedAt` (voulu) ; fusion des monuments (reprise avec les bâtiments) ; double téléchargement à la 1re visite (pas grave pour l'instant).

## Organisation du suivi — 30/09/2026 (pas de code)

**Demande de Dasco :** réorganiser `claude/` dans le `.claude/` initialisé depuis un template, remplir le contexte et le `CLAUDE.md` ; les agents viendront ensuite.

**Changements :**
- `claude/` déplacé (historique git conservé) : `FEATURES.md` et `CHANGELOG.md` → `.claude/docs/versions/`, `BACKLOG.md` → `.claude/docs/versions/backlog/`, `DECISIONS.md` → `.claude/docs/architecture/decisions/`, `PERF-AUDIT.md` → `.claude/docs/architecture/` ; liens internes corrigés ;
- `claude/README.md` fondu dans `.claude/docs/context.md` (vision, utilisateurs, périmètre, stack, état, index des documents) ;
- `CLAUDE.md` racine fondu dans `.claude/CLAUDE.md`, réécrit pour le projet : règles projet, workflow hybride (itération / epic), clôture d'itération, section sub-agents « à définir » (agents du template non utilisés), checklist avant commit ;
- `.claude/docs/onboarding/getting-started.md` rempli avec les vraies commandes ;
- `README.md` et `.dockerignore` pointent vers `.claude/`.

**Non modifié :** `agents/` (les agents seront définis ensuite).

## Itération 37 — 30/09/2026

**Retour de Dasco sur le jeu :** bien : on met du temps à les trouver, animations, retour à la fontaine et feu d'artifice final ; la limite à 380 m peut rester (les éloigner davantage lui plaisait aussi, à revoir plus tard). À revoir : la bulle ne reste pas assez longtemps pour lire le message ; la disparition au survol est pénible, le premier réflexe est de cliquer.

**Changements :**
- survol : l'éléphant sursaute (petit bond) et trotte à 3,5 m/s pendant 3 s, pas plus ; c'est le **clic** (ou le toucher) qui le fait disparaître ;
- bulle affichée 6 s au lieu de 3,2 s ;
- réglages dans `mascot.json` → `game` : `bubbleSeconds`, `startleSpeed`, `startleSeconds`.

**Vérifié :** vraie souris : survol → il reste visible et repart ; clic → nuage et bulle, encore affichée 8 s plus tard dans le navigateur de test (plus lent que le temps réel).

**Non vérifié :** la vitesse de trot ressentie avec une vraie souris.

## Itération 36 — 30/09/2026

**Retour de Dasco :** impossible de trouver le dernier éléphant (bug ou pas ?), un « artefact » sur le 3e (capture : éléphant épuisé collé contre une façade) ; demande un mode debug pour les retrouver.

**Constat :**
- rien ne limitait les réapparitions au quartier : de fuite en fuite (jusqu'à 250 m chacune), un éléphant pouvait finir au bout de la carte, à plus de 600 m de la fontaine ;
- un bout de chemin peut toucher une façade ; un éléphant qui y réapparaît épuisé s'assoit à moitié dans le mur (probablement l'artefact vu sur le 3e, à confirmer par Dasco).

**Changements :**
- réapparitions limitées à `roamRadius` (380 m) autour de la fontaine, et seulement sur des nœuds dégagés : façade la plus proche à plus de `openSpace` (4,5 m) ; 3 717 nœuds sur 4 459 retenus ;
- mode debug (`?debug`, `src/dev/herd-debug.ts`) : faisceau coloré au-dessus de chaque éléphant, visible à travers les bâtiments ; panneau état / fuites restantes / distance à la fontaine, boutons « Voir » (vol de la caméra) et « Épuiser ».

**Vérifié :** 40 fuites simulées, la plus lointaine à 357 m de la fontaine ; panneau et faisceaux affichés.

**Non vérifié :** que l'artefact vu par Dasco est bien celui-là.

## Itération 35 — 30/09/2026

**Retour de Dasco sur l'itération 34 :** pas amusant, on n'arrive pas vraiment à le bloquer dans un coin, et la souris l'attrape trop facilement. Idées : il disparaît au survol et on le recherche ; un message pour narguer ; puis : quatre éléphants à ramener sur la fontaine, avec animation de retour et feu d'artifice.

**Décisions de Dasco :** transformation en bronze sur la fontaine ; progression gardée comme les lieux découverts ; nombre de fuites au hasard entre 1 et 5 ; indice avec le nom de la rue.

**Changements :**
- `src/scene/mascot.ts` réécrit en troupeau : réseau de voies calculé une fois et partagé ; 4 éléphants (matériaux propres, pour que chacun marche à son rythme) ; états promenade, disparition, caché, épuisé, en vol, rentré. Les mécaniques de fuite et de coin de l'itération 34 sont retirées.
- `src/game/hunt.ts` (remplace `catch.ts`) : survol ou toucher = disparition + bulle (phrase au hasard + rue de réapparition avec son article, ou direction) ; clic sur un éléphant épuisé = vol jusqu'à sa place (courbe, 2,4 s, rotation, caméra vers la fontaine) ; place qui sort du socle avec un rebond (transformation en bronze) ; points ; fontaine complète : bonus, grand feu d'artifice, nouvelle partie après 45 s.
- `src/scene/particles.ts` : particules (fumée, étincelles) et feux d'artifice (fusée avec traînée puis gerbe) ; couleurs saturées en mélange normal pour rester visibles de jour.
- `src/scene/models/elephants.ts` : les 4 éléphants de bronze nommés `elephant-0` à `elephant-3`.
- `src/state/herd.ts` : éléphants ramenés, gardés dans le navigateur. Compteur « ⛲ n / 4 » à côté des points ; bulle au-dessus de l'éléphant.
- `mascot.json` : bloc `game` remplacé (les réglages de fuite de l'itération 34, dont ceux modifiés par Dasco, n'ont plus d'usage).

**Vérifié dans le navigateur de test :**
- vrai survol de souris : disparition, nuage, bulle « La fontaine attendra encore un peu ! / Je file vers l'ouest 🐘 » ;
- éléphant épuisé avec ses étoiles ; vrais clics : les 4 éléphants ramenés, compteur 60 points (4 × 10 + 20), fontaine complète, feu d'artifice visible ;
- partie reprise après rechargement (éléphants déjà ramenés sur la fontaine, les autres dans les rues).

**Non vérifié :** le jeu en conditions réelles (fluidité, difficulté pour les retrouver), au doigt sur téléphone, et la nouvelle partie après 45 s (logique relue, pas observée).

## Itération 34 — 30/09/2026

**Demande de Dasco :** le mini-jeu « trouve l'éléphant ». Quand on essaie de cliquer ou de passer la souris dessus, il accélère ; il faut le diriger vers un coin ou un angle pour le bloquer ; bloqué, il fait un rebond et on peut l'attraper ; on gagne des points ; un compteur, réutilisable plus tard pour les bâtiments.

**Changements :**
- `src/scene/mascot.ts` : quatre états (promenade, fuite, coincé, attrapé) :
  - fuite : voie la plus éloignée de la souris à chaque carrefour, demi-tour si elle barre la route, sprint après un clic raté ;
  - coincé : quand toutes les issues d'un carrefour repartent vers la souris ; rebond avec écrasement, face à la souris ; il force le passage après 4 s ou si la souris s'éloigne ;
  - attrapé : grand saut en tournant, disparition, retour à la fontaine ;
  - zone de clic invisible plus large que le modèle ; réglages dans `mascot.json` → `game`.
- `src/game/catch.ts` : position de la souris sur la carte (plan à l'altitude de l'éléphant), toucher sur mobile (menace pendant 1,5 s), clic, score.
- `src/state/points.ts` + compteur 🐘 dans le cartouche (animation à chaque gain) ; messages : première fuite, « Coincé ! » (3 premières fois), « Attrapé ! +10 points ».
- Cercle interdit autour de la fontaine passé de 11 à 15 m : coincé près du bassin, l'éléphant se tournait et sa trompe entrait dans la margelle.
- README : commandes, section du mini-jeu, structure.

**Vérifié dans le navigateur de test :**
- un « joueur » simulé qui le pousse par derrière le coince en 4 à 120 s selon les essais, ou pas du tout en 2 min (il tourne alors sur une boucle de chemins) ;
- vrai clic de souris sur l'éléphant coincé : attrapé, compteur à 10, retour à la fontaine ;
- rebond visible entre deux images ; 30 min de promenade : jamais dans un bâtiment ni à moins de 15 m de la fontaine.

**Non vérifié :** le plaisir de jeu et la difficulté avec une vraie souris, et le jeu au doigt sur téléphone.

## Itération 33 — 30/09/2026

**Demande de Dasco :** le ticket « Mascotte (éléphant ?) qui se promène dans le diorama », avec le modèle déposé dans `assets-src/`. L'éléphant doit toujours marcher sur les chemins ou les routes.

**Modèle :** « Elephant » par jeremy (Poly Pizza, https://poly.pizza/m/9J-cG39KYFC), **CC BY 3.0** (licence vérifiée sur la page du modèle) : attribution obligatoire. Statique : pas de squelette ni d'animation ; 1 170 triangles, 4 couleurs, ≈ 64 Ko une fois converti.

**Changements :**
- `scripts/convert-mascot.mjs` (`npm run mascot`) : mètres, 4,5 m de haut, origine entre les pattes, trompe vers +X → `public/models/mascotte/elephant.glb`.
- `src/scene/mascot.ts` + `src/content/mascot.json` :
  - graphe des voies OSM (points partagés entre voies = carrefours), plus grande partie connexe gardée ; déplacement exact le long des segments, cap lissé ;
  - voies retirées : escaliers, tronçons sous un bâtiment, tronçons à moins de 2,2 m d'une façade, cercle de 11 m autour de la fontaine (le bassin du modèle déborde sur le chemin OSM) ; il reste ≈ 53 km de voies ;
  - choix aux carrefours : plutôt tout droit, préférence pour les rues piétonnes, retour vers la fontaine au-delà de 380 m ;
  - pauses de 4 à 8 s toutes les 20 à 45 s, départ et arrêt en douceur ;
  - marche animée dans le shader (pattes en quatre temps autour de la hanche, pied levé, dandinement, trompe, oreilles, queue) ;
  - ombre en tache : un objet qui bouge ne peut pas projeter d'ombre réelle (ombres à la demande, itération 25).
- `main.ts` : chargement, mise à jour dans la boucle, crédit « Éléphant : jeremy (Poly Pizza), CC BY 3.0 » ajouté à l'attribution en bas à droite.
- README : section Mascotte, commande, structure, licences.

**Vérifié dans le navigateur de test :**
- 30 min de promenade simulées : jamais dans un bâtiment, jamais à moins de 11 m de la fontaine, au plus ≈ 315 m de la fontaine ;
- captures : l'éléphant marche sur les rues, pattes et oreilles bougent d'une image à l'autre.

**Non vérifié :** l'allure de la marche en mouvement réel (le navigateur de test rend trop lentement pour juger la fluidité) et le coût sur téléphone (≈ 1 200 triangles, 4 appels de rendu : a priori négligeable).

## Itération 32 — 29/09/2026

**Demande de Dasco :** déploiement de test sur Vercel (https://city-chambery.vercel.app).

**Constat :** le site fonctionne tel quel (carte, mode hors-ligne, types de fichiers, compression Brotli), mais Vercel sert tous les fichiers avec `public, max-age=0, must-revalidate` : les règles de cache de `deploy/nginx.conf` ne s'appliquent pas.

**Changements :** `vercel.json` (build, dossier `dist`, cache 1 an pour `assets/` et pour `data/` et `models/` appelés avec `?v=`, `sw.js` / manifeste / page revérifiés) ; README, section Déployer.

**Non vérifié :** les nouveaux en-têtes, à contrôler après le prochain déploiement.

## Itération 31 — 29/09/2026

**Demande de Dasco :** l'épic *Heure et saison* (jour/nuit à l'heure réelle, saisons, lever/coucher réels, lieux ouverts la nuit).

**Changements :**
- **Heure réelle** (`src/time/chambery.ts`, `src/time/clock.ts`) :
  - par défaut, l'heure et la date de Chambéry (fuseau Europe/Paris, même depuis un appareil à l'étranger), relues chaque minute ;
  - bouton **Direct** (rouge quand actif) ; le curseur ou ▶ passent en heure choisie, Direct y revient ;
  - fréquence retenue pour les ombres : au plus une fois par minute en direct (le soleil n'y bouge que de ≈ 0,25°).
- **Vraie course du soleil** (`src/time/sun.ts`, `daynight.ts`) : azimut et hauteur calculés pour la date et l'heure. Le soleil se lève à l'est-sud-est, passe au sud, se couche à l'ouest ; il est bas l'hiver. Lever et coucher affichés dans la barre (↑07:31 ↓19:21 aujourd'hui). La lumière ne descend pas sous 7° (ombres trop longues sinon).
- **Saisons** (`src/time/seasons.ts`) :
  - puce Auto → Printemps → Été → Automne → Hiver ; une saison choisie prend une date typique (course du soleil de la saison) ;
  - feuillage : vert, automne (15 oct. – 30 nov.), branches nues (1er déc. – 14 mars) ;
  - parcs : 26 variantes du pack Quaternius converties (`CommonTree/BirchTree/Willow` `_Autumn_n` et `_Dead_n`) ; `nature.json` gagne `seasons`, `convert-nature.mjs` les convertit et recolore l'orangé ; les pins ne changent pas ;
  - arbres des rues : couronnes orangées à l'automne, petites couronnes brunes l'hiver.
- **Nuit : seuls les lieux ouverts s'allument** (`src/time/openinghours.ts`) :
  - lecture des horaires OSM : 104 / 106 lus. Les 2 non lus sont des textes libres ; ces lieux restent allumés, comme ceux sans horaires ;
  - épingle sans lueur et sans halo quand le lieu est fermé ;
  - fiche : « ● Ouvert à cette heure », « ● Fermé à cette heure » ou « Horaires inconnus ».

**Vérifié :**
- `tsc` et build OK.
- Lever/coucher calculés comparés au calendrier solaire de Chambéry (calendriergratuit.fr) : 29/09 07:32 / 19:22 contre 07:32 / 19:21 ; 21/06 05:47 / 21:29 contre 05:47 / 21:28.
- Horaires : 9 cas testés (après minuit, plusieurs plages, mois, jours `Su,Mo off`…).
- Navigateur :
  - direct à 22:31 → nuit ;
  - 9 h : soleil à l'est ; 13 h 30 : au sud ; 17 h : à l'ouest ;
  - automne et hiver : captures, arbres remplacés ;
  - 22 h 30 : 85 lieux allumés sur 169 ; 2 h : 65 ;
  - barre d'heure tenant sur iPhone 13 et iPhone SE.

**Limites :**
- Fériés, vacances scolaires et fermetures datées sont ignorés : l'horaire habituel du jour s'applique.
- Pas de neige : le pack n'a pas de variante enneigée des feuillus utilisés.
- Les dates de feuillage sont une approximation, pas une donnée.

## Itération 30 — 29/09/2026

**Demande de Dasco :** cache HTTP, données versionnées, mode hors-ligne.

**Changements :**
- **Données versionnées :**
  - `vite.config.ts` calcule au build une empreinte de `public/data/` et `public/models/`, injectée dans `__DATA_VERSION__` ;
  - `src/dataurl.ts` ajoute `?v=empreinte` à `city.json`, aux arbres et aux monuments en glTF ;
  - `deploy/nginx.conf` : une `map` sur `$arg_v` met les adresses avec `?v=` en cache 1 an (immutable) et laisse celles sans `?v=` revérifiées. Avec `REFRESH_DATA`, les données régénérées au build changent donc l'empreinte.
- **Mode hors-ligne (PWA)**, avec `vite-plugin-pwa` et `workbox-window` en dépendances de dev :
  - service worker en production uniquement : 33 fichiers (2,4 Mo : code, page, `city.json`, modèles, icônes) gardés dès la première visite ;
  - `?v=` ignoré par le cache du service worker ;
  - polices Google gardées en cache ;
  - `src/pwa.ts` : message « ✓ Carte disponible hors-ligne », et bandeau « Nouvelle version de la carte disponible · Mettre à jour » (pas de rechargement forcé) ;
  - manifeste, icônes (gemme sur socle, générées en PNG dans `public/icons/`), `theme-color`, `apple-touch-icon` : la carte est installable sur l'écran d'accueil ;
  - nginx : `sw.js` et `manifest.webmanifest` toujours revérifiés, type `application/manifest+json`.

**Vérifié** (build de production servi par nginx, avec la même configuration) :
- en-têtes : `?v=` → cache 1 an ; sans `?v=` → no-cache ; `sw.js` et manifeste → no-cache ;
- première visite → message hors-ligne, cache rempli ;
- réseau coupé puis rechargement → carte complète, sans erreur ;
- nouvelle version publiée → le bandeau apparaît.

**Limites :**
- Le service worker n'existe qu'en HTTPS ou sur localhost (règle des navigateurs) : rien sur `http://<ip-du-pi>:3000`, il faut passer par le domaine Coolify.
- Brotli n'est pas fait (pas dans l'image nginx standard, gzip suffit).

## Itération 29 — 29/09/2026

**Retour de Dasco :** testé depuis le serveur du Pi, sur le Mac : les **mouvements** saccadent (le chargement va bien). Suite de l'audit de performance, sans toucher aux monuments (toujours en attente).

**Changements :**
- `tiltshift.ts` réécrit, même rendu :
  - scène anticrénelée dessinée une fois ;
  - flou horizontal et vertical en **demi-résolution**, sans anticrénelage ;
  - une seule passe finale (mélange net / flou + rendu des tons + sRGB) ;
  - étiquettes dessinées par-dessus.
  Avant : `EffectComposer` avec 4 passes plein écran, toutes sur des cibles anticrénelées ×4 en demi-flottant. Anticrénelage ×2 au lieu de ×4 quand la densité est ≥ 1,5.
- Nouveau `quality.ts` : densité de pixels plafonnée à 1,5 (au lieu de 2), puis adaptée par pas de 0,25 selon les images/s (< 40 → baisse ; > 56 trois fois de suite → remonte).
- Nouveau `perfhud.ts` : compteur `?debug` (images/s, pire image, appels et triangles cumulés sur toutes les passes, densité, taille du rendu).
- Boussole : l'aiguille n'est réécrite que si l'angle change.

**Vérifié :**
- Rendu avant / après comparé pixel à pixel. Écart moyen : jour 0,4/255, vue moyenne 1,2/255, nuit 2,7/255. À l'œil, les images sont identiques ; les seules différences sont des fenêtres éclairées un peu plus douces dans les zones floues.
- Compteur : 2 398 appels, 1,46 M triangles, densité 1,5 sur un écran de densité 2.
- **Non mesuré :** le gain réel en images/s (pas de carte graphique dans l'environnement de Claude). À mesurer par Dasco avec `?debug` sur le Mac.

## Itération 28 — 29/09/2026

**Demande de Dasco :** un docker compose pour lancer facilement le projet avec Coolify.

**Changements :**
- `Dockerfile` en deux étapes : `node:22-alpine` lance `npm ci` puis `npm run build` ; `nginx:1.27-alpine` sert `dist/`. Healthcheck `wget`. Images multi-architecture, donc Pi 5 (arm64) compris.
- `deploy/nginx.conf` :
  - gzip ;
  - `assets/` en cache 1 an (immutable) ;
  - `index.html`, `.json` et `.glb` en `no-cache` (revalidation par ETag) ;
  - type `model/gltf-binary` pour les `.glb` ;
  - toute adresse inconnue renvoie `index.html`.
- `docker-compose.yml` : service `web`, `expose: 80`, sans `ports` (le proxy de Coolify suffit, pas de conflit de port sur le Pi).
- `.dockerignore` : contexte de build d'environ 2 Mo.
- README : nouvelle section « Déployer (Docker, Coolify) ».

**Vérifié :**
- Le build Node passe dans un contexte propre qui respecte `.dockerignore`.
- nginx (avec la même configuration) : `syntax is ok` ; en-têtes de cache et gzip conformes ; `city.json` de 1,4 Mo transféré en 405 Ko ; revalidation → 304 ; le site servi par nginx se charge sans erreur (18 modèles d'arbres, toutes les couches).
- **Non vérifié :** la construction de l'image Docker elle-même. Le registre Docker Hub est inaccessible depuis l'environnement de Claude.
- **Bloquant trouvé :** le `package-lock.json` de Dasco n'est pas à jour (il lui manque `@gltf-transform/functions`, et il a `meshoptimizer` 1.1.1 au lieu de 1.3.0). `npm ci` échouerait au build. Il faut lancer `npm install` puis commiter le lock.

**Correction (retour de Dasco, même jour) :** son `docker-compose.yml` repris donnait `services.web Additional property port is not allowed`.
- `port:` → `ports:` ;
- `'3000:3000'` → `'3000:80'`, car nginx écoute sur 80 dans le conteneur ;
- `version: "3.8"` retiré (obsolète avec Docker Compose v2).

Validé avec `docker compose config`.

**Correction 2 :** le build Docker échouait sur `npm ci` (lock pas à jour, comme prévu). `package-lock.json` a été régénéré avec `npm install --package-lock-only`, qui ne touche pas à `node_modules`. Il contient les binaires de toutes les plateformes, dont Alpine arm64 pour le Pi. `npm ci` puis `npm run build` vérifiés avec ce lock.

**Ajout (demande de Dasco) :** commandes pour lancer tout le projet.
- `package.json` : scripts `docker:up`, `docker:logs`, `docker:down`.
- README « Démarrer » réorganisé par scénario : développement, production (build/preview ou Docker), régénérer les données. Tableau de toutes les commandes, avec `npm run nature` et Docker. Il précise aussi que les données sont déjà versionnées, donc `npm run data` n'est pas nécessaire pour lancer le projet.

**Ajout (demande de Dasco) :** le build Docker lance toutes les commandes.
- Argument de build `REFRESH_DATA` (compose : `"true"`) → `deploy/refresh-data.sh` lance `npm run data` puis `npm run nature`.
- Filet de sécurité :
  - échec du téléchargement → `city.json` du dépôt gardé ;
  - BD TOPO ou RGE ALTI absent de l'attribution (le script retombe sinon sans erreur sur des estimations) → nouveau `city.json` rejeté.
- `.dockerignore` garde maintenant les `.obj` du pack (les `.fbx` restent exclus).

**Testé sans réseau :**
- repli sur `city.json` : fichier identique ;
- `npm run nature` : 18 `.glb` identiques à ceux du dépôt ;
- `npm run build` : OK ;
- contrôle d'attribution : accepte la carte complète, rejette une carte sans IGN.

**Non testé ici :** le chemin « tout réussit », car OSM et l'IGN sont inaccessibles depuis l'environnement de Claude.

## Itération 27 — 29/09/2026

**Besoin de Dasco (pas encore cadré) :** se déplacer sur la carte en mobile.

**Constat :** sur mobile, un doigt faisait tourner la maquette (réglage par défaut d'OrbitControls) et deux doigts zoomaient en déplaçant. On ne pouvait pas se déplacer d'un doigt, contrairement aux applis de carte.

**Cadrage (choix de Dasco) :** un doigt = déplacer ; deux doigts = zoomer, tourner, incliner ; double toucher = zoomer ; zoom plus proche ; boussole. Le bouton « Recentrer » n'a pas été retenu.

**Changements :**
- `stage.ts` :
  - `controls.touches` : ONE = PAN, TWO désactivé (gestes à deux doigts faits maison) ;
  - `minDistance` 120 → 70 ;
  - caméra ≥ 30 m au-dessus du sol ;
  - `zoomTo` (garde l'angle de vue), `heading`, `resetNorth` (rotation animée) ;
  - `flyTo` corrigé : la hauteur de la caméra se calcule maintenant depuis le sol visé et non depuis 0 (sur une colline, la caméra pouvait finir trop bas).
- Nouveau `touch.ts` : pincer (zoom), torsion (rotation autour du point visé, la carte suit les doigts), glisser vertical à deux doigts (inclinaison). Les trois gestes se combinent.
- `main.ts` :
  - double toucher (< 320 ms, < 30 px) : zoom à 45 % de la distance vers le point touché, ou vers le centre de la vue si on touche hors du socle ;
  - l'aiguille de la boussole est mise à jour à chaque image.
- `ui.ts` / `style.css` : boussole (en bas à droite sur ordinateur, sous le bandeau sur mobile) ; texte d'aide adapté au tactile ; `style.css` de Dasco conservé (ligne `pc-in` supprimée par lui).
- Premier essai à 40 m minimum : un téléphone ne montrait plus qu'un toit (environ 12 m de ville en largeur avec la focale longue). Valeur retenue : 70 m, à ajuster après essai.

**Vérifié** (gestes tactiles simulés, profil iPhone) :
- un doigt déplace sans tourner ;
- écarter zoome (6 300 → 2 230) ;
- une torsion de 34° tourne la carte de 34°, dans le sens des doigts ;
- glisser vers le haut incline (44° → 62°) ;
- double toucher zoome vers le point ;
- la boussole ramène le nord ;
- à la souris, glisser fait toujours tourner.

Le rendu logiciel est très lent : la fluidité des gestes reste à juger sur un vrai téléphone.

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
