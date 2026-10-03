# Plan EP005 : avatar, déplacement et caméra qui suit

Auteur : sub-agent chercheur (aucun code modifié). Date : 2026-10-02. Périmètre : l'avatar, son chemin, la caméra, les entrées, la découverte des lieux. **Hors périmètre** : l'effacement des bâtiments qui masquent l'avatar (étudié ailleurs).
Mesures marquées « (mesuré) » : scripts jetables lancés sous Node sur `public/data/city.json` (graphe construit avec les options des passants), rien dans le dépôt. « Non vérifié » = lu mais pas essayé dans le navigateur.

## Résumé

- Faisable sans modèle tiers ni nouvelle dépendance : l'avatar réutilise la silhouette des passants (`people.ts`), agrandie ×2 environ, avec ombre en tache et anneau de destination.
- Le graphe de `walkways.ts` suffit pour une v1, **à condition de corriger trois points** : l'accrochage doit viser la plus grande composante (la cathédrale se rattache sinon à un îlot de 3 nœuds), la zone interdite de 15 m autour de la fontaine, et la rive nord-est coupée du reste (982 nœuds) quand `avoidWater` est actif.
- Chemin : A* sur ≈ 5 000 nœuds en 0,15 ms en moyenne, 0,9 ms au pire (mesuré) : le coût est négligeable. Départ et arrivée sont des points sur une arête (pas seulement des nœuds).
- Caméra : on translate cible et caméra du même vecteur à chaque image (rotation et zoom restent libres), valeurs par défaut ≈ 85 m et 57° d'inclinaison ; l'effet maquette suit tout seul car il vise `controls.target`.
- Estimation : 5 à 8 sessions en 6 user stories (hors transparence des bâtiments) ; risques principaux : réseau coupé, caméra basse dans un bâtiment, ergonomie mobile.

## Faits vérifiés dans le code

Réseau (`src/scene/walkways.ts`)
- `Edge` / `Walkways` : `{to, len, lift, w, name}` et `{x, y, adj}`, `walkways.ts:28-29`. Un nœud par point OSM, voies qui se croisent = nœuds partagés (`:34-43`).
- Exclusions : types de voies (`:48`), tronçons dans l'eau hors ponts (`:55`, `waterTest` `:69-96`), tronçons qui passent sous un bâtiment ou à moins de `clearance` d'une façade (`blocker` `:116-140`, test tous les 2 m, `underBuilding` `:129`), zones `avoid` (`:134`).
- `mainComponent` (`:169`) = plus grande composante ; `largeComponents(g, min)` (`:188`) = toutes celles ≥ `min` nœuds.
- Le type `Road` n'a ni `tunnel` ni `covered` : `{kind, w, pts, name, bridge}` (`src/types.ts:44`). L'eau a `covered` (`types.ts:46`) mais `waterTest` ne le regarde pas.
- Hauteur de pose : `heightAt(x, y) + edge.lift` (`people.ts:456`) ; lifts dans `roads.ts:14,17` (chemin 0,14 · rue 0,18 · pont 0,9).
- Le graphe est construit à chaque appel : herd (`mascot.ts:230`, appelé `main.ts:127`) et passants (`people.ts:135`, `main.ts:136`). Réglages des passants : `life.json` → `people.network` (escaliers exclus, `clearance` 1, `avoidWater`, zone 15 m autour de `elephants`). Éléphants : `mascot.json` (`clearance` 2,2, même zone).

Passants (`src/scene/people.ts`)
- Silhouette : `bodyGeometry()` (`:65`, jambes + torse, 1,7 m, `HIP` `:59`) et `headGeometry()` (`:80`), non exportées. Jambes animées dans le shader via `aLeg` / `aSwing` (`:157-168`).
- 3 `InstancedMesh` (corps, tête, ombre) = 3 appels de rendu pour tous les passants (`:169-181`).
- Cap lissé (`:451-453`), orientation `q.setFromAxisAngle(up, heading)` avec position `(x, ground, -y)` (`:459-460`), ombre en tache (`:464-466`).
- Foule recentrée sur `view.focus()` = `controls.target` (`people.ts:204-212`, `main.ts:136`) : elle suivra l'avatar sans rien changer (idem oiseaux, fumée, noms de rues : `main.ts:147,157,177`).
- `blobShadow()` est exportée (`mascot.ts:163`). Éléphant : 4,5 m, zone de clic `Box` 7 × 5,5 × 4,5 (`mascot.ts:299`).

