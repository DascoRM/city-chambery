# EP006 Parkings : plan « données »

Auteur : chercheur/planificateur (aucun code ni fichier du dépôt modifié, hors ce plan).
Date de l'analyse : 2026-10-03. Périmètre : la DONNÉE uniquement (pas de rendu 3D).

Légende de fiabilité, utilisée partout :
- **[mesuré]** : calculé par moi sur `data/raw/overpass.json` (extraction OSM du 2026-09-28 18:57 UTC) ou sur un fichier téléchargé aujourd'hui.
- **[code]** : lu dans le code ou `city.json` du dépôt.
- **[web]** : lu aujourd'hui via WebFetch/WebSearch. Le résumé est fait par un petit modèle : à revérifier sur la page avant de s'en servir comme fait publié.
- **[mémoire]** : de mémoire, non vérifié.

Méthode de mesure : projection en mètres autour de l'origine de `city.json` (45,56575 N ; 5,9205 E), les mêmes coordonnées x (est) / y (nord) que le diorama. Emprise du diorama : x ±662,4 m, y ±583,4 m (soit 1 325 x 1 167 m) [code : `city.json` `bounds`].

---

## 1. Ce que contient OSM dans l'emprise

### 1.1 Inventaire des objets de stationnement [mesuré]

La requête Overpass prend déjà tous les `amenity` (`nwr["amenity"]`), donc **tous ces objets sont dans `overpass.json`** : aucun nouveau téléchargement n'est nécessaire pour la partie OSM.

| Objet | Nombre | Détail |
|---|---|---|
| `amenity=parking` | 412 | 411 ways/nœuds + 1 relation. 95 « voirie » (`parking=lane` 42, `street_side` 53), 317 « hors voirie » |
| dont `parking=surface` | 71 | (+ 231 ways sans `parking=*`) |
| dont `underground` | 9 (5 ways + 4 nœuds) | |
| dont `multi-storey` | 6 (5 ways + 1 nœud) | |
| `parking_entrance` | 19 | 8 `underground`, 3 `multi-storey/surface`, 8 sans type ; 4 portent nom/capacité (Hôtel de Ville 243, Curial 244) |
| `parking_space` | 13 | 3 nœuds + 10 ways ; 7 PMR ; 7 « places » d'un seul emplacement. Inutilisable pour compter |
| `bicycle_parking` | 136 (133 nœuds, 3 ways), tous dans l'emprise | somme des `capacity` = 1 783 (dont un 470 = Vélostation, un 80, un 60) |
| `motorcycle_parking` | 1 (3 places, `[-102, 580]`, bord nord) | |
| `car_sharing` | 15 (tous Citiz, Alpes Autopartage) | 13 nœuds + 2 ways ; capacités 1 à 3 ; 2 avec `fixme=à replacer avec précision` |
| `charging_station` | 2 | 1 vraie borne (eborn, `[417,-187]`), 1 « Vélostation vélos électriques » |
| `bicycle_rental` | 1 | Synchro Vélostation, `capacity=650`, horaires saisonniers, `[-34,520]` |
| `bicycle_repair_station` | 4 | |
| `vending=parking_tickets` | 1 | horodateur |
| Voies avec `parking:left/right/both` | 43 voies ont du stationnement tagué | 3 544 m de voie, 4 425 m de bord (côtés cumulés) ; 50 voies `parking:both=no` |

