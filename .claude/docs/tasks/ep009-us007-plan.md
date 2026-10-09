# Plan prêt à coder : EP009 — US007 (neige), carte

Rédigé le 10/10/2026 par l'agent chercheur / planificateur front 3D. **Aucun fichier du dépôt modifié**, sauf ce plan.
Point de départ : **`976841d`** (`feat/EP009-meteo` ; rien d'autre ne bouge dans `frontend/carte` pendant ce travail).
Sources : [US007](../specs/epics/EP009-meteo-en-direct/US007-neige.md), [l'epic](../specs/epics/EP009-meteo-en-direct/epic.md) (règles 6, 8, 9,
10, 12 ; D11), [plan front v2](ep009-front-plan-v2.md) § 2.4, 2.8 et 4.4, [le plan d'US006 et US005](ep009-us006-us005-plan.md), le BACKLOG
(« Hiver : reprendre les arbres »).

Légende : **[mesuré]** = mesuré le 10/10/2026 sur le Mac (Apple M1, Chrome for Testing 145 sans fenêtre, ANGLE Metal, vraie puce
graphique), **jamais sur un téléphone** ; **[vérifié]** = constaté dans une copie du dépôt (types, tests, build, navigateur) ;
**[estimé]** = non mesuré ; **[à l'œil]** = jugé sur les captures, à confirmer par Dasco.

---

## 0. En bref

- **Tout le code a été appliqué et vérifié dans une copie** (archive de `976841d`) : 3 commits, un patch chacun, chacun vérifié (`tsc`
  carte, contrat et back, `check-boundaries`, Vitest, build de la carte) ; à la fin, `npm run build` et `npm test` passent (22 fichiers,
  **196 tests** ; 187 avant). Navigateur avec la puce graphique du Mac (ports 4201 et 4202, API 8807).
- **Neige au sol** : le crochet d'US005 (`scene/weather-surface.ts`) devient **un seul morceau de GLSL pour le mouillé et la neige**
  (`uWet`, `uSnow`), posé au démarrage sur **12 matériaux** : les 4 d'US005 (rues pavées et goudronnées, bâtiments et toits, sol avec ses
  parcs) et 8 de plus (houppiers des arbres simples, arbres modélisés, cheminées, auvents, toits de la cathédrale, du Carré Curial ×2 et du
  château). Ce qui regarde le ciel blanchit **selon la pente** (pleinement sous 45°, rien au-delà de 73° : jamais les façades), **par
  plaques** qui s'étendent, vers un blanc bleuté un peu cassé. Chaque matériau a sa part (uniformes à lui, même programme) : les arbres,
  cheminées, auvents et toits des monuments ne se mouillent pas (la pluie validée ne change pas), les chaussées blanchissent à 55 %, les
  voies piétonnes à 80 %.
- **Flocons** : le système GPU de la pluie (`weather/rain.ts`) gagne un mode « flocon » (`uFlake`) : sprites ronds, taille fixe dans le
  monde (bornée à l'écran), chute ≈ 6 fois plus lente, balancement propre à chaque flocon, dérive au vent ; **même programme que la pluie**,
  deux nappes en fondu, au-dessus du socle seulement (D11 : rien sur le fond de page vue de côté [vérifié, capture]). 800 / 1 500 / 3 000
  flocons par nappe (`SNOW_COUNT`, `?debug&snowmax=N`).
- **Dans le temps** : la neige au sol s'accumule (τ = 30 s : 90 % de la couverture en 70 s) et fond (τ = 5 min). **Pluie et neige**
  (`sleet`) : gouttes et flocons mêlés, sol en partie blanc et mouillé. Règle de dégradation **partagée** avec la pluie [vérifiée de bout en
  bout], réduit-mouvement (chute et balancement × 0,3) [mesuré], TI-02 (30 img/s au repos) [mesuré].
- **Règle 9** : arrivée de la neige = **1 programme** (celui des flocons, aucun si la pluie est déjà venue), **0** pour la neige au sol,
  pire image 18 à 46 ms [mesuré] ; au démarrage, **+1 programme** (45 → 46) : les têtes des passants partageaient celui des houppiers.
- **Coût par image** : dans le bruit sur le Mac (60 img/s en mouvement, 30 au repos, `high` et `medium`) [mesuré] ; ≤ 2 appels.
- **Chunk principal : +358 o** ; total depuis `a9424e9` **+2,68 Ko sur 3,5** (par ma mesure ; +2,72 en partant de vos 2,36). Module météo
  9,0 → **9,7 Ko**.
- **Arbres d'hiver (BACKLOG)** : **à moitié traité** (quand il neige, tous les arbres, nus compris, se coiffent de blanc) ; **les arbres
  enneigés sans neige qui tombe sont reportés**, c'est une décision de produit (question 1).
- **À trancher ou préciser** : 12 points (section 11) et 3 vraies questions pour Dasco (section 12). Ce qui reste à régler à l'œil :
  section 7.

---

## 1. Avant de commencer

1. **Base** : `976841d`. Les patchs ne touchent que `frontend/carte/src` (aucun changement au contrat, au back, à `vite.config.ts`, à
   `main.ts` ni à `weather/index.ts`).
2. **Branche** : `feat/EP009-US007-neige` depuis `feat/EP009-meteo`.
3. Dans les copies de vérification, le proxy de Vite visait le port 8807 (aucune API : `/api/weather` → 502 → ciel par défaut) ; **ce
   n'est pas dans les patchs**. Toutes les neiges vues venaient de `?weather=snow` / `sleet` et de `window.diorama.weather.set()`.
4. **Règle de `check-boundaries`** : aucune variable nommée `z` dans ce code (vérifié ; la règle passe à chaque commit).
5. **Ordre des crochets des monuments** : `uplight()` (`scene/models/lighting.ts`) **remplace** `onBeforeCompile` ; `weatherSurface()` est donc
   appelé **après** lui, dans le même bloc `if (!lit)` ; `fadeMaterial()` (cutaway, plus tard au démarrage) enchaîne ensuite les deux.

---

## 2. Commits

| # | Message | Fichiers |
|---|---|---|
| 1 | `feat(scene): neige au sol, crochets posés au démarrage (même GLSL que le sol mouillé, 8 matériaux de plus)` | `scene/weather-surface.ts` + test, `scene/city.ts`, `scene/nature.ts`, `scene/chimneys.ts`, `scene/facades.ts`, `scene/models/{cathedrale,carrecurial,chateau}.ts` |
| 2 | `feat(meteo): flocons, même système GPU que la pluie (fonctions et tests)` | `weather/rain.ts` + test |
| 3 | `feat(meteo): neige sur la carte (flocons, neige au sol qui s'accumule et fond, pluie et neige mêlées)` | `weather/effects.ts`, `weather/effects.test.ts` (nouveau) |
| 4 | `docs: itération N (EP009-US007, neige)` | README (`?debug&snowmax=`, structure), FEATURES, CHANGELOG, DECISIONS, BACKLOG (arbres d'hiver), epic.md |

Le commit 1 ne change rien à l'image tant que `uSnow` vaut 0 (mêmes lumières, même fond, mêmes appels [vérifié]) ; le commit 2 ne change
rien à la pluie (`precipMotion('rain', …)` = l'ancienne allure, testé).

---

## 3. Ce que fait le code

### 3.1 Neige au sol (`scene/weather-surface.ts`, chunk principal)
- Uniformes partagés `uWet`, `uSnow` (posés par le module météo) ; par matériau `uWetK`, `uSnowK` (options `{ wet, snow }` de
  `weatherSurface`, 1 par défaut). Réglages par uniformes : **même texte de shader, même clé de programme** (`…|wet`) qu'avant.
- GLSL, après `emissivemap_fragment` : « vers le ciel » `dot(normal, haut de la vue)` calculé une fois ; mouillé inchangé ; neige =
  `smoothstep(0,3 ; 0,7 ; haut)` × plaques (`smoothstep(0,8 n ; 0,8 n + 0,25 ; uSnow·uSnowK)`, n = bruit de valeur sur la position dans le
  monde, échelles 7 m et 1,7 m, retrouvée sans varying de plus par `cameraPosition` et `viewMatrix`) ; couleur vers `(0,9 ; 0,93 ; 0,97)`
  (linéaire), rugosité 0,9, et une petite lueur propre `(0,05 ; 0,055 ; 0,065)` pour que la neige reste claire sous un ciel couvert et la nuit.
- Matériaux : `roadMaterial` (chaussées `snow: 0,55`, voies piétonnes `0,8`), `windowsMaterial` et le sol (inchangés : 1 et 1) ; **nouveaux,
  `wet: 0`** : houppiers des arbres simples (`city.ts`), arbres modélisés (`nature.ts`, toutes saisons : même matériau), cheminées, auvents,
  ardoise de la cathédrale, toits du Carré Curial (en pente et plat), toits du château.
- Non crochetés (restent sans neige) : tirets des rues, berges, ponts, eau, troncs, fontaine des Éléphants, passants, oiseaux, repères.

### 3.2 Flocons (`weather/rain.ts`, chunk météo)
- `createRain(scene, count, bounds, kind = 'rain')` ; `kind: 'snow'` pose `uFlake = 1`. Vertex shader : balancement
  `uSwayAmp · (sin, cos)(uSway · fréquence propre + graine)` avant le repli dans la boîte (sans effet pour la pluie : amplitude 0) ; flocon =
  carré face à l'écran, `uLen` m de diamètre, entre 1 et 4 fois `uWidth` pixels ; fragment : disque adouci.
- `precipMotion(kind, far, d, intensity)` (pure) : la pluie garde exactement son allure ; neige : chute `clamp(0,02 d ; 3 ; 14)` (proche) et
  `clamp(0,015 d ; 12 ; 45)` (lointaine), diamètre `clamp(0,0025 d ; 0,3 ; 1,5)` / `clamp(0,0018 d ; 1,2 ; 6)` m, balancement 0,6 à 3 m / 2 à
  12 m ; grosse neige : flocons × (0,8 + 0,4 i), opacité × (0,7 + 0,4 i). Le vent pousse plus (pente 0,35 contre 0,13).
- Couleurs `#f7f9fc` le jour, `#aab4cc` la nuit ; taille mini 2,2 / 1,8 px (× densité de pixels), opacité 0,9 / 0,7.

### 3.3 Branchement (`weather/effects.ts`, chunk météo)
- Une boucle sur `rain` et `snow` : chaque précipitation est créée à sa première apparition, avec son nombre par niveau
  (`RAIN_COUNT`, `SNOW_COUNT` ; `?debug&rainmax=N`, `&snowmax=N`), et suit la **même règle de dégradation** (une seule, mesurée dès que
  l'une des deux est affichée).
- Neige au sol : cible `min(1 ; 1,6 × neige)`, τ = 30 s pour couvrir, 300 s pour fondre (`SNOW_COVER`) ; un uniforme, rien d'autre.
- `weather/index.ts`, `main.ts`, `daynight.ts`, `sky.ts` : **inchangés** (le ciel gris de la neige existait depuis US002).

---

## 4. Code

#### Commit 1 — `feat(scene): neige au sol, crochets posés au démarrage (même GLSL que le sol mouillé, 8 matériaux de plus)`

Patch : `/private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/7058533b-187f-4f4d-8d7b-9497ad542537/scratchpad/u7/patches-ep009-us007/us007-1.patch`.

**`frontend/carte/src/scene/chimneys.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -5,6 +5,7 @@ import { planRoof } from './roofs';
 import { createParticles, type EmitOptions } from './particles';
 import type { NightUniforms } from './city';
 import type { Season } from '../time/seasons';
+import { weatherSurface } from './weather-surface';
 
 /**
  * Cheminées et fumée (EP001-US005). Décor, pas un relevé : OpenStreetMap ne donne pas les cheminées. Elles sont
@@ -60,7 +61,7 @@ export function buildChimneys(
     .filter((b) => hash(b.id) < cfg.share);
   if (!candidates.length) return null;
   const geo = chimneyGeometry();
-  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }), candidates.length);
+  const mesh = new THREE.InstancedMesh(geo, weatherSurface(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }), { wet: 0 }), candidates.length); // neige (EP009-US007)
   mesh.name = 'chimneys';
   mesh.castShadow = mesh.receiveShadow = true;
   const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
```

**`frontend/carte/src/scene/city.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -239,7 +239,8 @@ function roadMaterial(color: string, kind: 'paving' | 'asphalt'): THREE.MeshStan
         diffuseColor.rgb *= 1.0 + (roadHash(floor(ac)) - 0.5) * 0.07 * afade;`}`);
   };
   mat.customProgramCacheKey = () => `road-${kind}`;
-  return weatherSurface(mat); // rue mouillée sous la pluie (EP009-US005), posé avant la première compilation
+  // Rue mouillée sous la pluie (EP009-US005) ; sous la neige (US007), à moitié dégagée (chaussées) ou presque blanche (voies piétonnes)
+  return weatherSurface(mat, { snow: kind === 'asphalt' ? 0.55 : 0.8 }); // posé avant la première compilation
 }
 
 /** Tirets blancs au milieu des grandes rues (largeur 8 m et plus), hors des abords des carrefours */
@@ -538,7 +539,7 @@ function buildTrees(data: CityData, terrain: Terrain): CityTrees & { group: THRE
   canopyGeo.translate(0, 7.5, 0);
   const trunkGeo = new THREE.CylinderGeometry(0.5, 0.7, 5, 5);
   trunkGeo.translate(0, 2.5, 0);
-  const canopy = new THREE.InstancedMesh(canopyGeo, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), spots.length);
+  const canopy = new THREE.InstancedMesh(canopyGeo, weatherSurface(new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), { wet: 0 }), spots.length); // neige (EP009-US007)
   const trunk = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: PALETTE.trunk, roughness: 1 }), spots.length);
   const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
   const base: THREE.Matrix4[] = [];
```

**`frontend/carte/src/scene/facades.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -5,6 +5,7 @@ import { pointInPoly, segDist2 } from './geo';
 import { PLACE_CATEGORIES, placeCategory } from './palette';
 import { dataUrl } from '../dataurl';
 import { roadDistanceIndex } from './roads';
+import { weatherSurface } from './weather-surface';
 
 /**
  * Détails de façade tirés du pack de bâtiments (public/models/buildings/details.glb, voir
@@ -123,7 +124,7 @@ export async function buildAwnings(o: {
   });
 
   // Blanc cassé au départ (gris clair de la pièce) × couleur de la catégorie
-  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });
+  const material = weatherSurface(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 }), { wet: 0 }); // neige (EP009-US007)
   // Couleur de la catégorie éclaircie d'un tiers : plus lisible que la couleur pleine des épingles
   const colorOf = new Map(PLACE_CATEGORIES.map((c) => [c.id, new THREE.Color(c.color).lerp(new THREE.Color('#ffffff'), 0.3)]));
   for (const [key, list] of placed) {
```

**`frontend/carte/src/scene/models/carrecurial.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -4,6 +4,7 @@ import type { CityData, Pt } from '../../types';
 import { skeletonRoofGeometry } from '../roofs';
 import { alongWalls, walls } from './chateau';
 import { glowAtNight, uplight } from './lighting';
+import { weatherSurface } from '../weather-surface';
 
 /**
  * Carré Curial — version « formes simples » générée en code (itération 15).
@@ -51,6 +52,8 @@ export function buildCarreCurial(ctx: { night: { value: number }; data?: CityDat
     uplight(roofMat, ctx.night, 0.35, 26, ground);
     uplight(flatRoof, ctx.night, 0.35, 26, ground);
     glowAtNight(opening, ctx.night, 0.5);
+    weatherSurface(roofMat, { wet: 0 }); // neige (EP009-US007), après uplight qui remplace onBeforeCompile
+    weatherSurface(flatRoof, { wet: 0 });
     lit = true;
   }
 
```

**`frontend/carte/src/scene/models/cathedrale.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -2,6 +2,7 @@ import * as THREE from 'three';
 import { mesh } from './mesh';
 import type { CityData, Pt } from '../../types';
 import { glowAtNight, uplight } from './lighting';
+import { weatherSurface } from '../weather-surface';
 
 /**
  * Cathédrale Saint-François-de-Sales — version « formes simples » générée en code (itération 11).
@@ -82,6 +83,7 @@ export function buildCathedrale(ctx: { night: { value: number }; data?: CityData
     uplight(molasseDark, ctx.night, 1.0, 40, ground);
     uplight(slate, ctx.night, 0.5, 40, ground);
     glowAtNight(opening, ctx.night, 0.6); // baies éclairées de l'intérieur
+    weatherSurface(slate, { wet: 0 }); // neige (EP009-US007), après uplight qui remplace onBeforeCompile
     lit = true;
   }
 
```

**`frontend/carte/src/scene/models/chateau.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -4,6 +4,7 @@ import type { Building, CityData, HeightFn, Pt } from '../../types';
 import { roofGeometry, skeletonRoofGeometry } from '../roofs';
 import { frameOf } from './cathedrale';
 import { glowAtNight, uplight } from './lighting';
+import { weatherSurface } from '../weather-surface';
 import { buildGrille } from './chateau-grille';
 
 /**
@@ -123,6 +124,7 @@ export function buildChateau(ctx: { night: { value: number }; data?: CityData; m
     uplight(stoneDark, ctx.night, 1.0, 32, lowest);
     uplight(roofMat, ctx.night, 0.4, 32, lowest);
     glowAtNight(opening, ctx.night, 0.55);
+    weatherSurface(roofMat, { wet: 0 }); // neige (EP009-US007), après uplight qui remplace onBeforeCompile
     lit = true;
   }
 
```

**`frontend/carte/src/scene/nature.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -5,6 +5,7 @@ import { rand } from './palette';
 import { distToSegment, pointInPoly } from './geo';
 import { dataUrl } from '../dataurl';
 import type { Foliage } from '../time/seasons';
+import { weatherSurface } from './weather-surface';
 
 /**
  * Arbres modélisés (pack Quaternius, CC0) à certains endroits de la ville.
@@ -31,7 +32,7 @@ export function seasonalName(name: string, foliage: Foliage, seasons?: NatureSea
   return `${m[1]}_${foliage === 'autumn' ? seasons.autumn : seasons.bare}_${m[2]}`;
 }
 
-const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
+const material = weatherSurface(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }), { wet: 0 }); // neige sur les arbres (EP009-US007)
 
 /** Test « cet emplacement est dans la zone » ; null si la zone ne correspond à rien dans city.json. */
 function zoneTest(zone: NatureZone, data: CityData): ((p: Pt) => boolean) | null {
```

**`frontend/carte/src/scene/weather-surface.test.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -9,15 +9,29 @@ const shader = () => ({
   fragmentShader: '#include <common>\nvoid main() {\n#include <emissivemap_fragment>\n#include <lights_physical_fragment>\n}',
 });
 
-describe('crochet « sol mouillé » posé au démarrage (EP009-US005)', () => {
-  it('ajoute l’uniforme partagé et le calcul juste après l’émissif, sans toucher au reste', () => {
+describe('crochets « sol mouillé » et « neige » posés au démarrage (EP009-US005, US007)', () => {
+  it('ajoute les uniformes partagés et un seul morceau de calcul juste après l’émissif, sans toucher au reste', () => {
     const s = shader();
     const mat = weatherSurface(new THREE.MeshStandardMaterial());
     mat.onBeforeCompile(s as never, {} as never);
     expect(s.uniforms.uWet).toBe(weatherUniforms.uWet);
-    expect(s.fragmentShader).toMatch(/uniform float uWet;/);
-    expect(s.fragmentShader.indexOf('if (uWet > 0.0)')).toBeGreaterThan(s.fragmentShader.indexOf('#include <emissivemap_fragment>'));
-    expect(s.fragmentShader.indexOf('if (uWet > 0.0)')).toBeLessThan(s.fragmentShader.indexOf('#include <lights_physical_fragment>'));
+    expect(s.uniforms.uSnow).toBe(weatherUniforms.uSnow);
+    expect(s.fragmentShader).toMatch(/uniform float uWet, uSnow, uWetK, uSnowK;/);
+    const emissive = s.fragmentShader.indexOf('#include <emissivemap_fragment>'), lights = s.fragmentShader.indexOf('#include <lights_physical_fragment>');
+    for (const branch of ['if (uWet * uWetK > 0.0)', 'if (uSnow * uSnowK > 0.0)']) {
+      expect(s.fragmentShader.indexOf(branch)).toBeGreaterThan(emissive);
+      expect(s.fragmentShader.indexOf(branch)).toBeLessThan(lights);
+    }
+  });
+  it('chaque matériau dit combien il se mouille et blanchit, avec le même programme', () => {
+    const a = weatherSurface(new THREE.MeshStandardMaterial()), b = weatherSurface(new THREE.MeshStandardMaterial(), { wet: 0, snow: 0.55 });
+    const sa = shader(), sb = shader();
+    a.onBeforeCompile(sa as never, {} as never);
+    b.onBeforeCompile(sb as never, {} as never);
+    expect([sa.uniforms.uWetK.value, sa.uniforms.uSnowK.value]).toEqual([1, 1]);
+    expect([sb.uniforms.uWetK.value, sb.uniforms.uSnowK.value]).toEqual([0, 0.55]);
+    expect(sb.fragmentShader).toBe(sa.fragmentShader); // réglages par uniformes : texte identique
+    expect(b.customProgramCacheKey()).toBe(a.customProgramCacheKey());
   });
   it('enchaîne l’onBeforeCompile existant et étend la clé du programme', () => {
     const mat = new THREE.MeshStandardMaterial();
@@ -29,10 +43,11 @@ describe('crochet « sol mouillé » posé au démarrage (EP009-US005)', () => {
     mat.onBeforeCompile(s as never, {} as never);
     expect(called).toBe(1);
     expect(s.fragmentShader).toMatch(/uniform float uNight;/);
-    expect(s.fragmentShader).toMatch(/uniform float uWet;/);
+    expect(s.fragmentShader).toMatch(/uniform float uWet, uSnow/);
     expect(mat.customProgramCacheKey()).toBe('road-asphalt|wet');
   });
-  it('par beau temps, l’uniforme vaut 0 : la branche n’est pas prise', () => {
+  it('par beau temps, les uniformes valent 0 : les branches ne sont pas prises', () => {
     expect(weatherUniforms.uWet.value).toBe(0);
+    expect(weatherUniforms.uSnow.value).toBe(0);
   });
 });
```

**`frontend/carte/src/scene/weather-surface.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -1,32 +1,53 @@
 import * as THREE from 'three';
 
 /**
- * Crochets de la météo dans les matériaux standards (EP009-US005) : sol mouillé (rues, sol, bâtiments et toits). Posés au
- * démarrage, inactifs (règle 9 : modifier un matériau en cours de route recompile son programme et fige l'image) ; ensuite, le
- * module météo ne règle que l'uniforme. Comme `fadeMaterial` (cutaway.ts) : l'`onBeforeCompile` existant est enchaîné, la clé du
- * programme est étendue une fois pour toutes. Par beau temps (`uWet` à 0), la branche n'est pas prise : image inchangée.
+ * Crochets de la météo dans les matériaux standards : sol mouillé (EP009-US005) et neige au sol (US007), un seul morceau de GLSL.
+ * Posés au démarrage, inactifs (règle 9 : modifier un matériau en cours de route recompile son programme et fige l'image) ; ensuite,
+ * le module météo ne règle que les uniformes. Comme `fadeMaterial` (cutaway.ts) : l'`onBeforeCompile` existant est enchaîné, la clé
+ * du programme est étendue une fois pour toutes. Par beau temps (`uWet` et `uSnow` à 0), les branches ne sont pas prises : image
+ * inchangée. Chaque matériau dit combien il se mouille et se couvre de neige (uniformes à lui : même programme pour tous).
  */
-export const weatherUniforms = { uWet: { value: 0 } };
+export const weatherUniforms = { uWet: { value: 0 }, uSnow: { value: 0 } };
 
-// Mouillé : plus sombre et un peu satiné, surtout sur ce qui regarde vers le ciel (sols, rues, toits) ; pas de vrais reflets
-const WET_GLSL = /* glsl */ `
-  if (uWet > 0.0) {
-    float wetUp = smoothstep(0.35, 0.8, dot(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz)));
-    float wet = uWet * mix(0.35, 1.0, wetUp);
+// Mouillé : plus sombre et un peu satiné, surtout sur ce qui regarde vers le ciel (sols, rues, toits) ; pas de vrais reflets.
+// Neige : ce qui regarde vers le ciel (selon la pente, jamais les façades) passe à un blanc bleuté un peu cassé, par plaques (bruit
+// sur la position dans le monde) qui s'étendent quand la neige s'accumule.
+const GLSL = /* glsl */ `
+  float wxUp = dot(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz));
+  if (uWet * uWetK > 0.0) {
+    float wet = uWet * uWetK * mix(0.35, 1.0, smoothstep(0.35, 0.8, wxUp));
     diffuseColor.rgb *= 1.0 - 0.2 * wet;
     roughnessFactor = mix(roughnessFactor, 0.5, wet);
+  }
+  if (uSnow * uSnowK > 0.0) {
+    vec2 wxP = (cameraPosition + (vec4(-vViewPosition, 0.0) * viewMatrix).xyz).xz;
+    float wxN = 0.65 * wxNoise(wxP / 7.0) + 0.35 * wxNoise(wxP / 1.7);
+    float snow = smoothstep(0.3, 0.7, wxUp) * smoothstep(0.8 * wxN, 0.8 * wxN + 0.25, uSnow * uSnowK);
+    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.93, 0.97), snow);
+    roughnessFactor = mix(roughnessFactor, 0.9, snow);
+    totalEmissiveRadiance += vec3(0.05, 0.055, 0.065) * snow; // la neige reste claire sous un ciel couvert et la nuit
+  }`;
+const COMMON = /* glsl */ `
+  uniform float uWet, uSnow, uWetK, uSnowK;
+  float wxHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
+  float wxNoise(vec2 p) {
+    vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
+    return mix(mix(wxHash(i), wxHash(i + vec2(1.0, 0.0)), u.x), mix(wxHash(i + vec2(0.0, 1.0)), wxHash(i + 1.0), u.x), u.y);
   }`;
 
-/** Ajoute le crochet « sol mouillé » à un matériau standard, avant sa première compilation */
-export function weatherSurface<T extends THREE.MeshStandardMaterial>(mat: T): T {
+/**
+ * Ajoute les crochets « mouillé » et « neige » à un matériau standard, avant sa première compilation.
+ * wet, snow : part de mouillé et de neige que prend ce matériau (0 à 1 ; 0 = jamais).
+ */
+export function weatherSurface<T extends THREE.MeshStandardMaterial>(mat: T, { wet = 1, snow = 1 } = {}): T {
   const previous = mat.onBeforeCompile;
   const base = mat.customProgramCacheKey === THREE.Material.prototype.customProgramCacheKey ? previous.toString() : mat.customProgramCacheKey();
   mat.onBeforeCompile = (shader, renderer) => {
     previous.call(mat, shader, renderer);
-    shader.uniforms.uWet = weatherUniforms.uWet;
+    Object.assign(shader.uniforms, weatherUniforms, { uWetK: { value: wet }, uSnowK: { value: snow } });
     shader.fragmentShader = shader.fragmentShader
-      .replace('#include <common>', '#include <common>\nuniform float uWet;')
-      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>${WET_GLSL}`);
+      .replace('#include <common>', `#include <common>${COMMON}`)
+      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>${GLSL}`);
   };
   mat.customProgramCacheKey = () => `${base}|wet`;
   return mat;
```


#### Commit 2 — `feat(meteo): flocons, même système GPU que la pluie (fonctions et tests)`

Patch : `/private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/7058533b-187f-4f4d-8d7b-9497ad542537/scratchpad/u7/patches-ep009-us007/us007-2.patch`.

**`frontend/carte/src/weather/rain.test.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -1,5 +1,5 @@
 import { describe, expect, it } from 'vitest';
-import { RAIN_COUNT, layerMotion, layerWeights, rainLook } from './rain';
+import { RAIN_COUNT, SNOW_COUNT, layerMotion, layerWeights, precipMotion, rainLook, snowMotion } from './rain';
 
 const DISTANCES = Array.from({ length: 400 }, (_, i) => 60 + i * 10); // de 60 m à 4 km
 
@@ -40,3 +40,35 @@ describe('bruine et averse visiblement différentes', () => {
     expect(RAIN_COUNT).toEqual({ low: 1200, medium: 2500, high: 5000 });
   });
 });
+
+describe('neige : même système, flocons lents (EP009-US007)', () => {
+  it('la pluie garde exactement son allure', () => {
+    for (const far of [false, true]) for (const d of [120, 700, 2850]) for (const i of [0.15, 0.85]) {
+      const m = layerMotion(far, d), k = rainLook(i);
+      expect(precipMotion('rain', far, d, i)).toEqual({ fall: m.fall, len: m.len * k.len, sway: 0, opacity: k.opacity });
+    }
+  });
+  it('les flocons tombent au moins cinq fois plus lentement que la pluie, à tous les zooms, et se balancent', () => {
+    for (const far of [false, true]) for (const d of DISTANCES) {
+      const snow = precipMotion('snow', far, d, 0.6), rain = precipMotion('rain', far, d, 0.6);
+      expect(snow.fall * 5).toBeLessThanOrEqual(rain.fall);
+      expect(snow.sway).toBeGreaterThan(0);
+    }
+  });
+  it('chute, taille et balancement continus avec la distance (aucun saut au zoom)', () => {
+    for (const far of [false, true]) for (const d of DISTANCES) {
+      const a = snowMotion(far, d), b = snowMotion(far, d + 1);
+      expect(Math.abs(b.fall - a.fall)).toBeLessThan(0.05);
+      expect(Math.abs(b.size - a.size)).toBeLessThan(0.01);
+      expect(Math.abs(b.sway - a.sway)).toBeLessThan(0.01);
+    }
+  });
+  it('petite neige et grosse neige : flocons plus gros et plus marqués', () => {
+    const light = precipMotion('snow', false, 120, 0.2), heavy = precipMotion('snow', false, 120, 1);
+    expect(heavy.len).toBeGreaterThan(light.len);
+    expect(heavy.opacity).toBeGreaterThan(light.opacity);
+  });
+  it('nombre de flocons par niveau, dans la fourchette de la spec (800 à 3 000)', () => {
+    expect(SNOW_COUNT).toEqual({ low: 800, medium: 1500, high: 3000 });
+  });
+});
```

**`frontend/carte/src/weather/rain.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -3,18 +3,23 @@ import type { QualityLevel } from '../scene/quality';
 import type { CityData } from '../types';
 
 /**
- * Pluie (EP009-US005), calculée par le processeur graphique : chaque traînée est un quadrilatère dont la position est calculée dans
- * le vertex shader à partir de l'avancée de la chute (aucune mise à jour des sommets par le processeur, tampon fixe). Deux nappes,
- * un appel de rendu chacune, un seul programme :
+ * Pluie (EP009-US005) et neige (US007), calculées par le processeur graphique : chaque traînée (ou flocon) est un quadrilatère dont la
+ * position est calculée dans le vertex shader à partir de l'avancée de la chute (aucune mise à jour des sommets par le processeur,
+ * tampon fixe). Deux nappes, un appel de rendu chacune, un seul programme pour la pluie et la neige (`uFlake`) :
  *  - proche : boîte de 280 m autour du point regardé, gouttes courtes (en rue) ;
  *  - lointaine : tout le socle, traînées longues (vue d'ensemble) ;
  * en fondu selon la distance caméra – point regardé. La chute et la dérive du vent sont cumulées par le processeur : la vitesse peut
  * suivre le zoom sans que les gouttes sautent. Au-dessus du socle seulement (D11) : une goutte hors du socle est écartée, et le
  * mélange ne la pose que là où quelque chose est déjà dessiné (alpha de la destination) : vue de côté, rien sur le fond de page.
+ * Neige : flocons ronds, de taille fixe dans le monde (bornée à l'écran), qui tombent lentement en se balançant (chaque flocon à
+ * son rythme) et que le vent pousse plus que la pluie.
  */
 
 /** Traînées par niveau de qualité, à intensité 1 : valeurs par défaut tirées des mesures du Mac, à confirmer sur iPhone (US001) */
 export const RAIN_COUNT: Record<QualityLevel, number> = { low: 1200, medium: 2500, high: 5000 };
+/** Flocons par nappe et par niveau, à intensité 1 (spec : 800 à 3 000) : un flocon couvre plus de pixels qu'une traînée */
+export const SNOW_COUNT: Record<QualityLevel, number> = { low: 800, medium: 1500, high: 3000 };
+export type PrecipKind = 'rain' | 'snow';
 
 const smooth = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
 const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
@@ -29,15 +34,36 @@ export const layerMotion = (far: boolean, d: number) =>
 /** Bruine ou averse : traînées plus longues et plus marquées quand l'intensité monte */
 export const rainLook = (intensity: number) => ({ len: 0.6 + 0.8 * intensity, opacity: 0.6 + 0.5 * intensity });
 
-/** Inclinaison des traînées par le vent : pente horizontale par m/s de vent « de maquette » */
-const SLANT = 0.13;
+/**
+ * Neige : chute (m/s « de maquette », environ six fois plus lente que la pluie), taille d'un flocon (m) et amplitude du balancement
+ * (m), continues avec la distance
+ */
+export const snowMotion = (far: boolean, d: number) =>
+  far ? { fall: clamp(d * 0.015, 12, 45), size: clamp(d * 0.0018, 1.2, 6), sway: clamp(d * 0.004, 2, 12) }
+    : { fall: clamp(d * 0.02, 3, 14), size: clamp(d * 0.0025, 0.3, 1.5), sway: clamp(d * 0.006, 0.6, 3) };
+
+/** Petite neige ou grosse averse de neige : flocons un peu plus gros et plus marqués */
+export const snowLook = (intensity: number) => ({ size: 0.8 + 0.4 * intensity, opacity: 0.7 + 0.4 * intensity });
+
+/** Allure d'une nappe : chute (m/s), longueur de la traînée ou diamètre du flocon (m), balancement (m), facteur d'opacité */
+export function precipMotion(kind: PrecipKind, far: boolean, d: number, intensity: number) {
+  if (kind === 'rain') {
+    const m = layerMotion(far, d), k = rainLook(intensity);
+    return { fall: m.fall, len: m.len * k.len, sway: 0, opacity: k.opacity };
+  }
+  const m = snowMotion(far, d), k = snowLook(intensity);
+  return { fall: m.fall, len: m.size * k.size, sway: m.sway, opacity: k.opacity };
+}
+
+/** Inclinaison par le vent : pente horizontale par m/s de vent « de maquette » (un flocon dérive plus qu'une goutte) */
+const SLANT = { rain: 0.13, snow: 0.35 };
 /** Remise à zéro de la chute cumulée (précision des flottants dans le shader) : une fois par heure environ */
 const WRAP = 1e6;
 
 const VERT = /* glsl */ `
   attribute vec4 aSeed; attribute vec2 aCorner; attribute float aIdx;
   uniform vec3 uCenter, uDir; uniform vec4 uBox, uBounds;
-  uniform float uPhase, uLen, uWidth, uOpacity, uDensity;
+  uniform float uPhase, uLen, uWidth, uOpacity, uDensity, uFlake, uSway, uSwayAmp;
   uniform vec2 uDrift, uRes;
   varying float vAlpha; varying float vSide; varying float vAlong;
   void main() {
@@ -46,15 +72,24 @@ const VERT = /* glsl */ `
     float keep = 1.0 - smoothstep(uDensity - 0.04, uDensity, aIdx);
     if (keep <= 0.0) return;
     vec3 p = vec3(aSeed.x * 2.0 * uBox.x + uDrift.x, aSeed.z * uBox.z - uPhase * (0.85 + 0.3 * aSeed.w), aSeed.y * 2.0 * uBox.y + uDrift.y);
+    p.xz += uSwayAmp * vec2(sin(uSway * (0.5 + 0.6 * aSeed.w) + aSeed.x * 37.0), cos(uSway * (0.4 + 0.5 * aSeed.z) + aSeed.y * 41.0));
     p.xz = uCenter.xz + mod(p.xz - uCenter.xz + uBox.xy, 2.0 * uBox.xy) - uBox.xy;
     p.y = uBox.w + mod(p.y, uBox.z);
     float inside = min(min(p.x - uBounds.x, uBounds.y - p.x), min(p.z - uBounds.z, uBounds.w - p.z));
     if (inside < 0.0) return;
+    vec2 e = abs(p.xz - uCenter.xz) / uBox.xy;
+    float fade = keep * (1.0 - smoothstep(0.75, 1.0, max(e.x, e.y))) * (1.0 - smoothstep(0.8, 1.0, (p.y - uBox.w) / uBox.z)) * smoothstep(0.0, 20.0, inside);
     vec4 c0 = projectionMatrix * viewMatrix * vec4(p, 1.0);
+    if (uFlake > 0.5) { // flocon : carré face à l'écran, uLen m de diamètre, entre 1 et 4 fois uWidth pixels
+      if (c0.w < 1.0) return;
+      float px = clamp(uLen * uRes.y * projectionMatrix[1][1] * 0.5 / c0.w, uWidth, 4.0 * uWidth);
+      c0.xy += vec2(aCorner.x * 2.0 - 1.0, aCorner.y) * px / uRes * c0.w;
+      gl_Position = c0;
+      vAlpha = uOpacity * fade; vSide = aCorner.y; vAlong = aCorner.x;
+      return;
+    }
     vec4 c1 = projectionMatrix * viewMatrix * vec4(p - uDir * uLen, 1.0);
     if (c0.w < 1.0 || c1.w < 1.0) return;
-    vec2 e = abs(p.xz - uCenter.xz) / uBox.xy;
-    float fade = keep * (1.0 - smoothstep(0.75, 1.0, max(e.x, e.y))) * (1.0 - smoothstep(0.8, 1.0, (p.y - uBox.w) / uBox.z)) * smoothstep(0.0, 20.0, inside);
     vec4 c = mix(c0, c1, aCorner.x);
     vec2 d = (c1.xy / c1.w - c0.xy / c0.w) * uRes;
     vec2 dir = length(d) > 1e-4 ? normalize(d) : vec2(0.0, 1.0);
@@ -63,14 +98,20 @@ const VERT = /* glsl */ `
     vAlpha = uOpacity * fade; vSide = aCorner.y; vAlong = aCorner.x;
   }`;
 const FRAG = /* glsl */ `
-  uniform vec3 uColor;
+  uniform vec3 uColor; uniform float uFlake;
   varying float vAlpha; varying float vSide; varying float vAlong;
   void main() {
-    float a = vAlpha * (1.0 - vSide * vSide) * mix(1.0, 0.2, vAlong);
+    float a = uFlake > 0.5 ? vAlpha * (1.0 - smoothstep(0.45, 1.0, length(vec2(vAlong * 2.0 - 1.0, vSide))))
+      : vAlpha * (1.0 - vSide * vSide) * mix(1.0, 0.2, vAlong);
     gl_FragColor = vec4(uColor * a, a);
   }`;
 
-const DAY = new THREE.Color('#dfe8f2'), NIGHT = new THREE.Color('#7c88a8');
+const COLORS = {
+  rain: { day: new THREE.Color('#dfe8f2'), night: new THREE.Color('#7c88a8') },
+  snow: { day: new THREE.Color('#f7f9fc'), night: new THREE.Color('#aab4cc') },
+};
+/** Épaisseur des traînées et taille minimale des flocons (pixels, × densité de pixels), opacité : proche, lointaine */
+const LOOK = { rain: { width: [1.5, 1.2], opacity: [0.55, 0.42] }, snow: { width: [2.2, 1.8], opacity: [0.9, 0.7] } };
 
 /** Une nappe : `count` traînées (4 sommets chacune), dans l'ordre d'un tirage au hasard (aIdx) : la densité garde les premières */
 function layer(count: number, bounds: CityData['bounds'], material: THREE.ShaderMaterial, width: number) {
@@ -106,13 +147,14 @@ function layer(count: number, bounds: CityData['bounds'], material: THREE.Shader
   return { mesh, u, phase: 0, drift: new THREE.Vector2() };
 }
 
-export function createRain(scene: THREE.Scene, count: number, bounds: CityData['bounds']) {
+export function createRain(scene: THREE.Scene, count: number, bounds: CityData['bounds'], kind: PrecipKind = 'rain') {
   const base = new THREE.ShaderMaterial({
     uniforms: {
       uCenter: { value: new THREE.Vector3() }, uDir: { value: new THREE.Vector3(0, -1, 0) },
       uBox: { value: new THREE.Vector4() }, uBounds: { value: new THREE.Vector4() },
       uPhase: { value: 0 }, uLen: { value: 4 }, uWidth: { value: 1.3 }, uOpacity: { value: 0.5 }, uDensity: { value: 0 },
       uDrift: { value: new THREE.Vector2() }, uRes: { value: new THREE.Vector2(1, 1) }, uColor: { value: new THREE.Color() },
+      uFlake: { value: kind === 'snow' ? 1 : 0 }, uSway: { value: 0 }, uSwayAmp: { value: 0 },
     },
     vertexShader: VERT,
     fragmentShader: FRAG,
@@ -123,39 +165,44 @@ export function createRain(scene: THREE.Scene, count: number, bounds: CityData['
     blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
     blendSrc: THREE.DstAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
   });
-  const near = layer(count, bounds, base, 1.5), far = layer(count, bounds, base, 1.2);
-  near.mesh.name = 'rain-near';
-  far.mesh.name = 'rain-far';
+  const L = LOOK[kind], C = COLORS[kind];
+  const near = layer(count, bounds, base, L.width[0]), far = layer(count, bounds, base, L.width[1]);
+  near.mesh.name = `${kind}-near`;
+  far.mesh.name = `${kind}-far`;
   scene.add(near.mesh, far.mesh);
   const cx = (bounds.minX + bounds.maxX) / 2, cz = -(bounds.minY + bounds.maxY) / 2;
   const hx = (bounds.maxX - bounds.minX) / 2 + 40, hz = (bounds.maxY - bounds.minY) / 2 + 40;
   const color = new THREE.Color(), dir = new THREE.Vector3();
+  let sway = 0;
 
   return {
-    /** Appels de rendu de la pluie à cette image (0, 1 ou 2) */
+    /** Appels de rendu de cette précipitation à cette image (0, 1 ou 2) */
     visible: () => +near.mesh.visible + +far.mesh.visible,
     /**
-     * À chaque image où il pleut. intensity : 0..1 (déjà multipliée par la règle de dégradation) ; d : distance caméra – point regardé ;
+     * À chaque image où il pleut (ou neige). intensity : 0..1 (déjà multipliée par la règle de dégradation) ; d : distance caméra – point regardé ;
      * wind : m/s « de maquette » et direction où il va (degrés, 0 = est, 90 = nord) ; slow : 0,3 avec le réduit-mouvement.
      */
     update(dt: number, focus: THREE.Vector3, d: number, intensity: number, rawIntensity: number, wind: { speed: number; towards: number }, night: number, slow: number) {
-      const w = layerWeights(d), look = rainLook(rawIntensity);
-      const a = (wind.towards * Math.PI) / 180, s = wind.speed * SLANT;
+      const w = layerWeights(d);
+      const a = (wind.towards * Math.PI) / 180, s = wind.speed * SLANT[kind];
       dir.set(Math.cos(a) * s, -1, -Math.sin(a) * s).normalize();
-      color.copy(DAY).lerp(NIGHT, night);
+      color.copy(C.day).lerp(C.night, night);
+      sway = (sway + dt * slow) % WRAP;
       for (const [l, isFar, weight] of [[near, false, w.near], [far, true, w.far]] as const) {
         const density = intensity * weight;
         l.mesh.visible = density > 0.002;
         if (!l.mesh.visible) continue;
-        const m = layerMotion(isFar, d), u = l.u;
+        const m = precipMotion(kind, isFar, d, rawIntensity), u = l.u;
         l.phase = (l.phase + m.fall * dt * slow) % WRAP;
         l.drift.x = (l.drift.x + Math.cos(a) * s * m.fall * dt * slow) % WRAP;
         l.drift.y = (l.drift.y - Math.sin(a) * s * m.fall * dt * slow) % WRAP;
         u.uPhase.value = l.phase;
         u.uDrift.value.copy(l.drift);
         u.uDir.value.copy(dir);
-        u.uLen.value = m.len * look.len;
-        u.uOpacity.value = (isFar ? 0.42 : 0.55) * look.opacity;
+        u.uLen.value = m.len;
+        u.uSway.value = sway;
+        u.uSwayAmp.value = m.sway;
+        u.uOpacity.value = L.opacity[+isFar] * m.opacity;
         u.uDensity.value = density;
         u.uColor.value.copy(color);
         if (isFar) {
```


#### Commit 3 — `feat(meteo): neige sur la carte (flocons, neige au sol qui s'accumule et fond, pluie et neige mêlées)`

Patch : `/private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/7058533b-187f-4f4d-8d7b-9497ad542537/scratchpad/u7/patches-ep009-us007/us007-3.patch`.

**`frontend/carte/src/weather/effects.test.ts`** (nouveau, complet)

```ts
import { describe, expect, it } from 'vitest';
import { SNOW_COVER, WET } from './effects';
import { approach } from './state';

/** Neige au sol après `s` secondes d'une neige constante (ou de fonte, si `snow` vaut 0), par pas d'une image à 60 img/s */
function lying(from: number, snow: number, s: number) {
  let v = from;
  const target = Math.min(1, snow * SNOW_COVER.perSnow);
  for (let t = 0; t < s * 60; t++) v = approach(v, target, 1 / 60, target > v ? SNOW_COVER.tauUp : SNOW_COVER.tauDown);
  return v;
}

describe('neige au sol : s’accumule puis fond, comme le sol mouillé (EP009-US007)', () => {
  it('la neige type (0,6) blanchit presque tout en une à deux minutes', () => {
    expect(lying(0, 0.6, 30)).toBeGreaterThan(0.55);
    expect(lying(0, 0.6, 90)).toBeGreaterThan(0.9);
  });
  it('une petite neige ne couvre qu’en partie, même longtemps', () => {
    expect(lying(0, 0.2, 600)).toBeCloseTo(0.32, 2);
  });
  it('la fonte est bien plus lente que l’accumulation, et plus lente que le séchage', () => {
    expect(lying(1, 0, 60)).toBeGreaterThan(0.8);
    expect(lying(1, 0, 900)).toBeLessThan(0.1);
    expect(SNOW_COVER.tauDown).toBeGreaterThan(WET.tauDown);
  });
});
```

**`frontend/carte/src/weather/effects.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -4,18 +4,20 @@ import type { CityData } from '../types';
 import { weatherUniforms } from '../scene/weather-surface';
 import { fogColorFor, fogRange } from './fog';
 import { FULL_BUDGET, nextBudget, type RainBudget } from './budget';
-import { RAIN_COUNT, createRain, type Rain } from './rain';
+import { RAIN_COUNT, SNOW_COUNT, createRain, type PrecipKind, type Rain } from './rain';
 import { approach, type WeatherLook } from './state';
 
 /**
  * Effets de la météo sur la scène (EP009), dans le module chargé à la demande. Tout ce qui touche aux matériaux standards a été
  * posé au démarrage (règle 9) : ici on ne règle que des valeurs (brouillard, uniformes de la passe finale et du sol mouillé, mélange
- * des halos), sans aucune recompilation ; seuls les deux maillages de la pluie (un programme) arrivent avec la première pluie.
+ * des halos), sans aucune recompilation ; seuls les maillages de la pluie et de la neige (un programme pour les deux) arrivent avec
+ * la première précipitation.
  * Par temps sans effet : aucun travail par image.
  *  - Brouillard (US006) : `THREE.Fog` linéaire, réglé à chaque image selon la distance caméra – point regardé ; sa couleur est celle
  *    du fond de page au bord du socle, passée dans l'inverse du rendu des tons ; voile léger ; correction des couleurs prémultipliées
  *    de la passe finale (sinon liseré clair autour du socle).
  *  - Pluie (US005) : deux nappes de traînées (weather/rain.ts), sol mouillé, lueurs de nuit un peu plus fortes, règle de dégradation.
+ *  - Neige (US007) : deux nappes de flocons (même système), neige au sol qui s'accumule et fond, même règle de dégradation.
  */
 export interface EffectsCtx {
   scene: THREE.Scene;
@@ -42,6 +44,8 @@ export const UNPREMULT_FULL = 0.15;
 export const WET = { perRain: 1.6, tauUp: 20, tauDown: 120 };
 /** Lueurs de nuit (halos des bars, lueur des rues) en plus quand tout est mouillé */
 export const WET_GLOW = 0.25;
+/** Neige au sol : cible selon la neige qui tombe, temps pour couvrir (s) et pour fondre */
+export const SNOW_COVER = { perSnow: 1.6, tauUp: 30, tauDown: 300 };
 
 export function createEffects(ctx: EffectsCtx, reduced: () => boolean) {
   const fog = ctx.scene.fog as THREE.Fog | null; // posé inactif au démarrage (stage.ts)
@@ -65,13 +69,17 @@ export function createEffects(ctx: EffectsCtx, reduced: () => boolean) {
     }
   };
 
-  // Pluie : créée à la première pluie ; nombre de traînées selon le niveau de qualité (`?debug&rainmax=N` pour essayer)
-  let rain: Rain | null = null;
-  const q = new URLSearchParams(location.search), max = Number(q.get('rainmax'));
-  const count = q.has('debug') && max > 0 ? Math.min(50000, Math.round(max)) : RAIN_COUNT[ctx.quality];
+  // Pluie et neige : créées à la première précipitation ; nombre par niveau de qualité (`?debug&rainmax=N`, `&snowmax=N` pour essayer)
+  const precip: Record<PrecipKind, Rain | null> = { rain: null, snow: null };
+  const q = new URLSearchParams(location.search);
+  const countOf = (kind: PrecipKind, table: Record<QualityLevel, number>) => {
+    const max = Number(q.get(`${kind}max`));
+    return q.has('debug') && max > 0 ? Math.min(50000, Math.round(max)) : table[ctx.quality];
+  };
+  const count = { rain: countOf('rain', RAIN_COUNT), snow: countOf('snow', SNOW_COUNT) };
   let budget: RainBudget = { ...FULL_BUDGET };
-  ctx.onFpsSample((fps, atMin) => { if (rain?.visible()) budget = nextBudget(budget, fps, atMin); });
-  let wet = 0, glow = 1;
+  ctx.onFpsSample((fps, atMin) => { if (precip.rain?.visible() || precip.snow?.visible()) budget = nextBudget(budget, fps, atMin); });
+  let wet = 0, glow = 1, lying = 0;
 
   return {
     /** Appelé par le modificateur du ciel (daynight.ts), une fois la météo appliquée : fond de page et exposition finals */
@@ -101,13 +109,22 @@ export function createEffects(ctx: EffectsCtx, reduced: () => boolean) {
         ctx.post({ unpremult: u, veil: FOG_VEIL * k, veilColor: edge });
         if (u > 0 !== cover) { cover = u > 0; halos(cover); }
       }
-      // Pluie : deux nappes autour du point regardé et sur tout le socle (ralenties avec le réduit-mouvement)
-      const r = look.rain * budget.level;
-      if (r > 0.002) {
-        rain ??= createRain(ctx.scene, count, ctx.bounds);
-        const f = ctx.focus();
-        rain.update(dt, f, ctx.camera.position.distanceTo(f), r, look.rain, { speed: look.windSpeed, towards: look.windTowards }, ctx.night(), reduced() ? 0.3 : 1);
-      } else if (rain?.visible()) rain.hide();
+      // Pluie et neige : deux nappes chacune, autour du point regardé et sur tout le socle (ralenties avec le réduit-mouvement)
+      for (const kind of ['rain', 'snow'] as const) {
+        const raw = look[kind], r = raw * budget.level, p = precip[kind];
+        if (r > 0.002) {
+          const f = ctx.focus();
+          (precip[kind] ??= createRain(ctx.scene, count[kind], ctx.bounds, kind))
+            .update(dt, f, ctx.camera.position.distanceTo(f), r, raw, { speed: look.windSpeed, towards: look.windTowards }, ctx.night(), reduced() ? 0.3 : 1);
+        } else if (p?.visible()) p.hide();
+      }
+      // Neige au sol : s'accumule en une minute environ, fond en quelques minutes
+      const lyingTarget = Math.min(1, look.snow * SNOW_COVER.perSnow);
+      if (lying !== lyingTarget) {
+        lying = approach(lying, lyingTarget, dt, lyingTarget > lying ? SNOW_COVER.tauUp : SNOW_COVER.tauDown);
+        if (Math.abs(lying - lyingTarget) < 1e-3) lying = lyingTarget;
+        weatherUniforms.uSnow.value = lying;
+      }
       // Sol mouillé : vite à l'humidification, lentement au séchage ; lueurs de nuit un peu plus fortes
       const target = Math.min(1, look.rain * WET.perRain);
       if (wet === target) return false;
```


---

## 5. Tests (Vitest, projet `carte` : 76 → 85 tests, 11 fichiers)

- `scene/weather-surface.test.ts` (4 au lieu de 3) : uniformes partagés et un seul morceau après l'émissif ; **parts par matériau avec le
  même texte et la même clé** ; enchaînement et clé `…|wet` ; 0 par défaut.
- `weather/rain.test.ts` (+5) : la pluie garde son allure ; flocons au moins 5 fois plus lents que la pluie à toutes les distances, avec
  balancement ; continuité au zoom (aucun saut) ; petite et grosse neige ; `SNOW_COUNT` dans la fourchette de la spec.
- `weather/effects.test.ts` (nouveau, 3) : neige type blanche en 1 à 2 min ; petite neige qui ne couvre qu'en partie ; fonte bien plus lente.

---

## 6. Vérifications

**Agent, navigateur, puce graphique du Mac** (`mesures/us007.mjs`, `us007-shots.mjs`, `us007-dist.mjs`, `progs.mjs`, `progs2.mjs` ; build
final servi sur 4201, celui de `976841d` sur 4202 ; sorties dans `mesures/us007.txt`, `us007-cout.txt`) :
1. **Sans météo**, 12 h et 22 h : lumières, fond et appels **identiques** à `976841d` (2 407 / 2 407, 2 409 / 2 409) ; programmes 45 → 46
   et 40 → 41 [vérifié]. Le programme de plus (`progs2.mjs`) : les têtes des passants partageaient le programme des houppiers ; ceux-ci
   crochetés, elles ont le leur. Au démarrage seulement (≈ 0,17 s la première fois, cache vide [estimé d'après la mesure d'EP009]) ;
   l'éviter coûterait un crochet inutile sur les têtes (section 11, point 3).
2. **Arrivée de la neige** (depuis le beau temps, en mouvement) : `high` 3 000, `medium` 1 500, `low` 800 flocons par nappe : **+1
   programme** (41 → 42), **aucun pendant les 40 s d'accumulation** (42 → 42) ; mesuré de nuit (heure réelle de la mesure, 41 programmes au départ) : pire intervalle 18 / 18 / 18 ms à l'arrivée, puis 18, 46
   et 31 ms pendant l'accumulation (pire image processeur 41 ms en `medium` : ni programme ni rien de la neige à ce moment, sans doute la
   charge de la machine ou les programmes d'ombre d'une minute signalés par la relecture) ; appels +1 [mesuré]. **Pluie puis neige** :
   42 → 42 programmes (celui de la pluie sert), pire intervalle 31 ms [mesuré].
3. **TI-02 et réduit-mouvement** (rue) : 30,0 img/s au repos sous la neige ; chute 5,17 m/s et balancement 1 s/s, **1,55 m/s et 0,3 s/s**
   en réduit-mouvement [mesuré].
4. **Distances** (`us007-dist.mjs`, `?weather=snow`) : appels +1 à 2 850 et 1 200 m (nappe lointaine), +2 à 700 et 400 m (les deux), +1 à
   220 et 110 m (proche) — même relais que la pluie ; **vue de côté** : rien sur le fond de page (`us007-flocons-cote.png`) [vérifié].
5. **Pluie et neige** (`?weather=sleet`, vue d'ensemble, de nuit à l'heure de la mesure) : nappes lointaines de pluie et de neige affichées
   ensemble, 2 411 appels contre 2 409 sans météo (+2 ; +4 au plus entre 400 et 700 m, deux nappes par précipitation) [mesuré] ; capture `us007-flocons-pluie-et-neige-d700.png`.
6. **Règle de dégradation** (processeur ralenti 12 fois par le protocole de débogage, densité de pixels 1 = minimum) : densité des flocons
   0,95 → **0,50 à 8 s** → **coupés à 12 s** ; processeur rétabli (60 img/s) : restent coupés [vérifié, `us007.txt`].
7. **Coût** (neige 1 contre couvert en alternance, même page, 4 tours ; `us007-cout.txt`) : **dans le bruit** —
   `high` vue d'ensemble 59,92 → 59,99 img/s en mouvement, GPU 11,9 → 11,5 ms (± 0,6) ; rue 60 → 60, GPU 5,9 → 5,9 ; au repos 30 → 30 ;
   `medium` : 60 → 60, GPU 8,0 → 8,2 (± 0,2) en vue d'ensemble, 5,8 → 6,0 en rue. Appels au repos : +1 en vue d'ensemble, +1 ou +2 en rue (à
   260 m, la nappe lointaine commence) [mesuré]. Ces chiffres comptent les flocons **et** la neige au sol (branche du shader prise partout).
   Le Mac est plafonné à 60 img/s : pas de mesure de débit sans plafond, **aucune sur téléphone**.
8. **Captures** (section 7) : quatre vues de jour et de nuit après 90 s d'accumulation, mêmes vues « couvert » sur `976841d`, hiver (arbres
   nus), flocons à six distances [vérifié à l'œil].

**Dasco** : `?weather=snow` (attendre 1 à 2 min que tout blanchisse), `&intensity=0.2` (petite neige : plaques), `?weather=sleet` ; de jour et
de nuit (`?hour=22` ou le curseur), en saison « Hiver » (arbres nus) ; dans les quatre vues ; sur l'iPhone, le compteur `?debug`.

---

## 7. Captures regardées, et ce qui reste à régler à l'œil

Dossier : `/private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/7058533b-187f-4f4d-8d7b-9497ad542537/scratchpad/mesures/captures/` (1280 × 800, densité 1).

| Vue | Neige (90 s) | Sans neige (`976841d`, couvert) |
|---|---|---|
| Ensemble, jour | `us007-v2-jour-ensemble.png` | `us007-base-couvert-jour-ensemble.png` |
| Carré Curial, jour | `us007-v2-jour-carre.png` | `us007-base-couvert-jour-carre.png` |
| Château, jour | `us007-v2-jour-chateau.png` | `us007-base-couvert-jour-chateau.png` |
| Rue (place des Éléphants), jour | `us007-v2-jour-rue.png` | `us007-base-couvert-jour-rue.png` |
| Les quatre, nuit (22 h) | `us007-v2-nuit-{ensemble,carre,chateau,rue}.png` | `us007-base-couvert-nuit-*.png` |
| Hiver (arbres nus), jour | `us007-hiver-jour-{chateau,rue}.png` | `us007-base-hiver-jour-chateau.png` |
| Flocons, six distances et de côté (début d'accumulation) | `us007-flocons-d{2850,1200,700,400,220,110}.png`, `us007-flocons-cote.png` | — |
| Pluie et neige | `us007-flocons-pluie-et-neige-d{2850,1200,700}.png` | — |

(`us007-{jour,nuit}-*.png`, sans `v2` : premier réglage, plus gris, toits pentus plus sombres, chaussées toutes blanches ; gardées pour comparer.)

**À régler à l'œil** (constantes nommées, une ligne chacune) :
1. **Teinte** : blanc bleuté, un peu gris sous le ciel couvert ; **la nuit, lavande** plutôt que blanc (`us007-v2-nuit-*`) : lisible
   comme de la neige sur les captures, mais c'est le point le plus subjectif (couleur et lueur propre dans le GLSL).
2. **Rues** : chaussées à moitié dégagées (plaques), voies piétonnes presque blanches. En vue d'ensemble, le réseau des rues se lit moins
   (question 2).
3. **Pente** : les toits très pentus (clochers, l'église près des Éléphants : le toit noir de `us007-v2-jour-rue.png`) restent sombres ;
   c'est voulu (la neige ne tient pas au-delà de 70°), mais une tache noire au milieu du blanc se remarque.
4. **Flocons en rue** : petits et clairsemés à 110 m (`us007-flocons-d110.png`) ; essayer `?debug&snowmax=6000` et la taille
   (`snowMotion`).
5. **Arbres** : verts d'octobre et nus d'hiver se coiffent de blanc (`us007-hiver-jour-chateau.png`) ; les pins aussi.
6. **Bassins** : les petits plans d'eau peints dans le sol (11, tous sous 110 m²) blanchissent comme gelés ; les cours d'eau (maillage à part)
   restent bleus.
7. **Vitesse** : tout blanc en ≈ 1 min 10, fonte en ≈ 15 min (question 3 pour l'arrivée sur la page).

---

## 8. Poids [mesuré, gzip, Node zlib niveau 6]

| Chunk | `a9424e9` | `976841d` (base) | commit 1 | commit 2 | commit 3 (US007) |
|---|---|---|---|---|---|
| Principal | 84 231 o | 86 550 o (+2 319) | 86 906 o | 86 905 o | **86 908 o (+358 ; +2 677 depuis `a9424e9`)** |
| Module météo (`weather-*.js`) | — | 8 974 o | 8 975 o | 9 512 o | **9 660 o (+686)** |
| Contrat (`meteo-*.js`) | — | 709 o | 709 o | 709 o | 708 o |

Ce qui coûte au chunk principal : le GLSL de la neige et son bruit (≈ 0,25 Ko), les options `{ wet, snow }`, 8 appels de `weatherSurface` et
6 importations. **Reste ≈ 0,82 Ko** sous le plafond de 3,5 Ko (≈ 0,78 avec votre compte) pour US008 (lumières sous l'orage) et US009
(balancement posé au démarrage dans les arbres) [estimé : 0,3 à 0,5 Ko pour les deux]. Le module météo (9,7 Ko) atteint le haut de
l'estimation de la règle 12 (8 à 10 Ko une fois complet) : orage, vent et nuages le porteront vers 11 à 12 Ko [estimé] (section 11, point 9).

---

## 9. Arbres d'hiver (BACKLOG « Hiver : reprendre les arbres »)

- **Traité par US007** : quand il neige, les houppiers des arbres simples, les arbres modélisés (verts, d'automne ou nus) et les pins se
  couvrent de blanc sur le dessus, comme les toits ; l'hiver, les branches nues sont coiffées de neige (`us007-hiver-jour-chateau.png`).
- **Reporté** : « des arbres enneigés plutôt que nus » **sans neige qui tombe**. Ce n'est plus de la météo : en saison « Hiver » ou en
  direct sans neige, la carte montre aujourd'hui le temps réel ou simulé (beau temps, règle 7) ; poser de la neige au sol sans relevé
  serait inventer un état (règle 1) en direct. Deux voies, à décider (question 1) : **(a)** en saison « Hiver » **choisie à la main**
  seulement (donc déjà « simulée »), une neige au sol posée par la saison (une dizaine de lignes dans le module météo : `uSnow` ≥ 0,5, sans
  flocons ; rien dans le chunk principal) ; **(b)** des modèles d'arbres enneigés : le pack Quaternius livré n'a que des variantes
  d'automne et nues (`public/models/nature/`) ; le BACKLOG cite des buissons et rochers enneigés dans les sources du pack, pas d'arbres.

---

## 10. Appliquer le plan

Patchs : `/private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/7058533b-187f-4f4d-8d7b-9497ad542537/scratchpad/u7/patches-ep009-us007/` (`us007-1.patch` … `us007-3.patch`, produits par `u7/commits7.py` à partir de
l'instantané `u7/snap7/`). Depuis la racine du dépôt, sur `feat/EP009-US007-neige` :

```bash
git apply --check /private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/7058533b-187f-4f4d-8d7b-9497ad542537/scratchpad/u7/patches-ep009-us007/us007-1.patch && git apply /private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/7058533b-187f-4f4d-8d7b-9497ad542537/scratchpad/u7/patches-ep009-us007/us007-1.patch
npm run build && npm test   # puis git commit avec le message de la section 2 ; idem pour us007-2 et us007-3
```

Vérifié : les 3 patchs s'appliquent dans l'ordre sur une archive de `976841d` ; après chacun, `tsc` carte, contrat et back,
`check-boundaries`, Vitest (carte, contrat, outillage : 107, 112, 115 tests ; dont carte 77, 82, 85) et le build de la carte passent
(`u7/verif-commits7.txt`) ; sur l'état final, `npm run build` et `npm test` complets passent (22 fichiers, 196 tests) ; l'état final est
exactement l'instantané, et le build servi pour les mesures est celui-là (même empreinte `index-DXo_ntdj.js`). Le code de ce document **est**
celui des patchs (le document est produit à partir d'eux).

---

## 11. Points de la spec à corriger ou à préciser

1. **R3, la liste des matériaux** : 12 matériaux crochetés (section 3.1), pas « 8 à 10 » ; les 4 d'US005 gardent leur mouillé, les 8 nouveaux
   ne se mouillent pas (`wet: 0`), pour que la pluie validée par Dasco reste la même. Restent sans neige : tirets, berges, ponts, eau, troncs,
   fontaine des Éléphants, passants, oiseaux, repères. À écrire dans R3.
2. **CA 2 « selon la pente, façades non »** : pleinement sous 45°, rien au-delà de 73° ; conséquence visible : les toits très pentus
   (clochers) restent sombres (section 7, point 3). À écrire dans le CA.
3. **Règle 9 et démarrage** : +1 programme compilé **au démarrage** (45 → 46), pas en cours de route : les têtes des passants ne partagent plus
   le programme des houppiers. L'éviter : crocheter aussi les têtes avec `{ wet: 0, snow: 0 }` (2 lignes, ≈ 40 o) ; non fait (code sans
   effet visible). À dire dans le CA 3.
4. **CA 1 « ≤ 2 appels »** : 1 en vue d'ensemble et en rue, 2 entre 400 et 700 m ; « pluie et neige » : 2 à 4 (deux précipitations).
5. **R2 « un peu de bruit »** : plaques à deux échelles (7 m et 1,7 m) qui s'étendent avec l'accumulation ; une petite neige (`intensity=0.2`)
   ne couvre qu'en partie, même longtemps (≈ 32 %).
6. **Neige dans le temps** (demande du coordinateur, absente de la spec) : τ = 30 s pour couvrir, 5 min pour fondre (`SNOW_COVER`) ; à
   ajouter en R4. La fonte ne laisse pas le sol mouillé (non demandé ; une ligne si Dasco le veut).
7. **Ce que le relevé ne dit pas** : la carte ne connaît que la neige **qui tombe** ; une neige tombée avant l'ouverture de la page, ou
   tombée la nuit et encore au sol, n'apparaît pas (règle 1). Open-Meteo donne une hauteur de neige au sol (`snow_depth`) pour certains
   modèles [non vérifié pour ICON à Chambéry] : un champ de plus dans le contrat et le back, à étudier plus tard (pas dans US007).
8. **Pluie et neige** (`sleet` : pluie 0,3, neige 0,3) : sol à moitié blanc (cible 0,48) et mouillé à 0,48 ; flocons et gouttes à
   densité égale. Conforme au CA 4 ; dire dans la spec que la neige au sol y est partielle.
9. **Règle 12, module météo** : 9,7 Ko après la neige (estimation « 8 à 10 Ko une fois complet ») ; orage, vent et nuages le porteront vers
   11 à 12 Ko [estimé]. Sans effet sur le premier affichage (chargé à la demande) : corriger l'estimation plutôt que de rogner.
10. **R1 « 800 à 3 000 »** : nombres **par nappe** (comme la pluie) ; la neige visible vaut ≈ nombre × intensité. Valeurs par défaut
    800 / 1 500 / 3 000, Mac seulement ; l'iPhone « a l'air ok » avec la pluie à 5 000 / 2 500 / 1 200, sans chiffres.
11. **Estimation** : 3 à 4 j → ≈ 2 j, réglage à l'œil avec Dasco compris (le code est écrit et vérifié).
12. **BACKLOG** : « Hiver : reprendre les arbres » à scinder : la neige sur les arbres quand il neige (fait par US007) ; les arbres enneigés
    sans neige qui tombe (question 1).

---

## 12. Vraies questions pour Dasco

1. **Arbres d'hiver sans neige qui tombe** : quand il neige, tous les arbres se couvrent de blanc (`us007-hiver-jour-chateau.png`). Mais en
   hiver, sans neige annoncée, ils restent nus et bruns, comme aujourd'hui : la carte ne montre de neige que si le relevé (ou `?weather=`) en
   donne, sinon elle inventerait un temps qu'il ne fait pas. On pourrait poser une neige au sol légère (toits, sol, arbres blanchis, sans
   flocons) **seulement quand tu choisis la saison « Hiver » à la main**, où la météo est déjà « simulée » ; en direct, rien ne change.
   **Veux-tu cette neige d'ambiance quand la saison « Hiver » est choisie, ou garde-t-on la neige uniquement quand il neige ?** Recommandé :
   oui pour la saison choisie (une dizaine de lignes dans le module météo, rien dans le fichier principal), et l'item du BACKLOG fermé
   ensuite.
2. **Rues sous la neige** : aujourd'hui, les chaussées blanchissent à moitié (plaques grises, comme déneigées) et les voies piétonnes presque
   entièrement (`us007-v2-jour-rue.png`). Tout blanc fait plus « carte postale » mais on ne lit plus le plan des rues en vue d'ensemble ;
   rien du tout ferait des rubans gris au milieu de la neige. **Les gardes-tu à moitié dégagées, ou les veux-tu plus blanches (ou plus
   nettes) ?** Recommandé : regarder `?weather=snow` en vue d'ensemble et en rue, puis choisir ; c'est un nombre par type de voie.
3. **Arrivée sur la page pendant qu'il neige** : la neige au sol part de zéro à l'ouverture et met environ une minute à tout blanchir
   (devant le visiteur). C'est joli en démo, mais un visiteur qui arrive en pleine chute de neige voit d'abord une ville sans neige, ce qui
   est faux. **Préfères-tu que la ville soit déjà blanche à l'ouverture quand il neige (l'accumulation ne jouant que pendant la visite),
   ou qu'elle blanchisse sous les yeux comme maintenant ?** Recommandé : déjà blanche à l'ouverture (quelques lignes) ; `?weather=snow`
   le serait aussi.

---

## 13. Vérifié / non vérifié

**Vérifié** (copie, archive de `976841d`, jamais dans le dépôt) :
- Les 3 patchs s'appliquent dans l'ordre ; après chacun : `tsc` carte, contrat et back, `check-boundaries` (avec la règle `z…()`), Vitest
  (carte, contrat, outillage) et build de la carte passent ; à la fin, `npm run build` et `npm test` complets passent (22 fichiers, 196 tests).
- Sans météo : lumières, fond et appels identiques à `976841d` à 12 h et 22 h ; +1 programme au démarrage (expliqué).
- Neige : 1 programme à l'arrivée (0 après la pluie), aucun pendant l'accumulation ; pires images sous 50 ms ; ≤ 2 appels (4 avec la
  pluie) ; rien sur le fond de page vue de côté ; règle de dégradation de bout en bout (processeur ralenti) ; réduit-mouvement ; 30 img/s
  au repos ; pluie et neige mêlées ; captures des quatre vues de jour et de nuit, et en hiver.

**Mesuré, sur le Mac seulement** (Apple M1, puce graphique par Metal, sans fenêtre, plafonné à 60 img/s) : pires images, coût par image
(dans le bruit), poids gzip.

**Non vérifié** :
- **Aucun téléphone** : ni la cadence sous la neige (flocons **et** neige au sol, qui ajoute un calcul à chaque pixel des 12 matériaux tant
  que `uSnow` > 0), ni les nombres de flocons par niveau, ni la dégradation sur un vrai appareil lent.
- Safari et WebKit : non essayés (même mélange par l'alpha de la destination que la pluie).
- Le rendu « au goût de Dasco » : teinte de jour et de nuit, rues, toits pentus, taille et nombre des flocons (section 7, questions 2 et 3).
- Le temps de démarrage avec le programme de plus (≈ 0,17 s la première fois, [estimé]).
- La vraie neige de la route `/api/weather` (jamais de neige réelle en octobre ; copies sans API) : seulement `?weather=snow`, `sleet` et
  `window.diorama.weather.set()` ; la règle des 2 °C (règle 6) est celle d'US002, testée, inchangée.
- Aucun enregistrement vidéo : l'absence de saut des flocons au zoom est garantie par construction (chute cumulée, boîtes fixes) et par les
  tests de continuité, vue sur des captures fixes.

---

## 14. Scripts et fichiers de la session

Dossier : `/private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/7058533b-187f-4f4d-8d7b-9497ad542537/scratchpad/` ; scripts dans `mesures/` (Playwright du cache npx, Chrome for Testing 145 de `ms-playwright/chromium-1208`, Metal,
densité de pixels 1, 1280 × 800). Lancer **toujours** avec `BASE=http://localhost:4201 REF=http://localhost:4202` (sans `BASE`, `lib.mjs`
vise 4181) ; builds servis par `npx vite preview frontend/carte --port 4201 --strictPort` dans `u7/work/` (état final) et `u7/base/`
(`976841d`), proxy de Vite pointé vers 8807 dans ces copies seulement.

| Fichier | Rôle |
|---|---|
| `mesures/us007.mjs` (`ONLY=A…F`) | Sans météo identique, arrivée (programmes, pires images), TI-02 et réduit-mouvement, coût (`D`, long), pluie et neige, dégradation |
| `mesures/us007-shots.mjs` (`Q`, `TAG`, `WAIT`, `HOURS`, `VIEWS`, `SEASON`) | Captures des quatre vues, de jour et de nuit |
| `mesures/us007-dist.mjs` | Flocons à six distances et vue de côté ; appels par distance |
| `mesures/progs.mjs`, `progs2.mjs` | Programmes au démarrage, et quels matériaux les partagent |
| `mesures/us007.txt`, `us007-cout.txt` | Sorties |
| `u7/patches-ep009-us007/`, `u7/commits7.py`, `u7/snap7/`, `u7/applytest/`, `u7/verif-commits7.sh` (`.txt`) | Patchs, script, instantané, dépôt de travail, contrôles par commit |
