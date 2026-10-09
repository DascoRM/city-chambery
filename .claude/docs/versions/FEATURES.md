# Fonctionnalités

État au 09/10/2026 — itération 88 (la section Carte n'a pas changé depuis l'itération 74, hormis les retouches publiées vérifiées par le contrat).

## Administration (EP008, EP010)

| Fonctionnalité | État | Détail |
|---|---|---|
| Administration en React (`/admin/`) | ✅ Vérifié par Dasco (prévisualisation, 09/10) | Application séparée de la carte (`frontend/admin/`, React 19), adresses en `#/…` ; messages d'erreur en français ; réponses de l'API vérifiées par le contrat |
| Session d'administration (EP010-US008) | ✅ Vérifié par Dasco (prévisualisation, 09/10) | Le jeton ne sert qu'à se connecter ; ensuite un cookie `HttpOnly` que la page ne peut pas lire ; prolongée à chaque action (2 h sans activité), 8 h au plus ; « Se déconnecter » ferme la session même si une réponse lente revient après ; changer `ADMIN_TOKEN` ferme toutes les sessions |
| Tableau de bord | ✅ Vérifié par Dasco (prévisualisation, 09/10) | Version, environnement, Node.js, région ; base : état, taille, migrations à appliquer, lignes par table. Pas encore : usage et quotas (EP008-US005 / US008) |
| Retouches des parkings depuis l'administration | ✅ Vérifié par Dasco (prévisualisation, 09/10) | Page « Parkings » : chercher un parking de la carte, le masquer ou changer nom, tarif, places, type, position, note **avec une source obligatoire** ; ajouter un parking absent d'OSM ; liste des retouches avec « Retirer » ; journal. Publiées tout de suite pour la carte (au plus 1 minute de délai). Pas encore : lieux d'histoire, carte de position (EP008-US006 et US007) |

## Météo (EP009, en cours)

| Fonctionnalité | État | Détail |
|---|---|---|
| Météo de Chambéry gérée par le back (`GET /api/weather`, US003) | 🟡 API seule, vérifiée sur la prévisualisation ; pas encore affichée sur la carte (US004) | Open-Meteo, modèle ICON du DWD, coordonnées fixes du centre ; le back traduit les codes de la source en 9 conditions (ciel dégagé, éclaircies, couvert, brouillard, bruine, pluie, neige, pluie et neige, orage) avec température, nuages, précipitations, vent, visibilité ; relevé renouvelé à chaque pas de 15 min du modèle, une seule requête pour tous les visiteurs ; si la source tombe, dernier bon relevé jusqu'à 3 h ; format partagé dans `contrat/meteo.ts`. Libellés et seuils à valider par Dasco (US011) |

## Carte / diorama

