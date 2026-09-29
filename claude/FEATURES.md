# Fonctionnalités

État au 28/09/2026 — itération 15.

## Carte / diorama

| Fonctionnalité | État | Détail |
|---|---|---|
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
| Ombres portées, lumière d'après-midi | ✅ | |
| Monuments modélisés | 🟡 | Système prêt (formes en code ou fichiers glTF, config `src/content/models.json`) ; 1 monument en test : fontaine des Éléphants en formes simples (bassin de 13 m tiré d'OSM, 4 éléphants dos à dos avec jets d'eau, colonne, statue ; hauteur 17,65 m ; agrandie ×1,3) ; mise en lumière la nuit (éclairage par le bas, statue en projecteur, bassin bleuté, halo au sol) |
| Cathédrale Saint-François-de-Sales | 🟡 | Formes simples bâties sur le contour OSM réel : bas-côtés et chapelles, nef haute (≈ 25 m) à toit à deux pans et contreforts, abside, façade flamboyante simplifiée côté place Métropole (portail, grande baie, pinacles), clocher côté nord (position et hauteur supposées) ; éclairée la nuit, baies lumineuses |
| Château des ducs de Savoie | 🟡 | 7 bâtiments reconstruits sur leurs contours OSM : tours Trésorerie, demi-ronde et des Archives (cordon, meurtrières, toits pointus), Sainte-Chapelle (contreforts à pinacles, grandes baies), Porterie (mâchicoulis), aile du Midi et Conseil départemental (fenêtres, toits d'ardoise raides) ; hauteurs et toits supposés ; tour Yolande absente ; côté esplanade : mur bas et grille en fer, portail fermé sur l'allée, escalier de pierre (tracés OSM) ; éclairé la nuit |
| Carré Curial | 🟡 | Formes simples sur le contour OSM avec sa cour ; gouttière 16,7 m et toit 5,4 m (BD TOPO) ; toit à pans autour de la cour, soubassement, corniche, fenêtres régulières côté rue et côté cour ; éclairé la nuit ; médiathèque J.-J.-Rousseau accolée intégrée (mêmes matériaux, toit plat) ; étages et couleurs supposés |
| Cycle jour/nuit | ✅ | Curseur d'heure + lecture (une journée en 2 min) ; soleil qui tourne (lever 6 h, coucher 18 h, simplifié), crépuscule orangé, nuit bleutée avec lune, fond de page assorti ; 16 h par défaut |
| Fenêtres éclairées la nuit | ✅ | Grille de fenêtres calculée dans le shader (pas de modèle), 15 % à 35 % allumées selon l'heure |
| Lueur des rues la nuit | ✅ | Rues, chemins et places légèrement éclairés |
| Bars mis en avant la nuit | ✅ | Épingles lumineuses + halo : fort pour bars/clubs, moyen pour restaurants, faible pour cafés (sans tenir compte des horaires réels) |
| Effet maquette (tilt-shift) | ✅ | Bande nette sur le point visé, flou croissant en haut et en bas ; plus fort en vue d'ensemble, atténué de près ; étiquettes toujours nettes ; toujours actif (bouton retiré à l'itération 22) |

## Exploration / jeu

| Fonctionnalité | État | Détail |
|---|---|---|
| Lieux d'histoire (✦) | 🟡 | 8 lieux ; position tirée d'OSM par le nom → **pas toujours précise**, à reprendre à la main |
| Lieux « mystère » à découvrir | ✅ | Nom caché tant que non découvert |
| Fiche d'histoire (période, récit, anecdote, sources) | ✅ | Textes à relire (Trivelli/Trivelly, « plus vaste ensemble de trompe-l'œil ») |
| Progression + journal d'exploration | ✅ | Sauvegarde dans le navigateur, bouton de remise à zéro |
| Vol de caméra vers un lieu | ✅ | |
| Bars / cafés / restaurants | ✅ | 169 lieux OSM, couche masquable ; épingle 3D colorée par catégorie (bar violet, café bleu, restaurant orange) posée sur le toit ; fiche au survol à côté de l'épingle (titre qui rebondit), épinglée au clic, au toucher sur mobile ; légende avec une case par catégorie pour afficher ou masquer bars, cafés et restaurants séparément |

## Interface / technique

| Fonctionnalité | État | Détail |
|---|---|---|
| Web desktop + mobile | ✅ | Fiche en tiroir bas sur mobile |
| Pipeline de données `npm run data` | ✅ | Overpass → projection → découpage → choix des toits → `public/data/city.json` (1,2 Mo, 360 Ko compressé) ; mode `--offline` |
| Attribution OSM (ODbL) | ✅ | |
| Déploiement | ⬜ | Cible : Coolify sur le Pi |

## Outils de développement (`npm run dev` uniquement)

| Fonctionnalité | État | Détail |
|---|---|---|
| Outil de placement des lieux | ✅ | Touche **P** ou bouton 📍 : clic sur la carte → `pos` et GPS à copier ; affecter à un lieu (aperçu immédiat de la gemme) ; enregistrement direct dans `pois.json` ; création d'un nouveau lieu en brouillon |
| Lieux brouillons (`draft: true`) | ✅ | Visibles en dev, masqués dans le build de production |
