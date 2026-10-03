# Plan : effacement des bâtiments et toits devant l'avatar (EP005, balade avec un avatar)

Auteur : chercheur / planificateur (aucun code modifié). Date : 02/10/2026. Les numéros de ligne sont ceux de la branche `docs/EP005-balade-avatar-spec`.

## Résumé

- Tous les bâtiments (murs et toits) sont **un seul maillage fusionné, un seul matériau, un seul appel de rendu**, sans identifiant de bâtiment dans la géométrie : on ne peut donc pas effacer UN bâtiment sans modifier la construction ; on peut en revanche effacer **une zone** en shader.
- Recommandation : un **« cutaway » en shader** (cylindre de vue caméra → avatar, fondu en pointillé / dither + `discard`), piloté par 2 uniformes, appliqué aux bâtiments, aux monuments modélisés et aux arbres, plus une **silhouette X-ray** de l'avatar (cheap, filet de sécurité). Les ombres restent la carte statique (aucun recalcul).
- Coût de rendu : 0 appel ajouté pour le cutaway, +1 à 3 pour la silhouette ; pas de passe transparente, pas de tri.
- Estimation : 1 à 1,5 session pour la phase 1 (cutaway + silhouette) ; +1 session si Dasco veut des bâtiments qui s'effacent « en entier » (phase 2, identifiant par bâtiment). Risque principal : l'aspect « bâtiment creux » et le coût du `discard` sur GPU mobile (non mesuré).
- À valider avec Dasco : effacement en trou pointillé ou bâtiment entier, arbres et monuments inclus, fantôme de l'avatar (silhouette).

## Faits vérifiés dans le code

**Structure des bâtiments**
- `buildBuildings()` (`src/scene/city.ts:231`) boucle sur `data.buildings`, saute ceux de `hidden` (bâtiments remplacés par un monument, `city.ts:261`), extrude l'emprise (`ExtrudeGeometry`, `city.ts:270`), ajoute un toit en pente (`city.ts:299-308`) puis **fusionne tout** : `mergeGeometries(geos)` (`city.ts:311`) → un `THREE.Mesh` nommé `buildings` (`city.ts:312-315`), `castShadow` et `receiveShadow` actifs. Données : 2 067 bâtiments, dont 1 028 avec toit « rectangle » (`rect`) et 679 avec toit à squelette (`skel`) (mesuré dans `public/data/city.json`) ; le reste a un toit plat (le dessus de l'extrusion).
- Murs et toits sont dans **le même maillage et le même matériau** : `windowsMaterial(night)` (`city.ts:346`), un `MeshStandardMaterial` (`vertexColors`, `flatShading`) patché par `onBeforeCompile`. Pas de maillage de toits séparé (`roofs.ts` ne renvoie que des géométries, fusionnées ensuite : `city.ts:301`, `305`).
- Attributs par sommet : `position`, `normal`, `color` (`city.ts:296`), `aStreet` et `aBase` (`faceAttrs`, `city.ts:242-258`). Le `uv` est supprimé (`city.ts:278`). **Aucun identifiant de bâtiment** : `b.id` (id OSM) sert seulement à choisir les couleurs (`city.ts:281-282`). Les ids OSM ne tiennent pas dans un `float32` exact, il faudrait un index 0..2066.
- Distinguer mur et toit : pas de drapeau, mais la normale suffit. Le shader des façades utilise déjà `abs(vWNormal.y) < 0.3` pour « mur » (`city.ts:376`) et la couleur de toit est choisie par `normal.y > 0.7` (`city.ts:288`). Les pans de toit en pente (33°, `roofs.ts:15`) ont `normal.y ≈ 0,84` ; les pignons sont de la couleur du mur (`roofs.ts:114-115`) ; le dessous du débord est dans la géométrie du toit avec une normale vers le bas (`roofs.ts:107-108`).
- Le shader a déjà la position monde par fragment : `vWPos` (varying, `city.ts:355`, `361`) et `vWNormal`. Le point d'insertion d'un `discard` y existe donc déjà. Uniformes `uNight` et `uLit` passés par `NightUniforms` (`city.ts:15`, `349-350`), mis à jour dans `daynight.ts:110-114`. Les fenêtres allumées sont uniquement de l'émissif calculé au fragment (`city.ts:401-405`) : un fragment supprimé ne s'allume pas, rien d'autre à faire.
- Géométrie **non indexée** (`toNonIndexed`, `city.ts:298`, `344`) : le nombre de sommets est triple du nombre de triangles ; nombre exact de sommets / triangles des bâtiments : non vérifié (à lire dans `?debug`).
- `ringGrid()` (`city.ts:330`) indexe les contours par cases de 25 m ; non exporté mais réutilisable pour un test « segment caméra → avatar contre les emprises » (phase 2). `pointInRing` : `src/scene/geo.ts`.