| Fonctionnalité | État | Détail |
|---|---|---|
| Couche « 🅿️ Parkings » (EP006, **prototype**) | 🟡 À valider | Bouton « 🅿️ Parkings » : parkings colorés au sol par tarif (orange payant, menthe gratuit, gris tarif inconnu ; voirie pâle), lueur de nuit, légende ; panneau « P » cube sur les parkings de surface et en silo, le même panneau posé sur le toit du bâtiment pour les souterrains ; clic ou survol → fiche (type, payant / gratuit, places OSM ou ≈ estimées ou inconnues, PMR, hauteur max, source datée). Privés exclus. Pas encore : tarifs sourcés, voitures-jouets, vélos, chiffres et quiz, « où me garer » |
| Mode balade avec un avatar (EP005, **prototype**) | 🟡 À valider | Bouton « 🚶 Balade » : un petit personnage (silhouette des passants ×2, rose, tache blanche au sol, silhouette vue à travers les bâtiments) apparaît à la fontaine des Éléphants ; la caméra le suit (85 m, 40°, zoom 45 à 300 m) ; clic gauche = il marche en suivant les rues (chemin calculé sur le réseau partagé avec les passants, 14 m/s) ; clic sur un ✦ = il y marche, la fiche s'ouvre à l'arrivée ; clic droit glissé / un doigt glissé = déplacer la carte, bouton « Retrouver mon avatar » ; boussole et légende masquées ; « Vue libre » pour sortir (l'avatar reste). **Les bâtiments entiers et les monuments (château, cathédrale, Carré Curial) qui masquent l'avatar s'effacent en fondu** (les arbres restent ; liste d'exceptions et durée dans `avatar.json` → `cutaway`). Pas encore : position sauvegardée (US007), fiches adaptées (US006). Réglages : `avatar.json` |
| Relief du terrain | ✅ | Grille 10 m ; source RGE ALTI (IGN), repli par interpolation des sols BD TOPO ; ≈ 92 m de dénivelé ; rues, rivière, bâtiments, arbres, repères, étiquettes et monuments posés sur le sol |
| Socle diorama (plateau, strates de terre, plinthe bois) | ✅ | Emprise ≈ 1,3 km × 1,2 km, configurable dans `diorama.config.json` |
| Bâtiments extrudés depuis OpenStreetMap | ✅ | 2 067 bâtiments ; 1 959 avec hauteurs IGN BD TOPO (gouttière + toit quand disponible), 105 encore estimées (surtout de petites annexes) |
| Couleurs pastel des façades, toits terracotta / ardoise | ✅ | Déterministe (même couleur à chaque chargement) |
| Toits en pente — rectangulaires | ✅ | 1 028 bâtiments : deux pans, quatre pans ou pyramide, sur les emprises quasi rectangulaires de 12 à 900 m². Forme issue du tag OSM `roof:shape` quand il existe (≈ 3 %), sinon choix stylistique |
| Toits en pente — formes irrégulières | ✅ | 679 bâtiments (y compris les très grands quand BD TOPO mesure un toit) (en L, en U, avec cour) : toit à pans calculé par squelette droit, pente 33°, faîtage limité à 7 m (14 m pour les églises) |
| Toits plats restants | 🟡 | ≈ 370 : garages/abris, emprises > 2 500 m², moins de 12 m², tag `roof:shape=flat`, 4 échecs de calcul |
| Rues, chemins, places piétonnes | ✅ | Trottoirs séparés (`footway=sidewalk`) masqués pour alléger |
| Ponts au-dessus de l'eau | ✅ | Tablier simple |
| Espaces verts | ✅ | Peints sur le sol en relief (comme les places et plans d'eau) |
| Arbres | ✅ | Arbres OSM + arbres semés dans les parcs |
| Arbres modélisés (pack Quaternius) | 🟡 | 16 parcs et squares (classiques, bouleaux, quelques pins), jardin botanique (+ saules), bords de la Leysse (bouleaux) ; rues en arbres simples ; ≈ 880 arbres, 18 modèles ; `nature.json`, `npm run nature` |
| Cours d'eau (la Leysse) | ✅ | Berges en pierre, eau brillante animée, largeur OSM ×1,8 ; tronçons couverts dessinés quand même (choix de lisibilité, `showCoveredWater`) |
| Noms des parcs et cours d'eau | ✅ | 15 étiquettes, apparaissent en s'approchant (grands parcs d'abord), réduites quand la caméra est très proche |
| Noms de rues au sol (EP002) | ✅ | 182 noms peints à plat sur la chaussée, dans le sens de la rue (un par rue, sur sa partie la plus droite), majuscules sans empattement, nettes à tous les zooms (champ de distance), toujours à l'endroit quel que soit le cap ; invisibles en vue d'ensemble, fondu de 320 m à 200 m de la caméra ; cachés par les bâtiments ; lisibles de nuit (lueur légère) ; 32 voies sans nom (trop courtes, ronds-points, places) ; réglages : `streetNames` (`diorama.config.json`), `streets.json` ; contrôle : `npm run check:streets` |
| Ombres portées, lumière d'après-midi | ✅ | |
| Monuments modélisés | 🟡 | Système prêt (formes en code ou fichiers glTF, config `src/content/models.json`) ; 1 monument en test : fontaine des Éléphants en formes simples (bassin de 13 m tiré d'OSM, 4 éléphants dos à dos avec jets d'eau, colonne, statue ; hauteur 17,65 m ; agrandie ×1,3) ; mise en lumière la nuit (éclairage par le bas, statue en projecteur, bassin bleuté, halo au sol) ; itération 38 : chaque matériau garde ses propres réglages de nuit (pierre, fonte, bronze), et chaque monument sa propre altitude de sol (BUG-01) |
| Cathédrale Saint-François-de-Sales | 🟡 | Formes simples bâties sur le contour OSM réel : bas-côtés et chapelles, nef haute (≈ 25 m) à toit à deux pans et contreforts, abside, façade flamboyante simplifiée côté place Métropole (portail, grande baie, pinacles), clocher côté nord (position et hauteur supposées) ; éclairée la nuit, baies lumineuses |
| Château des ducs de Savoie | 🟡 | 7 bâtiments reconstruits sur leurs contours OSM : tours Trésorerie, demi-ronde et des Archives (cordon, meurtrières, toits pointus), Sainte-Chapelle (contreforts à pinacles, grandes baies), Porterie (mâchicoulis), aile du Midi et Conseil départemental (fenêtres, toits d'ardoise raides) ; hauteurs et toits supposés ; tour Yolande absente ; côté esplanade : mur bas et grille en fer, portail fermé sur l'allée, escalier de pierre (tracés OSM) ; éclairé la nuit |
| Carré Curial | 🟡 | Formes simples sur le contour OSM avec sa cour ; gouttière 16,7 m et toit 5,4 m (BD TOPO) ; toit à pans autour de la cour, soubassement, corniche, fenêtres régulières côté rue et côté cour ; éclairé la nuit ; médiathèque J.-J.-Rousseau accolée intégrée (mêmes matériaux, toit plat) ; étages et couleurs supposés |
| Mascottes : éléphants qui se promènent | ✅ | Itération 33 (1 éléphant), 35 (4 éléphants, réseau partagé). Marche uniquement sur les voies OSM (graphe des rues et chemins ; sans escaliers, passages sous bâtiment, trottoirs collés aux façades, abords de la fontaine), part de la fontaine des Éléphants et reste dans un rayon d'≈ 380 m ; va plutôt tout droit et préfère les rues piétonnes ; pauses de 4 à 8 s ; pattes, trompe, oreilles et queue animées dans le shader ; ombre en tache ; 4,5 m de haut ; modèle « Elephant » de jeremy (Poly Pizza, CC BY 3.0, crédité en bas à droite) ; `mascot.json`, `npm run mascot` |
| Mini-jeu « Ramène les éléphants à la fontaine » | ✅ | Itération 35, **simplifié à l'itération 65** (retour d'utilisateurs : trop de clics et de recherches). Au départ la fontaine n'a plus ses 4 éléphants, qui se promènent dans les rues. **Un clic : l'éléphant sprinte 3,5 s** (bulle de provocation qui le suit), puis s'arrête ; **un 2e clic pendant le sprint l'attrape** (60 % de réussite, sinon il se moque et continue) : il s'envole sur la fontaine et se change en bronze, feu d'artifice ; points à chaque éléphant, bonus à la fontaine complète ; partie gardée dans le navigateur. Plus de fuites ni de réapparition. Réglages : `mascot.json` → `game` |
| Cycle jour/nuit | ✅ | **Heure réelle de Chambéry par défaut** (bouton « Direct », relue chaque minute, quel que soit le fuseau de l'appareil) ; curseur d'heure (quitte le direct) + lecture (une journée en 2 min) ; **vraie course du soleil** (azimut et hauteur calculés pour la date : lever/coucher réels affichés, soleil bas l'hiver), crépuscule orangé, nuit bleutée avec lune, fond de page assorti |
| Auvents des bars, cafés et restaurants | ✅ | Itération 46 (EP001-US008), **validés par Dasco** (itération 48) : pièces du pack de bâtiments de Kenney (CC0), posées sur la façade côté rue de 148 lieux sur 169, à hauteur de rez-de-chaussée, à la couleur de la catégorie (éclaircie) ; masquées avec la catégorie dans la légende ; 6 appels de rendu en plus. Dalles plates, discrètes, sombres la nuit |
| Horaires provisoires des bars | 🟡 | Itération 46 (EP001-US011) : horaires fictifs pour 23 bars, pubs et boîtes de nuit (`src/content/place-hours.json`), servant à l'éclairage de nuit seulement, jamais affichés dans la fiche |
| Fenêtres et portes de jour | ✅ | Itération 49 (EP001-US009) : la grille de fenêtres des façades est dessinée de jour (itération 50 : vitre claire qui reflète le ciel, encadrement crème) ; portes au rez-de-chaussée des murs côté rue (≈ une case de 3 m sur trois, jamais sur un mur mitoyen) ; aucun triangle de plus. Les portes se voient surtout sur les places (les rues étroites cachent le pied des façades) |
| Fenêtres qui vivent la nuit | ✅ | Itération 56 (EP001-US003) : la part de fenêtres allumées suit l'heure (35 % à 18 h, 40 % à 22 h, 5 % à 4 h, 20 % au réveil à 7 h) ; elles s'éteignent une à une dans un ordre stable ; réglage `windows.litCurve` de `life.json` |
| Pigeons et oiseaux | ✅ | Itération 57 (EP001-US004) : de jour, volées de pigeons qui picorent sur les places près du point regardé et s'envolent de temps en temps ; oiseaux qui tournent au-dessus de la cathédrale et du château ; faits en code, +1 appel de rendu ; réglages `birds` de `life.json` |
| Cheminées et fumée | ✅ | Itération 58 (EP001-US005) : 373 cheminées en briques sur les toits en pente ; fumée selon la saison (hiver dense, rien l'été) près du point regardé, qui dérive avec le vent ; +2 appels de rendu ; réglages `smoke` de `life.json` |
| Drapeaux de la Savoie | 🟡 | Itération 59 (EP001-US006, à valider) : sur le château et l'hôtel de ville, au point le plus haut du toit ; ondulent dans le sens du vent ; réglages `flags` de `life.json` |
| Passants | ✅ | Itérations 51 et 55 (EP001-US001, US002) : 300 silhouettes de 1,7 m (×0,5 sur téléphone) qui marchent sur toutes les voies sauf les escaliers, jamais dans l'eau, regroupées dans un rayon de 250 m autour du point regardé ; **foule selon l'heure** (5 % la nuit, 100 % à midi), arrivées et départs hors champ ; **la nuit, petits groupes devant les bars, pubs, boîtes de nuit ouverts** (et plus rarement restaurants, cafés), qui repartent à la fermeture et suivent la légende. Réglages : `src/content/life.json` |
| Saisons | ✅ | Puce Auto / Printemps / Été / Automne / Hiver ; auto = date du jour. Feuillage : vert, couleurs d'automne (15 oct. – 30 nov.), branches nues (1er déc. – 14 mars) — dates approximatives, choix de style ; parcs : variantes Automne / Dead du pack Quaternius (pins inchangés) ; arbres des rues : couronnes orangées ou petites couronnes nues. Saison choisie = date typique (20 avril, 15 juillet, 28 octobre, 15 janvier) |
| Fenêtres éclairées la nuit | ✅ | Grille de fenêtres calculée dans le shader (pas de modèle), 15 % à 35 % allumées selon l'heure |
| Lueur des rues la nuit | ✅ | Rues, chemins et places légèrement éclairés |
| Bars mis en avant la nuit | ✅ | Épingles lumineuses + halo : fort pour bars/clubs, moyen pour restaurants, faible pour cafés. **Seuls les lieux ouverts à l'heure choisie s'allument** (horaires OSM `opening_hours` : 104 / 106 lus) ; horaires absents ou illisibles : lieu allumé. Fiche : « Ouvert / Fermé à cette heure / Horaires inconnus » |
| Effet maquette (tilt-shift) | ✅ | Bande nette sur le point visé, flou croissant en haut et en bas ; plus fort en vue d'ensemble, atténué de près ; étiquettes toujours nettes ; toujours actif (bouton retiré à l'itération 22) |

## Exploration / jeu

| Fonctionnalité | État | Détail |
|---|---|---|
| Écran initial et lobby de démarrage (EP004) | 🟡 | Itération 63 (US001 à US003, à valider) : un écran initial dans `index.html`, visible avant le code de l'appli ; puis le lobby, **tout de suite**, qui présente les lieux d'histoire, le mini-jeu des éléphants et les ambiances pendant que la ville charge (barre à étapes réelles) ; « Explorer la carte » s'active quand elle est prête ; la ville vivante tourne derrière un voile ; case « Ne plus afficher cet écran » ; bouton « ? » pour le rouvrir ; `?lobby=0` / `?lobby=1` ; textes dans `src/content/lobby.json` |
| Lieux d'histoire (✦) | 🟡 | 8 lieux ; position tirée d'OSM par le nom → **pas toujours précise**, à reprendre à la main |
| Lieux « mystère » à découvrir | ✅ | Nom caché tant que non découvert |
| Fiche d'histoire (période, récit, anecdote, sources) | ✅ | Textes à relire (Trivelli/Trivelly, « plus vaste ensemble de trompe-l'œil ») |
| Progression + journal d'exploration | ✅ | Sauvegarde dans le navigateur, bouton de remise à zéro |
| Vol de caméra vers un lieu | ✅ | |
| Déplacement sur mobile, comme une carte | ✅ | 1 doigt = déplacer ; 2 doigts = pincer pour zoomer, tourner, incliner ; double toucher = zoom vers le point touché ; souris inchangée |
| Boussole | ✅ | L'aiguille suit l'orientation ; un toucher remet le nord en haut (animation) |
| Zoom plus proche | ✅ | 70 m minimum (avant 120) ; caméra toujours ≥ 30 m au-dessus du sol |
| Bars / cafés / restaurants | ✅ | 169 lieux OSM, couche masquable ; épingle 3D colorée par catégorie (bar violet, café bleu, restaurant orange) posée sur le toit ; fiche au survol à côté de l'épingle (titre qui rebondit), épinglée au clic, au toucher sur mobile ; légende avec une case par catégorie pour afficher ou masquer bars, cafés et restaurants séparément |

## Interface / technique

| Fonctionnalité | État | Détail |
|---|---|---|
| Web desktop + mobile | ✅ | Fiche en tiroir bas sur mobile |
| Pipeline de données `npm run data` | ✅ | Overpass → projection → découpage → choix des toits → `public/data/city.json` (1,2 Mo, 360 Ko compressé) ; mode `--offline` |
| Cadence adaptée | ✅ | Itération 42 : 30 images/s quand rien ne bouge, pleine vitesse pendant les mouvements (caméra, souris, lecture ▶, mini-jeu) ; la résolution adaptative ne mesure que les images en mouvement ; mode affiché par `?debug` |
| Code découpé (appli / three.js) | ✅ | Itération 43 : three.js dans son propre fichier (171,6 Ko gzip), l'appli à part (44,5 Ko gzip) ; une mise à jour ne retélécharge que l'appli |
| Attribution OSM (ODbL) | ✅ | |
| Déploiement | ⬜ | Cible : Coolify sur le Pi |

## Outils de développement (`npm run dev` uniquement)

| Fonctionnalité | État | Détail |
|---|---|---|
| Outil de placement des lieux | ✅ | Touche **P** ou bouton 📍 : clic sur la carte → `pos` et GPS à copier ; affecter à un lieu (aperçu immédiat de la gemme) ; enregistrement direct dans `pois.json` ; création d'un nouveau lieu en brouillon |
| Lieux brouillons (`draft: true`) | ✅ | Visibles en dev, masqués dans le build de production |
