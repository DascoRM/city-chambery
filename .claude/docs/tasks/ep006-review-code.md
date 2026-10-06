# EP006 : relecture de code (branche `feat/EP006-parkings`, diff `main...feat/EP006-parkings`)

Relecteur : agent de relecture, aucun fichier du dépôt modifié. Méthodes : **[L]** lu dans le code, **[E]** exécuté / mesuré (Python et Node jetables sur `data/raw/overpass.json` et `public/data/city.json`, `npm run build`), **[NV]** non vérifié. Le navigateur n'a pas été lancé (pas de `npx vite`) : tout ce qui est visuel ou de timing est [NV].

Résultat global : `npm run build` passe [E]. `city.json` régénéré : seules les clés `parkings`, `osmDate`, `generatedAt` diffèrent de `main` [E]. Aucun bloquant au sens « casse l'appli », mais 7 points importants dont 6 touchent la règle de vérité du projet ou l'exactitude des données.

---

## Importants

### I1. Entrées rattachées au mauvais parking, et « Parking Curial » absent de la couche
- `scripts/lib/parkings.mjs:156-166` [L], vérifié sur les données [E].
- Scénario : l'entrée est rattachée au parking non privé le plus proche à moins de 30 m, sans regarder son type ni son nom. Dans les données : les deux entrées `440099170` (« Parking Curial », Q-Park, 244 places, `parking=underground`, `fee=yes`) et `440102261` (« Parking Curial ») sont rattachées à `way/37376434` « Parking de l'Europe » (surface, à 7 et 8 m). L'entrée souterraine `267141780` est rattachée à `way/107345727` (classé « surface »). Conséquences : (a) le parking souterrain Curial, dont OSM donne nom, capacité et tarif, n'apparaît pas du tout (aucun polygone ni nœud `amenity=parking`, seulement ces entrées) ; (b) les entrées de Curial polluent « Parking de l'Europe » ; (c) toute lecture future de `entrances` pour un parking de surface est fausse. Les entrées ne servent aujourd'hui qu'à poser le panneau d'un souterrain (`parkings.ts:126`), donc (b) est invisible pour l'instant.
- Correctif : n'attacher une entrée qu'à un parking dont le type est compatible (`parking=underground` seulement à un souterrain, `multi-storey` à un silo ; une entrée sans type : à la plus proche mais pas à un parking de surface) ; pour une entrée nommée avec capacité qui n'a aucun hôte compatible (Curial), soit créer un parking (nom, capacité, tarif d'OSM, position = l'entrée), soit la signaler dans le rapport du script et proposer un `added` dans `parkings.json` avec source. Afficher le nombre d'entrées orphelines dans le rapport de `fetch-osm.mjs`.

### I2. Retouches manuelles présentées comme du « OpenStreetMap »
- `src/ui/parking-card.ts:21-24, 36`, `src/scene/parking-edits.ts:26-38` [L].
- Scénario : Dasco met `{ "way/456": { "capacity": 120 } }` sans `note`, ou ajoute un parking dans `added` : la fiche affiche « 120 places » et le pied de fiche « Source : OpenStreetMap, relevé du 28 septembre 2026. À vérifier sur place. ». Faux : la valeur ne vient pas d'OSM, et un parking `added` n'est pas dans OSM. C'est exactement ce que la règle « chaque chiffre porte son étiquette » interdit. Une retouche de `kind` vers `underground` garde aussi `est` (« ≈ N places » pour un souterrain, contraire à la règle de l'epic : jamais d'estimation pour un souterrain), car `edit.capacity` seul supprime `est` (`parking-edits.ts:34`).
- Correctif : marquer les données retouchées (`edited: true`, ou `source` : `'osm' | 'edit'`) ; pour un parking retouché ou ajouté, remplacer « Source : OpenStreetMap… » par « Retouché à la main » + `note` (rendre `note` obligatoire quand `capacity`, `fee`, `name` ou `added` sont posés, ou refuser au chargement avec `console.warn`) ; supprimer `est` si `kind` devient `underground`/`multi-storey` ou si `capacity` est posé (et traiter `capacity: 0`).