**Autres objets qui masquent**
- Monuments modélisés : objets séparés, chacun avec ses propres matériaux au niveau du module (`models/chateau.ts:41-44`, `models/cathedrale.ts:30-33`, `models/carrecurial.ts:30-34`) ; glTF : `models.ts:78`. Les bâtiments OSM qu'ils remplacent sont retirés du maillage (`hideOsm`, `models.ts:35-37`, `city.ts:261`).
- Arbres modélisés : `InstancedMesh` par modèle, matériau unique partagé (`nature.ts:34`, `111`). Arbres simples de la ville : deux `InstancedMesh` (canopée icosaèdre 3,4 m posée à 7,5 m de haut, tronc ; `city.ts:429-434`), donc jusqu'à ≈ 11 m × 1,4 d'échelle : ils masquent comme un petit bâtiment. En instancié, la position monde est `modelMatrix * instanceMatrix * position` : le code actuel de `city.ts:355` (`modelMatrix * transformed`) **ne convient pas tel quel** aux instances.
- Auvents instanciés sur les façades des bars (`facades.ts:129-134`, `castShadow = false`), épingles posées sur les toits (README, « Bars, cafés, restaurants »), cheminées sur les toits (`chimneys.ts`) : ils resteraient en l'air au-dessus d'un toit effacé. Leurs positions et matériaux : non vérifiés au-delà du README.

**Ombres, caméra, post-traitement**
- Une seule carte d'ombres de 2048 (`stage.ts:56`), `PCFShadowMap` (`stage.ts:13`), `autoUpdate = false` (`stage.ts:16`) ; recalcul demandé par le soleil qui bouge (`daynight.ts:96-99`) et à des changements de scène (`main.ts:270-271`, `421`). La passe d'ombre utilise le matériau de profondeur de Three.js, **pas** le matériau patché : un `discard` dans le matériau de rendu n'affecte pas les ombres.
- Précédent : la mascotte ne projette pas d'ombre (`mascot.ts:273`), elle a une tache d'ombre (`mascot.ts:165-181`, `renderOrder = 1`, sans écriture de profondeur) pour ne pas déclencher de recalcul. Son matériau est cloné et patché avec `customProgramCacheKey` (`mascot.ts:275-285`) ; `people.ts:157-168` fait de même. C'est le modèle à suivre.
- Caméra : `PerspectiveCamera` 30° (`stage.ts:29`), `minDistance = 70` m, `maxPolarAngle = 1.22` (`stage.ts:38`, `41`) ; au zoom maxi la caméra est maintenue à ≥ 30 m au-dessus du sol (`stage.ts:73-74`). Une caméra d'avatar (3/4, plus près) sera un autre rig : à définir dans l'epic.
- Effet maquette : le rendu va dans `sceneRT` **multi-échantillonné (4)** (`tiltshift.ts:102`), puis flou en demi-résolution sans tampon de profondeur (`tiltshift.ts:101`, `103-104`) ; la scène est rendue une fois (`tiltshift.ts:150-154`), `overlayScene` ensuite sans occlusion (`tiltshift.ts:168-169`). Le flou ne lit que la couleur : il n'est pas affecté par un `discard`. La zone nette suit « le point visé » : suivre l'avatar est à vérifier (non vérifié).
- Compteur `?debug` : appels et triangles cumulés par image via `renderer.info` (`src/ui/perfhud.ts:13-28`).
- Règle BUG-01 : intensités et altitudes par uniformes, jamais dans le texte du shader (CHANGELOG itération BUG-01, `.claude/docs/versions/CHANGELOG.md:394`). Le cutaway ne passera que des uniformes (`uAvatar`, `uCam`, `uCutR`).
- Chiffres d'appels de rendu actuels (60 à 160) : donnés par la demande, non revérifiés ici (PERF-AUDIT date d'avant les regroupements).

## Comparaison des techniques

