# Analyse 1 : combien coûte un rendu plus esthétique (shaders, textures) ?

Auteur : Claude (analyse + mesures jetables, aucun code de production modifié). Date : 06/10/2026. « Mesuré » = mesuré ce jour ; « estimé » = raisonnement, à confirmer sur ton iPhone.

## 1. Réponse courte

- **Sur le Mac, presque rien ne se voit** : toutes les variantes essayées (bruit de surface sur les façades, texture de sol ×4, bloom, étalonnage des couleurs) sont **dans le bruit de mesure** (±1 ms), parce que la machine est limitée par le **nombre d'appels de rendu** (2 406 en vue d'ensemble), pas par les calculs de pixels.
- **Sur l'iPhone, on ne sait pas encore** : le GPU d'un téléphone est bien plus limité en calcul de pixels (et en mémoire de textures). Tu m'as rapporté 55 à 60 images/s en usage normal après les derniers travaux, mais « ≤ 31 images/s en mouvement » à un moment, sans cause établie.
- **Ce qui coûte** : le plein écran (effets sur tous les pixels : bloom, ombres douces, occlusion ambiante), les textures grandes (mémoire), les calculs par pixel sur de grandes surfaces (bruit répété par fragment). **Ce qui ne coûte presque rien** : tout ce qui est **précalculé** (couleurs de sommet, occlusion ambiante cuite), les dégradés, l'étalonnage dans la passe finale déjà existante, les animations dans les sommets (vent des arbres, eau).
- **Recommandation** : un lot d'améliorations « presque gratuites » d'abord, puis mesurer sur iPhone (j'ai préparé la mesure : branche `exp/cout-rendu`, voir section 5) avant les effets plein écran, avec un réglage de qualité à trois niveaux.

## 2. Ce qu'est le rendu aujourd'hui (mesuré dans le code)

- Scène dessinée une fois dans une texture anticrénelée (×4 à densité 1, ×2 à partir de 1,5), puis **flou en demi-résolution** (2 passes) et **une passe finale** (mélange net / flou + tons + couleur) : l'effet maquette (`src/scene/tiltshift.ts`).
- **Résolution adaptative** : densité de pixels plafonnée à 1,5 ; baisse d'un cran sous 40 images/s, remonte au-dessus de 56 (`src/scene/quality.ts`). C'est déjà le garde-fou.
- Cadence au repos : 30 images/s ; pleine vitesse seulement quand quelque chose bouge.
- **Ombres statiques** (une carte de 2 048, recalculée seulement quand le soleil bouge).
- Bâtiments : **un seul maillage**, un matériau avec fenêtres calculées par pixel (grille de 3 m, éclairage de nuit par hachage).
- Sol : **une texture de 2 048 px peinte au chargement** (1,55 pixel par mètre), plus une 2ᵉ pour la lueur de nuit des parkings quand la couche est allumée.
- Appels de rendu par vue : 63 (rues) à 2 406 (vue d'ensemble) ; la vue d'ensemble coûte surtout ses monuments non fusionnés (analyse de l'itération 38).

## 3. Mesures (Mac, GPU réel via Chrome for Testing + Metal, mesure ms/image avec `gl.finish()` par image, caméra qui tourne, 2,5 s par essai)

Variantes (interrupteur `?xp=` de la branche d'expérience) : `fbm` = bruit de surface à 3 octaves par pixel sur les façades et toits ; `tex4k` = texture du sol 4 096 px au lieu de 2 048 ; `bloom` = deux passes de flou supplémentaires en demi-résolution (équivalent d'un halo) ; `grade` = vignettage + courbe + grain dans la passe finale.

| Vue | Écran | base | fbm | tex4k | bloom | grade | tout |
|---|---|---|---|---|---|---|---|
| Ensemble | 1280×800 (×1) | 9,2 | 13,9 | 10,1 | 10,8 | 10,9 | 12,5 |
| Ensemble | Téléphone 390×844, densité 1,5 | 8,9 | 8,6 | 8,8 | 8,7 | 8,5 | 8,9 |
| Rue (Boigne) | 1280×800 (×1) | 4,9 | 5,0 | 4,7 | 4,8 | 4,7 | 4,9 |
| Rue (Boigne) | Téléphone 390×844, densité 1,5 | 3,5 | 3,3 | 3,2 | 3,2 | 3,3 | 3,4 |
Lecture : **une seule mesure sort du bruit** (bruit de surface en vue d'ensemble sur grand écran : +4,7 ms, +50 %) ; toutes les autres variantes sont à ±1 ms de la base. Elles **ne mesurent pas un iPhone** : le GPU d'un Mac récent avale ces calculs. Chaque mesure est unique (pas de répétition) : l'ordre de grandeur est fiable, la précision non.

## 4. Les pistes esthétiques, classées par coût (estimé)

| Piste | Effet visuel | Coût GPU | Coût mémoire | Risque iPhone |
|---|---|---|---|---|
| **Occlusion ambiante cuite dans les couleurs de sommet** (pied de façade plus sombre, coins, rues étroites) | Profondeur, « maquette » plus matérielle | **≈ 0** (précalculé) | 0 | Aucun |
| **Étalonnage des couleurs** dans la passe finale (courbe, saturation douce, vignettage léger) | Ambiance, cohérence jour / nuit / saisons | **≈ 0** (une passe qui existe déjà) | 0 | Aucun |
| **Brume / dégradé atmosphérique** avec la distance et la hauteur | Profondeur de la vue d'ensemble | Très faible | 0 | Faible |
| **Eau améliorée** (reflets, rives plus lisibles) | Rivière plus vivante | Faible (petite surface) | 0 | Faible |
| **Vent dans les arbres** (déplacement des sommets) | Ville qui vit | Faible | 0 | Faible |
| **Variation des couleurs par bâtiment** (déjà en partie) et des toits (tuiles : motif par pixel simple) | Moins de monotonie | Faible | 0 | Faible |
| **Textures de façade** (atlas : crépi, pierre, volets) à la place de la couleur unie | Réalisme, charme | Moyen (une lecture de texture par pixel de façade) | 2 à 8 Mo selon la taille | **Moyen** |
| **Bruit de surface par pixel** (mon essai `fbm`) | Grain des murs | Moyen à élevé selon l'écran | 0 | **Moyen à fort** (seul coût visible dans mes mesures) |
| **Sol 4 096 px** | Rues, marquages et parkings plus nets de près | Faible | **+48 à +64 Mo** | **Fort** (mémoire du téléphone) |
| **Bloom / halo nocturne** | Fenêtres et lampes qui brillent | Moyen (plein écran, 2 à 4 passes) | 2 cibles de rendu | **Moyen à fort** |
| **Occlusion ambiante en espace écran (SSAO)** | Ombres de contact réalistes | **Élevé** | Cibles de rendu + profondeur | **Fort** : déconseillé |
| **Ombres douces dynamiques** | Ombres qui bougent | **Élevé** (recalcul de la carte d'ombres) | Cartes plus grandes | **Fort** : contraire au choix « ombres statiques » |
| **Réflexions sur l'eau en temps réel** | Réalisme | Élevé | Cible de rendu | Fort |

## 5. La mesure sur ton iPhone

La branche **`exp/cout-rendu`** (poussée, **ne pas fusionner**) ajoute un interrupteur d'adresse : `?debug&xp=fbm`, `xp=tex4k`, `xp=bloom`, `xp=grade` (combinables : `xp=fbm,bloom`). Avec `?debug`, le compteur montre images/s et densité ; compare chaque variante à `?debug` seul, **sur la même vue** (vue d'ensemble puis une rue), en mouvement. Si une variante coûte plus de 3 images/s, on l'écarte ou on la réserve à un niveau de qualité élevé.

## 6. Recommandation

1. **Lot « presque gratuit »** (environ 1 à 1,5 session) : occlusion ambiante cuite, étalonnage dans la passe finale, brume légère, vent des arbres, eau. Effet visible fort, coût ≈ 0, aucune mesure sur iPhone nécessaire en dehors d'un contrôle.
2. **Réglage de qualité à 3 niveaux** (Économe / Normal / Beau) : s'appuie sur la résolution adaptative existante ; « Beau » active ce qui coûte (textures de façade, halo de nuit) sur les appareils qui tiennent 55 images/s.
3. **Mesurer sur iPhone avant tout effet plein écran** (bloom, textures de façade) avec la branche d'expérience.
4. **Le meilleur gain de performance n'est pas un shader** : fusionner les monuments (2 406 → environ 700 appels en vue d'ensemble) libère plus de marge que n'importe quel réglage de pixels.
5. **Ne pas faire** : SSAO, ombres dynamiques, réflexions temps réel, sol 4 096 px sur mobile.

## 7. Limites de cette analyse
Mesures sur un seul Mac (GPU rapide), une seule exécution par variante, pas d'iPhone ; coûts du tableau 4 estimés ; la mémoire des textures (16 Mo pour le sol actuel, 21 Mo avec les niveaux de détail) est calculée, pas mesurée sur un téléphone.

## 8. Questions pour Dasco
1. **Quel effet te plairait le plus ?** (profondeur des rues, nuit plus magique, façades plus riches, eau, vent) : ça fixe l'ordre. *Défaut : profondeur + nuit.*
2. **Un réglage de qualité visible** (Économe / Normal / Beau) ou automatique seulement ? *Défaut : automatique, avec un interrupteur dans le lobby.*
3. **Tu peux tester `exp/cout-rendu` sur ton iPhone** (5 minutes) ? *Défaut : oui, avant toute décision sur le bloom et les textures.*
