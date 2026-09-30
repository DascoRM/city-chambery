# Fonctionnalités

État au 30/09/2026 — itération 35.

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
| Mascottes : éléphants qui se promènent | ✅ | Itération 33 (1 éléphant), 35 (4 éléphants, réseau partagé). Marche uniquement sur les voies OSM (graphe des rues et chemins ; sans escaliers, passages sous bâtiment, trottoirs collés aux façades, abords de la fontaine), part de la fontaine des Éléphants et reste dans un rayon d'≈ 380 m ; va plutôt tout droit et préfère les rues piétonnes ; pauses de 4 à 8 s ; pattes, trompe, oreilles et queue animées dans le shader ; ombre en tache ; 4,5 m de haut ; modèle « Elephant » de jeremy (Poly Pizza, CC BY 3.0, crédité en bas à droite) ; `mascot.json`, `npm run mascot` |
| Mini-jeu « Ramène les éléphants à la fontaine » | ✅ | Itération 35 (remplace « Attrape l'éléphant » de l'itération 34). Au départ la fontaine n'a plus ses 4 éléphants, qui se promènent dans les rues. Survolé ou touché, un éléphant disparaît dans un nuage, nargue dans une bulle avec un indice (rue OSM où il réapparaît, sinon la direction) et réapparaît 100 à 250 m plus loin ; après 1 à 5 fuites (au hasard) il réapparaît épuisé, assis, étoiles au-dessus de la tête ; un clic le ramène en vol à sa place, il se change en bronze, étincelles et feu d'artifice ; 10 points par éléphant, +20 fontaine complète (grand feu d'artifice) ; nouvelle partie 45 s après. Partie et points gardés dans le navigateur. Réglages : `mascot.json` → `game` |
| Cycle jour/nuit | ✅ | **Heure réelle de Chambéry par défaut** (bouton « Direct », relue chaque minute, quel que soit le fuseau de l'appareil) ; curseur d'heure (quitte le direct) + lecture (une journée en 2 min) ; **vraie course du soleil** (azimut et hauteur calculés pour la date : lever/coucher réels affichés, soleil bas l'hiver), crépuscule orangé, nuit bleutée avec lune, fond de page assorti |
| Saisons | ✅ | Puce Auto / Printemps / Été / Automne / Hiver ; auto = date du jour. Feuillage : vert, couleurs d'automne (15 oct. – 30 nov.), branches nues (1er déc. – 14 mars) — dates approximatives, choix de style ; parcs : variantes Automne / Dead du pack Quaternius (pins inchangés) ; arbres des rues : couronnes orangées ou petites couronnes nues. Saison choisie = date typique (20 avril, 15 juillet, 28 octobre, 15 janvier) |
| Fenêtres éclairées la nuit | ✅ | Grille de fenêtres calculée dans le shader (pas de modèle), 15 % à 35 % allumées selon l'heure |
| Lueur des rues la nuit | ✅ | Rues, chemins et places légèrement éclairés |
| Bars mis en avant la nuit | ✅ | Épingles lumineuses + halo : fort pour bars/clubs, moyen pour restaurants, faible pour cafés. **Seuls les lieux ouverts à l'heure choisie s'allument** (horaires OSM `opening_hours` : 104 / 106 lus) ; horaires absents ou illisibles : lieu allumé. Fiche : « Ouvert / Fermé à cette heure / Horaires inconnus » |
| Effet maquette (tilt-shift) | ✅ | Bande nette sur le point visé, flou croissant en haut et en bas ; plus fort en vue d'ensemble, atténué de près ; étiquettes toujours nettes ; toujours actif (bouton retiré à l'itération 22) |

## Exploration / jeu

| Fonctionnalité | État | Détail |
|---|---|---|
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
| Attribution OSM (ODbL) | ✅ | |
| Déploiement | ⬜ | Cible : Coolify sur le Pi |

## Outils de développement (`npm run dev` uniquement)

| Fonctionnalité | État | Détail |
|---|---|---|
| Outil de placement des lieux | ✅ | Touche **P** ou bouton 📍 : clic sur la carte → `pos` et GPS à copier ; affecter à un lieu (aperçu immédiat de la gemme) ; enregistrement direct dans `pois.json` ; création d'un nouveau lieu en brouillon |
| Lieux brouillons (`draft: true`) | ✅ | Visibles en dev, masqués dans le build de production |