Caméra (`src/scene/stage.ts`)
- Perspective 30°, near 5 (`:29`) ; `minDistance` 70 (`:38`), `maxPolarAngle` 1,22 rad (`:41`), `minPolarAngle` 0,12 (`:40`) ; tactile `ONE: PAN`, `TWO` désactivé (`:45`).
- `clampTarget` : cible clampée aux bornes, `target.y = heightAt` (la caméra ne suit pas ce dy), caméra relevée à ≥ sol + 30 m **sous elle seulement**, pas selon les bâtiments (`:66-75`).
- `flight` annulé par l'événement `start` des contrôles (`:86`) ; `flyTo(x, z, distance=380)` (`:87`), `zoomTo` (`:95`), `updateFlight` (`:110-124`, interpole cible et position).
- Ombres : `shadowMap.autoUpdate = false` (`:16`) : un objet mobile ne peut pas projeter d'ombre (blob obligatoire).
- Boucle : `stage.updateFlight` → `controls.update` → `clampTarget` (`main.ts:435-437`), puis détection de mouvement de caméra (`:438-442`), tickers (`:445`), `tiltShift.update(controls.target, size*1.2)` (`:446`). Cadence 30 img/s au repos sauf `moving()` ou caméra qui bouge (`:393-426`).
- Effet maquette : `projected = focus.project(camera)`, bande nette clampée à [0,2 ; 0,8] de l'écran, force = `dist / zoomRef` clampée [0,25 ; 1] (`tiltshift.ts:132-141`). Ici `zoomRef` ≈ 1 590 m : à 85 m, force minimale (0,25, flou léger).

Entrées (`src/interaction.ts`, `src/scene/touch.ts`)
- `pointerdown` mémorise un point (`interaction.ts:68`), `pointerup` ne fait rien si déplacement > 6 px (`:70`), donc clic ≠ glisser est déjà tranché.
- Double toucher (320 ms, 30 px) = `zoomAtScreen` (`:71-79`, `:62-65`), lance un rayon sur `city.group` (sol + bâtiments : `main.ts:347`, one-shot).
- Ordre actuel : outil de placement (`:80`) → éléphant `hunt.click` (`:81`) → `onSelect(pick())` gemme / épingle / vide (`:82`, `main.ts:351-355`). Survol : seulement souris (`:86-88`), éléphant puis `pick` (`:103-111`).
- Gestes à deux doigts : `touch.ts:23-59` (compteur de doigts privé `touches`, `:13`).
- Gemmes : zone de clic cylindre r = 14 m (`markers.ts:28`), `GEM_HEIGHT = 42` (`:6`) ; épingles de bars : `markers.ts:171-173`. Nom caché si non découverte : `main.ts:357`. `openPoi` (`main.ts:298-310`) marque découvert, `flyTo`, ouvre la fiche.
- Aide à l'écran : `ui.ts:96-100` (texte distinct tactile / souris). OrbitControls : gauche = tourner, droit = déplacer (`ui.ts` le dit) ; `touch-action: none` sur le canevas (`style.css:20`).
- Mini-jeu : `hunt.click` renvoie true si le geste vise un éléphant (`hunt.ts:140-159`) ; marche → il s'enfuit (`:143`), épuisé → catch + `flyTo` (`:144-157`).