### I3. La retouche `pos` ne déplace pas le panneau comme annoncé
- `src/scene/parkings.ts:92-94, 124-134`, `src/content/parkings.json` (champ `retouches`), CHANGELOG itération 74 [L].
- Scénario : `overrides["way/x"].pos = [10, 20]` est documenté « Nouvelle position (m) du panneau » (`parking-edits.ts:16`). Mais (a) pour un parking à contour, `insidePoint` ne renvoie `p.pos` que s'il est dans le contour, sinon le point du contour le plus proche de ce `pos` : le déplacement est silencieusement ramené dans le polygone ; (b) pour un souterrain avec entrées, `place` essaie d'abord les entrées et ne regarde `p.pos` qu'ensuite : `pos` est ignoré dès qu'une entrée est sous un bâtiment. La retouche est donc sans effet pour exactement les cas où on en aurait besoin (souterrain mal posé).
- Correctif : une retouche `pos` doit gagner (`edited.pos` prioritaire dans `place`, sans projection dans le contour), ou changer la documentation.

### I4. `fee` : toute valeur autre que `yes` devient « Gratuit »
- `scripts/lib/parkings.mjs:125 et 150` : `...(tags.fee ? { fee: tags.fee === 'yes' } : {})` [L].
- Scénario : une valeur OSM `fee=unknown`, `fee=interval`, `fee=donation`, `fee=free`, `fee=0` ou `fee=customers` donne `fee: false`, donc fiche « Gratuit » en vert. Dans les données actuelles seules les valeurs `yes` (35) et `no` (8) existent [E], donc aucun effet visible aujourd'hui ; ça devient faux au prochain relevé OSM (`--offline` ne protège pas du suivant). Affirmer « gratuit » à tort est le pire cas pour la règle de vérité.
- Correctif : `fee: yes → true`, `no → false`, tout le reste → absent (« tarif inconnu »). Même correctif pour les nœuds seuls (ligne 150). Mettre en commun une petite fonction `feeOf(tags)`.

