# Plan prêt à coder : EP009 — US006 (brouillard) puis US005 (pluie), carte

Rédigé le 09/10/2026 par l'agent chercheur / planificateur front 3D. **Aucun fichier du dépôt modifié**, sauf ce plan.
Point de départ : **`1da4136`** (`fix/EP009-carte-revue` : corrections de la relecture du code de la carte, bientôt fusionnée dans
`feat/EP009-meteo`). Le plan a d'abord été écrit sur `48ffd36`, puis réappliqué et revérifié sur `1da4136` (section 1).
Sources : spec EP009 v2 (`US006-brouillard.md`, `US005-pluie.md`, règles 8 à 12 de l'epic), [plan front v2](ep009-front-plan-v2.md) § 2.2,
2.3, 2.8, 4.2, 4.3, 5.2, le prototype du 09/10 et [le plan d'US001, US002, US004](ep009-us001-us002-us004-plan.md) (captures `halo-*`).

Légende : **[mesuré]** = mesuré le 09/10/2026 sur le Mac (Apple M1, Chrome for Testing 145 sans fenêtre, ANGLE Metal, vraie
puce graphique), **jamais sur un téléphone** ; **[vérifié]** = constaté dans une copie du dépôt (types, tests, build, navigateur) ;
**[estimé]** = non mesuré.

---

## 0. En bref

- **Tout le code a été appliqué et vérifié dans une copie** (archive de `1da4136`) : 5 commits (2 pour US006, 3 pour US005), un
  patch chacun, chacun vérifié (`tsc` carte, contrat et back, `check-boundaries`, Vitest, build de la carte) ; à la fin, `npm run build`
  et `npm test` passent (21 fichiers, **187 tests**). Navigateur avec la puce graphique du Mac (scripts fournis, ports 4201 et 4202, API 8807), **tout revérifié sur `1da4136`**.
- **US006, brouillard** (2 commits) : `THREE.Fog` linéaire (posé au démarrage par US002) dont `near` / `far` suivent la distance
  caméra – point regardé, s'effaçant sans saut quand l'intensité tend vers 0 ; couleur = fond de page au bord du socle passé dans l'inverse
  du rendu des tons (5 tests à moins de 1/255) ; voile léger ; **correction des couleurs prémultipliées activée avec le brouillard** ;
  halos des bars en mélange **« par-dessus »** pendant le brouillard (comparé à « alpha inchangé », qui coupe les épingles : écarté).
  Activé puis coupé 15 fois : **aucun programme nouveau, pire image 18 ms** [mesuré]. Coût par image : dans le bruit [mesuré].
- **US005, pluie** (3 commits) : crochets « sol mouillé » posés au démarrage dans 4 matériaux (rues pavées et goudronnées, bâtiments et
  toits, sol) ; deux nappes de traînées (proche autour du point regardé, lointaine sur tout le socle) en fondu selon la distance, chute
  cumulée par le processeur (aucun saut au zoom) ; **la pluie ne se dessine que sur ce qui est déjà dessiné** (mélange par l'alpha de la
  destination) : vue de côté, plus rien sur le fond beige [vérifié, capture] ; lueurs de nuit +25 % sous la pluie ; règle de dégradation
  (24 img/s, densité de pixels au minimum) branchée sur la résolution adaptative [vérifié de bout en bout, processeur ralenti : moitié des gouttes à 8 s, plus rien à 12 s, pas de remontée] ; réduit-mouvement (chute × 0,3) [mesuré : 31 → 9,3 m/s] ;
  30 img/s au repos (TI-02) [mesuré]. Arrivée de la pluie : **1 programme, pire image 18 à 19 ms** ; **+1 appel** en vue d'ensemble et
  en rue, +2 entre les deux [mesuré].
- **Nombre de traînées par niveau** (paramétrable : `RAIN_COUNT` dans `weather/rain.ts`, et `?debug&rainmax=N` pour essayer) : par défaut
  `low` 1 200, `medium` 2 500, `high` 5 000 ; le Mac ne voit pas la différence à 5 000 ni à 2 500 (pluie 1 contre couvert : 60 img/s en mouvement, 30 au repos, GPU et processeur dans le bruit, en `high` comme en `medium`) [mesuré]. À confirmer par la mesure
  iPhone de Dasco (US001).
- **Chunk principal** : US006 **rien de mesurable** (−31 o, bruit du minifieur), US005 **+266 o** ; total depuis `a9424e9` : **+2,32 Ko sur 2,5**.
  Le module météo (chargé à la demande) passe de 5,7 à **9,0 Ko** (règle 12 : 8 à 10 Ko une fois complet). **Il ne restera que 0,19 Ko pour
  US007 à US011** : vraie question pour Dasco (section 7).
- **À trancher ou préciser** : 14 points (section 6), et 3 vraies questions pour Dasco (section 7).

---

## 1. Avant de commencer

1. **Base** : `1da4136` (`fix/EP009-carte-revue`). Les patchs ne touchent que `frontend/carte/src`. `feat/EP009-meteo` (`e4e3b10`, fusion
   de `1da4136`) a exactement le même `frontend/carte` : les 5 patchs s'y appliquent aussi, même état final [vérifié]. **Réapplication depuis `48ffd36`** : seuls `weather/index.ts` et `main.ts` étaient touchés des deux
   côtés ; `main.ts` sans conflit ; dans `weather/index.ts`, `update(dt)` garde la règle de la relecture (le ciel n'est recalculé que si
   `cloud`, `rain`, `snow`, `fog` ou `storm` bougent, pas pour le seul fondu du vent) **et** appelle les effets à chaque image (le brouillard
   suit la caméra, la pluie lit le vent lissé directement) ; le ciel est aussi recalculé quand les lueurs de nuit du sol mouillé changent.
   Nouvelle règle de `check-boundaries` (appel `z…()` sans résultat) : passe à chaque commit ; et **aucune variable nommée `z`** dans ce
   code (la version sur `48ffd36` en avait deux, dans `fog.ts` et `effects.ts`, dont un `z.map(…)` gardé : renommées ; le JavaScript
   produit est identique octet pour octet, les mesures du navigateur valent donc pour ce code).
   Les anciens patchs (sur `48ffd36`) restent dans `patches-ep009-us006-us005-sur-48ffd36/`, pour mémoire.
2. **Ordre** : US006 d'abord (elle ne dépend que d'US002), puis US005. Branches `feat/EP009-US006-brouillard` et `feat/EP009-US005-pluie`.
3. **Rien à changer** au contrat, au back, à `vite.config.ts`. Dans les copies de vérification, le proxy de Vite visait le port 8807 (aucune
   API : `/api/weather` → 502 → ciel par défaut) ; **ce n'est pas dans les patchs**.
4. **Ce qui a été posé par US002 et sert ici** (aucune recompilation en cours de route, règle 9) : l'objet `scene.fog` inactif
   (`stage.ts`), les uniformes `uUnpremult`, `uVeil`, `uVeilColor`, `uFlash` de la passe finale et `tiltShift.setWeather()`, les
   `fog: false` des gemmes, épingles, halos, éléphants et de la lueur de la fontaine.

---

## 2. US006 — Brouillard

### 2.1 Commits

| # | Message | Fichiers |
|---|---|---|
| 1 | `feat(meteo): brouillard, fonctions pures (portée selon la caméra, couleur du fond par l'inverse ACES)` | `weather/fog.ts`, `weather/fog.test.ts` (nouveaux) |
| 2 | `feat(meteo): brouillard sur la carte (Fog réglé par la caméra, voile, correction prémultipliée, halos par-dessus)` | `weather/effects.ts` (nouveau), `weather/index.ts`, `main.ts` |
| 3 | `docs: itération N (EP009-US006, brouillard)` | FEATURES, CHANGELOG, DECISIONS (2.6) |

### 2.2 Ce que fait le code

- **Portée** (`fogRange`, pure) : `near = d·(1 − 0,55·k)`, `far = d + taille·(1,6 − 1,25·k)` (prototype), avec `d` la distance
  caméra – point regardé et `k` l'intensité ; **au-dessous de k = 0,35, la fin s'éloigne jusqu'à l'infini** (le prototype gardait 44 % de
  brouillard au fond du socle juste avant de couper : un saut à la disparition). Vue d'ensemble à 0,8 : 22 % au devant du socle, 100 % au
  fond ; en rue : léger autour du point regardé, le bout de la ville noyé [tests]. À 0 : valeurs du démarrage (1e9, 2e9).
- **Couleur** (`fogColorFor`, reprise de `scene/weather-color.ts` du prototype, dans le module météo) : la couleur du bord du fond de page
  (`bg[1]`, celle que la météo a déjà grisée) passée dans l'inverse exact de l'exposition, du rendu des tons ACES de three.js et du sRGB ;
  lue par le modificateur du ciel à chaque recalcul (`effects.readSky`) : **rien dans le chunk principal**.
- **À chaque image avec du brouillard** (`effects.update`) : `near`, `far`, couleur ; passe finale : correction des couleurs
  prémultipliées (pleine dès k = 0,15), voile `0,15·k` couleur du fond ; une dernière fois quand il s'en va (remise au repos), puis plus rien.
- **Halos des bars la nuit** : pendant que la correction est active, mélange « par-dessus » (`blendSrcAlpha = One`,
  `blendDstAlpha = OneMinusSrcAlpha` : l'alpha devient une couverture) ; retour au mélange additif d'origine ensuite. C'est un état du pilote
  graphique : **aucune recompilation** [mesuré]. Comparé dans le brouillard, de nuit, au bord du socle : « par-dessus » = lueur plus pâle mais
  propre (`us006-halo-dessus.png`) ; « alpha inchangé » = l'épingle coupée en deux (`us006-halo-alpha-inchange.png`) : écarté ; sans
  brouillard, rien ne change (`us006-halo-sans-brouillard.png`).
- **Repères** (D12) : gemmes, épingles, halos, éléphants restent nets (posé par US002, vérifié sur les captures) ; étiquettes (scène à part)
  nettes ; interface lisible sur le fond gris (`us006-interface.png`).

### 2.3 Code

#### Commit 1 — `feat(meteo): brouillard, fonctions pures (portée selon la caméra, couleur du fond par l'inverse ACES)`

Patch : `/private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/7058533b-187f-4f4d-8d7b-9497ad542537/scratchpad/patches-ep009-us006-us005/us006-1.patch`.

**`frontend/carte/src/weather/fog.test.ts`** (nouveau, complet)

```ts
import { describe, expect, it } from 'vitest';
import { FOG_OFF, displayed, fogColorFor, fogRange } from './fog';

const hex = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
/** Part de brouillard (THREE.Fog linéaire) à une profondeur donnée */
const fogAt = (r: { near: number; far: number }, depth: number) => Math.min(1, Math.max(0, (depth - r.near) / (r.far - r.near)));
const SIZE = 1325, OVERVIEW = 2850, STREET = 120; // socle de 1 325 m ; distances caméra – point regardé (vue d'ensemble, rue)

describe('couleur du brouillard calée sur le fond de page (inverse du rendu des tons ACES)', () => {
  for (const [name, css, exposure] of [['jour', '#f0dfc4', 1.05], ['nuit', '#1d2442', 1.0], ['crépuscule', '#f2a98a', 1.0], ['gris de pluie', '#c9c9c4', 0.95], ['brouillard clair', '#e8e6e1', 1.05]] as const) {
    it(`${name} : la couleur affichée retombe sur ${css}`, () => {
      const target = hex(css);
      displayed(fogColorFor(target, exposure), exposure).forEach((v, i) => expect(Math.abs(v - target[i])).toBeLessThan(1 / 255));
    });
  }
});

describe('portée du brouillard selon l’intensité et la distance', () => {
  it('à 0 : inactif (valeurs du démarrage)', () => {
    expect(fogRange(0, OVERVIEW, SIZE)).toEqual(FOG_OFF);
  });
  it('vue d’ensemble, brouillard type (0,8) : le devant reste lisible, le fond du socle se noie', () => {
    const r = fogRange(0.8, OVERVIEW, SIZE);
    expect(fogAt(r, OVERVIEW - 0.6 * SIZE)).toBeLessThan(0.3); // devant du socle (prototype : 22 %)
    expect(fogAt(r, OVERVIEW + 0.6 * SIZE)).toBe(1); // fond du socle
  });
  it('de près (rue), le brouillard est léger autour du point regardé', () => {
    const r = fogRange(0.8, STREET, SIZE);
    expect(fogAt(r, STREET)).toBeLessThan(0.1);
    expect(fogAt(r, STREET + 0.6 * SIZE)).toBeGreaterThan(0.8); // le bout de la ville, lui, est noyé
  });
  it('plus d’intensité, plus de brouillard partout ; il s’efface sans saut quand l’intensité tend vers 0', () => {
    const depth = OVERVIEW + 0.3 * SIZE;
    const ks = [0.002, 0.05, 0.1, 0.2, 0.35, 0.5, 0.8, 1];
    const f = ks.map((k) => fogAt(fogRange(k, OVERVIEW, SIZE), depth));
    f.slice(1).forEach((v, i) => expect(v).toBeGreaterThanOrEqual(f[i]));
    expect(f[0]).toBeLessThan(0.01);
  });
});
```

**`frontend/carte/src/weather/fog.ts`** (nouveau, complet)

```ts
/**
 * Brouillard (EP009-US006), fonctions pures testées en Vitest (sans three.js) :
 *  - `fogRange` : début et fin du brouillard linéaire (`THREE.Fog`, posé inactif au démarrage par stage.ts), calés sur la distance
 *    entre la caméra et le point regardé : le devant reste lisible, le fond de la ville se noie, à tous les zooms ;
 *  - `fogColorFor` : la couleur (espace linéaire de la scène) qui, après la passe finale (exposition, rendu des tons ACES de
 *    three.js, sRGB), s'affiche exactement comme une couleur du fond de page : un fragment noyé se confond avec le fond.
 * Les nombres sont des choix de rendu, à régler avec Dasco (`?weather=fog&intensity=`).
 */
type V3 = [number, number, number];

/** Brouillard inactif : il commencerait à un million de km (valeurs du démarrage, stage.ts) */
export const FOG_OFF = { near: 1e9, far: 2e9 } as const;

const smooth = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/**
 * k : intensité du brouillard (0..1) ; d : distance caméra – point regardé (m) ; size : taille du socle (m).
 * Au-dessus de 0,35, le brouillard du prototype ; en dessous, sa fin s'éloigne jusqu'à l'infini : il s'efface sans saut.
 */
export function fogRange(k: number, d: number, size: number): { near: number; far: number } {
  if (k <= 0.001) return { ...FOG_OFF };
  const near = d * (1 - 0.55 * k);
  const far = d + size * (1.6 - 1.25 * k);
  return { near, far: near + (far - near) / Math.max(smooth(0, 0.35, k), 1e-3) };
}

// Matrices du rendu des tons ACES de three.js (tonemapping_pars_fragment), en lignes
const IN: number[][] = [[0.59719, 0.35458, 0.04823], [0.07600, 0.90834, 0.01566], [0.02840, 0.13383, 0.83777]];
const OUT: number[][] = [[1.60475, -0.53108, -0.07367], [-0.10208, 1.10813, -0.00605], [-0.00327, -0.07276, 1.07602]];
const mul = (m: number[][], v: V3): V3 => [0, 1, 2].map((i) => m[i][0] * v[0] + m[i][1] * v[1] + m[i][2] * v[2]) as V3;
function inv(m: number[][]): number[][] {
  const [a, b, c] = m[0], [d, e, f] = m[1], [g, h, i] = m[2];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det], [B / det, (a * i - c * g) / det, -(a * f - c * d) / det], [C / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
}
const IN_INV = inv(IN), OUT_INV = inv(OUT);
const rrt = (v: number) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);
/** Inverse de RRTAndODTFit (racine positive du trinôme) */
function rrtInv(t: number): number {
  const A = 0.983729 * t - 1, B = 0.432951 * t - 0.0245786, C = 0.238081 * t + 0.000090537;
  if (Math.abs(A) < 1e-9) return -C / B;
  const disc = Math.max(0, B * B - 4 * A * C);
  const r1 = (-B + Math.sqrt(disc)) / (2 * A), r2 = (-B - Math.sqrt(disc)) / (2 * A);
  return [r1, r2].filter((r) => r >= 0).sort((x, y) => x - y)[0] ?? 0;
}
const srgbToLinear = (c: number) => (c <= 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4));
const linearToSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 0.41666) - 0.055);

/** Comme la passe finale : couleur linéaire de la scène → couleur sRGB affichée (0..1) (sert aux tests) */
export function displayed(lin: V3, exposure: number): V3 {
  const v = mul(OUT, mul(IN, lin.map((x) => (x * exposure) / 0.6) as V3).map(rrt) as V3);
  return v.map((x) => linearToSrgb(Math.min(1, Math.max(0, x)))) as V3;
}

/** Couleur linéaire à donner au brouillard pour qu'elle s'affiche comme la couleur sRGB `srgb` (0..1) */
export function fogColorFor(srgb: readonly number[], exposure: number): V3 {
  // (pas de variable nommée `z` dans la carte : ses appels sont déclarés purs au build, voir vite.config.ts)
  const odt = mul(OUT_INV, srgb.map(srgbToLinear) as V3);
  const w = odt.map((x) => rrtInv(Math.min(1, Math.max(0, x)))) as V3;
  return mul(IN_INV, w).map((x) => Math.max(0, (x * 0.6) / exposure)) as V3;
}
```


#### Commit 2 — `feat(meteo): brouillard sur la carte (Fog réglé par la caméra, voile, correction prémultipliée, halos par-dessus)`

Patch : `/private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/7058533b-187f-4f4d-8d7b-9497ad542537/scratchpad/patches-ep009-us006-us005/us006-2.patch`.

**`frontend/carte/src/main.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -596,7 +596,7 @@ async function main() {
       if (!m || weather) return;
       try {
         const w = m.startWeather({
-          root: app, scene, camera, focus: () => controls.target, quality: qualityLevel(), wind,
+          root: app, scene, camera, focus: () => controls.target, quality: qualityLevel(), wind, size: stage.size, post: tiltShift.setWeather,
           sky: (m) => dayNight.setWeather(m), night: () => dayNight.getNight(), clock: () => clock.state(),
           backToLive: () => { clock.setSeason('auto'); clock.live(); }, chip: ui.setWeatherChip,
           // Crédit de la source (règle 11) : en bas à droite et dans les crédits de l'accueil, seulement avec ses données
```

**`frontend/carte/src/weather/effects.ts`** (nouveau, complet)

```ts
import * as THREE from 'three';
import { fogColorFor, fogRange } from './fog';
import type { WeatherLook } from './state';

/**
 * Effets de la météo sur la scène (EP009), dans le module chargé à la demande. Tout ce qui touche aux matériaux standards a été
 * posé au démarrage (règle 9) : ici on ne règle que des valeurs (brouillard, uniformes de la passe finale, mélange des halos),
 * sans aucune recompilation. Par temps sans effet : aucun travail par image.
 *  - Brouillard (US006) : `THREE.Fog` linéaire, réglé à chaque image selon la distance caméra – point regardé ; sa couleur est celle
 *    du fond de page au bord du socle, passée dans l'inverse du rendu des tons ; voile léger ; correction des couleurs prémultipliées
 *    de la passe finale (sinon liseré clair autour du socle).
 */
export interface EffectsCtx {
  scene: THREE.Scene;
  camera: THREE.Camera;
  /** Point regardé */
  focus(): THREE.Vector3;
  /** Taille du socle (m) */
  size: number;
  /** Passe finale : correction des couleurs prémultipliées, voile (couleur d'écran), éclair (tiltShift.setWeather) */
  post(w: { unpremult?: number; veil?: number; veilColor?: readonly [number, number, number]; flash?: number }): void;
}

/** Voile de la passe finale à pleine intensité de brouillard (baisse de contraste, couleur du fond) */
export const FOG_VEIL = 0.15;
/** Brouillard à partir duquel la correction des couleurs prémultipliées est complète */
export const UNPREMULT_FULL = 0.15;

export function createEffects(ctx: EffectsCtx) {
  const fog = ctx.scene.fog as THREE.Fog | null; // posé inactif au démarrage (stage.ts)
  /** Fond de page au bord du socle (sRGB 0..1) et exposition, relus à chaque recalcul du ciel (après la météo) */
  const edge: [number, number, number] = [1, 1, 1];
  let exposure = 1;
  const rgb = { r: 0, g: 0, b: 0 };
  let fogOn = false, cover = false;

  // Halos des bars (lueur additive) : avec la correction des couleurs prémultipliées, leur alpha (qui n'est pas une couverture)
  // les éteindrait au-dessus du fond de page ; pendant le brouillard, ils passent « par-dessus » (l'alpha devient une couverture).
  // Le mélange est un état du pilote graphique, pas du programme : aucune recompilation.
  const haloMats: THREE.PointsMaterial[] = [];
  ctx.scene.getObjectByName('placeHalos')?.traverse((o) => {
    if ((o as THREE.Points).isPoints) haloMats.push((o as THREE.Points).material as THREE.PointsMaterial);
  });
  const halos = (over: boolean) => {
    for (const m of haloMats) {
      if (over) Object.assign(m, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor });
      else m.blending = THREE.AdditiveBlending;
    }
  };

  return {
    /** Appelé par le modificateur du ciel (daynight.ts), une fois la météo appliquée : fond de page et exposition finals */
    readSky(bg: THREE.Color[], exp: number) {
      bg[1].getRGB(rgb, THREE.SRGBColorSpace);
      edge[0] = rgb.r; edge[1] = rgb.g; edge[2] = rgb.b;
      exposure = exp;
    },
    /** À chaque image : rien sans brouillard (une dernière fois quand il s'en va, pour le remettre au repos) */
    update(look: WeatherLook) {
      const k = look.fog;
      if (!fog || (k <= 0 && !fogOn)) return;
      fogOn = k > 0;
      const r = fogRange(k, ctx.camera.position.distanceTo(ctx.focus()), ctx.size);
      fog.near = r.near;
      fog.far = r.far;
      if (fogOn) {
        const [cr, cg, cb] = fogColorFor(edge, exposure);
        fog.color.setRGB(cr, cg, cb, THREE.LinearSRGBColorSpace);
      }
      const u = Math.min(1, k / UNPREMULT_FULL);
      ctx.post({ unpremult: u, veil: FOG_VEIL * k, veilColor: edge });
      if (u > 0 !== cover) { cover = u > 0; halos(cover); }
    },
  };
}
```

**`frontend/carte/src/weather/index.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -12,17 +12,18 @@ import {
 } from './state';
 import { createWeatherClient, fetchWeather, type WeatherFetch } from './client';
 import { createWeatherPanel } from './panel';
+import { createEffects, type EffectsCtx } from './effects';
 
 /**
  * Module météo de la carte (EP009), chargé à la demande par main.ts : rien ne l'attend, il ne bloque rien.
  * Il branche l'état météo (?weather=, outil de debug, puis relevé du back avec US004, règle « Direct ou simulée ») sur la
  * scène (ciel lissé par un fondu), la puce de la barre d'heure et son panneau. Par temps stable : aucun travail par image.
  */
-export interface WeatherCtx {
+export interface WeatherCtx extends EffectsCtx {
   root: HTMLElement;
   scene: THREE.Scene;
   camera: THREE.Camera;
-  /** Point regardé (précipitations, US005) */
+  /** Point regardé (brouillard, précipitations) */
   focus(): THREE.Vector3;
   quality: QualityLevel;
   /** Vent de beau temps (content/life.json) : objet partagé par la fumée et les drapeaux (US009 le fera varier) */
@@ -76,8 +77,12 @@ const sameLook = (a: WeatherLook, b: WeatherLook) =>
 
 export function startWeather(ctx: WeatherCtx): WeatherModule {
   const clear = clearLook(ctx.wind);
-  /** Le ciel suit la météo lissée `cur` (lue à chaque recalcul du cycle jour/nuit) */
-  const skyModifier = (v: SkyValues, dayF: number) => applyWeatherSky(v, cur, dayF);
+  const effects = createEffects(ctx);
+  /** Le ciel suit la météo lissée `cur` (lue à chaque recalcul du cycle jour/nuit) ; les effets lisent le fond qui en résulte */
+  const skyModifier = (v: SkyValues, dayF: number) => {
+    applyWeatherSky(v, cur, dayF);
+    effects.readSky(v.bg, v.exposure);
+  };
   const pref = loadWeatherPref();
   const mq = matchMedia('(prefers-reduced-motion: reduce)');
   const inputs: WeatherInputs = { enabled: pref.enabled, url: weatherFromUrl(location.search), debug: null, api: 'none', reading: null, live: isLive(ctx.clock()) };
@@ -166,11 +171,13 @@ export function startWeather(ctx: WeatherCtx): WeatherModule {
 
   return {
     update(dt) {
-      if (!blending) return; // temps stable : rien à faire
-      const { cloud, rain, snow, fog, storm } = cur;
-      blending = blendLook(cur, target, dt);
-      // Le ciel ne lit que les nuages et les précipitations : le fondu du vent (plus long) ne recalcule pas l'ambiance
-      if (cur.cloud !== cloud || cur.rain !== rain || cur.snow !== snow || cur.fog !== fog || cur.storm !== storm) ctx.sky(skyModifier);
+      if (blending) {
+        const { cloud, rain, snow, fog, storm } = cur;
+        blending = blendLook(cur, target, dt);
+        // Le ciel ne lit que les nuages et les précipitations : le fondu du vent (plus long) ne recalcule pas l'ambiance
+        if (cur.cloud !== cloud || cur.rain !== rain || cur.snow !== snow || cur.fog !== fog || cur.storm !== storm) ctx.sky(skyModifier);
+      }
+      effects.update(cur); // brouillard : suit la caméra ; sans effet, rien
     },
     onClock(c) {
       const live = isLive(c);
```


### 2.4 Tests (Vitest, projet `carte`)

`weather/fog.test.ts` (9 tests : 5 couleurs du prototype — jour, nuit, crépuscule, gris de pluie, brouillard clair — à moins de 1/255 ;
portée : inactif à 0, devant lisible et fond noyé en vue d'ensemble, léger de près, monotone et sans saut vers 0). Résultat attendu :
`npx vitest run --project carte` → **7 fichiers, 63 tests** [vérifié].

### 2.5 Vérifications

**Agent, navigateur, puce graphique du Mac** (`us006.mjs`, `us006-c.mjs`, `us006-cout.mjs` ; build servi sur 4201, celui de `1da4136` sur 4202) :
1. Sans météo, 12 h et 22 h, état final (US006 et US005) : lumières, fond, appels de rendu et programmes **identiques** à `1da4136` ;
   brouillard au repos (1e9, 2e9) [vérifié] (US006 seule : vérifiée de même sur `48ffd36`).
2. `?weather=fog` de jour, de nuit et au crépuscule, vue d'ensemble et rue : `us006-jour-ensemble.png`, `us006-nuit-ensemble.png`,
   `us006-jour-rue.png`… ; couleur du brouillard `fde8ce` (jour), `333541` (nuit), `c5a095` (crépuscule) ; **pas de liseré clair** au bord du
   socle (`us006-bord-jour.png`, k = 0,6, densité 2) [vérifié].
3. Activé puis coupé 10 fois de jour : pire intervalle 18 ms, programmes 44 → 44 ; 5 fois de nuit : 18 ms, 45 → 45 [mesuré] (sur `48ffd36` :
   27 et 19 ms). (`us006.mjs` C, qui compte les programmes dès le démarrage, affiche 40 → 45 et ✗ : le premier relevé précède les
   programmes de la nuit et des ombres ; `us006-c.mjs` mesure à heure fixe. Un premier
   essai montrait +5 programmes : c'était le passage du jour à la nuit, qui compile ses propres programmes, avec ou sans météo. Et selon
   la relecture de la carte, quatre programmes de profondeur des ombres se compilent environ 1 min après le démarrage, avant même EP009 :
   une image longue à ce moment-là n'est pas la météo.)
4. Coût par image (`us006-cout.mjs` : vue d'ensemble et rue, en mouvement, en alternance beau temps / couvert / brouillard, 5 tours) :
   vue d'ensemble 60,00 / 59,99 / 60,00 img/s, processeur 7,1 / 7,2 / 7,2 ms (± 0,3), GPU 8,1 / 8,1 / 8,2 ms ; rue 60 / 60 / 60 img/s,
   processeur 3,4 / 3,3 / 3,2 ms, GPU 5,6 / 5,8 / 5,9 ms (± 0,3) : dans le bruit [mesuré].
5. `us006.mjs` B affiche ✗ alors que les valeurs sont bonnes : il compte les erreurs de la console, et la copie n'a pas d'API (`/api/weather`
   → 502). Valeurs : vue d'ensemble `near` 1 614 m, `far` 3 662 m (caméra à 2 844 m du point regardé) ; rue 146 et 1 067 m (259 m).

**Dasco** : juger le rendu (`?weather=fog`, `&intensity=0.4` à `1`, de jour, de nuit, au crépuscule, vue d'ensemble et rue) ; le
brouillard type (0,8) est fort en vue d'ensemble : réglages proposés en section 6.

### 2.6 Documents (commit de clôture)
- DECISIONS : brouillard linéaire calé sur la distance caméra, qui s'efface sans saut ; couleur par l'inverse ACES ; correction des couleurs
  prémultipliées activée avec le brouillard ; halos « par-dessus » pendant le brouillard (et pourquoi pas « alpha inchangé »).
- FEATURES, CHANGELOG (vérifié / non vérifié) ; epic.md (statut).

---

## 3. US005 — Pluie

### 3.1 Commits

| # | Message | Fichiers |
|---|---|---|
| 1 | `feat(scene): crochets « sol mouillé » posés au démarrage, lueurs de nuit réglables, mesures de cadence pour la météo` | `scene/weather-surface.ts` + test (nouveaux), `scene/city.ts`, `scene/terrain.ts`, `scene/daynight.ts`, `scene/quality.ts` + test, `scene/stage.ts`, `weather/sky.ts` + test |
| 2 | `feat(meteo): pluie, deux nappes de traînées et règle de dégradation (fonctions et tests)` | `weather/rain.ts`, `weather/budget.ts` et leurs tests (nouveaux) |
| 3 | `feat(meteo): pluie sur la carte (au-dessus du socle, sol mouillé, lueurs de nuit, dégradation, réduit-mouvement)` | `weather/effects.ts`, `weather/index.ts`, `main.ts` |
| 4 | `docs: itération N (EP009-US005, pluie)` | README (`?debug&rainmax=`), FEATURES, CHANGELOG, DECISIONS (3.6) |

Le commit 1 ne change rien à l'image (tout est inactif) : à vérifier par les mêmes contrôles que « sans météo ».

### 3.2 Ce que fait le code

- **Sol mouillé, posé au démarrage** (`scene/weather-surface.ts`, chunk principal) : comme `fadeMaterial` (`cutaway.ts`), l'`onBeforeCompile`
  existant est enchaîné et la clé du programme étendue (`|wet`) ; un uniforme partagé `uWet` ; GLSL juste après `emissivemap_fragment` :
  plus sombre (−20 %) et satiné (rugosité vers 0,5), surtout sur ce qui regarde le ciel. Posé sur les rues pavées et goudronnées
  (`roadMaterial`), les bâtiments et toits (`windowsMaterial`) et le sol (`terrain.ts`). À 0 : la branche n'est pas prise ; **mêmes
  programmes, mêmes appels** qu'avant [mesuré]. Non posé : tirets des rues, berges, ponts, monuments, arbres (section 6).
- **Mouillé dans le temps** : cible `min(1, 1,6·pluie)`, τ = 20 s pour mouiller, 2 min pour sécher ; lueurs de nuit (halos des bars, lueur
  des rues) × (1 + 0,25·mouillé), par `SkyValues.glow` que le cycle jour/nuit applique (quelques recalculs du ciel, pas un par image).
- **Deux nappes** (`weather/rain.ts`, chunk météo ; un programme pour les deux) :
  - proche : boîte de 280 m centrée sur le point regardé, 130 m de haut, traînées de 3 à 9 m ; lointaine : tout le socle (+ 40 m), 450 m de
    haut, traînées de 10 à 30 m ; poids `proche = 1 − lissé(300, 900, d)`, `lointaine = lissé(250, 800, d)` (somme jamais sous 0,75) ;
  - chute et dérive du vent **cumulées par le processeur** (`uPhase`, `uDrift`) : la vitesse suit le zoom sans que les gouttes sautent (le
    prototype sautait aussi pour cette raison) ; remise à zéro tous les 10⁶ m (≈ 1 h) pour la précision ;
  - densité = intensité × poids × règle de dégradation ; les traînées au-delà de la densité sont écartées dans le vertex shader (fondu sur
    4 %, pas de clignotement) ; bruine et averse : longueur × (0,6 + 0,8·i), opacité × (0,6 + 0,5·i) ;
  - **au-dessus du socle seulement** (D11) : hors des limites, écartée ; et le **mélange par l'alpha de la destination**
    (`blendSrc = DstAlpha`, couleur prémultipliée, alpha inchangé) ne pose la pluie que sur ce qui est déjà dessiné : vue de côté, les gouttes
    au-dessus du bord arrière du socle ne se dessinent plus sur le fond beige (`us005-cote.png`) ;
  - couleur `#dfe8f2` le jour, `#7c88a8` la nuit ; épaisseur constante en pixels (× densité de pixels) ; créée à la première pluie.
- **Règle de dégradation** (`weather/budget.ts`, pure) : `quality.ts` transmet chaque mesure de 2 s en mouvement (`onSample(fps, atMin)`) ;
  deux mesures de suite sous 24 img/s, densité de pixels au minimum, pluie affichée → moitié des gouttes, puis plus rien, jamais de remontée.
- **Réduit-mouvement** : chute et dérive × 0,3 (`prefers-reduced-motion` ou « Effets réduits ») [mesuré : 31,0 → 9,3 m/s].
- **TI-02** : la pluie ne définit pas `moving()` : 30 img/s au repos, pluie animée [mesuré].

### 3.3 Code

#### Commit 1 — `feat(scene): crochets « sol mouillé » posés au démarrage, lueurs de nuit réglables, mesures de cadence pour la météo`

Patch : `/private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/7058533b-187f-4f4d-8d7b-9497ad542537/scratchpad/patches-ep009-us006-us005/us005-1.patch`.

**`frontend/carte/src/scene/city.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -7,6 +7,7 @@ import { buildGround, type Terrain } from './terrain';
 import { pointInRing } from './geo';
 import { DITHER_GLSL, createFade, type FadeUniforms } from './cutaway';
 import { FOOT_KINDS, LIFT, roadDistanceIndex } from './roads';
+import { weatherSurface } from './weather-surface';
 import type { Foliage } from '../time/seasons';
 
 /**
@@ -238,7 +239,7 @@ function roadMaterial(color: string, kind: 'paving' | 'asphalt'): THREE.MeshStan
         diffuseColor.rgb *= 1.0 + (roadHash(floor(ac)) - 0.5) * 0.07 * afade;`}`);
   };
   mat.customProgramCacheKey = () => `road-${kind}`;
-  return mat;
+  return weatherSurface(mat); // rue mouillée sous la pluie (EP009-US005), posé avant la première compilation
 }
 
 /** Tirets blancs au milieu des grandes rues (largeur 8 m et plus), hors des abords des carrefours */
@@ -512,7 +513,7 @@ function windowsMaterial(night: NightUniforms, fade: FadeUniforms): THREE.MeshSt
         }`,
       );
   };
-  return mat;
+  return weatherSurface(mat); // toits et murs mouillés sous la pluie (EP009-US005), posé avant la première compilation
 }
 
 // ---------------------------------------------------------------------------
```

**`frontend/carte/src/scene/daynight.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -65,7 +65,7 @@ export function createDayNight(d: DayNightDeps, initial: { day: LocalDate; hour:
   let day = initial.day, hour = initial.hour, night = 0;
   // Météo (EP009) : modificateur fourni par le module météo (chargé à la demande), appliqué après l'heure ; sans lui, rien ne change
   let weather: ((v: SkyValues, dayF: number) => void) | null = null;
-  const sv: SkyValues = { hemiI: 0, keyI: 0, exposure: 0, sky, key: keyCol, bg };
+  const sv: SkyValues = { hemiI: 0, keyI: 0, exposure: 0, glow: 1, sky, key: keyCol, bg };
   let lastBg = '';
   const lastSun = new THREE.Vector3(NaN, NaN, NaN);
   const listeners: ((h: number, night: number) => void)[] = [];
@@ -88,8 +88,9 @@ export function createDayNight(d: DayNightDeps, initial: { day: LocalDate; hour:
     sv.hemiI = lerp(lerp(NIGHT.hemi, DAY.hemi, dayF), DUSK.hemi, duskMix * dayF);
     sv.keyI = lerp(NIGHT.keyI, DAY.keyI, dayF);
     sv.exposure = lerp(NIGHT.exposure, DAY.exposure, dayF);
-    weather?.(sv, dayF); // météo (EP009) : ciel voilé, lumière grise, fond désaturé
-    const { hemiI, keyI, exposure } = sv;
+    sv.glow = 1;
+    weather?.(sv, dayF); // météo (EP009) : ciel voilé, lumière grise, fond désaturé ; lueurs de nuit plus fortes sous la pluie
+    const { hemiI, keyI, exposure, glow: glowGain } = sv;
 
     // Soleil le jour (repère : x = est, −z = nord, y = haut), lune la nuit (fixe, haute, un peu à l'ouest)
     const { sun, hemi, fill } = d.lights;
@@ -121,13 +122,13 @@ export function createDayNight(d: DayNightDeps, initial: { day: LocalDate; hour:
     for (const m of glowMeshes) {
       const mat = m.material as THREE.MeshStandardMaterial;
       mat.emissive.copy(warm);
-      mat.emissiveIntensity = (m.userData.nightGlow as number) * d.night.uNight.value;
+      mat.emissiveIntensity = (m.userData.nightGlow as number) * d.night.uNight.value * glowGain;
     }
     if (d.placeHalos) {
       const o = d.night.uNight.value;
       d.placeHalos.visible = o > 0.02;
-      if (glowU) glowU.value = 1.4 * o;
-      for (const m of haloPoints) m.opacity = 0.9 * o;
+      if (glowU) glowU.value = 1.4 * o * glowGain;
+      for (const m of haloPoints) m.opacity = Math.min(1, 0.9 * o * glowGain);
     }
 
     // Fond de page (dégradé CSS)
```

**`frontend/carte/src/scene/quality.test.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -1,5 +1,5 @@
-import { describe, expect, it } from 'vitest';
-import { initialQuality } from './quality';
+import { describe, expect, it, vi } from 'vitest';
+import { createAdaptiveResolution, initialQuality } from './quality';
 
 describe('niveau de qualité (EP009-US001) : une seule règle pour toute la carte', () => {
   it('ordinateur → high, même avec peu de mémoire annoncée', () => {
@@ -23,3 +23,16 @@ describe('niveau de qualité (EP009-US001) : une seule règle pour toute la cart
     expect(initialQuality({ coarse: true, width: 390, param: '' })).toBe('medium');
   });
 });
+
+describe('mesures de cadence transmises à la météo (règle de dégradation de la pluie, EP009-US005)', () => {
+  it('toutes les 2 s en mouvement : images/s, et densité de pixels déjà au minimum ou non', () => {
+    vi.stubGlobal('window', { devicePixelRatio: 2 });
+    const q = createAdaptiveResolution({ setPixelRatio: vi.fn() } as never, () => {});
+    const seen: [number, boolean][] = [];
+    q.onSample((fps, atMin) => seen.push([Math.round(fps), atMin]));
+    for (let i = 0; i < 96; i++) q.update(1 / 16, true); // 6 s à 16 img/s : la densité baisse de 1,5 à 1 en deux mesures
+    for (let i = 0; i < 64; i++) q.update(1 / 16, false); // repos : pas de mesure
+    expect(seen).toEqual([[16, false], [16, false], [16, true]]);
+    vi.unstubAllGlobals();
+  });
+});
```

**`frontend/carte/src/scene/quality.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -60,6 +60,7 @@ export function createAdaptiveResolution(renderer: THREE.WebGLRenderer, onChange
   let pr = max;
   renderer.setPixelRatio(pr);
   let acc = 0, frames = 0, good = 0, fps = 60;
+  let onSample: ((fps: number, atMin: boolean) => void) | null = null;
 
   const set = (v: number) => {
     v = Math.round(Math.min(max, Math.max(min, v)) * 4) / 4;
@@ -79,10 +80,13 @@ export function createAdaptiveResolution(renderer: THREE.WebGLRenderer, onChange
       fps = frames / acc;
       acc = 0;
       frames = 0;
+      onSample?.(fps, pr <= min); // densité de pixels déjà au minimum ? (règle 8 d'EP009 : dégradation de la pluie)
       if (fps < 40) { good = 0; set(pr - 0.25); }
       else if (fps > 56) { if (++good >= 3) { good = 0; set(pr + 0.25); } }
       else good = 0;
     },
+    /** Chaque mesure de 2 s en mouvement : images/s, et densité de pixels déjà au minimum (EP009-US005) */
+    onSample(f: (fps: number, atMin: boolean) => void) { onSample = f; },
     get pixelRatio() { return pr; },
     get max() { return max; },
     get fps() { return fps; },
```

**`frontend/carte/src/scene/stage.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -156,5 +156,5 @@ export function createStage(container: HTMLElement, bounds: CityData['bounds'],
     if (camera.position.distanceTo(flight.pos) < 0.5) flight = null;
   };
 
-  return { renderer, scene, camera, controls, clampTarget, flyTo, flyToView, follow, followGap, setLimits, limits, isFlying, zoomTo, heading, resetNorth, updateFlight, size, lights: { sun, hemi, fill } };
+  return { renderer, scene, camera, controls, clampTarget, flyTo, flyToView, follow, followGap, setLimits, limits, isFlying, zoomTo, heading, resetNorth, updateFlight, size, bounds, lights: { sun, hemi, fill } };
 }
```

**`frontend/carte/src/scene/terrain.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -1,6 +1,7 @@
 import * as THREE from 'three';
 import type { CityData, Parking, Poly, Pt } from '../types';
 import { PALETTE } from './palette';
+import { weatherSurface } from './weather-surface';
 
 /**
  * Relief du diorama.
@@ -149,7 +150,7 @@ export function buildGround(data: CityData, terrain: Terrain): THREE.Group {
   geo.setIndex(idx);
   geo.computeVertexNormals();
   const base = paintGround(data);
-  const groundMat = new THREE.MeshStandardMaterial({ map: base, roughness: 1 });
+  const groundMat = weatherSurface(new THREE.MeshStandardMaterial({ map: base, roughness: 1 })); // sol mouillé (EP009-US005)
   const ground = new THREE.Mesh(geo, groundMat);
   ground.receiveShadow = true;
   ground.name = 'terrain';
```

**`frontend/carte/src/scene/weather-surface.test.ts`** (nouveau, complet)

```ts
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { weatherSurface, weatherUniforms } from './weather-surface';

/** Faux shader : le morceau du fragment standard que le crochet modifie */
const shader = () => ({
  uniforms: {} as Record<string, { value: unknown }>,
  vertexShader: '#include <common>\nvoid main() {}',
  fragmentShader: '#include <common>\nvoid main() {\n#include <emissivemap_fragment>\n#include <lights_physical_fragment>\n}',
});

describe('crochet « sol mouillé » posé au démarrage (EP009-US005)', () => {
  it('ajoute l’uniforme partagé et le calcul juste après l’émissif, sans toucher au reste', () => {
    const s = shader();
    const mat = weatherSurface(new THREE.MeshStandardMaterial());
    mat.onBeforeCompile(s as never, {} as never);
    expect(s.uniforms.uWet).toBe(weatherUniforms.uWet);
    expect(s.fragmentShader).toMatch(/uniform float uWet;/);
    expect(s.fragmentShader.indexOf('if (uWet > 0.0)')).toBeGreaterThan(s.fragmentShader.indexOf('#include <emissivemap_fragment>'));
    expect(s.fragmentShader.indexOf('if (uWet > 0.0)')).toBeLessThan(s.fragmentShader.indexOf('#include <lights_physical_fragment>'));
  });
  it('enchaîne l’onBeforeCompile existant et étend la clé du programme', () => {
    const mat = new THREE.MeshStandardMaterial();
    let called = 0;
    mat.onBeforeCompile = (sh) => { called++; sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNight;'); };
    mat.customProgramCacheKey = () => 'road-asphalt';
    weatherSurface(mat);
    const s = shader();
    mat.onBeforeCompile(s as never, {} as never);
    expect(called).toBe(1);
    expect(s.fragmentShader).toMatch(/uniform float uNight;/);
    expect(s.fragmentShader).toMatch(/uniform float uWet;/);
    expect(mat.customProgramCacheKey()).toBe('road-asphalt|wet');
  });
  it('par beau temps, l’uniforme vaut 0 : la branche n’est pas prise', () => {
    expect(weatherUniforms.uWet.value).toBe(0);
  });
});
```

**`frontend/carte/src/scene/weather-surface.ts`** (nouveau, complet)

```ts
import * as THREE from 'three';

/**
 * Crochets de la météo dans les matériaux standards (EP009-US005) : sol mouillé (rues, sol, bâtiments et toits). Posés au
 * démarrage, inactifs (règle 9 : modifier un matériau en cours de route recompile son programme et fige l'image) ; ensuite, le
 * module météo ne règle que l'uniforme. Comme `fadeMaterial` (cutaway.ts) : l'`onBeforeCompile` existant est enchaîné, la clé du
 * programme est étendue une fois pour toutes. Par beau temps (`uWet` à 0), la branche n'est pas prise : image inchangée.
 */
export const weatherUniforms = { uWet: { value: 0 } };

// Mouillé : plus sombre et un peu satiné, surtout sur ce qui regarde vers le ciel (sols, rues, toits) ; pas de vrais reflets
const WET_GLSL = /* glsl */ `
  if (uWet > 0.0) {
    float wetUp = smoothstep(0.35, 0.8, dot(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz)));
    float wet = uWet * mix(0.35, 1.0, wetUp);
    diffuseColor.rgb *= 1.0 - 0.2 * wet;
    roughnessFactor = mix(roughnessFactor, 0.5, wet);
  }`;

/** Ajoute le crochet « sol mouillé » à un matériau standard, avant sa première compilation */
export function weatherSurface<T extends THREE.MeshStandardMaterial>(mat: T): T {
  const previous = mat.onBeforeCompile;
  const base = mat.customProgramCacheKey === THREE.Material.prototype.customProgramCacheKey ? previous.toString() : mat.customProgramCacheKey();
  mat.onBeforeCompile = (shader, renderer) => {
    previous.call(mat, shader, renderer);
    shader.uniforms.uWet = weatherUniforms.uWet;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uWet;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>${WET_GLSL}`);
  };
  mat.customProgramCacheKey = () => `${base}|wet`;
  return mat;
}
```

**`frontend/carte/src/weather/sky.test.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -4,7 +4,7 @@ import { CLEAR_SKY, applyWeatherSky, overcastOf, type SkyValues } from './sky';
 
 /** Valeurs de plein jour de daynight.ts (DAY) : ce que la scène affiche aujourd'hui */
 const day = (): SkyValues => ({
-  hemiI: 1.1, keyI: 2.4, exposure: 1.05,
+  hemiI: 1.1, keyI: 2.4, exposure: 1.05, glow: 1,
   sky: new THREE.Color('#fff4e0'), key: new THREE.Color('#ffe2b8'),
   bg: ['#fdf3e1', '#f0dfc4', '#d9c3a3'].map((c) => new THREE.Color(c)),
 });
```

**`frontend/carte/src/weather/sky.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -24,7 +24,12 @@ export function overcastOf(w: SkyLook): number {
 }
 
 /** Valeurs du cycle jour/nuit que la météo modifie (couleurs modifiées en place) */
-export interface SkyValues { hemiI: number; keyI: number; exposure: number; sky: THREE.Color; key: THREE.Color; bg: THREE.Color[] }
+export interface SkyValues {
+  hemiI: number; keyI: number; exposure: number;
+  /** Gain des lueurs de nuit (halos des bars, lueur des rues) : 1 par défaut, plus fort sous la pluie (US005) */
+  glow: number;
+  sky: THREE.Color; key: THREE.Color; bg: THREE.Color[];
+}
 
 const GREY_SKY = new THREE.Color('#c9ccd2'), GREY_KEY = new THREE.Color('#dfe2e6');
 const grey = new THREE.Color();
```


#### Commit 2 — `feat(meteo): pluie, deux nappes de traînées et règle de dégradation (fonctions et tests)`

Patch : `/private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/7058533b-187f-4f4d-8d7b-9497ad542537/scratchpad/patches-ep009-us006-us005/us005-2.patch`.

**`frontend/carte/src/weather/budget.test.ts`** (nouveau, complet)

```ts
import { describe, expect, it } from 'vitest';
import { FULL_BUDGET, nextBudget, type RainBudget } from './budget';

const run = (samples: [number, boolean][], from: RainBudget = FULL_BUDGET) => samples.reduce((b, [fps, atMin]) => nextBudget(b, fps, atMin), from);

describe('dégradation des précipitations (règle 8)', () => {
  it('deux mesures de suite sous 24 img/s, densité de pixels au minimum : moitié des gouttes, puis plus rien', () => {
    expect(run([[20, true], [20, true]]).level).toBe(0.5);
    expect(run([[20, true], [20, true], [19, true], [19, true]]).level).toBe(0);
  });
  it('une seule mesure lente, ou une mesure normale entre deux : rien', () => {
    expect(run([[20, true]]).level).toBe(1);
    expect(run([[20, true], [30, true], [20, true]]).level).toBe(1);
  });
  it('la densité de pixels peut encore baisser : la pluie n’est pas touchée', () => {
    expect(run([[15, false], [15, false], [15, false]]).level).toBe(1);
  });
  it('l’iPhone à 30 img/s sans météo n’est jamais touché ; jamais de remontée', () => {
    expect(run(Array.from({ length: 20 }, () => [30, true] as [number, boolean])).level).toBe(1);
    const cut = run([[20, true], [20, true], [20, true], [20, true]]);
    expect(run([[60, true], [60, true], [60, false]], cut).level).toBe(0);
  });
});
```

**`frontend/carte/src/weather/budget.ts`** (nouveau, complet)

```ts
/**
 * Règle de dégradation des précipitations (règle 8 de l'epic, EP009-US005), pure et testée. On ne touche aux gouttes que quand la
 * densité de pixels est déjà au minimum (scene/quality.ts n'a plus rien à baisser) et que deux mesures de suite (2 × 2 s, en
 * mouvement, pluie affichée) passent sous 24 images/s : densité divisée par 2, puis coupure. Jamais de remontée dans la visite.
 * La lumière et le brouillard, gratuits, restent. 24 : entre les paliers 30 et 20 d'un écran à 60 Hz, la règle attrape « la pluie a
 * fait tomber le téléphone à 20 », pas l'iPhone déjà à 30-31 img/s sans météo.
 */
export const SLOW_FPS = 24;

export interface RainBudget {
  /** Part des gouttes gardée : 1, puis 0,5, puis 0 */
  level: number;
  /** Mesures lentes de suite */
  slow: number;
}

export const FULL_BUDGET: Readonly<RainBudget> = { level: 1, slow: 0 };

export function nextBudget(b: RainBudget, fps: number, atMin: boolean): RainBudget {
  if (b.level === 0) return b;
  if (!atMin || fps >= SLOW_FPS) return b.slow === 0 ? b : { level: b.level, slow: 0 };
  const slow = b.slow + 1;
  return slow >= 2 ? { level: b.level === 1 ? 0.5 : 0, slow: 0 } : { level: b.level, slow };
}
```

**`frontend/carte/src/weather/rain.test.ts`** (nouveau, complet)

```ts
import { describe, expect, it } from 'vitest';
import { RAIN_COUNT, layerMotion, layerWeights, rainLook } from './rain';

const DISTANCES = Array.from({ length: 400 }, (_, i) => 60 + i * 10); // de 60 m à 4 km

describe('pluie : deux nappes en fondu selon la distance (aucun saut)', () => {
  it('en rue, la nappe proche seule ; en vue d’ensemble, la lointaine seule', () => {
    expect(layerWeights(120)).toEqual({ near: 1, far: 0 });
    expect(layerWeights(2850)).toEqual({ near: 0, far: 1 });
  });
  it('entre les deux, un fondu continu où la pluie ne disparaît jamais', () => {
    for (const d of DISTANCES) {
      const w = layerWeights(d);
      expect(w.near + w.far).toBeGreaterThan(0.75);
      const w2 = layerWeights(d + 1); // continuité : pas de saut d'un mètre à l'autre
      expect(Math.abs(w2.near - w.near)).toBeLessThan(0.01);
      expect(Math.abs(w2.far - w.far)).toBeLessThan(0.01);
    }
  });
  it('chute et longueur continues avec la distance, bornées', () => {
    for (const far of [false, true]) {
      for (const d of DISTANCES) {
        const a = layerMotion(far, d), b = layerMotion(far, d + 1);
        expect(Math.abs(b.fall - a.fall)).toBeLessThan(0.2);
        expect(Math.abs(b.len - a.len)).toBeLessThan(0.05);
      }
    }
    expect(layerMotion(false, 120)).toEqual({ fall: 20, len: 3 });
    expect(layerMotion(true, 2850)).toEqual({ fall: 285, len: 25.65 });
  });
});

describe('bruine et averse visiblement différentes', () => {
  it('traînées plus longues et plus marquées quand l’intensité monte', () => {
    const drizzle = rainLook(0.15), shower = rainLook(0.85);
    expect(shower.len / drizzle.len).toBeGreaterThan(1.5);
    expect(shower.opacity).toBeGreaterThan(drizzle.opacity);
  });
  it('nombre de traînées par niveau de qualité (valeurs par défaut, à confirmer sur iPhone)', () => {
    expect(RAIN_COUNT).toEqual({ low: 1200, medium: 2500, high: 5000 });
  });
});
```

**`frontend/carte/src/weather/rain.ts`** (nouveau, complet)

```ts
import * as THREE from 'three';
import type { QualityLevel } from '../scene/quality';
import type { CityData } from '../types';

/**
 * Pluie (EP009-US005), calculée par le processeur graphique : chaque traînée est un quadrilatère dont la position est calculée dans
 * le vertex shader à partir de l'avancée de la chute (aucune mise à jour des sommets par le processeur, tampon fixe). Deux nappes,
 * un appel de rendu chacune, un seul programme :
 *  - proche : boîte de 280 m autour du point regardé, gouttes courtes (en rue) ;
 *  - lointaine : tout le socle, traînées longues (vue d'ensemble) ;
 * en fondu selon la distance caméra – point regardé. La chute et la dérive du vent sont cumulées par le processeur : la vitesse peut
 * suivre le zoom sans que les gouttes sautent. Au-dessus du socle seulement (D11) : une goutte hors du socle est écartée, et le
 * mélange ne la pose que là où quelque chose est déjà dessiné (alpha de la destination) : vue de côté, rien sur le fond de page.
 */

/** Traînées par niveau de qualité, à intensité 1 : valeurs par défaut tirées des mesures du Mac, à confirmer sur iPhone (US001) */
export const RAIN_COUNT: Record<QualityLevel, number> = { low: 1200, medium: 2500, high: 5000 };

const smooth = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** Poids des deux nappes selon la distance caméra – point regardé (m) : proche en rue, lointaine en vue d'ensemble */
export const layerWeights = (d: number) => ({ near: 1 - smooth(300, 900, d), far: smooth(250, 800, d) });

/** Chute (m/s « de maquette ») et longueur des traînées (m), continues avec la distance : à l'écran, à peu près la même allure à tous les zooms */
export const layerMotion = (far: boolean, d: number) =>
  far ? { fall: clamp(d * 0.1, 100, 330), len: clamp(d * 0.009, 10, 30) } : { fall: clamp(d * 0.12, 20, 90), len: clamp(d * 0.018, 3, 9) };

/** Bruine ou averse : traînées plus longues et plus marquées quand l'intensité monte */
export const rainLook = (intensity: number) => ({ len: 0.6 + 0.8 * intensity, opacity: 0.6 + 0.5 * intensity });

/** Inclinaison des traînées par le vent : pente horizontale par m/s de vent « de maquette » */
const SLANT = 0.13;
/** Remise à zéro de la chute cumulée (précision des flottants dans le shader) : une fois par heure environ */
const WRAP = 1e6;

const VERT = /* glsl */ `
  attribute vec4 aSeed; attribute vec2 aCorner; attribute float aIdx;
  uniform vec3 uCenter, uDir; uniform vec4 uBox, uBounds;
  uniform float uPhase, uLen, uWidth, uOpacity, uDensity;
  uniform vec2 uDrift, uRes;
  varying float vAlpha; varying float vSide; varying float vAlong;
  void main() {
    vAlpha = 0.0; vSide = 0.0; vAlong = 0.0;
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    float keep = 1.0 - smoothstep(uDensity - 0.04, uDensity, aIdx);
    if (keep <= 0.0) return;
    vec3 p = vec3(aSeed.x * 2.0 * uBox.x + uDrift.x, aSeed.z * uBox.z - uPhase * (0.85 + 0.3 * aSeed.w), aSeed.y * 2.0 * uBox.y + uDrift.y);
    p.xz = uCenter.xz + mod(p.xz - uCenter.xz + uBox.xy, 2.0 * uBox.xy) - uBox.xy;
    p.y = uBox.w + mod(p.y, uBox.z);
    float inside = min(min(p.x - uBounds.x, uBounds.y - p.x), min(p.z - uBounds.z, uBounds.w - p.z));
    if (inside < 0.0) return;
    vec4 c0 = projectionMatrix * viewMatrix * vec4(p, 1.0);
    vec4 c1 = projectionMatrix * viewMatrix * vec4(p - uDir * uLen, 1.0);
    if (c0.w < 1.0 || c1.w < 1.0) return;
    vec2 e = abs(p.xz - uCenter.xz) / uBox.xy;
    float fade = keep * (1.0 - smoothstep(0.75, 1.0, max(e.x, e.y))) * (1.0 - smoothstep(0.8, 1.0, (p.y - uBox.w) / uBox.z)) * smoothstep(0.0, 20.0, inside);
    vec4 c = mix(c0, c1, aCorner.x);
    vec2 d = (c1.xy / c1.w - c0.xy / c0.w) * uRes;
    vec2 dir = length(d) > 1e-4 ? normalize(d) : vec2(0.0, 1.0);
    c.xy += vec2(-dir.y, dir.x) * aCorner.y * uWidth / uRes * c.w;
    gl_Position = c;
    vAlpha = uOpacity * fade; vSide = aCorner.y; vAlong = aCorner.x;
  }`;
const FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha; varying float vSide; varying float vAlong;
  void main() {
    float a = vAlpha * (1.0 - vSide * vSide) * mix(1.0, 0.2, vAlong);
    gl_FragColor = vec4(uColor * a, a);
  }`;

const DAY = new THREE.Color('#dfe8f2'), NIGHT = new THREE.Color('#7c88a8');

/** Une nappe : `count` traînées (4 sommets chacune), dans l'ordre d'un tirage au hasard (aIdx) : la densité garde les premières */
function layer(count: number, bounds: CityData['bounds'], material: THREE.ShaderMaterial, width: number) {
  const seeds = new Float32Array(count * 16), corners = new Float32Array(count * 8), idx = new Float32Array(count * 4), index = new Uint32Array(count * 6);
  for (let i = 0; i < count; i++) {
    const s = [Math.random(), Math.random(), Math.random(), Math.random()];
    for (let k = 0; k < 4; k++) {
      seeds.set(s, (i * 4 + k) * 4);
      corners.set([k >> 1, k & 1 ? 1 : -1], (i * 4 + k) * 2);
      idx[i * 4 + k] = (i + 0.5) / count;
    }
    const b = i * 4;
    index.set([b, b + 1, b + 2, b + 2, b + 1, b + 3], i * 6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 12), 3)); // inutilisé (three.js l'exige)
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  geo.setAttribute('aCorner', new THREE.BufferAttribute(corners, 2));
  geo.setAttribute('aIdx', new THREE.BufferAttribute(idx, 1));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  const mat = material.clone(); // même programme pour les deux nappes, uniformes à part
  const u = mat.uniforms;
  u.uBounds.value.set(bounds.minX, bounds.maxX, -bounds.maxY, -bounds.minY);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; // positions calculées dans le shader
  mesh.renderOrder = 6;
  mesh.visible = false;
  const size = new THREE.Vector2();
  mesh.onBeforeRender = (renderer) => {
    u.uRes.value.copy(renderer.getDrawingBufferSize(size));
    u.uWidth.value = width * renderer.getPixelRatio();
  };
  return { mesh, u, phase: 0, drift: new THREE.Vector2() };
}

export function createRain(scene: THREE.Scene, count: number, bounds: CityData['bounds']) {
  const base = new THREE.ShaderMaterial({
    uniforms: {
      uCenter: { value: new THREE.Vector3() }, uDir: { value: new THREE.Vector3(0, -1, 0) },
      uBox: { value: new THREE.Vector4() }, uBounds: { value: new THREE.Vector4() },
      uPhase: { value: 0 }, uLen: { value: 4 }, uWidth: { value: 1.3 }, uOpacity: { value: 0.5 }, uDensity: { value: 0 },
      uDrift: { value: new THREE.Vector2() }, uRes: { value: new THREE.Vector2(1, 1) }, uColor: { value: new THREE.Color() },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide, // l'orientation du quadrilatère dépend du sens du trait à l'écran
    // Couleur prémultipliée posée seulement là où quelque chose est déjà dessiné (alpha de la destination) ; l'alpha ne change pas
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.DstAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  });
  const near = layer(count, bounds, base, 1.5), far = layer(count, bounds, base, 1.2);
  near.mesh.name = 'rain-near';
  far.mesh.name = 'rain-far';
  scene.add(near.mesh, far.mesh);
  const cx = (bounds.minX + bounds.maxX) / 2, cz = -(bounds.minY + bounds.maxY) / 2;
  const hx = (bounds.maxX - bounds.minX) / 2 + 40, hz = (bounds.maxY - bounds.minY) / 2 + 40;
  const color = new THREE.Color(), dir = new THREE.Vector3();

  return {
    /** Appels de rendu de la pluie à cette image (0, 1 ou 2) */
    visible: () => +near.mesh.visible + +far.mesh.visible,
    /**
     * À chaque image où il pleut. intensity : 0..1 (déjà multipliée par la règle de dégradation) ; d : distance caméra – point regardé ;
     * wind : m/s « de maquette » et direction où il va (degrés, 0 = est, 90 = nord) ; slow : 0,3 avec le réduit-mouvement.
     */
    update(dt: number, focus: THREE.Vector3, d: number, intensity: number, rawIntensity: number, wind: { speed: number; towards: number }, night: number, slow: number) {
      const w = layerWeights(d), look = rainLook(rawIntensity);
      const a = (wind.towards * Math.PI) / 180, s = wind.speed * SLANT;
      dir.set(Math.cos(a) * s, -1, -Math.sin(a) * s).normalize();
      color.copy(DAY).lerp(NIGHT, night);
      for (const [l, isFar, weight] of [[near, false, w.near], [far, true, w.far]] as const) {
        const density = intensity * weight;
        l.mesh.visible = density > 0.002;
        if (!l.mesh.visible) continue;
        const m = layerMotion(isFar, d), u = l.u;
        l.phase = (l.phase + m.fall * dt * slow) % WRAP;
        l.drift.x = (l.drift.x + Math.cos(a) * s * m.fall * dt * slow) % WRAP;
        l.drift.y = (l.drift.y - Math.sin(a) * s * m.fall * dt * slow) % WRAP;
        u.uPhase.value = l.phase;
        u.uDrift.value.copy(l.drift);
        u.uDir.value.copy(dir);
        u.uLen.value = m.len * look.len;
        u.uOpacity.value = (isFar ? 0.42 : 0.55) * look.opacity;
        u.uDensity.value = density;
        u.uColor.value.copy(color);
        if (isFar) {
          u.uCenter.value.set(cx, focus.y, cz);
          u.uBox.value.set(hx, hz, 450, focus.y - 80);
        } else {
          u.uCenter.value.copy(focus);
          u.uBox.value.set(140, 140, 130, focus.y - 30);
        }
      }
    },
    hide() { near.mesh.visible = far.mesh.visible = false; },
  };
}
export type Rain = ReturnType<typeof createRain>;
```


#### Commit 3 — `feat(meteo): pluie sur la carte (au-dessus du socle, sol mouillé, lueurs de nuit, dégradation, réduit-mouvement)`

Patch : `/private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/7058533b-187f-4f4d-8d7b-9497ad542537/scratchpad/patches-ep009-us006-us005/us005-3.patch`.

**`frontend/carte/src/main.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -597,6 +597,7 @@ async function main() {
       try {
         const w = m.startWeather({
           root: app, scene, camera, focus: () => controls.target, quality: qualityLevel(), wind, size: stage.size, post: tiltShift.setWeather,
+          bounds: stage.bounds, onFpsSample: (f) => quality.onSample(f),
           sky: (m) => dayNight.setWeather(m), night: () => dayNight.getNight(), clock: () => clock.state(),
           backToLive: () => { clock.setSeason('auto'); clock.live(); }, chip: ui.setWeatherChip,
           // Crédit de la source (règle 11) : en bas à droite et dans les crédits de l'accueil, seulement avec ses données
```

**`frontend/carte/src/weather/effects.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -1,32 +1,49 @@
 import * as THREE from 'three';
+import type { QualityLevel } from '../scene/quality';
+import type { CityData } from '../types';
+import { weatherUniforms } from '../scene/weather-surface';
 import { fogColorFor, fogRange } from './fog';
-import type { WeatherLook } from './state';
+import { FULL_BUDGET, nextBudget, type RainBudget } from './budget';
+import { RAIN_COUNT, createRain, type Rain } from './rain';
+import { approach, type WeatherLook } from './state';
 
 /**
  * Effets de la météo sur la scène (EP009), dans le module chargé à la demande. Tout ce qui touche aux matériaux standards a été
- * posé au démarrage (règle 9) : ici on ne règle que des valeurs (brouillard, uniformes de la passe finale, mélange des halos),
- * sans aucune recompilation. Par temps sans effet : aucun travail par image.
+ * posé au démarrage (règle 9) : ici on ne règle que des valeurs (brouillard, uniformes de la passe finale et du sol mouillé, mélange
+ * des halos), sans aucune recompilation ; seuls les deux maillages de la pluie (un programme) arrivent avec la première pluie.
+ * Par temps sans effet : aucun travail par image.
  *  - Brouillard (US006) : `THREE.Fog` linéaire, réglé à chaque image selon la distance caméra – point regardé ; sa couleur est celle
  *    du fond de page au bord du socle, passée dans l'inverse du rendu des tons ; voile léger ; correction des couleurs prémultipliées
  *    de la passe finale (sinon liseré clair autour du socle).
+ *  - Pluie (US005) : deux nappes de traînées (weather/rain.ts), sol mouillé, lueurs de nuit un peu plus fortes, règle de dégradation.
  */
 export interface EffectsCtx {
   scene: THREE.Scene;
   camera: THREE.Camera;
   /** Point regardé */
   focus(): THREE.Vector3;
-  /** Taille du socle (m) */
+  /** Taille du socle (m) et ses limites (données) */
   size: number;
+  bounds: CityData['bounds'];
+  quality: QualityLevel;
+  /** 0 = jour, 1 = nuit */
+  night(): number;
   /** Passe finale : correction des couleurs prémultipliées, voile (couleur d'écran), éclair (tiltShift.setWeather) */
   post(w: { unpremult?: number; veil?: number; veilColor?: readonly [number, number, number]; flash?: number }): void;
+  /** Mesures de cadence de la résolution adaptative (scene/quality.ts), pour la règle de dégradation de la pluie */
+  onFpsSample(f: (fps: number, atMin: boolean) => void): void;
 }
 
 /** Voile de la passe finale à pleine intensité de brouillard (baisse de contraste, couleur du fond) */
 export const FOG_VEIL = 0.15;
 /** Brouillard à partir duquel la correction des couleurs prémultipliées est complète */
 export const UNPREMULT_FULL = 0.15;
+/** Sol mouillé : cible selon la pluie, temps pour mouiller (s) et pour sécher */
+export const WET = { perRain: 1.6, tauUp: 20, tauDown: 120 };
+/** Lueurs de nuit (halos des bars, lueur des rues) en plus quand tout est mouillé */
+export const WET_GLOW = 0.25;
 
-export function createEffects(ctx: EffectsCtx) {
+export function createEffects(ctx: EffectsCtx, reduced: () => boolean) {
   const fog = ctx.scene.fog as THREE.Fog | null; // posé inactif au démarrage (stage.ts)
   /** Fond de page au bord du socle (sRGB 0..1) et exposition, relus à chaque recalcul du ciel (après la météo) */
   const edge: [number, number, number] = [1, 1, 1];
@@ -48,6 +65,14 @@ export function createEffects(ctx: EffectsCtx) {
     }
   };
 
+  // Pluie : créée à la première pluie ; nombre de traînées selon le niveau de qualité (`?debug&rainmax=N` pour essayer)
+  let rain: Rain | null = null;
+  const q = new URLSearchParams(location.search), max = Number(q.get('rainmax'));
+  const count = q.has('debug') && max > 0 ? Math.min(50000, Math.round(max)) : RAIN_COUNT[ctx.quality];
+  let budget: RainBudget = { ...FULL_BUDGET };
+  ctx.onFpsSample((fps, atMin) => { if (rain?.visible()) budget = nextBudget(budget, fps, atMin); });
+  let wet = 0, glow = 1;
+
   return {
     /** Appelé par le modificateur du ciel (daynight.ts), une fois la météo appliquée : fond de page et exposition finals */
     readSky(bg: THREE.Color[], exp: number) {
@@ -55,21 +80,44 @@ export function createEffects(ctx: EffectsCtx) {
       edge[0] = rgb.r; edge[1] = rgb.g; edge[2] = rgb.b;
       exposure = exp;
     },
-    /** À chaque image : rien sans brouillard (une dernière fois quand il s'en va, pour le remettre au repos) */
-    update(look: WeatherLook) {
+    /** Gain des lueurs de nuit, lu par le modificateur du ciel */
+    glow: () => glow,
+    /** Part des gouttes gardée par la règle de dégradation (1, 0,5 ou 0) */
+    budget: () => budget.level,
+    /** À chaque image ; renvoie vrai si le ciel doit être recalculé (lueurs de nuit) */
+    update(look: WeatherLook, dt: number): boolean {
+      // Brouillard : suit la caméra ; une dernière fois quand il s'en va, pour le remettre au repos
       const k = look.fog;
-      if (!fog || (k <= 0 && !fogOn)) return;
-      fogOn = k > 0;
-      const r = fogRange(k, ctx.camera.position.distanceTo(ctx.focus()), ctx.size);
-      fog.near = r.near;
-      fog.far = r.far;
-      if (fogOn) {
-        const [cr, cg, cb] = fogColorFor(edge, exposure);
-        fog.color.setRGB(cr, cg, cb, THREE.LinearSRGBColorSpace);
+      if (fog && (k > 0 || fogOn)) {
+        fogOn = k > 0;
+        const range = fogRange(k, ctx.camera.position.distanceTo(ctx.focus()), ctx.size);
+        fog.near = range.near;
+        fog.far = range.far;
+        if (fogOn) {
+          const [cr, cg, cb] = fogColorFor(edge, exposure);
+          fog.color.setRGB(cr, cg, cb, THREE.LinearSRGBColorSpace);
+        }
+        const u = Math.min(1, k / UNPREMULT_FULL);
+        ctx.post({ unpremult: u, veil: FOG_VEIL * k, veilColor: edge });
+        if (u > 0 !== cover) { cover = u > 0; halos(cover); }
       }
-      const u = Math.min(1, k / UNPREMULT_FULL);
-      ctx.post({ unpremult: u, veil: FOG_VEIL * k, veilColor: edge });
-      if (u > 0 !== cover) { cover = u > 0; halos(cover); }
+      // Pluie : deux nappes autour du point regardé et sur tout le socle (ralenties avec le réduit-mouvement)
+      const r = look.rain * budget.level;
+      if (r > 0.002) {
+        rain ??= createRain(ctx.scene, count, ctx.bounds);
+        const f = ctx.focus();
+        rain.update(dt, f, ctx.camera.position.distanceTo(f), r, look.rain, { speed: look.windSpeed, towards: look.windTowards }, ctx.night(), reduced() ? 0.3 : 1);
+      } else if (rain?.visible()) rain.hide();
+      // Sol mouillé : vite à l'humidification, lentement au séchage ; lueurs de nuit un peu plus fortes
+      const target = Math.min(1, look.rain * WET.perRain);
+      if (wet === target) return false;
+      wet = approach(wet, target, dt, target > wet ? WET.tauUp : WET.tauDown);
+      if (Math.abs(wet - target) < 1e-3) wet = target;
+      weatherUniforms.uWet.value = wet;
+      const g = 1 + WET_GLOW * wet;
+      if (Math.abs(g - glow) < 0.01 && wet !== target) return false;
+      glow = g;
+      return true;
     },
   };
 }
```

**`frontend/carte/src/weather/index.ts`** (modifié ; numéros de ligne avant / après dans chaque `@@`)

```diff
@@ -25,13 +25,10 @@ export interface WeatherCtx extends EffectsCtx {
   camera: THREE.Camera;
   /** Point regardé (brouillard, précipitations) */
   focus(): THREE.Vector3;
-  quality: QualityLevel;
   /** Vent de beau temps (content/life.json) : objet partagé par la fumée et les drapeaux (US009 le fera varier) */
   wind: { towards: number; speed: number };
   /** Pose le modificateur du ciel dans le cycle jour/nuit et le recalcule (dayNight.setWeather) */
   sky(modifier: (v: SkyValues, dayF: number) => void): void;
-  /** 0 = jour, 1 = nuit */
-  night(): number;
   clock(): ClockState;
   /** « Revenir au direct » : heure réelle et saison automatique */
   backToLive(): void;
@@ -77,10 +74,11 @@ const sameLook = (a: WeatherLook, b: WeatherLook) =>
 
 export function startWeather(ctx: WeatherCtx): WeatherModule {
   const clear = clearLook(ctx.wind);
-  const effects = createEffects(ctx);
+  const effects = createEffects(ctx, () => mq.matches || pref.reduced);
   /** Le ciel suit la météo lissée `cur` (lue à chaque recalcul du cycle jour/nuit) ; les effets lisent le fond qui en résulte */
   const skyModifier = (v: SkyValues, dayF: number) => {
     applyWeatherSky(v, cur, dayF);
+    v.glow = effects.glow();
     effects.readSky(v.bg, v.exposure);
   };
   const pref = loadWeatherPref();
@@ -171,13 +169,15 @@ export function startWeather(ctx: WeatherCtx): WeatherModule {
 
   return {
     update(dt) {
+      let sky = false;
       if (blending) {
         const { cloud, rain, snow, fog, storm } = cur;
         blending = blendLook(cur, target, dt);
         // Le ciel ne lit que les nuages et les précipitations : le fondu du vent (plus long) ne recalcule pas l'ambiance
-        if (cur.cloud !== cloud || cur.rain !== rain || cur.snow !== snow || cur.fog !== fog || cur.storm !== storm) ctx.sky(skyModifier);
+        sky = cur.cloud !== cloud || cur.rain !== rain || cur.snow !== snow || cur.fog !== fog || cur.storm !== storm;
       }
-      effects.update(cur); // brouillard : suit la caméra ; sans effet, rien
+      // Brouillard (suit la caméra), pluie (et son vent), sol mouillé ; vrai si les lueurs de nuit changent ; sans effet, rien
+      if (effects.update(cur, dt) || sky) ctx.sky(skyModifier);
     },
     onClock(c) {
       const live = isLive(c);
```


### 3.4 Tests (Vitest, projet `carte`)

`scene/weather-surface.test.ts` (3 : uniforme et position du GLSL, enchaînement et clé, 0 par défaut), `weather/rain.test.ts` (5 : nappes
en rue et en vue d'ensemble, fondu continu sans trou, chute et longueur continues, bruine / averse, nombres par niveau), `weather/budget.test.ts`
(4 : moitié puis coupure, une mesure lente ne suffit pas, densité de pixels pas au minimum, iPhone à 30 img/s jamais touché et jamais de
remontée), `scene/quality.test.ts` (+1 : mesures transmises avec « au minimum »). Résultat attendu : **10 fichiers, 76 tests** [vérifié].

### 3.5 Vérifications

**Agent, navigateur, puce graphique du Mac** (`us005.mjs`, `us005-shots.mjs`, `us005-wet.mjs`, `us005-degrade.mjs` ; 4201 / 4202) :
1. Sans météo, 12 h et 22 h : identique à `1da4136` (lumières, fond, appels, programmes) [vérifié].
2. `?weather=rain&intensity=0.8` : captures à 2 850, 1 200, 700, 400, 220 et 110 m (`us005-d*.png`) ; appels +1 (vue d'ensemble : nappe
   lointaine ; rue : nappe proche), +2 entre 400 et 700 m [mesuré] (nappe lointaine seule à 2 850 et 1 200 m, les deux à 700 et 400 m,
   proche seule à 220 et 110 m) ; vue de côté (`us005-cote.png`) : rien sur le fond.
3. Sol mouillé de jour et lueurs de nuit : même vue en « couvert » puis en pluie après 60 s (`us005-mouille-jour-*.png`,
   `us005-mouille-nuit-*.png`) : rues et toits plus sombres, halos et rues un peu plus lumineux la nuit [vérifié à l'œil].
4. Arrivée de la pluie (5 000, 2 500, 1 200 traînées par nappe) : pire intervalle 19, 18 et 18 ms, **1 programme** de plus,
   appels 2 407 → 2 408 [mesuré] (sur `48ffd36` : 28, 20 et 23 ms).
5. Au repos sous la pluie : 30,0 img/s ; chute 31,0 m/s, et 9,3 m/s en réduit-mouvement [mesuré].
6. Coût (pluie 1 contre couvert en alternance, même page, 4 tours) : **dans le bruit** [mesuré] (img/s couvert → pluie ; GPU et processeur en ms ; ± écart type sous la pluie ;
   `mesures/run3/us005-cout.txt`) :
   - `high` (5 000), vue d'ensemble, en mouvement : 60,00 → 60,03 img/s, GPU 8,1 → 8,2 (± 0,2), processeur 7,6 → 7,5 (± 0,1) ; au repos : 30 → 30 ;
   - `high`, rue, en mouvement : 60 → 60, GPU 5,7 → 5,7 (± 0,1), processeur 3,5 → 3,5 (± 0,2) ; au repos : 30 → 30, GPU 6,1 → 6,3 (± 0,1) ;
   - `medium` (2 500), vue d'ensemble, en mouvement : 60 → 60, GPU 8,1 → 8,3 (± 0,1), processeur 7,4 → 7,3 (± 0,1) ; au repos : 30 → 30 ;
   - `medium`, rue, en mouvement : 60 → 60, GPU 5,8 → 5,7, processeur 3,4 → 3,4 ; au repos : 29,96 → 30.

   Appels : +1 en vue d'ensemble (2 407 → 2 408) ; en rue, un seul relevé par réglage, qui varie de quelques appels d'un instant à l'autre
   (au repos 90 → 91 en `medium`, 94 → 94 en `high` ; en mouvement 90 → 123, la caméra n'a pas la même orientation) : le +1 de la nappe
   proche est établi par le point 2. Le Mac est plafonné à 60 img/s : ces chiffres disent que la pluie ne coûte rien de visible **ici**,
   pas ce qu'elle coûte sur un iPhone. (Sur `48ffd36`, même conclusion : `mesures-48ffd36/us005-cout.txt`.)
7. Règle de dégradation de bout en bout : `?weather=rain&intensity=1`, vue d'ensemble en mouvement, processeur ralenti 12 fois par le protocole de débogage de Chrome (10 à 12 img/s ;
   densité de pixels 1, déjà le minimum) : densité de la nappe lointaine 0,95 → **0,50 au bout de 8 s** → **pluie masquée à 12 s** ;
   processeur rétabli (60 img/s) : la pluie reste coupée, pas de remontée [vérifié, `mesures/run3/us005-degrade.txt`, et de même sur
   `48ffd36`]. La condition « densité de pixels au minimum » n'est vérifiée que par les tests (`budget.test.ts`, `quality.test.ts`).

**Dasco** : rendu de la pluie (`?weather=rain`, `&intensity=0.15` et `0.85`, de jour et de nuit, en rue et en vue d'ensemble) ; **la mesure
iPhone d'US001**, puis `?weather=rain&intensity=1` et `?debug&rainmax=N` pour choisir les nombres par niveau (budget dans DECISIONS).

### 3.6 Documents (commit de clôture)
- README : `?debug&rainmax=N` (nombre de traînées par nappe, pour essayer) ; structure du code (`scene/weather-surface.ts`, `weather/rain.ts`,
  `weather/budget.ts`, `weather/effects.ts`, `weather/fog.ts`).
- DECISIONS : pluie en deux nappes cumulées, au-dessus du socle par l'alpha de la destination ; crochets du sol mouillé (4 matériaux) ;
  règle de dégradation ; nombres par niveau (par défaut, en attendant la mesure iPhone).
- FEATURES, CHANGELOG ; epic.md (statut).

---

## 4. Poids [mesuré, gzip, Node zlib niveau 6]

| Chunk | `a9424e9` | `1da4136` (base) | US006 | US005 |
|---|---|---|---|---|
| Principal | 84 231 o | 86 311 o (+2 080) | 86 280 o (−31) | 86 546 o (+266 ; +235 depuis `1da4136`, **+2 315 depuis `a9424e9`**) |
| Module météo (`weather-*.js`) | — | 5 680 o | 6 662 o | 8 972 o |
| Contrat (`meteo-*.js`) | — | 709 o | 709 o | 708 o |

Ce qui coûte au chunk principal pour US005 : le crochet du sol mouillé (GLSL et enchaînement), le gain des lueurs dans `daynight.ts`, la mesure
transmise par `quality.ts`, `stage.bounds`, deux lignes de `main.ts`. US006 n'ajoute rien de mesurable (deux entrées du contexte du module).

---

## 5. Appliquer le plan

Patchs : `/private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/7058533b-187f-4f4d-8d7b-9497ad542537/scratchpad/patches-ep009-us006-us005/` (`us006-1.patch` … `us005-3.patch`, produits par `commits3.py` à partir des instantanés
`snap3-us006/` et `snap3-us005/`). Depuis la racine du dépôt, sur la bonne branche :

```bash
git apply --check /private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/7058533b-187f-4f4d-8d7b-9497ad542537/scratchpad/patches-ep009-us006-us005/us006-1.patch && git apply /private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/7058533b-187f-4f4d-8d7b-9497ad542537/scratchpad/patches-ep009-us006-us005/us006-1.patch
npm run build && npm test   # puis git commit avec le message de la section 2.1 ou 3.1
```

Vérifié : les 5 patchs s'appliquent dans l'ordre (`git apply --check` puis `git apply`) sur une archive neuve de `1da4136` ; après chacun, `tsc` carte, contrat et back, `check-boundaries` (avec la nouvelle règle `z…()`), Vitest (carte, contrat, outillage : 93, 93, 97, 106,
106 tests ; dont carte 63, 63, 67, 76, 76) et le build de la carte passent ; chunk principal après chaque commit : 86 311, 86 280, 86 526,
86 526, 86 546 o (`verif-commits3.txt`) ; sur l'état final, `npm run build` et `npm test` complets passent (21 fichiers, 187 tests) ; l'état final est
exactement l'instantané US005. Le code de ce document **est** celui des patchs (le document est produit à partir d'eux).

---

## 6. Points de la spec à corriger ou à préciser

**Poids**
1. **Budget du chunk principal** (règle 12) : +2,32 Ko après US005 sur +2,5 Ko. Restent 0,19 Ko pour US007 (neige au sol : le crochet de
   `weather-surface.ts` à étendre et à poser sur les arbres, auvents, cheminées, toits des monuments), US008 (lumières de la ville sous
   l'orage), US009 (`uSway` posé au démarrage dans les arbres) [estimé : 0,5 à 0,8 Ko en tout]. Le plafond sera dépassé : question 1
   (section 7). Réserve possible : retirer la pluie de mesure d'US001 (`dev/rain-proto.ts` et sa glue) une fois la mesure iPhone faite,
   **−0,14 Ko** [mesuré] ; une date plus légère dans le contrat, −0,43 Ko (à voir avec l'agent du back).
   Le module météo, chargé à la demande, est déjà à 9,0 Ko (estimation de la règle 12 : 8 à 10 Ko une fois complet) : la neige, l'orage et
   le vent le porteront sans doute à 11 ou 12 Ko [estimé] ; sans effet sur le premier affichage, à corriger dans la règle.

**US006, brouillard**
2. CA 1 « le devant de la ville reste lisible » : au brouillard type (0,8, soit ≈ 400 m de visibilité pour le back), le devant du socle
   est à 22 % de brouillard plus le voile (12 %) : lisible mais pâle ; le fond est noyé. Constantes nommées (`fogRange`, `FOG_VEIL`) à
   régler avec Dasco (question 3).
3. CA 3 « les halos des bars percent le brouillard » : oui sur le socle ; **au-dessus du fond de page** (bars au bord du socle), ils sont
   plus pâles pendant le brouillard (mélange « par-dessus »). À écrire dans le CA (question 2).
4. CA 5 « activé puis coupé dix fois, aucun programme nouveau » : à heure fixe ; le passage du jour à la nuit compile ses propres programmes
   (halos, lueurs), avec ou sans météo, et quatre programmes d'ombres se compilent environ 1 min après le démarrage (relecture de la carte).
5. R3 « couleur du bord du fond CSS » : le fond est un dégradé radial ; le brouillard prend la couleur à 55 % (`bg[1]`) ; vers le haut et le
   centre de l'écran le fond est un peu plus clair (`bg[0]`) : écart faible, non visible sur les captures.
6. Le brouillard ne voile pas la pluie (matériau à part) : par brouillard et pluie à la fois, les traînées lointaines restent nettes. À
   régler en US011 si besoin (opacité de la pluie × (1 − 0,6·brouillard), une ligne).

**US005, pluie**
7. R4 (D11, « gouttes hors du socle écartées ») : complété par le mélange par l'alpha de la destination, qui règle aussi la vue de côté
   (remarque de Dasco sur la capture de la pluie de mesure). À écrire dans R4.
8. CA 1 « ≤ 2 appels de rendu » : 1 en vue d'ensemble et en rue, 2 entre 400 et 700 m environ.
9. CA 3 « aucun saut des gouttes au zoom » : garanti par construction (chute cumulée, boîtes fixes, poids continus) et par les tests de
   continuité ; vérifié sur des captures à 6 distances, **pas sur un enregistrement vidéo**.
10. CA 1 « rues, toits et sol mouillés » : posé sur 4 matériaux (rues pavées et goudronnées, bâtiments et toits, sol). Tirets des rues,
    berges, ponts, monuments et arbres restent secs (chaque matériau de plus = un crochet au démarrage, du poids dans le chunk principal).
11. Nombre de traînées : `RAIN_COUNT` est **par nappe** ; la pluie visible vaut ≈ nombre × intensité (les deux nappes se relaient). Valeurs par
    défaut 1 200 / 2 500 / 5 000 en attendant la mesure iPhone (CA 7) ; `?debug&rainmax=N` pour essayer.
12. CA 8 (règle de dégradation) : sur un iPhone, la densité de pixels part de 1,5 et ne descend qu'à 1 ; la règle ne joue qu'à 1.
13. Estimations : US006 1,5 j tient (le code est écrit ; réglage avec Dasco) ; US005 2,5 à 3 j → 2 j environ, réglage compris.
14. La pluie de mesure d'US001 (`?debug&rain=N`) fait double emploi avec `?debug&rainmax=N` : à retirer après la mesure de Dasco (point 1).

---

## 7. Vraies questions pour Dasco

1. **Poids du chunk principal** : avec US006 et US005, le fichier principal de la carte a pris 2,32 Ko (compressé) depuis le début de l'epic,
   pour un plafond de 2,5 Ko ; la neige, l'orage et le vent ont encore besoin d'environ 0,5 à 0,8 Ko de réglages posés au démarrage (sinon
   l'image se fige quand ils arrivent). Pour comparaison, la carte télécharge au premier chargement environ 257 Ko de code compressé (three.js 170 Ko,
   le fichier principal 86,5 Ko), plus les données de la ville : +3,5 Ko en font 1,4 %. **Relève-t-on le plafond de l'epic à +3,5 Ko, ou préfères-tu qu'on récupère d'abord de la place (retirer la pluie
   de mesure après ta mesure iPhone : 0,14 Ko ; une date plus légère dans le contrat : 0,43 Ko) ?** Recommandé : relever à +3,5 Ko **et**
   retirer la pluie de mesure après ta mesure.
2. **Halos des bars dans le brouillard, la nuit** : pour qu'il n'y ait pas de liseré clair autour du socle dans le brouillard, la passe finale
   corrige ses couleurs ; les halos des bars posés au bord du socle, au-dessus du fond, en deviennent plus pâles (capture
   `us006-halo-dessus.png` contre `us006-halo-sans-brouillard.png`). **Est-ce que ça te va ?** Recommandé : oui (le brouillard pâlit aussi
   les lumières en vrai) ; l'autre réglage essayé coupe les épingles.
3. **Épaisseur du brouillard type** : `?weather=fog` (intensité 0,8, comme le forçage « brouillard » de l'administration) noie toute la vue
   d'ensemble sauf le devant, pâle (`us006-jour-ensemble.png`) ; à 0,6 (`us006-bord-jour.png`), la ville reste lisible au milieu.
   **Le garde-t-on aussi épais, ou l'allège-t-on (moins de voile, début du brouillard plus loin) ?** Recommandé : regarder les deux captures
   puis `?weather=fog&intensity=0.6` et `0.8` sur la carte.

---

## 8. Vérifié / non vérifié

**Vérifié** (dans une copie, archive de `1da4136`, jamais dans le dépôt) :
- Les 5 patchs s'appliquent dans l'ordre (`git apply`, archive neuve de `1da4136`) ; après chacun : `tsc` carte, contrat et back, `check-boundaries`, Vitest (carte, contrat,
  outillage), build de la carte passent ; à la fin, `npm run build` et `npm test` complets passent (21 fichiers, **187 tests**).
- Tous les scripts du navigateur relancés sur `1da4136` (`mesures/run3/`) ; le JavaScript servi est identique octet pour octet à celui des
  patchs.
- Sans météo (12 h et 22 h), état final : lumières, fond, appels de rendu et nombre de programmes identiques à `1da4136` (US006 seule :
  vérifiée de même sur la première base, `48ffd36`).
- Brouillard : couleur au bord du socle de jour, de nuit et au crépuscule, pas de liseré clair (captures) ; activé puis coupé 15 fois à heure
  fixe sans programme nouveau ; halos « par-dessus » contre « alpha inchangé » (captures) ; repères nets, interface lisible.
- Pluie : rien sur le fond de page vue de côté (`us005-cote.png`) ; nappes et appels de rendu à 6 distances ; 1 programme à l'arrivée ;
  30 img/s au repos (TI-02) ; réduit-mouvement (chute × 0,3) ; sol mouillé et lueurs de nuit à l'œil sur captures ; règle de dégradation
  de bout en bout en ralentissant le processeur (moitié des gouttes, puis plus rien, pas de remontée) ; la condition « densité de pixels au minimum » par les tests seulement (le navigateur de mesure est à densité 1, déjà le minimum).

**Mesuré, sur le Mac seulement** (Apple M1, puce graphique par Metal, sans fenêtre) : pires images au changement de temps, coût par image du
brouillard et de la pluie (dans le bruit à 60 img/s), poids gzip des chunks.

**Non vérifié** :
- **Aucun téléphone** : ni la cadence sous la pluie sur iPhone, ni le choix des nombres de traînées par niveau (`RAIN_COUNT` reste une
  proposition), ni la règle de dégradation sur un vrai appareil lent (seulement en ralentissant le processeur sur le Mac).
- Safari et WebKit : le mélange par l'alpha de la destination (pluie) et la correction prémultipliée reposent sur la cible de rendu RGBA
  demi-flottante déjà utilisée par la passe finale ; non essayé ailleurs que dans Chrome.
- Aucun enregistrement vidéo : l'absence de saut des gouttes au zoom est garantie par construction et par les tests, vue sur des captures fixes.
- Le rendu « au goût de Dasco » : épaisseur du brouillard type, pâleur des halos au bord du socle, couleur et densité de la pluie, force du sol
  mouillé (questions 2 et 3, points 2 et 10).
- Brouillard et pluie ensemble (US011 les combinera) : la pluie n'est pas voilée par le brouillard (point 6).
- Le vrai temps de la route `/api/weather` : les copies servaient la carte sans API (502 → ciel par défaut) ; les temps venaient de
  `?weather=` et de `window.diorama.weather.set()`.

---

## 9. Scripts et fichiers de la session

Dossier : `/private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/7058533b-187f-4f4d-8d7b-9497ad542537/scratchpad/` ; scripts dans `mesures/` (Playwright du cache npx, Chrome for Testing 145 de `ms-playwright/chromium-1208`, Metal,
densité de pixels 1, 1280 × 800). Lancer **toujours** avec `BASE=http://localhost:4201 REF=http://localhost:4202` (sans `BASE`, `lib.mjs`
vise 4181) (builds servis par `npx vite preview frontend/carte --port 4201 --strictPort` dans
`plan3/` et dans `base-1da4136/`, proxy de Vite pointé vers 8807 dans ces copies seulement).

| Fichier | Rôle |
|---|---|
| `mesures/us006.mjs` (`ONLY=A…G`), `us006-c.mjs`, `us006-cout.mjs` | Brouillard : identique sans météo, captures jour / nuit / crépuscule, activé-coupé, halos, bord du socle, interface, coût |
| `mesures/us005.mjs` (`ONLY=A…E`), `us005-shots.mjs`, `us005-wet.mjs`, `us005-degrade.mjs` | Pluie : identique sans météo, arrivée, TI-02 et réduit-mouvement, coût, dégradation, captures |
| `mesures/captures/us006-*.png`, `us005-*.png` | Captures citées ci-dessus |
| `patches-ep009-us006-us005/`, `commits3.py`, `snap3-us006/`, `snap3-us005/`, `applytest3/`, `verif-commits3.sh` (`.txt`) | Patchs sur `1da4136`, script qui les produit, instantanés, dépôt de travail, contrôles par commit |
| `plan3/` (état final, construit), `base-1da4136/` (référence) | Copies servies sur 4201 et 4202 |
| `mesures/run3.sh`, `mesures/run3/*.txt` | Revérification complète dans le navigateur sur `1da4136` (sorties de tous les scripts) |
| `patches-ep009-us006-us005-sur-48ffd36/`, `mesures-48ffd36/`, `applytest2/`, `plan2/` | Première version, sur `48ffd36` (pour mémoire) |
