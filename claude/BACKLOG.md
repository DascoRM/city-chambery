# Backlog

Priorités : **P1** prochaine itération · **P2** bientôt · **P3** un jour

## P1 — Fiabiliser le POC
- ⬜ Reprendre la position des 8 lieux (champ `pos` ou `osm.match` dans `src/content/pois.json`) — *Dasco*
- ⬜ Relire les fiches (Trivelli/Trivelly, « plus vaste ensemble de trompe-l'œil d'Europe » sourcé uniquement Wikipédia)
- ⬜ Pack nature : buissons, fleurs, rochers moussus, nénuphars dans les parcs
- ⬜ Épingles des lieux : icône par catégorie sur l'épingle (verre, tasse, couverts), après la v1 « pointeur de couleur »
- ⬜ Fiche des lieux : horaires OSM plus lisibles (regroupés par jour, « ouvert maintenant »)
- ⬜ **Petites animations le jour et la nuit** (la ville vit) — évolution du code existant, pas de refonte. Estimation : socle ≈ 1 session, éléphant ≈ 1 session, passants simples ≈ ½ à 1 session, personnages animés + 1 à 2 sessions, variantes de nuit ≈ ½ session :
  - socle commun : une liste de choses à animer à chaque image, un réseau de chemins tiré des rues et chemins piétons OSM, des ombres « pastille » au sol (les ombres réelles ne sont plus recalculées à chaque image), un comportement différent le jour et la nuit ;
  - l'éléphant qui se promène dans Chambéry (pas d'éléphant dans les packs Quaternius vérifiés → modèle en formes simples avec pattes animées, ou modèle trouvé ailleurs, licence à vérifier) ;
  - des passants : d'abord des silhouettes simples en grand nombre, puis éventuellement des personnages animés (pack Quaternius en CC0, à convertir de FBX en glb) près de la caméra seulement ;
  - la nuit : moins de monde dans les rues, du monde devant les bars ouverts ;
  - à concilier avec le ticket « moins d'images quand rien ne bouge »



## P1 — Fluidité (audit du 29/09, détail dans [PERF-AUDIT.md](PERF-AUDIT.md))
Avant l'itération 25 : ≈ 4 800 appels de rendu et ≈ 4,7 M triangles par image. Après (ombres à la demande, arbres simplifiés) : ≈ 2 400 appels et ≈ 1,5 M triangles par image la plupart du temps.
- ✅ **Mesurer** : compteur avec `?debug` dans l'adresse (images/s, pire image, appels de rendu, triangles, densité, taille du rendu) — itération 29
- ⏸ **Monuments : fusionner la géométrie par matériau** — *en attente, Dasco garde les monuments tels quels pour l'instant* (Carré Curial 1 683 objets, château 561, fontaine 54, cathédrale 42 → ~30 appels) — gain le plus fort, aucun changement visuel — *petit*
- ⬜ **Arbres modélisés** : découper les instances par quartier pour ne pas dessiner les arbres hors écran (simplification à −50 % faite, itération 25) — *moyen*
- 🟡 **Effet maquette moins gourmand** — fait à l'itération 29 : flou en demi-résolution sans anticrénelage, une seule passe finale, anticrénelage ×2 sur écran haute densité, densité plafonnée à 1,5 puis adaptée aux images/s. Reste à trancher pour mobile : suffisant, ou effet coupé sur petit écran ? — à mesurer avec `?debug`
- ⬜ **Moins d'images quand rien ne bouge** (≈ 20-30 images/s à l'arrêt, pleine vitesse pendant les mouvements) — batterie et chauffe — *moyen*
- ⬜ Chargement : vérifier gzip / brotli sur le serveur ; regrouper les 18 fichiers d'arbres ; `city.json` en binaire — *P3*

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
- ⬜ Hiver : neige au sol et sur les toits (non commencé)
- ⬜ Horaires : jours fériés et vacances scolaires (aujourd'hui ignorés, l'horaire habituel du jour s'applique)
- ⬜ Mobile très étroit (iPhone SE, 320 px) : la rangée Bars / Cafés / Restaurants dépasse de l'écran (constaté à l'itération 31, antérieur)


*Refacto et stab*
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
- ⬜ Quiz d'une question par lieu pour valider la découverte
- ⬜ Mode « sur place » : débloquer un lieu par géolocalisation
- ⬜ Curseur d'époques : afficher les bâtiments selon leur date
- ⬜ Mascotte (éléphant ?) qui se promène dans le diorama
- ⬜ Partage de progression entre amis
- ⬜ Étendre à d'autres quartiers (plusieurs dioramas reliés)

## Fait
Voir [FEATURES.md](FEATURES.md) et [CHANGELOG.md](CHANGELOG.md).
