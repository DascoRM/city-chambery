# Plan prêt à coder : EP009 — US009 (vent), US008 (orage), US010 (nuages), carte

Rédigé le 10/10/2026 par l'agent chercheur / planificateur front 3D. **Aucun fichier du dépôt modifié**, sauf ce plan.
Demande de Dasco : « Oui tu peux faire orage vent et nuages ». US011 (finitions) n'est pas demandée.
Point de départ : **`0916456`** (`feat/EP009-US012-meteo-admin`). Pendant ce travail, l'agent principal a fusionné la neige d'ambiance de
l'hiver dans l'epic (`feat/EP009-meteo` = **`6eace2f`**) : les mêmes trois commits sont donc fournis **deux fois**, sur `0916456` (demandé) et
reportés sur `6eace2f` (conflits résolus, voir section 9), tous vérifiés.
Sources : [US008](../specs/epics/EP009-meteo-en-direct/US008-orage.md), [US009](../specs/epics/EP009-meteo-en-direct/US009-vent.md),
[US010](../specs/epics/EP009-meteo-en-direct/US010-nuages-de-maquette.md), [l'epic](../specs/epics/EP009-meteo-en-direct/epic.md) (règles 1, 8, 9, 10,
12), [plan front v2](ep009-front-plan-v2.md) § 2.1, 2.5, 4.5 à 4.7 et 5, [le plan d'US007](ep009-us007-plan.md) (format, mesures).

Légende : **[mesuré]** = mesuré le 10/10/2026 sur le Mac (Apple M1, Chrome for Testing 145 sans fenêtre, ANGLE Metal, vraie puce
graphique, 1280 × 800, densité 1), **jamais sur un téléphone** ; **[vérifié]** = constaté dans une copie du dépôt (types, tests, build,
navigateur) ; **[estimé]** = non mesuré ; **[à l'œil]** = jugé sur les captures, à confirmer par Dasco.

---

## 0. En bref

- **Tout le code a été appliqué et vérifié dans des copies** (archives de `0916456` et de `6eace2f`) : 3 commits, un patch chacun ; après
  chacun, `tsc` carte, contrat et back, `check-boundaries`, Vitest (carte, contrat, outillage) et build de la carte passent ; à la fin,
  `npm run build` et `npm test` complets passent (section 9). **Carte : 87 → 103 tests** (88 → 104 sur `6eace2f`).
- **Ordre retenu : vent (US009), puis orage (US008), puis nuages (US010).** Le vent porte tout le risque pour le fichier principal (crochet
  du balancement posé au démarrage dans les arbres, fumée et drapeaux) : fait d'abord, il dit ce qui reste du plafond de poids ; il fait
  vivre l'objet vent partagé que lisent ensuite la pluie de l'orage et la dérive des nuages. L'orage ne coûte que 15 octets au fichier
  principal ; les nuages, rien (tout dans le module météo) : ils viennent en dernier, sans risque pour le plafond.
- **Vent** : le module météo écrit l'objet `wind` partagé (déjà créé dans `main.ts` par US002) ; la fumée le relit toutes les 0,5 s, les
  drapeaux à chaque image (direction, et force : claquent plus vite et plus fort). Arbres simples et arbres modélisés se balancent
  au-delà de 25 km/h (pleinement à 60), en qualité moyenne et haute, jamais en réduit-mouvement ; crochet de vertex shader posé au démarrage,
  inactif à 0 : **0 programme de plus au démarrage, 0 à l'arrivée du vent** [mesuré].
- **Orage** : planificateur pur (salves de 1 à 3 éclairs espacés d'au moins 0,4 s, donc **jamais plus de 3 par seconde**, 6 à 20 s entre
  deux salves, testé sur 1 000 salves et 4 h simulées à 30, 60 et 144 img/s) ; éclair = passe finale + lumière d'ambiance + ciel et fond
  de page, une seule impulsion de 120 à 250 ms ; **trait d'éclair** (ruban brisé de 32 segments, 1 appel pendant 150 ms, pas en qualité
  basse) dont le matériau a **le même programme que les anneaux des lieux d'histoire** (0 compilation) ; ciel plus noir que la pluie ;
  lumières de la ville allumées à 35 % sous l'orage de jour ; **aucun éclair ni trait** avec `prefers-reduced-motion` ou « Effets
  réduits » [mesuré] ; aucune carte d'ombres recalculée [mesuré].
- **Nuages** : 6 (moyenne) ou 12 (haute) « boules de coton » instanciées (1 appel, 1 petit programme à leur arrivée), autour du socle,
  jamais au-dessus de la ville, en nombre selon la couverture (aucun sous 20 %), qui dérivent avec le vent, s'effacent par tramage
  entre la caméra et le point regardé, au bord de leur boîte et dans le brouillard ; aucun en qualité basse, immobiles en réduit-mouvement.
- **Règle 9** : pires images 18 à 25 ms à l'arrivée de chaque effet [mesuré] ; programmes : vent 0 ; orage +1 (celui de la pluie, déjà
  compté par US005 ; 0 si la pluie est déjà venue), +1 de jour pour les halos des bars qui s'allument pour la première fois, 0 au premier
  trait ; nuages +1.
- **Coût par image : dans le bruit sur le Mac** (60 img/s en mouvement, 30 au repos, `high` et `medium`) [mesuré].
- **Poids** : fichier principal **+273 o** (86 908 → 87 181 o, zlib 6) ; Vite 88,19 → 88,49 ko (+0,30). Depuis `a9424e9` : **+2,95 Ko
  sur 3,5** par ma mesure (+3,02 avec votre compte) : il reste ≈ 0,5 Ko. Module météo 9,7 → **12,6 Ko** (section 8).
- **À trancher** : 3 vraies questions pour Dasco (section 11) ; 15 points de la spec à corriger (section 10) ; réglages à l'œil (section 7).

---

## 1. Avant de commencer

1. **Base** : `0916456` (demandé) ou, mieux, la tête de l'epic **`6eace2f`** (neige d'ambiance comprise) avec les patchs
   `patches/sur-6eace2f/` : mêmes commits, conflits déjà résolus dans `weather/effects.ts` et `weather/effects.test.ts` (section 9).
2. **Branches** (une par US, depuis `feat/EP009-meteo`, dans cet ordre) : `feat/EP009-US009-vent`, `feat/EP009-US008-orage`,
   `feat/EP009-US010-nuages`. US008 et US010 touchent les mêmes lignes de `weather/effects.ts` que US009 : chaque branche part de la
   précédente fusionnée.
3. Les patchs ne touchent que `frontend/carte/src` (ni contrat, ni back, ni `main.ts`, ni `vite.config.ts`).
4. Dans les copies de vérification, le proxy de Vite visait le port 8827 (aucune API : `/api/weather` → 502 → ciel par défaut) : **pas dans
   les patchs**. Tout ce qui est décrit ici a été vu avec `?weather=` et `window.diorama.weather.set()`.