Sur les 317 `amenity=parking` hors voirie : 297 ont leur centre dans l'emprise, 20 sont hors cadre (centres hors emprise ; ils seront de toute façon rognés).
Accès (297 dans l'emprise) : `private` 63, `yes` 24, `destination` 1, `permit` 1, **non renseigné 208**. Après retrait de private/permit : **233 parkings hors voirie « publics ou inconnus »**.

### 1.2 Complétude des tags (412 `amenity=parking`) [mesuré]

| Tag | Nb | % |
|---|---|---|
| `parking=*` | 181 | 44 % (donc 231 sans type) |
| `access` | 104 | 25 % |
| `fee` | 43 (yes 35, no 8) | 10 % |
| `name` | 28 | 7 % |
| `capacity` | 24 | 6 % |
| `operator` / `brand` | 15 / 10 | 4 % / 2 % |
| `opening_hours` | 9 (8 « 24/7 ») | 2 % |
| `maxheight` | 7 | 2 % |
| `capacity:disabled` | 6 | 1,5 % |
| `supervised` | 3 | |
| `maxstay` | 1 (`load-unload`) | |
| `charge` | 0 | |
| `capacity:charging` | 1 (Château : 3) | |
| `park_ride` | 6 (yes 1) | |
| `ref:FR:BNLS` | 3 | Château, Manège, Barbot (importés de la BNLS en 2024-01) |
| `building:levels` ou `level`/`layer` | 3 / 3 / 7 | niveaux souvent absents ou aberrants (`building:levels=0` sur Cassine) |
| `website` | 6 (Q-Park) | |

Hors voirie, non privés, dans l'emprise (233) : 13 avec capacité (6 %), 19 avec nom (8 %), 27 avec `fee`. **Les données OSM seules ne suffisent donc que pour une quinzaine de parkings ; le reste est de la géométrie sans attributs.**

### 1.3 Parkings nommés ou avec capacité (hors voirie, dans l'emprise) [mesuré]

Positions en mètres du diorama (x, y). « aire » = aire du polygone OSM (contour extérieur) ; « — » pour un nœud.

| Objet OSM | Nom | Type | Capacité | Tarif / accès | Position | Aire (m²) |
|---|---|---|---|---|---|---|
| n1264602039 | Parking du Château (Q-Park, BNLS 73065-P-014) | underground | 604 (PMR 12, recharge 3) | fee=yes, 24/7, h max 1,9 | -355, -111 | — |
| w1489707144 | Parking du Château (doublon, voir 1.4) | ? | 604 | — | -337, -110 | 10 050 |
| n436252017 | Parking du Palais de Justice (Indigo) | underground | 400 | fee=yes, 24/7 | -94, 315 | — |
| w1489712515 | Parking Palais de Justice (doublon) | underground | 400 | — | -106, 289 | 4 316 |
| w1489712516 | Parking Hôtel de ville | underground | 243 | fee=yes | 5, 74 | 1 332 |
| n1527204336 | Q-Park Les Halles | underground | 283 | fee=yes, 06:30-01:00 | -172, 74 | — |
| n1523885110 | Parking des Ducs (Q-Park) | underground | 64 | fee=yes, access=private | 253, 317 | — |
| w113058327 | La Falaise | multi-storey | 495 (h max 1,9) | fee=yes, 24/7 | 473, -379 | 2 493 |
| w1044449679 | Parking Ravet | multi-storey (6 niveaux) | 400 | fee=yes | 356, 237 | 2 086 |
| w944405106 | Parking Cassine Gare | multi-storey | 479 | fee=yes, 24/7 | 28, 644 | 1 935 |
| w943464704 | (sans nom ; parc relais `park_ride=yes`, 4 niveaux) | multi-storey | 440 (PMR 10) | fee=yes | 41, 646 | 4 161 |
| n2836397206 | Hopital (P1) | multi-storey | 260 | access=private | -625, -331 | — |
| w26543877 | Place du Manège (BNLS 073065-P-008) | surface | 84 (PMR 2) | fee=yes, 24/7 | 424, -227 | 3 027 |
| w37376434 | Parking de l'Europe | surface | 154 (PMR 3) | fee=yes, 24/7 | 230, -268 | 5 017 |
| w37716747 | Parking Barbot | surface | 58 (PMR 2) | fee=yes, 24/7 | 382, -326 | 2 528 |
| w346466086 | Parking Grenette | surface | 23 | fee=yes | -290, 69 | 514 |
| w346465993 | Parking Jacob / Lyon | surface | 12 | fee=no | -540, -316 | 317 |
| w290757527 | Q-Park Roissard | surface | **absente** | fee=yes | -144, 433 | 3 859 |
| w21911243 | Espace Amélie Zenzen - Parking du Laurier | surface | absente | fee=yes | 408, 132 | 2 215 |
| w1368143295 | Courte durée (P4) | ? | absente | fee=yes | -553, -161 | 3 276 |
| w37422132 | Place Porte Reine | surface | absente | fee=yes | 1, -178 | 885 |
| w25528760 | Parking de Lattre de Tassigny | surface | absente | fee=yes | -348, 457 | 356 |
| w338336146 | Parking Square Paul Vidal | surface | absente | fee=no | -232, 476 | 324 |
| w139314672 | Parking INSPÉ | surface | absente | private | -452, 267 | 2 701 |
| w1489712515 etc. | autres souterrains/privés sans nom | | | | | |
| Parking Curial | **aucun objet parking** : seulement 2 `parking_entrance` (244 places, Q-Park) | underground | 244 | fee=yes, 24/7 | entrées -> 178, -273 et 180, -246 | — |

Parkings du centre **absents** d'OSM comme objet (BNLS les liste) : Curial (surface : aucune), et ceux hors emprise (Gare, Verdun, Cassine 2 : voir 2.1).

### 1.4 Doublons et pièges [mesuré]

1. **« Parking du Château » : doublon certain.** Nœud n1264602039 (`-355,-111`, riche en tags, BNLS) et polygone w1489707144 (`-337,-110`, 10 050 m², tags minimaux, `capacity=604` aussi). À 19 m l'un de l'autre. Même parking : à compter une seule fois (604, pas 1 208).
2. **« Parking du Palais de Justice » : doublon certain.** Nœud n436252017 (Indigo, 400) et polygone w1489712515 (4 316 m², 400), à 29 m.
3. **Hôtel de Ville** : un polygone (w1489712516, 243) + un `parking_entrance` portant aussi `capacity=243` : même parking, à ne pas sommer.
4. **Curial** : 2 `parking_entrance` (244 sur l'un, rien sur l'autre) = un seul parking.
5. **« Château » et « Ducs » ne sont PAS le même parking.** Château : Faubourg Maché, `(-355,-111)`. Ducs : 1 boulevard de Lemenc, `(253,317)`, à environ 740 m. La BNLS les distingue (P-014 et P-010). Les doublons sont ceux ci-dessus, pas ce couple.
6. **Ducs : OSM dit 64 places, `access=private` ; la BNLS dit 112 places, `usagers=abonnés`** (même parking, ~47 m d'écart de position). Les deux sources divergent : à trancher par fiche.
7. **Cassine Gare (479) + parking sans nom (440, parc relais)** à 20 m l'un de l'autre : probablement deux bâtiments distincts (le second est le parc relais) mais non vérifié. La BNLS ne liste ni l'un ni l'autre.
8. **Capacités contradictoires entre sources** : Ravet 400 (OSM) contre 474 (page ville, [web]) ; Europe 154 (OSM) contre 149 (BNLS) ; Hôpital P1 260 contre 259.
9. **Exploitant incohérent** : Halles = Q-Park dans OSM, mais SAGS dans la BNLS (SIRET et URL `sags.fr`). Le portail ville cite Q-Park, SAGS, Indigo et Effia [web].
10. Le nœud « Hopital » marque P1 (260) en `access=private`, alors que la BNLS le déclare ouvert à tous (`usagers=tous`). L'accès OSM ne peut pas être pris tel quel.
11. La **relation** (`parking=lane`, 45 m²) est négligeable ; elle est exclue en pratique.

### 1.5 Estimation de capacité pour les polygones sans capacité

**Ce que dit la mesure** (polygones avec capacité connue, surface en m² du contour / nombre de places) :

| Cas | Valeurs m²/place | n | Constat |
|---|---|---|---|
| Surface (`parking=surface`) | 36,0 ; 32,6 ; 43,6 ; 21,3 ; 26,4 ; 22,4 ; **25,9 (Roissard, avec la capacité BNLS 149)** | 7 | médiane 26,4, moyenne 29,5, écart-type environ 7,7 (±26 %) |
| Voirie `street_side` / `lane` avec capacité | 31,7 ; 18,4 ; 27,1 ; 13,4 ; 21,8 | 5 | un seul vrai alignement (13,4 : place en bande) |
| Multi-étages | 5,0 (Falaise) ; 4,0 (Cassine) ; 5,2 (Ravet) ; 9,5 (relais, 4 niveaux) | 4 | emprise au sol : il faut multiplier par le nombre de niveaux |
| Souterrain | 10,8 (Palais) ; 5,5 (Hôtel de Ville) ; 16,6 (Château, 10 050 m²) | 3 | niveaux inconnus (pas de tag), écart d'un facteur 3 |

**Le « 12,5 m²/place » ne vaut pas pour un polygone de parking complet** : c'est la surface nette d'une place (5 m x 2,5 m). Avec allées et îlots, la mesure donne **environ 26 à 30 m² par place en surface** (21 à 44 observés). 12,5 m² ne convient qu'à une bande de stationnement en épi/créneau le long d'une voie (13,4 mesuré sur 1 cas : trop peu pour généraliser).

**Règles d'estimation proposées :**

| Type | Formule | Erreur attendue |
|---|---|---|
| Surface sans bâtiment | `places = round(aire / 28)` | ±30 % (médiane 26,4 ; plage 21 à 44, donc facteur 0,64 à 1,33). Validé sur Roissard : 3 859 / 28 = 138 contre 149 réel (-7 %) |
| Multi-étages en bâtiment | `aire x niveaux / 28` avec `niveaux` pris dans `building:levels` ; sinon **ne pas estimer** | ±20 % si le tag de niveaux est fiable (Ravet 2 086 x 6 / 28 = 447 contre 400 à 474) ; inestimable sinon |
| Souterrain sans niveaux | **pas d'estimation** : afficher « capacité inconnue » ou renseigner à la main | facteur 3 |
| Voirie en bande (`parking=lane`, `orientation=parallel`, largeur < 3 m) | `aire / 12,5` (arrondir) | à confirmer : un seul cas mesuré (13,4) |
| Voirie `street_side` en poche | `aire / 22` | très incertain (18 à 32, n=4) |
| Voies avec `parking:side=lane` (pas de polygone) | `longueur du bord / 5,5` (parallèle) | ±25 % (non mesuré ; 5,5 m est la longueur légale d'un créneau de mémoire). Ordre de grandeur : ≈ 800 places sur les 43 voies de l'emprise |
| Moins de 100 m² | ne pas estimer (3 à 4 places au plus, bruit) | |

Comptage par `parking_space` : **inutilisable** (13 objets, 7 PMR, dispersés). Retenu seulement pour la mention « places PMR » quand un point existe.

Volume : 219 polygones non privés hors voirie sans capacité, 61 120 m² au total, soit environ **2 200 places** estimées en surface à 28 m²/place (±30 %). Répartition par taille : 111 de moins de 100 m², 69 de 100 à 300 m², 25 de 300 à 1 000 m², 11 de 1 000 à 3 000 m², 3 au-dessus de 3 000 m². **Seuls 39 polygones dépassent 300 m²** (liste dans l'annexe A) ; les 180 autres sont des poches de 2 à 10 places (domaine de la masse, pas des « parkings » à raconter).

Rappel : l'estimation donne un **ordre de grandeur de jeu**, jamais un fait. À marquer `capacityEstimated: true` et à afficher « ≈ ».

### 1.6 Ce que `fetch-osm.mjs` conserve aujourd'hui [code + mesuré]

- Aucun `amenity=parking` n'est exporté en tant que parking. Les seuls usages sont : (a) `placeKind` ne retient que bar, pub, cafe, restaurant, nightclub, biergarten, ice_cream (`fetch-osm.mjs` l. 327) ; (b) les 2 bâtiments `building=parking` apparaissent dans `buildings` (kind `parking`, rendus plats via `FLAT_KINDS` de `roofs.mjs`) ; (c) les `highway` de service (`parking_aisle` 134, `driveway` 32) sont des routes de `roads` (kind `service` : 284 dans `city.json`).
- `grep parking` dans `src/` : **aucune occurrence**. `scripts/` : seulement `roofs.mjs`.
- Les polygones `amenity=parking` hors bâtiment sont donc **absents** de `city.json` ; seuls les lignes d'allée et les bâtiments sont tracés.
- Le tag `parking:left/right/both` des voies est **perdu** (les `roads` ne gardent que `kind`, `w`, `pts`, `name`).
- `city.json` aujourd'hui : 1 442 176 octets, 409 902 octets gzip. Clés : buildings (1,05 Mo), roads (201 Ko), areas (64 Ko), places (21 Ko), etc.

---

## 2. Sources externes

Réseau : WebFetch/WebSearch ont fonctionné ; j'ai aussi téléchargé la BNLS et le shapefile ville avec `curl`. Les fiches data.gouv.fr ont été lues via un résumé automatique : **les licences et dates sont à confirmer visuellement avant toute attribution dans le README**.

### 2.1 Tableau d'évaluation

| Source | Contenu utile | Licence | Format | Fraîcheur | Couverture | Accès / CORS | Temps réel |
|---|---|---|---|---|---|---|---|
| **BNLS** (transport.data.gouv.fr, `resources/78899`) [mesuré, 827 lignes, 209 Ko] | **16 parkings de Chambéry** : nom, adresse, coordonnées lon/lat, `nb_places`, `nb_pmr`, `nb_velo`, `nb_2r_el`, `nb_autopartage`, `hauteur_max`, `gratuit`, `type_usagers`, SIRET, tarifs 1 h/2 h/3 h/4 h/24 h, abonnements résident/non-résident, type d'ouvrage, texte d'info (horaires, gratuité 30 min) | ODbL + conditions particulières [web] | CSV `;` (schéma `etalab/schema-stationnement` 0.1.5) | **« Obsolète, plus maintenue »** ; dernière MAJ 2024-01-09 [web] | France entière (partielle) ; Chambéry : P-001 à P-016 | Pas de clé. Téléchargement ponctuel par le script ; pas besoin de CORS | Non |
| **Open data Ville de Chambéry** « Parkings enclos ou ouvrage » (data.gouv.fr, id dataset à confirmer) | Les mêmes 16 parkings (extrait du shapefile : champs `type, nom, adresse, proprietaire, gestionnaire, gratuit, usage, nb_place, nb_pmr, covoit, haut_max, tarif_*, abo_*, url, info, insee`) [mesuré]. Fichier interne daté du 2020-07-30 ; republié 2025-04-11 [web] | **ODbL** (API data.gouv.fr : `odc-odbl`) [mesuré]. Un résumé web citait aussi « Licence Ouverte 2.0 » : l'API fait foi | ZIP de 3,6 Ko : shapefile points (`.shp`/`.dbf`/`.prj`) | Données 2020 (tarifs de 2020 : ex. Gare 2 h = 0 ou 6,2 selon le fichier ; incohérences) | 16 parkings en ouvrage/enclos | URL statique `static.data.gouv.fr/.../parking-ouvrage-enclos.zip`, **CORS `*` mesuré** | Non |
| **Open data Grand Chambéry** `donnees.grandchambery.fr` (jeu `parkings-enclos-ou-ouvrage-a-chambery_v2`) [web] | Version Opendatasoft du même jeu (API/exports) | probablement ODbL | JSON/CSV/GeoJSON via API | MAJ non lue | idem | **Certificat TLS expiré** lors de mon essai (WebFetch refuse) : fragile | Non |
| **Stationnements vélos de Grand Chambéry** (data.gouv.fr) [web] | Arceaux, 2 745 arceaux sur ~532 sites en 2025 (page ville) ; 492 arceaux/115 sites ajoutés en 2025 | ODbL | SHP Lambert 93 (RGF93) + Excel de doc, 78,8 Ko | MAJ 2026-08-28 (lu) | Grand Chambéry | URL statique, pas de clé ; reprojection Lambert 93 -> WGS84 à faire au script (formule ou `proj4`) | Non |
| **Services mobilité Synchro Grand Chambéry** (data.gouv.fr, id 66e23d13…) [web] | Vélostation, location, stationnement sécurisé | non lu | non lu | non lu | | à lire | Non |
| **Open data Ville : stationnement sur voirie, PMR, horodateurs** | **Rien trouvé** : l'organisation « Ville de Chambéry » ne liste que 10 jeux (marchés publics, budget, quartiers…) [web] | | | | | | |
| **Tarifs voirie, page chambery.fr** [web] | 2 zones (rouge, verte) ; vert : 0,70 € les 45 min, max 5 h, au-delà 31 € ; rouge : 1,00 €, max 3 h, au-delà 39 € ; 30 premières minutes gratuites ; **payant 9h-12h et 14h-19h, gratuit le soir, le dimanche et jours fériés** ; PayByPhone / Q-Park Connect | pas de licence : contenu de site public, **source citée seulement, pas de donnée réutilisable à copier massivement** | HTML | page courante | Chambéry | scraping inutile : 2 zones à saisir à la main | Non |
| **Page « Les parkings » chambery.fr** [web] | 17 parkings en ouvrage/enclos, exploitants Q-Park, SAGS, Indigo, Effia ; capacités ; gratuité samedi après-midi (Falaise, Château) ; Stade-Piscine 430 places + 22 bornes ; Ravet **474** | idem | HTML | courante | | à citer comme source de fiche | Affichage dynamique sur panneaux uniquement (pas de flux) |
| **Exploitants** Q-Park (q-park-resa.fr), Indigo (parkindigo.com), Effia, SAGS | tarifs, capacités, réservations | **conditions d'usage de sites commerciaux** : ne pas recopier massivement ; lien sortant OK | HTML | à jour | | pas d'API publique connue [mémoire] | Pas de flux ouvert connu [mémoire] ; une API navigateur sans clé n'existe pas à ma connaissance |
| **Disponibilités temps réel** (data.gouv.fr « Disponibilités en temps réel des places de parkings ») | **Aix-Marseille-Provence, pas Chambéry** [web] | LO 2.0 | CSV/JSON | | non applicable | | **Aucun flux Chambéry trouvé** |
| **IRVE** (Base nationale des IRVE, data.gouv.fr ; PAN en cours de remplacement) [web] | 1 ligne par point de charge : id station/pdc, coordonnées, puissance, connecteurs, accès/gratuité, horaires, opérateur | **Licence Ouverte Etalab 2.0** | CSV/GeoJSON, MAJ quotidienne ; schéma statique 2.3.1 ; **ancienne base supprimée le 2026-12-31**, remplacée par une consolidation du PAN | quotidienne | France ; filtrer sur la bbox | Téléchargement par le script (fichier national volumineux : filtrer à la bbox, ne pas livrer au navigateur) ; pas testé par moi | Statique uniquement (le dynamique est un autre flux) |
| **Autopartage Citiz** | 15 stations dans OSM [mesuré] (nom, capacité, `ref` Citiz, 2 `fixme`) | ODbL (via OSM) | | OSM | emprise complète | via OSM | Non |
| **Vélostation / vélo OSM** | Vélostation 650 places (`bicycle_rental`) et 470 places (`bicycle_parking`, horaires `05:00-24:00`) [mesuré] | ODbL (OSM) | | OSM | | | Non |
| **Parcs relais** | OSM : 1 parking `park_ride=yes` (440 places, Cassine) ; BNLS : champ `nb_pr` (vide partout dans les 16) | | | | | | Non |

### 2.2 Verdict par rapport au projet statique

- **Tout se précalcule dans le script** (aucun appel navigateur) : la BNLS/open data ville, l'OSM, l'IRVE (filtré à la bbox) et les arceaux vélo sont des fichiers statiques. Aucune de ces sources n'impose CORS, puisque le téléchargement a lieu au build (note : la ville et la BNLS répondent avec CORS `*` ; non testé sur le reste).
- **Pas de temps réel** : aucun flux ouvert pour Chambéry n'a été trouvé. Le seul « temps réel » possible serait une **simulation** (taux de remplissage fictif selon l'heure) : à étiqueter comme tel dans l'app, sous peine de fausser l'information.
- **Licences** : OSM (ODbL, déjà citée), BNLS et jeu ville (ODbL), IRVE (Etalab 2.0, déjà citée pour l'IGN). Il suffit **d'ajouter dans la section Licences du README et dans `attribution`** : « Parkings : Base nationale des lieux de stationnement / Ville de Chambéry (ODbL) » et, si l'IRVE est retenue, « IRVE : Licence Ouverte 2.0 ». Précaution : l'ODbL impose le partage à l'identique pour une base dérivée ; le fichier fusionné `parkings.json` devrait donc rester publié sous ODbL (c'est déjà le cas de `city.json`, dérivé d'OSM).
- **Fraîcheur** : la BNLS est déclarée obsolète depuis 2024-01 ; le jeu ville est un export 2020. Les capacités sont stables, les **tarifs ne le sont pas** (incohérences internes au fichier ville : Gare 2 h = 3,40 dans la BNLS et 0 dans le jeu ville).

### 2.3 Recoupement BNLS (16 parkings) / OSM [mesuré]

Position BNLS convertie en mètres du diorama ; « IN » = dans l'emprise.

| BNLS | Nom | Places | Position (x, y) | Emprise | Correspondance OSM |
|---|---|---|---|---|---|
| P-001 | Halles (SAGS) | 283 | -158, 105 | IN | n1527204336 (283, position à environ 40 m) |
| P-002 | Curial | 244 | 172, -257 | IN | seulement des entrées (178,-273) |
| P-003 | Hôtel de Ville | 243 | 38, 76 | IN | w1489712516 (243) |
| P-004 | Gare (Effia) | 220 | -118, 708 | out | hors emprise |
| P-005 | Hôpital P3 | 48 | -656, -175 | IN | aucun objet nommé |
| P-006 | Cassine 2 | 241 | 42, 853 | out | hors emprise |
| P-007 | Verdun | 136 | -327, 717 | out | hors emprise |
| P-008 | Manège | 84 | 462, -214 | IN | w26543877 (84) |
| P-009 | Falaise | 495 | 430, -371 | IN | w113058327 (495) |
| P-010 | Ducs (abonnés) | 112 | 299, 300 | IN | n1523885110 (64, privé) : divergence |
| P-011 | Palais de Justice (Indigo) | 400 | -86, 314 | IN | n436252017 + w1489712515 |
| P-012 | Europe | 149 | 183, -261 | IN | w37376434 (154) |
| P-013 | Roissard | 149 | -181, 461 | IN | w290757527 (**pas de capacité**) |
| P-014 | Château | 604 | -373, -114 | IN | n1264602039 + w1489707144 |
| P-015 | Barbot | 58 | 414, -353 | IN | w37716747 (58) |
| P-016 | Hôpital P1 | 259 | -631, -350 | IN | n2836397206 (260) |

Soit **12 parkings BNLS dans l'emprise**, tous retrouvables dans OSM sauf Curial (pas de polygone) et P3. **Ravet, Cassine Gare, Stade-Piscine ne sont pas dans la BNLS** (à saisir à la main depuis la page ville / Q-Park).
Écarts de position BNLS contre OSM : entre 5 et 50 m ; l'OSM est la référence pour le polygone, la BNLS pour la fiche.

---

## 3. Modèle de données et chaîne de production

### 3.1 Principe

Deux couches, comme pour les lieux d'histoire :

1. **Couche géométrique OSM** (automatique, dans `city.json` via `fetch-osm.mjs`) : polygones et points de stationnement, avec les attributs qu'OSM donne (type, accès, `fee`, capacité si présente). Aucune invention : tout est dans OSM.
2. **Couche éditoriale** `src/content/parkings.json` (écrite à la main, **sourcée comme `pois.json`**) : une fiche par parking « nommé » qui mérite d'être raconté (capacité officielle, exploitant, tarifs, horaires, gratuités, hauteur max, anecdote sourcée). Elle référence l'objet OSM (`osm.match`) ; la position vient d'OSM ou de `pos` (Dasco), jamais d'une adresse géocodée.

Rationale : la règle projet « ne jamais modifier `city.json` à la main » et « ne jamais inventer » est respectée ; le tarif (donnée qui périme) reste dans un fichier à part, daté et sourcé, hors du script de données.

### 3.2 Types TypeScript proposés

```ts
// src/types.ts (ajout)
export type ParkingKind =
  | 'underground' | 'multi-storey' | 'surface' | 'street' // voirie : lane / street_side
  | 'park-ride';                                          // parc relais (attribut, pas un kind OSM)

export type ParkingAccess = 'public' | 'subscribers' | 'private' | 'customers' | 'unknown';

/** Géométrie exportée par le script (city.json). Rien d'éditorial. */
export interface ParkingGeom {
  id: string;                    // 'way/37376434'
  kind: ParkingKind;
  access: ParkingAccess;         // OSM access ; 'unknown' si absent
  fee?: boolean;                 // OSM fee
  name?: string;                 // OSM name
  capacity?: number;             // OSM capacity, si présente
  levels?: number;               // OSM building:levels / level, si fiable
  disabled?: number;             // capacity:disabled
  outer?: [number, number][];    // polygone (m, relatif à l'origine) ; absent si point
  pos?: [number, number];        // point (nœud OSM, ou centroïde du polygone)
  areaM2?: number;               // aire du polygone (pour l'estimation)
  est?: number;                  // places estimées (si capacity absente et règle applicable)
  entrances?: [number, number][]; // parking_entrance rattachées (dans le polygone ou à moins de 30 m)
  dupOf?: string;                // id OSM absorbé (nœud/entrée du même parking)
}

/** Fiche éditoriale (src/content/parkings.json). */
export interface ParkingCard {
  id: string;                    // 'chateau'
  name: string;                  // nom d'usage
  osm: { match: string };        // 'way/1489707144' ou 'node/1264602039'
  pos?: [number, number];        // surcharge de Dasco, rare
  bnls?: string;                 // '73065-P-014'
  operator?: string;             // exploitant (source : BNLS/ville)
  capacity?: number;             // capacité officielle (prime sur OSM)
  capacityPmr?: number;
  capacityEv?: number;           // ne pas renseigner sans source
  maxHeightM?: number;
  openingHours?: string;         // texte OSM ou source ville
  freeMinutes?: number;          // ex. 30
  freeWindows?: string;          // ex. 'samedi 14h-19h'
  prices?: { h1?: number; h2?: number; h3?: number; h4?: number; h24?: number; monthlyResident?: number; monthlyNonResident?: number };
  facts: { text: string; source: string }[];  // faits sourcés (comme pois)
  sources: { label: string; url: string; retrieved: string }[]; // retrieved = date ISO du relevé
  validUntil?: string;           // date à laquelle recontrôler les tarifs
}

/** Points d'intérêt secondaires (vélo, autopartage, bornes). */
export interface ParkingPoint {
  id: string;
  kind: 'bicycle' | 'carshare' | 'ev' | 'motorcycle' | 'bike-hub';
  pos: [number, number];
  capacity?: number;
  covered?: boolean;
  name?: string;
  operator?: string;
}
```

### 3.3 Chaîne de production

1. **`scripts/fetch-osm.mjs`** : ajouter l'export, dans `city.json`, de
   - `parkings: ParkingGeom[]` : `amenity=parking` hors voirie, **seulement** ceux dont l'aire > 300 m², ou nommés, ou avec capacité (donc ≈ 60 à 80 objets sur 317). Les poches de moins de 300 m² et les privés sont écartés (ou regroupés en un seul total « places d'habitude » si on veut une densité).
   - `streetParking` : voirie : polygones `lane/street_side` (95) + segments de voies avec `parking:side` (43), avec `side` et `orientation`.
   - `bikeParking: ParkingPoint[]` (136), `carshare` (15), `ev` (1 borne ou plus), `motorcycle` (1).
   - Fusion des doublons (règle 3.4) au moment de l'export.
2. **`src/content/parkings.json`** : 16 fiches maximum au départ (12 BNLS dans l'emprise + Ravet, Cassine Gare, relais), rédigées à la main à partir de la BNLS/ville/page chambery.fr, chaque valeur avec sa source et sa date de relevé.
3. **Script de contrôle** (à ajouter, ex. `scripts/check-parkings.mjs`, lancé par `npm run data`) : vérifie que chaque `osm.match` existe dans `city.json`, que la capacité fiche et la capacité OSM ne divergent pas de plus de 10 % (sinon avertissement listé), que `retrieved` a moins de 12 mois, et qu'aucun `pos` n'est hors de l'emprise.
4. **Règle d'estimation** : appliquée au script (calcul déterministe, `est`), jamais écrite à la main. La fiche ne porte que des valeurs sourcées ; si Dasco veut forcer un nombre, il l'écrit dans `capacity` avec sa source.
5. **Clôture d'itération** : `DECISIONS.md` (seuils et coefficients), README (section Licences et « Structure du code »), `attribution` du script mise à jour.

### 3.4 Règles de rapprochement et de priorité

- **Une fiche = un parking**, clé `osm.match`. Les nœuds/entrées d'un même parking sont rattachés au polygone s'ils sont à moins de 40 m du contour **et** de nom ou capacité identique (cas Château 19 m, Palais 29 m, Hôtel de Ville).
- **Priorité des valeurs** : fiche (source officielle) > OSM > estimation. Une capacité estimée n'écrase jamais une capacité renseignée.
- **BNLS jointe par `ref:FR:BNLS`** quand OSM l'a (3 parkings), sinon par proximité (< 60 m) + nom normalisé (sans accents, sans « parking », « enclos », « Q-Park »).
- **Le polygone vient d'OSM** ; si OSM n'a qu'un point (Halles, Ducs), le diorama aura un point (le rendu décidera de l'emprise par défaut).
- **Accès** : `access=private` OSM ne suffit pas (P1 hôpital contredit par la BNLS) : la fiche prime.

### 3.5 Cas limites

- Parkings souterrains : l'emprise OSM est parfois sous un bâtiment ou une place (Château 10 050 m² : polygone démesuré par rapport aux 604 places) ; l'aire n'a aucun lien avec la capacité.
- Parkings multi-niveaux sans `levels` : pas d'estimation.
- Parkings à cheval sur le bord de l'emprise : le polygone est rogné (`clipPoly` existe déjà) ; l'aire doit être mesurée **avant** rognage pour l'estimation.
- Deux parkings accolés (Cassine Gare + relais ; Jacob/Lyon 12 + privé 25/40 à 22 m) : ne pas fusionner sans fiche.
- Nom « Parking des Ducs » ambigu avec la Maison des Ducs de Savoie : ne pas confondre avec le Château des ducs (le parking « Château » est au pied du château).
- Fiche sans capacité ni OSM ni BNLS : afficher « capacité inconnue », pas de zéro.
- Noms à normaliser : « Q-Park Roissard » (OSM) / « Enclos Roissard » (BNLS) / « Quai Roissard » (adresse).
- Parking de voirie : la gratuité dépend de l'heure (payant 9h-12h/14h-19h hors dimanche et fériés [web]) ; ne pas figer `fee` comme un booléen universel.
- Données privées : ne rien exporter des parkings privés nommés (ex. « Internat Valérieux », « Parking privé ») : pas d'intérêt, risque de personnalisation.

### 3.6 Risques

| Risque | Gravité | Parade |
|---|---|---|
| Tarifs périmés (BNLS 2024-01, jeu ville 2020, incohérences internes) | forte | Afficher « tarif indicatif » avec la date de relevé ; ne mettre que les tarifs d'appel (30 min gratuites, 1 h) ; lien sortant vers l'exploitant ; `validUntil` |
| Capacités contradictoires (Ravet 400/474, Ducs 64/112) | moyenne | Fiche tranche, source citée ; avertissement du script |
| Exploitants changeants (Halles : SAGS ou Q-Park ?) | moyenne | Ne pas mettre la marque en dur dans le texte ; champ `operator` daté |
| Ordre de grandeur présenté comme un fait | forte | `est` toujours affiché « ≈ » et jamais sommé avec des valeurs officielles sans le dire |
| Positions OSM à ±50 m des positions BNLS | faible | OSM = géométrie, `pos` Dasco en dernier recours |
| Obsolescence OSM (modifiée par n'importe qui) | moyenne | `generatedAt` déjà dans `city.json` ; revérifier avant chaque release (`npm run data`) |
| ODbL : fichier dérivé publié sous ODbL | faible | Attribution README + app ; déjà acquis pour OSM |
| IRVE : ancienne base supprimée au 2026-12-31 | moyenne | Si IRVE retenue, viser la consolidation du PAN, pas l'ancienne URL |
| Un seul fournisseur de BNLS, non maintenu | moyenne | Copier les valeurs retenues dans la fiche (pas de dépendance au fichier au runtime) |

### 3.7 Poids ajouté à `city.json` [estimation à partir de mesures]

Sommets mesurés : 605 (voirie), 2 506 (hors voirie, tous), **1 798 (hors voirie non privés)**. Une paire de coordonnées « [-123.4,56.7], » pèse environ 14 octets.

| Bloc | Estimation brute | Estimation gzip (compression 3,5x observée : 1,44 Mo -> 410 Ko) |
|---|---|---|
| `parkings` (60 à 80 objets, polygones filtrés > 300 m² / nommés) | 10 à 15 Ko | 3 à 5 Ko |
| Si tous les polygones non privés (219) | environ 30 Ko | environ 9 Ko |
| `streetParking` (95 polygones + 43 segments) | environ 12 Ko | environ 4 Ko |
| `bikeParking` 136 + `carshare` 15 + `ev` + `motorcycle` | environ 6 Ko | 2 Ko |
| `parkings.json` (16 fiches) | 12 à 20 Ko (hors `city.json`, chargé comme `pois.json`) | |
| **Total** | **environ 30 à 65 Ko** | **environ 10 à 20 Ko** |

Soit +2 à +4,5 % du poids brut de `city.json` (1 442 176 octets), +2 à +4 % en gzip. Négligeable pour le chargement ; **le coût réel sera à la construction et au rendu (nombre d'objets), pas au transfert**.

---

## 4. Annexe A : polygones hors voirie, non privés, sans capacité, > 300 m² (39) [mesuré]

Estimation = `round(aire / 30)` (coefficient d'origine ; avec 28 retenu ci-dessus, multiplier par 1,07). Position en mètres.

| OSM | Nom | Type | Aire | Est. | x, y |
|---|---|---|---|---|---|
| w21911243 | Espace Amélie Zenzen - Parking du Laurier | surface, fee | 2 215 | 74 | 408, 132 |
| w290757527 | Q-Park Roissard | surface, fee | 3 859 | 129 (réel BNLS : 149) | -144, 433 |
| w1368143295 | Courte durée (P4) | fee | 3 276 | 109 | -553, -161 |
| w239630848 | (sans nom) | | 3 129 | 104 | -467, -472 |
| w357267760 | (sans nom) | surface | 2 802 | 93 | -622, -393 |
| w239631239 | (sans nom) | | 2 749 | 92 | -607, -469 |
| w1517050025 | (sans nom) | | 2 383 | 79 | -656, 211 |
| w1490571683 | (sans nom) | | 2 229 | 74 | 467, -382 |
| w107345727 | (sans nom) | | 2 136 | 71 | 155, 362 |
| w1420120910 | (sans nom) | | 2 064 | 69 | 615, 482 |
| w1056372944 | (sans nom) | | 1 663 | 55 | 575, 428 |
| w1318134091 | (CLG) | | 1 420 | 47 | 499, 354 |
| w241477066 | (sans nom) | surface, fee | 1 142 | 38 | 593, 348 |
| w1056372945 | (sans nom) | | 1 066 | 36 | 527, 418 |
| w37422132 | Place Porte Reine | surface, fee | 885 | 30 | 1, -178 |
| w1489707147 | (sans nom) | | 911 | 30 | -216, -206 |
| w302897565 | (sans nom) | surface, destination | 808 | 27 | -461, 203 |
| w1419987130 | (sans nom) | | 788 | 26 | -33, 246 |
| w1489706492 | (sans nom) | | 694 | 23 | -555, 226 |
| 18 autres entre 300 et 600 m² | | | | 10 à 18 | |

À retenir : seuls Laurier, Roissard, Courte durée, Porte Reine (et de Lattre de Tassigny, Square Paul Vidal à 350 m²) ont un nom exploitable. Le reste est anonyme : **à traiter comme du stationnement générique dessiné** (taille estimée, pas de fiche), pas comme des parkings à nommer.

---

## 5. Questions ouvertes pour Dasco (8) et proposition par défaut

1. **Périmètre des véhicules.** Voitures seulement, ou aussi vélos (136 supports OSM, Vélostation), autopartage Citiz (15 stations), bornes de recharge (1 en OSM), motos (1) ?
   *Défaut : voitures d'abord (parkings nommés + voirie) ; vélos et Citiz en US suivante (la donnée OSM est prête) ; IRVE et motos hors scope.*
2. **Quels parkings ont une fiche ?** *Défaut : les 12 parkings BNLS dans l'emprise (+ Ravet et Cassine Gare + le relais), soit 15 fiches ; les autres sont de la matière générique.*
3. **Les capacités estimées sont-elles acceptables dans le jeu ?** *Défaut : oui, toujours avec « ≈ », seulement pour les parkings de surface > 300 m² (règle aire / 28, ±30 %), jamais pour les souterrains.*
4. **Tarifs : on les affiche ?** Ils périment et la source officielle est de 2024 (BNLS) ou 2020 (jeu ville). *Défaut : n'afficher que la gratuité des 30 premières minutes et le tarif de l'heure avec la date du relevé ; sinon un lien vers l'exploitant ; pas de tarif 24 h ni d'abonnement.*
5. **Stationnement en voirie : on le montre ?** Les données de voirie sont partielles (95 polygones, 43 voies tagguées, ≈ 800 places parallèles estimées) et les tarifs viennent d'une page de site, non d'un jeu ouvert. *Défaut : le montrer comme décor (bandes de stationnement), sans nombre de places ni tarif, avec seulement la règle « payant 9h-12h/14h-19h, gratuit dimanche et fériés » citée à la ville.*
6. **Temps réel.** Aucun flux ouvert pour Chambéry n'a été trouvé. *Défaut : pas de temps réel ; si on veut un effet vivant, une occupation simulée affichée comme telle (« simulation »), sans prétendre à l'exactitude.*
7. **Sources à ajouter.** Utilise-t-on la BNLS/jeu ville (ODbL) en plus d'OSM, ce qui demande une ligne dans le README et dans `attribution` ? *Défaut : oui, une copie manuelle des valeurs dans les fiches (pas de téléchargement par le build), ligne de licence « BNLS / Ville de Chambéry (ODbL) ».*
8. **Parkings privés et poches de moins de 300 m².** *Défaut : exclus de l'export (discrétion + poids) ; seuls les polygones publics ou d'accès inconnu > 300 m², les nommés et ceux à capacité sont gardés.*

---

## 6. Résumé

1. OSM contient déjà tout dans `overpass.json` : 412 parkings (95 voirie, 317 hors voirie), 19 entrées, 136 supports vélo, 15 stations Citiz ; **rien n'est exporté dans `city.json`** (seulement 2 bâtiments `building=parking` et les allées de service).
2. Complétude faible : capacité 6 %, nom 7 %, `fee` 10 %, horaires 2 % ; seuls 15 parkings sont documentés.
3. Doublons certains : Château (nœud + polygone, 604), Palais de Justice (nœud + polygone, 400), Hôtel de Ville et Curial (entrées) ; Château et Ducs sont deux parkings distincts à 740 m.
4. Estimation : en surface environ 28 m²/place (±30 %, validé sur Roissard 138 contre 149), pas 12,5 m² ; multi-étages seulement avec niveaux ; souterrain inestimable.
5. La BNLS (16 parkings de Chambéry, ODbL, obsolète depuis 2024-01) et le jeu ville (ODbL, 2020) donnent capacité, PMR, hauteur, tarifs et horaires ; 12 sont dans l'emprise et recoupent OSM.
6. Pas de temps réel ni de données ouvertes de voirie pour Chambéry ; IRVE nationale en Licence Ouverte (non testée) ; arceaux vélo Grand Chambéry en ODbL (shapefile, Lambert 93).
7. Modèle proposé : géométrie OSM exportée par le script + fiches sourcées `src/content/parkings.json` (capacité officielle, tarif d'appel daté, sources), priorité fiche > OSM > estimation.
8. Poids ajouté estimé : 30 à 65 Ko bruts (+2 à +4,5 %), 10 à 20 Ko gzip.
9. Risque principal : tarifs et capacités périmés ou contradictoires (Ravet 400/474, Ducs 64/112) ; à contenir par fiches datées et affichage « indicatif ».
10. 8 questions ouvertes pour Dasco, avec défaut (voitures d'abord, 15 fiches, estimations « ≈ », tarifs minimaux, pas de temps réel).
