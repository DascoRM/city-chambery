# Backlog

Priorités : **P0** bugs à corriger d'abord · **P1** prochaine itération · **P2** bientôt · **P3** un jour

*Dernier tri : 01/10/2026 (chaque ticket ouvert vérifié contre le code et les données, puis arbitré par Dasco : 11 tickets retirés, 2 epics à venir EP003 et EP004).*

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
- ✅ *itération 43* **TI-03 — three.js dans un fichier JS séparé** : appli 44,5 Ko gzip + three.js 171,6 Ko gzip ; une mise à jour de l'appli ne retélécharge plus que l'appli (mesuré : 44,5 Ko, estimé à 30). Réglage de découpage dans `vite.config.ts` — *petit*
- ✅ *itération 44* **EN-03 — Analyse : compression meshopt des modèles** → **GO**, voir [`tasks/en03-meshopt-analyse.md`](../../tasks/en03-meshopt-analyse.md) ; mise en œuvre = TI-04 ci-dessous. Énoncé d'origine : mesuré en test, 45 `.glb` de 442 → 197 Ko gzip (−55 %). À analyser avant de décider : la quantification ajoute une transformation au nœud (ignorée par `nature.ts`, qui ne garde que la géométrie) et le shader de marche de l'éléphant lit les positions des sommets ; décodeur à brancher sur les 3 chargeurs glTF. Livrable : essai sur un arbre et l'éléphant, comparaison visuelle, go / no go — *petit*
- ⬜ **TI-04 — Compression meshopt des modèles** (suite d'EN-03, GO) — *petit* : modèles 442 → 194 Ko gzip (−247 Ko, à chaque déploiement puisque l'empreinte des données change), décodeur +7,3 Ko :
  - `@gltf-transform/extensions` en devDependency (commiter `package-lock.json`) ;
  - `convert-nature.mjs` et `convert-mascot.mjs` : `meshopt({ encoder: MeshoptEncoder, level: 'high' })` en dernière transformation, puis `npm run nature` et `npm run mascot` ;
  - `src/scene/gltf.ts` : chargeur avec décodeur + `bakeToFloat` (positions remises en flottants et en mètres, sinon le shader de marche et `nature.ts` cassent), utilisé par `nature.ts`, `mascot.ts`, `models.ts` ;
  - README (modèles, licences) ; vérifier : géométrie, parc, éléphant, nuit et hiver, iPhone si possible, mode hors-ligne — détail dans [`tasks/en03-meshopt-analyse.md`](../../tasks/en03-meshopt-analyse.md)