5. **Règle de `check-boundaries`** : aucune variable ni fonction nommée `z` dans ce code (vérifié ; la règle passe à chaque commit).
6. `weather/index.ts` (où l'agent principal a ajouté `effects.setWinter`) n'est touché qu'à deux endroits : l'interface `WeatherCtx` (le
   champ `wind` passe dans `EffectsCtx`, où il est utilisé) et une ligne du modificateur du ciel (`effects.light(v)` au lieu de
   `v.glow = effects.glow()`). Aucun conflit avec la neige d'ambiance.

---

## 2. Commits

| # | US | Message | Fichiers |
|---|---|---|---|
| 1 | US009 | `feat(meteo): vent sur la carte : fumées et drapeaux suivent la météo, arbres qui se balancent au-delà de 25 km/h (EP009-US009)` | `scene/weather-surface.ts` + test, `scene/city.ts`, `scene/nature.ts`, `scene/chimneys.ts`, `scene/flags.ts`, `weather/effects.ts` + test, `weather/index.ts` |
| 2 | US008 | `feat(meteo): orage : éclairs (au plus 3 par seconde, aucun en réduit-mouvement), trait d'éclair, ciel noir et lumières de la ville (EP009-US008)` | `weather/lightning.ts` + test (nouveaux), `weather/effects.ts`, `weather/sky.ts` + test, `weather/index.ts`, `scene/daynight.ts` |
| 3 | US010 | `feat(meteo): nuages de maquette autour du socle, en nombre selon la couverture, qui dérivent avec le vent (EP009-US010)` | `weather/clouds.ts` + test (nouveaux), `weather/effects.ts` |
| 4 | — | `docs: itération N (EP009-US008 à US010 : vent, orage, nuages)` | FEATURES, CHANGELOG, DECISIONS, BACKLOG, epic.md, fiches US008 à US010, README (structure : `weather/lightning.ts`, `weather/clouds.ts`) |

Sans météo (ni `?weather=`, ni API), chaque commit laisse l'image identique : lumières, fond, drapeau, appels de rendu et nombre de programmes
égaux à `0916456`, à 12 h et à 22 h [vérifié].

---

## 3. Ce que fait le code

### 3.1 Vent (US009)
- **Objet partagé** : `main.ts` crée déjà `wind = { ...lifeContent.smoke.wind }` et le passe à la fumée et aux drapeaux (US002). Le module météo
  y écrit à chaque image la vitesse « de maquette » et la direction **lissées** (`cur.windSpeed`, `cur.windTowards` : fondu de τ = 6 s,
  plus court chemin pour l'angle, déjà dans `blendLook`). Par beau temps, la météo y remet exactement les valeurs de `life.json`.
- **Fumée** (`chimneys.ts`) : le vecteur de dérive est recalculé en place à la vérification de 0,5 s (avant : figé à la construction) ; les
  bouffées suivantes partent dans le nouveau vent, les anciennes gardent le leur.
- **Drapeaux** (`flags.ts`) : la rotation du tissu suit la direction à chaque image ; force relative au vent de beau temps
  (`w = min(4, vitesse / 0,7)`) : ondulation `× (0,5 + 0,5 w)` plus rapide, amplitude `× (0,8 + 0,2 w)` ; `w = 1` redonne exactement le
  drapeau d'avant.
- **Arbres** : `weatherSurface(mat, { sway: true })` (houppiers des arbres simples, `city.ts` ; arbres modélisés, `nature.ts`) ajoute un
  morceau de vertex shader après `begin_vertex` : déplacement dans le monde `direction × amplitude × hauteur² × (0,6 + 0,4 sin(t))`, phase
  propre à chaque arbre (position de l'instance), ramené dans le repère de l'instance (`transpose(mat3(instanceMatrix)) / échelle²`) :
  normales, ombres reçues et brouillard restent cohérents. Uniforme partagé `uSway` (amplitude, temps, direction) ; branche `if (uSway.x >
  0.0)` : rien par beau temps. Clé de programme `…|wet|sway`.
- **Amplitude** (`swayAmount`, pure) : 0 jusqu'à 25 km/h, `smoothstep` jusqu'à 60 km/h, 0,006 m par m² de hauteur (0,6 m en haut d'un arbre
  de 10 m) ; 0 en qualité basse et en réduit-mouvement ; lissée (τ = 2 s) pour ne jamais sauter.
- **Ombres** : la carte des ombres n'est pas recalculée (le balancement ne s'y voit pas : R4, accepté).

### 3.2 Orage (US008)
- **Planificateur** (`weather/lightning.ts`, pur) : `createLightning(rng).step(dt, actif)` → intensité du flash et éclair qui commence.
  Salves de 1 à 3 éclairs espacés de 0,4 à 0,9 s ; 6 à 20 s entre la fin d'une salve et la suivante ; première salve 2 à 6 s après
  l'arrivée de l'orage ; intensité 0,3 à 0,6 ; chaque éclair = **une impulsion** `amp × (1 − t/décroissance)²`, décroissance 120 à 250 ms
  (toujours plus courte que l'écart : jamais deux éclairs mêlés). Inactif (pas d'orage, ou réduit-mouvement) : flash à 0 tout de suite.
- **Éclair** (`weather/effects.ts`, `FLASH`) : passe finale `uFlash = 0,35 × intensité` (posé au démarrage par US002, rien à compiler) ;
  lumière d'ambiance `+0,9 × intensité` ; couleur du ciel et du fond de page vers un blanc bleuté (`0,5` et `0,35 × intensité`). La position
  du soleil ne change pas : **aucune carte d'ombres recalculée** [mesuré : 0 demande en 75 s]. Le modificateur du ciel est recalculé aux
  seules images d'éclair.
- **Trait** (`createBolt`) : 33 points par déplacement du point milieu, ruban face à la caméra (3 à 6 px environ), plus fin vers le pied,
  à peu près à la distance du point regardé (jusqu'à 15 % au-delà, dans le socle), du sol jusqu'au-dessus du haut de l'image ; 1 appel
  pendant 150 ms ; créé au premier trait ; absent en qualité basse. `MeshBasicMaterial` (couleur unie, additif, sans brouillard) avec une
  normale inutilisée : **même programme que les anneaux des gemmes** (`markers.ts`), compilé au démarrage. Sans cette normale, son
  programme différait : **+1 programme et 82 à 92 ms d'image figée au premier trait** (cache de shaders vide) [mesuré, puis corrigé].
- **Ciel** (`weather/sky.ts`, `STORM`) : de jour, ambiance −30 %, exposition −9 %, fond de page −36 % (plus noir qu'une pluie de 0,85) ;
  `lit = 0,35` : les lumières de la ville (fenêtres, halos des bars, lueur des rues) s'allument au moins à 35 % (CA 5, à juger).
  `daynight.ts` : `uNight = max(sv.lit, …)` (15 octets).
- La pluie forte vient du preset du contrat (`thunder` : pluie 0,85) et du système d'US005.

### 3.3 Nuages (US010)
- **Forme** : 7 icosaèdres (détail 1) fusionnés à la main, aplatis (× 0,6), fond écrasé ; facettes par `dFdx`/`dFdy` (comme le reste de la
  maquette). `InstancedMesh` de 6 ou 12 instances (`CLOUD_COUNT`), 1 appel ; `ShaderMaterial` éclairé à la main (haut clair, dessous
  ombré), couleurs jour, nuit, pluie ; ni brouillard ni ombre.
- **Place** : tirage reproductible dans une boîte autour du socle (demi-côté = socle + 0,5 × sa taille), à 180 m au moins du bord du
  socle, 130 à 260 m au-dessus du sol, 50 à 95 m de « rayon ».
- **Dans le shader, sans mise à jour de tampon** : dérive (`uDrift`, cumulée par le processeur : vent × 6 m/s par m/s) repliée dans la
  boîte ; fondu par tramage (pas de tri) = nombre visible (`cloudShare` : 0 sous 20 % de couverture, tous à 90 %, × (1 − brouillard/0,3))
  × hors de la ville (bord du socle + 0 à 180 m) × bord de la boîte (avant de revenir de l'autre côté) × pas plus près de la caméra que
  0,85 à 1,1 fois le point regardé.
- **Liseré** : opaques sur le fond de page transparent, ils avaient un liseré clair (couleurs prémultipliées, défaut connu d'US002). La
  correction de la passe finale (`uUnpremult`, jusqu'ici réservée au brouillard) est mise **aussi quand des nuages sont affichés** ; les halos
  des bars passent alors « par-dessus », comme dans le brouillard [vérifié, captures et `us010.txt`].

---

## 4. Code

#### Commit 1 (US009) — `feat(meteo): vent sur la carte : fumées et drapeaux suivent la météo, arbres qui se balancent au-delà de 25 km/h (EP009-US009)`

Patch : `/private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/7058533b-187f-4f4d-8d7b-9497ad542537/scratchpad/u8/patches/us009.patch` (sur `0916456`) ; même commit reporté sur `6eace2f` : `/private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/7058533b-187f-4f4d-8d7b-9497ad542537/scratchpad/u8/patches/sur-6eace2f/us009.patch`.

**`frontend/carte/src/scene/chimneys.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -91,8 +91,7 @@ export function buildChimneys(
   const group = new THREE.Group();
   group.name = 'chimneys-group';
   group.add(mesh, smoke.points);
-  const wa = (cfg.wind.towards * Math.PI) / 180;
-  const drift: [number, number, number] = [Math.cos(wa) * cfg.wind.speed, 0, -Math.sin(wa) * cfg.wind.speed];
+  const drift: [number, number, number] = [0, 0, 0];
   const DAY = ['#e9e6e1', '#dcd8d1', '#f1efea'], NIGHT = ['#55596a', '#4b4f5e', '#5f6373'];
   const puff: EmitOptions = { count: 1, speed: [0.05, 0.25], up: 1.1, life: [6, 9], size: 1.6, grow: 4, colors: DAY, drag: 0.04, spread: 0.15, drift };
   let emitters: number[] = [];
@@ -102,6 +101,10 @@ export function buildChimneys(
     check -= dt;
     if (check <= 0) {
       check = 0.5;
+      // Vent : objet partagé avec les drapeaux, que la météo fait varier (EP009-US009) ; les bouffées suivantes le suivent
+      const wa = (cfg.wind.towards * Math.PI) / 180;
+      drift[0] = Math.cos(wa) * cfg.wind.speed;
+      drift[2] = -Math.sin(wa) * cfg.wind.speed;
       density = cfg.density[ctx.season()] ?? 0;
       const f = ctx.focus(), d2 = cfg.distance * cfg.distance;
       emitters = tops.map((t, i) => ({ i, d: (t.x - f.x) ** 2 + (t.z - f.z) ** 2 })).filter((o) => o.d < d2).sort((a, b) => a.d - b.d).slice(0, cfg.maxEmitters).map((o) => o.i);
```

**`frontend/carte/src/scene/city.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -539,7 +539,7 @@ function buildTrees(data: CityData, terrain: Terrain): CityTrees & { group: THRE
   canopyGeo.translate(0, 7.5, 0);
   const trunkGeo = new THREE.CylinderGeometry(0.5, 0.7, 5, 5);
   trunkGeo.translate(0, 2.5, 0);
-  const canopy = new THREE.InstancedMesh(canopyGeo, weatherSurface(new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), { wet: 0 }), spots.length); // neige (EP009-US007)
+  const canopy = new THREE.InstancedMesh(canopyGeo, weatherSurface(new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), { wet: 0, sway: true }), spots.length); // neige (EP009-US007), vent (US009)
   const trunk = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: PALETTE.trunk, roughness: 1 }), spots.length);
   const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
   const base: THREE.Matrix4[] = [];
```

**`frontend/carte/src/scene/flags.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -79,7 +79,8 @@ export function buildFlags(
   };
   clothMat.customProgramCacheKey = () => 'flag-cloth';
   const poleMat = new THREE.MeshStandardMaterial({ color: '#e8e4dc', metalness: 0.4, roughness: 0.4 });
-  const windAngle = (ctx.wind.towards * Math.PI) / 180;
+  const cloths: THREE.Mesh[] = [];
+  const speed0 = ctx.wind.speed; // vent de beau temps (content/life.json) : le drapeau d'avant
 
   for (const s of specs) {
     let x: number, y: number, ring: { outer: Pt[]; holes: Pt[][] } | undefined;
@@ -108,8 +109,8 @@ export function buildFlags(
     mat.onBeforeCompile = (shader, r) => { clothMat.onBeforeCompile(shader, r); shader.vertexShader = shader.vertexShader.replace('FLAG_W', W.toFixed(2)); };
     mat.customProgramCacheKey = () => `flag-cloth-${W}`;
     const cloth = new THREE.Mesh(geo, mat);
-    cloth.rotation.y = windAngle; // Three.js : rotation autour de Y depuis +X vers -Z = vers le nord, comme l'angle du vent
     cloth.castShadow = false;
+    cloths.push(cloth);
     flag.add(pole, knob, cloth);
     group.add(flag);
     placed.push({ id: s.id, x: top.x, y: top.y, top: top.h });
@@ -120,10 +121,14 @@ export function buildFlags(
   return {
     group, placed,
     update(dt) {
-      t += dt;
+      // Vent de la météo (EP009-US009, objet partagé avec la fumée) : plus fort, le drapeau claque plus vite et plus loin
+      const w = Math.min(4, ctx.wind.speed / speed0);
+      t += dt * (0.5 + 0.5 * w);
       uniforms.uTime.value = t;
       // Vent qui varie lentement : le drapeau claque plus ou moins
-      uniforms.uStrength.value = 0.75 + 0.25 * Math.sin(t * 0.35) + 0.1 * Math.sin(t * 1.3);
+      uniforms.uStrength.value = (0.75 + 0.25 * Math.sin(t * 0.35) + 0.1 * Math.sin(t * 1.3)) * (0.8 + 0.2 * w);
+      // Three.js : rotation autour de Y depuis +X vers -Z = vers le nord, comme l'angle du vent
+      for (const c of cloths) c.rotation.y = (ctx.wind.towards * Math.PI) / 180;
     },
   };
 }
```

**`frontend/carte/src/scene/nature.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -32,7 +32,7 @@ export function seasonalName(name: string, foliage: Foliage, seasons?: NatureSea
   return `${m[1]}_${foliage === 'autumn' ? seasons.autumn : seasons.bare}_${m[2]}`;
 }
 
-const material = weatherSurface(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }), { wet: 0 }); // neige sur les arbres (EP009-US007)
+const material = weatherSurface(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }), { wet: 0, sway: true }); // neige sur les arbres (EP009-US007), vent (US009)
 
 /** Test « cet emplacement est dans la zone » ; null si la zone ne correspond à rien dans city.json. */
 function zoneTest(zone: NatureZone, data: CityData): ((p: Pt) => boolean) | null {
```

**`frontend/carte/src/scene/weather-surface.test.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -49,5 +49,22 @@ describe('crochets « sol mouillé » et « neige » posés au démarrage (EP009
   it('par beau temps, les uniformes valent 0 : les branches ne sont pas prises', () => {
     expect(weatherUniforms.uWet.value).toBe(0);
     expect(weatherUniforms.uSnow.value).toBe(0);
+    expect(weatherUniforms.uSway.value.x).toBe(0);
+  });
+  it('arbres : balancement au vent dans le vertex shader, seulement sur demande, avec sa propre clé de programme (EP009-US009)', () => {
+    const tree = weatherSurface(new THREE.MeshStandardMaterial(), { wet: 0, sway: true }), roof = weatherSurface(new THREE.MeshStandardMaterial(), { wet: 0 });
+    const vertexShader = '#include <common>\nvoid main() {\n#include <begin_vertex>\n#include <project_vertex>\n}';
+    const st = { ...shader(), vertexShader }, sr = { ...shader(), vertexShader };
+    tree.onBeforeCompile(st as never, {} as never);
+    roof.onBeforeCompile(sr as never, {} as never);
+    expect(st.uniforms.uSway).toBe(weatherUniforms.uSway);
+    expect(st.vertexShader).toMatch(/uniform vec4 uSway;/);
+    const begin = st.vertexShader.indexOf('#include <begin_vertex>'), branch = st.vertexShader.indexOf('if (uSway.x > 0.0)');
+    expect(begin).toBeGreaterThan(0);
+    expect(branch).toBeGreaterThan(begin);
+    expect(branch).toBeLessThan(st.vertexShader.indexOf('#include <project_vertex>'));
+    expect(sr.vertexShader).not.toMatch(/uSway/); // les toits ne bougent pas
+    expect(st.fragmentShader).toBe(sr.fragmentShader);
+    expect(tree.customProgramCacheKey()).toBe(`${roof.customProgramCacheKey()}|sway`);
   });
 });
```

**`frontend/carte/src/scene/weather-surface.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -6,8 +6,13 @@ import * as THREE from 'three';
  * le module météo ne règle que les uniformes. Comme `fadeMaterial` (cutaway.ts) : l'`onBeforeCompile` existant est enchaîné, la clé
  * du programme est étendue une fois pour toutes. Par beau temps (`uWet` et `uSnow` à 0), les branches ne sont pas prises : image
  * inchangée. Chaque matériau dit combien il se mouille et se couvre de neige (uniformes à lui : même programme pour tous).
+ * Arbres : balancement au vent (US009), dans le vertex shader, inactif tant que l'amplitude (`uSway.x`) vaut 0.
  */
-export const weatherUniforms = { uWet: { value: 0 }, uSnow: { value: 0 } };
+export const weatherUniforms = {
+  uWet: { value: 0 }, uSnow: { value: 0 },
+  /** Balancement : amplitude (m par m² de hauteur), temps (s), direction où va le vent (x, z) */
+  uSway: { value: new THREE.Vector4() },
+};
 
 // Mouillé : plus sombre et un peu satiné, surtout sur ce qui regarde vers le ciel (sols, rues, toits) ; pas de vrais reflets.
 // Neige : ce qui regarde vers le ciel (selon la pente, jamais les façades) passe à un blanc bleuté un peu cassé, par plaques (bruit
@@ -34,12 +39,19 @@ const COMMON = /* glsl */ `
     vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
     return mix(mix(wxHash(i), wxHash(i + vec2(1.0, 0.0)), u.x), mix(wxHash(i + vec2(0.0, 1.0)), wxHash(i + 1.0), u.x), u.y);
   }`;
+// Balancement (arbres instanciés seulement) : le houppier penche sous le vent et oscille, d'autant plus qu'il est haut (∝ hauteur²),
+// chaque arbre à son rythme ; déplacement calculé dans le monde puis ramené dans le repère de l'instance (rotation et échelle)
+const SWAY = /* glsl */ `#include <begin_vertex>
+  if (uSway.x > 0.0) {
+    float wxS = length(instanceMatrix[0].xyz), wxH = transformed.y * wxS, wxT = uSway.y + dot(instanceMatrix[3].xz, vec2(0.07, 0.05));
+    transformed += transpose(mat3(instanceMatrix)) * vec3(uSway.z, 0.0, uSway.w) * uSway.x * wxH * wxH * (0.6 + 0.4 * sin(wxT * 1.9)) / (wxS * wxS);
+  }`;
 
 /**
  * Ajoute les crochets « mouillé » et « neige » à un matériau standard, avant sa première compilation.
- * wet, snow : part de mouillé et de neige que prend ce matériau (0 à 1 ; 0 = jamais).
+ * wet, snow : part de mouillé et de neige que prend ce matériau (0 à 1 ; 0 = jamais) ; sway : arbres instanciés qui se balancent au vent.
  */
-export function weatherSurface<T extends THREE.MeshStandardMaterial>(mat: T, { wet = 1, snow = 1 } = {}): T {
+export function weatherSurface<T extends THREE.MeshStandardMaterial>(mat: T, { wet = 1, snow = 1, sway = false } = {}): T {
   const previous = mat.onBeforeCompile;
   const base = mat.customProgramCacheKey === THREE.Material.prototype.customProgramCacheKey ? previous.toString() : mat.customProgramCacheKey();
   mat.onBeforeCompile = (shader, renderer) => {
@@ -48,7 +60,8 @@ export function weatherSurface<T extends THREE.MeshStandardMaterial>(mat: T, { w
     shader.fragmentShader = shader.fragmentShader
       .replace('#include <common>', `#include <common>${COMMON}`)
       .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>${GLSL}`);
+    if (sway) shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform vec4 uSway;').replace('#include <begin_vertex>', SWAY);
   };
-  mat.customProgramCacheKey = () => `${base}|wet`;
+  mat.customProgramCacheKey = () => `${base}|wet${sway ? '|sway' : ''}`;
   return mat;
 }
```

**`frontend/carte/src/weather/effects.test.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -1,6 +1,6 @@
 import { describe, expect, it } from 'vitest';
-import { SNOW_COVER, WET } from './effects';
-import { approach } from './state';
+import { SNOW_COVER, SWAY, WET, swayAmount } from './effects';
+import { approach, windVisual } from './state';
 
 /** Neige au sol après `s` secondes d'une neige constante (ou de fonte, si `snow` vaut 0), par pas d'une image à 60 img/s */
 function lying(from: number, snow: number, s: number) {
@@ -24,3 +24,24 @@ describe('neige au sol : s’accumule puis fond, comme le sol mouillé (EP009-US
     expect(SNOW_COVER.tauDown).toBeGreaterThan(WET.tauDown);
   });
 });
+
+describe('arbres qui se balancent au vent (EP009-US009)', () => {
+  it('rien par vent faible ou modéré (25 km/h et moins), ni par le vent de beau temps', () => {
+    for (const kmh of [0, 10, 20, 25]) expect(swayAmount(windVisual(kmh), 'high', false)).toBe(0);
+    expect(swayAmount(0.7, 'high', false)).toBe(0); // content/life.json
+  });
+  it('au-delà, de plus en plus fort jusqu’à 60 km/h, puis plafonné', () => {
+    let prev = 0;
+    for (const kmh of [30, 40, 50, 60]) {
+      const a = swayAmount(windVisual(kmh), 'medium', false);
+      expect(a).toBeGreaterThan(prev);
+      prev = a;
+    }
+    expect(swayAmount(windVisual(60), 'high', false)).toBeCloseTo(SWAY.amp);
+    expect(swayAmount(windVisual(150), 'high', false)).toBeCloseTo(SWAY.amp);
+  });
+  it('rien en qualité basse ni avec le réduit-mouvement', () => {
+    expect(swayAmount(windVisual(60), 'low', false)).toBe(0);
+    expect(swayAmount(windVisual(60), 'high', true)).toBe(0);
+  });
+});
```

**`frontend/carte/src/weather/effects.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -5,7 +5,7 @@ import { weatherUniforms } from '../scene/weather-surface';
 import { fogColorFor, fogRange } from './fog';
 import { FULL_BUDGET, nextBudget, type RainBudget } from './budget';
 import { RAIN_COUNT, SNOW_COUNT, createRain, type PrecipKind, type Rain } from './rain';
-import { approach, type WeatherLook } from './state';
+import { approach, windVisual, type WeatherLook } from './state';
 
 /**
  * Effets de la météo sur la scène (EP009), dans le module chargé à la demande. Tout ce qui touche aux matériaux standards a été
@@ -18,12 +18,15 @@ import { approach, type WeatherLook } from './state';
  *    de la passe finale (sinon liseré clair autour du socle).
  *  - Pluie (US005) : deux nappes de traînées (weather/rain.ts), sol mouillé, lueurs de nuit un peu plus fortes, règle de dégradation.
  *  - Neige (US007) : deux nappes de flocons (même système), neige au sol qui s'accumule et fond, même règle de dégradation.
+ *  - Vent (US009) : l'objet partagé que lisent la fumée et les drapeaux suit la météo (fondu de 6 s) ; balancement des arbres.
  */
 export interface EffectsCtx {
   scene: THREE.Scene;
   camera: THREE.Camera;
   /** Point regardé */
   focus(): THREE.Vector3;
+  /** Vent partagé par la fumée et les drapeaux (main.ts ; content/life.json par beau temps), que la météo fait varier */
+  wind: { towards: number; speed: number };
   /** Taille du socle (m) et ses limites (données) */
   size: number;
   bounds: CityData['bounds'];
@@ -46,6 +49,13 @@ export const WET = { perRain: 1.6, tauUp: 20, tauDown: 120 };
 export const WET_GLOW = 0.25;
 /** Neige au sol : cible selon la neige qui tombe, temps pour couvrir (s) et pour fondre */
 export const SNOW_COVER = { perSnow: 1.6, tauUp: 30, tauDown: 300 };
+/** Balancement des arbres : à partir de 25 km/h, pleinement à 60 ; amplitude (m par m² de hauteur : 0,6 m en haut d'un arbre de 10 m) */
+export const SWAY = { fromKmh: 25, fullKmh: 60, amp: 0.006 };
+
+const smooth = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
+/** Amplitude du balancement pour un vent « de maquette » (m/s) ; aucun en qualité basse ni avec le réduit-mouvement */
+export const swayAmount = (windSpeed: number, quality: QualityLevel, reduced: boolean) =>
+  quality === 'low' || reduced ? 0 : SWAY.amp * smooth(windVisual(SWAY.fromKmh), windVisual(SWAY.fullKmh), windSpeed);
 
 export function createEffects(ctx: EffectsCtx, reduced: () => boolean) {
   const fog = ctx.scene.fog as THREE.Fog | null; // posé inactif au démarrage (stage.ts)
@@ -79,7 +89,7 @@ export function createEffects(ctx: EffectsCtx, reduced: () => boolean) {
   const count = { rain: countOf('rain', RAIN_COUNT), snow: countOf('snow', SNOW_COUNT) };
   let budget: RainBudget = { ...FULL_BUDGET };
   ctx.onFpsSample((fps, atMin) => { if (precip.rain?.visible() || precip.snow?.visible()) budget = nextBudget(budget, fps, atMin); });
-  let wet = 0, glow = 1, lying = 0;
+  let wet = 0, glow = 1, lying = 0, swayT = 0;
 
   return {
     /** Appelé par le modificateur du ciel (daynight.ts), une fois la météo appliquée : fond de page et exposition finals */
@@ -118,6 +128,15 @@ export function createEffects(ctx: EffectsCtx, reduced: () => boolean) {
             .update(dt, f, ctx.camera.position.distanceTo(f), r, raw, { speed: look.windSpeed, towards: look.windTowards }, ctx.night(), reduced() ? 0.3 : 1);
         } else if (p?.visible()) p.hide();
       }
+      // Vent : la fumée et les drapeaux lisent l'objet partagé ; les arbres se balancent (amplitude lissée, rien par vent faible)
+      ctx.wind.speed = look.windSpeed;
+      ctx.wind.towards = look.windTowards;
+      const sway = weatherUniforms.uSway.value, swayTarget = swayAmount(look.windSpeed, ctx.quality, reduced());
+      if (sway.x > 0 || swayTarget > 0) {
+        const amp = approach(sway.x, swayTarget, dt, 2), a = (look.windTowards * Math.PI) / 180;
+        swayT = (swayT + dt) % 1e5;
+        sway.set(swayTarget === 0 && amp < 1e-5 ? 0 : amp, swayT, Math.cos(a), -Math.sin(a));
+      }
       // Neige au sol : s'accumule en une minute environ, fond en quelques minutes
       const lyingTarget = Math.min(1, look.snow * SNOW_COVER.perSnow);
       if (lying !== lyingTarget) {
```

**`frontend/carte/src/weather/index.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -25,8 +25,6 @@ export interface WeatherCtx extends EffectsCtx {
   camera: THREE.Camera;
   /** Point regardé (brouillard, précipitations) */
   focus(): THREE.Vector3;
-  /** Vent de beau temps (content/life.json) : objet partagé par la fumée et les drapeaux (US009 le fera varier) */
-  wind: { towards: number; speed: number };
   /** Pose le modificateur du ciel dans le cycle jour/nuit et le recalcule (dayNight.setWeather) */
   sky(modifier: (v: SkyValues, dayF: number) => void): void;
   clock(): ClockState;
```


#### Commit 2 (US008) — `feat(meteo): orage : éclairs (au plus 3 par seconde, aucun en réduit-mouvement), trait d'éclair, ciel noir et lumières de la ville (EP009-US008)`

Patch : `/private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/7058533b-187f-4f4d-8d7b-9497ad542537/scratchpad/u8/patches/us008.patch` (sur `0916456`) ; même commit reporté sur `6eace2f` : `/private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/7058533b-187f-4f4d-8d7b-9497ad542537/scratchpad/u8/patches/sur-6eace2f/us008.patch`.

**`frontend/carte/src/scene/daynight.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -65,7 +65,7 @@ export function createDayNight(d: DayNightDeps, initial: { day: LocalDate; hour:
   let day = initial.day, hour = initial.hour, night = 0;
   // Météo (EP009) : modificateur fourni par le module météo (chargé à la demande), appliqué après l'heure ; sans lui, rien ne change
   let weather: ((v: SkyValues, dayF: number) => void) | null = null;
-  const sv: SkyValues = { hemiI: 0, keyI: 0, exposure: 0, glow: 1, sky, key: keyCol, bg };
+  const sv: SkyValues = { hemiI: 0, keyI: 0, exposure: 0, glow: 1, lit: 0, sky, key: keyCol, bg };
   let lastBg = '';
   const lastSun = new THREE.Vector3(NaN, NaN, NaN);
   const listeners: ((h: number, night: number) => void)[] = [];
@@ -89,7 +89,8 @@ export function createDayNight(d: DayNightDeps, initial: { day: LocalDate; hour:
     sv.keyI = lerp(NIGHT.keyI, DAY.keyI, dayF);
     sv.exposure = lerp(NIGHT.exposure, DAY.exposure, dayF);
     sv.glow = 1;
-    weather?.(sv, dayF); // météo (EP009) : ciel voilé, lumière grise, fond désaturé ; lueurs de nuit plus fortes sous la pluie
+    sv.lit = 0;
+    weather?.(sv, dayF); // météo (EP009) : ciel voilé, lumière grise, fond désaturé ; lueurs de nuit plus fortes sous la pluie, éclairs
     const { hemiI, keyI, exposure, glow: glowGain } = sv;
 
     // Soleil le jour (repère : x = est, −z = nord, y = haut), lune la nuit (fixe, haute, un peu à l'ouest)
@@ -114,7 +115,7 @@ export function createDayNight(d: DayNightDeps, initial: { day: LocalDate; hour:
     d.renderer.toneMappingExposure = exposure;
 
     // Lumières de la ville
-    d.night.uNight.value = THREE.MathUtils.smoothstep(night + dusk * 0.4, 0.25, 0.9);
+    d.night.uNight.value = Math.max(sv.lit, THREE.MathUtils.smoothstep(night + dusk * 0.4, 0.25, 0.9)); // orage de jour (EP009-US008)
     // Fenêtres (EP001-US003) : la part allumée suit l'heure (rentrée le soir, extinction dans la nuit, réveil le matin) ;
     // le shader allume une fenêtre si son hachage est sous uLit : quand uLit baisse, elles s'éteignent une à une, sans
     // clignoter, toujours dans le même ordre. On ne les voit que quand il fait sombre (uNight)
```

**`frontend/carte/src/weather/effects.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -5,6 +5,8 @@ import { weatherUniforms } from '../scene/weather-surface';
 import { fogColorFor, fogRange } from './fog';
 import { FULL_BUDGET, nextBudget, type RainBudget } from './budget';
 import { RAIN_COUNT, SNOW_COUNT, createRain, type PrecipKind, type Rain } from './rain';
+import { createBolt, createLightning } from './lightning';
+import type { SkyValues } from './sky';
 import { approach, windVisual, type WeatherLook } from './state';
 
 /**
@@ -19,6 +21,7 @@ import { approach, windVisual, type WeatherLook } from './state';
  *  - Pluie (US005) : deux nappes de traînées (weather/rain.ts), sol mouillé, lueurs de nuit un peu plus fortes, règle de dégradation.
  *  - Neige (US007) : deux nappes de flocons (même système), neige au sol qui s'accumule et fond, même règle de dégradation.
  *  - Vent (US009) : l'objet partagé que lisent la fumée et les drapeaux suit la météo (fondu de 6 s) ; balancement des arbres.
+ *  - Orage (US008) : éclairs (passe finale, lumière d'ambiance, ciel et fond de page) et trait d'éclair, aucun avec le réduit-mouvement.
  */
 export interface EffectsCtx {
   scene: THREE.Scene;
@@ -52,6 +55,13 @@ export const SNOW_COVER = { perSnow: 1.6, tauUp: 30, tauDown: 300 };
 /** Balancement des arbres : à partir de 25 km/h, pleinement à 60 ; amplitude (m par m² de hauteur : 0,6 m en haut d'un arbre de 10 m) */
 export const SWAY = { fromKmh: 25, fullKmh: 60, amp: 0.006 };
 
+/**
+ * Éclair, par unité d'intensité (0,3 à 0,6 par éclair, lightning.ts) : flash de la passe finale, lumière d'ambiance en plus, part de la
+ * couleur de l'éclair dans la lumière du ciel et dans le fond de page. Réglés à l'œil (captures) : plus fort, l'image est délavée
+ */
+export const FLASH = { post: 0.35, hemi: 0.9, sky: 0.5, bg: 0.35 };
+const FLASH_COLOR = new THREE.Color('#dfe6ff');
+
 const smooth = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
 /** Amplitude du balancement pour un vent « de maquette » (m/s) ; aucun en qualité basse ni avec le réduit-mouvement */
 export const swayAmount = (windSpeed: number, quality: QualityLevel, reduced: boolean) =>
@@ -89,7 +99,10 @@ export function createEffects(ctx: EffectsCtx, reduced: () => boolean) {
   const count = { rain: countOf('rain', RAIN_COUNT), snow: countOf('snow', SNOW_COUNT) };
   let budget: RainBudget = { ...FULL_BUDGET };
   ctx.onFpsSample((fps, atMin) => { if (precip.rain?.visible() || precip.snow?.visible()) budget = nextBudget(budget, fps, atMin); });
-  let wet = 0, glow = 1, lying = 0, swayT = 0;
+  let wet = 0, glow = 1, lying = 0, swayT = 0, flash = 0;
+  // Orage : éclairs planifiés (au plus 3 par seconde), trait d'éclair créé au premier (pas en qualité basse)
+  const lightning = createLightning();
+  let bolt: ReturnType<typeof createBolt> | null = null;
 
   return {
     /** Appelé par le modificateur du ciel (daynight.ts), une fois la météo appliquée : fond de page et exposition finals */
@@ -98,11 +111,18 @@ export function createEffects(ctx: EffectsCtx, reduced: () => boolean) {
       edge[0] = rgb.r; edge[1] = rgb.g; edge[2] = rgb.b;
       exposure = exp;
     },
-    /** Gain des lueurs de nuit, lu par le modificateur du ciel */
-    glow: () => glow,
+    /** Appelé par le modificateur du ciel : lueurs de nuit (plus fortes sous la pluie) et éclair (ambiance, ciel, fond de page) */
+    light(v: SkyValues) {
+      v.glow = glow;
+      if (flash > 0) {
+        v.hemiI += FLASH.hemi * flash;
+        v.sky.lerp(FLASH_COLOR, Math.min(1, FLASH.sky * flash));
+        for (const c of v.bg) c.lerp(FLASH_COLOR, FLASH.bg * flash);
+      }
+    },
     /** Part des gouttes gardée par la règle de dégradation (1, 0,5 ou 0) */
     budget: () => budget.level,
-    /** À chaque image ; renvoie vrai si le ciel doit être recalculé (lueurs de nuit) */
+    /** À chaque image ; renvoie vrai si le ciel doit être recalculé (lueurs de nuit, éclair) */
     update(look: WeatherLook, dt: number): boolean {
       // Brouillard : suit la caméra ; une dernière fois quand il s'en va, pour le remettre au repos
       const k = look.fog;
@@ -137,6 +157,12 @@ export function createEffects(ctx: EffectsCtx, reduced: () => boolean) {
         swayT = (swayT + dt) % 1e5;
         sway.set(swayTarget === 0 && amp < 1e-5 ? 0 : amp, swayT, Math.cos(a), -Math.sin(a));
       }
+      // Orage : éclairs (aucun avec le réduit-mouvement) ; le soleil ne bouge pas, la carte des ombres n'est pas recalculée
+      const strike = lightning.step(dt, look.storm > 0.5 && !reduced());
+      if (strike.start?.bolt && ctx.quality !== 'low') (bolt ??= createBolt(ctx.scene)).strike(ctx.camera, ctx.focus(), ctx.bounds, Math.random);
+      bolt?.update(dt);
+      const sky = strike.flash * look.storm !== flash;
+      if (sky) { flash = strike.flash * look.storm; ctx.post({ flash: FLASH.post * flash }); }
       // Neige au sol : s'accumule en une minute environ, fond en quelques minutes
       const lyingTarget = Math.min(1, look.snow * SNOW_COVER.perSnow);
       if (lying !== lyingTarget) {
@@ -146,12 +172,12 @@ export function createEffects(ctx: EffectsCtx, reduced: () => boolean) {
       }
       // Sol mouillé : vite à l'humidification, lentement au séchage ; lueurs de nuit un peu plus fortes
       const target = Math.min(1, look.rain * WET.perRain);
-      if (wet === target) return false;
+      if (wet === target) return sky;
       wet = approach(wet, target, dt, target > wet ? WET.tauUp : WET.tauDown);
       if (Math.abs(wet - target) < 1e-3) wet = target;
       weatherUniforms.uWet.value = wet;
       const g = 1 + WET_GLOW * wet;
-      if (Math.abs(g - glow) < 0.01 && wet !== target) return false;
+      if (Math.abs(g - glow) < 0.01 && wet !== target) return sky;
       glow = g;
       return true;
     },
```

**`frontend/carte/src/weather/index.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -76,7 +76,7 @@ export function startWeather(ctx: WeatherCtx): WeatherModule {
   /** Le ciel suit la météo lissée `cur` (lue à chaque recalcul du cycle jour/nuit) ; les effets lisent le fond qui en résulte */
   const skyModifier = (v: SkyValues, dayF: number) => {
     applyWeatherSky(v, cur, dayF);
-    v.glow = effects.glow();
+    effects.light(v); // lueurs de nuit sous la pluie, éclairs de l'orage
     effects.readSky(v.bg, v.exposure);
   };
   const pref = loadWeatherPref();
```

**`frontend/carte/src/weather/lightning.test.ts`** (nouveau, complet)

```ts
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LIGHTNING, boltPoints, createLightning, flashOf, salvo, type Strike } from './lightning';

/** Tirage reproductible (les tests ne dépendent pas de Math.random) */
const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

/** Fait tourner le planificateur `s` secondes à `fps` images/s ; renvoie les éclairs vus (début) et le flash le plus fort */
function run(s: number, fps: number, active: (t: number) => boolean, rng = seeded(7)) {
  const l = createLightning(rng), starts: number[] = [];
  let max = 0, t = 0;
  for (let i = 0; i < s * fps; i++) {
    t += 1 / fps;
    const r = l.step(1 / fps, active(t));
    if (r.start) starts.push(t);
    max = Math.max(max, r.flash);
  }
  return { starts, max };
}

describe('éclairs : planificateur (EP009-US008)', () => {
  it('1 000 salves : 1 à 3 éclairs, au moins 0,4 s entre deux, amplitude et décroissance bornées, trait sur le premier', () => {
    const rng = seeded(42);
    for (let k = 0; k < 1000; k++) {
      const s = salvo(k * 30, rng);
      expect(s.length).toBeGreaterThanOrEqual(1);
      expect(s.length).toBeLessThanOrEqual(3);
      s.forEach((x, i) => {
        expect(x.amp).toBeGreaterThanOrEqual(0.3);
        expect(x.amp).toBeLessThanOrEqual(0.6);
        expect(x.decay).toBeGreaterThanOrEqual(0.12);
        expect(x.decay).toBeLessThanOrEqual(0.25);
        expect(x.bolt).toBe(i === 0);
        if (i) expect(x.at - s[i - 1].at).toBeGreaterThanOrEqual(0.4);
      });
    }
  });
  it('jamais plus de 3 éclairs par seconde, et 6 à 20 s entre deux salves (4 heures d’orage, à 30, 60 et 144 img/s)', () => {
    for (const fps of [30, 60, 144]) {
      const { starts } = run(4 * 3600, fps, () => true, seeded(fps));
      expect(starts.length).toBeGreaterThan(1000);
      for (let i = 3; i < starts.length; i++) expect(starts[i] - starts[i - 3]).toBeGreaterThan(1); // 4 éclairs prennent plus d'une seconde
      const gaps = starts.slice(1).map((t, i) => t - starts[i]);
      for (const g of gaps) expect(g >= 0.4 - 1 / fps && (g <= 0.9 + 1 / fps || (g >= 6 && g <= 20 + 1.5 / fps))).toBe(true);
      expect(gaps.filter((g) => g >= 6).length).toBeGreaterThan(500);
    }
  });
  it('chaque éclair est une seule impulsion : elle monte d’un coup puis décroît jusqu’à 0, sans repartir', () => {
    const s: Strike = { at: 1, amp: 0.5, decay: 0.2, bolt: true };
    expect(flashOf(s, 0.99)).toBe(0);
    expect(flashOf(s, 1)).toBe(0.5);
    let prev = 0.5;
    for (let t = 1.01; t < 1.2; t += 0.01) { const f = flashOf(s, t); expect(f).toBeLessThanOrEqual(prev); prev = f; }
    expect(flashOf(s, 1.2)).toBe(0);
  });
  it('réduit-mouvement (ou pas d’orage) : aucun éclair, jamais ; coupé net si l’orage s’en va pendant un éclair', () => {
    expect(run(3600, 60, () => false)).toEqual({ starts: [], max: 0 });
    const l = createLightning(seeded(3));
    let on = 0;
    for (let i = 0; i < 60 * 30 && !on; i++) on = l.step(1 / 60, true).flash;
    expect(on).toBeGreaterThan(0);
    expect(l.step(1 / 60, false)).toEqual({ flash: 0, start: null });
  });
  it('la première salve arrive 2 à 6 s après l’orage', () => {
    for (let seed = 1; seed < 50; seed++) {
      const { starts } = run(30, 60, () => true, seeded(seed));
      expect(starts[0]).toBeGreaterThanOrEqual(LIGHTNING.first[0]);
      expect(starts[0]).toBeLessThanOrEqual(LIGHTNING.first[1] + 2 / 60);
    }
  });
});

describe('trait d’éclair', () => {
  it('32 segments du haut jusqu’au pied, qui s’écartent peu de la verticale', () => {
    const top = new THREE.Vector3(0, 900, 0), bottom = new THREE.Vector3(0, 0, 0);
    const pts = boltPoints(top, bottom, new THREE.Vector3(1, 0, 0), seeded(5));
    expect(pts.length).toBe(33);
    expect(pts[0].equals(top) && pts[32].equals(bottom)).toBe(true);
    for (const p of pts) expect(Math.abs(p.x)).toBeLessThan(900 * 0.2);
  });
});
```

**`frontend/carte/src/weather/lightning.ts`** (nouveau, complet)

```ts
import * as THREE from 'three';

/**
 * Éclairs de l'orage (EP009-US008), dans le module météo. L'orage est déduit des codes 95 à 99 de la source (R1) : ces éclairs
 * sont un décor, jamais un relevé « en temps réel ».
 *  - Le planificateur (pur, testé sur 1 000 salves) décide quand ils tombent : des salves de 1 à 3 éclairs espacés d'au moins
 *    0,4 s (donc jamais plus de 3 par seconde, WCAG 2.3.1), 6 à 20 s entre deux salves, amplitude bornée, chaque éclair une seule
 *    impulsion qui décroît en 120 à 250 ms (pas de scintillement dans un éclair). Aucun avec le réduit-mouvement (effects.ts).
 *  - Le trait d'éclair : un ruban brisé de 32 segments, face à la caméra, au-delà du point regardé ; un appel de
 *    rendu pendant 150 ms. Son matériau (couleur unie, sans brouillard) a le même programme que les anneaux des lieux d'histoire :
 *    rien à compiler quand il apparaît.
 */
export const LIGHTNING = {
  /** Écart entre deux éclairs d'une salve (s) : au moins 0,4 s, donc au plus 3 éclairs par seconde */
  gap: [0.4, 0.9],
  /** Entre la fin d'une salve et le début de la suivante (s) */
  pause: [6, 20],
  /** Première salve après l'arrivée de l'orage (s) */
  first: [2, 6],
  /** Éclairs par salve */
  count: [1, 3],
  /** Intensité du flash de la passe finale (R2 : 0,3 à 0,6) */
  amp: [0.3, 0.6],
  /** Durée de la décroissance (s) */
  decay: [0.12, 0.25],
  /** Durée du trait d'éclair (s) */
  bolt: 0.15,
} as const;

export interface Strike { at: number; amp: number; decay: number; bolt: boolean }

const pick = (r: () => number, [a, b]: readonly [number, number]) => a + r() * (b - a);

/** Une salve qui commence à `t` : 1 à 3 éclairs, le premier avec son trait */
export function salvo(t: number, rng: () => number): Strike[] {
  const n = Math.min(LIGHTNING.count[1], LIGHTNING.count[0] + Math.floor(rng() * LIGHTNING.count[1]));
  const out: Strike[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ at: t, amp: pick(rng, LIGHTNING.amp), decay: pick(rng, LIGHTNING.decay), bolt: i === 0 });
    t += pick(rng, LIGHTNING.gap);
  }
  return out;
}

/** Intensité de l'éclair `s` à l'instant t : une impulsion qui décroît, 0 avant et après */
export const flashOf = (s: Strike, t: number) => (t < s.at || t >= s.at + s.decay ? 0 : s.amp * (1 - (t - s.at) / s.decay) ** 2);

/**
 * Planificateur : `step(dt, active)` à chaque image ; active = orage affiché et pas de réduit-mouvement. Renvoie l'intensité du flash
 * (0 hors éclair) et l'éclair qui commence à cette image (pour le trait), sinon null. Inactif : plus rien, tout de suite.
 */
export function createLightning(rng: () => number = Math.random) {
  let t = 0, queue: Strike[] = [], next = -1;
  return {
    step(dt: number, active: boolean): { flash: number; start: Strike | null } {
      t += dt;
      if (!active) { queue = []; next = -1; return { flash: 0, start: null }; }
      if (next < 0) next = t + pick(rng, LIGHTNING.first);
      if (!queue.length && t >= next) {
        queue = salvo(t, rng);
        next = queue[queue.length - 1].at + pick(rng, LIGHTNING.pause);
      }
      let start: Strike | null = null;
      while (queue.length && t >= queue[0].at + queue[0].decay) queue.shift();
      const s = queue[0];
      if (s && t - dt < s.at && t >= s.at) start = s;
      return { flash: s ? flashOf(s, t) : 0, start };
    },
  };
}

/** Points d'un trait d'éclair entre le haut et le bas (déplacement du point milieu), 2^depth segments, dans le plan donné */
export function boltPoints(top: THREE.Vector3, bottom: THREE.Vector3, side: THREE.Vector3, rng: () => number, depth = 5): THREE.Vector3[] {
  let pts = [top.clone(), bottom.clone()];
  let spread = top.distanceTo(bottom) * 0.12;
  for (let k = 0; k < depth; k++) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      out.push(pts[i - 1].clone().lerp(pts[i], 0.5).addScaledVector(side, (rng() - 0.5) * spread), pts[i]);
    }
    pts = out;
    spread *= 0.55;
  }
  return pts;
}

/** Trait d'éclair : ruban face à la caméra, reconstruit à chaque éclair, un appel de rendu pendant `LIGHTNING.bolt` s */
export function createBolt(scene: THREE.Scene) {
  const N = 33; // 32 segments (2^5) : 33 points, 2 sommets chacun
  const pos = new Float32Array(N * 2 * 3), index: number[] = [];
  for (let i = 0; i < N - 1; i++) index.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 2, 2 * i + 1, 2 * i + 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N * 6), 3)); // inutilisée, mais sans elle le programme différerait
  geo.setIndex(index);
  geo.setDrawRange(0, 0);
  // Même programme que les anneaux des lieux d'histoire (markers.ts) : compilé dès le démarrage
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#f4f7ff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  mesh.name = 'lightning-bolt';
  mesh.frustumCulled = false;
  mesh.renderOrder = 7;
  scene.add(mesh);
  const v = new THREE.Vector3(), eye = new THREE.Vector3(), fwd = new THREE.Vector3(), side = new THREE.Vector3(), top = new THREE.Vector3(), bottom = new THREE.Vector3();
  let left = 0;
  return {
    /** Visible à cette image (0 ou 1 appel) */
    visible: () => +(left > 0),
    /**
     * Un éclair tombe à peu près à la distance du point regardé (jusqu'à 15 % au-delà), dans le socle, du haut de l'image jusqu'au sol ;
     * épaisseur de 3 à 6 pixels environ (plus fin vers le pied), quel que soit le zoom.
     */
    strike(camera: THREE.Camera, focus: THREE.Vector3, bounds: { minX: number; maxX: number; minY: number; maxY: number }, rng: () => number) {
      const d = camera.position.distanceTo(focus);
      fwd.subVectors(focus, camera.position).setY(0).normalize();
      side.set(-fwd.z, 0, fwd.x);
      // La caméra plonge vers le sol : un trait vertical monte vers le haut de l'image, il doit partir de la moitié haute de la vue
      bottom.copy(focus).addScaledVector(fwd, d * (0.15 * rng() - 0.03)).addScaledVector(side, d * (rng() - 0.5) * 0.7);
      bottom.x = THREE.MathUtils.clamp(bottom.x, bounds.minX, bounds.maxX);
      bottom.z = THREE.MathUtils.clamp(bottom.z, -bounds.maxY, -bounds.minY);
      bottom.y = focus.y - 20; // le pied, caché par le sol
      top.copy(bottom).addScaledVector(side, d * (rng() - 0.5) * 0.3).setY(focus.y + d * 0.9);
      const pts = boltPoints(top, bottom, side, rng);
      const w = d * 0.0025;
      for (let i = 0; i < N; i++) {
        const p = pts[i], q = pts[Math.min(N - 1, i + 1)], o = pts[Math.max(0, i - 1)];
        // Largeur perpendiculaire au trait et à la direction de la caméra, plus fine vers le pied ; dans cet ordre (caméra × trait),
        // les triangles font face à la caméra (matériau à une face : même programme que les anneaux)
        eye.subVectors(p, camera.position).cross(v.subVectors(q, o)).normalize().multiplyScalar(w * (1.2 - 0.6 * (i / (N - 1))));
        pos.set([p.x - eye.x, p.y - eye.y, p.z - eye.z, p.x + eye.x, p.y + eye.y, p.z + eye.z], i * 6);
      }
      geo.attributes.position.needsUpdate = true;
      geo.setDrawRange(0, index.length);
      left = LIGHTNING.bolt;
    },
    update(dt: number) {
      if (left <= 0) return;
      left -= dt;
      if (left <= 0) geo.setDrawRange(0, 0);
    },
  };
}
```

**`frontend/carte/src/weather/sky.test.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -1,10 +1,10 @@
 import { describe, expect, it } from 'vitest';
 import * as THREE from 'three';
-import { CLEAR_SKY, applyWeatherSky, overcastOf, type SkyValues } from './sky';
+import { CLEAR_SKY, STORM, applyWeatherSky, overcastOf, type SkyValues } from './sky';
 
 /** Valeurs de plein jour de daynight.ts (DAY) : ce que la scène affiche aujourd'hui */
 const day = (): SkyValues => ({
-  hemiI: 1.1, keyI: 2.4, exposure: 1.05, glow: 1,
+  hemiI: 1.1, keyI: 2.4, exposure: 1.05, glow: 1, lit: 0,
   sky: new THREE.Color('#fff4e0'), key: new THREE.Color('#ffe2b8'),
   bg: ['#fdf3e1', '#f0dfc4', '#d9c3a3'].map((c) => new THREE.Color(c)),
 });
@@ -49,3 +49,23 @@ describe('modificateur météo du ciel (EP009-US002)', () => {
     expect(overcastOf({ ...CLEAR_SKY, rain: 0.5 })).toBeCloseTo(0.45);
   });
 });
+
+describe('orage (EP009-US008)', () => {
+  it('de jour, plus sombre qu’une forte pluie (ambiance, exposition, fond), et la ville allume ses lumières', () => {
+    const rain = day(), storm = day();
+    applyWeatherSky(rain, { ...CLEAR_SKY, cloud: 1, rain: 0.85 }, 1);
+    applyWeatherSky(storm, { ...CLEAR_SKY, cloud: 1, rain: 0.85, storm: 1 }, 1);
+    expect(storm.hemiI).toBeLessThan(rain.hemiI);
+    expect(storm.exposure).toBeLessThan(rain.exposure);
+    storm.bg.forEach((c, i) => expect(c.r + c.g + c.b).toBeLessThan(rain.bg[i].r + rain.bg[i].g + rain.bg[i].b));
+    expect(rain.lit).toBe(0);
+    expect(storm.lit).toBe(STORM.lights);
+    expect(storm.keyI).toBe(rain.keyI); // le soleil voilé pareil : pas d'ombre à recalculer
+  });
+  it('la nuit, seules les lumières de la ville sont concernées (déjà allumées)', () => {
+    const rain = day(), storm = day();
+    applyWeatherSky(rain, { ...CLEAR_SKY, cloud: 1, rain: 0.85 }, 0);
+    applyWeatherSky(storm, { ...CLEAR_SKY, cloud: 1, rain: 0.85, storm: 1 }, 0);
+    expect([storm.hemiI, storm.exposure, storm.bg.map((c) => c.toArray())]).toEqual([rain.hemiI, rain.exposure, rain.bg.map((c) => c.toArray())]);
+  });
+});
```

**`frontend/carte/src/weather/sky.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -16,6 +16,8 @@ export const SKY_KEYS = ['cloud', 'rain', 'snow', 'fog', 'storm'] as const;
 
 /** Couverture nuageuse sans effet : jusqu'à 20 %, le ciel reste celui d'aujourd'hui (« ciel dégagé » vaut 5 %) */
 export const CLOUD_DEAD_ZONE = 0.2;
+/** Orage (US008) : plus sombre qu'une pluie, de jour ; lumières de la ville allumées au moins à cette part sous le ciel noir */
+export const STORM = { dark: 0.3, lights: 0.35 };
 
 /** Part de ciel couvert, de 0 à 1 : nuages au-delà de la zone morte, ou précipitations, brouillard, orage */
 export function overcastOf(w: SkyLook): number {
@@ -28,6 +30,8 @@ export interface SkyValues {
   hemiI: number; keyI: number; exposure: number;
   /** Gain des lueurs de nuit (halos des bars, lueur des rues) : 1 par défaut, plus fort sous la pluie (US005) */
   glow: number;
+  /** Lumières de la ville allumées au moins à cette part (0 à 1) : 0 par défaut, plus en plein jour sous l'orage (US008) */
+  lit: number;
   sky: THREE.Color; key: THREE.Color; bg: THREE.Color[];
 }
 
@@ -48,4 +52,11 @@ export function applyWeatherSky(v: SkyValues, w: SkyLook, dayF: number): void {
     c.lerp(grey.setRGB(l, l, l), 0.6 * o).multiplyScalar(1 - 0.06 * o * dayF);
   }
   v.exposure *= 1 - 0.07 * o * dayF;
+  if (w.storm > 0) { // orage : ciel noir, la ville allume ses lumières
+    const s = STORM.dark * w.storm * dayF;
+    v.hemiI *= 1 - s;
+    v.exposure *= 1 - 0.3 * s;
+    for (const c of v.bg) c.multiplyScalar(1 - 1.2 * s);
+    v.lit = STORM.lights * w.storm;
+  }
 }
```


#### Commit 3 (US010) — `feat(meteo): nuages de maquette autour du socle, en nombre selon la couverture, qui dérivent avec le vent (EP009-US010)`

Patch : `/private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/7058533b-187f-4f4d-8d7b-9497ad542537/scratchpad/u8/patches/us010.patch` (sur `0916456`) ; même commit reporté sur `6eace2f` : `/private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/7058533b-187f-4f4d-8d7b-9497ad542537/scratchpad/u8/patches/sur-6eace2f/us010.patch`.

**`frontend/carte/src/weather/clouds.test.ts`** (nouveau, complet)

```ts
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { WEATHER_PRESETS } from '../../../../contrat/meteo.js';
import { CLOUD_COUNT, cloudShare, createClouds } from './clouds';

const BOUNDS = { minX: -662.4, minY: -583.4, maxX: 662.4, maxY: 583.4 }; // socle de city.json

describe('nuages de maquette (EP009-US010)', () => {
  it('aucun par ciel dégagé ni sous 20 % de nuages, comme le ciel ; quelques-uns par éclaircies, tous par temps couvert', () => {
    expect(cloudShare(WEATHER_PRESETS.clear.cloudCover, 0, 12)).toBe(0);
    expect(cloudShare(0.2, 0, 12)).toBe(0);
    const partly = cloudShare(WEATHER_PRESETS.partly.cloudCover, 0, 12);
    expect(partly).toBeGreaterThan(2);
    expect(partly).toBeLessThan(6);
    expect(cloudShare(WEATHER_PRESETS.cloudy.cloudCover, 0, 12)).toBe(12);
    expect(cloudShare(WEATHER_PRESETS.rain.cloudCover, 0, 12)).toBe(12);
  });
  it('nombre croissant avec la couverture, sans saut', () => {
    for (let c = 0; c < 1; c += 0.01) {
      expect(cloudShare(c + 0.01, 0, 12)).toBeGreaterThanOrEqual(cloudShare(c, 0, 12));
      expect(cloudShare(c + 0.01, 0, 12) - cloudShare(c, 0, 12)).toBeLessThan(0.2);
    }
  });
  it('effacés par le brouillard (ils flotteraient, nets, au-dessus) ; aucun en qualité basse', () => {
    expect(cloudShare(1, WEATHER_PRESETS.fog.fog, 12)).toBe(0);
    expect(CLOUD_COUNT.low).toBe(0);
    expect(cloudShare(1, 0, CLOUD_COUNT.low)).toBe(0);
    expect(CLOUD_COUNT).toEqual({ low: 0, medium: 6, high: 12 });
  });
  it('un seul maillage instancié, posé hors du socle au départ, entre 130 et 260 m au-dessus du sol, toujours la même ronde', () => {
    const at = () => {
      const scene = new THREE.Scene();
      createClouds(scene, 12, BOUNDS, 250);
      const mesh = scene.getObjectByName('clouds') as THREE.InstancedMesh;
      const m = new THREE.Matrix4(), p = new THREE.Vector3();
      return Array.from({ length: mesh.count }, (_, i) => { mesh.getMatrixAt(i, m); return p.setFromMatrixPosition(m).toArray(); });
    };
    const a = at();
    expect(a.length).toBe(12);
    for (const [px, py, pz] of a) {
      expect(Math.max(Math.abs(px) - BOUNDS.maxX, Math.abs(pz) - BOUNDS.maxY)).toBeGreaterThanOrEqual(180);
      expect(py).toBeGreaterThanOrEqual(250 + 130);
      expect(py).toBeLessThanOrEqual(250 + 260);
    }
    expect(at()).toEqual(a);
  });
});
```

**`frontend/carte/src/weather/clouds.ts`** (nouveau, complet)

```ts
import * as THREE from 'three';
import type { QualityLevel } from '../scene/quality';
import type { CityData } from '../types';
import { CLOUD_DEAD_ZONE } from './sky';

/**
 * Nuages de maquette (EP009-US010), dans le module météo : des « boules de coton » (icosaèdres aplatis, à fond plat) qui flottent
 * autour du socle, en un seul maillage instancié (1 appel de rendu), avec un petit matériau éclairé à la main (1 programme, rapide à
 * compiler ; ni brouillard ni ombre). Tout se calcule dans le shader à partir de quelques uniformes : aucune mise à jour de tampon.
 *  - Nombre proportionnel à la couverture nuageuse (aucun sous 20 %, comme le ciel) ; ils apparaissent et s'effacent un à un, par
 *    tramage (pas de tri de transparence) ;
 *  - ils dérivent avec le vent dans une boîte autour du socle et s'effacent au-dessus de la ville (lisibilité), au bord de la boîte
 *    (pour revenir de l'autre côté sans saut) et quand ils sont plus près de la caméra que le point regardé ;
 *  - opaques sur le fond de page transparent : la correction des couleurs prémultipliées de la passe finale est mise pendant qu'ils
 *    sont là (effects.ts), sinon un liseré clair les entoure ;
 *  - aucun en qualité basse ; immobiles avec le réduit-mouvement.
 */

/** Nuages par niveau de qualité, à couverture complète */
export const CLOUD_COUNT: Record<QualityLevel, number> = { low: 0, medium: 6, high: 12 };
/** Dérive : m/s par m/s de vent « de maquette » (exagérée, sinon rien ne bouge à l'échelle du socle) */
export const CLOUD_DRIFT = 6;

/** Nuages visibles (nombre, avec une partie fractionnaire pour le fondu du dernier) selon la couverture et le brouillard */
export const cloudShare = (cloud: number, fog: number, max: number) =>
  max * Math.min(1, Math.max(0, (cloud - CLOUD_DEAD_ZONE) / (0.9 - CLOUD_DEAD_ZONE))) * (1 - Math.min(1, fog / 0.3));

/** Tirage reproductible : la même ronde de nuages à chaque visite */
const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

/** Une boule de coton : quelques icosaèdres fusionnés, aplatis, le fond écrasé ; environ 1 m de rayon */
function cottonGeometry(): THREE.BufferGeometry {
  const puffs: [number, number, number, number][] = [[0, 0, 0, 1], [0.95, -0.15, 0.2, 0.7], [-0.9, -0.1, -0.15, 0.75], [0.3, 0.4, -0.45, 0.62], [-0.35, 0.3, 0.5, 0.6], [1.6, -0.3, -0.1, 0.42], [-1.55, -0.3, 0.2, 0.45]];
  const parts = puffs.map(([px, py, pz, r]) => new THREE.IcosahedronGeometry(r, 1).translate(px, py, pz).getAttribute('position').array);
  const pos = new Float32Array(parts.reduce((n, a) => n + a.length, 0));
  parts.reduce((o, a) => { pos.set(a, o); return o + a.length; }, 0);
  for (let i = 1; i < pos.length; i += 3) { const y = pos[i] * 0.6; pos[i] = y < -0.2 ? -0.2 + (y + 0.2) * 0.15 : y; }
  return new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3));
}

const VERT = /* glsl */ `
  uniform vec3 uCenter; uniform vec2 uHalf, uDrift; uniform float uBox, uCount, uFocusDist;
  varying vec3 vWorld; varying float vFade;
  void main() {
    vec3 c = instanceMatrix[3].xyz;
    vec2 w = uCenter.xz + mod(c.xz + uDrift - uCenter.xz + uBox, 2.0 * uBox) - uBox; // centre après la dérive, replié dans la boîte
    vec2 e = abs(w - uCenter.xz);
    vec3 wc = vec3(w.x, c.y, w.y);
    vFade = clamp(uCount - float(gl_InstanceID), 0.0, 1.0)
      * smoothstep(0.0, 180.0, max(e.x - uHalf.x, e.y - uHalf.y))      // pas au-dessus de la ville
      * (1.0 - smoothstep(0.85 * uBox, uBox, max(e.x, e.y)))           // au bord de la boîte, avant de revenir de l'autre côté
      * smoothstep(0.85, 1.1, distance(cameraPosition, wc) / uFocusDist); // pas entre la caméra et le point regardé
    vec4 p = instanceMatrix * vec4(position, 1.0);
    p.xz += w - c.xz;
    vWorld = p.xyz;
    gl_Position = vFade > 0.0 ? projectionMatrix * viewMatrix * p : vec4(2.0, 2.0, 2.0, 1.0);
  }`;
const FRAG = /* glsl */ `
  uniform vec3 uLight, uShade;
  varying vec3 vWorld; varying float vFade;
  void main() {
    // Fondu par tramage, comme les monuments qui s'effacent (cutaway.ts) : pas de tri de transparence
    if (vFade < 0.999 && vFade <= fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))) discard;
    vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld))); // facettes, comme le reste de la maquette
    gl_FragColor = vec4(mix(uShade, uLight, smoothstep(-0.5, 0.9, n.y)), 1.0);
  }`;

const DAY = { light: new THREE.Color('#ffffff').multiplyScalar(1.25), shade: new THREE.Color('#c7cfdc') };
const NIGHT = { light: new THREE.Color('#6b7596'), shade: new THREE.Color('#2e3552') };
const GREY = { light: new THREE.Color('#d9dce2'), shade: new THREE.Color('#8e95a3') };

export function createClouds(scene: THREE.Scene, count: number, bounds: CityData['bounds'], groundY: number) {
  const hx = (bounds.maxX - bounds.minX) / 2, hz = (bounds.maxY - bounds.minY) / 2, size = 2 * Math.max(hx, hz);
  const center = new THREE.Vector3((bounds.minX + bounds.maxX) / 2, groundY, -(bounds.minY + bounds.maxY) / 2);
  const box = Math.max(hx, hz) + 0.5 * size;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uCenter: { value: center }, uHalf: { value: new THREE.Vector2(hx, hz) }, uDrift: { value: new THREE.Vector2() },
      uBox: { value: box }, uCount: { value: 0 }, uFocusDist: { value: 1 },
      uLight: { value: DAY.light.clone() }, uShade: { value: DAY.shade.clone() },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
  });
  const mesh = new THREE.InstancedMesh(cottonGeometry(), material, count);
  mesh.name = 'clouds';
  mesh.frustumCulled = false; // positions déplacées dans le shader
  mesh.visible = false;
  // Hors du socle au départ (entre son bord et celui de la boîte), à 130 à 260 m au-dessus du sol, 50 à 95 m de rayon (environ)
  const r = seeded(9), m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < count; i++) {
    do p.set((r() * 2 - 1) * box * 0.85, 0, (r() * 2 - 1) * box * 0.85); while (Math.max(Math.abs(p.x) - hx, Math.abs(p.z) - hz) < 180);
    p.add(center).setY(groundY + 130 + r() * 130);
    q.setFromAxisAngle(up, r() * Math.PI * 2);
    mesh.setMatrixAt(i, m.compose(p, q, s.setScalar(50 + r() * 45)));
  }
  scene.add(mesh);
  const u = material.uniforms;
  return {
    /**
     * À chaque image où il y a des nuages. share : nuages visibles (cloudShare) ; d : distance caméra – point regardé ;
     * wind : m/s « de maquette » et direction où il va (degrés) ; grey : part de ciel de pluie (0..1) ; slow : 0 avec le réduit-mouvement.
     */
    update(dt: number, share: number, d: number, wind: { speed: number; towards: number }, night: number, grey: number, slow: number) {
      mesh.visible = share > 0.01;
      if (!mesh.visible) return;
      const a = (wind.towards * Math.PI) / 180, k = wind.speed * CLOUD_DRIFT * dt * slow;
      u.uDrift.value.set((u.uDrift.value.x + Math.cos(a) * k) % (2 * box), (u.uDrift.value.y - Math.sin(a) * k) % (2 * box));
      u.uCount.value = share;
      u.uFocusDist.value = d;
      u.uLight.value.copy(DAY.light).lerp(GREY.light, grey).lerp(NIGHT.light, night);
      u.uShade.value.copy(DAY.shade).lerp(GREY.shade, grey).lerp(NIGHT.shade, night);
    },
    /** Appels de rendu des nuages à cette image (0 ou 1) */
    visible: () => +mesh.visible,
  };
}
export type Clouds = ReturnType<typeof createClouds>;
```

**`frontend/carte/src/weather/effects.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -6,6 +6,7 @@ import { fogColorFor, fogRange } from './fog';
 import { FULL_BUDGET, nextBudget, type RainBudget } from './budget';
 import { RAIN_COUNT, SNOW_COUNT, createRain, type PrecipKind, type Rain } from './rain';
 import { createBolt, createLightning } from './lightning';
+import { CLOUD_COUNT, cloudShare, createClouds, type Clouds } from './clouds';
 import type { SkyValues } from './sky';
 import { approach, windVisual, type WeatherLook } from './state';
 
@@ -22,6 +23,7 @@ import { approach, windVisual, type WeatherLook } from './state';
  *  - Neige (US007) : deux nappes de flocons (même système), neige au sol qui s'accumule et fond, même règle de dégradation.
  *  - Vent (US009) : l'objet partagé que lisent la fumée et les drapeaux suit la météo (fondu de 6 s) ; balancement des arbres.
  *  - Orage (US008) : éclairs (passe finale, lumière d'ambiance, ciel et fond de page) et trait d'éclair, aucun avec le réduit-mouvement.
+ *  - Nuages de maquette (US010) : autour du socle, en nombre selon la couverture, qui dérivent avec le vent (un programme, à leur arrivée).
  */
 export interface EffectsCtx {
   scene: THREE.Scene;
@@ -73,10 +75,10 @@ export function createEffects(ctx: EffectsCtx, reduced: () => boolean) {
   const edge: [number, number, number] = [1, 1, 1];
   let exposure = 1;
   const rgb = { r: 0, g: 0, b: 0 };
-  let fogOn = false, cover = false;
+  let fogOn = false, cover = false, unpremult = 0;
 
   // Halos des bars (lueur additive) : avec la correction des couleurs prémultipliées, leur alpha (qui n'est pas une couverture)
-  // les éteindrait au-dessus du fond de page ; pendant le brouillard, ils passent « par-dessus » (l'alpha devient une couverture).
+  // les éteindrait au-dessus du fond de page ; pendant la correction, ils passent « par-dessus » (l'alpha devient une couverture).
   // Le mélange est un état du pilote graphique, pas du programme : aucune recompilation.
   const haloMats: THREE.PointsMaterial[] = [];
   ctx.scene.getObjectByName('placeHalos')?.traverse((o) => {
@@ -103,6 +105,7 @@ export function createEffects(ctx: EffectsCtx, reduced: () => boolean) {
   // Orage : éclairs planifiés (au plus 3 par seconde), trait d'éclair créé au premier (pas en qualité basse)
   const lightning = createLightning();
   let bolt: ReturnType<typeof createBolt> | null = null;
+  let clouds: Clouds | null = null;
 
   return {
     /** Appelé par le modificateur du ciel (daynight.ts), une fois la météo appliquée : fond de page et exposition finals */
@@ -135,8 +138,13 @@ export function createEffects(ctx: EffectsCtx, reduced: () => boolean) {
           const [cr, cg, cb] = fogColorFor(edge, exposure);
           fog.color.setRGB(cr, cg, cb, THREE.LinearSRGBColorSpace);
         }
-        const u = Math.min(1, k / UNPREMULT_FULL);
-        ctx.post({ unpremult: u, veil: FOG_VEIL * k, veilColor: edge });
+        ctx.post({ veil: FOG_VEIL * k, veilColor: edge });
+      }
+      // Correction des couleurs prémultipliées (bords sur le fond de page, sinon liseré clair) : brouillard, nuages (US010)
+      const u = Math.max(Math.min(1, k / UNPREMULT_FULL), clouds?.visible() ?? 0);
+      if (u !== unpremult) {
+        unpremult = u;
+        ctx.post({ unpremult: u });
         if (u > 0 !== cover) { cover = u > 0; halos(cover); }
       }
       // Pluie et neige : deux nappes chacune, autour du point regardé et sur tout le socle (ralenties avec le réduit-mouvement)
@@ -163,6 +171,13 @@ export function createEffects(ctx: EffectsCtx, reduced: () => boolean) {
       bolt?.update(dt);
       const sky = strike.flash * look.storm !== flash;
       if (sky) { flash = strike.flash * look.storm; ctx.post({ flash: FLASH.post * flash }); }
+      // Nuages de maquette : créés à la première couverture nuageuse (aucun en qualité basse), immobiles avec le réduit-mouvement
+      const share = cloudShare(look.cloud, look.fog, CLOUD_COUNT[ctx.quality]);
+      if (share > 0.01 || clouds?.visible()) {
+        const f = ctx.focus();
+        (clouds ??= createClouds(ctx.scene, CLOUD_COUNT[ctx.quality], ctx.bounds, f.y))
+          .update(dt, share, ctx.camera.position.distanceTo(f), { speed: look.windSpeed, towards: look.windTowards }, ctx.night(), Math.min(1, 1.5 * look.rain + look.snow + look.storm), reduced() ? 0 : 1);
+      }
       // Neige au sol : s'accumule en une minute environ, fond en quelques minutes
       const lyingTarget = Math.min(1, look.snow * SNOW_COVER.perSnow);
       if (lying !== lyingTarget) {
```


---

## 5. Tests (Vitest, projet `carte` : 87 → 103 tests, 11 → 13 fichiers ; 88 → 104 sur `6eace2f`)

- `scene/weather-surface.test.ts` (+1, et l'uniforme `uSway` à 0 par défaut) : balancement dans le vertex shader après `begin_vertex`,
  seulement avec `sway`, fragment identique, clé `…|sway`.
- `weather/effects.test.ts` (+3) : rien jusqu'à 25 km/h ni par le vent de beau temps ; croissant jusqu'à 60 km/h puis plafonné ; rien en
  qualité basse ni en réduit-mouvement.
- `weather/lightning.test.ts` (nouveau, 6) : 1 000 salves (1 à 3 éclairs, ≥ 0,4 s, amplitude 0,3 à 0,6, décroissance 120 à 250 ms, trait
  sur le premier) ; **4 h simulées à 30, 60 et 144 img/s : jamais 4 éclairs en une seconde**, écarts 0,4 à 0,9 s ou 6 à 20 s ; une seule
  impulsion par éclair ; inactif → jamais rien, coupé net ; première salve 2 à 6 s ; trait de 32 segments.
- `weather/sky.test.ts` (+2) : orage de jour plus sombre qu'une pluie de 0,85 (ambiance, exposition, fond) et lumières à 35 %, soleil
  inchangé ; la nuit, rien d'autre.
- `weather/clouds.test.ts` (nouveau, 4) : aucun nuage par ciel dégagé ni sous 20 %, quelques-uns par éclaircies, tous par temps couvert ;
  croissant sans saut ; effacés par le brouillard, aucun en qualité basse ; un maillage, hors du socle, altitude bornée, même tirage à
  chaque fois.

---

## 6. Vérifications

**Agent, navigateur, puce graphique du Mac** (`mesures/us009.mjs`, `us008.mjs`, `us010.mjs`, `us00{8,9}-shots.mjs`, `probe-bolt*.mjs` ;
build final servi sur 4221, `0916456` sur 4222 ; sorties `mesures/us009-cout.txt`, `us008.txt`, `us008-v2.txt`, `us008-final.txt`,
`us010.txt`, `us010-v2.txt`, `us010-cout.txt`).

**Sans météo** (chaque commit) : lumières, fond, rotation du drapeau et appels **identiques** à `0916456` (2 407 / 2 407 à 12 h, 2 409 /
2 409 à 22 h) ; programmes **46 / 46 et 45 / 45** [mesuré] : le crochet du balancement n'ajoute aucun programme au démarrage (les arbres
modélisés et les houppiers avaient déjà le leur).

**Vent** (`us009.mjs`) :
1. Vent 60 km/h venant de 200° (depuis le couvert, en mouvement, `high`, `medium`, `low`) : drapeau 8° → 32 → 47 → 56 → 62° à 3, 6, 9,
   12 s (cible 70°) ; vent de maquette 2,98 → 5,17 m/s ; balancement `[0,0047 ; t ; 0,48 ; −0,88]` (0 en `low`) ; **programmes 43 → 43**,
   pire intervalle 19 à 20 ms, pire image processeur ≤ 5,7 ms [mesuré].
2. Réduit-mouvement : balancement 0, le drapeau suit quand même le vent (68,6°) [mesuré].
3. Le balancement se voit : différence entre deux images à 1,2 s, `us009-jour-parc-diff.png` (houppiers et arbres modélisés soulignés en
   rouge) contre `us009-sans-vent-jour-parc-diff.png` (seuls passants, éléphants, fumée) : 26 058 contre 6 862 pixels qui bougent [mesuré].
4. **Coût** (vent 60 / vent 10 en alternance, même page, 3 tours) : `high` ensemble 59,99 → 60,00 img/s, GPU 8,06 → 8,11 ms (± 0,21) en
   mouvement, 8,63 → 8,54 au repos ; rue 5,68 → 5,69 ; `medium` ensemble 8,00 → 8,15 (± 0,11), rue 5,58 → 5,57 ; **crochet inactif contre
   la base** (pages alternées) : ensemble 7,99 → 8,05 ms (± 0,09), rue 5,50 → 5,49 [mesuré] : dans le bruit. Les arbres font ≈ 80 % des
   triangles : **le téléphone reste à mesurer** (R3).

**Orage** (`us008.mjs`, 75 s enregistrées image par image, de jour et de nuit, `high`, `medium`, `low`) :
1. **Arrivée** (depuis le couvert, en mouvement, build final) : 10 à 11 éclairs en 75 s, **au plus 2 par seconde** observés, écarts
   0,4 à 0,9 s dans une salve et 6,7 à 19,7 s entre deux salves ; 6 traits en `high` (0 en `low`) ; **pire intervalle 24 à 25 ms**, pendant
   un éclair 18 à 21 ms ; pire image processeur ≤ 16,4 ms ; **0 demande de carte d'ombres** ; `us008-final.txt` [mesuré].
2. **Programmes** : celui de la pluie (+1, US005 ; 0 si la pluie est déjà venue) ; **0 au premier trait** (programme des anneaux) ; de jour,
   si la page a été ouverte de jour, **+1 pour les halos des bars**, qui s'allument pour la première fois de la visite avec les lumières de
   la ville (`probe-progs-orage.mjs`) : 2 programmes en tout à l'arrivée d'un orage de jour, pire image 25 ms [mesuré]. Avant la correction
   du matériau du trait : +1 de plus au premier trait et 82 à 92 ms d'image figée la première fois (`us008.txt`).
3. Mêmes mesures de jour et de nuit en `high`, `medium` et `low` avant les derniers réglages du trait (`us008-v2.txt`) : 11 à 14 éclairs en
   75 s, au plus 2 par seconde, pires intervalles 23 à 24 ms.
4. **Réduit-mouvement** (réglage du système) et **« Effets réduits »** (préférence du panneau) : 0 éclair et aucun trait en 45 s [mesuré].
5. **Coût** (orage / pluie de 0,85 en alternance, même page, 3 tours de 20 s) : ensemble 60,00 → 60,00 img/s, GPU 7,98 → 7,93 ms, pire
   image 18,6 → 19,1 ms ; rue 60 → 60, GPU 5,66 → 5,68 ms [mesuré].

**Nuages** (`us010.mjs`) :
1. Arrivée (dégagé → éclaircies → couvert, en mouvement) : `high` 3,8 puis 12 nuages, **programmes 45 → 46 → 46**, pire intervalle 19 ms,
   appels +1 ; `medium` 1,9 puis 6, idem ; `low` : aucun maillage, aucun programme [mesuré].
2. Dérive à 60 km/h venant de 200° : ≈ 34 m/s vers 70° (170 m en 5 s) ; en rue, aucun nuage dans la vue ; brouillard : maillage masqué ;
   réduit-mouvement : dérive nulle [mesuré].
3. Nuit couverte : halos des bars passés « par-dessus » (mélange 5) avec la correction, additifs (2) sans météo [vérifié].
4. **Coût** (couvert avec 12 nuages / couvert à 20 % de nuages, alternés) : 60,02 → 60,00 img/s, GPU 7,98 → 8,05 ms en mouvement ; 30 → 30,
   8,23 → 8,36 au repos ; +1 appel [mesuré].

**Pour Dasco** : `?weather=thunder` (attendre 2 à 6 s le premier éclair), de jour et de nuit (`?hour=22` ou le curseur), dans les quatre vues ;
`?weather=thunder&wind=60` (orage avec vent fort : arbres) ; `?weather=cloudy&wind=60&windfrom=200` (drapeau du château, fumée, arbres,
nuages qui dérivent) ; `?weather=partly` ; « Effets réduits » dans le panneau de la puce : plus d'éclair ni de balancement ; sur l'iPhone,
le compteur `?debug`.

---

## 7. Captures regardées, et ce qui reste à régler à l'œil

Dossier : `/private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/7058533b-187f-4f4d-8d7b-9497ad542537/scratchpad/mesures/captures/` (1280 × 800, densité 1).

| Sujet | Fichiers |
|---|---|
| Vent 60 km/h d'où 200° : château (drapeau), rue (fumée), parc ; différences à 1,2 s | `us009-jour-{chateau,rue,parc}.png`, `us009-jour-*-diff.png` |
| Même vues, vent de beau temps (couvert) | `us009-sans-vent-jour-*.png` et `-diff.png` |
| Orage, quatre vues, de jour et de nuit, entre deux éclairs | `us008-v4-{jour,nuit}-{ensemble,carre,chateau,rue}.png` |
| Les mêmes, figées sur l'image d'un éclair (trait visible) | `us008-v4-{jour,nuit}-*-eclair.png` |
| Premier réglage, rejeté (flash délavé, trait invisible) | `us008-v1-flash-trop-fort-{jour-chateau,nuit-rue}.png` |
| Nuages : éclaircies et couvert, quatre vues, jour et nuit | `us010-{eclaircies,couvert}-{jour,nuit}-{ensemble,carre,chateau,rue}.png` |

**À régler à l'œil** (constantes nommées, une ligne chacune) :
1. **Éclair** (`FLASH`) : `post 0,35`, `hemi 0,9`, `sky 0,5`, `bg 0,35`. Au premier réglage (passe finale 0,3 à 0,6 comme R2, ambiance
   × 2,5), l'image entière virait au blanc délavé (`us008-v1-*`) : R2 est à corriger (section 10).
2. **Trait** : épaisseur (`d × 0,0025`), place (à la distance du point regardé), couleur. En vue d'ensemble il descend du haut de l'écran sur
   le fond de page (`us008-v4-jour-ensemble-eclair.png`) ; dans la rue, il tombe entre les immeubles (`us008-v4-jour-rue-eclair.png`).
3. **Ciel d'orage** (`STORM`) : fond de page gris foncé de jour, ville sombre, fenêtres allumées (question 1).
4. **Fumée par grand vent** : les bouffées s'espacent (chapelet de points, `us009-jour-chateau.png`, en haut) ; plus de bouffées par vent
   fort serait une ligne dans `chimneys.ts` (+ octets dans le fichier principal), non fait.
5. **Drapeaux** : avec n'importe quel `?weather=` ou relevé réel à 10 km/h, ils claquent 1,4 fois plus vite qu'aujourd'hui (le vent de
   `life.json` vaut ≈ 3 km/h) ; plafonné vers 27 km/h.
