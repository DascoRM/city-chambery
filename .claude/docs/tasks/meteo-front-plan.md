# Plan front : météo en temps réel dans le diorama

Auteur : agent chercheur/planificateur front. Aucun code écrit. Lecture seule de `daynight.ts`, `seasons.ts`, `sun.ts`, `particles.ts`, `chimneys.ts`, `flags.ts`, `birds.ts`, `stage.ts`, `quality.ts`, `tiltshift.ts`, `palette.ts`, `main.ts` (boucle), PERF-AUDIT.

Honnêteté d'abord : **aucune des estimations de coût GPU ci-dessous n'est mesurée sur téléphone** (PERF-AUDIT : rien n'a été mesuré sur mobile ; le navigateur de test est en rendu logiciel). Les comptes (appels de rendu, particules) sont fiables ; les ms et img/s sont des ordres de grandeur à confirmer par un test sur 1 vrai téléphone milieu de gamme avant de valider le MVP (voir US-M0).

---

## 1. Ce qui existe et se réutilise

| Brique | Fichier | Réutilisation météo |
|---|---|---|
| Cycle jour/nuit à 3 keyframes (DAY/DUSK/NIGHT) interpolées : hémisphère, soleil, exposition, dégradé CSS du fond | `daynight.ts` `apply()` | Point d'insertion naturel : un « modificateur météo » (désaturation, baisse de `keyI`, teinte du ciel, exposition) appliqué après le calcul jour/nuit, avant d'écrire sur les lumières. `apply()` est déjà rappelée à chaque changement d'heure ; il faut aussi la rappeler quand la météo change (fondu) |
| `uNight` / `uLit` (fenêtres, halos, lueur des rues) | `city.ts` (`NightUniforms`) | La nuit pluvieuse garde les fenêtres ; de jour sous orage, on peut allumer quelques fenêtres en abaissant artificiellement la « luminosité » : un `uDark` = max(night, stormDarkness) suffit pour `uNight`. Attention : `uNight` pilote aussi les fenêtres de jour (reflet ciel) et les halos des bars, donc ne pas le détourner brutalement, ajouter un uniforme `uWet`/`uDarkness` à côté |
| Soleil réel, ombres avec `shadowMap.autoUpdate=false` | `sun.ts`, `stage.ts` | Ciel couvert : ombres douces/absentes. Plus simple et gratuit : baisser `sun.intensity` à ~0 et monter l'hémisphérique ; **on évite ainsi aussi de recalculer l'ombre** (laisser `castShadow` actif, juste intensité basse, ou `sun.castShadow=false` en couvert épais, ce qui économise le passage d'ombre : gain GPU réel de ~50 % des appels, cf. audit) |
| Saisons (`seasonOf`, `foliageOf`) et `SeasonChoice` (Auto/Printemps/…/Hiver) | `seasons.ts`, puce UI | La météo doit **se combiner** avec la saison, pas la remplacer : neige impossible en été, etc. (voir §3). Le choix manuel d'une saison force aussi la date ; la météo réelle ne correspond plus → règle de priorité à trancher (§4) |
| Système de particules (un `THREE.Points`, 1 appel de rendu, CPU, `emit` avec `drift` = vent) | `particles.ts` | Fumée, étincelles. **Insuffisant tel quel pour pluie/neige** (voir §2 : mise à jour CPU de milliers de points trop chère ; il faut un système GPU où la position est calculée dans le vertex shader depuis un temps). Réutilisable : le shader de sprites rond, le pattern `uScale`, la gestion de réserve |
| Vent déjà existant : `smoke.wind {towards, speed}` dans `life.json`, repris par les drapeaux (`flags.ts` : `windAngle`, `uStrength`) | `chimneys.ts`, `flags.ts` | **Excellente base** : le vent météo remplace simplement cette valeur fixe (30°, 0,7 m/s) par une valeur dynamique. Il faut juste exposer un objet `wind` mutable partagé (aujourd'hui copié à la construction : `drift` et `windAngle` sont calculés une fois ; à refactorer en lecture à chaque image ou à l'événement `onWeather`) |
| Fumée par saison (`density`) | `chimneys.ts` | La fumée suit déjà la saison ; météo = multiplicateur (froid/pluie : plus dense et qui retombe ; vent fort : couchée) |
| Oiseaux de jour (`uNight` fondu) | `birds.ts` | Masquer par pluie/orage/brouillard dense : un facteur d'opacité/d'activité |
| Passants (foule par heure `dayCurve`) | `people.ts` | Facteur météo sur la foule (pluie : −50 %, parapluies = hors MVP) |
| Tilt-shift : scène → cible MSAA → flou demi-résolution → passe finale (tonemapping + sortie) | `tiltshift.ts` | **Seul endroit où un traitement plein écran est « gratuit »** (la passe finale existe déjà) : voile de brouillard/couleur, vignette orage, flash d'éclair, gouttes sur « l'objectif », peuvent y être ajoutés par quelques uniformes et ~10 lignes de GLSL, sans passe supplémentaire (coût : ~0 ms de plus par pixel puisque la passe tourne déjà) |
| Boucle `Ticker.update(dt,t)` + `moving()` (30 img/s au repos, pleine vitesse sinon) | `types.ts`, `main.ts` | **Point critique** : la pluie/neige animée doit déclarer `moving()` = true pour être fluide, ce qui **annule le gain TI-02** (30 img/s au repos) ; ou accepter l'animation à 30 img/s (voir §2 et risques) |
| Mode debug `?debug` + `window.diorama` | `main.ts` | Hébergera le sélecteur « forcer la météo » |
| `prefers-reduced-motion` déjà lu pour l'autoRotate du lobby | `main.ts` ligne ~508 | Réutiliser pour couper les animations de précipitations |

À noter : **il n'y a pas de `scene.fog` aujourd'hui**, et le fond est un **dégradé CSS** derrière un canvas transparent (`alpha:true`, `setClearColor(0,0)`). Conséquence importante pour le brouillard (§2).

Le ciel n'existe pas en 3D (pas de skybox, pas de dôme) : les « nuages » devront être inventés ; la caméra regarde un socle depuis le dessus (polar max 1,22 rad ≈ 70°) donc on ne voit **jamais** le ciel, seulement le dessus de la maquette. Cela simplifie beaucoup (pas de ciel réaliste à produire) mais impose d'imaginer des nuages comme objets de maquette (voir ci-dessous).

---

## 2. Technique par météo (coût, effort, risques)

Hypothèses de budget (à confirmer, reprises du style de l'epic EP005 « au plus +N appels par rapport à la même vue ») : **+6 appels de rendu maximum au total** pour toute la couche météo, **0 passe plein écran supplémentaire**, **0 fichier 3D**, précipitations plafonnées par niveau de qualité.

Principe commun : **un module `weather.ts`** (état cible, état lissé, fondu de 4 à 8 s entre deux états) qui expose un `WeatherState` continu (pas des énumérations dures) :
`{ cloud: 0..1, rain: 0..1, snow: 0..1, fog: 0..1, storm: 0..1 (éclairs), wind: {towards, speed}, wetness: 0..1, snowCover: 0..1, temp }`. Chaque effet lit ce vecteur ; tous les uniformes sont partagés (un objet `uniforms` global), donc changer la météo = écrire quelques floats, **pas de recompilation de shader** (les variantes sont dans le shader, pilotées par uniformes, ou compilées une fois au chargement).

### 2.1 Soleil / ciel dégagé
- C'est l'état actuel. Rien à faire, sauf le multiplicateur de température de couleur selon la nébulosité.
- Coût : 0. Effort : inclus dans le socle (US-M1).

### 2.2 Nuageux / couvert
- **Éclairage (le gros du rendu, quasi gratuit)** : multiplier `keyI` par (1 − 0,75·cloud), monter `hemi` de ~+15 %, désaturer `sky/key` vers un gris-bleu, baisser légèrement l'exposition, dégradé de fond CSS plus gris. Ombres : `sun.shadow.radius` plus large impossible avec PCF (pas de softness paramétrable en `PCFShadowMap` standard), donc simplement faire disparaître l'ombre quand `cloud>0.8` (`sun.castShadow=false` ; attention à ne plus mettre à jour la shadow map : **gain GPU**).
- **Nuages visibles (optionnel)** : 8 à 14 « nuages de maquette » = blobs bas-poly (icosaèdres aplatis fusionnés, ~100 triangles chacun) en **un seul InstancedMesh** (1 appel), flottant à ~250-350 m au-dessus du socle, dérivant avec le vent, matériau mat blanc cassé/gris selon `cloud`. Ombres : **ne projettent pas d'ombre** (sinon on repaie une shadow map ; à la place, option : 3-4 taches d'ombre douces peintes au sol par un décal sombre = hors MVP).
  - Problème : des nuages entre la caméra et la ville **masquent la carte** (caméra à 400-3000 m selon le zoom). Solution : opacité qui diminue quand la caméra est proche/sous leur altitude, ou nuages placés seulement autour/au-delà du socle (halo périphérique) ; le plus sûr est de les mettre en **anneau autour du socle** et en fondu selon la distance caméra. À prototyper.
- Coût perf : lumière = 0 ; nuages = +1 appel, ~1-2 k triangles, négligeable. Risque de lisibilité : moyen.
- Effort : éclairage 1 j (dans US-M1) ; nuages 1,5 j (US-M5, hors MVP).

### 2.3 Pluie
Quatre morceaux, par ordre de valeur/coût :
1. **Ambiance** (gratuit) : même traitement que couvert + exposition −, fond plus gris. ~0 coût.
2. **Sol mouillé** (le plus « premium » pour le moins cher) : les matériaux `roadMaterial` et `windowsMaterial` ont déjà des `onBeforeCompile`. Ajouter un uniforme global `uWet` : baisse `roughness` (1 → ~0,35) et assombrit `diffuseColor` de ~12-20 % sur rues/places/toits ; les rues ont `roughness:1` donc aujourd'hui aucun reflet ; **sans envmap**, la baisse de roughness ne donne presque rien visuellement (le spéculaire ne reflète que le soleil directionnel et l'hémisphérique). Donc : assombrir + un peu de brillance, **pas de vrais reflets** (une `scene.environment` serait un coût non négligeable : texture cube/PMREM + MeshStandardMaterial évaluant l'IBL sur 2 000+ appels des monuments). Résultat honnête : « plus sombre et plus satiné », pas « flaques ». Lumières de nuit réfléchies au sol : possible de façon bricolée (rehausser l'emissive des rues de nuit quand `uWet`) : +0 appel. Coût : 0 appel, quelques ALU dans 2-3 shaders déjà patchés. Risque : il faut patcher les matériaux des toits et façades (aujourd'hui `MeshStandardMaterial` non patchés pour les toits : à vérifier dans `roofs.ts`/`city.ts`) ; chaque patch est une variante de shader à tester.
3. **Traînées de pluie** : un **THREE.LineSegments (ou Points étirés) GPU**, positions entièrement calculées dans le vertex shader : `pos = base + vec3(wind*t, -fallSpeed*t)` modulo la hauteur du volume ; un seul `BufferGeometry` statique (aucune mise à jour CPU), uniforme `uTime`. Volume = boîte autour du point regardé (`controls.target`), ~600 m de côté, hauteur 200 m, qui suit la cible (comme passants/oiseaux « près du point regardé »). Nombre de gouttes : desktop 6 000, mobile 2 500 (réglage par niveau de qualité) ; en 1 appel. Segments de 6-10 m (échelle maquette, sinon invisible), alpha 0,25-0,4, blending normal, `depthWrite:false`, **pas d'ombre**. Avec le tilt-shift, les traînées en haut/bas d'écran sont floues, ce qui rend bien.
   - Coût GPU : 6 k segments = 12 k sommets, trivial pour les sommets ; le coût vient du **fillrate** de 6 k lignes semi-transparentes (surface minuscule) : faible. Estimation : < 1 ms desktop, 1-2 ms mobile milieu de gamme (**non mesuré**).
   - **Coût caché majeur** : l'animation permanente. La boucle passe en pleine vitesse (60 img/s) si `moving()`, annulant TI-02 (30 img/s au repos, économie batterie). Option recommandée : la pluie **n'est pas** « moving » : elle s'anime à la cadence de 30 img/s du repos (c'est lisible : la pluie à 30 img/s passe bien), mais cela veut dire que **la boucle ne descend jamais sous 30 img/s tant qu'il pleut** (ce qui est déjà le cas aujourd'hui : « 30 images/s au repos : les éléphants marchent en permanence »). Donc impact incrémental sur la batterie faible, mais le GPU travaille plus par image (+ le sol mouillé).