## P1 — Fiabiliser le POC
- ⬜ Reprendre la position des 8 lieux (champ `pos` ou `osm.match` dans `src/content/pois.json`) — *Dasco*
- ⬜ Récupérer par script les données du projet bar / restau de Dasco (base scrappée il y a un an) : vrais horaires des bars, pubs et boîtes de nuit pour remplacer les horaires fictifs de `src/content/place-hours.json` (EP001-US011), et peut-être d'autres informations sur les lieux — *Dasco (script, à regarder ensemble), puis Claude*
- ⬜ Relire les fiches : « Trivelli » et « Trivelly » dans la même fiche (rue de Boigne, `pois.json`) ; « plus vaste ensemble de trompe-l'œil d'Europe » (cathédrale) sourcé uniquement Wikipédia — *Dasco*
- ⬜ Bars / restaurants en double (retour de Dasco, itération 42) : doublons dans OSM, deux points pour le même lieu — Le Maharaja (node/462016883 et node/8809074519, à 15 m), Le Thali (node/13144805796 et node/14104261001, à 6 m). Corriger dans OSM, ou fusionner dans le script de données les lieux de même nom à moins de ~25 m (Columbus Café : 2 points à 330 m, sans doute 2 boutiques, à garder) — *petit*
- ⬜ Fiche des lieux : horaires OSM regroupés par jour. La ligne « Ouvert / Fermé à cette heure » existe déjà ; reste la mise en forme (aujourd'hui le texte OSM, jours traduits, séparés par « · », `hoursFr` dans `src/ui/ui.ts`)


## EP001 « La ville vit » : livrée (01/10/2026)
[Epic EP001](../../specs/epics/EP001-la-ville-vit/epic.md) : US001 à US009 et US011 livrées (US006 drapeaux à valider par Dasco, US010 personnages animés abandonnée : on garde les silhouettes). Détail dans [CHANGELOG.md](../CHANGELOG.md). La suite est l'epic EP003 ci-dessous.

## P2 — Epic à venir : EP003 « Reprise vie dans la ville » (retours de Dasco, 01/10/2026)
À passer en epic (`specs/epics/EP003-…`) après EP002 « Noms de rues au sol » (décision de Dasco, 01/10/2026). Contexte : US001 et US002 jugées « très bien » par Dasco.
- ⬜ **Le Carré Curial vit la nuit** : des passants la nuit au Carré Curial (lieu de vie nocturne), même quand le reste des rues est calme
- ⬜ **Plus de monde devant les bars la nuit** : au moins 6 personnes par groupe (aujourd'hui 2 à 5, `groups.size` dans `life.json`)
- ⬜ **Tous les bars ouverts ont du monde après 21 h** : chaque bar dont l'horaire dit « ouvert » (OSM ou provisoire) a son groupe dès 21 h, au lieu d'un tirage limité à 12 groupes près de la caméra ; à mesurer (≈ 36 bars, pubs et boîtes de nuit × 6 personnes)
- ⬜ **Personnages qui dansent au Carré Curial la nuit** : ajouter des personnages avec des animations (danse) ; leçon de l'US010 : le pack Kenney était trop cartoon et le personnage Mixamo n'avait pas d'animation (télécharger les animations « Dancing » sur Mixamo, viser un modèle léger), faire un essai visuel d'abord
- ⬜ **Lumières animées au Carré Curial la nuit** : animation lumineuse (projecteurs, couleurs qui changent, guirlandes…) pour montrer que le lieu est animé ; à préciser avec Dasco
- ⬜ **Végétation dans les parcs** : buissons, fleurs, herbes, rochers moussus et nénuphars (le pack Quaternius de `assets-src/quaternius-nature/obj/vegetation` et `rochers` les contient déjà, avec des buissons et des rochers enneigés pour l'hiver) ; à instancier comme les arbres (`nature.json`, `npm run nature`) — *déplacé ici le 01/10/2026 (décision de Dasco)*

## EP004 « Page de chargement et lobby de démarrage » : US001 à US003 livrées (itération 63)
[Epic EP004](../../specs/epics/EP004-chargement-et-lobby/epic.md) : design validé (piste B), écran initial, lobby, bouton « ? ». À valider par Dasco. Reste : **US004** démarrage raté (message lisible), **US005** chargement plus stylé (plus tard), **US006** page d'arrimage (plus tard).
- ⬜ Compléter l'accroche du lobby : « Explorer la ville, et découvrez » semble inachevée (`src/content/lobby.json`, clé `tagline`) — *Dasco*
- ⬜ Chargement lent : message qui rassure après quelques secondes (critère de l'US002 non fait)
- ⬜ Lobby : vérifier `prefers-reduced-motion`, la visite hors ligne et JavaScript désactivé (implémentés, non essayés), puis un vrai téléphone

## Epic à venir : EP005 « Balade avec un avatar » (spec et plan écrits le 02/10/2026, **pas commencée**)
[Epic EP005](../../specs/epics/EP005-balade-avatar/epic.md) · [plan](../../tasks/ep005-plan.md) : un **mode balade** (on y entre, on en sort) : avatar dirigé au clic ou au toucher, vue 3/4 façon Diablo, caméra qui suit, bâtiments entiers qui s'effacent devant lui, interface restreinte. 13 user stories, 50 points hors options, 9 à 13 sessions ; **prototype d'abord** (US001 à US004 minimales) puis décision. Branche d'epic `feat/EP005-balade-avatar` (une branche par US fusionnée dedans ; `main` au besoin ; correctifs par rebase). Décisions de Dasco du 02/10 intégrées ; restent 6 points à préciser (P2, P4 à P8) dans l'epic.
- ⬜ Valider la spec EP005 et préciser les points restants (silhouette, interface du mode, fiches, geste mobile, escaliers, autres téléphones) — *Dasco*
- ✅ *vérifié le 02/10* « ≈ 2 400 appels de rendu » (PERF-AUDIT) : **reste vrai en vue d'ensemble** (2 406) ; 732 près du Carré Curial, 630 près du château, 63 dans les rues. PERF-AUDIT précisé **par vue** ; l'analyse EP005 l'avait cru périmé à tort
- ✅ *02/10* Première mesure sur l'**iPhone 12 Pro** (Dasco, `?debug`) : **≤ 31 images/s même en poussant les gestes**, 750 à 1 000 appels de rendu ; pas de contrainte ressentie
- ⬜ **Comprendre le plafond de ≈ 31 images/s sur iPhone en mouvement** : le code monte à ≈ 60 en mouvement sur Mac ; pistes : mode économie d'énergie (Safari limite alors à 30), téléphone qui tient ≈ 32 ms par image avec la densité déjà au minimum ; relever dans `?debug` le mode (« mouvement » ou « repos »), la densité et la pire image — *Dasco (relevé), puis Claude*
- ⬜ Idée liée, hors EP005 : bouton « Voir d'ici » (caméra à hauteur d'homme sur un lieu, sans marcher) — environ une demi-session

## P2 — Fluidité mobile
Détail dans [PERF-AUDIT.md](../../architecture/PERF-AUDIT.md).
Avant l'itération 25 : ≈ 4 800 appels de rendu et ≈ 4,7 M triangles par image. Après (ombres à la demande, arbres simplifiés) : ≈ 2 400 appels et ≈ 1,5 M triangles par image la plupart du temps.
- ✅ **Mesurer** : compteur avec `?debug` dans l'adresse (images/s, pire image, appels de rendu, triangles, densité, taille du rendu) — itération 29
- ⏸ **Monuments : fusionner la géométrie par matériau** — *en attente, Dasco garde les monuments tels quels pour l'instant ; à reprendre avec le chantier bâtiments (confirmé à l'audit du 30/09)* — *devient pertinent pour EP005 : 630 à 732 appels de rendu près du château et du Carré Curial (mesuré le 02/10), contre 63 dans les rues ; à reprendre si la balade est lente sur téléphone* (Carré Curial 1 683 objets, château 561, fontaine 54, cathédrale 42 → ~30 appels) — gain le plus fort, aucun changement visuel — *petit*
- 🟡 **Effet maquette moins gourmand** — fait à l'itération 29 : flou en demi-résolution sans anticrénelage, une seule passe finale, anticrénelage ×2 sur écran haute densité, densité plafonnée à 1,5 puis adaptée aux images/s. Reste à trancher pour mobile : suffisant, ou effet coupé sur petit écran ? — à mesurer avec `?debug`
- ➡ **Moins d'images quand rien ne bouge** → devenu **TI-02** (30 images/s au repos)
- ⬜ Chargement : ~~vérifier gzip~~ (gzip actif dans `deploy/nginx.conf`, vérifié à l'audit du 30/09) ; brotli (mesuré le 01/10 sur `city.json` : 400 Ko en gzip, 361 Ko en brotli à un réglage moyen, −23 % annoncé au réglage maximal ; absent de l'image nginx alpine ; Vercel compresse déjà ses fichiers) ; regrouper les fichiers d'arbres (45 `.glb` aujourd'hui) ; `city.json` en binaire (entiers + deltas : −15 % mesuré) — *P3*
- ⏸ Mode hors-ligne : le service worker retélécharge `city.json` et les `.glb` à la première visite au lieu de reprendre le cache HTTP (≈ 0,55 Mo gzip en double, estimé) — *pas grave pour l'instant (Dasco, 30/09)*

## P1 — Bug : terrain qui passe au-dessus des rues (retour de Dasco, 01/10/2026) — corrigé à l'itération 62
- ✅ *itération 62* **Plaques vertes et beiges sur certaines rues et boulevards** (rubans découpés le long des arêtes du sol, voir CHANGELOG ; ancien énoncé :) (existait avant les noms de rues) — *moyen* : le ruban d'une rue relie en ligne droite des sommets posés sur le sol tous les 4 m, aux deux bords ; le terrain (grille de 10 m) se courbe ou monte raide entre eux. Mesuré (itération 61, tous les tronçons) : **55 rues sur 1 795** ont un endroit où le terrain dépasse la chaussée de plus de 18 cm, jusqu'à **2,5 m** boulevard de Lémenc, 1,6 m rue André Jacques, 1,5 m chemin de la Cassine, 1,4 m avenue de la Grande Chartreuse, 1,1 m faubourg Reclus. Un découpage plus fin du ruban ne suffit pas (0,8 m d'écart à 1,5 m de pas, 6 fois plus de triangles). Pistes : **creuser le terrain sous les rues** (abaisser les sommets de la grille proches d'une chaussée, `heightAt` restant cohérent pour tout ce qui est posé dessus), ou poser la chaussée au plus haut des sommets voisins (elle flotte alors un peu au-dessus du sol côté aval). À décider avec Dasco après un essai visuel ; vérifier ensuite les éléphants, passants, arbres, bâtiments (`minUnder`), noms de rues

## Suites d'EP002 « Noms de rues au sol » (itérations 60 et 61)
- ⬜ Style des noms de rues à revoir à l'usage (demande de Dasco) : `ink`, `halo`, `nightGlow` dans `src/content/streets.json`, polices et tailles dans `diorama.config.json` → `streetNames`
- ⬜ Rues étroites : le nom est caché par les immeubles sauf en vue oblique le long de la rue (rue de Boigne) ; à voir avec Dasco : plus gros, ou répété, ou en gras
- ⬜ Places sans nom (Saint-Léger, Lucien Biset…), ronds-points et ruelles de moins de 25 m : afficher le nom sur la place (`areas` ne porte pas le nom des places aujourd'hui)
- ✅ *itération 61* Mémoire de l'atlas des noms : plus un sujet (champ de distance, 2 Mo au lieu de 16)

## Architecture — à trancher avant d'ouvrir le diorama aux amis
- ❓ **Back-end : pas nécessaire aujourd'hui.** Il le devient seulement pour : progression partagée entre appareils ou entre amis (comptes, classement), ajout de lieux par d'autres que Dasco sans redéployer, données qui changent souvent (événements, horaires). Pistes légères si besoin : PocketBase ou Supabase auto-hébergé sur le Pi (Coolify) ; pour les événements des bars, consommer l'API d'ACME plutôt que créer un back-end dédié
- ✅ **Cache HTTP** : fait dans `deploy/nginx.conf` (itération 28) — `assets/` en cache 1 an, `index.html` / `city.json` / `.glb` revalidés (ETag, 304), gzip. Brotli : pas dans l'image nginx standard, à voir si besoin
- ✅ **Données versionnées** (itération 30) : empreinte des données calculée au build (`city.json?v=…`, `.glb?v=…`) ; nginx garde ces adresses en cache 1 an ; une modification des données change l'adresse
- ✅ **Mode hors-ligne / rechargement instantané** (itération 30) : service worker (vite-plugin-pwa) qui garde site + `city.json` + modèles (2,4 Mo) dès la 1re visite ; bandeau « Mettre à jour » quand une nouvelle version est publiée ; carte installable (icône, manifeste). **Nécessite HTTPS** (domaine Coolify) : inactif sur `http://<ip>:3000`
- Sur mobile opu sur web ne charger que la vue présente a l'écran. Si lumière ou animation hors du scope d ela vue de l'écran, pas pertient de charger ce qui ce passe hors de l'écran. Faire une analyse de ce qui est présent, si rien mettr eun systeme pour charger en fonction du rendu à l'écran
## P2 — Plus beau, plus juste
- ⬜ Relief : peindre aussi les places sur le sol la nuit (lueur perdue depuis qu'elles sont peintes sur le terrain)
- 🟡 Monuments modélisés : fontaine, cathédrale, château et Carré Curial faits (formes simples) → décider si on passe certains en modèles Blender

*Heure et saison*
- ✅ Gestion cycle jour/nuit - En fonction de l'horodatage du navigateur (itération 31 : heure de Chambéry relue chaque minute ; ombres recalculées au plus une fois par minute en direct)
- ✅ Gestion des saisons - en fonction des dates du navigateur (itération 31 : variantes automne et branches nues du pack ; le pack n'a pas de version enneigée des feuillus utilisés)
- ✅ Option « heure réelle » (suivre l'heure de Chambéry) et saisons (lever/coucher du soleil réels) (itération 31 : bouton Direct, puce saison)
- ✅ Nuit : n'allumer que les lieux ouverts à l'heure choisie (lecture du tag OSM `opening_hours`) (itération 31 : 104 horaires sur 106 lus ; les 2 textes libres restent allumés)
- ⬜ Hiver : reprendre les arbres — de la neige plutôt que les branches nues / arbres morts (brun) actuels (demande de Dasco, à traiter plus tard) ; neige aussi au sol et sur les toits
- ⬜ Simplifier l'heure : prendre l'heure de l'appareil du visiteur au lieu de forcer le fuseau Europe/Paris (demande de Dasco, pour simplifier le code). Précision : « heure de Chambéry » dans le code est déjà l'heure de France (fuseau Europe/Paris) ; la simplification consiste à supprimer la conversion de fuseau (`src/time/chambery.ts` : `chamberyClock`, `chamberyInstant`, ≈ 25 lignes). Conséquence : un visiteur hors de France verrait la carte à son heure locale. La position du soleil garde la latitude et la longitude de Chambéry.
- ❓ Double toucher (zoom) : sans effet dans le navigateur de test, sur `main` comme après EN-02 (itération 40) — à vérifier sur un vrai téléphone
- ⬜ Cadence : curseur d'heure tiré à la main encore à 30 images/s (TI-02, itération 42) — à passer en pleine vitesse si c'est gênant
- ✅ *vérifié le 01/10* Mobile très étroit : la rangée Bars / Cafés / Restaurants tient maintenant (aucun élément ne dépasse à 320 et 375 px)
- ⬜ Mobile à 320 px : les crédits en bas de l'écran recouvrent la barre d'heure (constaté le 01/10)


*Refacto et stab*
- ➡ Découper `src/main.ts` → devenu **EN-02** (P1)
- Alléger les assets
- ❓ Arbres modélisés : utiliser `leaf_type` d'OSM (7 résineux → pins) — *à voir (Dasco, 01/10)* — demande de garder ce tag dans le script de données
- ❓ Carré Curial : vérifier étages, portes/passages, couleurs ; replacer la gemme au centre du Carré (elle est sur la médiathèque)
- ❓ Château : vérifier sur place la grille côté esplanade (tracé, hauteur, portail) et l'escalier ; modéliser le Portail Saint-Dominique (vestige gothique en haut de l'escalier, contour OSM 235607769) ?
- ❓ Château : ajouter la tour Yolande (clocher du grand carillon, 70 cloches) — où est-elle ? ; vérifier hauteurs et toits des tours ; façade baroque de la Sainte-Chapelle non représentée
- ❓ Cathédrale : vérifier sur place l'emplacement et la hauteur du clocher, la forme de son toit, la couleur des toits



*Deploiement*
- 🟡 Déployer sur le Pi (Coolify) : `Dockerfile` + `docker-compose.yml` prêts (itération 28), `package-lock.json` à jour (`npm ci` passe), `vercel.json` ajouté ; reste : créer la ressource dans Coolify, puis partager le lien — *Dasco*

## P2 — Tester avec les amis
- ⬜ Session de test avec 5 personnes : combien de lieux trouvés, où elles bloquent, ce qu'elles retiennent

## P3 — Plus de jeu
- ⬜ Ajouter tes idées de lieux — *Dasco*

- ⬜ Parcours thématiques (« Chambéry des ducs », « Chambéry sarde », « les nuits de Chambéry »)
- ⬜ Mode « sur place » : débloquer un lieu par géolocalisation (phot des piuxel art)
- ⬜ Curseur d'époques : afficher les bâtiments selon leur date
- ✅ Mascotte (éléphant) qui se promène dans le diorama — itération 33
- ⬜ Partage de progression entre amis
- ⬜ Étendre à d'autres quartiers (plusieurs dioramas reliés)
- ✅ Jeu « trouve l'éléphant » — itération 34 (coincer l'éléphant : abandonné, pas amusant), remplacé à l'itération 35 par « Ramène les quatre éléphants à la fontaine » (cache-cache, 1 à 5 fuites, épuisé, retour en vol, feu d'artifice) ; **simplifié à l'itération 65** : un clic = sprint, un reclic pendant le sprint = attrapé (60 %), sans fuites ni cache-cache (retour utilisateurs ; à régler : `catchChance`, `sprintSpeed`)
- ⬜ Mini-jeu : régler après de vrais essais : nombre de fuites (1 à 5), points (10, bonus 20) et distance de réapparition (aujourd'hui 100 à 250 m, promenade jusqu'à 380 m de la fontaine : `mascot.json`) — Dasco aimait aussi quand ils partaient loin, à revoir
- ⬜ Points : à quoi les dépenser (bâtiments débloqués, décorations…) — *Dasco*
- Mode histoire qui fait visiter la ville

- ⬜ Rues : surcoût de chargement et de triangles du découpage des rubans (+72 ms, +55 000 triangles) à mesurer sur téléphone ; si trop lourd : calculer le découpage dans le script de données plutôt qu'au chargement

## Fait
Voir [FEATURES.md](../FEATURES.md) et [CHANGELOG.md](../CHANGELOG.md).
