# Analyse 4 : les dix monuments demandés, et le rendu des routes

Auteur : Claude (analyse + une correction de données, voir le § 1). Date : 06/10/2026. « Mesuré » = lu dans `data/raw/overpass.json` (OpenStreetMap du 28/09/2026) et `public/data/city.json` ; « à confirmer » = je n'ai pas l'information.

## 1. Une découverte avant de modéliser : trois bâtiments manquaient

En cherchant tes monuments dans les données, j'ai trouvé que **le Musée des Beaux-Arts, le Palais de justice et l'Hôtel des douanes n'étaient pas dessinés du tout** : le script ignorait tout bâtiment portant une étiquette `building:part`, même `building:part=no` (qui veut dire « bâtiment ordinaire »), et le Palais de justice n'existe dans OSM que comme « partie de bâtiment ».
Corrigé dans `scripts/fetch-osm.mjs` (branche `fix/batiments-building-part`) : `building:part=no` est un bâtiment ; une partie de bâtiment est dessinée seulement si aucun bâtiment ordinaire ne la recouvre et si elle dépasse 2 m (on ignore les socles et marches). Résultat : **+5 bâtiments** (2 067 → 2 072) avec les hauteurs IGN : Musée des Beaux-Arts 21,4 m ; Hôtel des douanes 17,7 m (monument historique) ; Palais de justice 27 m, toit à quatre pans (monument historique) ; deux petites ailes (8,7 m et 5 m). Vérifié dans Chrome : le Palais de justice apparaît avec sa cour ; l'avatar trouve toujours son chemin ; aucune erreur console.

## 2. Les dix monuments : où en sont-ils dans les données ?