Mesures sur `city.json` (graphe = options des passants)
- 5 751 nœuds, 5 846 arêtes, 92 composantes dont 4 008 + 982 nœuds ; 250 nœuds isolés ; 1 047 nœuds en impasse (degré 1) ; arêtes : médiane 6,6 m, p95 35 m, max 150 m ; 38 arêtes de pont.
- La grande composante couvre tout le socle ; la 2e (982 nœuds) couvre x ∈ [-221 ; 662], y ∈ [190 ; 583] (secteur nord-est) et **n'est pas reliée** à la 1re. Sans `avoidWater` : 5 043 nœuds d'un seul tenant. Cause exacte : non vérifiée (hypothèse : tronçons coupés par `waterTest`, y compris près de la Leysse couverte, voir plus bas).
- Escaliers inclus : 4 263 + 1 008 (111 voies `steps`, dont 7 ponts) : gain modeste. `clearance` 0,5 ou 0 : 4 072 + 992 / 4 077 + 1 004, gain modeste.
- Distance à la voie : 54 % de la grille (pas 25 m, bâtiments compris) à moins de 10 m, 80 % à moins de 20 m, 91 % à moins de 30 m. Centres des 47 places : médiane 4 m, 6 à plus de 25 m, 2 à plus de 30 m (32 et 55 m). Lieux bars/cafés : médiane 7 m, p90 14 m, max 36 m.
- Lieux d'histoire : distance au réseau 0 à 17 m (château 5, Boigne 1, Saint-Léger 0, théâtre 13, fontaine 15, Curial 16, musée 17, cathédrale 17). **La voie la plus proche de la cathédrale appartient à un îlot de 3 nœuds** ; la fontaine est à 15,4 m du plus proche nœud (zone interdite 15 m).
- A* (200 paires aléatoires dans la grande composante) : 0,15 ms en moyenne, 0,93 ms max ; détour médian 1,33 × la ligne droite, p90 1,93 ×. Construction du graphe : ≈ 530 ms (Node, ce poste), déjà payée deux fois au chargement ; mobile non mesuré.

## Analyse par thème

### 1. Réseau de déplacement
- **Utilisable tel quel pour la v1 ?** Oui pour ≈ 4 000 nœuds (rive principale), avec trois corrections :
  1. *Rive nord-est coupée* (982 nœuds). Un avatar libre doit pouvoir aller partout. Piste : ignorer les lignes d'eau `covered` dans `waterTest` (une rue peut passer sur la Leysse couverte, `types.ts:46`) et/ou ne tester l'eau que hors ponts voisins. Étape 1 du plan : script de diagnostic qui liste les arêtes retirées par l'eau et les relie à la carte. Sinon repli : `avoidWater: false` (5 043 nœuds connexes) mais l'avatar pourrait traverser une rivière hors pont : à contrôler.
  2. *Zone interdite autour de la fontaine* : 15 m pensés pour un éléphant de 4,5 m. Pour l'avatar, réduire à ≈ 9 m (bassin ≈ 13 m de diamètre ×1,3 : à vérifier) pour qu'on puisse approcher la fontaine, enjeu du mini-jeu.
  3. *Choix de la composante* : toujours accrocher dans la composante de l'avatar (grande composante), jamais au plus proche tout court (cas de la cathédrale).
- **Escaliers** : exclus pour les passants (`life.json`). Un humain monte les escaliers : les inclure pour l'avatar (+123 nœuds, un peu plus de liens) ; vitesse réduite possible. Décision produit (question 5).
- **Ponts** : arêtes `bridge` (lift 0,9) présentes, 38 ; rien à faire. Sous un pont : pas de voie, donc pas de problème de superposition.
- **Passages sous porche / traboules** : retirés par `blocker` (`:129`) et non récupérables sans donnée : `Road` n'a pas de tag `tunnel` / `covered`. Hors scope v1 ; amélioration possible côté `scripts/` (non étudiée).
- **Impasses (18 % des nœuds)** : acceptables ; l'avatar s'arrête au bout. Part d'artefacts (arêtes retirées par `blocker`) non vérifiée.
- **Places et surfaces** : le graphe n'est pas dense sur les places (arêtes médianes 6,6 m, mais 20 % de la carte à plus de 20 m d'une voie). Recommandation : **marcher sur les arêtes seulement** + « dernier mètre » : si le clic est à ≤ 15 m d'un point du réseau et que le segment direct ne coupe aucun bâtiment (test `underBuilding`/`pointInRing`, à exposer depuis `walkways.ts`), l'avatar quitte l'arête en ligne droite. Surfaces libres (navmesh de place) : hors v1, coût élevé, gain faible (80 % déjà à ≤ 20 m).
- **Clic → point d'arrivée** : 1) rayon caméra, 2) point sol (xz), 3) point le plus proche sur toutes les arêtes de la composante de l'avatar (index en grille de 25 m, comme `roads.ts:23-46` mais sur les arêtes du graphe), 4) refus si distance > ≈ 40 m (toast « Pas par là » + anneau rouge). 40 m couvre 100 % des lieux d'histoire et ≈ 98 % des bars (max 36 m, mesuré).
- **Point de départ** : l'avatar est toujours sur une arête (`from`, `edge`, `s`), pas forcément sur un nœud : le chemin ajoute deux nœuds virtuels (A* depuis les deux extrémités de l'arête de départ avec coût initial ; cas « même arête » traité à part).