6. **Nuages** : taille, altitude, nombre visible (en vue d'ensemble, 2 à 4 par éclaircies, 6 à 9 par temps couvert : ceux de devant sont
   effacés) ; le tramage se voit pendant qu'un nuage entre ou sort (bord de la ville, de la boîte) ; teinte de nuit (lavande).

---

## 8. Poids [mesuré, gzip, Node zlib niveau 6 ; Vite entre parenthèses]

| Chunk | `a9424e9` | `0916456` (base) | US009 | US008 | US010 |
|---|---|---|---|---|---|
| Principal | 84 231 o | 86 908 o (88,19 ko) | 87 169 o (88,47) | 87 184 o (88,49) | **87 181 o (88,49) : +273 o ; +2 950 o depuis `a9424e9`** |
| Module météo (`weather-*.js`) | — | 9 738 o | 9 905 o | 11 040 o | **12 595 o (+2 857 o)** |
| Sur `6eace2f` : principal / météo | — | 86 907 / 9 820 | 87 171 / 9 984 | 87 179 / 11 129 | **87 181 / 12 684** |

- **Fichier principal** : le vent prend tout (+261 o : GLSL du balancement ≈ 130 o, option `sway`, fumée et drapeaux qui relisent le vent) ;
  l'orage 15 o (`lit` dans `daynight.ts`) ; les nuages rien. **Reste ≈ 0,55 Ko** sous le plafond de 3,5 Ko par ma mesure (≈ 0,48 avec le
  compte Vite de l'agent principal, +3,02). Le balancement a été réduit pour ça (une seule sinusoïde, sans `#ifdef` : −37 o).