Positions en mètres du diorama (x est, y nord ; l'emprise va de −662 à +662 en x, −583 à +583 en y).

| # | Monument | Dans l'emprise ? | Ce qu'OSM contient (mesuré) | État dans le diorama | Niveau proposé (§ 3) |
|---|---|---|---|---|---|
| 1 | Rotonde ferroviaire SNCF | **Non** (au nord de la gare, hors socle) | rien dans l'extrait | absente | Étendre l'emprise vers le nord, puis niveau 3 |
| 2 | Musée des Beaux-Arts | Oui (−61, 267) | bâtiment de 819 m², `wikidata` ; fiche musée (horaires, site) | **était absent**, maintenant un volume de 21,4 m | Niveau 2 |
| 3 | Église Notre-Dame du Rosaire | **À confirmer** | aucun objet portant ce nom ; « Église Notre-Dame de Chambéry » existe | — | À localiser avec toi |
| 4 | Place Saint-Léger | Oui (15, −93) | place de 4 595 m² (déjà un lieu d'histoire du jeu) | un aplat de place | Niveau « place » |
| 5 | Statue de la Sasson | Oui (40, 270) | nœud « statue », 1892, `wikipedia` et `wikidata` | absente | Niveau « statue » |
| 6 | Palais de justice | Oui (−153, 314) | relation (partie de bâtiment) : 5 étages, toit à quatre pans, monument historique inscrit (1984), `wikidata` | **était absent**, maintenant un volume de 27 m | Niveau 2, ou 3 pour la façade |
| 7 | Chapelle Vaugelas | Oui (−196, 145) | église de 488 m², `heritage`, `wikidata` | volume générique de 15,6 m | Niveau 2 |
| 8 | Nouvelle gare de Chambéry | **En bordure** : centre à y = 611, socle jusqu'à 583 | bâtiment « gare » de 4 753 m², 3 niveaux, toit « multiple » ; rognée par le bord | un bout de volume | Étendre l'emprise, puis niveau 3 |
| 9 | Fontaine du Cœur Flambant | **À confirmer** | aucun objet trouvé ; la « Rotonde de l'Imprimerie » (22 m², fontaine) à (405, 91) est autre chose | — | À localiser avec toi |
| 10 | Statue d'Antoine Favre | Oui (−98, 276) | nœud « statue », sans `wikipedia` | absente | Niveau « statue » |

Remarques : la gare et la rotonde obligent à **agrandir l'emprise vers le nord** (de l'ordre de 200 à 300 m ; coût : quelques centaines de bâtiments en plus, à mesurer). Les lieux 3 et 9 : **dis-moi où ils sont** (une rue ou un point sur la carte) ou fournis un lien Wikipédia ; je ne les place pas sans source (règle du projet : rien d'inventé).

## 3. Comment les modéliser : quatre niveaux

| Niveau | Principe | Pour quoi | Coût de fabrication | Coût de rendu |
|---|---|---|---|---|
| **1. Extrusion automatique** | contour OSM, hauteur IGN, toit en pente : ce qu'on a | 95 % des bâtiments | 0 | 0 appel de plus |
| **2. Kit de formes paramétrées** | un monument = quelques pièces (corps, ailes, tours, clocher, flèche, fronton, corniche, cour) assemblées d'après le **contour OSM** et des paramètres (hauteurs, pentes, couleurs) | musée, palais de justice, chapelle, mairie, églises | **S à M** par monument une fois le kit écrit ; le kit sert à d'autres villes | un seul maillage fusionné pour tous : **+1 appel** |
| **3. Modèle dessiné** | modélisation à la main (Blender) en formes simples, ou génération à partir de photos par un outil d'IA puis simplification ; couleurs dans les sommets, pas de texture ; ≤ 3 000 triangles | gare, rotonde (silhouette très particulière), façades remarquables | **M à L** par monument | fusionné avec le niveau 2 |
| **4. Statue / mobilier** | piédestal en blocs + figure simplifiée (≈ 300 à 800 triangles) | les deux statues, la fontaine | **S** par pièce | un maillage unique pour toutes les statues |
Plafond de rendu : **tous les monuments ajoutés sont fusionnés dans un seul maillage** « monuments » (+1 appel de rendu au total, ≈ +30 000 triangles pour dix monuments, soit +2 %) : les monuments non fusionnés actuels sont déjà la cause des 2 406 appels en vue d'ensemble, on n'en ajoute pas.

Dans tous les cas : le bâtiment d'origine est retiré (`hideOsm` dans `src/content/models.json`), le monument est posé par l'outil de placement, la fiche reste sourcée.

### Estimation (sessions d'une demi-journée)
- **Kit de formes** (corps, ailes, toit à 4 pans, tour, fronton, corniche, cour intérieure) : 2 à 3 ; puis **musée, palais de justice, chapelle : 0,5 à 1 chacun** (3 monuments : 1,5 à 3).
- **Statues** (kit + 2 statues) : 1 à 1,5.
- **Place Saint-Léger** (pavage, arbres, mobilier, marches) : 1.
- **Gare + rotonde** (agrandir l'emprise 0,5 ; deux modèles dessinés 2 à 3) : 2,5 à 3,5.
- **Rosaire et Cœur Flambant** : 1 à 1,5 une fois localisés.
Total : **9 à 13 sessions** pour les dix, dont **5 à 7 pour tout ce qui est déjà dans l'emprise** (musée, palais, chapelle, statues, place).

## 4. Les routes : piétonnes ou non

Les données (mesuré, `city.json`) : 1 823 tronçons ; **piétons ou doux** : 748 « footway », 120 « pedestrian », 111 « steps » (escaliers), 37 « path », 34 « living_street », 51 « cycleway » ; **voitures** : 141 « residential », 110 « primary », 94 « secondary », 51 « tertiary », 40 « unclassified » ; 284 « service ». Soit **56 % des points** des tracés sont des voies piétonnes ou douces (4 572 sur 8 173). Aujourd'hui elles sont dessinées en **deux couleurs** (« chemin clair » pour les piétons, « rue » crème pour les voitures) avec la même forme de ruban.
Pistes (le détail se règle à l'œil) :
1. **Matières différentes, presque gratuites** : voies piétonnes en pavé chaud avec petit motif, voies pour voitures en gris asphalte plus sombre avec une ligne axiale en tirets, rues à sens unique et zones 30 en nuances ; par couleur de sommet et petit motif de shader sur les rubans (pas de géométrie de plus).
2. **Bordures et trottoirs** : un liseré clair le long des rues pour voitures (un ruban de plus : +1 appel, quelques milliers de triangles).
3. **Passages piétons et obstacles** (bornes aux entrées de zones piétonnes, escaliers plus lisibles) : à la main sur quelques endroits.
4. **Cohérence avec la balade** : les voies piétonnes sont celles où l'avatar est le plus à l'aise ; une couleur plus nette aide à lire où l'on peut marcher.
Coût : piste 1 : 0,5 à 1 session, ≈ 0 en rendu ; piste 2 : +0,5 session, +1 appel ; pistes 3 et 4 : à discuter.

## 5. Questions pour Dasco
1. **Notre-Dame du Rosaire et Cœur Flambant** : où sont-ils (adresse, rue, ou lien) ?
2. **Agrandir l'emprise vers le nord** pour la gare et la rotonde (+ quelques centaines de bâtiments, un peu plus de chargement) : oui ?
3. **Niveau de finesse** : un kit de formes qui donne un monument reconnaissable (niveau 2) te suffit pour le musée, le palais et la chapelle, ou tu veux des modèles dessinés pour tous ?
4. **Les statues** : j'ai besoin d'une photo ou d'un lien de référence pour chacune (je ne dessine pas à partir d'un souvenir).
5. **Routes** : on commence par les matières piétonnes / voitures (piste 1) ?