### I5. Estimation « ≈ N places » sur un polygone qui est un bâtiment
- `scripts/lib/parkings.mjs:136` [L], constaté [E].
- Scénario : `way/107345727` n'a pour tags que `amenity=parking`, `building=yes` (cadastre, 2011). Il est classé « surface » et reçoit `est: 77` (2 148 m² / 28), et une entrée souterraine OSM `267141780` se trouve à 3 m. C'est probablement un parking couvert ou souterrain : la fiche dira « Parking de surface, ≈ 77 places » (faux dans le type, et l'estimation aire/28 n'a aucune valeur pour un bâtiment à niveaux). C'est le seul cas des données actuelles [E], mais la règle est générale.
- Correctif : pas d'estimation (et pas de classement « surface » sûr) quand `building`, `covered`, `location`, `roof`… sont présents ; classer en type inconnu / « parking couvert » ou le traiter comme « surface sans estimation ». À tout le moins : `building=*` ⇒ ni `est`, ni aplat « surface » sans le dire.
- Voir aussi M3 (estimation faite sur l'aire avant rognage).

### I6. L'accès (`access`) est ignoré par le client : parkings « clients » et « abonnés » présentés comme publics
- `scripts/lib/parkings.mjs:20-28` produit `customers` / `subscribers` ; aucune lecture côté client (`grep` sur `src` : seulement les types) [E].
- Scénario : `way/1273312256` (`access=permit`, souterrain P3, abonnés) et `way/302897565` (`access=destination`, clients, ≈ 29 places estimées) s'affichent comme des parkings ordinaires avec leur couleur de tarif et leur panneau ; la fiche ne le dit pas. Un visiteur du site croira pouvoir s'y garer. Les privés sont exclus sur décision de Dasco, pas ces deux-là.
- Correctif : une ligne de fiche (« Réservé aux clients » / « Abonnés ») quand `access` est `customers` ou `subscribers`, ou les exclure comme les privés. Au passage, le Parking des Ducs (`node/1523885110`, Q-Park, 64 places, `access=private` dans OSM, noté dans le CHANGELOG 73) et l'« Hôpital » (260 places) disparaissent : décision prise, mais à rappeler dans la fiche d'epic pour qu'on ne la redécouvre pas comme un bug.

### I7. Premier affichage : coût non mesuré sur mobile (texture 2 048 px peinte deux fois + recompilations de shaders)
- `src/scene/terrain.ts:151-165`, `src/main.ts:251-270`, `src/scene/parkings.ts:77-88` [L] ; temps [NV].
- Le premier clic sur « Parkings » exécute, dans la même image : deux `paintGround` complets (`'parkings'` repeint toute la base : zones vertes, places, eau ; `'glow'` repeint les aplats sur noir), soit deux canvas 2 048 × ~1 800 px (≈ 14,7 Mo chacun, ≈ 20 Mo avec mipmaps) conservés pour toujours comme `texture.image` (≈ +40 Mo de mémoire au total, estimation par le calcul) ; l'envoi des deux textures au GPU ; la recompilation du programme du sol (`groundMat.needsUpdate` + ajout de `emissiveMap` : nouveau define `USE_EMISSIVEMAP`) ; la compilation du programme `parking-signs` (le groupe était invisible, donc jamais rendu jusque-là). Le CHANGELOG annonce « ≈ 0,1 s sur Mac, non mesuré sur iPhone » et ne mentionne ni les compilations ni la mémoire. Le projet a un point connu sur iPhone (≤ 31 img/s).
- Pas de violation BUG-01 [L] : le texte des shaders ne contient aucune valeur variable (`uNightP` est un uniforme partagé, clé de cache fixe `'parking-signs'` unique dans le dépôt, vérifié par `grep` [E]). `needsUpdate = true` à chaque bascule (off aussi) est bon marché si le programme est en cache, mais mérite un commentaire.
- Correctif possible : peindre les aplats dans un canvas « overlay » séparé (partir de `base.image` avec `drawImage`, ou faire un seul passage qui dessine les deux), réduire la texture de lueur à 1 024 px (elle est floue par nature) ; précompiler pendant le chargement (`renderer.compile(scene, camera)` avec le groupe visible un instant, ou `compileAsync`), ou préparer les textures dans `requestIdleCallback` après le chargement ; mesurer sur iPhone (rendu et temps de la première image après clic) avant la fusion.

---

## Mineurs

### M1. Identifiants dupliqués pour les relations multipolygones ; trous rattachés au seul premier contour
- `scripts/lib/parkings.mjs:48-52` (`id: \`${p.el.type}/${p.el.id}\`` pour chaque contour) et `scripts/fetch-osm.mjs:209` (`holes: i === 0 ? inners : []`, commentaire « POC ») [L] ; doublon constaté : `relation/21157100` deux fois (parking=lane, voirie, deux `outer`) [E].
- Scénario : `anchors` (Map par id), `overrides[id]` (`hide` retire les deux), `hitTargets` (`parkingId`) supposent des ids uniques. Aujourd'hui sans effet (voirie, jamais cliquable). Un parking réel en relation avec deux contours aurait deux panneaux et une fiche ambiguë. Un trou affecté à un mauvais contour est peint (evenodd) hors de l'extérieur.
- Correctif : suffixer (`relation/21157100#2`) ou ne garder qu'un panneau par élément OSM ; rattacher chaque trou au contour qui le contient.

### M2. Polygones rognés : sliver avec panneau, et surface « brute » pour la capacité estimée
- `scripts/lib/parkings.mjs:49, 134, 136` ; `src/scene/parkings.ts:106` [L], chiffres [E].
- `areaM2` est mesurée avant rognage, par choix commenté. Effets constatés : `way/386016788` (silo non nommé, 21 m² visibles sur 1 179 m² bruts) passe le filtre `areaM2 >= 300` et reçoit un panneau au bord du socle (risque de panneau à cheval sur la bordure) ; `way/22652766` : « ≈ 202 places » affiché pour 589 m² visibles (le parking réel s'étend hors socle : l'estimation est donc défendable, mais la carte montre un petit aplat et la fiche un grand nombre) ; l'aire ignore les trous (aucun cas aujourd'hui, `holes` = 0 [E]).
- Correctif : filtre du panneau sur l'aire rognée (ou sur « panneau si le centre est à plus de 10 m du bord ») ; soustraire l'aire des trous ; documenter dans la fiche que l'estimation concerne l'ensemble du parking.