- **Module météo** : 12,6 Ko, au-delà de l'estimation de la règle 12 (« 8 à 10 Ko une fois complet ») : orage (+1,1 Ko, planificateur et
  trait) et nuages (+1,5 Ko). Chargé à la demande : sans effet sur le premier affichage (section 10, point 13).

---

## 9. Appliquer le plan

Patchs : `/private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/7058533b-187f-4f4d-8d7b-9497ad542537/scratchpad/u8/patches/` (`us009.patch`, `us008.patch`, `us010.patch`, sur `0916456`) et
`/private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/7058533b-187f-4f4d-8d7b-9497ad542537/scratchpad/u8/patches/sur-6eace2f/` (les mêmes, sur la tête actuelle de l'epic). Depuis la racine du dépôt, sur chaque branche d'US :

```bash
P=/private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/7058533b-187f-4f4d-8d7b-9497ad542537/scratchpad/u8/patches/sur-6eace2f
git apply --check $P/us009.patch && git apply $P/us009.patch
npm run build && npm test   # puis git commit avec le message de la section 2 ; idem pour us008 puis us010
```

- **Report sur `6eace2f`** (conflits avec la neige d'ambiance, résolus en gardant les deux) : l'import d'`effects.test.ts`
  (`SNOW_COVER, SWAY, WET, WINTER_SNOW, lyingTarget, swayAmount`), les constantes après `SNOW_COVER` (neige d'ambiance puis balancement), la
  ligne `let wet = 0, glow = 1, lying = 0, winter = false, swayT = 0, flash = 0;`. Rien d'autre ne change.
- **Vérifié** : les 3 patchs s'appliquent dans l'ordre sur une archive de `0916456` et, ceux de `sur-6eace2f`, sur une archive de `6eace2f`
  (`git apply --check` passe aussi sur le dépôt réel, sans rien écrire) ; après chacun : `tsc` carte, contrat et back, `check-boundaries`,
  Vitest (carte, contrat, outillage : 121, 129, 133 tests sur `0916456` ; 122, 130, 134 sur `6eace2f`) et build de la carte passent
  (`u8/verif-0916456.txt`, `u8/verif-6eace2f.txt`) ; sur les deux états finaux, `npm run build` et `npm test` passent (26 fichiers ; **240 tests** sur `0916456`, 241 sur `6eace2f` ; `u8/applytest*-npm-*.log`). L'état final est exactement celui des dépôts de
  travail mesurés (`u8/work`, branches `main` et `sur-6eace2f`). Le code de ce document **est** celui des patchs (produit à partir d'eux).

---

## 10. Points de la spec à corriger ou à préciser

1. **US009 R1** : l'objet `wind` partagé existe depuis US002 ; US009 le fait varier **depuis le module météo** (`weather/effects.ts`, à
   chaque image), la fumée le relit toutes les 0,5 s et les drapeaux à chaque image. À écrire.
2. **US009 CA 1, « en 6 s environ »** : fondu exponentiel de τ = 6 s : 63 % du chemin en 6 s, 95 % en 18 s (mesuré : 8° → 62° en 12 s vers
   70°). « Tournent en quelques secondes » serait plus juste.
3. **US009 R2, vitesse de maquette** : `WIND_VISUAL` (US002) inchangé ; les drapeaux ont leur propre règle, relative au vent de `life.json`,
   plafonnée vers 27 km/h (section 3.1). À noter, avec la conséquence de la section 7, point 5.
4. **US009 CA 2** : balancement **progressif** de 25 à 60 km/h (pas un seuil), 0,6 m en haut d'un arbre de 10 m au plus ; **en `medium`
   comme en `high`, arbres simples et modélisés** (le plan v2 prévoyait « arbres simples » en `medium`) : coût dans le bruit sur le Mac.
   À écrire, et à revoir après la mesure sur téléphone.
5. **US009 CA 3 (feuilles en automne, facultatif)** : non fait. ≈ 0,5 j, particules CPU, et des octets dans le fichier principal si c'est
   la fumée qui les porte [estimé].
6. **US008 R2** : « `uFlash` 0,3 à 0,6 » délave toute l'image ; retenu : intensité 0,3 à 0,6 par éclair, passe finale `× 0,35`, ambiance
   `× 0,9`, **et le ciel et le fond de page** (non prévus) s'éclairent aussi (question 2). À réécrire.
7. **US008 R3** : 32 segments (pas « environ 40 ») ; programme partagé avec les anneaux des gemmes grâce à une normale inutilisée (sans
   elle : +1 programme, image figée de 82 à 92 ms au premier trait). À écrire dans R3 (règle 9).
8. **US008 CA 2** : « 6 à 20 s entre deux salves » compté de la fin d'une salve au début de la suivante ; **première salve 2 à 6 s** après
   l'arrivée de l'orage (pour qu'une démo n'attende pas). À écrire.
9. **US008 CA 1, « ciel assombri »** : précisé (`STORM`) : de jour, ambiance −30 %, exposition −9 %, fond −36 % de plus qu'une forte pluie.
10. **US008 CA 5** : lumières de la ville à 35 % sous l'orage de jour (fenêtres, halos des bars, lueur des rues ; les oiseaux s'effacent à
    moitié, puisqu'ils suivent la même lueur de nuit). Fait, à juger (question 1).
11. **US008 et le vent** : les valeurs types du contrat donnent 10 km/h à toutes les conditions, orage compris : `?weather=thunder` et
    l'orage forcé par l'admin n'agitent pas les arbres (question 3).
12. **US010 CA 2** : en plus de la caméra qui s'approche, les nuages **ne passent jamais au-dessus de la ville** (fondu à son bord), ni entre
    la caméra et le point regardé, et disparaissent dans le brouillard. Conséquence : aucun en vue de rue. À écrire (question 3 bis
    dans les questions si Dasco veut autre chose).
13. **Règle 12** : module météo à 12,6 Ko (estimation « 8 à 10 Ko ») ; chargé à la demande : corriger l'estimation plutôt que rogner.
14. **US010 et la passe finale** : la correction des couleurs prémultipliées (US002, réservée au brouillard) sert aussi aux nuages. À dire
    dans US010 (et dans le commentaire d'US006 de la spec, s'il y en a un).
15. **Epic, « Non vérifié »** : « orage, vent, nuages : non prototypés » devient « codés et mesurés sur le Mac, pas sur téléphone ».

---

## 11. Vraies questions pour Dasco

1. **Lumières de la ville sous l'orage, en plein jour** : sous un orage de jour, le ciel devient très sombre et la ville allume ses
   lumières à 35 % : fenêtres, halos des bars et lueur des rues, comme au crépuscule (`us008-v4-jour-rue.png`). C'est ce que demandait le
   critère « à juger avec Dasco ». Plus bas, la ville paraît éteinte sous le ciel noir ; plus haut, on croit à la nuit. **Les gardes-tu à
   ce niveau, les veux-tu plus fortes, ou pas du tout ?**
   Recommandé : garder 35 % (une constante, `STORM.lights`).
2. **Éclair sur tout l'écran** : à chaque éclair, la maquette s'illumine et le fond de page aussi, un court instant (au plus 3 éclairs par
   seconde, 1 à 3 par salve, 6 à 20 s entre deux salves, jamais avec « Effets réduits » ni le réglage du système). Le fond qui s'éclaire,
   c'est ce qui fait « orage » ; mais c'est tout l'écran qui change de luminosité, ce qui peut gêner les yeux sensibles même dans les
   règles d'accessibilité. **Veux-tu que l'éclair éclaire aussi le fond de page, ou seulement la maquette ?**
   Recommandé : garder le fond, modéré comme maintenant (`FLASH.bg = 0,35`) ; le mettre à 0 si tu as le moindre doute.
3. **Orage de démonstration sans vent** : un vrai orage arrive avec son vent mesuré, et les arbres se balancent au-delà de 25 km/h. Mais
   l'orage forcé (par l'adresse `?weather=thunder` ou depuis l'admin) prend le vent des valeurs types du contrat, 10 km/h pour toutes les
   conditions : les arbres restent immobiles pendant la démo, sauf à ajouter `&wind=60` à l'adresse. **Veux-tu un vent fort par défaut pour
   l'orage forcé ?**
   Recommandé : oui, 50 km/h d'ouest pour l'orage seulement, dans les valeurs types du contrat (le forçage de l'admin suit les mêmes) :
   quelques lignes dans `contrat/meteo.ts`, la carte et le back, avec leurs tests ; dans une petite US à part ou avec US011.

---

## 12. Vérifié / non vérifié

**Vérifié** (copies, jamais dans le dépôt) :
- Les 3 patchs s'appliquent dans l'ordre sur `0916456`, et leur report sur `6eace2f` ; après chacun : types, frontières (avec la règle
  `z…()`), Vitest et build de la carte ; à la fin, `npm run build` et `npm test` complets.
- Sans météo : image, appels et programmes identiques à `0916456`.
- Vent : drapeaux et fumée qui suivent la direction et la force ; arbres qui se balancent (différence d'images) ; rien en `low` ni en
  réduit-mouvement ; 0 programme.
- Orage : jamais plus de 2 éclairs par seconde observés (3 au plus par construction, testé) ; salves espacées de 6 à 20 s ; trait visible,
  sans compilation ; aucun en `low` ; aucun éclair ni trait en réduit-mouvement et avec « Effets réduits » ; aucune carte d'ombres
  recalculée ; pires images de 25 ms au plus.
- Nuages : 1 programme à l'arrivée, nombre selon la couverture et le niveau, dérive au vent, absents en rue, dans le brouillard et en
  `low`, immobiles en réduit-mouvement ; pas de liseré ; halos des bars intacts la nuit.

**Mesuré, sur le Mac seulement** (Apple M1, Metal, sans fenêtre, plafonné à 60 img/s) : pires images, coût par image (dans le bruit), poids.

**Non vérifié** :
- **Aucun téléphone** : ni le balancement des arbres (≈ 80 % des triangles, branche de vertex shader prise sur chaque sommet des arbres
  par vent fort), ni les éclairs (recalcul du ciel aux images d'éclair, fond de page repeint), ni les nuages.
- Safari et WebKit : non essayés (`gl_InstanceID` et `dFdx` sont du WebGL 2 standard, comme le reste).
- Aucun vrai orage ni vrai vent fort de la route `/api/weather` (copies sans API) : seulement `?weather=` et `window.diorama.weather.set()`.
- Le rendu « au goût de Dasco » : intensité des éclairs, ciel d'orage, lumières de jour, nuages (sections 7 et 11).
- Aucun enregistrement vidéo : le mouvement (drapeaux, arbres, dérive) n'a été vu que sur des captures fixes, des différences d'images et
  des valeurs relevées dans la page.
- La photosensibilité au-delà de la règle des 3 éclairs par seconde (seuil de surface et de luminance de WCAG 2.3.1) : non mesurée.

---

## 13. Scripts et fichiers de la session

Dossier : `/private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/7058533b-187f-4f4d-8d7b-9497ad542537/scratchpad/` ; scripts dans `mesures/` (Playwright du cache npx, Chrome for Testing 145, Metal, 1280 × 800, densité 1). Lancer
avec `BASE=http://localhost:4221 REF=http://localhost:4222` ; builds servis par `npx vite preview frontend/carte --port 4221 --strictPort`
dans `u8/work/` (état final, branche `main`) et `u8/base/` (`0916456`), proxy de Vite pointé vers 8827 dans ces copies seulement.

| Fichier | Rôle |
|---|---|
| `mesures/us009.mjs` (`ONLY=A…E`), `us009-shots.mjs` (`DIFF=1`, `Q`, `TAG`) | Vent : sans météo, arrivée, coût (`C`), réduit-mouvement ; captures et différences d'images |
| `mesures/us008.mjs` (`ONLY=A…D`), `us008-shots.mjs` (`Q`, `TAG`, `HOURS`, `VIEWS`, `FLASH`, `PREFIX`) | Orage : enregistrement image par image, éclairs, programmes, ombres, coût ; captures figées sur un éclair (gel de `requestAnimationFrame`) |
| `mesures/us010.mjs` (`ONLY=A…E`) | Nuages : arrivée, coût, dérive, rue, brouillard, réduit-mouvement, halos de nuit |
| `mesures/probe-bolt*.mjs` | Programmes des matériaux de base, projection et copie persistante du trait (diagnostics) |
| `mesures/us009-cout.txt`, `us008*.txt`, `us010*.txt` | Sorties |
| `u8/patches/`, `u8/patches/sur-6eace2f/`, `u8/work/` (branches `main`, `sur-6eace2f`), `u8/applytest*/`, `u8/verif8.sh`, `u8/verif-*.txt`, `u8/build-plan8.py` | Patchs, dépôts de travail, contrôles par commit, assemblage de ce document |