| | (a) dither / `discard` autour d'un point | (b) cylindre ou cône caméra → avatar | (c) toits cachés ou abaissés dans un rayon | (d) transparence des seuls bâtiments sur le segment | (e) silhouette X-ray de l'avatar |
|---|---|---|---|---|---|
| Effet | Disque pointillé autour de l'avatar, vu de dessus (ne dégage pas les murs de devant) | Trou pointillé exactement sur la ligne de vue ; l'avatar reste visible à toute hauteur | Intérieur « maison de poupée » ; en vue 3/4 les **murs** de devant masquent encore l'avatar | Le bâtiment entier devient fantôme, très lisible (Diablo, LoL) | Avatar toujours visible en couleur unie, les murs restent entiers |
| GPU | Un test par fragment, très léger ; `discard` peut couper le early-Z sur GPU mobile à tuiles (non mesuré) | Idem (a) + une projection, négligeable | Un test par sommet ou fragment ; abaisser des sommets déforme les triangles (maillage fusionné, non indexé) : à éviter, préférer `discard` | Idem + un accès texture ou tableau par id ; sinon passe transparente (tri, tampon de profondeur) | +1 à 3 appels, quelques centaines de pixels |
| CPU | Aucun (2 uniformes par image) | Aucun | Aucun | Test segment / emprises (grille `ringGrid`) ≈ négligeable ; mise à jour d'un tableau ou d'une texture | Aucun |
| Ombres | Carte statique inchangée ; l'ombre d'un mur effacé reste au sol | Idem | Idem (le toit garde son ombre) | Idem | Aucun effet |
| Effet maquette | Aucun (post-traitement couleur) ; le dither est flouté hors zone nette, MSAA×4 lisse les bords | Idem | Idem | Idem | Idem ; la silhouette est dans la zone nette |
| Appels de rendu | +0 | +0 | +0 | +0 si dither par id ; +1 à N si maillages séparés ou passe transparente | +1 à 3 |
| Mise en œuvre | Faible : un chunk GLSL + 2 uniformes | Faible à moyenne : idem, avec la géométrie du cylindre | Faible, mais résultat insuffisant seul | Moyenne à forte : attribut `aId` dans `faceAttrs`, texture de facteurs, test CPU, lissage temporel | Faible : matériau `depthFunc = GreaterDepth`, `depthWrite = false` |
| Risques | Aspect « fromage », grain visible à pixel ratio 1 ; pas de fondu dans le temps | Idem ; intérieur creux visible, arêtes dures du trou | Murs non dégagés ; abaissement des toits : étirements | Tri et profondeur des transparents ; bâtiments mitoyens inégaux ; fenêtres allumées à atténuer ; plus de code | Ne résout pas la lisibilité du décor autour de l'avatar ; silhouette aussi visible derrière le sol (relief) |

Notes communes : les fenêtres et portes sont calculées au fragment (`city.ts:371-405`), donc suivent le trou sans rien faire. Les maillages ne sont pas fermés par l'intérieur : à travers un trou on voit l'extérieur des murs d'en face coupés par le culling, le sol ou le ciel (non vérifié visuellement). `alphaToCoverage` (matériau + MSAA×4 de `sceneRT`) donnerait 5 niveaux de fondu sans bruit : à tester, non vérifié.

## Recommandation

