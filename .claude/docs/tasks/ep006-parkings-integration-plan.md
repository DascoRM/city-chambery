# EP006 « Places de parking » : intégration technique (plan)

Plan de recherche écrit par un sub-agent chercheur, le 03/10/2026. **Rien n'a été implémenté ni modifié dans le dépôt** (sauf ce fichier). Tout est tiré de la lecture du code (état de la branche `docs/EP006-parkings`, après l'itération 71) et de mesures faites **hors application** (scripts jetables dans le répertoire temporaire, sur `data/raw/overpass.json` et `public/data/city.json`). Les étiquettes : **[lu]** = lu dans le code ou les documents, **[mesuré]** = chiffre calculé sur les données du dépôt, **[estimé]** = calcul à partir de comptes (triangles, octets), **[non vérifié]** = rien n'a été mesuré dans l'application, ni sur téléphone.

Ce plan ne choisit pas la thématique « fun » : il propose des **briques techniques réutilisables** quelle que soit l'idée retenue (voitures-jouets, jeu de chasse aux places, parcours, « vue stationnement »…).

---

## 1. Résumé (10 lignes)

1. Les données sont **déjà dans le fichier brut** (`data/raw/overpass.json` : 581 éléments de stationnement, la requête `nwr["amenity"]` les récupère déjà) : il faut seulement les **extraire dans `city.json`** (≈ 380 polygones dans l'emprise, 2 832 sommets, ≈ +60 Ko bruts [estimé], ≈ +15 Ko en gzip). Aucun changement de la requête Overpass.
2. Meilleur rapport coût / effet : **aplats peints dans la texture du sol** (0 appel de rendu, 0 triangle, 0 Mo en plus) + **marquages des places en vraie géométrie** (un maillage, ≈ 12 000 triangles au maximum [estimé]) + **voitures-jouets instanciées par rayon autour de la vue** (un `InstancedMesh`, ≈ 600 instances au plus × 30 triangles [estimé]) + **panneaux « P » instanciés** (≈ 40) + **noms posés au sol par le mécanisme des noms de rues** (0 appel de plus).
3. Budget proposé, **par vue** (comme EP005) : **au plus +5 appels de rendu** par rapport à la même vue, **+0,05 M de triangles**, +0,15 s de chargement, +3 Mo de mémoire ; vue d'ensemble : +1 appel (panneaux) seulement.
4. Les textures de 2 048 px du sol donnent **1,55 px/m** [mesuré : 2 048 px pour 1 324,8 m] : une place de 2,5 m fait 3,9 px, donc **les marquages ne peuvent pas être peints dans le sol** : géométrie.
5. **L'avatar traverse déjà un parking** sans rien changer (`freeLine` ne teste que bâtiments, eau, fontaine : `avatar-path.ts:123-134`) ; il passerait **à travers les voitures** : proposition = elles s'effacent à son approche (pas d'obstacles, pour ne pas casser le déplacement libre de l'itération 71).
6. **Piège de données** : le nom « Parking du Château » désigne un polygone de 10 104 m² (604 places, sans `parking=` dans OSM) **et** un nœud « souterrain » du même nom : à classer en souterrain, sinon on peindrait un parking de surface sur l'esplanade du château (règle projet 1).
7. Les **souterrains** (5 polygones, 8 137 m²) ne se peignent pas sur le sol (ils sont sous des rues et des bâtiments) : « radiographie » translucide (1 appel) ; le **trou découpé dans le sol** est écarté (voir 3.5).
8. Les **silos** (2 polygones, 100 % sous des bâtiments) profitent de l'effacement de la balade : rien à faire pour le rendu.
9. Plan en 8 user stories, **≈ 4 à 5 sessions pour le cœur** (jalon prototype ≈ 1,5 session), 6,5 à 8,5 avec les options.
10. Risques principaux : **iPhone** (≤ 31 images/s déjà mesurées, cause inconnue), **fidélité** (disposition des places illustrative, pas relevée), **règle BUG-01** (uniformes seulement), nuit (l'éclairage de nuit ne voit que ce qui est dans la scène avant `createDayNight`).

---

## 2. Faits (ce que le code et les données disent)

### 2.1 Données

| Constat | Valeur | Source |
|---|---|---|
| Éléments de stationnement dans le brut | **581** : 412 `amenity=parking`, 136 `bicycle_parking`, 19 `parking_entrance`, 13 `parking_space`, 1 `motorcycle_parking` | [mesuré] `data/raw/overpass.json` |
| Polygones `amenity=parking` (ways) | 419 dans la requête ; **380 dont le centre est dans l'emprise** (25 hors) | [mesuré] |
| Types (`parking=`), dans l'emprise | sans type 217, surface 66, street_side 52, lane 38, **underground 5**, **multi-storey 2** | [mesuré] |
| Surface totale (échantillonnage à 2,5 m) | surface 51 237 m² · street_side 14 869 · lane 4 738 · sans type 62 100 · silos 4 563 · souterrains 8 138 | [mesuré] |
| Taille | 214 polygones < 150 m² (≈ < 6 voitures), 91 de 150 à 400 m², 75 > 400 m² | [mesuré] |
| Sommets | **2 832** (≈ 7,5 par polygone) ; relief intra-polygone : p90 = 3 m, max 14,3 m (donc il faut **épouser le relief**) | [mesuré] |
| Capacité (`capacity=`) | seulement 12 polygones de surface en portent une (356 places cumulées pour les « surface ») ; les nœuds nommés portent 604 (Château), 400 (Palais de Justice), 283 (Q-Park Les Halles), 243 (Hôtel de Ville), 64 (Ducs), 260 (Hôpital) | [mesuré] |
| `fee=` / `access=` | `fee` renseigné sur 37 des 405 polygones (29 `yes`, 8 `no`) ; `access=private` sur 66 (16 %) | [mesuré] |
| `opening_hours` | quelques lieux seulement (« 24/7 », « 06:30-01:00 ») | [mesuré] |
| Entrées | 19 nœuds `parking_entrance` (8 souterraines) : ce sont les **bons points pour un panneau « P »** d'un souterrain | [mesuré] |
| Parkings **nommés** | **≈ 28** (liste : Palais de Justice, Château, Ducs, Les Halles, Hôpital, Laurier, de Lattre de Tassigny, Impôts, Préfecture, Place du Manège, de l'Europe, Porte Reine, Barbot, INSPÉ, Covet, Roissard, Paul Vidal, Jacob / Lyon, Grenette, La Falaise, Cassine Gare, Ravet, Courte durée, visiteur, Hôtel de ville…) | [mesuré] |
| Allées | 134 des 297 voies `service` sont `service=parking_aisle` : elles sont **déjà dessinées** comme rues crème (`city.ts:221`, `PALETTE.street`) | [mesuré] |
| Déjà dans `city.json` ? | **Non.** `fetch-osm.mjs` ignore `amenity=parking` (sauf s'il porte aussi `building=`, auquel cas il devient un bâtiment : branche `262-274`). 6 éléments ont `building=` | [lu] |
| Chevauchement avec les bâtiments (parkings « de surface » + sans type) | ≈ 6 440 m² des 62 100 m² « sans type » sont dans un bâtiment (dont un polygone `building=yes` de 2 150 m²) ; les silos sont **100 % dans un bâtiment** ; les souterrains en partie (1 013 m² sur 8 138) | [mesuré] |
| Poids de `city.json` | 1 442 176 octets, **409 902 en gzip** | [mesuré] |

**Ambiguïté à trancher avant de coder (règle projet 1)** : le polygone « Parking du Château » (way 1489707144, 604 places, **10 104 m²**, centre à (-337 ; -111)) n'a pas de `parking=` ; le nœud 1264602039, **même nom, même capacité**, est `parking=underground`. Le polygone est donc très probablement l'emprise du souterrain sous l'esplanade. Règle proposée : **un polygone sans type hérite du type d'un nœud de même nom et de même capacité qu'il contient ou touche** ; sinon `none` (« type inconnu » : peint comme surface, marqué à vérifier). À faire valider par Dasco et par l'autre chercheur « données ».

### 2.2 Rendu actuel (lu)

- **Sol** : une texture canevas de **2 048 px** de large (`terrain.ts:53-83`), plaquée en UV sur le relief (`terrain.ts:120`). Les espaces verts, places et plans d'eau y sont peints (`terrain.ts:76-78`) : c'est l'endroit naturel des aplats.
- **Rues** : rubans posés sur le relief (`city.ts:124-204`, hauteurs `LIFT` dans `roads.ts:14` : chemins 0,14 m, rues 0,18 m) avec **découpe le long des arêtes du terrain** pour épouser le sol (`city.ts:139-163`, fonction interne `tri`, `MAX_DEV = 0,06 m` ligne 76). C'est la brique à **extraire et réutiliser** pour tout ce qui doit se coller au relief (marquages, souterrain fantôme).
- **Un seul maillage de bâtiments** (`city.ts:315-322`), chaque sommet porte son `aId` (ligne 260), l'effacement de la balade lit une texture de facteurs (`cutaway.ts:34-41`). Les objets posés sur un bâtiment effacé restent en l'air (limite connue, CHANGELOG itération 69).
- **Instanciation** : `people.ts` (3 `InstancedMesh`, `frustumCulled = false`, rayon autour du point regardé, `refreshNear` tous les 20 m, lignes 140-250) ; `markers.ts:140-288` (épingles `InstancedMesh` + zones de clic `InstancedMesh` invisibles, mise à jour partielle `addUpdateRange` ligne 244) ; `facades.ts` (un maillage instancié par pièce et par catégorie, `setCategoryVisible` lignes 142-147).
- **Texte au sol** : `street-names.ts` = un atlas de champ de distance + **un seul maillage** pour toute la ville, construit à l'approche (`PREBUILD = 60 m`, ligne 36), invisible au-delà de 320 m (`streets.json`), `renderOrder = 2`, `polygonOffset` -4. Entrée = `StreetLabel` (`types.ts:49`), produite par `scripts/street-names.mjs`.
- **Ombres** : carte statique (`stage.ts:12-17`), **aucun objet mobile ne projette d'ombre** ; précédent = « tache » (`mascot.ts:154-173`, `blobShadow`).
- **Nuit** : `daynight.ts:51` collecte à sa création les maillages marqués `userData.nightGlow` (émissif chaud × `uNight`, lignes 115-119) ; il faut donc que la couche parking soit **dans la scène avant** `createDayNight` (`main.ts:264`).
- **Saison** : seul le feuillage change (`city.trees.setFoliage`, `main.ts:291-296`) : pas de neige, donc « hiver » n'ajoute rien pour les parkings.
- **Boucle** : 30 images/s au repos, pleine vitesse si `still < 0,5 s` ou si un module répond `moving()` (`main.ts:432-470`). Les passants ne définissent pas `moving` (`people.ts` doc) : **les voitures non plus** (décor lent).
- **Légende** : catégories dans `palette.ts:34-38`, cases à cocher dans `ui.ts:74`, branchées sur `onToggleCategory` (`main.ts:231-237`), **masquées en balade** (`style.css:153`).
- **Fiche** : une seule carte `.place-card` (`ui.ts:96-99`), remplie par `showPlaceCard(p: Place…)` (`ui.ts:170-192`), suivie à l'écran par `followPlace` (`main.ts:351-357`), placée par `movePlaceCard` (`ui.ts:215-239`, au-dessus de l'épingle sur ≤ 720 px).
- **Clics** : `interaction.ts:100-107` : outil de placement → éléphant → `pick` des cibles (gemmes, épingles) → **sol en balade** (`onGround`) → `onSelect`. Sur le sol hors balade : rien ne se passe.
- **Balade** : avatar à l'échelle 2 (≈ 3,4 m), 14 m/s, caméra à 85 m / 40° (`avatar.json`) ; déplacement **en ligne droite à travers tout ce qui n'est ni bâtiment (marge 0,6 m), ni eau, ni fontaine** jusqu'à 200 m (`avatar-path.ts:123-134`, `maxDirect`) ; hauteur de l'avatar hors voie : `OFF_ROAD = 0,1 m` (`avatar-path.ts:200`).

### 2.3 Performance de référence

- Appels de rendu **par vue** : vue d'ensemble **2 406**, Carré Curial 732, château 630, rue de Boigne **63** ; triangles 1,53 à 1,58 M [lu : `PERF-AUDIT.md`, mesure du 02/10]. En balade dans les rues : 65 à 67 appels (CHANGELOG itération 69).
- 60 images/s en mouvement et 30 au repos sur Mac (Chrome for Testing + Metal). **iPhone 12 Pro : ≤ 31 images/s même en poussant les gestes, 750 à 1 000 appels** (retour de Dasco, 02/10), cause non comprise [lu : epic EP005]. **Tout budget doit donc être pris avec peu de marge**.

---

## 3. Familles de rendu : coût, réutilisation, compatibilité

Les coûts sont des **comptes [estimé]**, pas des temps. « Appels » = appels de rendu par image dans la vue concernée (les ombres statiques ne comptent pas : rien de neuf ne projette d'ombre).

### Tableau de synthèse

| Famille | Appels | Triangles | Mémoire | Chargement | Risque iPhone | Réutilise | Verdict |
|---|---|---|---|---|---|---|---|
| **(a)** Aplats dans le sol | **0** | 0 | 0 (même texture) | +5 ms (≈ 380 polygones remplis) | nul | `paintGround` (`terrain.ts:65-78`) | **À faire (socle)** |
| **(b)** Marquages en géométrie | **+1** | ≤ 12 000 | ≈ 0,4 Mo | lazy, voir 3.2 | faible | `tri` des rubans (`city.ts:139`) | **À faire** |
| **(c)** Voitures-jouets instanciées | **+1** | ≤ 18 000 (600 × 30) | 0,4 Mo CPU + 40 Ko GPU | lazy | **moyen** (nombre à plafonner sur mobile) | `people.ts` (rayon, instances) | **À faire**, par rayon |
| **(d)** Panneaux « P » 3D instanciés | **+1** | ≈ 1 600 (40 × 40) | 16 Ko (texture 64²) | négligeable | faible | `markers.ts` (épingles + zone de clic) | **À faire** |
| **(d')** Noms au sol | **0** | ≈ 800 | 0 (atlas existant) | +0 | nul | `street-names.ts` | **À faire** |
| **(d'')** Étiquettes sprites / HTML | +1 par sprite (**non**) / 0 (HTML) | — | — | — | — | `labels.ts` / `ui.ts` | Sprites **non** ; HTML seulement à la fiche |
| **(e)** Souterrains : radiographie | **+1** | ≈ 300 | 20 Ko | négligeable | faible (transparence) | `tri` des rubans | Option |
| **(e')** Souterrains : trou découpé dans le sol | +2 | ≈ 600 | — | — | élevé | — | **Écarté** (3.5) |
| **(f)** Couche « vue stationnement » | **0 en soi** | 0 | 0 | 0 | nul | légende / bouton | **À faire** (le bouton pilote `visible`) |
| **(g)** Voitures qui arrivent et partent | **0** (même maillage) | 0 | 0 | 0 | moyen : CPU par image | `people.ts` (grow), `markers.ts:244` | Niveau 1 : à faire ; niveau 2 : option |

### 3.1 (a) Aplats colorés au sol

- **Comment** : dans `paintGround`, après les places (`terrain.ts:77`) et avant l'eau (`:78`), `fillPolys(data.parkings.filter(p => p.kind !== 'underground' && p.kind !== 'multi-storey'), couleur)`. Une couleur par type (surface, le long de la rue, `none`) ; les souterrains et les silos ne se peignent pas (sous une rue ou un bâtiment).
- **Résolution [mesuré]** : 1,55 px/m. Un contour de polygone est net à ±0,65 m : suffisant pour un aplat.
- **Coût** : aucun appel, aucun triangle. Le canevas est reconstruit une fois au chargement ; **un repeint à chaud (interrupteur) coûterait un nouvel envoi de ≈ 14,8 Mo** (2 048 × 1 805 × 4) à la carte graphique : à éviter. Deux options :
  - **A1 (proposée)** : l'aplat est **toujours visible** (comme les places) ; la couche « vue stationnement » ajoute le reste (marquages, voitures, panneaux). Coût zéro.
  - **A2** : si Dasco veut que rien ne se voie quand la couche est éteinte, un **maillage d'aplats** (même triangulation que les marquages, +1 appel, ≤ 5 000 triangles [estimé]) au lieu de la texture.
- **Les allées crème** (`parking_aisle`, 134 voies `service`) resteront dessinées par-dessus l'aplat : lisible (allées claires sur fond foncé). Les colorer autrement demande de garder `service=` dans `city.json` et de scinder le ruban `street` (`city.ts:221`) : +1 appel, **non proposé**.
- **Effacement des bâtiments** : sans effet (les aplats sont dans le sol ; quand un bâtiment s'efface, le sol dessous, avec son aplat, apparaît).
- **Balade** : sans effet ; l'avatar marche dessus comme sur une place.

### 3.2 (b) Marquages de places

- **Pourquoi pas la texture** : 3,9 px par place, flou garanti de près. **Pourquoi pas le shader procédural** (rayures en espace monde selon un axe par sommet) : sans connaître le bord de chaque rangée, les traits traversent les allées et dépassent du polygone ; rejeté.
- **Retenu : géométrie fine** : un quad de 0,12 × 5 m par séparateur de place (≈ 4 848 places + ≈ 600 rangées → ≈ 6 100 quads = **12 200 triangles** [estimé]), un seul maillage, matériau `MeshStandardMaterial` blanc cassé, hauteur **0,10 m** (entre le sol et les chemins à 0,14, de sorte que les allées crème recouvrent les traits : `LIFT` à étendre dans `roads.ts:14`), `polygonOffset` -1.
- **Disposition (illustrative, pas relevée)** : fonction pure `parking-layout.ts` : axe du polygone = arête la plus longue ; places de 2,5 × 5 m en double rangée + allée de 5,5 m (période 15,5 m) ; une rangée parallèle (5,5 × 2 m) pour `street_side` / `lane` ; une place est retenue si ses 4 coins et son centre sont dans le polygone **et hors de tout bâtiment** (`walkways.buildingTest`, `walkways.ts:178-181`). Prototype jetable [mesuré] : **372 polygones → 4 848 places ; 272 ms sous Node** (non optimisé), soit ≈ 1 s sur téléphone [estimé ×3 à ×5] : à **construire à la demande** (première activation de la couche, par morceaux sur plusieurs images) et à optimiser (balayage par lignes) ; sinon pré-calcul dans le script (≈ +60 Ko bruts, option).
- **Écart avec la capacité OSM [mesuré]** : le prototype donne plus de places que le tag : Place du Manège 141 (OSM 84), Parking de l'Europe 246 (154), Barbot 122 (58), Grenette 30 (23), Jacob / Lyon 14 (12), Château 503 (604, mais voir 2.1). La disposition est donc **un décor** : la fiche affiche le chiffre OSM (ou « ≈ N places d'après la surface ») et jamais le nombre de traits (question 2).
- **Pente** : même découpage que les rubans (extraire `tri` de `ribbons` en fonction exportée `drape(terrain, lift)`, `city.ts:139-163`). Un quad de 5 m traverse au plus une arête de 10 m : sommets à la hauteur du sol suffisent, sauf pente forte (p90 de dénivelé par parking = 3 m ; max 14,3 m) : **à regarder sur le parking de la Falaise / Palais de Justice** [non vérifié].
- **Visibilité** : `group.visible = false` au-delà de ≈ 400 m (comme les noms de rues, `street-names.ts:254-262`) ; construit à l'approche. **Aucun coût en vue d'ensemble.**
- **Nuit** : `userData.nightGlow = 0.1` (lueur des réverbères, comme `glow()` `city.ts:207-210`) ; il faut `MeshStandardMaterial` et être **dans la scène avant `createDayNight`**.
- **Effacement / balade** : sans effet (le maillage est sous les bâtiments et ne lit pas `uFade`) ; les places sous un bâtiment sont exclues par construction.

### 3.3 (c) Voitures-jouets instanciées

- **Géométrie** : une voiture = caisse + habitacle (2 boîtes, 24 triangles) + « ombre peinte » (quad sombre opaque de 0,02 m sous la voiture, dans **la même géométrie** : 0 appel de plus, pas de transparence), couleurs par sommet + `instanceColor` : ≈ 30 triangles. `MeshStandardMaterial` standard, **sans `onBeforeCompile`** (aucun risque BUG-01).
- **Nombre** : total possible = 4 848 voitures (toutes les places pleines) = 145 000 triangles : **trop pour tout dessiner en permanence** (+9 % des triangles de la vue d'ensemble). Donc **par rayon** comme `people.ts` : `radius` autour de `controls.target` (150 m ; 110 m sur téléphone), recalculé quand la cible bouge de plus de 20 m (comme `refreshNear`, `people.ts:205-215`). Densité [estimé] : ≈ 220 places dans un rayon de 150 m en moyenne, **≈ 600 au plus dans la zone la plus dense** (la maille de 300 m la plus chargée contient 15 241 m² de parking). Avec 70 % d'occupation : **≈ 150 voitures en moyenne, ≈ 420 au plus** = 12 600 triangles.
- **Un seul `InstancedMesh`** (+1 appel), `frustumCulled = false`, `count` ajusté, mise à jour partielle (`addUpdateRange`, comme `markers.ts:244`). Hors de portée (vue d'ensemble, > 500 m du sol) : `visible = false`, 0 appel.
- **Ombres** : aucune ombre portée (règle de l'epic EP005 n° 5) ; l'ombre peinte opaque évite un second maillage.
- **Taux d'occupation simulé** : fonction de l'heure par type (courbe `[heure, part]` interpolée avec `curveAt`, `curve.ts`, comme `life.json` `dayCurve`) × capacité (OSM si connue, sinon places de la disposition × 0,6 [à calibrer]). Une place est occupée si son hachage stable `rand(i)` < taux : **monotone** (les voitures apparaissent et disparaissent dans le même ordre quand l'heure change, sans clignoter). Mise à jour à chaque changement de minute dans `clock.onChange` (`main.ts:279-283`, clé `openKey`). **Libellé obligatoire « occupation simulée »** (règle projet 1 : on ne présente pas un chiffre inventé comme un fait). Crochet prévu : `occupancy(id, hour)` remplaçable par une source réelle (non étudié ici : site statique, CORS non vérifié).
- **Échelle** : réglage `carScale` dans la config (1 = 4,5 m ; l'avatar fait 3,4 m, donc 1 à 1,3 est cohérent) [non vérifié visuellement].
- **Mode balade, voitures et avatar** : l'avatar passe **à travers** les voitures (aucun test). Options :
  1. **Effacer les voitures à moins de 4 m de l'avatar** (réduction à 0 en 0,2 s, 0 en dehors) : coût ≈ nombre de voitures du rayon testées quand l'avatar bouge de plus de 0,5 m (grille de 25 m) ; **retenue**.
  2. Les voitures comme obstacles de `freeLine` : **écartée** (casserait les trajets en ligne droite de l'itération 71 : 88 % d'arrivées exactes).
  3. Ne pas dessiner de voitures sur les zones de marche : sans objet (tout est marchable).
- **Effacement des bâtiments** : les places dans une emprise de bâtiment sont exclues (silos, `building=yes` : 4 563 m² de silos et 2 150 m² du polygone `building=yes`). Option « silo en coupe » : les voitures du niveau 0 d'un silo n'apparaîtraient que lorsque le bâtiment s'efface (il faudrait lire `uFade` au sommet) : **hors scope**.
- **Mobile** : `mobileFactor` ≈ 0,5 (comme `life.json` pour les passants) → ≈ 210 voitures au plus ; `radius` 110 m.

### 3.4 (d) Panneaux « P », épingles, étiquettes

- **Panneaux 3D instanciés** (+1 appel) : poteau + plaque bleue avec « P » (texture canevas 64 × 64, comme `glowTexture`, `markers.ts:69-83`), hauteur ≈ 7 m (les épingles de bars font 14,2 m : **plus discrets**, retour du BACKLOG « épingles envahissantes »), posés **au sol** (`heightAt`), **jamais sur un toit** (pas de `standHeights`, `markers.ts:127-138`, sinon ils resteraient en l'air quand le bâtiment s'efface). Une zone de clic invisible par panneau (`InstancedMesh` + `userData.parkings`, comme `userData.places`, `markers.ts:174`). Rayon de clic 5,5 m → ≈ 58 px de large à 300 m sur iPhone portrait [estimé : 844 px de haut, FOV vertical 30°].
- **Lesquels ?** Pas les 380 : **les parkings nommés (≈ 28) + ceux ≥ 1 000 m² (≈ 20 de plus)** [à ajuster] ; les souterrains et silos au **nœud d'entrée** OSM (`parking_entrance`) ou au nœud nommé. Position = donnée OSM (règle 1) : centre d'un polygone (`pointOf`, `fetch-osm.mjs:421`) ou nœud.
- **Noms au sol** : ajouter les parkings nommés aux `streetLabels` (kind `parking`, position = `labelPoint` `fetch-osm.mjs:479`, angle = axe du polygone) : **mêmes appels, même atlas, mêmes seuils d'apparition** ; ≈ 28 noms × 14 lettres × 2 triangles ≈ 800 triangles. À adapter : `scripts/check-street-labels.mjs:61` (compare les noms recalculés à ceux du fichier) et `roadLift('parking')` (`roads.ts:17`, retombe sur la hauteur des rues : OK).
- **Pas de sprites** (`labels.ts`) : un sprite = un appel de rendu chacun (28 appels). **HTML seulement dans la fiche** (voir 4).
- **Effet maquette (flou)** : les panneaux 3D sont floutés hors de la bande nette (comme les épingles) ; les noms au sol aussi (comme les noms de rues). Les étiquettes sprites passent par-dessus le flou : **pas utilisées**.

### 3.5 (e) Souterrains : coupe ou transparence

- Contraintes lues : le sol est un seul maillage opaque ; les rues sont des rubans 0,18 m au-dessus ; 4 des 5 souterrains **chevauchent des rues et des bâtiments**. Un trou dans le sol exigerait de **découper aussi les rubans et de masquer les bâtiments** au-dessus (shader du sol + shader des bâtiments + rubans) : **écarté** (risque élevé, +2 appels, régression possible sur le sol).
- **Retenu (option, E1) « radiographie »** : un seul maillage translucide (contours extrudés vers le bas sur 2 niveaux de 3 m + dalles), `depthTest = false`, opacité ≈ 0,25, `renderOrder = 3` (au-dessus des noms de rues, sous les étiquettes à 10), visible **seulement avec la couche**. **+1 appel, ≈ 300 triangles** [estimé] (5 polygones, 41 sommets). On y voit les murs et les niveaux « à travers » les bâtiments, avec un petit nombre de voitures fantômes (même maillage de voitures, matrice abaissée de 3 m : +0 appel si elles sont dans l'instance courante).
- **Fidélité** : le nombre de niveaux n'est pas dans OSM (`layer=-1`, `level` rare : 6 éléments portent `level`) : **2 niveaux = décor**, à dire (question 3).
- Effacement des bâtiments : indépendant. Balade : visible seulement si la couche est active.

### 3.6 (f) Couche « vue stationnement »

- **Un interrupteur dans la barre d'outils** (`ui.ts:71-83`) qui pilote : `visible` des marquages, des voitures, des panneaux, de la radiographie ; le **style** des aplats (A1 : toujours là). **Aucun uniforme ni `define` ne change** : seulement `visible` (règle BUG-01 : les uniformes ne servent qu'à des valeurs, ici il n'y en a pas).
- **Option « focus »** (vue stationnement vraiment lisible) : masquer les épingles de bars (`placeLayer.root.visible = false`) et baisser les halos pendant la couche ; **gratuit** et répond au retour du BACKLOG sur les épingles en balade.
- En **balade** : la couche reste utilisable (bouton conservé, contrairement à la légende masquée `style.css:153`) ; rayon centré sur `controls.target` = l'avatar (les modules « point regardé » le font déjà).

### 3.7 (g) Effets animés (arrivées et départs)

- **Niveau 1 (proposé)** : à chaque changement d'occupation (minute de l'horloge, lecture ▶), les voitures **grandissent / rétrécissent en 0,4 s** sur place (comme le `grow` des passants, `people.ts` doc). Coût : 0 appel ; CPU = quelques dizaines de matrices par minute simulée ; **sans `moving()`** → 30 images/s au repos ; si `prefers-reduced-motion` : apparition immédiate (déjà pratiqué : `balade.ts:49`).
- **Niveau 2 (option)** : une voiture **roule** de la voie la plus proche jusqu'à sa place. Réseau : `buildWalkways` (`walkways.ts:46`) donne les voies, **mais sans sens ni interdiction aux piétons seuls** (les voitures traverseraient des rues piétonnes) ; il faut un filtre de types (`service`, `residential`…). ≈ 1 session, risque de comportements absurdes ; **non conseillé avant d'avoir validé le niveau 1**.

---

## 4. Intégration UI

### 4.1 Où mettre quoi

| Élément | Emplacement | Fichiers (lignes lues) |
|---|---|---|
| Bouton « 🅿️ Parkings » (`aria-pressed`) | dans `.tools`, **après « Balade »** (`ui.ts:73`) ; **visible aussi en balade** | `ui.ts:71-83`, `:281-295` (dispatch `data-action`), `:336-395` (retour : `setParkings(on)`), `UiHandlers` `:32-54` (`onParkings?(on)`) |
| Légende | **pas de 4ᵉ case dans `legend-box`** (3 puces déjà ; à 390 px elle passe à la ligne et la barre deviendrait haute) ; le bouton remplace la case | `ui.ts:74`, `style.css:107-113`, `:153` |
| Fiche d'un parking | **même carte `.place-card`** : `showParkingCard(p, pin, état)` à côté de `showPlaceCard` ; mêmes états « épinglée » et suivi d'écran | `ui.ts:96-99`, `:166-239` ; `main.ts:227, 339-357` (généraliser `placeIdx` en `{ kind, index }`) |
| Liste des parkings (équivalent accessible du canevas) | un panneau comme le Journal : tri par capacité ; un clic = vol de caméra (hors balade) ou marche (balade) | `ui.ts:85-89` (modèle) |
| Lobby | **optionnel** : une 4ᵉ carte « Parkings » exige un nouvel icône (`lobby.ts` `ICONS` ≈ lignes 38-44 et le type `LobbyContent.cards[].icon` ligne 14) + texte dans `lobby.json` | `src/content/lobby.json`, `ui/lobby.ts` |

Contenu de la fiche (tout ce qui existe dans OSM, rien d'inventé) : type (souterrain, silo, surface, le long de la rue), nom (sinon « Parking »), **places (OSM)** ou « ≈ N d'après la surface », tarif (`fee`) si présent (37 sur 405), accès (privé : 66), opérateur, horaires (`createOpenStates`, `openinghours.ts:103` : « 24/7 » et « 06:30-01:00 » existent), ligne **« Occupation simulée : 72 % »** avec barre `role="meter"`, source « OpenStreetMap · à vérifier sur place » (comme `ui.ts:184`).

### 4.2 Priorités de clic (`interaction.ts`)

Ordre proposé (un toucher = une seule action ; **sans changer l'existant** hors ajout) :

1. outil de placement (dev) — `:100` ;
2. éléphant — `:101` ;
3. `pick` des cibles : gemmes ✦, épingles de lieux, **panneaux « P »** (étendre `Hit` `:9` et `pick` `:53-60` avec `{ parking, index }` ; ajouter la zone de clic aux `targets` de `main.ts:372`) ;
4. **sol en balade** : marcher (`:103-106`, inchangé). Un clic sur un aplat de parking **marche** ; un clic sur un **panneau** marche jusqu'au panneau et ouvre la fiche à l'arrivée (même logique que les ✦, `main.ts:389`) ;
5. **sol hors balade, couche active** (nouveau) : si le premier objet touché est le terrain (`name === 'terrain'`, `terrain.ts:122`), tester le point contre les polygones (grille de 25 m, `pointInRing`, `geo.ts:9`) → fiche du parking. **Un rayon par clic**, pas par image ; il touche `city.group` (le maillage des bâtiments compte ≈ 1,4 M de triangles, déjà utilisé par `onGround` : acceptable, [non mesuré] pour ce cas).
6. clic dans le vide : ferme les fiches (`main.ts:393`).

Survol (souris) : infobulle seulement (« Parking du Château · 604 places »), **pas de carte au survol** pour ne pas doubler celle des bars (`main.ts:395-403`). Curseur `pointer` sur un panneau (`interaction.ts:135`).

### 4.3 Mobile 390 px, accessibilité, nuit, hiver

- **390 px** : Journal ≈ 100 px + Balade ≈ 110 px + Parkings ≈ 120 px + espaces ≈ 346 px < 390 − 16 [estimé, à mesurer] ; la légende et l'heure passent déjà à la ligne (`style.css:179-200`). La fiche s'ouvre **au-dessus du panneau** (`movePlaceCard` `ui.ts:220-224`). Pas de tiroir bas pour les parkings : la fiche courte suffit (P5 de l'epic EP005 est ouvert pour les ✦).
- **Accessibilité** : bouton `aria-pressed` + libellé ; **un signe non coloré** (le « P » et un hachurage de l'aplat, pas la couleur seule) ; liste des parkings (équivalent du canevas, qui n'a pas de description) ; `prefers-reduced-motion` : pas de pousse des voitures ; chiffres de capacité dans un `aria-live` poli au changement de fiche ; Échap ferme la fiche (`ui.ts:334`, existant).
- **Nuit** : marquages `nightGlow` (voir 3.2), panneaux émissifs (même mécanisme que `uGlow` des épingles, `markers.ts:149-162`, ou `nightGlow` sur la plaque), voitures sombres par l'éclairage de la scène ; **rien à faire** pour les aplats (texture éclairée). **Non regardé** (comme l'effacement, itération 69).
- **Hiver** : sans objet (seul le feuillage change). Vérifier seulement qu'aucun arbre semé ne sort d'un aplat.

---

## 5. Plan par étapes

Branche d'epic `feat/EP006-parkings`, une branche par US (règle « branche d'epic » de la mémoire et de `CLAUDE.md`). Chaque US se clôt comme une itération (FEATURES, BACKLOG, CHANGELOG, DECISIONS). **Prérequis : spec EP006 validée par Dasco** (`docs/specs/epics/EP006-parkings/`), puis ce plan.

### US001 — Données : extraire les parkings (≈ 0,5 à 1 session)
Fichiers :
- `scripts/fetch-osm.mjs` : déclarer `const parkings = []` près de `:254` ; dans la boucle (`:257`), **avant** la branche bâtiments (`:262`), un bloc `if (t.amenity === 'parking')` (ways + relation `lane`, nœuds nommés et `parking_entrance`) **sans `continue`** pour les éléments aussi `building=` (ils restent des bâtiments, `:262-274`) ; `polygonsOf` / `clipPoly` (`:200-217`) ; champs conservés : `id`, `kind` (`parking=`, avec l'héritage du type par un nœud de même nom, voir 2.1), `name`, `capacity` (entier ; ignorer « 10;20 »), `fee`, `access`, `operator`, `opening_hours`, `building` (booléen), `outer`, `holes`, `pos` (`pointOf` `:421` / `labelPoint` `:479`), `area`, `entrances` ; écrire `parkings` dans `city` (`:518-525`) et une ligne de statistiques (`:535`) ; les noms vont aussi dans `streetLabels` (voir US007).
- `src/types.ts` : `Parking` (après `Area` `:45`), `CityData.parkings?` (après `places` `:62`).
- Régénérer : `npm run data -- --offline` (règle projet 2) ; **ne pas toucher `city.json` à la main** (règle 3).
- Vérification : compte par type = tableau 2.1 ; poids `city.json` (+60 Ko attendus) ; aucun parking `building=yes` dupliqué dans les bâtiments ; script jetable de contrôle (équivalent de `check:streets`) → `scripts/check-parkings.mjs` : polygones valides, dans l'emprise, hors eau, taux de chevauchement avec les bâtiments.
Livrable : données seules, **aucun changement visuel**.

### US002 — Aplats, panneaux, fiche, bouton (≈ 1 à 1,5 session) — jalon prototype
Fichiers :
- `src/scene/palette.ts` : couleurs `PALETTE.parking*` (après `:24`) et `PARKING_KIND_LABEL` (après `:45`).
- `src/scene/terrain.ts:76-78` : `fillPolys` des parkings (A1).
- `src/scene/parkings.ts` (nouveau) : panneaux « P » instanciés + zones de clic, `setVisible`, `anchor(i)`, `animate`, `moving: () => false`.
- `src/interaction.ts:9, 53-60, 100-107, 135` : `Hit` étendu et sol hors balade avec couche active (priorités 4.2).
- `src/ui/ui.ts:32-54, 71-83, 166-239, 281-295, 336-395` : bouton, `showParkingCard`, dispatch, `setParkings`.
- `src/style.css:57, 153, 179-200` : bouton, états `is-balade`, mobile.
- `src/main.ts:13, 212-215, 229-254, 372, 384-403, 411-431, 499` : assemblage, handlers, `targets`, tickers, debug `window.diorama.parkings`.
- `src/content/parkings.json` (nouveau) : réglages (types, seuils des panneaux, couleurs, rayon, courbes d'occupation).
Livrable : on voit les parkings peints, les panneaux, la fiche (places OSM, tarif, accès) ; **0 appel en vue d'ensemble hors panneaux (+1)**.

### US003 — Disposition des places et marquages (≈ 1 session)
Fichiers : `src/scene/parking-layout.ts` (nouveau, fonction pure testable sous Node) ; extraire `tri` de `src/scene/city.ts:124-204` en `drape()` exportée (le comportement des rubans ne doit pas changer : comparer le nombre de triangles avant / après) ; `src/scene/parkings.ts` (marquages, construction à l'approche ou à la première activation, par morceaux) ; `src/scene/roads.ts:14` (`LIFT.mark = 0.10`) ; `nightGlow` (voir 3.2) et ajout à la scène avant `main.ts:264`.
Vérification : compte de places vs tableau 3.2 ; capture à 130 m sur le parking de l'Europe et sur le parking de la Falaise (pente) ; aucun trait dans un bâtiment.

### US004 — Voitures-jouets et occupation simulée (≈ 1 à 1,5 session)
Fichiers : `src/scene/parkings.ts` (géométrie de la voiture, `InstancedMesh`, rayon, `refreshNear`, occupation par heure, croissance 0,4 s) ; `src/main.ts:279-297` (`clock.onChange` → `parkings.setHour`) ; `src/content/parkings.json` (`carScale`, `mobileFactor`, courbes) ; effacement à l'approche de l'avatar (`avatar.position()`, `avatar.ts:206`).
Vérification : décompte par vue (voir 6), pas de clignotement quand ▶ défile, voitures à l'écart de l'avatar.

### US005 — Mode balade et mobile (≈ 0,5 à 1 session)
- Bouton conservé en balade, rayon centré sur l'avatar, panneaux réduits ou masqués hors de 80 m de l'avatar (retour BACKLOG sur les épingles), clic sur un panneau = marche puis fiche (`main.ts:384-394`, comme `openPoi`) ; test 390 px ; **mesure sur l'iPhone 12 Pro avec `?debug`** (images/s, appels).

### US006 — Souterrains en radiographie (option, ≈ 0,5 à 1 session)
- `src/scene/parkings.ts` (maillage fantôme, `depthTest: false`, `renderOrder: 3`) ; fiche : mention « souterrain, 2 niveaux : décor ».

### US007 — Noms au sol (≈ 0,5 session)
- `scripts/fetch-osm.mjs:518-525` (concaténer les noms de parkings à `streets.labels`) ; `scripts/check-street-labels.mjs:61` ; `src/scene/street-names.ts` (aucune modification attendue : lit `StreetLabel`) ; `src/types.ts:49` (commentaire).

### US008 — Voitures qui roulent (option, ≈ 1 session)
- Niveau 2 de 3.7, seulement après validation du niveau 1.

### US009 — Clôture, documents, mesures (≈ 0,5 session)
- README (structure du code, réglages), `FEATURES.md`, `BACKLOG.md`, `CHANGELOG.md`, `DECISIONS.md` (ADR : « aplats dans la texture, marquages en géométrie, voitures par rayon »), `PERF-AUDIT.md` (tableau par vue), lobby si retenu. **Aucune licence nouvelle** (voiture et panneau procéduraux, données OSM déjà créditées : règle projet 5).

### Estimation

| Lot | Sessions |
|---|---|
| Cœur : US001, US002, US003, US004, US005, US009 | **4 à 5,5** |
| Options : US006 (souterrains), US007 (noms), US008 (voitures qui roulent) | +2,5 à 3 |
| Jalon prototype (US001 + US002) | **1,5 à 2** |
Incertitude forte : mobile (jamais mesuré avec ces ajouts), réglages visuels (échelle, couleurs : plusieurs allers-retours, comme pour les noms de rues), pentes.

---

## 6. Budget de performance (à tenir, par vue)

Référence : mesures du 02/10 (`PERF-AUDIT.md`) et balade (CHANGELOG itération 69). « Couche active » = bouton Parkings enfoncé. **Estimations à confirmer.**

| Vue | Appels de référence | Couche **éteinte** | Couche **active**, plafond | Détail (estimé) |
|---|---|---|---|---|
| Vue d'ensemble | 2 406 | +0 | **+1** (panneaux) | marquages et voitures masqués au-delà de ≈ 400 / 500 m |
| Carré Curial, 300 m | 732 | +0 | **+3** | panneaux, marquages, voitures |
| Château, 300 m | 630 | +0 | **+4** | idem + radiographie (Palais de Justice, Château) |
| Rue de Boigne, 130 m | 63 | +0 | **+4** | idem ; **soit ≈ +6 %**, dans la règle de l'epic EP005 |
| Balade (rue), 85 m | 65 à 67 | +0 | **+3 à +4** | rayon centré sur l'avatar |

Autres plafonds : **triangles +0,05 M** (marquages 0,012 + voitures ≤ 0,018 + panneaux 0,002 + radiographie 0,0003 + noms 0,0008 ≈ 0,034 M ; marge de 0,016) ; **chargement +0,15 s** sur Mac (+3 ms de lecture JSON, +5 ms d'aplats, le reste à la demande ; téléphone ×3 à ×5 [estimé]) ; **mémoire +3 Mo** (aucune nouvelle texture de sol) ; **poids** : `city.json` +60 Ko bruts, ≤ +18 Ko en gzip ; **images/s** : ≥ 55 en mouvement et 30 au repos sur Mac, **pas de baisse de plus de 3 images/s sur l'iPhone 12 Pro** par rapport à la même vue sans la couche (point de départ : ≤ 31 mesurées) ; voitures : **≤ 450** à la fois sur ordinateur, **≤ 220** sur téléphone.

Garde-fous : la résolution adaptative (`quality.ts:16-47`) ne mesure que les images en mouvement ; **si la couche fait descendre sous 40 images/s, elle baisse la densité de pixels (effet de bord à surveiller)** : relever la densité en plus des images/s.

---

## 7. Plan de vérification

**Méthode** (mémoire du projet : *Tests perf avec GPU*) : Chrome for Testing de Playwright en headless « new » avec la puce du Mac, **jamais le rendu logiciel** (≈ 1,5 image/s) : exécutable `~/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`, arguments `--headless=new --use-angle=metal --enable-gpu --ignore-gpu-blocklist`, Playwright depuis `~/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs` avec `executablePath`. Fenêtre 1 280 × 800, densité 2 (comme l'itération 42).

1. **Comptes par vue** avec `?debug` (compteur `perfhud.ts`) : les 4 vues du tableau + balade, **couche éteinte puis active** ; relever appels, triangles, images/s (repos et mouvement). Vues parking à ajouter : parking du Château (centre ≈ (-337 ; -111)), parking de l'Europe (≈ (230 ; -269)), parking de la Falaise (≈ (473 ; -381), pente), Palais de Justice (≈ (-100 ; 300)).
2. **Mouvement** : glisser la carte 10 s, ▶ de l'heure (occupation qui change), clic sur un éléphant : ≥ 55 images/s.
3. **Chargement** : temps jusqu'à « La ville est prête » (4,5 à 4,8 s de référence) ; poids de `city.json` (gzip).
4. **Données** : `scripts/check-parkings.mjs` (tableau 2.1), re-génération `--offline` stable (deux passes identiques).
5. **Disposition** : script jetable comparant places calculées et `capacity` OSM (tableau 3.2) ; zéro place dans un bâtiment ou dans l'eau ; aucune voiture sous une façade.
6. **Balade** : traverser le parking de l'Europe en ligne droite : voitures qui s'effacent à ≤ 4 m, pas de blocage, pas de trajet allongé ; entrer / sortir du mode sans erreur ; couche active pendant la marche.
7. **Effacement** : se placer derrière un silo (La Falaise) : le bâtiment s'efface, pas de panneau en l'air.
8. **Nuit, hiver** : heure 22:00 et saison hiver : marquages lumineux, panneaux, pas de défaut ; arbres hors aplats.
9. **Mobile 390 px** : émulation à 390 × 844 (barre d'outils, fiche, zone de clic) puis **iPhone 12 Pro réel (Vercel, `?debug`)** : images/s en mouvement et au repos, appels, densité de pixels, chauffe.
10. **Dire ce qui n'a pas été vérifié** (règle projet 6) : téléphone, autres modèles, batterie, écrans 120 Hz.

---

## 8. Risques

| Risque | Gravité | Parade |
|---|---|---|
| **iPhone** : ≤ 31 images/s déjà ; ajouter des objets pourrait empirer ; cause inconnue (économie d'énergie ? GPU ?) | Haute | budget en appels et triangles ; rayon et `mobileFactor` ; mesurer **avant** (référence sans la couche) ; interrupteur éteint par défaut (voir question 1) |
| **Parking du Château / ambiguïté de type** : polygone peint comme parking de surface sur l'esplanade | Haute (faits) | règle d'héritage du type par un nœud de même nom (2.1) ; validation Dasco |
| **Disposition illustrative** prise pour un relevé (141 places tracées pour 84 OSM) | Moyenne | fiche : chiffre OSM ou « ≈ N (estimation) » ; libellé « disposition illustrative » ; question 2 |
| **Occupation simulée** prise pour une donnée réelle | Moyenne | libellé obligatoire ; courbe documentée ; crochet pour une source réelle |
| **Z-fighting** des marquages à 0,10 m et sur les pentes (le sol est à 0, les chemins à 0,14) | Moyenne | `polygonOffset`, `LIFT.mark`, `drape` ; capture sur parking en pente [non vérifié] |
| **BUG-01** (uniformes seulement dans les shaders) | Moyenne si on ajoute des shaders | aucun `onBeforeCompile` nouveau prévu ; `visible` pour tout interrupteur ; `customProgramCacheKey` constant si un patch est ajouté (nuit des panneaux) |
| **Nuit** : `createDayNight` ne voit que les maillages déjà dans la scène | Moyenne | ajouter la couche à la scène avant `main.ts:264` |
| **Régression des rues** en extrayant `tri` de `ribbons` | Moyenne | extraction mécanique, comparaison du nombre de triangles et d'une capture avant / après |
| **Voitures à travers l'avatar** | Basse | effacement à l'approche (3.3) ; pas d'obstacle |
| **Objets posés sur un bâtiment effacé** | Basse | panneaux au sol seulement |
| **Poids / nombre de polygones** ≫ attendu après les mises à jour OSM | Basse | seuils de taille minimale (ex. < 40 m² ignorés), à calibrer |
| **Clic sur le sol** : rayon contre le maillage des bâtiments, jamais mesuré sur téléphone | Basse | un seul rayon par clic (`onGround` le fait déjà) |

---

## 9. Questions ouvertes pour Dasco (proposition par défaut)

1. **Couche par défaut : éteinte ou allumée ?** *Proposition : éteinte au départ* (le diorama reste comme aujourd'hui, +0 appel), les aplats seuls restent visibles (A1) ; un bouton « 🅿️ Parkings » allume marquages, voitures, panneaux. Alternative : couche allumée dans un mode « vue stationnement » qui masque les épingles de bars.
2. **Fidélité : marquages et voitures « d'après la surface » (décor) ou fidèles au tag `capacity` ?** *Proposition : décor assumé* : on trace des places d'après la forme du terrain, on affiche **le chiffre OSM** dans la fiche (ou « ≈ N places d'après la surface ») et on écrit « disposition illustrative » ; les voitures sont plafonnées par la capacité OSM quand elle existe. Alternative : ne montrer des places que pour les parkings dont la capacité est connue (12 polygones de surface : très peu).
3. **Souterrains : « radiographie » (translucide, 2 niveaux d'invention) ou simples panneaux « P » ?** *Proposition : panneaux au départ, radiographie en option (US006)*, avec la mention « 2 niveaux = décor » (OSM ne donne pas le nombre de niveaux). Le trou dans le sol est écarté (risque, +2 appels).
4. **Occupation : simulée par l'heure ou à brancher plus tard sur une source réelle ?** *Proposition : simulée, libellée « simulée »*, avec un crochet pour une source réelle (non étudiée ici : site statique, accès réseau et licence à vérifier). Quelles heures de pointe (courbe par type : centre-ville, gare, hôpital) ?
5. **Voitures : 1 pour 1 avec l'avatar (échelle 1 à 1,3), ou plus petites façon jouets ? Et à l'approche de l'avatar : elles s'effacent (proposé) ou on le laisse traverser sans effet ?** *Proposition : échelle 1,2, effacement à ≤ 4 m*. Les obstacles réels sont écartés (ils casseraient le déplacement libre).
6. **Périmètre : tous les parkings (≈ 380) ou seulement les nommés / ≥ 150 m² ?** *Proposition : tout l'aplat (gratuit), panneaux et voitures seulement pour les parkings ≥ 150 m² (≈ 165) et les nommés*, pour éviter 214 micro-parkings (< 150 m², < 6 voitures) qui encombrent sans apprendre rien. Et les 66 parkings **privés** (`access=private`) : peints plus pâles, ou masqués ?

---

## 10. Résumé final (≤ 10 lignes)

- Les parkings sont déjà dans `data/raw/overpass.json` (580 éléments) : il suffit de les extraire dans `city.json` (≈ 380 polygones, +60 Ko), sans nouvelle requête.
- Socle gratuit : **aplats dans la texture du sol** (0 appel) ; **marquages en géométrie** (1 appel, ≈ 12 000 triangles), car la texture à 1,55 px/m ne tient pas des places de 2,5 m.
- **Voitures par rayon** autour de la vue (1 `InstancedMesh`, ≈ 150 en moyenne, ≤ 450), occupation simulée par l'heure, **panneaux « P »** instanciés au sol, **noms via `street-names.ts`** : 0 appel de plus.
- Budget par vue : **+1 en vue d'ensemble, +3 à +4 près des parkings** (≤ +5 au plus), +0,05 M de triangles, +0,15 s de chargement ; couche éteinte : +0.
- L'avatar traverse déjà les parkings ; les voitures s'effacent à son approche (pas d'obstacles, pour ne pas casser le déplacement libre).
- Piège de données : « Parking du Château » (10 104 m², 604 places) est probablement le souterrain, pas un parking de surface.
- UI : bouton « 🅿️ Parkings » dans `.tools` (conservé en balade), fiche dans la carte des lieux, clic sur un panneau (priorité après les ✦ et les épingles).
- Plan : 9 user stories, **4 à 5,5 sessions pour le cœur**, 6,5 à 8,5 avec les options ; jalon prototype ≈ 1,5 à 2 sessions.
- Non vérifié : tout ce qui touche l'iPhone (≤ 31 images/s déjà), le rendu réel des marquages sur les pentes, la nuit.
- 6 questions ouvertes ci-dessus, avec proposition par défaut.