4. **Gouttes d'impact / éclaboussures au sol** : hors MVP (cercles sur les rues = un second système instancié, 0,5-1 j, effet subtil à cette échelle de maquette).
5. **Gouttes sur l'écran/objectif** : un effet dans la passe finale du tilt-shift (bruit + distorsion UV) : beau mais **risque de rendre l'image illisible et de coûter des échantillons de texture supplémentaires** ; hors MVP, éventuellement en « complet ».

Effort pluie MVP (ambiance + sol mouillé + traînées GPU) : 3 j. Risque : moyen (portabilité des shaders, calibrage visuel à l'échelle maquette, interaction tilt-shift/flou).

### 2.4 Orage
- Pluie (§2.3) à intensité forte + vent fort + assombrissement fort (exposition −10 %, `keyI` ×0,2).
- **Éclairs** : (a) flash plein écran dans la passe finale du tilt-shift (un uniforme `uFlash` qui ajoute 0,3-0,9 de blanc-bleu, décroissance en 120-250 ms, 1 à 3 flashs doubles, intervalle aléatoire 6-20 s) = 0 coût GPU ; (b) en plus, sur la scène : `hemi.intensity` pulsée en synchro (10 lignes dans le module météo) ; (c) **éclair visible** (bolt) : un `THREE.Line` fractal régénéré à chaque éclair (≈ 40 segments), 1 appel pendant 150 ms, visible seulement quand la caméra est assez loin ; placer le bolt près du point regardé mais hors de lieux précis ; effet « waou », 1 j.
- Ombres : pas de recalcul pendant les flashs (ne pas toucher `sun.position`), sinon `shadowMap.needsUpdate` coûte. Les flashs ne passent que par `hemi`/passe finale.
- **Sécurité photosensibilité** : flashs plein écran = risque d'épilepsie photosensible (WCAG 2.3.1 : pas plus de 3 flashs par seconde et zones/contrastes limités). Prévoir : amplitude modérée, jamais >2 flashs en <1 s, et **désactivation totale du flash avec `prefers-reduced-motion`** et un réglage.
- Tonnerre : audio absent du projet (pas de son aujourd'hui) → hors scope ; un retour visuel seul suffit.
- Coût : +1 appel (bolt) ponctuel ; effort 2 j (flash + bolt + règles). Risque : moyen (photosensibilité, taste).

### 2.5 Neige
- **Flocons** : même système GPU que la pluie, avec points ronds (sprite) et chute lente 1-2 m/s modulée par du bruit sinusoïdal (vent latéral par flocon), taille 1-2,5 m (à l'échelle maquette). Desktop 4 000, mobile 1 500. 1 appel. Coût similaire à la pluie.
- **Sol enneigé** : un uniforme `uSnow` (0..1) dans les shaders patchés : sur tout ce dont la normale monde pointe vers le haut (`normal.y > 0.7` → toits plats ou en pente douce, sol, parcs, trottoirs, **canopées des arbres**), mélanger la couleur vers blanc-bleuté. Les bâtiments sont fusionnés en un maillage (`city.ts`), les toits en pente ont des normales avec une composante y : le shader peut faire `smoothstep(0.35, 0.75, worldNormal.y)` : toits à pente <50° neigeux, façades non. **Pas besoin de nouvelle géométrie, pas d'appel de rendu supplémentaire**, mais il faut patcher tous les matériaux concernés (rues, sol, toits/murs, arbres simples, arbres modélisés `MeshStandardMaterial` : leurs matériaux glTF sont partagés → un `onBeforeCompile` appliqué à chacun). **Estimation honnête : c'est le chantier de shader le plus long** (1,5 à 2,5 j) car ~8-10 matériaux différents ; centraliser dans un utilitaire `applyWeatherToMaterial(mat, kind)` qui injecte un chunk GLSL unique (`uWet`, `uSnow`) pour éviter la duplication.
- Accumulation progressive dans le temps (neige qui s'installe pendant les 30 premières minutes, fond ensuite sur plusieurs heures) : dépend du back/historique. Front : `snowCover` est une donnée d'entrée, pas calculée par le front.
- Neige + saison : le feuillage (« branches nues » 1 déc.–14 mars) se marie bien ; neige en pleine saison « vert » = contradiction → clamp : `snow` forcé à 0 si la température > 3 °C (voir données) ; sinon, on affiche **pluie** à la place. Le front applique la règle, le back fournit la température.
- Effort total neige (flocons + sol/toits/arbres) : 3 à 4 j. Risque : élevé sur la qualité visuelle (palette pastel du projet vs blanc, ne pas écraser les couleurs de façades ; modéré de neiger seulement sur le plan horizontal).

### 2.6 Brouillard
- **Problème technique central** : pas de `scene.fog` et fond CSS dégradé derrière un canvas transparent. `scene.fog` colore les fragments vers une couleur unie, mais le fond n'est pas cette couleur unie → **halo visible/discontinuité en bordure du socle**, surtout la nuit où le dégradé est sombre. Trois approches :
  1. `scene.fog = new THREE.FogExp2(couleur ≈ bord du dégradé, densité)` : le plus simple, **coût GPU quasi nul** (3 ALU par fragment dans les shaders standard, `fog_fragment`) ; il faut faire concorder la couleur avec le `bg[1]` du dégradé (déjà calculé dans `daynight.ts`), donc c'est facile à synchroniser. **Mais** : tous les matériaux `ShaderMaterial` maison (eau, particules, halos, fenêtres via `onBeforeCompile`, étiquettes) ne prennent le brouillard **que s'ils incluent les chunks fog** (`fog: true` + `#include <fog_pars_*>`) ; les `ShaderMaterial` des particules/oiseaux/flags/étiquettes sont à vérifier un à un. Les matériaux `onBeforeCompile` de `MeshStandardMaterial` gardent le fog (chunk standard) ; à vérifier pour la fenêtre (`windowsMaterial` modifie `totalEmissiveRadiance`, fog reste appliqué).
  2. **Brouillard « de hauteur »** (le plus joli : nappes de vallée sur la Leysse, le centre dans la brume le matin) : un dôme/plan translucide gradué autour du socle = +1 appel avec bruit animé, **coût de fillrate plein écran sur toute la surface couverte** (transparence sur de grandes surfaces = ce qui coûte le plus sur mobile). À éviter en MVP.
  3. Dans la passe finale du tilt-shift : mélange vers une couleur selon la profondeur → **nécessite une texture de profondeur** (`DepthTexture` sur la cible MSAA = resolve supplémentaire, coût non nul, et incompatibilité possible avec la cible `samples:4` demi-flottant). Pas recommandé.
  → **Recommandation : option 1 (FogExp2) + léger voile dans la passe finale** (baisse de contraste) ; l'apparence « maquette dans la brume » est parfaite pour l'esthétique tilt-shift. Calibrer la densité sur `controls.getDistance()` (la caméra est loin ; densité fixe = tout blanc en vue d'ensemble) : `fogDensity = f(distance caméra)`, à mettre à jour à chaque image (1 écriture).
- Coût : très faible. Effort : 1,5 j. Risque : moyen (cohérence fond CSS/brouillard, matériaux hors chunks fog, **mélange avec les étiquettes** dessinées après la passe).

### 2.7 Vent
- Vent = vecteur partagé `wind {towards, speed}` : **déjà consommé par fumée et drapeaux** (§1). Faire varier : direction réelle, vitesse réelle (échelle : m/s réels × facteur de lisibilité ; une brise de 2 m/s doit pencher la fumée visiblement, un 15 m/s doit coucher drapeaux/fumée, déchaîner les nuages).
- **Arbres qui bougent** : aujourd'hui arbres simples et modélisés = `InstancedMesh` avec matériaux standard sans animation. Ajouter un déplacement de sommet (balancement ∝ hauteur du sommet, phase par instance via `instanceMatrix` translation, amplitude ∝ vitesse) dans un `onBeforeCompile` (`<begin_vertex>`). Aucun appel supplémentaire, mais **coûte du vertex shader sur ~1 M de triangles d'arbres** (0,99 M après simplification, selon PERF-AUDIT) : coût mobile non négligeable et **les arbres sont déjà 80 % des triangles**. Solution : n'activer le balancement que pour les arbres simples (peu de triangles) et pour les arbres modélisés **seulement au-dessus de 5 m/s**, activé par `#define` / uniforme `uWind` avec branche dynamique, et ignoré en quality bas. Ombres : les ombres sont figées (autoUpdate false) → l'ombre des arbres ne bouge pas, acceptable (invisible).
  - Hiver : branches nues ont déjà une couronne différente ; le vent s'applique aussi.
- Surtout, **vent = particules** : feuilles/poussière qui volent (en automne, feuilles mortes) : réutiliser `createParticles` pour 50-150 particules CPU autour du point regardé (coût ok, +1 appel). Effet très visuel pour peu cher. Hors MVP.
- Nuages : dérivent selon le vent.
- Effort vent : 1 j pour dynamiser fumée/drapeaux/nuages (refactor `wind` mutable) ; 1,5 j pour arbres. Risque : arbres : perf mobile (à mesurer).

### Synthèse chiffrée

| Météo | Effet principal | Appels de rendu ajoutés | Coût GPU mobile (estimé, non mesuré) | Effort | Risque |
|---|---|---|---|---|---|
| Soleil | état actuel | 0 | 0 | 0 | — |
| Nuageux | lumière/ciel + (option) nuages instanciés | 0 (+1) | négligeable | 1 j (+1,5 j) | faible (moyen pour nuages) |
| Pluie | assombrissement, sol mouillé, traînées GPU | +1 | faible à moyen (~1-2 ms) | 3 j | moyen |
| Orage | pluie + flash passe finale + éclair | +1 ponctuel | idem pluie | 2 j (au-dessus de pluie) | moyen (photosensibilité) |
| Neige | flocons + sol/toits/arbres blancs | +1 | faible à moyen | 3-4 j | élevé (visuel, nombreux matériaux) |
| Brouillard | FogExp2 + voile final | 0 | quasi nul | 1,5 j | moyen (fond CSS, matériaux custom) |
| Vent | fumée/drapeaux dynamiques ; arbres ; feuilles | 0 (+1 feuilles) | arbres : à surveiller | 1 j (+1,5 j arbres, +1 j feuilles) | moyen (arbres) |

**Total effet visuel complet : ~17 à 21 jours de développement front**, hors tests sur appareils, UI, intégration données (voir §5).

---

## 3. Interactions avec le reste

### Jour/nuit
- Le modificateur météo s'applique **après** l'interpolation DAY/DUSK/NIGHT : `final = lerp(base, weatherTint, k)`. La nuit, le couvert est neutre (déjà sombre) mais le brouillard doit reprendre la couleur nocturne du fond (`bg[1]`), la neige est plus lumineuse (réflexion de la lueur des rues : `snowCover` relève un peu `ground`), la pluie rend les lumières plus « floues » : on peut augmenter l'emissive des rues et les halos des bars (`glowU`) de ~20 %.
- Les halos des bars sont des `Points` additifs : le brouillard doit les laisser percer (chunk fog sur ces `ShaderMaterial` à ne pas appliquer, ou atténuer moins) sinon ils disparaissent.
- Fenêtres : orage de jour → `uNight` ne doit pas monter (les fenêtres sont masquées de jour) ; ajouter un `uDarkness` qui amène un peu de lit à 20 % pendant un gros orage. Optionnel.
- Les ombres : couvert → pas d'ombres → la shadow map n'a plus besoin d'être mise à jour. Pendant les flashs : **ne pas toucher à la position du soleil**.
- Soleil réel : `MIN_LIGHT_ELEVATION` inchangé.

### Saisons
- La météo est **filtrée par la saison/température** : neige seulement si temp ≤ ~2 °C (sinon pluie), pas de gel/neige « en vert » ; en hiver la fumée de cheminée est déjà dense, avec froid + pluie → garder `density` saisonnier × multiplicateur météo.
- Conflit avec la puce Saison : si l'utilisateur choisit « Été » en plein hiver (météo réelle neigeuse), la scène serait incohérente. **Règle recommandée** : choix manuel de saison ou d'heure ≠ « Direct » ⇒ **la météo passe en mode « simulée »** (météo neutre « soleil » ou dernière météo typique de la saison), avec un petit indicateur « Météo en direct désactivée » + bouton pour revenir au direct. À valider avec Dasco (arbitrage produit).
- Feuillage d'automne/hiver : inchangé par la météo.

### Tilt-shift
- Les précipitations (alpha) sont dans la scène, donc **floutées par le tilt-shift** comme le reste, ce qui est un bonus (profondeur de champ naturelle de la pluie, jolie).
- Les ajouts à la **passe finale** : `uFog`, `uFlash`, `uDesat`, `uVignette` : 4 uniformes et ~8 lignes de GLSL ; aucune texture ni passe en plus.
- Les étiquettes (dessinées après, nettes) ne sont pas affectées par le brouillard : acceptable et même souhaitable (lisibilité).
- Attention à `alpha:true` + `transparent` + MSAA : les particules étant `depthWrite:false`, et la cible MSAA demi-flottant : le blending des particules est dans la cible, ok (c'est déjà le cas de la fumée).

### Résolution adaptative & niveaux de qualité
- Il n'existe **pas encore de « niveaux de qualité »** nommés (seulement `createAdaptiveResolution` : la densité de pixels 1 → 1,5 selon les img/s ; `mobileFactor` pour passants/oiseaux). Il faut en créer un petit : `qualityLevel` = `low | medium | high`, dérivé de `isMobile`/`pixelRatio`/`fps` (déjà mesurés), qui règle : nombre de gouttes/flocons (mobile ×0,4), balancement des arbres on/off, nuages on/off, éclair visible on/off. **À créer avant la météo** (US-M0), coût 0,5 j : c'est une dépendance de la météo.
- Dégradation automatique : si `quality.fps` descend <40 après la baisse de résolution maximale, **couper d'abord les précipitations** puis le sol mouillé/neige (pas l'éclairage, gratuit).

---

## 4. UI

- **Indicateur météo** : une puce à côté de la puce Saison (icône + température : « ☁️ 11 °C »), ouvre un petit panneau (conditions, vent, mise à jour il y a X min, « Direct » / « Simulée »). Sur mobile, une icône seule. Cohérent avec le bouton « Direct » de l'heure : **même vocabulaire** (Direct = heure réelle et météo réelle).
- **Préférences utilisateur** (localStorage, comme progression/points) : `weather: 'live' | 'off' | forced`, `weatherEffects: 'full' | 'light' | 'off'` (pour désactiver précipitations et éclairs seuls) et clé séparée du reste. « Off » = aucune requête météo, aucun module chargé (import dynamique : **chunk séparé**, comme `herd-debug`, pour ne pas alourdir le bundle de ceux qui ne l'utilisent pas ; le bundle three.js est déjà 171 Ko gzip).
- **Mode forcer une météo** pour démo/debug : `?debug` ajoute un sélecteur (soleil, nuageux, pluie légère/forte, orage, neige, brouillard, vent fort, + curseurs `rain/snow/fog/wind/cloud`) et `window.diorama.weather.set({...})`. Aussi `?weather=rain` utilisable en production pour démonstration à Dasco/les amis sans exposer le sélecteur. Impératif pour développer : sans ce mode, le dev dépendrait de la vraie météo du jour.
- **Réduit-mouvement** : `prefers-reduced-motion: reduce` ⇒ pas d'éclair, pas de flash, précipitations à vitesse ÷3 ou remplacées par une texture statique légère (ou off), pas de balancement d'arbres, nuages immobiles. Respecter aussi si l'utilisateur coupe « effets » dans la préférence.
- **Accessibilité** : l'indicateur a un texte alternatif (« Météo : pluie, 11 °C ») ; éclair soumis à la règle des 3 flashs/s ; contrastes de l'interface inchangés (le fond CSS devient plus gris : vérifier la lisibilité des boutons et de la fiche).
- **Hors-ligne** : l'indicateur affiche « Météo non disponible (hors ligne) » ou la dernière valeur avec l'âge ; la scène retombe sur « soleil » si l'âge > 3 h (voir §6).
- Le lobby (caméra qui tourne) est le premier écran vu : il doit refléter la météo réelle (effet « waou ») mais **sans retarder le chargement** : la météo arrive après (fetch non bloquant, fondu d'apparition), jamais devant l'écran de chargement.

---

## 5. Découpage en user stories (epic proposée « EP00X — Météo »)

Taille : S ≤ 1 j, M = 1,5 à 3 j, L = 3 à 5 j. Jours = développement + vérification navigateur en rendu logiciel ; **le test mobile réel n'est pas inclus** et reste à la charge de Dasco (ou de l'agent s'il y a un appareil).

| US | Titre | Taille | Jours | Contenu | Dépend de |
|---|---|---|---|---|---|
| M0 | Niveaux de qualité + spike perf | S | 1 | `qualityLevel` (low/med/high), prototype pluie GPU 3 000 segments avec compteur `?debug`, **mesure sur 1 téléphone réel** | — |
| M1 | Socle météo : état, fondu, modificateur d'éclairage, mode forcé | M | 3 | `weather.ts` (WeatherState, lissage), intégration `daynight.apply()`, vent partagé (refactor fumée/drapeaux), sélecteur `?debug`, `?weather=`, `window.diorama.weather`, couvert/soleil, réduit-mouvement | — |
| M2 | Données météo réelles (côté front) | M | 2 | client de l'API météo du back, mapping vers WeatherState (règles neige/température), rafraîchissement, cache localStorage, repli hors ligne, indicateur UI | back + M1 |
| M3 | Pluie | M | 3 | traînées GPU, sol mouillé (patch shaders rues/toits), fumée/foule/oiseaux modulés | M1, M0 |
| M4 | Brouillard | M | 1,5-2 | FogExp2 synchronisé au fond, densité selon la distance caméra, voile tilt-shift, vérification des matériaux custom | M1 |
| M5 | Neige | L | 3-4 | flocons, neige sur sol/toits/arbres (utilitaire de patch matériaux), règles de température | M1, M3 (utilitaire de patch partagé) |
| M6 | Orage | M | 2 | éclairs (flash final + hémisphérique), éclair visible, règles photosensibilité | M3 |
| M7 | Vent | M | 2,5 | arbres simples et modélisés qui bougent (avec seuil), feuilles volantes en automne, nuages et fumée couchés | M1, M0 |
| M8 | Nuages de maquette | M | 1,5 | InstancedMesh en anneau, fondu selon la caméra | M1 |
| M9 | Polish + ajustement performance | M | 2 | calibrage visuel, désactivation progressive selon le fps, tests écrans mobiles/Retina, docs de suivi | tout |

Total : **≈ 21 à 24 jours** (front seul), hors back.

### MVP proposé (≈ 9 à 11 jours front)
M0 + M1 + M2 + M3 (pluie) + M4 (brouillard) + soleil/couvert. Raison : ce sont les météos les plus fréquentes à Chambéry (pluie, brouillard, couvert) et les plus rentables (lumière gratuite, pluie en 1 appel, brouillard quasi gratuit). Neige = la plus chère et la plus risquée visuellement mais la plus « spectaculaire » en saison : **à planifier dès l'hiver si Dasco veut un effet démo**.
- **MVP minimal ultra-léger (≈ 4 j)** si on veut valider l'intérêt avant d'investir : M1 seul avec **uniquement couvert/soleil + brouillard** + indicateur + mode forcé, sans particules ni sol mouillé. Gratuit en perf, déjà perceptible (ambiance), aucun risque de performance.
- Complet : M5 à M9 ensuite.

---

## 6. Besoins côté back

- **Fournisseur** : au choix du back (Open-Meteo gratuit sans clé pour usage non commercial, Météo-France AROME/API, OpenWeather). Le front **ne doit pas appeler le fournisseur directement** : appel via le back (clé protégée, cache partagé, respect des limites, pas de fuite de la position utilisateur). Position fixe : centre de Chambéry (45,566 N ; 5,921 E ; les constantes sont déjà dans `src/time/chambery.ts`), pas de géolocalisation.
- **Format attendu** (un seul endpoint, petit JSON, cacheable ; exemple) :

```json
{
  "updatedAt": "2026-10-08T14:00:00Z",
  "validUntil": "2026-10-08T15:00:00Z",
  "current": {
    "code": "rain",              // clear | partly_cloudy | cloudy | fog | drizzle | rain | thunderstorm | snow | sleet
    "cloudCover": 0.85,          // 0..1
    "precipitation": 2.4,        // mm/h
    "snowfall": 0,               // cm/h
    "temperature": 9.5,          // °C
    "windSpeed": 5.2,            // m/s
    "windFrom": 220,             // degrés météo (d'où vient le vent)
    "gust": 11,                  // m/s
    "visibility": 4000,          // m
    "humidity": 0.9,
    "isDay": true
  },
  "hourly": [ /* 24 h à venir, même structure, pour le curseur d'heure et la lecture ▶ */ ],
  "snowDepth": 0                  // cm au sol (optionnel, pour l'accumulation)
}
```
  - Le front aura besoin du code **normalisé** (liste fermée ci-dessus) et des valeurs continues ; il calculera lui-même `WeatherState`. Un `code` WMO brut serait acceptable mais le mapping doit être documenté.
  - **Orage/éclairs** : un booléen/une probabilité `thunderstorm` suffit ; pas de position d'éclair réelle nécessaire.
  - `hourly` : sert au curseur d'heure : si l'utilisateur déplace l'heure dans la journée, la météo doit suivre (sinon incohérence « soleil » à minuit sous la pluie). Sans `hourly`, la météo reste celle du moment présent et passe en « simulée » dès qu'on quitte le Direct (règle de §3).
- **Fréquence** : mise à jour du back toutes les 15 à 30 min (les modèles ne changent pas plus vite) ; front : lecture au chargement puis toutes les 15 min si l'onglet est visible (pas de polling en arrière-plan ; arrêt sur `visibilitychange`), avec `Cache-Control` et `stale-while-revalidate`. Pas de websocket nécessaire.
- **Fallback hors-ligne / erreur** : (1) dernière réponse mise en cache dans `localStorage` avec son horodatage (valable ≤ 3 h) ; (2) au-delà : météo « neutre » (comportement actuel) + indicateur « non disponible » ; (3) le service worker PWA ne doit **pas** mettre l'endpoint météo en cache de précache : `NetworkFirst` avec timeout court (3 s) et repli cache ; (4) le diorama ne doit jamais attendre la météo pour démarrer (timeout 2-3 s, puis fondu quand elle arrive).
- **CORS / vie privée** : l'endpoint est de même origine que le site ou CORS autorisé. Pas de donnée personnelle.
- **Test et démo** : un endpoint/fichier de **fixtures** (une réponse par scénario : soleil, pluie, orage, neige, brouillard, vent fort) pour développer et tester le front sans attendre le vrai fournisseur ; idéalement `?weather=` côté front le couvre déjà.
- **Attributions** : la licence du fournisseur (ex. Open-Meteo CC BY 4.0, Météo-France Licence Ouverte) doit figurer dans le README (section Licences) et dans les crédits de l'app (règle absolue n°5 du projet).

---

## 7. Incertitudes et risques majeurs

1. **Performance mobile non mesurée** : aucune donnée téléphone. Le spike M0 en est la porte d'entrée ; on peut décider d'un budget (ex. « pluie ≤ 2 ms GPU, ≤ +1 appel ») avant d'engager M3+.
2. **TI-02 (30 img/s au repos)** : toute précipitation animée oblige à garder le rendu continu ; coût batterie/chauffe accru par temps de pluie/neige ; mitigation : cadence plafonnée à 30 img/s et coupure automatique après N minutes d'inactivité (arrêt de l'animation, image figée).
3. **Fond CSS dégradé vs brouillard** : seul le sync couleur fond/brouillard (option 1) est réaliste ; un brouillard de vallée « beau » est plus cher (fillrate) et reste hors périmètre.
4. **Patchs de shaders** : sol mouillé/neige touchent ~8-10 matériaux (`onBeforeCompile`), source de bugs de compilation silencieux ; centraliser un seul chunk GLSL et valider via `npm run build` + vérif navigateur de chaque vue.
5. **Cohérence visuelle** : palette pastel « maquette » ; une neige trop blanche ou une pluie trop sombre casse le charme. Prévoir une relecture de Dasco par météo (comme pour les itérations précédentes), donc itérations de réglage (déjà dans M9).
6. **Photosensibilité** des éclairs : règle et réglage de coupure obligatoires.
7. **Dérive vs. données** : un décalage entre météo réelle et ce que voit l'utilisateur (ex. il pleut dehors et soleil sur la carte à cause du cache) est un défaut de confiance ; l'indicateur affiche l'âge de la donnée.
8. **Bundle** : code météo (~15-25 Ko avant gzip, estimation) à charger en import dynamique ; ne pas dépasser +10 Ko gzip dans le chunk de l'appli.
9. **Pas de tests automatisés dans le projet** (CLAUDE.md) : vérification uniquement par build + navigateur ; le mode `?weather=` sert aussi de banc de test.
10. **Priorité produit** : la météo réelle dépend d'un back (EP008 en cours) ; le MVP « ambiance + mode forcé » est **livrable sans back** (utile pour démontrer à Dasco avant de s'engager).

---

## 8. Recommandation

1. Commencer par **M0 (spike qualité + mesure téléphone) + M1 (socle, couvert, mode forcé)** : ~4 j, aucun risque perf, démontrable en réunion avec `?weather=cloudy|fog` sans le back.
2. Décider ensuite, avec les mesures, de la pluie (M3) et du brouillard (M4) = MVP « réaliste ».
3. Neige/orage/vent/nuages en suite selon l'appétit et la saison.
4. Le back peut fournir l'endpoint pendant ce temps (M2 ne démarre que quand il existe, ou sur fixtures).
