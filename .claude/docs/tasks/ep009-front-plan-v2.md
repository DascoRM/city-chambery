# Plan front v2 : la météo gérée par le back, affichée en 3D sur la carte (EP009)

Rédigé le 09/10/2026 par un agent chercheur / planificateur front 3D. **Aucun fichier du dépôt modifié**, sauf ce plan.
Demande de Dasco : « La météo, je veux que ça soit géré par le back et affiché sur le front. » Ce plan remplace, pour la
carte, [meteo-front-plan.md](meteo-front-plan.md) (08/10, écrit avant EP010). Il s'appuie sur le plan back v2 écrit en
parallèle : [ep009-back-plan-v2.md](ep009-back-plan-v2.md) (contrat `contrat/meteo.ts`, route `/api/weather`, écran admin US012).

Légende : **[mesuré]** = mesuré le 09/10/2026 sur le Mac (Apple M1, macOS 27.0.1, Chrome for Testing 145 sans fenêtre,
ANGLE Metal, puce graphique réelle), **jamais sur un téléphone** ; **[prototype]** = codé et essayé dans une copie
temporaire du dépôt ; **[code]** = lu dans le code ; **[estimé]** = non mesuré.

Prototype et scripts de mesure (dossier temporaire de la session, réutilisable par l'agent principal pendant la session) :
`/private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/7058533b-187f-4f4d-8d7b-9497ad542537/scratchpad/ep009-front/`
(section 11).

---

## 0. En bref

- **La pluie GPU coûte peu [mesuré]** : 3 000 traînées en **1 appel de rendu** (+6 000 triangles) = **+0,1 à +0,45 ms de GPU**
  par image sur le M1, **aucune** baisse de cadence (30 img/s au repos, 60 en mouvement, comme sans pluie). Sans plafond
  de cadence, en 2160 × 1350 : 86,5 → 86,9 img/s (vue d'ensemble), 142,1 → 141,6 (rue) : du bruit. Cas extrême de
  20 000 traînées larges de 3 px : +0,35 à +1,6 ms, −3 % d'img/s. **Un téléphone reste à mesurer** (US001).
- **Le vrai danger, ce sont les recompilations de shaders en cours de route [mesuré]** : créer `scene.fog` après le
  démarrage = **4,4 s d'image figée** la première fois (31 programmes, cache de shaders vide), 0,26 s ensuite ; basculer
  `sun.castShadow` = **3,0 s** (0,2 s ensuite) ; repatcher un matériau = 0,17 s. Règle : **tout ce qui touche aux
  matériaux standards est en place dès le démarrage** (objet brouillard inactif, uniformes `uWet` / `uSnow` / `uSway` à 0,
  jamais de bascule d'ombre). Les petits `ShaderMaterial` (pluie, neige, nuages) peuvent arriver plus tard : 1 programme,
  < 11 ms [mesuré].
- **Le ciel couvert est gratuit** (intensités et couleurs dans `daynight.apply()`) ; **le brouillard aussi**, avec une
  couleur calée exactement sur le fond CSS par l'inverse du rendu des tons ACES [prototype, testé à < 1/255] et une
  correction de la passe finale (couleurs prémultipliées) qui supprime un **liseré clair autour du socle** découvert pendant
  l'essai (défaut existant, invisible aujourd'hui, très visible avec le brouillard).
- **Client** : `/api/weather` validé par `weatherResponse` (contrat du plan back), délai **8 s**, nouvel essai à 60 s,
  relecture toutes les 15 min **si l'onglet est visible et qu'il y a eu une interaction dans les 30 min** ; 404 (le Pi, sans
  API) = pas de relance. `?weather=` reprend les **valeurs types du contrat** (`WEATHER_PRESETS`) : même rendu que le forçage
  de l'administration [prototype : 19 tests Vitest verts].
- **Poids [mesuré sur le prototype]** : module météo chargé à la demande = **4,4 Ko gzip** (état, client, pluie, contrat) ;
  complet ≈ 8 à 10 Ko [estimé] ; chunk principal + 1,5 à 2,5 Ko [estimé]. La règle 10 de l'epic (≤ +10 Ko) tient.
- **À corriger dans la spec** : le seuil « sous 40 img/s » (règle 7) couperait la pluie en permanence sur l'iPhone, déjà
  à ≤ 31 img/s sans météo ; le remplacer (section 5.2). Liste complète en section 1.
- **MVP front ≈ 9 à 10 j** (US001, US002, US006, US004, US005) + back US003 (1,5 à 2 j). **Démo sans back ≈ 5,5 j**
  (US001, US002, US006) ; seule US004 attend la route du back, US002 n'attend que le contrat.

---

## 1. Ce qui a changé depuis le plan v1 et la spec (08/10)

| Spec / plan v1 | Aujourd'hui | Conséquence pour la carte |
|---|---|---|
| Chemins `src/…` | `frontend/carte/src/…` (EP010) | Tous les chemins de ce plan sont réels [code] |
| Contrat « JSON v1 » en prose | `contrat/meteo.ts` en zod/mini (plan back § 4) : `weatherResponse`, `WEATHER_PRESETS`, `WEATHER_CONDITION_FR`, `WEATHER_MAX_AGE_S` | La carte valide avec `safeParse` (comme `validPublishedEdits`, `scene/parking-edits.ts` l. 48-67) ; `?weather=` lit les valeurs types du contrat |
| Modèle AROME | ICON du DWD (`icon_seamless`) : AROME ne donne ni visibilité ni orage (plan back § 1.3) | Crédit « Open-Meteo.com, modèle ICON du DWD » ; la puce dit « modèle ICON, 10 h 00 », jamais « observé » |
| Délai 3 s | 8 s + nouvel essai à 60 s (plan back § 14.7) | Rien n'attend la météo : un délai long ne coûte rien |
| US003 « retirer le `no-store` global » | Déjà non écrasant (`backend/src/app.ts` l. 65-68) [code] | — |
| US011 « suivi dans l'admin » | Écran « Météo » + forçage pour tous + coupure : **US012** (plan back § 6) | Nouveaux états côté carte : « forcée (démo) », « désactivée » (503 `meteo-desactivee`) |
| Règle 7 « sous 40 img/s → couper » | iPhone 12 Pro ≤ 31 img/s mesuré **sans** météo (DECISIONS, 02/10) | Règle relative, section 5.2 |
| US002 « sans ombres portées » | Basculer `castShadow` fige l'image 3 s [mesuré] | Ombres effacées par l'intensité du soleil, section 4.1 |
| US006 `FogExp2` | Brouillard **linéaire** calé sur la distance caméra, couleur par inverse ACES [prototype] | Section 4.2 |
| US001 « pluie prototype » | Prototypée et mesurée sur le Mac (section 4.3) | Reste la mesure sur téléphone |
| Pi / Coolify | Pas d'API : nginx répond 404 sur `/api/` | 404 = pas de météo, pas de relance |

---

## 2. Points d'insertion dans le code d'aujourd'hui

Tous les numéros de ligne sont ceux de la branche `feat/EP009-meteo` au 09/10 (commit `c7f6101`) [code].

### 2.1 Modificateur météo dans le cycle jour/nuit — `frontend/carte/src/scene/daynight.ts`
| Ligne | Aujourd'hui | Changement |
|---|---|---|
| 84-86 | `const hemiI`, `const keyI`, `const exposure` | Passer en `let`, puis **juste après la ligne 86** appliquer le modificateur (soleil voilé, diffuse un peu plus forte, ciel et soleil vers le gris, fond désaturé, exposition) à partir d'un objet `look` (valeurs lissées). Ainsi la relecture de l'heure chaque minute (`clock`) ne défait jamais la météo [prototype : `weatherLook`, section 11] |
| 88-107 | Écriture des lumières | Inchangée : elle reçoit les valeurs modifiées. La position du soleil ne dépend pas de la météo → `shadowMap.needsUpdate` (l. 97-100) jamais déclenché par la météo |
| 110 | `uNight` | Orage de jour : `max(uNight, 0,35 × storm)` (lumières de la ville qui s'allument sous un ciel noir) — à juger avec Dasco |
| 120-125 | Halos des bars | `× (1 + 0,25 × wet)` la nuit sous la pluie (US005) |
| 127-132 | Fond CSS | Déjà écrit après le modificateur (les couleurs `bg` sont modifiées avant) ; pendant un fondu, il change à chaque image (comme pendant la lecture ▶) |
| 138-152 | API | Ajouter `setWeather(look)` (enregistre + `apply()`), `skyEdge()` (couleur `bg[1]` en sRGB, pour le brouillard) et `exposure()` |

La fonction de modification est **pure** (`scene/weather-sky.ts`, chunk principal, ≈ 40 lignes) : beau temps = identité exacte
(test Vitest : `look = CLEAR` → mêmes valeurs qu'aujourd'hui).

### 2.2 Passe finale du tilt-shift — `frontend/carte/src/scene/tiltshift.ts`
| Ligne | Changement |
|---|---|
| 66-93 (`compositeMaterial`) | Uniformes `uVeil` (0..1), `uVeilColor` (couleur CSS du fond, espace écran), `uFlash` (0..1) |
| 87-89 | **Correction** : diviser par l'alpha avant `tonemapping_fragment` / `colorspace_fragment` et remultiplier après. Les couleurs de la cible sont prémultipliées (bords du socle anticrénelés, particules sur le fond transparent) ; le rendu des tons et la conversion sRGB ne sont pas linéaires, d'où des bords **plus clairs** que le fond. Invisible avec la plinthe sombre ; avec le brouillard : liseré blanc tout autour du socle, gros halo en haut (zone floue) [prototype, captures `v-brouillard06*.png`]. 4 lignes, sans coût |
| après 89 | Voile : `rgb = mix(rgb, uVeilColor × a, uVeil)` ; éclair : `rgb += uFlash × a × vec3(0.85, 0.9, 1.0)`. Appliqués après la conversion sRGB : le voile a exactement la couleur du fond CSS |
| 173-179 | API : `setWeather({ veil, veilColor, flash })` |
Aucune passe ni texture en plus. Les étiquettes (scène à part, l. 111-113) restent nettes et hors brouillard.

### 2.3 Brouillard — `frontend/carte/src/scene/stage.ts` et `scene/markers.ts`
- `stage.ts` ligne 23 (`const scene = new THREE.Scene()`) : **créer tout de suite** `scene.fog = new THREE.Fog(0xffffff, 1e9, 2e9)`
  (inactif : `near` immense). Tous les programmes sont compilés une fois avec le brouillard ; démarrage inchangé [mesuré :
  38 programmes dans les deux cas, 1re image 296 à 352 ms contre 301 à 389 ms, cache chaud]. Ensuite, seuls `near`, `far` et
  `color` changent : 9 à 10 ms, 0 programme [mesuré]. Créer l'objet plus tard : 4,4 s figées [mesuré].
- `markers.ts` : `fog: false` sur les halos (`PointsMaterial`, l. 217-220 : ils doivent percer le brouillard, CA de US006), les
  gemmes ✦ et leurs anneaux (l. 34-40) et les épingles (l. 150) : ce sont des repères de jeu. Même question pour les
  éléphants (`scene/mascot.ts`, l. 164) et les panneaux de parkings. Réglé au démarrage, donc sans recompilation.
- Les `ShaderMaterial` maison (fumée, pluie, nuages, oiseaux…) ont `fog: false` par défaut : rien à faire.

### 2.4 Particules (pluie, neige)
- `scene/particles.ts` (l. 37-161) calcule les positions **sur le processeur** (boucle l. 123-146, renvoi des tampons
  l. 151-157) : bien pour quelques centaines de particules (fumée, feux d'artifice), pas pour des milliers de gouttes.
- Nouveau module **`frontend/carte/src/weather/precipitation.ts`** (chunk météo) : positions calculées dans le vertex shader à
  partir du temps, tampon statique, densité réglable par un uniforme (`uDensity` : on change le nombre de gouttes sans rien
  réallouer), un appel de rendu par nappe [prototype `scene/rain-proto.ts`, section 4.3].

### 2.5 Vent partagé (fumée, drapeaux, arbres)
| Fichier : ligne | Aujourd'hui | Changement |
|---|---|---|
| `main.ts` 187-189, 197 | `buildChimneys(lifeContent.smoke…)`, `buildFlags(…, { wind: lifeContent.smoke.wind })` | Un objet `wind = { ...lifeContent.smoke.wind }` créé dans `main.ts`, passé aux deux, modifié par le module météo |
| `chimneys.ts` 93-96 | `drift` calculé une fois | Recalculer `drift` (en place, même tableau) dans la vérification toutes les 0,5 s (l. 101-109) ; densité `× (1 + 0,5 × pluie)` en option |
| `flags.ts` 82, 111 | `windAngle` figé, `cloth.rotation.y` posé une fois | Garder les maillages de tissu, `rotation.y` lu à chaque `update` (l. 119-128) ; `uStrength` selon la vitesse. Le tissu ne projette pas d'ombre (l. 112) : rien à recalculer |
| `nature.ts` 34, `city.ts` 540 | Matériaux des arbres sans animation | Balancement par un uniforme `uSway` **injecté au démarrage** (US009) |

### 2.6 Puce météo et crédits — `frontend/carte/src/ui/ui.ts`, `style.css`, `ui/lobby.ts`
| Fichier : ligne | Changement |
|---|---|
| `ui.ts` 79-86 (`.time`), après la puce Saison (l. 85) | `<button class="weather" data-action="weather" hidden>` : icône + température sur ordinateur, icône seule sous 720 px ; `aria-label` « Météo : pluie, 13 °C, direct » |
| `ui.ts` 33-57 (`UiHandlers`) | `onWeather()` : ouvre le panneau (construit par le module météo, chargé à la demande) |
| `ui.ts` 368-434 (API) | `setWeatherChip(state)` |
| `ui.ts` 123 (pied de page, texte échappé) | Élément `<span class="weather-credit" hidden> · <a href="https://open-meteo.com/" target="_blank" rel="noopener">Météo : Open-Meteo.com</a> (CC BY 4.0)</span>` hors de `.long` (visible sur mobile), affiché quand la météo vient de la source |
| `main.ts` 522 / `lobby.ts` 135-137 | Crédits du lobby (texte) : « · Météo : Open-Meteo.com (CC BY 4.0) » |
| `style.css` 178-188, 197-218, 220-223 | Style de la puce comme `.live` / `.season` ; icône seule ≤ 720 px ; à vérifier à 375 et 320 px (la barre d'heure est déjà serrée) |

### 2.7 Boucle, horloge, outils
| Fichier : ligne | Changement |
|---|---|
| `main.ts` 469-497 (`tickers`) | Le module météo arrive après la construction du tableau : `tickers.push(weather)` à son chargement (tableau modifiable) |
| `main.ts` 498-557 (cadence TI-02) | Rien : la météo ne définit pas `moving()` (section 5.4) |
| `main.ts` 318-336 (`clock.onChange`) | `weather?.onClock(c)` : règle Direct / simulée |
| `main.ts` 557-562 | Démarrage du module météo (section 3.1) |
| `main.ts` 565 (`window.diorama`) | Ajouter `weather` (debug) |
| `main.ts` 351-355 | Même schéma pour `dev/weather-debug.ts` (sélecteur, seulement avec `?debug`, chunk à part) |
| `scene/quality.ts` 15-48 | `qualityLevel` et règle de dégradation (section 5) |
| `ui/perfhud.ts` 20-31 | Ligne « GPU x,x ms » quand `EXT_disjoint_timer_query_webgl2` existe [prototype : disponible dans Chrome sur Mac ; absent de Safari] |
| `scene/people.ts` 367, `scene/birds.ts` 206 | En option (US005) : foule `× (1 − 0,5 × pluie)`, oiseaux masqués sous la pluie, la neige et l'orage |
| `vite.config.ts` 126-150 | **Rien** : `/api` est exclu du repli (l. 135) et n'a pas de `runtimeCaching` → réseau seulement, hors ligne = échec = ciel par défaut ; le chunk météo est pré-caché (`globPatterns`, l. 128) : `?weather=` marche hors ligne |

### 2.8 Sol mouillé et neige au sol : crochets dans les matériaux (au démarrage)
- Un utilitaire `weatherSurface(mat, uniforms)` (chunk principal, ≈ 30 lignes) **enchaîne** l'`onBeforeCompile` existant et
  **étend** `customProgramCacheKey`, exactement comme `fadeMaterial` (`scene/cutaway.ts` l. 51-64) ; réglages par uniformes
  seulement (règle rappelée dans `scene/models/lighting.ts` l. 10-16).
- GLSL injecté à `#include <emissivemap_fragment>` (avant `lights_physical_fragment`) : `normal` est disponible, on peut changer
  `diffuseColor` et `roughnessFactor` ; « vers le haut » sans attribut en plus : `dot(normal, normalize((viewMatrix *
  vec4(0., 1., 0., 0.)).xyz))`. Branche sur uniforme (`if (uWet + uSnow > 0.)`) : coût nul par beau temps [estimé].
- Matériaux : rues `city.ts` 217-242 (`roadMaterial`), bâtiments et toits `city.ts` 448-516 (`windowsMaterial`, qui remplace déjà
  `emissivemap_fragment` l. 505-512 en gardant l'include : l'enchaînement fonctionne), sol `terrain.ts` 152 ; pour la neige en plus :
  arbres `nature.ts` 34 et `city.ts` 540-541, cheminées `chimneys.ts` 63, auvents `facades.ts` 126, toits des monuments
  (`scene/models/*.ts`). **Posés au démarrage**, sinon chaque matériau repatché fige l'image (0,17 s par programme la 1re fois [mesuré]).

---

## 3. Client : lecture de `/api/weather`

### 3.1 Fichiers et chargement
| Fichier (nouveau) | Rôle | Chunk |
|---|---|---|
| `frontend/carte/src/weather/state.ts` | Logique pure : réponse → valeurs de rendu, `?weather=`, Direct / simulée, fondu, vent | météo [prototype] |
| `frontend/carte/src/weather/client.ts` | `fetchWeather()`, `nextRefresh()` | météo [prototype] |
| `frontend/carte/src/weather/precipitation.ts` | Pluie et neige GPU | météo [prototype, pluie] |
| `frontend/carte/src/weather/index.ts` | `startWeather(ctx)` : branche l'état sur la scène, la puce, les crédits ; renvoie un `Ticker` | météo [prototype réduit] |
| `frontend/carte/src/weather/panel.ts` | Panneau de la puce (DOM) | météo |
| `frontend/carte/src/dev/weather-debug.ts` | Sélecteur et curseurs (`?debug`) | à part |
| `frontend/carte/src/scene/weather-sky.ts`, `scene/weather-surface.ts`, `scene/weather-color.ts` | Modificateur du ciel, crochets des matériaux, couleur du brouillard (pures ou petites) | principal |
| `frontend/carte/src/state/weather-pref.ts` | Préférence « météo désactivée » (`localStorage`, comme `state/lobby.ts`) | principal |

Séquence (aucune attente) :
1. Au début de `main()` : si la préférence n'est pas « désactivée », `const weatherMod = import('./weather/index')` (en parallèle
   de `city.json`) ; la requête `/api/weather` part dès le chargement du module (sauf `?weather=`, zéro réseau).
2. Après le démarrage de la boucle (entre `main.ts` l. 557 et l. 560) : `weatherMod.then((m) => tickers.push(m.startWeather(ctx)))`.
   La météo s'installe **en fondu derrière le lobby** (effet « waou », jamais devant l'écran de chargement).
3. Préférence « désactivée » : ni import ni requête ; la puce affiche « Météo désactivée » (texte du chunk principal) et la
   réactive au toucher.

### 3.2 Validation tolérante [prototype : `weather/client.test.ts`, `weather/state.test.ts`]
| Réponse | Carte |
|---|---|
| 200 conforme à `weatherResponse` (objet ouvert : un champ en plus passe) et `observedAt` ≤ `WEATHER_MAX_AGE_S` (3 h, horloge du visiteur) | Météo affichée en fondu |
| 200 hors contrat (`v: 2`, intensité > 1, condition inconnue, page HTML) | Ciel par défaut, « Météo non disponible », relance |
| 503 `meteo-indisponible` / 5xx / réseau / délai de 8 s dépassé | Idem ; relance à 60 s, puis 2, 4, 8 min, plafond 15 min ; événement `online` → relance |
| 503 `meteo-desactivee` (coupée depuis l'admin) | Ciel par défaut, « Météo désactivée », relue dans 15 min |
| 404 (carte du Pi, sans API) | Ciel par défaut, puce masquée, **jamais** de relance |
Le code ne lève jamais d'exception vers `main()` : tout passe par `{ ok: false, reason }`.

### 3.3 Rafraîchissement
- 15 min après un succès, **seulement si l'onglet est visible et qu'il y a eu une interaction dans les 30 min** (recommandation
  du plan back pour ne pas réveiller Neon avec un onglet oublié) ; `visibilitychange` et la première interaction après une
  absence relancent si le relevé a plus de 15 min [prototype : `nextRefresh`].
- Le service worker ne garde pas la météo (section 2.7) ; la carte la garde en mémoire seulement (arbitrage de la spec).

### 3.4 Fondu entre états [prototype : `blendLook`]
- Chaque valeur tend vers sa cible avec `cur = cible + (cur − cible) · e^(−dt/τ)` : indépendant de la cadence (testé à 20, 30,
  60 et 144 img/s), jamais de dépassement, cible atteinte exactement (plus d'écriture ensuite). τ = 3 s pour le ciel (moitié du
  chemin en ≈ 2 s), 6 s pour le vent ; la direction du vent tourne par le plus court chemin.
- Sol mouillé : `wet` suit la pluie, vite à l'humidification (τ ≈ 20 s), lentement au séchage (τ ≈ 2 min), dans la session.
- `daynight.setWeather()` n'est appelé que si une valeur a bougé : par temps stable, 0 travail par image.
- Premier relevé : fondu depuis le beau temps (la scène d'aujourd'hui) : CA de US004.

### 3.5 Forçage par l'adresse `?weather=` (à garder en plus du forçage serveur)
- `?weather=<condition>` reprend `WEATHER_PRESETS` du contrat ; `&intensity=` (intensité principale, bornée 0..1), `&wind=` (km/h),
  `&windfrom=` (degrés) ; inconnu → ignoré [prototype : `lookFromParam`].
- **Garder les deux** : `?weather=` sert à développer et à régler le rendu (zéro réseau, hors ligne, sans session admin, autorisé
  en production) ; le forçage de l'administration (US012) sert aux démos à plusieurs (tous les visiteurs le voient).
  Priorité : adresse › administration (`forced: true`) › direct. La puce dit « Forcée (adresse) » ou « Forcée (démo) ».
- `?debug` ajoute le sélecteur (9 conditions + curseurs nuages, pluie, neige, brouillard, orage, vent) et
  `window.diorama.weather.set({...})`.

### 3.6 Direct ou simulée (D4) et filtre de température
- **v1 (recommandation de la spec et du plan back)** : la météo réelle seulement si `mode === 'live'` **et** `season === 'auto'`
  (`time/clock.ts` l. 15-27) ; sinon « Simulée » (beau temps), avec un bouton « Revenir au direct » dans le panneau
  (`clock.live()` + `setSeason('auto')`, l. 69 et 74) [prototype : `isLive`].
- Avec US013 (prévisions, facultative) : hors Direct mais le jour même, l'heure la plus proche des prévisions (« Prévision 18 h,
  modèle ICON ») ; la lecture ▶ fait alors défiler la météo de la journée.
- Neige montrée en pluie au-dessus de 2 °C (le back l'applique déjà : double sécurité, utile pour `?weather=snow`) [prototype].
- Vent : « d'où il vient » (météo, 0 = nord) → « vers où il va » (0 = est, 90 = nord, convention de `life.json`) :
  `(−90 − from) mod 360` [prototype, testé] ; vitesse réelle → vitesse « de maquette » (constante `WIND_VISUAL` à calibrer).

### 3.7 Ce que montre la puce (règle 1 : rien d'inventé)
Condition (`WEATHER_CONDITION_FR`), température si connue, vent en mots (« vent d'ouest, 14 km/h »), « modèle ICON, 10 h 00
(il y a 6 min) » (jamais « observé »), état : Direct / Ancien relevé (`stale`) / Forcée / Simulée / Non disponible / Désactivée ;
interrupteurs « Afficher la météo » et « Effets réduits » (ni éclairs ni précipitations) ; crédit `attribution` (texte, lien,
licence) **à côté des données** comme le demande Open-Meteo.

---

## 4. Rendu par météo

Budget visé : **≤ +2 appels de rendu** pour les précipitations, **0 passe plein écran** en plus, **0 recompilation** après le
démarrage pour les matériaux standards. Appels comptés **par vue** (mesuré : 2 407 en vue d'ensemble, ≈ 90 dans la rue).

| Météo | Technique | Appels | GPU (M1) | Effort | Risque |
|---|---|---|---|---|---|
| Soleil | État actuel | 0 | 0 | — | — |
| Couvert | Modificateur `daynight` | 0 | 0 [mesuré : intensité du soleil changée sans à-coup] | 1 j (dans US002) | faible |
| Brouillard | `THREE.Fog` linéaire créé au démarrage, couleur inverse ACES, correction prémultipliée, voile final | 0 | négligeable [estimé] | 1,5 j | moyen (réglage) |
| Pluie | Traînées GPU, 2 nappes, sol mouillé (crochets), halos | +1 à +2 | **+0,1 à +0,45 ms** pour 3 000 [mesuré] | 2,5 à 3 j | moyen |
| Neige | Flocons GPU, neige au sol (crochets sur 8 à 10 matériaux) | +1 à +2 | ≈ pluie [estimé] | 3 à 4 j | élevé (visuel) |
| Orage | Pluie forte + éclair (passe finale + hémisphérique) + trait d'éclair | +1 pendant 150 ms | ≈ pluie | 2 j | moyen (photosensibilité) |
| Vent | Objet `wind` partagé ; balancement des arbres | 0 | arbres : à mesurer (≈ 1 M de triangles) | 2 à 2,5 j | moyen |
| Nuages de maquette | `InstancedMesh` + `ShaderMaterial` | +1 | faible [estimé] | 1,5 j | moyen (lisibilité) |

### 4.1 Soleil / couvert [prototype]
- Valeurs du prototype (à calibrer) : `keyI × (1 − 0,8·c)`, `hemiI × (1 + 0,12·c)`, ciel et soleil vers le gris (55 % et 50 %),
  fond CSS désaturé à 60 %, exposition −7 % ; `c = max(nuages, 0,8·brouillard, 0,9·pluie)`. Capture `v-couvert.png` : ombres
  presque effacées, ambiance grise, palette gardée.
- **Ne jamais basculer `sun.castShadow`** : 3,0 s d'image figée la première fois (28 programmes recompilés), 0,2 s ensuite
  [mesuré]. L'ombre ne coûte d'ailleurs presque rien : la carte des ombres n'est recalculée que quand le soleil bouge
  (`stage.ts` l. 16). Le soleil voilé suffit à effacer les ombres.

### 4.2 Brouillard [prototype]
- `THREE.Fog` **linéaire** plutôt que `FogExp2` : en vue d'ensemble, tout le socle est à 2 200-3 500 m de la caméra ; une densité
  fixe noierait tout uniformément. `near = d·(1 − 0,55·k)`, `far = d + taille·(1,6 − 1,25·k)` avec `d` = distance caméra-point
  regardé : le devant reste lisible, le fond de la ville se noie, à tous les zooms (CA de US006).
- Couleur : la couleur CSS du bord (`bg[1]`) passée dans **l'inverse exact** du rendu des tons de three.js (exposition, matrices
  et courbe ACES, sRGB) : un fragment noyé s'affiche exactement comme le fond, de jour, de nuit, au crépuscule
  [prototype `scene/weather-color.ts`, 5 tests à < 1/255]. Captures `v-brouillard06-unpremult.png` (matin) et
  `v-nuit-brouillard.png` (nuit, lumières qui s'estompent au loin, sans raccord visible).
- Sans la correction de la passe finale (2.2), un liseré blanc entoure le socle (`v-brouillard06.png`).
- Voile final (`uVeil`) en complément léger : baisse de contraste uniforme, couleur du fond.
- Brouillard « de vallée » en nappes : écarté (transparence sur grande surface, coûteux sur mobile), comme dans la spec.

### 4.3 Pluie [prototype + mesuré]
**Technique du prototype** (`scene/rain-proto.ts`, 100 lignes) : un quadrilatère par traînée (4 sommets, attributs `aSeed`,
`aCorner`, `aIdx`), position calculée dans le vertex shader : chute + vent × temps, repliée (`mod`) dans une boîte **ancrée dans
le monde** autour du point regardé (les gouttes ne glissent pas quand on déplace la carte), épaisseur constante en pixels
(élargissement perpendiculaire au trait à l'écran), fondu au bord de la boîte et en haut, `depthWrite: false`, mélange normal,
`DoubleSide` (l'orientation du quadrilatère dépend du sens du trait : sans lui, tout était éliminé — vérifié à la capture).
Longueur, vitesse et taille de la boîte proportionnelles à la distance caméra (densité à l'écran à peu près constante).

**Mesures** (Apple M1, Chrome for Testing 145, Metal ; « GPU » = requêtes de temps `EXT_disjoint_timer_query_webgl2` autour
de tout le rendu d'une image ; A/B = pluie montrée / masquée en alternance dans la même page, 5 à 6 tours de 4 s) :

| Cas | Vue | img/s sans → avec | GPU ms sans → avec (Δ) |
|---|---|---|---|
| 3 000 traînées, 1280 × 800, cadence normale, repos | ensemble | 30,0 → 30,0 | 8,27 → 8,72 (+0,45) |
| idem, mouvement | ensemble | 60,0 → 60,0 | 8,09 → 8,00 (−0,09) |
| idem, repos | rue | 30,0 → 30,0 | 5,56 → 5,76 (+0,20) |
| idem, mouvement | rue | 60,0 → 60,0 | 5,47 → 5,60 (+0,13) |
| 3 000, 2160 × 1350 (Retina, densité 1,5), sans plafond, mouvement | ensemble | 86,5 → 86,9 | 11,83 → 12,16 (+0,33) |
| idem | rue | 142,1 → 141,6 | 12,25 → 12,34 (+0,10) |
| 20 000 traînées de 3 px (extrême), 2160 × 1350, sans plafond, mouvement | ensemble | 73,1 → 70,7 (−3 %) | 12,91 → 14,54 (+1,63) |
| idem | rue | 125,8 → 121,9 (−3 %) | 13,76 → 14,24 (+0,48) |

- **+1 appel de rendu**, +6 000 triangles pour 3 000 traînées ; processeur inchangé (Δ < 0,1 ms).
- Ajouter la pluie en cours de route : 1 programme, image la plus longue 11 ms : **aucun à-coup** [mesuré].
- Les écarts de quelques dixièmes de ms sont de l'ordre du bruit de mesure (± 0,1 à 0,9 ms selon les cas) : la pluie à
  3 000 traînées n'est **pas mesurable** sur la cadence du Mac.
- **Non mesuré : téléphone.** Le GPU d'un iPhone est plusieurs fois moins puissant, mais dessine ≈ 4 fois moins de pixels
  (densité plafonnée à 1,5) ; l'ordre de grandeur attendu reste ≤ 0,5 ms [estimé]. Sur un écran 60 Hz, le risque est de faire
  passer une image de 30 à 20 img/s si le téléphone est déjà à la limite : c'est ce que mesure US001.

**Pour la version finale** (US005) :
- **Deux nappes** (proche : boîte de ≈ 150 m autour du point regardé ; lointaine : tout le socle) en fondu selon la distance
  caméra, au lieu d'une boîte recalculée par paliers : le prototype « saute » quand la boîte change de taille pendant un zoom.
  +2 appels au lieu de +1, même total de gouttes.
- **Au-dessus du socle seulement** (recommandé, à valider par Dasco) : sinon la pluie tombe aussi dans le vide autour de la
  maquette, sur le fond (`v-pluie.png` : tirets blancs sur le beige, plutôt « neige ») ; avec la limite et la correction 2.2 :
  `v-pluie-socle-unpremult.png`. Coût nul (gouttes hors socle écartées dans le vertex shader).
- Nombre de gouttes par niveau (section 5.1) × intensité (`uDensity`).
- Sol mouillé : `uWet` assombrit (≈ −15 %) et rend un peu satinés rues, toits et sol (crochets 2.8). **Pas de vrais reflets**
  (pas d'environnement : trop cher sur les 2 400 appels des monuments) : « plus sombre et satiné », pas de flaques.
- La nuit : halos des bars +25 % (2.1). En option : moins de passants, oiseaux à l'abri, fumée plus dense.
- Éclaboussures au sol, gouttes sur l'objectif : hors périmètre (effet faible à cette échelle, lisibilité).

### 4.4 Neige
- Même système, sprites ronds (`gl_PointSize` ou quadrilatères), chute lente (1 à 2 « m/s de maquette ») avec dérive sinusoïdale
  par flocon ; 1 500 à 3 000 selon le niveau.
- Neige au sol : `uSnow` × « vers le haut » (`smoothstep(0,35 ; 0,75)`) × un peu de bruit, vers un blanc bleuté légèrement
  cassé (palette pastel) ; toits en pente faible, sol, parcs, canopées ; façades non. 8 à 10 matériaux, un seul morceau de GLSL
  (2.8). Le plus long à régler (risque visuel élevé, spec) ; vérifier chaque vue (ensemble, Carré Curial, château, rue).
- L'item « arbres enneigés plutôt que nus » du BACKLOG : traité ici ou reporté explicitement.

### 4.5 Orage
- Pluie à 0,85 + vent fort + assombrissement (`keyI × 0,2`, exposition −10 %).
- Éclair : `uFlash` dans la passe finale (0,3 à 0,6, décroissance 120 à 250 ms) + `hemi.intensity` pulsée ; la position du
  soleil ne bouge pas, donc aucune carte d'ombres recalculée. Trait d'éclair : ruban de ≈ 40 segments régénéré à chaque coup
  (même technique d'épaisseur en pixels que la pluie), 1 appel pendant 150 ms, loin de la caméra.
- **Photosensibilité** (WCAG 2.3.1) : planificateur pur et testé : jamais plus de 3 éclairs par seconde, 6 à 20 s entre deux
  salves, amplitude bornée ; **aucun** éclair avec `prefers-reduced-motion` ou « Effets réduits ». L'orage est déduit du code
  de la source (pas d'éclair en temps réel : ne pas le promettre).

### 4.6 Vent
- Objet `wind` partagé (2.5) : la fumée et les drapeaux suivent la direction et la force réelles (aujourd'hui figées à la
  construction). Coût nul.
- Balancement des arbres : déplacement de sommets ∝ hauteur, phase par instance, amplitude ∝ vent, dans `uSway` injecté au
  démarrage. Les arbres font ≈ 1 M de triangles (80 %) : à activer en qualité moyenne et haute seulement, au-dessus de
  ≈ 25 km/h, **et à mesurer avant / après** (Mac puis téléphone). Ombres figées : le balancement ne se voit pas dans l'ombre
  (acceptable).
- Feuilles qui volent en automne : `createParticles` (CPU, 50 à 150 particules), facultatif.

### 4.7 Nuages de maquette
- 6 à 12 « boules de coton » (icosaèdres aplatis fusionnés) en **un** `InstancedMesh`, matériau `ShaderMaterial` éclairé à la main
  (compilation rapide, pas de brouillard), sans ombre, en anneau autour du socle ou en altitude, nombre ∝ couverture, dérive
  avec le vent, fondu quand la caméra s'approche ; aucun en qualité basse.
- Idée hors périmètre : ombres de nuages qui défilent sur la ville (masque dans l'éclairage direct) : joli mais invasif dans
  les shaders (1,5 j, risque moyen).

---

## 5. Qualité et fluidité

### 5.1 Niveaux de qualité (à créer dans `scene/quality.ts`, chunk principal)
- `initialQuality({ coarse, width, dpr, deviceMemory })` : ordinateur → `high` ; pointeur grossier ou largeur < 700 px →
  `medium` ; et `deviceMemory ≤ 3` (Chrome Android seulement) → `low`. Forçable par `?quality=low|medium|high`, affiché dans le
  compteur `?debug`. Remplace la détection dupliquée de `people.ts` l. 140 et `birds.ts` l. 80 (même règle).

| Effet | low | medium | high |
|---|---|---|---|
| Traînées de pluie (× intensité) | 1 200 | 2 500 | 5 000 |
| Flocons | 800 | 1 500 | 3 000 |
| Sol mouillé / enneigé, couvert, brouillard | oui (gratuits) | oui | oui |
| Balancement des arbres | non | arbres simples | tous |
| Nuages de maquette | non | 6 | 12 |
| Trait d'éclair | non | oui | oui |

Chiffres à confirmer par la mesure sur téléphone (US001) : le M1 encaisse 20 000 traînées pour < 2 ms.

### 5.2 Dégradation automatique : le seuil de 40 img/s ne convient pas
- Aujourd'hui, `quality.ts` (l. 40-41) baisse la densité de pixels sous 40 img/s **en mouvement**. L'iPhone 12 Pro est déjà à
  ≤ 31 img/s sans météo (DECISIONS, 02/10) : la règle 7 de l'epic (« sous 40 img/s après la baisse maximale, couper les
  précipitations ») couperait la pluie **en permanence** sur ce téléphone, sans gain visible.
- Règle proposée (fonction pure `weather/budget.ts`, testée) : seulement si la densité de pixels est au minimum **et** que deux
  mesures de suite (2 × 2 s) en mouvement sont **sous 24 img/s** → densité des précipitations ÷ 2 (uniforme `uDensity`, rien
  à reconstruire), puis coupure ; jamais de remontée dans la session ; l'éclairage et le brouillard restent. 24 = entre le
  palier 30 et le palier 20 d'un écran 60 Hz : la règle attrape exactement « la pluie a fait tomber à 20 ».
- `quality.ts` expose pour cela un rappel `onSample(fps, atMin)` après le calcul des l. 36-42.

### 5.3 Réduit-mouvement
`matchMedia('(prefers-reduced-motion: reduce)')` (déjà lu pour le lobby, `main.ts` l. 517) avec écoute de `change` : ni
éclairs ni flashs ni balancement, précipitations ralenties (× 0,3), nuages immobiles. Même effet que l'interrupteur « Effets
réduits » du panneau.

### 5.4 TI-02 (30 img/s au repos)
- La boucle ne s'arrête déjà jamais (les éléphants marchent, `main.ts` l. 498-501) : **la pluie n'ajoute aucune image**
  [mesuré : 30,0 img/s au repos avec et sans pluie]. Elle ajoute seulement du travail par image (+0,1 à +0,45 ms sur le M1).
- Règles : les précipitations **ne définissent pas** `moving()` (elles s'animent à 30 img/s au repos, assez fluide pour des
  traînées) ; le fondu ne force pas non plus la pleine vitesse ; onglet caché = plus d'images (`requestAnimationFrame`).
- Pour aller plus loin (hors EP009, à proposer en ticket) : une « veille » à 15 img/s après 2 min sans interaction, pour toute
  la scène, précipitations figées ; utile à la batterie avec ou sans météo.

---

## 6. Tests

### 6.1 Vitest, projet « carte » (Node, sans navigateur) — `npm test`
| Fichier | Contenu | État |
|---|---|---|
| `weather/state.test.ts` | Réponse → rendu ; vent (3 directions) ; neige à 4 °C → pluie ; orage ; validation (champ en plus, `v: 2`, intensité > 1, condition inconnue, HTML, relevé > 3 h) ; `?weather=` (valeurs types, `intensity` bornée, inconnu → null) ; Direct / simulée ; fondu (4 cadences, sans dépassement, cible exacte, plus court chemin pour le vent) | [prototype : 13 tests verts] |
| `weather/client.test.ts` | 200 ; 503 indisponible / désactivée ; 404 ; 502 ; HTML ; hors contrat ; réseau ; délai (faux minuteurs) ; relectures (15 min, onglet caché, inactif 30 min, 60 s → 15 min, jamais sans API) | [prototype : 6 tests verts] |
| `scene/weather-color.test.ts` | Inverse ACES : jour, nuit, crépuscule, gris de pluie, brouillard clair → retour à la couleur CSS à < 1/255 | [prototype : 5 tests verts] |
| `scene/weather-sky.test.ts` | Beau temps = identité exacte (scène d'aujourd'hui) ; couvert → soleil plus faible, couleurs plus grises, bornes | à écrire |
| `weather/lightning.test.ts` | ≤ 3 éclairs/s sur 1 000 tirages ; réduit-mouvement → aucun | à écrire |
| `weather/budget.test.ts` | Dégradation (24 img/s, 2 mesures, densité minimale) ; jamais de remontée | à écrire |
| `scene/quality.test.ts` | `initialQuality` (ordinateur, téléphone, `?quality=`) | à écrire |
Le module météo n'utilise ni `document` ni `three.js` dans ces fichiers purs (projet Vitest en environnement Node).
Prototype : `npm test` du projet carte = 28 tests verts (dont 4 existants) ; `tsc -p frontend/carte`, `tsc -p contrat` et
`check-boundaries` passent (la carte importe `contrat/meteo.js`, comme `contrat/parkings.js`).

### 6.2 Navigateur (`?debug`, `?weather=`) — à chaque US
- Sans `?weather=` ni API : capture identique à aujourd'hui à 12 h et à 22 h ; mêmes appels de rendu.
- Chaque condition : `?debug&weather=<condition>` en vue d'ensemble et dans une rue, de jour et de nuit ; compteur avant / après
  (appels, « pire » image) ; passer d'une condition à l'autre par le sélecteur : aucune image > 50 ms après la première
  apparition de chaque effet.
- Hors ligne (onglet « réseau » coupé), API arrêtée (`npm run dev` sans `api:dev`), 404 (build Pi) : démarrage normal.
- Mobile simulé 375 × 667 et 320 × 568 : la barre d'heure avec la puce tient.
- **Mesures de cadence** : le navigateur de test de Claude fait un rendu logiciel (non représentatif, règle 6) ; utiliser le
  Chrome du Mac avec la puce graphique (scripts de la section 11). **Téléphone : Dasco** (protocole en US001).

---

## 7. Découpage en user stories (carte, et écran admin)

Numérotation de la spec gardée (US001 à US011) ; US012 et US013 viennent du plan back. Jours = développement + vérification
navigateur, ± 30 %, **test sur téléphone non compté**.

| ID | User story | Jours (front) | Dépend de | Attend la route du back ? |
|---|---|---|---|---|
| US001 | Niveaux de qualité, compteur GPU, mesure de la pluie sur téléphone | 0,75 à 1 | — | Non |
| US002 | Socle météo : état, fondu, couvert, `?weather=`, puce, préférences, crochets du démarrage | 3 | 1er commit de US003 (contrat seul) | **Non** (contrat seulement) |
| US006 | Brouillard | 1,5 | US002 | Non |
| US004 | Météo réelle côté carte : lecture, relances, états, crédits | 1 à 1,5 | US002, US003 | **Oui** (fusionnée, ou `npm run api:dev`) |
| US005 | Pluie | 2,5 à 3 | US001, US002 | Non |
| US008 | Orage | 2 | US005 | Non |
| US009 | Vent | 2 à 2,5 | US002 | Non |
| US010 | Nuages de maquette | 1,5 | US002 | Non |
| US007 | Neige | 3 à 4 | US002, US005 (crochets) | Non |
| US011 | Finitions, calibrage, doc | 1,5 à 2 | toutes | Non |
| US012 | Écran « Météo » de l'admin (partie interface) | 0,6 (sur 1 à 1,25 avec le back) | US012 back | Oui |
| US013 | Prévisions heure par heure (facultative, D4) | 1 (+ 0,5 back) | US004, US013 back | Oui |

### US001 — Niveaux de qualité, compteur GPU, mesure de la pluie sur téléphone
Contenu : `qualityLevel` + `?quality=` (5.1) ; ligne GPU dans `perfhud.ts` quand l'extension existe ; prototype de pluie derrière
`?debug&rain=N` (code de `rain-proto.ts`, chargé à la demande) ; protocole de mesure.
- [ ] **Given** un téléphone, **When** le diorama démarre, **Then** `qualityLevel` vaut `medium` (ou `low` si `deviceMemory ≤ 3`),
  `?quality=` le force, le compteur `?debug` l'affiche.
- [ ] **Given** `?debug` dans Chrome (Mac, Android), **Then** le compteur affiche « GPU x,x ms » ; dans Safari, « GPU n/d ».
- [ ] **Given** `?debug&rain=2500`, **Then** la pluie prototype est dessinée en 1 appel (+1 au compteur), sans à-coup.
- [ ] **Given** la mesure de Dasco sur son iPhone (protocole ci-dessous), **Then** une ligne dans DECISIONS : budget retenu
  (ex. « pluie : palier de cadence inchangé, pire image ≤ +5 ms, ≤ +2 appels ») et le nombre de gouttes par niveau.
Protocole (Dasco) : mode économie d'énergie coupé ; même vue (vue d'ensemble, puis une rue) ; 10 s au repos puis 10 s en tournant
à deux doigts ; noter img/s et « pire » avec `?debug`, puis `?debug&rain=2500`, puis `&rain=5000` ; noter le modèle et la
version d'iOS. Risque : le plafond de 31 img/s de l'iPhone (DECISIONS, 02/10) est peut-être un palier de 30 Hz (économie
d'énergie, ProMotion) plutôt qu'un manque de puissance : la mesure le dira.

### US002 — Socle météo
Contenu : `weather/state.ts`, `client.ts` (sans appel réel tant que US004 n'est pas faite, ou avec), `index.ts` chargé par
`import()` ; modificateur `weather-sky.ts` branché dans `daynight.ts` (2.1) ; **crochets du démarrage** : objet brouillard
inactif (`stage.ts` l. 23), correction prémultipliée et uniformes de la passe finale (2.2), `fog: false` des repères (2.3),
objet `wind` partagé (2.5) ; `?weather=` ; puce et panneau ; préférence « météo désactivée » ; réduit-mouvement ;
`dev/weather-debug.ts` et `window.diorama.weather`.
- [ ] **Given** aucune météo (ni `?weather=`, ni API), **When** la carte s'ouvre, **Then** la scène est identique à aujourd'hui
  (captures à 12 h et 22 h, mêmes appels de rendu) et rien n'attend.
- [ ] **Given** `?weather=cloudy`, **Then** en ≈ 3 s la lumière devient plus douce et grise, les ombres s'effacent, le fond se
  grise, **sans** image de plus de 50 ms (pas de bascule d'ombre).
- [ ] **Given** `?weather=clear`, **Then** identique à aujourd'hui.
- [ ] **Given** `?debug`, **Then** le sélecteur (9 conditions + curseurs) et `window.diorama.weather.set({...})` forcent une météo.
- [ ] **Given** la puce, **When** on l'ouvre, **Then** condition, température si connue, heure du modèle et état (Direct, Simulée,
  Forcée, Non disponible) ; « Simulée » dès que l'heure ou la saison quitte le direct, avec « Revenir au direct ».
- [ ] **Given** la préférence « météo désactivée », **Then** aucun chunk météo téléchargé et aucune requête `/api/weather`.
- [ ] **Given** `prefers-reduced-motion`, **Then** les règles de la section 5.3 s'appliquent.
- [ ] **Given** `npm run build` et `npm test`, **Then** ils passent ; la météo est dans un chunk à part ; chunk principal
  ≤ +2,5 Ko gzip.
Risques : bord du socle et particules sur le fond après la correction prémultipliée (vérifier jour, nuit, effet maquette) ;
barre d'heure trop large sur petit écran.

### US006 — Brouillard
- [ ] **Given** `?weather=fog`, **Then** le devant de la ville reste lisible et le fond se fond dans la couleur du fond de page,
  de jour comme de nuit, **sans liseré clair** autour du socle.
- [ ] **Given** la caméra qui s'approche ou s'éloigne, **Then** le brouillard reste proportionné (léger de près).
- [ ] **Given** la nuit, **Then** les halos des bars, les gemmes ✦ et les épingles percent le brouillard.
- [ ] **Given** les étiquettes et l'interface, **Then** elles restent nettes et lisibles (contraste des boutons vérifié sur fond gris).
- [ ] **Given** le brouillard activé puis coupé dix fois, **Then** aucune image > 50 ms et 0 programme nouveau (compteur).
Risque : réglage esthétique (densité, voile) ; les éléphants dans le brouillard (jeu) : à trancher.

### US004 — Météo réelle côté carte
- [ ] **Given** l'API disponible, **When** le diorama démarre, **Then** la météo arrive après la scène (jamais devant l'écran de
  chargement) et s'installe en fondu ; la puce dit « modèle ICON, 10 h 00 (il y a 6 min) ».
- [ ] **Given** 503 `meteo-indisponible`, délai de 8 s ou hors ligne, **Then** ciel par défaut, « Météo non disponible »,
  relance à 60 s puis 2, 4, 8 min (≤ 15), et au retour du réseau.
- [ ] **Given** 404 (build du Pi), **Then** ciel par défaut, aucune relance, puce masquée.
- [ ] **Given** 503 `meteo-desactivee`, **Then** ciel par défaut, « Météo désactivée », relue dans 15 min.
- [ ] **Given** l'onglet caché ou aucune interaction depuis 30 min, **Then** aucune requête ; au retour, relecture si le relevé a
  plus de 15 min.
- [ ] **Given** une météo forcée par l'admin, **Then** « Météo forcée (démo) », sans température ; **Given** `stale`, **Then**
  « Ancien relevé (il y a 1 h 10) » ; **Given** un relevé de plus de 3 h, **Then** ciel par défaut.
- [ ] **Given** la neige annoncée à plus de 2 °C, **Then** de la pluie.
- [ ] **Given** les crédits, **Then** « Météo : Open-Meteo.com » avec lien et CC BY 4.0 en bas à droite (visible sur mobile) et
  dans le lobby ; le panneau montre `attribution` (texte, lien, licence) ; README (Licences) à jour avec le back.
Risque : décalage entre la condition affichée et l'appli météo du téléphone (seuils du back, R5 du plan back).

### US005 — Pluie
- [ ] **Given** `?weather=rain&intensity=0.8`, **Then** des traînées tombent au-dessus du socle (≤ 2 appels, nombre selon le
  niveau × intensité), rues, toits et sol paraissent mouillés (plus sombres, satinés).
- [ ] **Given** une bruine (0,15) puis une averse (0,85), **Then** densité et longueur visiblement différentes.
- [ ] **Given** un zoom de la vue d'ensemble à 100 m, **Then** aucun saut des gouttes (deux nappes en fondu).
- [ ] **Given** la nuit, **Then** halos des bars et lueur des rues un peu plus forts.
- [ ] **Given** la scène au repos sous la pluie, **Then** 30 img/s (« repos (30 max) »), pluie animée.
- [ ] **Given** le budget de US001, **Then** respecté sur le téléphone de mesure.
- [ ] **Given** < 24 img/s en mouvement avec la densité de pixels au minimum, **Then** densité ÷ 2 puis coupure (5.2).
Risques : lisibilité selon le zoom ; teinte de la pluie sur les toits clairs ; la pluie hors socle si Dasco la préfère partout.

### US008 — Orage
- [ ] **Given** `?weather=thunder`, **Then** forte pluie, ciel assombri, éclairs (passe finale + lumière d'ambiance), un trait
  d'éclair de temps en temps, loin de la caméra.
- [ ] **Given** les éclairs, **Then** jamais plus de 3 par seconde (planificateur testé).
- [ ] **Given** `prefers-reduced-motion` ou « Effets réduits », **Then** aucun éclair.
- [ ] **Given** l'orage, **Then** soleil et ombres immobiles (aucun recalcul de la carte des ombres).

### US009 — Vent
- [ ] **Given** un vent réel (ou `?weather=rain&wind=60&windfrom=200`), **Then** fumées et drapeaux tournent et se couchent en
  ≈ 6 s selon direction et force.
- [ ] **Given** un vent > 25 km/h et `qualityLevel` ≥ `medium`, **Then** les arbres se balancent ; coût mesuré avant / après
  (Mac, puis téléphone) et noté ; rien en `low` ni en réduit-mouvement.
- [ ] **Given** l'automne, **Then** quelques feuilles volent (facultatif).

### US010 — Nuages de maquette
- [ ] **Given** une couverture nuageuse, **Then** des nuages instanciés (1 appel) flottent, en nombre proportionnel, et dérivent
  avec le vent.
- [ ] **Given** la caméra qui s'approche, **Then** ils s'effacent en fondu ; **Given** `low`, **Then** aucun.

### US007 — Neige
- [ ] **Given** `?weather=snow`, **Then** des flocons tombent lentement (≤ 2 appels).
- [ ] **Given** de la neige, **Then** toits, sol et canopées blanchissent selon la pente, palette pastel gardée ; vérifié dans
  chaque vue (ensemble, Carré Curial, château, rue).
- [ ] **Given** les 8 à 10 matériaux concernés, **Then** un seul morceau de GLSL commun, posé au démarrage (aucun à-coup à
  l'arrivée de la neige).
- [ ] **Given** l'item « arbres enneigés » du BACKLOG, **Then** traité ou reporté explicitement.

### US011 — Finitions, calibrage, documentation
- [ ] **Given** chaque météo, **Then** rendu relu et validé par Dasco avec `?weather=` (constantes nommées, notées dans DECISIONS).
- [ ] **Given** la fin de l'epic, **Then** FEATURES, CHANGELOG, DECISIONS, README (puce, `?weather=`, `?quality=`), PERF-AUDIT
  (mesures téléphone) à jour.

### US012 — Écran « Météo » de l'administration (partie interface ; détail au plan back § 6.5)
`frontend/admin/src/pages/Meteo.tsx` + `Meteo.test.tsx`, onglet dans `Layout.tsx` (tableau `PAGES`, l. 6-9), route `/meteo`
dans `App.tsx` ; `useQuery` sur `GET /api/admin/weather` (validé par `adminWeatherResponse`), relu toutes les 60 s page ouverte ;
formulaire React Hook Form validé par `weatherOverrideInput` (forcer, couper, durée, note) ; « Revenir à la météo réelle ».
Ajout côté interface : un lien **« Aperçu sur la carte »** qui ouvre `/?weather=<condition>&intensity=<x>` : même rendu que le
forçage (valeurs types partagées), pour vérifier avant de l'imposer à tous. Pas de HTML construit à partir de données
(`check-boundaries`, `noRawHtml`).

### US013 — Prévisions heure par heure (facultative, si D4 = oui)
Côté carte : lecture de `/api/weather/forecast` (48 pas horaires) ; hors Direct, le jour même, l'heure la plus proche ; lecture
▶ = météo de la journée qui défile ; hors fenêtre : « simulée ». 1 j front.

### Lots et ordre
| Lot | US (front) | Jours front | + back | Ce qu'on obtient |
|---|---|---|---|---|
| **Démo** (sans back) | US001, US002, US006 | ≈ 5,25 à 5,5 | (contrat : 0,25) | Couvert, brouillard, puce, `?weather=` ; mesure téléphone ; aucun risque de fluidité |
| **MVP** | Démo + US004, US005 | ≈ 9 à 10 | US003 : 1,5 à 2 | Météo réelle avec pluie et brouillard (les temps les plus fréquents à Chambéry) |
| **Complet** | MVP + US008, US009, US010, US007, US011, US012 (interface) | ≈ 19 à 22,5 | + US012 : 1 à 1,25 | Orage, vent, nuages, neige, admin |

Ordre conseillé : contrat (1er commit de US003, back) → US001 (mesure téléphone tôt) → US002 → US006 (démontrable) ; US003 en
parallèle → US004 → US005 ; puis selon la saison (neige avant l'hiver si on veut l'effet démo).

### Poids ajouté
| Morceau | Gzip | Statut |
|---|---|---|
| Chunk principal aujourd'hui (`index-….js`) | 84,2 Ko (220 Ko brut) ; three.js 169 Ko à part | [mesuré, build du 09/10] |
| Module météo prototype (`weather-….js` : état, client, pluie, entrée, `contrat/meteo.ts`) | **4,4 Ko** (10,2 Ko brut) | [mesuré] |
| Module météo complet (neige, éclairs, nuages, panneau) | ≈ 8 à 10 Ko, chargé à la demande | [estimé] |
| Sélecteur `?debug` | ≈ 1,5 Ko, chunk à part | [estimé] |
| Chunk principal : crochets GLSL, brouillard, passe finale, bouton, préférence, `import()` | ≈ +1,5 à 2,5 Ko | [estimé] |
`zod/mini` est déjà dans le chunk principal (contrat des parkings) : le contrat météo n'ajoute que ses schémas (+1,3 Ko gzip,
mesuré par le plan back), dans le chunk météo s'il n'est importé que là.

---

## 8. Risques

| # | Risque | Parade |
|---|---|---|
| F1 | Fluidité sur téléphone non mesurée | US001 en premier ; niveaux ; règle 5.2 |
| F2 | Recompilation en cours de route (images figées de plusieurs secondes la première fois) | Crochets au démarrage (2.3, 2.8) ; jamais de bascule d'ombre ; critère « pire image ≤ 50 ms » dans les CA |
| F3 | Correction prémultipliée : changement de la passe finale pour toute la carte | Captures avant / après (jour, nuit, effet maquette) ; prototype : aspect de jour inchangé à l'œil (`v-jour-unpremult.png`) |
| F4 | Pluie qui « saute » au zoom, ou trop visible sur le fond | Deux nappes ; limite au socle |
| F5 | Neige : palette, nombreux matériaux | Un seul GLSL ; relecture par vue ; lot Complet |
| F6 | Photosensibilité | Planificateur testé ; réduit-mouvement ; interrupteur |
| F7 | Seuil 24 img/s inadapté à un écran 120 Hz | La règle ne joue que densité au minimum ; à revoir après la mesure |
| F8 | Barre d'heure trop large sur petit écran | Icône seule ≤ 720 px ; vérification 375 / 320 px |
| F9 | Contrat qui évolue (nouvelle condition) avec une carte ancienne gardée par le service worker | Réponse refusée → ciel par défaut (accepté par le plan back) |
| F10 | Le fond CSS change à chaque image pendant un fondu (repeinture du fond) | Fondus courts (3 à 6 s), comme la lecture ▶ aujourd'hui ; limiter à 10 mises à jour/s si besoin |

---

## 9. Questions pour Dasco (vraies questions seulement)
1. Pluie et neige **au-dessus du socle seulement** (recommandé) ou partout à l'écran ?
2. Repères de jeu dans le brouillard : gemmes ✦, épingles et éléphants **toujours visibles** (recommandé) ?
3. D4 : hors « Direct », beau temps « simulé » (recommandé, v1) ou garder la météo du moment ?
Le reste suit les recommandations (spec, plan back) : décorative + puce (D5), `?weather=` **et** forçage admin (D6).

---

## 10. Vérifié / non vérifié

**Vérifié / mesuré (09/10/2026)**
- Lecture du code : tous les points d'insertion de la section 2 (numéros de ligne au commit `c7f6101`).
- Pluie GPU : coût et cadence (4.3), sur le M1 avec la puce graphique, A/B dans la même page ; 1 appel ; ajout sans à-coup.
- À-coups de recompilation (première exécution, cache de shaders du système vide pour ces variantes / seconde exécution) :
  brouillard créé en cours de route 4 380 ms / 258 ms (38 → 69 programmes) ; `castShadow` 2 974 ms / 215 ms (69 → 97) ;
  matériau repatché 169 ms / 18 ms ; changement de `near` / `far` / couleur ou nouvel objet du même type : 9 à 11 ms ;
  intensité du soleil : 8 à 11 ms ; démarrage avec ou sans objet brouillard : 38 programmes, 296 à 389 ms (cache chaud).
- Couvert, brouillard de jour et de nuit, pluie, liseré corrigé : captures du prototype.
- Inverse ACES : 5 tests à < 1/255. Client et état : 19 tests ; projet carte : 28 tests verts ; `tsc` carte et contrat,
  `check-boundaries` : OK. Module météo chargé à la demande : 4,4 Ko gzip, `?weather=rain` sans requête réseau, sans API
  « Météo non disponible » sans erreur.
- `EXT_disjoint_timer_query_webgl2` et `KHR_parallel_shader_compile` disponibles dans Chrome sur Mac.

**Non vérifié**
- **Aucune mesure sur téléphone** (iPhone, Android) : coût réel de la pluie, du balancement des arbres, de la neige au sol.
- Temps GPU absolus : les requêtes de temps sous ANGLE / Metal sont des ordres de grandeur ; seuls les écarts A/B comptent.
- Coût GPU du brouillard actif et des crochets à 0 (estimé négligeable, non mesuré).
- Neige, orage, vent, nuages : non prototypés. Panneau de la puce, sélecteur `?debug`, écran admin : non prototypés.
- Rendu esthétique : aucun avis de Dasco encore ; valeurs du modificateur à calibrer.
- Barre d'heure avec la puce à 320 px.

---

## 11. Prototype : quoi reprendre
Dossier `…/scratchpad/ep009-front/` (copie du dépôt au commit `c7f6101`, `node_modules` lié) :
| Fichier | Contenu |
|---|---|
| `frontend/carte/src/scene/rain-proto.ts` | Pluie GPU (quadrilatères en pixels, boîte ancrée, `uDensity`, limite au socle `uBounds`) |
| `frontend/carte/src/scene/weather-color.ts` + `.test.ts` | Couleur du brouillard (inverse ACES) |
| `frontend/carte/src/weather/state.ts`, `client.ts`, `index.ts`, `precipitation.ts` + `state.test.ts`, `client.test.ts` | Logique pure, client, entrée chargée à la demande |
| `frontend/carte/src/scene/daynight.ts` | Modificateur `weatherLook` après la l. 86 (`refresh`, `bgEdge`, `exposure`) |
| `frontend/carte/src/scene/tiltshift.ts` | Correction prémultipliée (`UNPREMULT`) |
| `frontend/carte/src/main.ts` | Instrumentation (`window.__perf`, requêtes de temps GPU, `?rain`, `?fog`, `?cloudy`, `?hour`, `?meteo`, `?unpremult`, `?socle`) — **à ne pas reprendre telle quelle** (`window.THREE` gonfle le chunk three.js) |
| `contrat/meteo.ts` | Copie du contrat prototypé par le plan back |
| `measure.mjs`, `ab.mjs`, `hitch.mjs`, `hitch2.mjs`, `startup.mjs`, `shots2.mjs`, `e2e.mjs` | Mesures dans Chrome for Testing + Metal (`node ab.mjs uncapped dpr2 count=3000`) ; résultats `run2-*.jsonl`, `ab-*.txt`, `hitch*.txt` ; captures `v-*.png`, `e2e*.png` |
Pour mesurer : `npx vite build frontend/carte` puis `npx vite preview frontend/carte --port 4180` dans ce dossier.
