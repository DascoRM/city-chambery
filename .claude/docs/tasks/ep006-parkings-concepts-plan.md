# EP006 - Les parkings, présentés en s'amusant : pistes et recommandation

Plan de recherche (chercheur, rien d'implémenté). Date : 03/10/2026. Pour : Dasco.

## 0. Ce que je sais, et ce que je ne sais pas

**Acquis (brief de Dasco, à re-vérifier dans OSM avant de coder)** : 412 parkings OSM dans la zone, dont ~28 nommés. Gros : Château 604 places (souterrain), La Falaise 495 (silo), Cassine Gare 479 (silo), Ravet 400, Palais de Justice 400, Les Halles 283, Hôtel de ville 243, Place du Manège 84 (surface). Types : 71 surface, 53 le long de la rue, 42 en bataille, 9 souterrains, 6 silos. 136 parkings à vélos. Payant/gratuit connu pour 43 seulement. Beaucoup sans capacité ni tarif.

**Constaté dans le dépôt** :
- `public/data/city.json` ne contient AUCUN parking aujourd'hui (clés : buildings, roads, areas [kinds `green` et `plaza` seulement], water, trees, places, anchors, labels...). Tout est à ajouter au pipeline (`scripts/`, `diorama.config.json`), puis `npm run data -- --offline`. Règle projet 3 : jamais à la main.
- Les passants et éléphants marchent déjà sur un réseau de rues partagé (EP005-US001) : le chemin avatar + durée de marche réelle est donc quasi gratuit (vitesse avatar 14 m/s en jeu, mais une vitesse « piéton réel » ~1,3 m/s est un simple réglage).
- Le jeu des éléphants (`mascot.json`) donne le ton et le moteur : sprint, 2e clic, provocations (« Trop lent ! », « Même un escargot de Savoie va plus vite ! »), points, bronze sur la fontaine.
- Le lobby parle en « tu », court, malicieux (« Ramène les 4 éléphants à la fontaine. »).
- Budget rendu : ≤ 31 img/s en mouvement sur iPhone 12 Pro, 750 à 1 000 appels de rendu ; EP005 impose +6 appels max par vue. Donc **tout ce qui est répété (voitures, vélos, places) doit être en instances (1 appel pour N objets) ou en texture peinte au sol, jamais en objets séparés**.
- Je n'ai PAS vu : le nombre exact de parkings qui ont une géométrie de surface exploitable, ni le nombre de places par parking (hors les 8 chiffres du brief), ni les tags `fee`, `access`, `maxheight`, `opening_hours`. À mesurer en premier (US001, voir plus bas).

**Règle de vérité (règle projet 1)** : chaque chiffre affiché porte une étiquette de provenance : **OSM** (donnée lue), **estimé** (calculé par nous, avec la formule visible), **inconnu** (on le dit, et on en fait un jeu). Jamais de « temps réel » : nous n'avons aucun flux d'occupation (site statique, pas de back-end). Ne jamais écrire « il reste X places ».

Deux faits de calcul utilisables, à étiqueter « estimé » : une place de stationnement courante fait environ 2,5 m × 5 m (≈ 12,5 m²) ; un terrain de football de grand format fait environ 105 m × 68 m (≈ 7 140 m²). Ce sont des ordres de grandeur de convention, pas des mesures de Chambéry ; la fiche le dit. Pour tout ce qui est éléphant (poids, taille, surface occupée) : ne PAS inventer, utiliser uniquement le modèle 3D du jeu (4,5 m de haut, `mascot.json`) comme unité fictive, étiquetée « éléphant du diorama ».

---

## 1. Les 8 pistes, de la plus sage à la plus audacieuse

Notation : Fun /5. Effort S (≤ 1 session), M (2-3), L (4+).

### Piste 1 - « Les petites voitures-jouets » (la plus sage)

**Idée.** Chaque parking de surface se remplit de voitures-jouets colorées (low-poly, pastel, comme la ville), rangées en rangs. Le nombre de voitures reflète la capacité, au rapport 1 voiture-jouet pour N places (échelle affichée). Un parking sans capacité reçoit un « ? » flottant et un remplissage vide-damier, pas un chiffre inventé.

**Écran.**
```
        Parking de la Place du Manège   [P]  84 places (OSM)
   +-----------------------------------------+
   |  [] [] [] [] [] []   <- 1 jouet = 4 places |
   |  [] [] [] [] [] .      (échelle : 1 = 4)    |
   +-----------------------------------------+
   Surface, payant : inconnu
```
**Ton (4 messages).**
- « Ici, 84 places. Les petites voitures se serrent, les grandes aussi. »
- « Capacité inconnue : OpenStreetMap ne dit rien, et moi je ne compte pas à l'œil. »
- « Une voiture-jouet pour quatre places : la maquette a ses limites, pas la patience des conducteurs. »
- « Parking de surface, gratuit ? Info absente. Vérifie sur place. »

**Données.** Contour du parking (OSM polygone) : disponible en général ; capacité : partielle ; tarif : partielle. Les parkings « le long de la rue » sont des segments, pas des surfaces : on les représente par une rangée de jouets le long de la voie.
**Rendu.** 1 `InstancedMesh` (une voiture simple ≈ 40 triangles, couleur par instance) : +1 appel de rendu, ~500 à 2 000 instances = 20 à 80 k triangles : à plafonner (par ex. distance au point regardé, comme les passants rayon 250 m). Mobile : OK si plafonné. 3D.
**Risque.** Gadget (joli mais sans sens). Mensonge si on laisse croire que le nombre de jouets = les voitures réellement garées : ce sont des places, pas une occupation. Mentionner « places, pas voitures présentes ».
**Effort** : M (données + placement en rangs dans un polygone irrégulier = la vraie difficulté). **Fun** : 3/5.

### Piste 2 - « Vue stationnement » : la ville se colore

**Idée.** Un bouton (comme les couches de la légende) qui passe la ville en mode carte de stationnement : bâtiments atténués, parkings en couleur vive selon un critère au choix (type : souterrain / silo / surface / rue ; payant-gratuit ; taille). Les « trous gris » (inconnu) sont montrés en gris hachuré : on voit d'un coup d'œil ce que OSM ne sait pas.

**Écran.**
```
[Vue stationnement]  Couleur par : (o) Type  ( ) Payant/gratuit  ( ) Taille
 Légende : [bleu] souterrain  [violet] silo  [orange] surface  [vert] rue
           [gris hachuré] information inconnue
 "43 parkings sur 412 ont un tarif connu. Les 369 autres gardent leur secret."
```
**Ton.**
- « 412 parkings. Quarante-trois connaissent leur tarif. Les autres jouent à cache-cache. »
- « Le centre est un gruyère : regarde tous ces trous sous tes pieds. »
- « Orange = surface, violet = silo, bleu = souterrain. Ne cherche pas le rose, c'est ton avatar. »
- « Payant, gratuit, inconnu : trois couleurs, une seule vraie réponse sur place. »

**Données.** Type et polygones : OK (OSM `parking=surface/multi-storey/underground/street_side/lane`). Payant : 43 sur 412. Rien d'invention.
**Rendu.** Zéro objet nouveau : peinture au sol comme les parcs et places (`areas`), + un uniforme « mode » qui atténue les façades (déjà prévu pour le mode balade). +1 à 2 appels. Mobile : très bon. 2D-sur-3D.
**Risque.** Peu de risque de charte ; risque d'austérité (« carte administrative ») si on n'ajoute rien d'amusant. À marier avec une autre piste.
**Effort** : S-M. **Fun** : 2/5 seule, 4/5 comme couche d'une autre piste.

### Piste 3 - La maquette ouverte : souterrains et silos en coupe

**Idée.** Les 9 souterrains et 6 silos sont invisibles dans la maquette : on les rend visibles. Un clic « Ouvrir » sur le Parking du Château fait glisser un panneau du socle (une « tranche de gâteau » : le diorama a déjà ses strates de terre) et révèle les niveaux en coupe : un plateau par niveau, petites voitures-jouets, rampes. Silo La Falaise : façade qui s'ouvre comme une maison de poupée.

**Écran.**
```
   ~~~ château (en haut) ~~~
   ===== sol de la place =====
   | niveau -1 [] [] [] [] [] [] |
   | niveau -2 [] [] [] []       |   604 places (OSM)  | niveaux : inconnu
   | niveau -3 ...               |
   ← rampe d'accès : position supposée ←
   [ Refermer la maquette ]
```
**Ton.**
- « Sous le château, pas des oubliettes : un garage. Enfin, on croit. Je vérifie. »
- « Ouvre la maquette : 604 places cachées sous tes pieds. »
- « Combien de niveaux ? OpenStreetMap hausse les épaules. Voici une coupe « de principe ». »
- « Chut, c'est un secret de maquettiste : la rampe d'accès est approximative. »

**Données.** Nombre de niveaux (`building:levels`, `level`) : souvent absent ; position des rampes : absente ; profondeur : absente. Il faut une coupe « de principe » **étiquetée « schéma, pas un plan »**. Aucune affirmation sur ce qu'il y a réellement sous le château.
**Rendu.** Une mini-scène chargée à la demande (3 à 5 plateaux + 1 `InstancedMesh` de jouets) : 5 à 8 appels pendant l'ouverture seulement, pas dans la vue normale. Découpage du sol (clipping plane) = nouveau mécanisme à écrire dans le shader du terrain : risque technique réel. Mobile : tenable si la scène principale est figée pendant l'ouverture.
**Risque.** Mensonge élevé (invention d'un plan intérieur) : il faut un habillage « schéma » franc. Fun fort, mais effort aussi. Hors charte ? Non (maquette ouverte = esprit diorama).
**Effort** : L. **Fun** : 5/5.

### Piste 4 - L'éléphant cherche une place (mascotte)

**Idée.** Les éléphants du jeu ont la bougeotte : l'un d'eux « cherche une place » et tourne en rond autour d'un parking, bulle de BD à l'appui. Si on clique, il se gare (dans un silo : il dépasse du toit, c'est drôle) et ouvre la fiche du parking. Un éléphant garé occupe visuellement un nombre fictif de places, à valeur comique : « Un éléphant = 4,5 m, soit environ 1 place de long si on dit que c'en est une » : formule affichée comme blague, pas comme chiffre.

**Écran.**
```
 (bulle) "Complet ? Non : « capacité inconnue ». Je tente !"
        [éléphant]  P  Cassine Gare - silo - 479 places (OSM)
 [Le garer ici (+10 pts)]
```
**Ton.**
- « Je tourne depuis vingt minutes. Y a-t-il un parking quelque part dans cette ville ? »
- « Ce silo de 479 places m'a l'air haut pour une trompe. »
- « Je me gare en bataille, c'est plus malicieux. »
- « Tu connais une place pour mon camion ? Euh, mon éléphant ? »

**Données.** Parkings choisis parmi les nommés avec fiche. Aucun nouveau besoin au-delà de la liste des parkings. Ne rien dire des trajets réels d'éléphants.
**Rendu.** Réutilise le moteur (un éléphant de plus, pas de nouvel asset : règle projet 5 déjà couverte, CC BY 3.0). Pas d'appel de plus par rapport au jeu actuel.
**Risque.** Dilution du jeu des éléphants (qui vient d'être simplifié à l'itération 65 pour trop de clics) : à n'activer que comme **un événement rare**, pas une corvée. Gadget si ça ne mène pas aux données.
**Effort** : M. **Fun** : 4/5.

### Piste 5 - « Le créneau » : mini-jeu de stationnement avec l'avatar

**Idée.** L'avatar du mode balade devient une petite voiture-jouet (ou pousse un caddie ? plutôt une voiture) : on la dirige par clic vers une place libre d'un parking de surface avec un défi : se garer en créneau/en bataille sans toucher les voisines, chrono, étoiles. Parkings en bataille (42) et en rue (53) servent de terrains d'entraînement (le type de stationnement donne la difficulté : créneau, bataille, épi).

**Écran.**
```
 NIVEAU 3 : créneau Place du Manège      Temps 00:24     ★★☆
 +--------------------------------------------+
 |  [][][]  _____  [][][]                     |
 |          place cible                         |
 |        [voiture]  ---> glisse pour tourner   |
 +--------------------------------------------+
 "Raté : tu as embrassé une voiture-jouet. Elle te pardonne. Peut-être."
```
**Ton.**
- « Créneau parfait ! Un moniteur de Chambéry t'embaucherait. »
- « Tu as éraflé un pare-chocs en carton-pâte. Il survivra. »
- « 30 secondes pour te garer : en vrai ça prend plus de temps. »
- « Une place sous les arbres… les pigeons ont déjà décidé. »

**Données.** Géométrie des places : à peine disponible (OSM ne dessine presque jamais les places une à une, `parking_space` rare) → il faut **générer** des places en rangs dans le polygone. Ce sont des places « de jeu », à dire (« cases de jeu, pas les vraies places »). Pas de tarif nécessaire.
**Rendu.** Avatar-voiture + 10 à 30 voitures-jouets en instances ; collision 2D simple. Mobile : commandes tactiles de conduite = **gros risque d'ergonomie** (le brief EP005 vise « clic pour aller », pas de la conduite). Le mouvement actuel de l'avatar est un clic-vers-point suivant les rues, pas un volant.
**Risque.** Hors charte (la maquette contemplative devient un jeu d'arcade) ; coût de conception du « feeling » ; sur ≤ 31 img/s la conduite fine sera moche. Mensonge : faible.
**Effort** : L. **Fun** : 4/5 (si bien fait), mais risqué.

### Piste 6 - La chasse aux parkings cachés (fiches anecdotes)

**Idée.** Dans l'esprit des ✦ d'histoire : des **P** qui n'apparaissent pas tous, à découvrir un par un en marchant (avatar) ou en cliquant. Chaque P découvert ouvre une fiche : nom, type, capacité (ou « inconnue »), et UNE anecdote **sourcée** quand elle existe (par exemple l'histoire d'un parking creusé près du château : à ne pas écrire sans source). Les parkings « mystère » gardent leur nom caché tant que non découverts (mécanique déjà existante pour les ✦). Carnet de collection « Mes parkings » dans le journal.

**Écran.**
```
 [P] Parking du Château          ✔ découvert     souterrain, 604 places (OSM)
 Anecdote : [à rédiger, source obligatoire]
 [P] ???                         à découvrir : un silo près de la gare
 Collection : 7 / 28 parkings nommés  |  Spécialité : « sous-sol »
```
**Ton.**
- « Un P de plus au carnet ! Tu collectionnes le béton, bravo. »
- « Mystère : un silo rôde près de la gare. Indice : il est haut. »
- « Les gens cherchent des places, toi tu cherches des parkings. C'est plus rare. »
- « Fiche en cours de rédaction : l'histoire de celui-ci n'est pas encore sourcée. »

**Données.** Noms : 28 sur 412 (le reste = « parking sans nom », à ne pas inventer). Anecdotes : **aucune n'existe dans le dépôt** ; il faudra des sources (archives municipales, presse locale, délibérations). Si la source manque, la fiche dit « histoire à écrire » ou n'a pas d'anecdote. Je n'ai pas vérifié si le parking du Château a une histoire notable ; je ne la suppose pas.
**Rendu.** Réutilise les ✦ (gemmes) : un nouveau type de gemme, 1 `InstancedMesh` ou le système existant ; pas de coût de rendu significatif. Mobile : OK.
**Risque.** Le plus gros risque est éditorial (rédiger et sourcer 10 à 28 anecdotes). Dilution avec les 8 lieux d'histoire (un parking n'est pas un lieu d'histoire).
**Effort** : M (code) + travail de contenu à part. **Fun** : 3/5, 4/5 si les anecdotes sont bonnes.

### Piste 7 - Chiffres rigolos, quiz et classement

**Idée.** Un panneau « Parkings en chiffres » : total des places connues, converti en jeux d'équivalences comiques (étiquetées estimées), classement des plus gros, quiz « devine » (« Quel parking est le plus grand ? »). Les chiffres sont des **sommes de données OSM déclarées**, affichées avec « sur N parkings qui déclarent leur capacité ».

**Écran.**
```
  PARKINGS EN CHIFFRES  (sur les 23 qui déclarent leur capacité)
  Total déclaré : 2 988 places (OSM)  [fournit : 8 plus gros]
  Soit environ 37 350 m² de places  (estimé : 12,5 m² / place)
  ≈ 5 terrains de foot (estimé : ~7 140 m² l'un)   <-- à recalculer au code
  QUIZ : Quel parking est le plus grand ?   (A) Falaise  (B) Château  (C) Manège
```
(Les chiffres ci-dessus sont des exemples de mise en page, calculés sur les 8 capacités du brief ; à recalculer sur les données réelles. 2 988 = 604+495+479+400+400+283+243+84.)

**Ton.**
- « 5 000 places, ça fait environ X terrains de foot. Les footballeurs ne sont pas ravis. »
- « Le plus gros parking de la zone ? Devine ! Indice : il est sous un château. »
- « Chiffre estimé, hein : 12,5 m² la place. Je ne suis pas géomètre. »
- « Seuls N parkings sur 412 déclarent leur capacité. Les autres sont timides. »

**Données.** Capacité : partielle (à mesurer). Toutes les conversions sont des calculs affichés avec leur formule. Aucune équivalence « éléphant » chiffrée (pas de donnée ; sinon unité fictive du diorama).
**Rendu.** 100 % interface 2D (panneau + quiz), 0 appel de rendu. Mobile : excellent.
**Risque.** Gadget (c'est de l'info-gadget) ; chiffres trompeurs si le total sous-estime (beaucoup de parkings sans capacité) : toujours écrire « au moins ». Hors charte : non, ton léger OK.
**Effort** : S. **Fun** : 3/5.

### Piste 8 - « Où me garer pour aller à... ? » (itinéraire et temps de marche réel)

**Idée.** L'utilisateur choisit un lieu (une ✦ d'histoire, un bar, la fontaine) ; la maquette indique les parkings les plus proches **par le chemin de marche réel** (réseau de rues déjà calculé pour l'avatar), avec leur temps à pied. L'avatar fait la marche en direct (accéléré) pour comparer : « Château : 4 min à pied, Falaise : 7 min ». On peut « jouer » le trajet.

**Écran.**
```
 Je vais à : [Fontaine des Éléphants v]
 1. P Parking du Château     souterrain  604 pl.   ~ 6 min à pied (estimé, 1,3 m/s)
 2. P Les Halles             ?            283 pl.   ~ 4 min
 3. P Place du Manège        surface      84 pl.    ~ 9 min
 [Voir le trajet avec mon avatar]   (ligne rose au sol)
 "Distance par les rues : mesurée sur la carte. Durée : estimée à 1,3 m/s."
```
**Ton.**
- « 6 minutes à pied, sans traverser le château. Enfin, pas par l'intérieur. »
- « Gratuit ? Info absente : appelle un ami, ou lis le panneau. »
- « Ma marche à moi est 10 fois plus rapide que la vraie. Compte sur la vraie, 6 min. »
- « Tu préfères marcher moins ou payer moins ? Je n'ai que la marche. »

**Données.** Distance : calculée sur le réseau de rues (donnée à nous, fiable) ; durée : estimée (vitesse de marche standard) ; tarif/occupation/horaires : absents sauf 43 → ne pas classer par « prix » ni « disponibilité ». Pas d'entrée/sortie réelle des parkings : on utilise le centre du polygone, **à dire** (« à partir du centre du parking »).
**Rendu.** Une ligne au sol (1 appel) + avatar existant ; calcul de chemin déjà fait (EP005). Mobile : bon.
**Risque.** Risque de promesse « utilitaire » (service de guidage) alors que le site n'a pas de temps réel : à cadrer en « jeu de comparaison », pas en GPS. Fun : moyen mais très cohérent avec l'avatar.
**Effort** : M. **Fun** : 3/5.

### Bonus (non retenu comme piste) : vélos et motos

136 parkings à vélos : une rangée de petits arceaux/vélos-jouets (instances), mise en avant du ratio « places vélo vs places voiture » (comparaison étiquetée « de ce qui est déclaré »). Données de capacité vélo : probablement rares. À greffer sur n'importe quelle piste comme couche masquable (comme les catégories de la légende), pas comme piste autonome. Effort S une fois les voitures-jouets en place. Fun 2/5 seul. Motos : pas vérifié dans les données ; ne pas promettre.

---

## 2. Comparatif

| # | Piste | Effort | Fun | Données critiques | Rendu mobile | Risque principal |
|---|-------|--------|-----|-------------------|--------------|------------------|
| 1 | Voitures-jouets | M | 3 | polygones, capacité (partielle) | OK si instancié et plafonné | gadget, confondre places et occupation |
| 2 | Vue stationnement | S-M | 2 (4 en couche) | types, payant (43/412) | très bon | austère seule |
| 3 | Maquette ouverte | L | 5 | niveaux absents | tendu | inventer un plan intérieur |
| 4 | Éléphant cherche une place | M | 4 | liste de parkings | très bon | dilue le jeu, corvée |
| 5 | Créneau avec l'avatar | L | 4 | places individuelles absentes | mauvais (conduite tactile) | hors charte, ergonomie |
| 6 | Chasse + fiches anecdotes | M + contenu | 3-4 | anecdotes inexistantes | très bon | contenu à sourcer |
| 7 | Chiffres, quiz | S | 3 | capacités (partielles) | excellent | gadget, sous-estimation |
| 8 | Où me garer, temps de marche | M | 3 | réseau de rues (déjà là) | bon | promesse « GPS » |

---

## 3. Recommandation

**Socle minimal (indispensable, peu risqué) : « Vue stationnement » (piste 2) + fiche parking sourcée + données au pipeline.**
Pourquoi : c'est la seule base dont toutes les autres pistes dépendent (les parkings n'existent pas dans `city.json`), elle ne coûte presque pas de rendu, elle est honnête par construction (le gris « inconnu » est visible), et elle ouvre le ton : la fiche parle comme le lobby, pas comme un annuaire. Contenu du socle : couche masquable « Parkings » dans la légende, un P posé sur chaque parking nommé, fiche (type, capacité ou « inconnue », payant/gratuit/inconnu, source OSM), peinture au sol colorée par type, compteur « N parkings, M avec capacité ».

**Option A (la plus rentable) : voitures-jouets (piste 1), plafonnées, puis « Parkings en chiffres » (piste 7).**
La maquette y gagne tout de suite en vie (voitures qui peuplent les parkings) et les chiffres rigolos donnent la touche malicieuse pour pas cher. Pas de nouvel asset, une instance de rendu.

**Option B (la plus fidèle à l'epic balade) : « Où me garer pour aller à... ? » (piste 8)**, avec l'avatar qui fait le trajet et le temps à pied estimé. Elle utilise le réseau de EP005, donc elle valorise un travail déjà fait, et elle transforme l'information en une action de jeu.

**Pas maintenant** : maquette ouverte (piste 3, la plus belle mais L et risque d'invention) ; je la garde comme « pièce maîtresse » d'une itération suivante, pour le seul Parking du Château, une fois le socle validé et à condition d'une coupe étiquetée « schéma ». Le créneau (5) est hors charte et mal adapté au tactile ; je le déconseille. L'éléphant (4) et la chasse (6) sont de bons compléments légers mais dépendent de la validation du socle et de contenus à écrire.

---

## 4. Découpage proposé en 6 user stories

| ID | Titre | Valeur | Dépendances |
|----|-------|--------|-------------|
| US001 | Les parkings dans les données | Extraire les parkings OSM (type, nom, capacité, `fee`, `access`, `maxheight`, polygone/segment) dans `city.json` via `scripts/` et `diorama.config.json`, avec un rapport chiffré (combien ont une capacité, un tarif, un contour). Sans cela, aucune piste n'est chiffrable. | — |
| US002 | Vue stationnement : couche, couleurs, légende | Voir d'un coup d'œil où sont les parkings, leur type, ce qui est inconnu (hachures grises) ; couche masquable ; peinture au sol sans objet de plus. | US001 |
| US003 | Fiche parking sourcée, au ton du jeu | Un P cliquable avec fiche : type, capacité/tarif ou « inconnu », étiquettes OSM / estimé / inconnu ; textes dans un `parkings.json` éditorial (ton, messages). | US001, US002 |
| US004 | Voitures-jouets (et vélos) en instances | Peupler les parkings : 1 jouet pour N places (échelle affichée), plafonné à distance, parkings sans capacité en damier vide ; vélos si capacité disponible. Budget : +1 appel de rendu, mesure iPhone. | US001, US002 |
| US005 | Parkings en chiffres et quiz | Panneau d'équivalences comiques (formules affichées, « estimé »), classement, 3 à 5 questions de quiz. 0 appel de rendu. | US001, US003 |
| US006 | « Où me garer pour aller à... ? » avec l'avatar | Choisir un lieu, classer les parkings par distance à pied sur le réseau, afficher le temps estimé, et faire marcher l'avatar. | US001, US003, EP005 (US001, US004) |

À garder en backlog d'epic : éléphant en quête de place, chasse aux parkings cachés et anecdotes sourcées, maquette ouverte du Parking du Château.

Doc à mettre à jour pour chaque US : FEATURES, CHANGELOG, DECISIONS ; README (section Licences) seulement si un asset tiers entre (non prévu). Branche d'epic suggérée : `feat/EP006-parkings`, selon la règle « branche d'epic » de la mémoire du projet. La branche actuelle `docs/EP006-parkings` ne porte que la doc.

---

## 5. Six questions ouvertes pour Dasco (avec ma proposition par défaut)

1. **Que veut-on vraiment que l'utilisateur ressente : sourire, ou s'informer ?** Défaut : sourire d'abord, s'informer en passant (ton malicieux, données visibles et honnêtes).
2. **Les parkings sans nom (≈ 384) : les montre-t-on ?** Défaut : oui, mais discrets (peinture au sol), un P et une fiche seulement pour les ~28 nommés + ceux qui déclarent une capacité ≥ 50.
3. **Que fait-on de l'inconnu (capacité, tarif) ?** Défaut : on l'assume en jeu : « capacité inconnue » + un compteur « N parkings gardent leur secret », jamais une valeur estimée sans étiquette.
4. **Les parkings à vélos et les motos : dans l'epic ?** Défaut : vélos oui en couche masquable après les voitures-jouets (US004) ; motos non, tant qu'on n'a pas vérifié la donnée.
5. **Le Parking du Château mérite-t-il la maquette ouverte (piste 3) ?** Défaut : pas dans cette epic ; on le reprend si le socle plaît, et uniquement avec une coupe « schéma » étiquetée comme telle ; et seulement si on trouve une source pour l'anecdote.
6. **Faut-il lier les parkings aux éléphants et à l'avatar ?** Défaut : l'avatar oui (US006, c'est cohérent avec EP005), les éléphants pas dans cette epic (le jeu vient d'être simplifié ; on évite de le charger).

(Questions de bord à trancher au passage : le budget mobile pour les voitures-jouets, fixé par défaut à +1 appel de rendu et un plafond d'instances à mesurer sur l'iPhone 12 Pro ; l'unité de la fiche - places « OSM » vs. places « jeu ».)

---

## 6. Ce qui n'a pas été vérifié

- Les chiffres du brief (412, 28 nommés, 136 vélos, 43 tarifs) : repris tels quels, non recomptés. `city.json` ne contient pas encore les parkings.
- La qualité des polygones de parkings (fermés ? autour de bâtiments ?), la présence de `capacity`, `fee`, `maxheight`, `opening_hours` : à mesurer dans US001.
- Aucun test de performance : tous les budgets de rendu sont des estimations de conception, à mesurer avec `?debug` sur Mac et iPhone 12 Pro (le navigateur de test fait un rendu logiciel, ses temps ne sont pas représentatifs).
- Aucune anecdote d'histoire sur un parking n'a été recherchée ni écrite ; rien n'est avancé sur le Parking du Château.
