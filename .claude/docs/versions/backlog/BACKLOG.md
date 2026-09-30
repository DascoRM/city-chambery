# Backlog

Priorités : **P0** bugs à corriger d'abord · **P1** prochaine itération · **P2** bientôt · **P3** un jour

Tickets issus de l'audit du 30/09 : identifiants `BUG-`, `EN-` (enabler), `TI-` (technical improvement).
Détail et `fichier:ligne` dans `.claude/docs/tasks/audit-2026-09-30-{rendu,code,donnees}-plan.md`.

## P0 — Bugs (audit du 30/09)
- ✅ *itération 38* **BUG-01 — Éclairage de nuit des monuments faux.** `uplight()`, `glowAtNight()` (`src/scene/models/lighting.ts`) et `uplight()` / `glowFlat()` (`src/scene/models/elephants.ts`) écrivent intensité, hauteur de référence et altitude du sol en dur dans le texte du shader. Three.js identifie le programme par le texte de `onBeforeCompile` (où ces valeurs n'apparaissent pas) : tous les matériaux d'une même fonction partagent le premier programme compilé et ses valeurs (toits 0,35 éclairés comme les façades 0,9, dégradé calé sur l'altitude d'un seul monument). Correction : passer ces valeurs en uniformes (comme `uNight`), un seul programme partagé à juste titre. Vérifier de nuit (23 h) : toits moins éclairés que les façades, fonte ≠ bronze sur la fontaine — *petit*
- ✅ *itération 38* **BUG-02 — Lot de petites corrections** (aucun changement visuel attendu) — *petit* :
  - fiche d'un lieu et bulle d'éléphant : le navigateur recalcule la mise en page à chaque image (`getBoundingClientRect` / `offsetWidth` relus après écriture de style : `main.ts`, `ui.ts`, `hunt.ts`) → rectangle du canevas et taille de la fiche mis en mémoire, style réécrit seulement s'il change ;
  - épingle active : matrice des 169 instances renvoyée à la carte graphique à chaque image, même après le rebond (`markers.ts`) ;
  - particules : couleurs renvoyées à chaque image alors qu'elles ne changent qu'à l'émission (`particles.ts`) ;
  - objets créés à chaque image : `heading()` (`stage.ts`), tableau des passes (`tiltshift.ts`), `Vector2` des particules, `Vector3` du vol des éléphants (`mascot.ts`), cibles du survol recréées à chaque mouvement de souris (`main.ts`), ~15 couleurs par image pendant la lecture ▶ (`daynight.ts`) ;
  - mini-jeu : nombre d'éléphants écrit en dur `[0,1,2,3]` au lieu de `game.count` ; s'ils ne correspondent pas, le jeu se désactive sans message (`main.ts`) ;
  - code mort : `weekday` (`time/chambery.ts`), callback `onComplete` vide (`main.ts`, `hunt.ts`)
- *Non retenu :* ombre des statues de la fontaine figée quand un éléphant revient (signalé par l'audit, non constaté par Dasco)

## P1 — Enablers et technical improvements (audit du 30/09)
Préparent « la ville vit » (P2 ci-dessous). Ordre conseillé : EN-01 → EN-02 → TI-01 → TI-02.
- ✅ *itération 39* **EN-01 — Module commun géométrie et voies** (prérequis des passants) — *moyen* :
  - `src/scene/geo.ts` : un seul « point dans un polygone » (4 copies aujourd'hui : `markers.ts`, `nature.ts`, et côté scripts `fetch-osm.mjs`, `bdtopo.mjs`), `distToSegment`, et `screenRay()` pour le calcul « clic → rayon » (réécrit 4 fois : `main.ts` ×2, `hunt.ts`, `placement.ts`) ;
  - `city.ts` et `mascot.ts` n'importent plus `pointInRing` depuis `nature.ts` ;
  - `src/scene/roads.ts` : liste des voies piétonnes `FOOT` et hauteurs des rubans, aujourd'hui dupliquées entre `city.ts` et `mascot.ts` ;
  - puis sortir le réseau de voies (graphe, obstacles, distance aux murs) de `mascot.ts` vers `src/scene/walkways.ts`, partagé par éléphants et passants ;
  - petits copier-coller : `mesh()` recopié dans les 5 monuments, type `(x, y) => number` réécrit 7 fois → `types.ts`
  - Vérifier : éléphants toujours sur les rues (`?debug`), clic sur gemme et bar, double toucher, outil de placement
- ✅ *itération 40* **EN-02 — Reprise de `main.ts` (modularité)** — remplace le ticket « Découper `src/main.ts` » — *moyen* :
  - boucle de rendu : tableau de modules `{ update(dt, t) }` au lieu des 20 appels écrits à la main ; ajouter un module (passants) = une ligne ; chaque module peut dire s'il bouge (base de TI-02) — *ce dernier point reporté dans TI-02* ;
  - `src/interaction.ts` : sélection souris / doigt, survol, double toucher ;
  - `src/game/setup.ts` : mini-jeu, places sur la fontaine, particules, réglages passés d'un bloc
- ✅ *itération 41* **TI-01 — Mode dev / debug propre** — *petit* :
  - `?debug` lu une seule fois (constante `DEBUG`) ;
  - outil de debug des éléphants (`herd-debug`) chargé à la demande (`import()`), comme l'outil de placement, donc absent du code de production ;
  - `window.diorama` exposé seulement en dev ou avec `?debug`
- ✅ *itération 42* **TI-02 — 30 images/s au repos, pleine vitesse pendant les mouvements** — remplace le ticket « Moins d'images quand rien ne bouge » — *moyen* :
  - les éléphants marchent en permanence : on ne peut pas arrêter le rendu, on limite la cadence ;
  - pleine vitesse pendant : caméra qui bouge (et 0,5 s après), vol ou rotation, lecture ▶, particules, bulle ou statue qui apparaît, épingle qui rebondit, survol ;
  - chaque module de la boucle (`Ticker`, itération 40) dit s'il bouge (reporté d'EN-02) ;
  - `src/scene/quality.ts` : ne mesurer les images/s que pendant les mouvements, sinon il prend les 30 images/s pour de la lenteur et baisse la netteté ;
  - condition : aucune perte de qualité visible (netteté stable au repos, éléphants et gemmes fluides à l'œil) — à vérifier avec `?debug`
- ⬜ **TI-03 — three.js dans un fichier JS séparé** : aujourd'hui un seul fichier de 789 Ko (216 Ko gzip) ; une mise à jour de l'appli ferait retélécharger ≈ 30 Ko au lieu de 216 (estimé). Réglage de découpage dans `vite.config.ts` — *petit*
- ⬜ **EN-03 — Analyse : compression meshopt des modèles** : mesuré en test, 45 `.glb` de 442 → 197 Ko gzip (−55 %). À analyser avant de décider : la quantification ajoute une transformation au nœud (ignorée par `nature.ts`, qui ne garde que la géométrie) et le shader de marche de l'éléphant lit les positions des sommets ; décodeur à brancher sur les 3 chargeurs glTF. Livrable : essai sur un arbre et l'éléphant, comparaison visuelle, go / no go — *petit*

## P1 — Fiabiliser le POC
- ⬜ Reprendre la position des 8 lieux (champ `pos` ou `osm.match` dans `src/content/pois.json`) — *Dasco*
- ⬜ Relire les fiches (Trivelli/Trivelly, « plus vaste ensemble de trompe-l'œil d'Europe » sourcé uniquement Wikipédia)
- ⬜ Pack nature : buissons, fleurs, rochers moussus, nénuphars dans les parcs
- ⬜ Épingles des lieux : icône par catégorie sur l'épingle (verre, tasse, couverts), après la v1 « pointeur de couleur »
- ⬜ Fiche des lieux : horaires OSM plus lisibles (regroupés par jour, « ouvert maintenant »)


## P2 — La ville vit (suite des enablers P1)
Gros chantier : à passer en epic (`specs/epics/`) une fois EN-01 et EN-02 faits.
- ⬜ **Petites animations le jour et la nuit** (la ville vit) — évolution du code existant, pas de refonte. Estimation : socle ≈ 1 session, éléphant ≈ 1 session, passants simples ≈ ½ à 1 session, personnages animés + 1 à 2 sessions, variantes de nuit ≈ ½ session :
  - 🟡 socle commun : réseau de chemins tiré des voies OSM et ombre « pastille » au sol faits avec la mascotte (itération 33, `src/scene/mascot.ts`) ; extraction en module partagé = **EN-01** ; point d'ajout dans la boucle = **EN-02** ; comportement jour / nuit à faire ;
  - ✅ l'éléphant qui se promène dans Chambéry (itération 33 : modèle de jeremy sur Poly Pizza, CC BY 3.0, marche animée dans le shader) ;
  - des passants : d'abord des silhouettes simples en grand nombre, puis éventuellement des personnages animés (pack Quaternius en CC0, à convertir de FBX en glb) près de la caméra seulement ;
  - la nuit : moins de monde dans les rues, du monde devant les bars ouverts ;
  - cadence : les passants comptent comme « ça bouge » ou non selon **TI-02**

## P1 — Fluidité (audit du 29/09, détail dans [PERF-AUDIT.md](../../architecture/PERF-AUDIT.md))
Avant l'itération 25 : ≈ 4 800 appels de rendu et ≈ 4,7 M triangles par image. Après (ombres à la demande, arbres simplifiés) : ≈ 2 400 appels et ≈ 1,5 M triangles par image la plupart du temps.
- ✅ **Mesurer** : compteur avec `?debug` dans l'adresse (images/s, pire image, appels de rendu, triangles, densité, taille du rendu) — itération 29
- ⏸ **Monuments : fusionner la géométrie par matériau** — *en attente, Dasco garde les monuments tels quels pour l'instant ; à reprendre avec le chantier bâtiments (confirmé à l'audit du 30/09)* (Carré Curial 1 683 objets, château 561, fontaine 54, cathédrale 42 → ~30 appels) — gain le plus fort, aucun changement visuel — *petit*
- ⬜ **Arbres modélisés** : découper les instances par quartier pour ne pas dessiner les arbres hors écran (simplification à −50 % faite, itération 25) — *moyen*
- 🟡 **Effet maquette moins gourmand** — fait à l'itération 29 : flou en demi-résolution sans anticrénelage, une seule passe finale, anticrénelage ×2 sur écran haute densité, densité plafonnée à 1,5 puis adaptée aux images/s. Reste à trancher pour mobile : suffisant, ou effet coupé sur petit écran ? — à mesurer avec `?debug`
- ➡ **Moins d'images quand rien ne bouge** → devenu **TI-02** (30 images/s au repos)
- ⬜ Chargement : ~~vérifier gzip~~ (gzip actif dans `deploy/nginx.conf`, vérifié à l'audit du 30/09) ; brotli (−23 % sur `city.json`, absent de l'image nginx alpine) ; regrouper les fichiers d'arbres (45 `.glb` aujourd'hui) ; `city.json` en binaire (entiers + deltas : −15 % mesuré) — *P3*
- ⏸ Mode hors-ligne : le service worker retélécharge `city.json` et les `.glb` à la première visite au lieu de reprendre le cache HTTP (≈ 0,55 Mo gzip en double, estimé) — *pas grave pour l'instant (Dasco, 30/09)*

## Architecture — à trancher avant d'ouvrir le diorama aux amis
- ❓ **Back-end : pas nécessaire aujourd'hui.** Il le devient seulement pour : progression partagée entre appareils ou entre amis (comptes, classement), ajout de lieux par d'autres que Dasco sans redéployer, données qui changent souvent (événements, horaires). Pistes légères si besoin : PocketBase ou Supabase auto-hébergé sur le Pi (Coolify) ; pour les événements des bars, consommer l'API d'ACME plutôt que créer un back-end dédié
- ✅ **Cache HTTP** : fait dans `deploy/nginx.conf` (itération 28) — `assets/` en cache 1 an, `index.html` / `city.json` / `.glb` revalidés (ETag, 304), gzip. Brotli : pas dans l'image nginx standard, à voir si besoin
- ✅ **Données versionnées** (itération 30) : empreinte des données calculée au build (`city.json?v=…`, `.glb?v=…`) ; nginx garde ces adresses en cache 1 an ; une modification des données change l'adresse
- ✅ **Mode hors-ligne / rechargement instantané** (itération 30) : service worker (vite-plugin-pwa) qui garde site + `city.json` + modèles (2,4 Mo) dès la 1re visite ; bandeau « Mettre à jour » quand une nouvelle version est publiée ; carte installable (icône, manifeste). **Nécessite HTTPS** (domaine Coolify) : inactif sur `http://<ip>:3000`

## P2 — Plus beau, plus juste
- ⬜ Relief : peindre aussi les places sur le sol la nuit (lueur perdue depuis qu'elles sont peintes sur le terrain)
- 🟡 Monuments modélisés : fontaine, cathédrale, château et Carré Curial faits (formes simples) → décider si on passe certains en modèles Blender

*Heure et saison*
- ✅ Gestion cycle jour/nuit - En fonction de l'horodatage du navigateur (itération 31 : heure de Chambéry relue chaque minute ; ombres recalculées au plus une fois par minute en direct)
- ✅ Gestion des saisons - en fonction des dates du navigateur (itération 31 : variantes automne et branches nues du pack ; le pack n'a pas de version enneigée des feuillus utilisés)
- ✅ Option « heure réelle » (suivre l'heure de Chambéry) et saisons (lever/coucher du soleil réels) (itération 31 : bouton Direct, puce saison)
- ✅ Nuit : n'allumer que les lieux ouverts à l'heure choisie (lecture du tag OSM `opening_hours`) (itération 31 : 104 horaires sur 106 lus ; les 2 textes libres restent allumés)
- ⬜ Hiver : reprendre les arbres — de la neige plutôt que les branches nues / arbres morts (brun) actuels (demande de Dasco, à traiter plus tard) ; neige aussi au sol et sur les toits
- ⬜ Horaires : jours fériés et vacances scolaires (aujourd'hui ignorés, l'horaire habituel du jour s'applique)
- ⬜ Simplifier l'heure : prendre l'heure de l'appareil du visiteur au lieu de forcer le fuseau Europe/Paris (demande de Dasco, pour simplifier le code). Précision : « heure de Chambéry » dans le code est déjà l'heure de France (fuseau Europe/Paris) ; la simplification consiste à supprimer la conversion de fuseau (`src/time/chambery.ts` : `chamberyClock`, `chamberyInstant`, ≈ 25 lignes). Conséquence : un visiteur hors de France verrait la carte à son heure locale. La position du soleil garde la latitude et la longitude de Chambéry.
- ❓ Double toucher (zoom) : sans effet dans le navigateur de test, sur `main` comme après EN-02 (itération 40) — à vérifier sur un vrai téléphone
- ⬜ Cadence : curseur d'heure tiré à la main encore à 30 images/s (TI-02, itération 42) — à passer en pleine vitesse si c'est gênant
- ⬜ Mobile très étroit (iPhone SE, 320 px) : la rangée Bars / Cafés / Restaurants dépasse de l'écran (constaté à l'itération 31, antérieur)


*Refacto et stab*
- ➡ Découper `src/main.ts` → devenu **EN-02** (P1)
- ❓ Supprimer `assets-src/quaternius-nature/fbx/` (doublon des .obj) ?
- Alléger les assets
- ⬜ Arbres modélisés : utiliser `leaf_type` d'OSM (7 résineux → pins) — demande de garder ce tag dans le script de données
- ❓ Carré Curial : vérifier étages, portes/passages, couleurs ; replacer la gemme au centre du Carré (elle est sur la médiathèque)
- ❓ Château : vérifier sur place la grille côté esplanade (tracé, hauteur, portail) et l'escalier ; modéliser le Portail Saint-Dominique (vestige gothique en haut de l'escalier, contour OSM 235607769) ?
- ❓ Château : ajouter la tour Yolande (clocher du grand carillon, 70 cloches) — où est-elle ? ; vérifier hauteurs et toits des tours ; façade baroque de la Sainte-Chapelle non représentée
- ❓ Cathédrale : vérifier sur place l'emplacement et la hauteur du clocher, la forme de son toit, la couleur des toits

- ⬜ reprendre l'indicateur pour les lieux


*Deploiement*
- 🟡 Déployer sur le Pi (Coolify) : `Dockerfile` + `docker-compose.yml` prêts (itération 28) → mettre à jour `package-lock.json` (`npm install`), pousser, créer la ressource dans Coolify, puis partager le lien — *Dasco*

## P2 — Tester avec les amis
- ⬜ Session de test avec 5 personnes : combien de lieux trouvés, où elles bloquent, ce qu'elles retiennent

## P3 — Plus de jeu
- - ⬜ Ajouter tes idées de lieux — *Dasco*

- ⬜ Parcours thématiques (« Chambéry des ducs », « Chambéry sarde », « les nuits de Chambéry »)
- ⬜ Mode « sur place » : débloquer un lieu par géolocalisation (phot des piuxel art)
- ⬜ Curseur d'époques : afficher les bâtiments selon leur date
- ✅ Mascotte (éléphant) qui se promène dans le diorama — itération 33
- ⬜ Mascotte : bouton ou clic pour suivre l'éléphant avec la caméra (il part loin, on le perd de vue)
- ⬜ Mascotte : la nuit, il rentre dormir près de la fontaine (ou marche plus lentement)
- ⬜ Mascotte : il traverse parfois la couronne d'un arbre de rue (les arbres ne sont pas pris en compte dans ses chemins)
- ⬜ Partage de progression entre amis
- ⬜ Étendre à d'autres quartiers (plusieurs dioramas reliés)
- Avoir un luncher pour lancer la map (mode choix, exploration ou mode histoire
  - ⬜ y gérer le démarrage raté (audit du 30/09) : aujourd'hui, si `city.json` ne se charge pas, les visiteurs voient le message développeur « Lance `npm run data` » ; et une erreur après le chargement (terrain, monuments…) donne une page vide, car `main()` n'a pas de `catch` (`src/main.ts`). À prévoir avec le launcher : un message lisible pour les visiteurs (forme à définir)
- Avoir de la vie dans les rue
- ✅ Jeu « trouve l'éléphant » — itération 34 (coincer l'éléphant : abandonné, pas amusant), remplacé à l'itération 35 par « Ramène les quatre éléphants à la fontaine » (cache-cache, 1 à 5 fuites, épuisé, retour en vol, feu d'artifice)
- ⬜ Mini-jeu : régler après de vrais essais (distance de réapparition, nombre de fuites, points)
- ⬜ Mini-jeu : aide pour les trouver (flèche au bord de l'écran, ou bouton « où sont les éléphants ? ») — pour les joueurs ; le mode debug `?debug` (itération 36) montre déjà où ils sont
- ⬜ Mini-jeu : points selon la rapidité (idée écartée pour la v1)
- ⬜ Mini-jeu : distance des réapparitions (aujourd'hui ≤ 380 m de la fontaine) — Dasco aimait aussi quand ils partaient loin, à revoir
- ⬜ Points : à quoi les dépenser (bâtiments débloqués, décorations…) — *Dasco*
- Mode histoire qui fait visiter la ville

## Fait
Voir [FEATURES.md](../FEATURES.md) et [CHANGELOG.md](../CHANGELOG.md).