### M3. `pos` : centroïde = moyenne des sommets, parfois hors du contour
- `scripts/lib/parkings.mjs:133`, `fetch-osm.mjs:433` [L] ; 7 polygones ont `pos` hors de leur contour [E] (dont `way/1489712516` « Parking Hôtel de ville », souterrain, et 4 parkings de surface).
- Scénario : pour un souterrain, le repli de `place` (`parkings.ts:126-131`) utilise `p.pos` : sans entrée sous un bâtiment, le panneau est posé hors du parking (c'est le cas de l'Hôtel de Ville si l'entrée `308729272` disparaît d'OSM). L'ancre de la fiche est correcte (calcul sur le même point).
- Correctif : utiliser `insidePoint` aussi pour les souterrains en repli ; ou calculer le centroïde d'aire, ou le pôle d'inaccessibilité, au script.

### M4. Sélection de l'entrée et du toit pour les souterrains : plusieurs hypothèses non vérifiées
- `src/scene/parkings.ts:117-134` [L], rendu [NV].
- (a) Première entrée dans l'ordre OSM qui tombe sous un bâtiment, pas la plus proche du centre ; (b) `data.buildings.find` peut renvoyer un bâtiment remplacé par un monument (`hidden` dans `buildCity`) : le panneau est alors posé à `b.h + 4` d'un bâtiment non dessiné, ou à la hauteur d'un bâtiment dont la hauteur OSM ne correspond pas au modèle (Château des Ducs, Parking du Château dessous) ; (c) un bâtiment avec `minH > 0` (pièce en surplomb) donnerait un toit trop bas ; (d) `+ 4 m` est une marge empirique : un toit pentu de plus de 4 m au-dessus de la gouttière noie le pied du poteau (le CHANGELOG 74 ne dit avoir vu que l'Hôtel de Ville) ; (e) l'effacement des bâtiments en balade ne touche pas les panneaux (déjà noté au CHANGELOG 73) : un panneau de toit flotte quand son bâtiment s'efface.
- Correctif : choisir l'entrée la plus proche du centroïde ; ignorer `hidden`/monuments (ou lire la hauteur du modèle) ; tester visuellement Château, Palais de Justice, Halles.

### M5. Zones de clic : volumineuses, non occultées, et elles interceptent les clics au sol
- `src/scene/parkings.ts:114-115, 149-154` (cylindre r = 5, h = 14 × `scale` 1,6 = 8 m × 22 m), `src/interaction.ts` (pick puis `if (!hit && walking)`) [L] ; comportement [NV].
- Scénarios : (a) en balade avec la couche allumée, un clic au sol dans l'emprise (visuelle) du cylindre ou « derrière » lui n'envoie pas l'avatar : `hit` est défini, la fiche s'ouvre ; (b) les bâtiments ne sont pas des cibles de rayon, donc un panneau caché derrière un bâtiment est cliquable à travers lui (même défaut que les gemmes, mais les cylindres sont plus gros) ; (c) un cylindre devant une épingle de bar lui vole le clic (le plus proche gagne).
- Correctif : cylindre plus petit (rayon 2,5 m, hauteur 12 m) ; ou ignorer les parkings quand `walking()` et clic sur sol ; pour (b), accepter ou tester l'occultation par les bâtiments.

