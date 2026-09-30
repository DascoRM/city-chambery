# Audit rendu et mémoire — 30/09/2026 (itérations 30 à 37)

Suite de [PERF-AUDIT.md](../architecture/PERF-AUDIT.md) (29/09). Lecture du code seulement : aucun
navigateur lancé, aucune mesure. Three.js 0.186.1 (vérifié dans `node_modules`).

## Où en sont les constats du 29/09

| Constat PERF-AUDIT | État dans le code |
|---|---|
| 1. Monuments en trop d'objets | Inchangé (toujours ⏸) : un `Mesh` par pièce, `castShadow` partout (`models/elephants.ts:30`, `carrecurial.ts:39`, `chateau.ts:50`, `cathedrale.ts:70`). Reste le plus gros gain en appels de rendu, et il compte double pendant la lecture ▶ (carte des ombres à chaque image). |
| 2. Ombres à la demande | Toujours en place (`stage.ts:16`, `daynight.ts:84-87`). **Effet de bord nouveau :** voir constat B. |
| 6. Rendu continu à l'arrêt | **Toujours ⬜, et plus difficile qu'annoncé :** les 4 éléphants marchent en permanence (`main.ts:357`, `mascot.ts:543-640`), donc la scène ne s'arrête jamais. Un rendu « seulement quand ça bouge » n'est plus possible : il faut **limiter la cadence** au repos (plan 1). |
| Autres (3, 5, 7) | Pas de changement constaté. |

## Nouveaux constats