### 2. Recherche de chemin
- A* classique, heuristique euclidienne, tas binaire, tableaux typés ; coût mesuré 0,15 ms (moyen) / 0,93 ms (max) sur le graphe de 5 751 nœuds : aucun souci, même ×10 sur mobile (non mesuré).
- Pondération : réutiliser `Edge.w` (préférence des rues piétonnes) en divisant la longueur par `w` pour le coût, mais pas pour l'animation (vitesse).
- Lissage : pas de string-pulling en v1 (nécessiterait une ligne de vue contre bâtiments et eau). Arrondir seulement les angles aux carrefours (cercle de ≈ 1,5 m ou Chaikin sur la polyligne), et lisser le cap comme `people.ts:451-453`. Le détour médian (×1,33) et les arêtes de 6,6 m rendent un tracé en dents de scie peu visible.
- Re-clic en marchant : replanifier depuis la position courante (arête + abscisse), garder le cap (lissé : pas de demi-tour sec). Coût négligeable ; ignorer les clics à < 2 m de la destination actuelle.
- Arrivée : décélération sur les 3 derniers mètres, puis pose « debout » (jambes immobiles, balancement lent comme `people.ts:444-448`).
- Chemin invalide (destination dans une autre composante) : refusé à l'accrochage, jamais à A*.