### M6. Injection HTML : tout est échappé, sauf `note` (contenu du dépôt, pas d'OSM)
- `src/ui/ui.ts:213` : `lines.map((l) => \`<p class="pc-line">${l}</p>\`)` sans `esc` ; `src/ui/parking-card.ts:24, 28` [L].
- Lecture : le nom (`c.title`, `c.kind`, `feeLabel`, `c.source`) passe par `esc` ; l'infobulle utilise `textContent` ; les valeurs numériques passent par `int()` ou `parseFloat` ; le texte OSM n'entre dans aucune `line`. `lines` contient volontairement `<small>` (texte du JSON de contenu, fiable). Seul `p.note` (retouche saisie à la main, ou futur champ OSM) est injecté brut. Aujourd'hui c'est du contenu du dépôt, donc pas de faille ; le piège est le contrat « `lines: string[]` = HTML » : le prochain développeur qui ajoutera `p.operator` ou `p.name` dans une ligne créera une faille. Même remarque pour `data.parkings[].name` venant de `added` si un jour il vient d'un fichier externe.
- Correctif : `lines` en texte, avec une structure `{ text: string; small?: string }` échappée à l'affichage ; ou `esc(p.note)` dans `parking-card.ts`.

### M7. Fusion nœud-polygone et doublons « nus » : règles fragiles
- `scripts/lib/parkings.mjs:70-83, 95-103` [L].
- Fusion : le premier polygone trouvé gagne (pas le plus proche) ; « même capacité » est un critère très faible (`capacity=50` est courant) à 40 m du bord ; seul deux nœuds absorbés sont comptés dans `stats.merged`, même si l'hôte est ensuite écarté (privé, minuscule). Doublon nu : `informed(q)` accepte un hôte souterrain ou minuscule (un petit parking nommé au centre d'un grand polygone nu fait supprimer le grand) ; les tags du polygone écarté (`fee`, `access`) sont perdus au lieu d'être fusionnés dans l'hôte ; les centroïdes sont des moyennes de sommets (M3). Aujourd'hui un seul cas (La Falaise, vérifié dans les données [E]).
- Correctif : choisir l'hôte le plus proche ; exiger nom OU (capacité ET distance < 15 m) ; ne tester l'inclusion que pour des types identiques (pas souterrain contre surface) et fusionner `fee`/`access`.
- À vérifier hors code [NV] : `way/943464704` (silo sans nom, 440 places, `layer=3`, 4 niveaux) recouvre à 46 % `way/944405106` « Parking Cassine Gare » (479 places) [E]. Si c'est le même parking, les deux sont comptés ; la règle de doublon nu ne le voit pas (l'un porte une capacité). À contrôler sur OSM, sinon `hide` dans `parkings.json`.

### M8. Cas limites de classement (aucun effet dans les données actuelles, vérifié sur les 412 éléments [E])
- `scripts/lib/parkings.mjs:12-18` [L] :
  - `level="0;-1"` ou `"-1;0"` : `parseFloat` lit le premier nombre (« 0;-1 » n'est pas souterrain, « -1;0 » l'est) ;
  - `layer` négatif sans `level` (pont, tranchée) force « souterrain » même pour une poche de surface (ligne 14 relit `layer` même quand `level` existe) ;
  - `location=rooftop`/`roof`, `parking=carports`/`garage_boxes`/`sheds` : classés « surface » avec estimation ;
  - `parking=shoulder`, `on_kerb` : voirie, bien ;
  - ligne 112 (`if (kind === 'underground' && p.kind !== 'underground' && !p.t.parking) kind = 'underground'`) est un no-op (déjà fait ligne 111) : code mort ;
  - `accessOf` : `access=customers|destination|delivery` tous « clients » ; `unknown` si absent (120 cas) : voulu.