| # | Constat | Fichier:ligne | Gain | Effort | Risque visuel |
|---|---|---|---|---|---|
| A | Rendu à 60 img/s en permanence (constat 6), désormais avec 4 éléphants animés : ~16 appels de mascotte + toute la ville à chaque image, même quand personne ne touche à rien | `main.ts:345-371` | **Fort** (batterie, chauffe mobile) | M | Faible (éléphants à ~30 img/s au repos) |
| B | Les 4 éléphants de bronze de la fontaine projettent une ombre, mais leur apparition/disparition ne redemande pas la carte des ombres : ombre absente ou fantôme jusqu'au prochain déplacement du soleil (jamais en mode manuel) | `models/elephants.ts:30`, `hunt.ts:84,117,195` | — (bug) | S | Corrige un défaut |
| C | **Programmes de shader partagés à tort** : `uplight` / `glowAtNight` / `glowFlat` inscrivent des constantes (force, hauteur, sol) dans le code du shader via une fermeture, sans `customProgramCacheKey`. Three.js prend `onBeforeCompile.toString()` comme clé (`Material.js:544`) : deux matériaux de mêmes réglages partagent le premier programme compilé, avec **ses** constantes (ex. `iron` 1.6/0 vs `bronze` 0.6/3.2 ; façades 0.9 vs toits 0.35). Mécanisme vérifié dans three.js, rendu nocturne non vérifié à l'écran | `models/lighting.ts:10-37`, `models/elephants.ts:108-139` | Neutre (passer les constantes en uniformes garde 1 programme) | S | Change l'éclairage de nuit (probablement vers ce qui était voulu) |
| D | Lecture de mise en page forcée à chaque image : `getBoundingClientRect` + `offsetWidth/offsetHeight` après une écriture de style, quand la fiche d'un lieu ou la bulle d'éléphant est affichée | `main.ts:243`, `ui/ui.ts:197-198`, `hunt.ts:173` | Moyen (mobile) | S | Aucun |
| E | Épingle active : toute la matrice d'instances (169 × 16 flottants) renvoyée à la carte graphique à chaque image, même après la fin du rebond (`u = 1`) | `markers.ts:250-252,283-289` | Faible | S | Aucun |
| F | Particules : 4 attributs complets (jusqu'à 3 000 particules) renvoyés à chaque image tant qu'il en reste ; la couleur ne change pourtant qu'à l'émission. Petits tableaux créés à chaque particule morte | `particles.ts:119,133` | Faible | S | Aucun |
| G | Petites allocations par image : `heading()` clone un vecteur (`stage.ts:100`, appelé par `main.ts:367`) ; tableaux `[blurH, blurV, composite]` (`tiltshift.ts:140`) ; `new Vector2` dans `onBeforeRender` des particules (`particles.ts:85`) ; `new Vector3` pendant le vol d'un éléphant (`mascot.ts:596`) ; `hitTargets()` recrée un tableau à chaque survol (`main.ts:251`) | voir colonne | Faible (ramasse-miettes) | S | Aucun |
| H | Lecture ▶ : `dayNight.apply` à chaque image crée ~15 `Color`, parcourt les halos et cherche l'uniforme de lueur (`find`) | `daynight.ts:25-31,70-73,107-111` | Faible (seulement pendant ▶) | S | Aucun |
| I | Éléphants en `frustumCulled = false` : dessinés même hors écran (4 × 4 primitives, ~1 200 triangles chacun, vérifié dans le .glb) | `mascot.ts:411` | Faible | S | Aucun si la sphère englobante est élargie |
| J | Double toucher : lancer de rayon sur tout `city.group` (bâtiments fusionnés, sol) sans structure d'accélération ; coût non mesuré, ponctuel | `main.ts:284` | Faible | S | Aucun |
| K | Arbres simples remplacés par les arbres modélisés : gardés en instances d'échelle 0, toujours traités par le GPU (image + ombres) | `city.ts:319-323` | Faible | S | Aucun |
| L | Tache d'ombre : une texture canvas et un matériau par éléphant alors qu'ils sont identiques (les étoiles, elles, partagent bien leur texture) | `mascot.ts:299-318` | Négligeable (4 × 64²) | S | Aucun |

Fuites : **aucune trouvée**. Les éléphants ne sont jamais recréés (disparition = `visible = false`,
`mascot.ts:546`) ; les particules réutilisent des tampons fixes ; les feux d'artifice sont des objets JS
retirés de la liste (`particles.ts:174`) ; le changement de saison libère les anciennes instances
(`nature.ts:150`, géométries gardées en cache volontairement, `nature.ts:76`).

## Plans pour les 3 plus rentables

### 1. Cadence réduite au repos (A, constat 6)
1. Dans `main.ts`, calculer `busy` à chaque image : événement `change` des `OrbitControls` depuis
   moins de 0,5 s, vol ou rotation en cours (exposer `stage.isAnimating()` dans `stage.ts:111-124`),
   lecture ▶ (`clock` en mode `playing`), particules vivantes (`smoke.alive() + sparks.alive() > 0`),
   bulle ou statue en cours d'apparition (exposer `hunt.busy()`), épingle en rebond, `hoverQueued`,
   onglet de fiche ouvert qui suit la caméra.
2. Si `!busy`, ne dessiner (`tiltShift.render()`) que si 1/30 s s'est écoulé depuis le dernier rendu ;
   la simulation (troupeau, horloge) continue avec le `dt` cumulé.
3. **Indispensable :** n'appeler `quality.update(raw)` que sur les images `busy`, sinon
   `quality.ts:38` voit 30 img/s et baisse la densité de pixels à tort.
4. Fichiers : `main.ts`, `stage.ts`, `game/hunt.ts`, `scene/quality.ts` (commentaire).
5. Vérifier avec `?debug` : ~30 img/s au repos, 60 dès qu'on touche la caméra ; densité stable au repos ;
   éléphants et gemmes restent fluides à l'œil ; `npm run build`.

### 2. Supprimer la mise en page forcée (D)
1. Mettre en cache le rectangle du canevas (`renderer.domElement.getBoundingClientRect()`) au
   démarrage et sur `resize` (déjà écouté `main.ts:98`), le passer à `followPlace` et à `hunt`
   (option `canvasRect()`), au lieu de `main.ts:243` et `hunt.ts:173`.
2. Dans `ui.ts:195-198`, mémoriser `offsetWidth/offsetHeight` de la fiche à l'affichage
   (`showPlaceCard`) au lieu de les relire à chaque image ; ne pas réécrire `left/top/visibility`
   si la valeur arrondie n'a pas changé (même principe que `setHeading`, `ui.ts:327-330`).
3. Ne suivre la fiche que si la caméra a bougé (comparer `camera.matrixWorld` à la précédente).
4. Vérifier : outil Performance du navigateur, plus de « Forced reflow » avec fiche ouverte ; fiche
   et bulle suivent toujours la caméra, y compris après redimensionnement.

### 3. Uploads et allocations inutiles par image (E, F, G, H)
1. `markers.ts` : dans `animate`, arrêter d'appeler `place()` quand `u >= 1` après une dernière
   pose ; utiliser `instanceMatrix.addUpdateRange(i * 16, 16)` dans `place()`.
2. `particles.ts` : `needsUpdate` sur `aColor` seulement dans `emit` ; `addUpdateRange(0, n * k)` sur
   les autres ; remplacer la boucle `for…of [[pos,3],…]` par des copies directes ; vecteur réutilisé
   dans `onBeforeRender` ; ne rien marquer quand `n === 0`.
3. `stage.ts:100`, `tiltshift.ts:140`, `mascot.ts:596`, `main.ts:251` : vecteurs/tableaux créés
   une fois et réutilisés (le tableau des cibles de survol ne change qu'au filtrage des catégories).
4. `daynight.ts` : couleurs de travail pré-allouées, uniforme de lueur et liste des `Points` des
   halos cherchés une fois dans `createDayNight`.
5. Vérifier : onglet Memory, enregistrement d'allocations de 10 s au repos puis pendant ▶ et un feu
   d'artifice (courbe plate attendue) ; rendu identique.

### Hors classement mais à faire vite (bugs, effort S)
- **B** : `renderer.shadowMap.needsUpdate = true` quand une statue apparaît / disparaît (callback
  `onShadowChange` passé à `createHunt`), ou `castShadow = false` sur les 4 statues.
- **C** : passer `strength`, `refH`, `base` (et `statueBoost`, `color`, `k`) en uniformes au lieu de
  constantes dans le texte GLSL ; les shaders redeviennent identiques et partagent un programme
  à juste titre. Vérifier de nuit (curseur d'heure à 23 h) : toits moins éclairés que les façades,
  éléphants de bronze vs fonte.

## Ce qui est déjà bien
- Survol limité à une fois par image (`hoverQueued`, `main.ts:308-338`) ; zones de clic simples
  (boîtes, cylindres) pour les éléphants, gemmes et épingles ; matériaux invisibles non dessinés.
- Éléphants réutilisés (pas de création/destruction), un seul programme de marche grâce à
  `customProgramCacheKey = 'mascot-walk'` (`mascot.ts:420`), pas d'ombre projetée (tache à la place).
- Particules : tampons fixes, suppression par échange avec la dernière, `DynamicDrawUsage`,
  `visible = n > 0` (`particles.ts:134`), un appel de rendu par système.
- Graphe des rues et grilles spatiales calculés une fois au chargement (`mascot.ts:134-247`).
- Écritures DOM protégées par comparaison (`setHeading`, fond CSS `daynight.ts:116`, `setClock`).
- Ombres recalculées au plus une fois par minute en mode direct ; chaîne tilt-shift allégée.
