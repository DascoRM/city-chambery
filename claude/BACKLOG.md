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
- ⬜ **Mesurer d'abord** : compteur discret avec `?debug` dans l'URL (images/s, appels de rendu, triangles via `renderer.info`), pour tester sur ton téléphone avant et après chaque ticket — *petit*
- ⏸ **Monuments : fusionner la géométrie par matériau** — *en attente, Dasco garde les monuments tels quels pour l'instant* (Carré Curial 1 683 objets, château 561, fontaine 54, cathédrale 42 → ~30 appels) — gain le plus fort, aucun changement visuel — *petit*
- ⬜ **Arbres modélisés** : découper les instances par quartier pour ne pas dessiner les arbres hors écran (simplification à −50 % faite, itération 25) — *moyen*
- ⬜ **Effet maquette sur mobile : moins gourmand ou inactif** (à trancher) — moins gourmand = flou en demi-résolution, anticrénelage ×2, densité de pixels plafonnée à 1,5 ; inactif = coupé automatiquement sur petit écran — *moyen*
- ⬜ **Moins d'images quand rien ne bouge** (≈ 20-30 images/s à l'arrêt, pleine vitesse pendant les mouvements) — batterie et chauffe — *moyen*
- ⬜ Chargement : vérifier gzip / brotli sur le serveur ; regrouper les 18 fichiers d'arbres ; `city.json` en binaire — *P3*

## Architecture — à trancher avant d'ouvrir le diorama aux amis
- ❓ **Back-end : pas nécessaire aujourd'hui.** Il le devient seulement pour : progression partagée entre appareils ou entre amis (comptes, classement), ajout de lieux par d'autres que Dasco sans redéployer, données qui changent souvent (événements, horaires). Pistes légères si besoin : PocketBase ou Supabase auto-hébergé sur le Pi (Coolify) ; pour les événements des bars, consommer l'API d'ACME plutôt que créer un back-end dédié
- ⬜ **Cache HTTP** au déploiement : fichiers de `assets/` (nom avec empreinte) en cache 1 an ; `city.json`, modèles et `index.html` revalidés (ETag) ; compression gzip ou brotli
- ⬜ **Données versionnées** : `city.json` et les `.glb` sont servis sous un nom fixe → risque d'ancienne version en cache après une mise à jour ; ajouter un numéro de version dans l'URL
- ⬜ **Mode hors-ligne / rechargement instantané** (service worker, PWA) : garder `city.json` (1,4 Mo) et les modèles sur le téléphone — utile sur place, à Chambéry, avec peu de réseau

## P2 — Plus beau, plus juste
- ⬜ Relief : peindre aussi les places sur le sol la nuit (lueur perdue depuis qu'elles sont peintes sur le terrain)
- 🟡 Monuments modélisés : fontaine, cathédrale, château et Carré Curial faits (formes simples) → décider si on passe certains en modèles Blender

*Heure et saison*
- ⬜ Gestion cycle jour/nuit - En fonction de l'horodatage du navigateur (ombres : aujourd'hui recalculées seulement quand le soleil bouge ; fréquence de recalcul en heure réelle à définir)
- ⬜ Gestion des saisons - en fonction des dates du navigateur (le pack Quaternius a des versions automne / neige / arbres morts de chaque arbre)
- ⬜ Option « heure réelle » (suivre l'heure de Chambéry) et saisons (lever/coucher du soleil réels)
- ⬜ Nuit : n'allumer que les lieux ouverts à l'heure choisie (lecture du tag OSM `opening_hours`)


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
- ⬜ Déployer sur le Pi (Coolify, site statique) et partager le lien

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
