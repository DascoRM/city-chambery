# Audit de fluidité — 29/09/2026

Passe sur tout le projet pour trouver ce qui coûte à chaque image. Les tickets qui en découlent
sont dans [BACKLOG.md](BACKLOG.md), section **P1 — Fluidité**.

## Méthode et limites

- Mesures faites dans le navigateur de test de Claude : Chromium avec un rendu WebGL **logiciel**
  (sur le processeur, sans carte graphique), fenêtre 1300 × 850, densité de pixels 1.
- **Les comptes sont exacts** : appels de rendu, triangles, objets, poids des fichiers. Ils ne
  dépendent pas de la machine.
- **Les temps ne sont pas représentatifs** : environ 5 s par image en rendu logiciel. Aucune mesure
  n'a été faite sur un vrai téléphone ni sur une vraie carte graphique. D'où le premier ticket :
  un compteur d'images par seconde pour mesurer chez toi.

## Ce que coûte une image aujourd'hui (vue d'ensemble, de jour)

| Couche | Objets dessinés | Appels de rendu | Triangles | Projettent une ombre |
|---|---|---|---|---|
| Ville (sol, rues, eau, bâtiments, arbres simples) | 12 | 12 | 392 000 | 3 |
| Arbres modélisés (pack Quaternius) | 18 | 18 | **1 972 000** | 18 |
| Monuments (fontaine, cathédrale, château, Carré Curial) | **2 338** | **2 340** | 42 500 | **2 334** |
| Gemmes des lieux d'histoire | 32 | 32 | 900 | 8 |
| Épingles bars / cafés / restaurants | 1 | 1 | 48 000 | 1 |
| **Total** | | **≈ 2 400** | **≈ 2,45 M** | 2 364 appels · 2,29 M triangles |

Détail des monuments : Carré Curial **1 683** appels (chaque fenêtre, pierre de soubassement et bloc
de corniche est un objet séparé), château **561**, fontaine 54, cathédrale 42.

Chaque image passe **deux fois** sur tout ce qui projette une ombre : une fois pour la carte des
ombres, une fois pour l'image. Soit au total **≈ 4 800 appels de rendu et ≈ 4,7 M triangles par
image**, 60 fois par seconde, même quand rien ne bouge.

## Suivi

| Constat | État |
|---|---|
| 1. Monuments en trop d'objets | ⏸ en attente (monuments gardés tels quels pour l'instant) |
| 2. Ombres à chaque image | ✅ itération 25 : `shadowMap.autoUpdate = false`, recalcul quand le soleil bouge ; gemmes et épingles sans ombre |
| 3. Arbres modélisés | 🟡 itération 25 : simplifiés à 50 % (1,97 M → 0,99 M triangles) ; découpage par quartier à faire |
| 4. Anticrénelage en double | ✅ itération 25 : `antialias: false` sur le renderer |
| 5. Effet maquette sur mobile | ⬜ moins gourmand ou inactif, à trancher |
| 6. Rendu continu à l'arrêt | ⬜ |
| 7. Chargement | ⬜ P3 |

Estimation par image, la plupart du temps (hors changement d'heure) : ≈ 2 400 appels de rendu et
≈ 1,5 M triangles, contre ≈ 4 800 et ≈ 4,7 M avant. Ce sont des comptes, pas des mesures de vitesse.

## Constats, du plus rentable au moins rentable

1. **Monuments : trop d'objets séparés.** 2 340 appels de rendu pour 42 000 triangles. Le coût vient
   du nombre d'appels (processeur), pas de la géométrie. En fusionnant la géométrie de chaque
   monument par matériau, on passerait à environ 30 appels (environ 60 avec les ombres, contre
   4 670). C'est le plus gros gain, sans aucun changement visuel.
2. **Ombres recalculées à chaque image.** `renderer.shadowMap` se met à jour à chaque image, alors
   que le soleil ne bouge que quand on touche au curseur d'heure ou pendant la lecture ▶. Avec
   `shadowMap.autoUpdate = false` et une mise à jour seulement quand le soleil bouge, la moitié du
   travail disparaît la plupart du temps : 2 364 appels et 2,29 M triangles par image.
   Conséquence : les gemmes qui flottent et l'épingle qui rebondit auraient une ombre figée.
   Solution simple : ces petits objets ne projettent plus d'ombre.
3. **Arbres modélisés : 80 % des triangles.** 927 arbres de 1 000 à 3 000 triangles chacun
   (CommonTree_2 : 169 instances × 2 952 triangles = 499 000). Pistes :
   - simplifier les modèles à la conversion (`simplify` de glTF-Transform / meshoptimizer, environ
     −50 %) ;
   - version simple au loin (niveaux de détail) ;
   - découper les instances par quartier pour que les arbres hors écran ne soient pas dessinés.
     Aujourd'hui, un seul maillage par modèle couvre toute la carte, donc rien n'est jamais écarté.
4. **Anticrénelage payé deux fois.** Le renderer est créé avec `antialias: true`, mais l'image passe
   par l'effet maquette, qui fait déjà son propre anticrénelage (cible de rendu avec `samples: 4`).
   L'anticrénelage du renderer ne sert qu'à la dernière copie à l'écran : `antialias: false` ne
   change rien à l'image et économise de la mémoire vidéo.
5. **Effet maquette permanent, en pleine résolution.** Rendu en demi-flottant avec anticrénelage ×4,
   deux passes de flou de 9 lectures de texture par pixel, puis les étiquettes et la sortie. Sur un
   téléphone à densité 2 (2 fois plus de pixels en largeur et en hauteur, soit 4 fois plus de pixels
   à calculer), c'est surtout la quantité de pixels qui coûte. Pistes :
   - flou calculé en demi-résolution ;
   - `samples: 2` sur mobile ;
   - densité de pixels plafonnée à 1,5 sur mobile, ou baissée pendant les mouvements de caméra.
6. **Rendu continu même à l'arrêt.** La boucle dessine 60 images par seconde en permanence :
   gemmes qui flottent, eau animée. Piste : dessiner à pleine vitesse pendant les mouvements, puis
   environ 20 à 30 images par seconde quand rien ne bouge. Gain surtout sur la batterie et la
   chauffe du téléphone.
7. **Chargement.** `city.json` pèse 1,4 Mo (406 Ko compressé en gzip), le code 757 Ko (199 Ko en
   gzip), plus 18 fichiers d'arbres (≈ 500 Ko au total, en parallèle). Acceptable pour un POC.
   Pistes :
   - vérifier que le serveur (Coolify) compresse bien en gzip ou brotli ;
   - regrouper les 18 arbres en un seul fichier ;
   - coordonnées de `city.json` en binaire.

## Ce qui est déjà bien

- Bâtiments fusionnés en un seul maillage, arbres simples et arbres modélisés instanciés, épingles
  instanciées (1 appel de rendu pour 169 lieux).
- Le survol ne teste la souris que quand elle bouge (`hoverQueued`), sur des zones de clic simples.
- La géométrie de la ville est construite une seule fois au chargement ; la décision des toits est
  faite dans le script de données.
- Code de l'application raisonnable (199 Ko en gzip), sans la librairie du squelette droit.