### 3. Avatar
- **Forme** : silhouette des passants (`bodyGeometry` + `headGeometry` à exporter de `people.ts`), fusionnée en une seule géométrie à couleurs de sommets, 1 `Mesh` (pas d'instanciation utile pour un seul exemplaire), jambes animées par le même shader (extraire le `onBeforeCompile` en fonction partagée). Teinte vive et unique (une couleur absente de `CLOTHES`, `people.ts:61`) pour se distinguer des 300 passants.
- Pas l'éléphant (4,5 m, déjà acteur du jeu, licence CC BY) ; pas de modèle tiers : aucune licence à ajouter au README. (L'essai de personnages animés a été abandonné, EP001-US010.)
- **Taille** : caméra 30° ⇒ hauteur vue = 0,536 × distance. Pour un écran de 900 px : 24 px/m à 70 m, 11 px/m à 150 m, 56 px/m à 30 m. Une silhouette de 1,7 m fait 41 px à 70 m mais 19 px à 150 m ; à 700 px de haut (téléphone portrait) 15 px à 150 m. Recommandation : **échelle ×2** (3,4 m ⇒ 38 px à 150 m sur PC, ≈ 30 px sur téléphone), réglable (`avatar.json`), plus un **anneau de repérage** (ou petite flèche) sous les pieds, lisible à 150 m. Échelle ×2 est une licence de maquettiste : l'avatar dépasse les passants ; question 1.
- **Orientation et animation** : cap lissé (réutiliser le code `people.ts:451-453`), jambes en `sin(phase)` avec foulée dépendant de la vitesse (la vitesse choisie est bien plus grande que 1,4 m/s, voir question 1 : il faudra une foulée plus longue que `STRIDE = 1,3` m, `people.ts:270`, à régler à l'œil), petit rebond vertical (`people.ts:460`).
- **Ombre** : tache `blobShadow` (`mascot.ts:163`) ; pas d'ombre portée (voir `stage.ts:16`).
- **Marqueur de destination** : anneau plat qui pulse sur le point d'arrivée (1 maillage, comme `ring` des gemmes `markers.ts:35-36`).
- **Rendu** : +3 appels de rendu (corps+tête, ombre, anneau) ; aucune texture neuve hors `blobShadow` déjà existant. Mesurer avec `?debug` (perfhud : appels de rendu, `main.ts:193`).

### 4. Caméra qui suit
- **Principe** : un « rig » : à chaque image, avant `controls.update` (`main.ts:436`), calculer `delta = avatar - controls.target` lissé (`1 - exp(-dt·k)`, k ≈ 6) et l'ajouter à `controls.target` **et** à `camera.position`. L'offset (distance, angles) est ainsi conservé : l'utilisateur garde rotation et zoom libres. Ajouter aussi le `dy` du relief à la caméra (aujourd'hui `clampTarget` change `target.y` sans la caméra, `stage.ts:70` : sur 92 m de dénivelé l'angle dériverait). Fonction `stage.follow(point, dt)` + `stage.setFollow(on)`.
- **Mode et valeurs par défaut** : entrée en mode balade = vol de la caméra vers distance ≈ 85 m, inclinaison polaire ≈ 1,0 rad (57°, hauteur ≈ 46 m, au-dessus du plancher de 30 m `:73`). Cap conservé (ou nord-ouest comme `lobbyView`, `main.ts:408`). Valeurs à régler à l'œil.
- **Limites** : en v1, ne pas toucher `minDistance` 70 ni le plancher de 30 m (`stage.ts:38,73`). Essai à faire en étape 5 : `minDistance` ≈ 45 m en mode balade seulement (plancher de 30 m conservé : la vue devient plus plongeante qu'aujourd'hui). Risque : la caméra, un simple point, peut se trouver dans le volume d'un bâtiment haut (cathédrale ≈ 25 m, autres non vérifiés) ; près plan = 5 m (`:29`), comportement non vérifié. La transparence des bâtiments traite le masquage de l'avatar, pas la caméra dans un bâtiment : à signaler à l'autre étude.
- **Effet maquette** : aucune modification nécessaire : la cible suit l'avatar, il est donc au centre de la bande nette (`tiltshift.ts:134`). Option : viser `target.y + 1,5 m` pour centrer le corps plutôt que les pieds (non vérifié).
- **Vols** : `flyTo` et `zoomTo` interpolent la cible (`stage.ts:110-124`) : ils se battent avec le suivi. Règle : le suivi est suspendu tant qu'un vol est en cours (exposer `stage.isFlying()`), reprend à la fin. `openPoi` (`main.ts:308`) ne doit pas appeler `flyTo` en mode balade (l'avatar est déjà arrivé là). Le vol d'attrapage d'un éléphant épuisé (`hunt.ts:156`) reste permis (c'est une mise en scène).
- **Quitter / reprendre la caméra libre** : bouton « Vue libre » / « Balade » dans l'interface ; pan (clic droit, 1 doigt) = quitte le suivi sans fermer la balade, avec un bouton « Retrouver mon avatar » qui refait un vol vers lui. Boussole inchangée (`resetNorth`, `stage.ts:105`, tourne autour de la cible : marche avec le suivi).
- **Cadence** : la caméra qui bouge force déjà la pleine vitesse (`main.ts:438-441`) ; l'avatar fournit aussi `moving()` pendant la marche (sinon les 30 img/s au repos du `Ticker` le saccadent à l'arrêt de la caméra). Après arrêt de l'avatar : retour à 30 img/s.