- Correctif : parser `level` par `split(';')` et prendre le minimum ; limiter la règle `layer<0` à `parking` non `surface` ; supprimer la ligne 112.

### M9. Étiquetage de la source : date et calibrage
- `src/main.ts:~442` (`data.osmDate ?? data.generatedAt`) [L] : si `city.json` n'a pas `osmDate`, la fiche dit « relevé du <date de génération> » (date du traitement, pas du relevé) ; c'est le cas de tout `city.json` généré avant l'itération 73 ou depuis un cache sans `osm3s`. Actuellement `osmDate = 2026-09-28T18:57:21Z` [E]. Correctif : si `osmDate` manque, ne pas écrire « relevé du… » (ou « généré le »).
- `SQM_PER_SPACE = 28` « mesuré sur Roissard : 138 places estimées pour 149 réelles » (`parkings.mjs:6`) : OSM ne donne pas la capacité de Roissard (`est = 139` dans `city.json` [E]) ; la source des « 149 » n'est pas dans le dépôt. Un seul point de calibration pour annoncer « ±30 % » (epic, `estimatedNote`). À sourcer ou à reformuler.
- La fiche affiche `capacity:disabled` en « dont N pour les personnes à mobilité réduite » sans étiquette propre (c'est OSM, couvert par le pied de fiche : acceptable).
- `parking-card.ts:26` : `maxheight` en pieds (`6'6"`) donnerait « 6 m » ; valeurs doubles (`1.9;2.1`) prennent la première. Données actuelles : décimales seulement [E].

### M10. Accessibilité
- `src/ui/ui.ts:113` : `aria-label` sur un `div` sans rôle : ignoré par les lecteurs d'écran ; ajouter `role="group"` ou `role="region"` ; la légende n'est pas annoncée à l'ouverture (le toast `role="status"` annonce seulement le nombre de parkings).
- Le bouton `aria-pressed` + `title` : correct [L]. `.btn.on` : contour sur fond blanc, état visible [NV].
- Aucune voie clavier vers les fiches de parking (les panneaux sont des zones de rayon, comme les gemmes : défaut préexistant, à traiter dans US009). Les aplats ne se distinguent que par la couleur : orange / menthe / lavande ; la fiche et la légende donnent le texte « Payant / Gratuit / Tarif inconnu » mais pas la carte ; envisager une trame ou le P teinté plus lisible.
- Contraste du texte du pied de fiche inchangé (hors périmètre).

### M11. Types, code mort, style
- `src/main.ts:87` `parkingsContent as unknown as ParkingEdits` : nécessaire parce que le JSON infère `{}` / `never[]` ; préférable de typer `parkings.json` via une assertion `satisfies` ou un petit validateur qui rejette les clés inconnues (une faute de frappe dans `overrides` est silencieuse). `applyParkingEdits` est appelé avant `if (!data)` (ordre bizarre, sans conséquence) ; `Parking.note` existe côté type de données alors que seul `added`/`overrides` la posent.
- `src/ui/ui.ts:207` `shownPlace = { id: c.id } as Place` : mensonge de type ; tout futur code lisant `shownPlace.name` plante ou affiche `undefined`. Mieux : `shown: { kind: 'place', place } | { kind: 'parking', id }`.
- Champs écrits mais jamais lus côté client [E] : `dupOf` (`types.ts`, `parkings.mjs:137`, 2 occurrences), `levels` (jamais affiché), `access` (voir I6), `entrances` des parkings qui ne sont pas des souterrains (calculées, jamais utilisées). `areaM2` est lu (filtre `minArea`). Poids : 37 Ko pour 151 parkings [E], négligeable, mais `dupOf` est du bruit de diagnostic dans `city.json`.
- `src/content/avatar.json` porte `parkingSigns` : réglage d'une couche de parkings dans le fichier « balade avec un avatar » (la `note` en tête du fichier a été étendue). Cohérence : préférer `parkings.json` (ou un `parkings-signs` dédié).
- `src/style.css` : le bloc `.btn.on`, `.parking-legend` est inséré sous le commentaire `/* Boussole */` ; `.parking-legend` positionné à `bottom: 90px` (et 150 px en mobile) à la main : collision possible avec `.help` et `.recenter` à l'écran étroit [NV].
- `src/scene/parkings.ts` : `new MeshBasicMaterial` par zone de clic (59) au lieu d'un matériau partagé ; chaque zone est un objet de la scène avec `matrixAutoUpdate` (mise à jour de matrice chaque image même groupe invisible : négligeable, mais `hit.matrixAutoUpdate = false; hit.updateMatrix()` serait gratuit) ; `Math.min(...xs)` recalculé dans la double boucle 13 × 13 (169 fois, `parkings.ts:97`) : sans risque ici (contours de quelques dizaines de points, jamais près de la limite d'arguments) mais à sortir de la boucle ; rotation du panneau selon l'indice `i` (`parkings.ts:144`) : change si l'ordre des données change (préférer un hash de l'id). Pas d'allocation par image dans le code ajouté [L] : le ticker de lueur ne fait qu'un `Math.round` et un `getObjectByName` seulement quand la valeur change (≤ 21 fois) ; les `new Vector3` de `place`/`make` sont au chargement.
- `README.md:400-404` : les lignes `scripts/lib/parkings.mjs`, `scene/parkings.ts`, `scene/parking-edits.ts` sont insérées au milieu de la liste de `scene/` ; manquent `ui/parking-card.ts`, `content/parkings.json`, et la mention de la clé `parkingSigns` dans `content/avatar.json`. Pas de mention de la manière de retoucher les parkings ni de `?debug` (id dans la fiche) hors `parkings.json`.

### M12. Documents de suivi
- `docs/specs/epics/EP006-parkings/epic.md:3` : « maquette à faire, rien n'est codé » alors que le tableau des US (lignes 48-50) dit US001 à US003 « fait » : en-tête périmé.
- `docs/versions/backlog/BACKLOG.md` : « Epic à venir … pas commencée » alors que trois itérations sont faites.
- CLAUDE.md projet : « une branche par user story dans l'epic » : US001 à US003 sont toutes dans la branche d'epic, et le commit `0f023f8` regroupe quatre corrections (régression, doublon, souterrains, retouches) ; process à respecter pour les prochaines US (le commit d'itération 74 mélange aussi code et `docs`, alors que la convention demande un commit séparé).
- CHANGELOG 74 « Vérifié » : « aucune erreur console » et les temps d'appels de rendu (+3) viennent de l'itération 73, avant la fusion des deux maillages en un ; le gain annoncé « 1 appel de rendu » n'est pas remesuré. Le « Non vérifié » liste bien La Falaise visuelle et les toits du Château et du Palais de Justice : cohérent avec M4.
- DECISIONS.md : les décisions « lueur par texture émissive », « privés exclus », « surface/28 » sont tracées ; il manque celle de **la règle de doublon nu** (écrite à la ligne 81 mais sans l'alternative écartée) et celle du **rognage de l'aire avant estimation**.

---

## Régressions recherchées (anciens comportements)

Lu dans le code [L], non exécuté dans un navigateur [NV] :
- **Zones de clic** : `hitTargets` reçoit d'abord les gemmes et les épingles (`main.ts:~404`, `unshift` avant `installInteraction`), le tableau est partagé par référence avec `interaction.ts` (aucune copie, `o.targets` utilisé tel quel) ; l'ajout/retrait des zones des panneaux se fait par `push`/`splice` sur le même tableau. Pas de nouvelle régression trouvée. Les zones d'un groupe `visible = false` sont retirées de la liste (nécessaire : `Raycaster` ignore la visibilité du parent) [L].
- **Fiches de bars** : survol → `onHover` inchangé ; fiche épinglée par un clic : `parkingSel = null` puis `openPlace` ; une fiche de parking est « pinned » donc le survol d'un bar n'ouvre rien tant qu'elle est ouverte (comportement identique à une fiche de bar épinglée). `setPlaceStatus` ne trouve pas `.pc-status` dans une fiche de parking : sans effet.
- **Fiches d'histoire** : le clic sur un lieu appelle `closePlace()` (qui remet aussi `parkingSel` à `null`) ; ✕, Échap, clic dans le vide ferment la fiche de parking par `placeCardState().place` truthy (`ui.ts:366`, `main.ts:437`).
- **Mode balade** : `onGround` renvoie `false` si une fiche est ouverte (le premier toucher ferme la fiche) ; clic sur un panneau : ouvre la fiche sans marcher (comme un bar) ; voir M5 pour l'interception des clics au sol. L'effacement des bâtiments (`cutaway.ts`) n'a pas de lien avec les nouveaux matériaux ; les panneaux ne sont pas dans `modelsRoot` ; `flags.ts` ne raycaste que `modelsRoot` et `city.group` : inchangés.
- **Éléphants** : `hunt.click`/`hunt.pointerMove` passent avant `pick` : inchangés. **Lobby** : `.lobby-open .parking-legend` masque la légende ; bouton dans `.tools` déjà masqué.
- **Double toucher mobile** : inchangé (`interaction.ts` non modifié hors `pick`). Un double tap sur un panneau ouvre la fiche au premier toucher et zoome au second (comme pour un bar).
- **Nuit** : `createDayNight` ne parcourt que `userData.nightGlow` ; les panneaux ont leur propre uniforme partagé (`city.night.uNight`) : OK [L].

## Ce qui est correct (lu ou exécuté)

- Règle de vérité côté extraction : `est` n'est jamais mêlé à `capacity`, jamais posé pour souterrain ou silo, étiqueté « ≈ … (estimé d'après la surface) » dans la fiche ; capacité inconnue assumée ; surface en m² jamais affichée ; `city.json` produit par le script uniquement (diff vérifié [E]).
- Texte OSM : échappé partout sauf `note` (M6).
- Shaders : un seul programme `parking-signs`, uniformes seulement, pas de valeur cuite dans le texte (BUG-01 respecté) ; `needsUpdate` du sol : voir I7.
- Pas de nouveau paquet ; `package-lock.json` non touché ; pas de licence tierce nouvelle (formes en code).

## Synthèse (12 lignes)

1. Bloquants : 0. Importants : 7 (I1 à I7). Mineurs : 12 (M1 à M12). Build OK [E] ; navigateur non lancé.
2. Les 3 plus importants : (I1) entrées rattachées au mauvais parking et Parking Curial (Q-Park, 244 places) absent de la couche, ses entrées collées à « Parking de l'Europe » ; (I2/I3) retouches : valeurs manuelles étiquetées « OpenStreetMap », `pos` ignoré, `est` conservé après changement de type ; (I4) `fee` ≠ `yes` devient « Gratuit ».
3. Aussi : estimation « ≈ 77 places » sur un bâtiment (I5), accès abonnés/clients affiché comme public (I6), premier affichage mobile non mesuré (2 textures de 2 048 px + 2 compilations, I7).
4. À corriger avant fusion dans `main` : I1, I2, I3, I4, I5, I6 (courts, dans le script et la fiche), mesurer I7 sur iPhone, puis régénérer `city.json` (`npm run data -- --offline`).
5. À corriger dans la foulée : M1 (ids uniques), M5 (zones de clic en balade), M6 (échapper `note`), M12 (en-têtes `epic.md` et BACKLOG périmés, README).
6. À contrôler hors code : `way/943464704` vs « Parking Cassine Gare » (double comptage possible), toits des souterrains du Château, du Palais de Justice et des Halles.
7. Rappel : la fusion dans `main` part sur Vercel ; attendre l'accord de Dasco.