**Phase 1 : cutaway cylindrique (b, avec a comme repli) + silhouette X-ray (e).**
1. Un module `src/scene/cutaway.ts` : uniformes partagés `uAvatar` (vec3, tête de l'avatar), `uCam` (vec3), `uCutR` (rayon de base) ; fonction `applyCutaway(material, { instanced })` qui patche `onBeforeCompile` (varying de position monde ; **avec `instanceMatrix` si instancié**) et `customProgramCacheKey` (comme `mascot.ts:285`).
2. Dans le shader : `s` = projection du fragment sur l'axe avatar → caméra ; on ne coupe que si `0 < s < |cam - avatar|` ; `d` = distance à l'axe ; rayon `R = uCutR + k·s` (cône : trou constant à l'écran) ; seuil de dither par bruit de gradient intercalé sur `gl_FragCoord` ; `discard` si `smoothstep(R, 0.6·R, d)` dépasse le bruit. Fondu aussi près de l'avatar (`s` petit) pour ne pas manger le mur contre lequel il passe.
3. Ne couper que ce qui est au-dessus de l'avatar (`y > uAvatar.y + 0,5`) : sol et bas de murs restent.
4. Pas de transparence, pas de maillages séparés, pas de recalcul d'ombres. L'avatar a une tache d'ombre comme la mascotte (`mascot.ts:165`), sans ombre portée projetée (sinon la carte de 2048 serait recalculée à chaque pas).
5. Compiler la variante « avec cutaway » seulement en mode avatar (clé de programme + `needsUpdate` à l'entrée, précompilation pendant le chargement) : zéro coût en mode carte. Si les mesures montrent un coût de `discard` négligeable, on la laisse allumée.
6. Silhouette (e) : même géométrie que l'avatar, `MeshBasicMaterial` avec `depthFunc = GreaterDepth`, `depthWrite = false`, couleur unie légèrement translucide, `renderOrder` après les bâtiments.

**Phase 2 (optionnelle, si le trou pointillé déplaît) : fondu par bâtiment (d).** Ajouter l'attribut `aId` (index 0..N-1, `Uint16`) dans `faceAttrs` (y compris pour les toits : `city.ts:301`, `305` passent aujourd'hui `null`, il faut passer l'id), une `DataTexture` de N facteurs mise à jour quand l'avatar ou la caméra bougent (test CPU segment / emprises avec `ringGrid`), lissage temporel (fondu sur ≈ 0,25 s), dither par facteur. Reste 1 appel de rendu, toujours pas de transparence réelle.

**Ce qu'on écarte :** (c) seul (laisse les murs), vraie transparence avec maillages séparés (appels de rendu et tri : contraire à la règle du projet).

## Ombres, nuit, arbres et monuments

- **Ombres** : on garde la carte statique ; les ombres des parties effacées subsistent. C'est cohérent (les bâtiments sont toujours là) et gratuit. Alternative écartée : recalculer la carte à chaque pas de l'avatar, trop cher (une passe d'ombre complète de 2 067 bâtiments à chaque image bouge).
- **Nuit** : rien à faire pour le cutaway (émissif calculé au fragment, `city.ts:401-405`). À contrôler : trou sombre dans une rue éclairée ; si l'avatar est trop sombre la nuit, prévoir une petite lueur autour de lui (hors périmètre, à décider).
- **Arbres** : oui, à inclure (ils font ≈ 11 m, `city.ts:429-434`) ; deux matériaux seulement (`nature.ts:34`, `city.ts:433-434`) donc peu de coût de mise en œuvre, mais attention aux instances (voir Faits). Hiver : couronne réduite (`city.ts:451`), l'effacement s'applique pareil.
- **Monuments modélisés** (château, cathédrale, Carré Curial) : oui, car ils sont les plus gros écrans ; matériaux au niveau du module, à patcher via `applyCutaway` (≈ 10 matériaux). Si un monument est « le décor », on pourra exclure une liste (`noCutaway` dans `models.json`).
- Auvents, cheminées, épingles de lieux, drapeaux, oiseaux : à traiter au cas par cas dans la phase 1 (les masquer quand leur point tombe dans le cylindre, ou les patcher aussi). Non vérifié dans le code.

## Plan en étapes

Branche par user story : `feat/EP005-US00X-effacement-batiments` (numéro à fixer par la spec).

1. **Préparer un avatar de test** : sans attendre l'epic, piloter `uAvatar` par le point du sol cliqué (`interaction.ts:63`, raycast sur `o.ground`) et `uCam` par `camera.position`, derrière un paramètre `?cutaway`. Fichiers : `src/main.ts` (boucle), `src/interaction.ts`.
2. **Créer `src/scene/cutaway.ts`** : uniformes, chunk GLSL, `applyCutaway()`. Uniformes uniquement (BUG-01).
3. **Bâtiments** : `src/scene/city.ts`, `windowsMaterial()` (`city.ts:346`) : appeler le chunk (ajouter la coupure avant `#include <color_fragment>` pour ne pas calculer les fenêtres des fragments rejetés). Vérifier : bâtiment non instancié, `vWPos` existe déjà.
4. **Arbres** : `city.ts:433-434`, `nature.ts:34` avec `instanced: true`.
5. **Monuments** : `models/chateau.ts`, `models/cathedrale.ts`, `models/carrecurial.ts`, `models/elephants.ts`, glTF de `models.ts:78`.
6. **Silhouette X-ray** : `src/scene/avatar.ts` (créé par l'epic) ; ici seulement le matériau et l'ordre de rendu.
7. **Réglages** : rayon, pente du cône, largeur du fondu dans `src/content/avatar.json` (même logique que `mascot.json`). Pas de valeur en dur dans le shader.
8. **Mesures et cas visuels** (voir plus bas), puis décision : garder le trou pointillé, passer à `alphaToCoverage`, ou lancer la phase 2.
9. **Phase 2 si décidée** : `aId` dans `faceAttrs`, `DataTexture`, test CPU, lissage ; `src/scene/city.ts` expose `fade(ids)`.
10. **Clôture d'itération** : FEATURES, BACKLOG, CHANGELOG (vérifié / non vérifié), DECISIONS (ligne + éventuel ADR « technique d'effacement »), README (section Rendu et Structure du code), `npm run build`.

## Estimation et incertitudes

- Phase 1 : **1 à 1,5 session** (étapes 1 à 8, hors l'avatar lui-même et sa caméra, traités par l'epic). Phase 2 : **+1 session** (0,5 à 1,5).
- Incertain : (1) coût du `discard` sur GPU mobile à tuiles, à mesurer sur un vrai téléphone (le navigateur de test fait du rendu logiciel sauf Chrome for Testing avec Metal, voir la mémoire du projet) ; (2) aspect « creux » derrière le trou, et besoin éventuel de `DoubleSide` ou d'un intérieur sombre (double le rasterisé des bâtiments, à éviter si possible) ; (3) qualité visuelle de `alphaToCoverage` avec le MSAA×4 du `sceneRT` ; (4) comportement de la zone nette de l'effet maquette en suivant l'avatar ; (5) caméra de l'avatar (hauteur, angle) : le rayon de coupe en dépend directement ; (6) nombre de sommets des bâtiments (géométrie non indexée).

## Risques

- Grain de dither visible à pixel ratio 1 (`quality.ts` baisse la densité sous 40 images/s) ; mitigation : bruit intercalé, flou du tilt-shift, éventuellement `alphaToCoverage`.
- Trous aux bords durs sur de longs murs : fondu large (`smoothstep`) et cône plutôt que cylindre.
- Programmes de shader multipliés : une clé de programme par type de matériau ; vérifier que les matériaux de monuments (`models/*.ts`) ne se multiplient pas (BUG-01).
- Instances : position monde sans `instanceMatrix` = coupe au mauvais endroit (arbres, auvents).
- Éléments flottants (épingles, cheminées, auvents) au-dessus d'un toit effacé.
- Bâtiments bas devant la caméra effacés alors que l'avatar est visible : limiter par `s` et par la hauteur (`y > avatar.y + 0,5`).
- Régression de performance en mode carte : compiler la variante cutaway seulement en mode avatar.

## Plan de vérification

Mesures (`?debug`, Chrome for Testing + Metal pour des images/s représentatives, jamais le rendu logiciel) :
- Images/s au repos (cible 30) et en mouvement, pire image, avec et sans `?cutaway`, dans une rue dense, avec l'avatar immobile puis en marche.
- Appels de rendu et triangles : attendu +0 pour le cutaway, +1 à 3 avec la silhouette ; comparer à la valeur de départ lue dans `?debug`.
- Comparer les temps d'image en mode carte avant / après (non-régression).
- Un essai sur un vrai téléphone (non vérifiable dans l'environnement de test).

Cas visuels, de jour et de nuit :
- Rue étroite de Boigne : bâtiments de 14 m de part et d'autre, caméra qui regarde le long de la rue puis en travers.
- Place Saint-Léger : bâtiments bas devant, arbres.
- Château : gros volume, matériaux de monument, avatar au pied des murs.
- Nuit : fenêtres allumées autour du trou, lisibilité de l'avatar, silhouette.
- Hiver : canopées réduites, toits éventuellement enneigés (non vérifié dans le code).
- Avatar contre un mur, dans une cour, sur une pente (relief), près d'un pont.
- Changement d'heure pendant la balade : ombres statiques recalculées (`daynight.ts:99`) sans à-coup.
- Sortie du mode avatar : retour au rendu normal sans programme résiduel.

## Questions ouvertes pour Dasco

1. **Trou pointillé ou bâtiment entier qui s'efface ?** Proposition par défaut : trou pointillé en phase 1 (rapide, sans risque de performance) ; bâtiment entier en phase 2 seulement si le rendu te déplaît.
2. **L'effacement doit-il toucher les arbres et les monuments (château, cathédrale) ?** Proposition : oui pour les arbres et les monuments, avec une liste d'exceptions possible.
3. **Silhouette de l'avatar à travers les murs, en plus de l'effacement ?** Proposition : oui, discrète (couleur unie translucide), utile quand un bâtiment reste devant.
4. **Les ombres des parties effacées restent-elles au sol ?** Proposition : oui (cohérent, gratuit) ; la nuit, une lueur autour de l'avatar est à décider séparément.
5. **Quel niveau de dégradation accepté sur mobile ?** Proposition : cible 30 images/s au repos comme aujourd'hui ; si le `discard` coûte trop sur téléphone, on réduit le rayon ou on passe à une coupure d'altitude simple.
6. **Faut-il aussi dégager les petits éléments posés sur les toits (épingles, cheminées, auvents) ?** Proposition : les cacher dans le cylindre.