### 5. Conflits d'entrées
- **Règle proposée (priorité décroissante)** pour un clic ou toucher *court* (≤ 6 px, `interaction.ts:70`) : 1) outil de placement (dev) ; 2) éléphant (inchangé, `hunt.click`) ; 3) gemme / épingle (`pick`) ; 4) sinon **sol : marcher**. Un glisser garde son sens actuel (tourner à la souris, déplacer au doigt).
- **Gemme ou épingle cliquée en mode balade** : l'avatar y va (point accroché le plus proche) ; la fiche s'ouvre à l'arrivée (point 6). Hors mode balade : comportement actuel inchangé (fiche immédiate + `flyTo`) : aucun changement pour qui ne choisit pas la balade.
- **Éléphant** : clic sur éléphant garde son effet immédiat en v1 (le jeu reste jouable depuis n'importe où). Les épingles gardent la fiche au survol côté souris (`main.ts:360-363`).
- **Souris** : clic gauche court = marcher, glisser = tourner (inchangé), clic droit glisser = déplacer. Survol du sol : curseur « marcher » et petit anneau de prévisualisation (rayon sur le terrain par pas de 5 m + dichotomie sur `heightAt`, ≈ 0,05 ms, car `city.group` est un maillage fusionné non indexé : lancer le rayon dessus à chaque mouvement serait trop cher, coût non mesuré).
- **Rayon du clic** : pour un clic, lancer le rayon sur `city.group` comme le double toucher (`interaction.ts:63`, une fois) pour obtenir le point sous un toit (le point xz va ensuite à l'accrochage) ; repli sur le terrain si pas de touche.
- **Mobile** : un doigt aujourd'hui = déplacer la carte (`stage.ts:45`). Proposition : **toucher = marcher, glisser un doigt = déplacer la carte (et quitter le suivi)**, deux doigts inchangés. Conséquences : (a) le **double toucher zoom** (`interaction.ts:71-79`) est désactivé en mode balade (le 1er toucher aurait déjà lancé la marche) ; le pincer reste ; (b) l'aide `ui.ts:96-100` change en mode balade ; (c) après un geste à deux doigts, ignorer le `pointerup` : `down` est écrasé par le 2e doigt (`interaction.ts:68`), un pincement quasi immobile pourrait passer pour un toucher (non vérifié) ; il faut exposer l'état des doigts de `touch.ts`. Alternative à tester : un doigt = tourner (`ONE: ROTATE`) en mode balade.

### 6. Découverte des lieux
- **Règle proposée** : cliquer une gemme envoie l'avatar ; à l'**arrivée**, la fiche s'ouvre (`openPoi` sans `flyTo`). Arrivée = avatar à ≤ ≈ 20 m de la gemme (les 8 lieux sont à 0-17 m du réseau, mesuré, rayon de clic existant 14 m `markers.ts:28`) ou au point accroché.
- **En passant à côté** : sans clic, aucune fiche automatique (elle interromprait la balade) ; seulement une réaction légère à ≤ 25 m (la gemme pulse plus fort, bulle « Un lieu mystère est tout proche »). Non obligatoire en v1 (question 2).
- **Lieux mystère** : le nom reste caché (`main.ts:357`) jusqu'à l'ouverture de la fiche ; l'infobulle de survol ne change pas ; la gemme sert d'indice, la balade devient la façon de la trouver. Rien d'inventé : positions inchangées (règle projet 1).
- **Bars / cafés** : épingle cliquée = l'avatar va devant l'établissement ; fiche épinglée à l'arrivée (`openPlace(i, true)`, `main.ts:313`) ; survol souris inchangé.
- **Mini-jeu des éléphants** : v1 = inchangé. Pas de collision avatar / éléphant. Option (US dédiée, décision de Dasco) : pour attraper un éléphant épuisé, l'avatar doit s'approcher à ≤ 8-10 m ; l'avatar qui s'approche d'un éléphant qui marche le fait sursauter (`startle` existe, `hunt.ts:137`).
- **Progression** : rien à changer (`state/progress`, `saveDiscovered` via `openPoi`). Position de l'avatar : non sauvegardée en v1.

## Recommandation

1. Opt-in : la caméra libre reste le mode par défaut ; un bouton « Balade » apparaît à côté de la boussole et crée l'avatar sur le point regardé (accroché à la grande composante).
2. Un seul graphe partagé : `buildPeople` expose le sien (ou un module `network.ts` le construit une fois pour passants + avatar) pour ne pas payer une 3e construction (≈ 0,5 s sur PC, mobile non mesuré) ; options avatar ≈ celles des passants avec corrections 1.1 à 1.3 ci-dessus.
3. Avatar = silhouette des passants ×2 + anneau + tache d'ombre, 3 appels de rendu.
4. Caméra : suivi par translation du rig, 85 m / 57° par défaut, rotation et zoom libres, pan = quitter le suivi.
5. Entrées : priorité éléphant > gemme / épingle > sol ; mobile : toucher = marcher.
6. Fiche à l'arrivée ; jeu d'éléphants inchangé en v1.

## Plan en étapes

Branche : une branche par user story `feat/EP005-US00X-<description>` ; spec déjà sur `docs/EP005-balade-avatar-spec`. Vérifier chaque étape avec `?debug` (compteur de perf, appels de rendu) et `npm run build` ; navigateur de test = rendu logiciel, temps non représentatifs (mesures GPU : voir mémoire « tests perf avec GPU »).

1. **Diagnostic réseau** (script jetable, pas de commit) : arêtes retirées par `waterTest` / `blocker`, pourquoi la rive nord-est (982 nœuds) est coupée, point d'accrochage de chacune des 8 gemmes et des 169 lieux dans la grande composante, impasses artificielles. Décide du réglage final (ignorer `covered` dans `waterTest` ? `avoidWater` ? zone de la fontaine). Fichiers : lecture de `walkways.ts`, `city.json`. Si un correctif de données est nécessaire : `scripts/` puis `npm run data -- --offline` (règle 2).
2. **Réseau partagé** : sortir la construction du graphe commune (`src/scene/network.ts` ou export depuis `people.ts`) ; exposer de `walkways.ts` : index d'accrochage (arêtes en grille de 25 m), `pointInBuilding(x, y)` pour le dernier mètre. Vérifier : `[passants] … nœuds` identique dans la console avec `?debug`.
3. **Chemin** : `src/scene/avatar-path.ts` : accrochage (point sur arête + refus > 40 m), A* avec nœuds virtuels, polyligne, arrondi des angles, replanification. Vérification : fonction de test en console (`window.diorama`), 20 destinations dont les 8 gemmes, temps A*.
4. **Avatar** : `src/scene/avatar.ts` : exporter `bodyGeometry` / `headGeometry` (`people.ts`), fusionner, shader de jambes partagé, anneau, ombre, `update(dt)`, `moving()`. Réglages dans `src/content/avatar.json` (échelle, vitesse, foulée, couleur, rayon d'accrochage). Brancher dans `main.ts` (tickers `:372-389`). Vérifier : visibilité à 30, 70, 150 m (captures), appels de rendu +3, pas de baisse d'img/s.
5. **Caméra qui suit** : `stage.ts` : `setFollow`, `follow(point, dt)`, `isFlying()`, `dy` du relief, `enablePan`, plancher ; bouton « Balade / Vue libre / Retrouver » dans `ui.ts` ; entrée en balade par vol vers 85 m / 57°. Vérifier : suivi lisse à vitesse maximale, rotation et zoom pendant la marche, vol de gemme, boussole, bande nette de l'effet maquette, plancher de 30 m, essai `minDistance` 45 m.
6. **Entrées** : `interaction.ts` : clic sur le sol → `onWalk(point)` après l'éléphant et la gemme ; hover sol + anneau de prévisualisation ; double toucher désactivé en balade ; ignorer le `pointerup` après geste à deux doigts (état exposé par `touch.ts`) ; aide `ui.ts`. Vérifier à la souris et en émulation tactile (testé sur un vrai téléphone : non fait).
7. **Découverte** : `main.ts` : en balade, `onSelect` d'une gemme / épingle → marche puis fiche à l'arrivée, sans `flyTo` ; indice « lieu mystère proche » (option). Vérifier les 8 lieux, un lieu mystère, une épingle de bar.
8. **Éléphants (optionnel)** : approche à ≤ 8-10 m pour attraper ; test avec `?debug` (panneau des éléphants).
9. **Clôture** : `FEATURES.md`, `BACKLOG.md`, `CHANGELOG.md` (Vérifié / Non vérifié), `DECISIONS.md` (dont un ADR « réseau de déplacement partagé » et « caméra par translation du rig »), `README.md` (Structure du code, commandes), `?debug` : affichage de l'état de l'avatar.

## Découpage en user stories

| US | Titre | Points | Dépend de |
|---|---|---|---|
| US001 | Réseau partagé et chemin (diagnostic, accrochage, A*, suivi de chemin) | 8 | – |
| US002 | Avatar visible (silhouette, ombre, anneau, animation, `avatar.json`) | 5 | US001 |
| US003 | Caméra qui suit (mode balade, entrer / quitter / retrouver, vols, effet maquette) | 5 | US002 |
| US004 | Entrées : clic / toucher / glisser, double toucher, mobile, survol | 5 | US001, US003 |
| US005 | Découverte des lieux à l'arrivée (gemmes, mystères, bars) | 3 | US004 |
| US006 | Avatar et éléphants (approche, sursaut) : optionnelle | 3 | US004 |
| US007 | Mise au point : mobile, perf, réglages à l'œil, documentation | 3 | toutes |

US001 à US004 sont le minimum pour une balade utilisable ; US005 donne le sens de jeu.

## Estimation et incertitudes

- Fourchette : **5 à 8 sessions** (1 session ≈ une demi-journée) : US001 1,5-2 · US002 0,5-1 · US003 1-1,5 · US004 1-1,5 · US005 0,5 · US006 0,5-1 (option) · US007 0,5-1. Hors transparence des bâtiments (autre étude, dépendance forte pour que la balade soit agréable).
- Incertitudes principales : réseau coupé et ses corrections (1 session de plus si le pipeline `scripts/` doit changer) ; réglage à l'œil de la caméra et de la vitesse (itérations avec Dasco) ; comportement tactile réel (non testé sur un téléphone) ; mesures de perf sur GPU à refaire avec Chrome for Testing (mémoire du projet) ; coût de construction du graphe sur mobile (non mesuré).

## Risques

| Risque | Gravité | Parade |
|---|---|---|
| Une partie de la carte inaccessible (rive nord-est, îlots) | haute | Étape 1 ; message « Pas par là » ; en dernier recours, avatar limité à la grande composante, documenté |
| Caméra à ≥ 30 m du sol mais dans le volume d'un bâtiment haut | moyenne | Test sur la cathédrale et le château ; coordonner avec l'étude de transparence ; ne pas baisser le plancher en v1 |
| Mobile : toucher qui lance une marche après un pincement, ou conflit avec le double toucher | moyenne | Désactiver le double toucher en balade, état des doigts partagé avec `touch.ts` |
| Vol de caméra (`flyTo`) qui lutte avec le suivi | moyenne | Suivi suspendu pendant un vol, `isFlying()` |
| Cadence : avatar qui saccade à l'arrêt de la caméra (30 img/s au repos) | basse | `moving()` pendant la marche |
| Avatar ×2 incohérent avec les passants et l'éléphant | basse | Réglable, anneau de repérage, décision de Dasco (question 1) |
| Construction du graphe plus longue au chargement | basse | Graphe partagé (étape 2) |
| Chemin en dents de scie sur des polylignes irrégulières | basse | Arrondi des angles ; string-pulling reporté |
| Régression du jeu des éléphants | basse | Priorité éléphant conservée, comportement hors balade inchangé |

## Questions ouvertes pour Dasco

1. **Vitesse et taille** : une balade « à l'échelle réelle » (1,4 m/s) serait trop lente (500 m en 6 min). Proposition : avatar ×2 et ≈ 14 m/s (500 m en ≈ 35 s), réglables. D'accord pour une vitesse de maquette ?
2. **Fiche des lieux** : fiche ouverte seulement quand on a cliqué la gemme et qu'on est arrivé ? Proposition : oui, plus un petit signe discret (« lieu mystère tout proche ») à moins de 25 m, sans ouverture automatique.
3. **Balade facultative ou par défaut ?** Proposition : bouton « Balade » (opt-in) ; la caméra libre actuelle reste le mode par défaut, notamment pour la session de test avec les amis ; on peut basculer plus tard.
4. **Éléphants** : cliquer un éléphant garde son effet immédiat en v1 ? Proposition : oui ; « s'approcher pour l'attraper » en story optionnelle après la v1.
5. **Escaliers et passages couverts** : l'avatar peut-il emprunter les escaliers (les passants non) ? Proposition : oui pour les escaliers (111 voies), non pour les passages sous bâtiment (pas de donnée aujourd'hui).
6. **Mobile** : en balade, un doigt = déplacer la carte (et quitter le suivi, avec un bouton « Retrouver mon avatar »), ou un doigt = tourner la vue ? Proposition : déplacer (cohérent avec la carte actuelle), à tester sur téléphone.
